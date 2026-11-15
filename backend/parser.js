/**
 * Node Protocols Parser & Formatter
 * Supports:
 * - VMess (vmess://)
 * - VLESS (vless://)
 * - Shadowsocks (ss://)
 * - ShadowsocksR (ssr://)
 * - Trojan (trojan://)
 * - Hysteria 1/2 (hysteria://, hy2://)
 * - TUIC (tuic://)
 * - AnyTLS (anytls://)
 * - WireGuard (wireguard://)
 * - SSH (ssh://)
 * - Snell (snell://)
 * - Mieru (mieru://)
 * - SOCKS5 / HTTP (socks5://, http://)
 * - Clash Proxies YAML / Base64 Raw lists
 */

function safeDecodeBase64(str) {
  if (!str) return '';
  str = str.trim().replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  try {
    return Buffer.from(str, 'base64').toString('utf8');
  } catch (e) {
    return '';
  }
}

function safeEncodeBase64(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

// 1. VMess
function parseVmess(uri) {
  try {
    const raw = uri.replace(/^vmess:\/\//i, '').trim();
    const jsonStr = safeDecodeBase64(raw);
    const data = JSON.parse(jsonStr);

    const node = {
      type: 'vmess',
      name: data.ps || 'VMess-' + (data.add || 'node'),
      server: data.add,
      port: parseInt(data.port, 10),
      uuid: data.id,
      alterId: parseInt(data.aid || 0, 10),
      cipher: data.scy || 'auto',
      udp: true,
      tls: data.tls === 'tls',
      'skip-cert-verify': true
    };

    if (data.net) {
      node.network = data.net;
      if (data.net === 'ws') {
        node['ws-opts'] = {
          path: data.path || '/',
          headers: {}
        };
        if (data.host) node['ws-opts'].headers.Host = data.host;
      } else if (data.net === 'grpc') {
        node['grpc-opts'] = {
          'grpc-service-name': data.path || ''
        };
      } else if (data.net === 'h2') {
        node['h2-opts'] = {
          host: [data.host || data.add],
          path: data.path || '/'
        };
      }
    }
    if (data.sni) node.servername = data.sni;
    else if (data.host && node.tls) node.servername = data.host;

    return node;
  } catch (e) {
    return null;
  }
}

// 2. VLESS
function parseVless(uri) {
  try {
    const u = new URL(uri);
    const params = new URLSearchParams(u.search);
    const node = {
      type: 'vless',
      name: decodeURIComponent(u.hash ? u.hash.slice(1) : 'VLESS-' + u.hostname),
      server: u.hostname,
      port: parseInt(u.port || 443, 10),
      uuid: u.username,
      udp: true,
      tls: params.get('security') === 'tls' || params.get('security') === 'reality',
      'skip-cert-verify': true
    };

    const flow = params.get('flow');
    if (flow) node.flow = flow;

    // VLESS Encryption（后量子加密，新版内核支持）
    if (params.get('encryption')) node.encryption = params.get('encryption');

    const net = params.get('type') || 'tcp';
    node.network = net;
    if (net === 'ws') {
      node['ws-opts'] = {
        path: params.get('path') || '/',
        headers: {}
      };
      if (params.get('host')) node['ws-opts'].headers.Host = params.get('host');
    } else if (net === 'grpc') {
      node['grpc-opts'] = {
        'grpc-service-name': params.get('serviceName') || ''
      };
    }

    if (params.get('security') === 'reality') {
      node['reality-opts'] = {
        'public-key': params.get('pbk') || '',
        'short-id': params.get('sid') || ''
      };
      if (params.get('sni')) node.servername = params.get('sni');
      if (params.get('fp')) node['client-fingerprint'] = params.get('fp');
    } else if (params.get('sni')) {
      node.servername = params.get('sni');
    }

    return node;
  } catch (e) {
    return null;
  }
}

// 3. Shadowsocks
function parseSS(uri) {
  try {
    // Standard: ss://BASE64(method:password)@server:port#name
    // or SIP002: ss://BASE64(method:password@server:port)#name
    const raw = uri.replace(/^ss:\/\//i, '');
    let mainPart = raw;
    let name = '';
    if (mainPart.includes('#')) {
      const parts = mainPart.split('#');
      mainPart = parts[0];
      name = decodeURIComponent(parts.slice(1).join('#'));
    }

    let method = '', password = '', server = '', port = 8388, plugin = '', pluginOpts = {};
    if (mainPart.includes('?')) {
      const qParts = mainPart.split('?');
      mainPart = qParts[0];
      const params = new URLSearchParams(qParts[1]);
      if (params.get('plugin')) {
        const pRaw = decodeURIComponent(params.get('plugin'));
        const pSplit = pRaw.split(';');
        plugin = pSplit[0];
        pSplit.slice(1).forEach(item => {
          const [k, v] = item.split('=');
          if (k) pluginOpts[k] = v || true;
        });
      }
    }

    if (mainPart.includes('@')) {
      const [userinfo, hostport] = mainPart.split('@');
      const decodedUser = safeDecodeBase64(userinfo);
      if (decodedUser.includes(':')) {
        [method, password] = decodedUser.split(':');
      } else {
        // Maybe not base64 encoded userinfo
        [method, password] = userinfo.split(':');
      }
      const [h, p] = hostport.split(':');
      server = h;
      port = parseInt(p, 10);
    } else {
      // Entire mainPart is base64
      const decoded = safeDecodeBase64(mainPart);
      // Format method:password@server:port
      const atIdx = decoded.lastIndexOf('@');
      if (atIdx !== -1) {
        const creds = decoded.substring(0, atIdx);
        const hp = decoded.substring(atIdx + 1);
        [method, password] = creds.split(':');
        const [h, p] = hp.split(':');
        server = h;
        port = parseInt(p, 10);
      }
    }

    if (!server || !port || !method) return null;

    const node = {
      type: 'ss',
      name: name || `SS-${server}:${port}`,
      server: server,
      port: port,
      cipher: method,
      password: password,
      udp: true
    };
    if (plugin) {
      node.plugin = plugin;
      node['plugin-opts'] = pluginOpts;
    }
    return node;
  } catch (e) {
    return null;
  }
}

// 4. Trojan
function parseTrojan(uri) {
  try {
    const u = new URL(uri);
    const params = new URLSearchParams(u.search);
    const node = {
      type: 'trojan',
      name: decodeURIComponent(u.hash ? u.hash.slice(1) : 'Trojan-' + u.hostname),
      server: u.hostname,
      port: parseInt(u.port || 443, 10),
      password: decodeURIComponent(u.username),
      udp: true,
      'skip-cert-verify': true
    };

    if (params.get('sni')) node.sni = params.get('sni');
    const net = params.get('type');
    if (net === 'ws') {
      node.network = 'ws';
      node['ws-opts'] = {
        path: params.get('path') || '/',
        headers: {}
      };
      if (params.get('host')) node['ws-opts'].headers.Host = params.get('host');
    } else if (net === 'grpc') {
      node.network = 'grpc';
      node['grpc-opts'] = {
        'grpc-service-name': params.get('serviceName') || ''
      };
    }

    return node;
  } catch (e) {
    return null;
  }
}

// 5. Hysteria 2 / Hysteria 1
function parseHysteria(uri) {
  try {
    const isHy2 = uri.startsWith('hy2://') || uri.startsWith('hysteria2://');
    const u = new URL(uri);
    const params = new URLSearchParams(u.search);
    const node = {
      type: isHy2 ? 'hysteria2' : 'hysteria',
      name: decodeURIComponent(u.hash ? u.hash.slice(1) : (isHy2 ? 'Hy2-' : 'Hy1-') + u.hostname),
      server: u.hostname,
      port: parseInt(u.port || 443, 10),
      password: decodeURIComponent(u.username || params.get('auth') || ''),
      auth: decodeURIComponent(u.username || params.get('auth') || ''),
      'skip-cert-verify': true
    };

    if (params.get('sni')) node.sni = params.get('sni');
    if (params.get('obfs')) {
      node.obfs = params.get('obfs');
      if (params.get('obfs-password')) node['obfs-password'] = params.get('obfs-password');
    }

    return node;
  } catch (e) {
    return null;
  }
}

// 6. TUIC
function parseTuic(uri) {
  try {
    const u = new URL(uri);
    const params = new URLSearchParams(u.search);
    const node = {
      type: 'tuic',
      name: decodeURIComponent(u.hash ? u.hash.slice(1) : 'TUIC-' + u.hostname),
      server: u.hostname,
      port: parseInt(u.port || 443, 10),
      uuid: u.username,
      password: u.password,
      'congestion-controller': params.get('congestion_control') || 'bbr',
      'udp-relay-mode': params.get('udp_relay_mode') || 'native',
      'skip-cert-verify': true
    };
    if (params.get('sni')) node.sni = params.get('sni');
    if (params.get('alpn')) node.alpn = params.get('alpn').split(',');
    return node;
  } catch (e) {
    return null;
  }
}

// 6.5 AnyTLS
function parseAnyTLS(uri) {
  try {
    const u = new URL(uri);
    const params = new URLSearchParams(u.search);
    const password = decodeURIComponent(u.username || params.get('password') || '');
    const insecure = ['1', 'true'].includes(String(params.get('insecure') || params.get('allowInsecure') || '').toLowerCase());

    const node = {
      type: 'anytls',
      name: decodeURIComponent(u.hash ? u.hash.slice(1) : 'AnyTLS-' + u.hostname),
      server: u.hostname,
      port: parseInt(u.port || 443, 10),
      password: password,
      udp: true,
      'client-fingerprint': params.get('fp') || 'chrome',
      'skip-cert-verify': insecure
    };

    const sni = params.get('sni') || params.get('peer');
    if (sni) node.sni = sni;
    if (params.get('alpn')) node.alpn = params.get('alpn').split(',');
    if (params.get('idle-session-check-interval')) node['idle-session-check-interval'] = parseInt(params.get('idle-session-check-interval'), 10);
    if (params.get('idle-session-timeout')) node['idle-session-timeout'] = parseInt(params.get('idle-session-timeout'), 10);
    if (params.get('min-idle-session')) node['min-idle-session'] = parseInt(params.get('min-idle-session'), 10);

    if (!node.server || !node.port || !node.password) return null;
    return node;
  } catch (e) {
    return null;
  }
}

// 6.6 WireGuard
function parseWireGuard(uri) {
  try {
    const u = new URL(uri);
    const params = new URLSearchParams(u.search);
    const privateKey = decodeURIComponent(u.username || params.get('privatekey') || params.get('private-key') || '');
    const publicKey = params.get('publickey') || params.get('public-key') || '';
    const address = params.get('address') || params.get('ip') || '';

    const node = {
      type: 'wireguard',
      name: decodeURIComponent(u.hash ? u.hash.slice(1) : 'WireGuard-' + u.hostname),
      server: u.hostname,
      port: parseInt(u.port || 51820, 10),
      'private-key': privateKey,
      'public-key': publicKey,
      udp: true
    };

    if (address) {
      const ips = address.split(',').map(s => s.trim()).filter(Boolean);
      const v4 = ips.filter(ip => !ip.includes(':'));
      const v6 = ips.filter(ip => ip.includes(':'));
      if (v4.length > 0) node.ip = v4.join(',');
      if (v6.length > 0) node.ipv6 = v6.join(',');
    }

    const presharedKey = params.get('presharedkey') || params.get('preshared-key') || params.get('psk');
    if (presharedKey) node['preshared-key'] = presharedKey;

    if (params.get('mtu')) node.mtu = parseInt(params.get('mtu'), 10);

    const reserved = params.get('reserved');
    if (reserved) {
      const nums = reserved.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
      if (nums.length > 0) node.reserved = nums;
    }

    if (params.get('dns')) node.dns = params.get('dns').split(',');
    if (params.get('allowed-ips')) node['allowed-ips'] = params.get('allowed-ips').split(',');

    if (!node.server || !node.port || !node['private-key'] || !node['public-key']) return null;
    return node;
  } catch (e) {
    return null;
  }
}

// 6.7 SSH
function parseSSH(uri) {
  try {
    const u = new URL(uri);
    const params = new URLSearchParams(u.search);

    const node = {
      type: 'ssh',
      name: decodeURIComponent(u.hash ? u.hash.slice(1) : 'SSH-' + u.hostname),
      server: u.hostname,
      port: parseInt(u.port || 22, 10),
      username: decodeURIComponent(u.username || 'root'),
      udp: true
    };

    if (u.password) node.password = decodeURIComponent(u.password);

    const privateKey = params.get('private-key') || params.get('privatekey');
    if (privateKey) node['private-key'] = privateKey.replace(/\\n/g, '\n');

    const passphrase = params.get('private-key-passphrase');
    if (passphrase) node['private-key-passphrase'] = passphrase;

    const hostKey = params.get('host-key') || params.get('hostkey');
    if (hostKey) node['host-key'] = hostKey.split(',');

    const algs = params.get('host-key-algorithms');
    if (algs) node['host-key-algorithms'] = algs.split(',');

    if (!node.server || !node.port || !node.username) return null;
    if (!node.password && !node['private-key']) return null;
    return node;
  } catch (e) {
    return null;
  }
}

// 6.8 Snell
function parseSnell(uri) {
  try {
    const u = new URL(uri);
    const params = new URLSearchParams(u.search);

    let psk = u.username ? decodeURIComponent(u.username) : (params.get('psk') || '');
    // 兼容 snell://BASE64(psk)@host:port 形式（仅在解码结果为可打印字符串时采用，避免误伤普通 psk）
    if (psk && !params.get('psk') && /^[A-Za-z0-9+/=_-]{8,}$/.test(psk)) {
      const decoded = safeDecodeBase64(psk);
      if (decoded && /^[\x20-\x7e]+$/.test(decoded) && !decoded.includes(':')) {
        psk = decoded;
      }
    }

    const node = {
      type: 'snell',
      name: decodeURIComponent(u.hash ? u.hash.slice(1) : 'Snell-' + u.hostname),
      server: u.hostname,
      port: parseInt(u.port || 443, 10),
      psk: psk,
      version: parseInt(params.get('version') || params.get('v') || 4, 10),
      udp: true
    };

    const obfs = params.get('obfs');
    if (obfs && obfs.toLowerCase() !== 'none') {
      node['obfs-opts'] = { mode: obfs };
      const host = params.get('obfs-host') || params.get('obfs_host') || params.get('host');
      if (host) node['obfs-opts'].host = host;
    }

    if (!node.server || !node.port || !node.psk) return null;
    return node;
  } catch (e) {
    return null;
  }
}

// 6.9 Mieru
function parseMieru(uri) {
  try {
    const u = new URL(uri);
    const params = new URLSearchParams(u.search);

    const node = {
      type: 'mieru',
      name: decodeURIComponent(u.hash ? u.hash.slice(1) : 'Mieru-' + u.hostname),
      server: u.hostname,
      port: parseInt(u.port || 443, 10),
      username: decodeURIComponent(u.username || params.get('username') || ''),
      password: decodeURIComponent(u.password || params.get('password') || ''),
      transport: (params.get('transport') || 'TCP').toUpperCase(),
      multiplexing: params.get('multiplexing') || 'MULTIPLEXING_OFF',
      udp: true
    };

    const portRange = params.get('port-range') || params.get('port_range');
    if (portRange) node['port-range'] = portRange;

    if (!node.server || !node.port || !node.username || !node.password) return null;
    return node;
  } catch (e) {
    return null;
  }
}

// 7. SOCKS5 / HTTP
function parseSocksHttp(uri) {
  try {
    const u = new URL(uri);
    const type = u.protocol.replace(':', '');
    const node = {
      type: type.includes('socks') ? 'socks5' : 'http',
      name: decodeURIComponent(u.hash ? u.hash.slice(1) : `${type.toUpperCase()}-${u.hostname}:${u.port}`),
      server: u.hostname,
      port: parseInt(u.port || (type === 'http' ? 80 : 1080), 10)
    };
    if (u.username) node.username = decodeURIComponent(u.username);
    if (u.password) node.password = decodeURIComponent(u.password);
    return node;
  } catch (e) {
    return null;
  }
}

// 8. SSR (ShadowsocksR)
function parseSSR(uri) {
  try {
    const raw = uri.replace(/^ssr:\/\//i, '');
    const decoded = safeDecodeBase64(raw);
    // host:port:protocol:method:obfs:urlsafebase64pass/?obfsparam=...&protoparam=...&remarks=...&group=...
    const [main, paramPart] = decoded.split('/?');
    const parts = main.split(':');
    if (parts.length < 6) return null;
    const [server, port, protocol, cipher, obfs, b64pass] = parts;
    const password = safeDecodeBase64(b64pass);

    let name = `SSR-${server}:${port}`;
    let obfsparam = '', protoparam = '';
    if (paramPart) {
      const q = new URLSearchParams(paramPart);
      if (q.get('remarks')) name = safeDecodeBase64(q.get('remarks'));
      if (q.get('obfsparam')) obfsparam = safeDecodeBase64(q.get('obfsparam'));
      if (q.get('protoparam')) protoparam = safeDecodeBase64(q.get('protoparam'));
    }

    return {
      type: 'ssr',
      name: name,
      server: server,
      port: parseInt(port, 10),
      cipher: cipher,
      password: password,
      protocol: protocol,
      'protocol-param': protoparam,
      obfs: obfs,
      'obfs-param': obfsparam,
      udp: true
    };
  } catch (e) {
    return null;
  }
}

// Parse single line URI
function parseUri(line) {
  if (!line || typeof line !== 'string') return null;
  line = line.trim();
  if (line.startsWith('vmess://')) return parseVmess(line);
  if (line.startsWith('vless://')) return parseVless(line);
  if (line.startsWith('ss://')) return parseSS(line);
  if (line.startsWith('ssr://')) return parseSSR(line);
  if (line.startsWith('trojan://')) return parseTrojan(line);
  if (line.startsWith('hy2://') || line.startsWith('hysteria2://') || line.startsWith('hysteria://')) return parseHysteria(line);
  if (line.startsWith('tuic://')) return parseTuic(line);
  if (line.startsWith('anytls://')) return parseAnyTLS(line);
  if (line.startsWith('wireguard://') || line.startsWith('wg://')) return parseWireGuard(line);
  if (line.startsWith('ssh://')) return parseSSH(line);
  if (line.startsWith('snell://')) return parseSnell(line);
  if (line.startsWith('mieru://')) return parseMieru(line);
  if (line.startsWith('socks5://') || line.startsWith('socks://') || line.startsWith('http://') || line.startsWith('https://')) return parseSocksHttp(line);
  return null;
}

// Parse raw subscription text (could be base64, multiple links, or yaml)
function parseSubscriptionContent(rawText, yamlParser) {
  const nodes = [];
  if (!rawText || typeof rawText !== 'string') return nodes;

  let text = rawText.trim();

  // Try parsing as Clash/Mihomo YAML first
  if (text.includes('proxies:') && yamlParser) {
    try {
      const doc = yamlParser.parse(text);
      if (doc && Array.isArray(doc.proxies)) {
        doc.proxies.forEach((p, idx) => {
          if (p && p.name && p.server && p.type) {
            nodes.push({
              ...p,
              id: p.id || `node-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 8)}`
            });
          }
        });
        if (nodes.length > 0) return nodes;
      }
    } catch (e) {
      // not yaml or yaml parse error, continue
    }
  }

  // Try decoding base64 if it does not contain obvious schemes
  if (!text.includes('://')) {
    const decoded = safeDecodeBase64(text);
    if (decoded && decoded.includes('://')) {
      text = decoded;
    }
  }

  // Split lines
  const lines = text.split(/[\r\n]+/);
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const node = parseUri(trimmed);
    if (node && node.server && node.port) {
      node.id = `node-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 8)}`;
      nodes.push(node);
    }
  });

  return nodes;
}

module.exports = {
  parseUri,
  parseSubscriptionContent,
  safeDecodeBase64,
  safeEncodeBase64
};
