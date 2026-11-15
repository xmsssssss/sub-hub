const axios = require('axios');
const https = require('https');
const yaml = require('yaml');
const db = require('./db');
const { parseSubscriptionContent } = require('./parser');
const tester = require('./tester');

const DEFAULT_USER_AGENT = 'ClashMeta/1.19.31 (Clash.Meta; Linux x86_64)';

let broadcastFn = null;
function setBroadcast(fn) {
  broadcastFn = fn;
}
function broadcast(type, payload) {
  if (broadcastFn) {
    try {
      broadcastFn(type, payload);
    } catch (e) {}
  }
}

function buildRequestConfig(sub) {
  const settings = db.getSettings();
  const ignoreTlsVerify = settings.ignoreTlsVerify !== false;
  const config = {
    timeout: 15000,
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept': '*/*'
    },
    responseType: 'text'
  };

  if (/^https:\/\//i.test(sub.url || '')) {
    config.httpsAgent = new https.Agent({
      rejectUnauthorized: !ignoreTlsVerify
    });
  }

  return config;
}

/**
 * 对某个订阅下的节点执行测速，并广播实时进度
 */
async function testSubscriptionNodes(sub, nodes, { taskIdPrefix = 'autotest', title } = {}) {
  const settings = db.getSettings();
  const taskId = `${taskIdPrefix}_${sub.id}_${Date.now().toString(36)}`;

  broadcast('test_started', {
    taskId,
    subId: sub.id,
    title: title || `自动测速: ${sub.name}`,
    total: nodes.length,
    nodeNames: nodes.map(n => n.name)
  });

  const testResults = await tester.testNodes(nodes, {
    taskId,
    testUrl: settings.testUrl,
    timeout: settings.testTimeout,
    concurrency: settings.testConcurrency,
    maxRetries: 2, // 自动测速支持重试 2 次，避免节点初始握手抖动导致误判超时
    onProgress: (progress) => {
      broadcast('test_progress', { taskId, subId: sub.id, ...progress });
    }
  });

  if (testResults.length < nodes.length) {
    db.addLog('warn', `订阅 [${sub.name}] 有 ${nodes.length - testResults.length} 个节点因当前内核不支持其协议已跳过测速`, { subId: sub.id });
  }

  db.updateNodesBatch(testResults);
  const aliveCount = testResults.filter(r => r.inCombinedSub).length;
  broadcast('test_completed', { taskId, subId: sub.id, results: testResults, count: testResults.length });
  return { testResults, aliveCount };
}

/**
 * 自动刷新后若可用节点为 0，则自动关闭该订阅
 */
function autoDisableIfNoAliveNodes(sub, aliveCount, reasonText) {
  if (aliveCount > 0) return null;
  const disabledSub = db.updateSubscription(sub.id, {
    enabled: false,
    lastStatus: 'failed',
    lastMessage: `${reasonText}，可用节点为 0，已自动关闭该订阅`
  });
  broadcast('subscription_updated', { id: sub.id, sub: disabledSub });
  db.addLog('warn', `订阅 [${sub.name}] ${reasonText}，可用节点为 0，已自动关闭该订阅`, { subId: sub.id });
  return disabledSub;
}

/**
 * 订阅刷新失败（HTTP 非 200）时，回退为测试上一次已获取的节点
 */
function fallbackTestExistingNodes(sub, httpStatus, existingNodes, options = {}) {
  const reason = `HTTP ${httpStatus}`;
  const updatingSub = db.updateSubscription(sub.id, {
    lastStatus: 'updating',
    lastMessage: `刷新失败（${reason}），正在测试上次获取的 ${existingNodes.length} 个节点...`
  });
  broadcast('subscription_updated', { id: sub.id, sub: updatingSub });
  db.addLog('warn', `订阅 [${sub.name}] 刷新失败（${reason}），已改为测试上次获取的 ${existingNodes.length} 个节点`, { subId: sub.id });

  setTimeout(async () => {
    try {
      const { aliveCount } = await testSubscriptionNodes(sub, existingNodes, {
        taskIdPrefix: 'fallbacktest',
        title: `刷新失败回退测速: ${sub.name}`
      });
      const finalSub = db.updateSubscription(sub.id, {
        nodeCount: existingNodes.length,
        aliveCount,
        lastUpdate: new Date().toISOString(),
        lastStatus: 'warning',
        lastMessage: `刷新失败（${reason}），已使用上次节点完成测速：${aliveCount}/${existingNodes.length} 可用`
      });
      broadcast('subscription_updated', { id: sub.id, sub: finalSub });
      db.addLog('info', `订阅 [${sub.name}] 回退测速完成：${aliveCount}/${existingNodes.length} 个节点可用`, { subId: sub.id, aliveCount });

      if (options.auto) {
        autoDisableIfNoAliveNodes(sub, aliveCount, `自动刷新失败（${reason}）`);
      }
    } catch (e) {
      console.error('[Fetcher] Fallback test error:', e.message);
      const failedSub = db.updateSubscription(sub.id, {
        lastStatus: 'warning',
        lastMessage: `刷新失败（${reason}），上次节点测速异常：${e.message}`
      });
      broadcast('subscription_updated', { id: sub.id, sub: failedSub });
      db.addLog('warn', `订阅 [${sub.name}] 刷新失败（${reason}），回退测速异常：${e.message}`, { subId: sub.id });
    }
  }, 300);

  return {
    success: true,
    fallback: true,
    count: existingNodes.length,
    message: `订阅服务器返回 ${reason}，已改为在后台测试上次获取的 ${existingNodes.length} 个节点`
  };
}

async function fetchSubscription(subId, options = {}) {
  const sub = db.getSubscription(subId);
  if (!sub) {
    throw new Error('未找到指定订阅: ' + subId);
  }

  try {
    db.updateSubscription(subId, {
      lastStatus: 'updating',
      lastMessage: '正在请求订阅服务器...'
    });

    if (!sub.ip && sub.url) {
      try {
        const resolvedIp = await db.resolveSubscriptionIp(sub.url);
        if (resolvedIp) {
          db.updateSubscription(subId, { ip: resolvedIp });
        }
      } catch (e) {}
    }

    let response;
    try {
      response = await axios.get(sub.url, buildRequestConfig(sub));
    } catch (err) {
      const httpStatus = err.response && err.response.status;
      if (httpStatus && httpStatus !== 200) {
        const previousNodes = db.getNodes({ subId });
        if (previousNodes.length > 0) {
          return fallbackTestExistingNodes(sub, httpStatus, previousNodes, options);
        }
      }
      throw err;
    }

    const rawData = response.data;
    if (!rawData || typeof rawData !== 'string') {
      throw new Error('订阅内容为空或返回格式不正确');
    }

    const nodes = parseSubscriptionContent(rawData, yaml);
    if (!nodes || nodes.length === 0) {
      throw new Error('未能从订阅中识别出有效节点（请检查订阅链接或内容格式）');
    }

    // Preserve previously tested latency for matching nodes (same server + port + protocol)
    const existingNodes = db.getNodes({ subId });
    const existingMap = new Map();
    existingNodes.forEach(n => {
      const key = `${n.type}:${n.server}:${n.port}:${n.uuid || n.password || ''}`;
      existingMap.set(key, n);
    });

    const mergedNodes = nodes.map(n => {
      const key = `${n.type}:${n.server}:${n.port}:${n.uuid || n.password || ''}`;
      const old = existingMap.get(key);
      if (old) {
        return {
          ...n,
          delay: old.delay || 0,
          status: old.status || 'untested',
          inCombinedSub: Boolean(old.inCombinedSub),
          lastTestTime: old.lastTestTime || null
        };
      }
      return {
        ...n,
        inCombinedSub: false
      };
    });

    db.setSubscriptionNodes(subId, mergedNodes);
    const updatedSub = db.updateSubscription(subId, {
      nodeCount: mergedNodes.length,
      lastStatus: 'updating',
      lastMessage: `已获取 ${mergedNodes.length} 个节点，正在自动测速...`
    });
    db.addLog('info', `订阅 [${sub.name}] 刷新成功，获取到 ${mergedNodes.length} 个节点，开始自动测速`, { subId, count: mergedNodes.length });
    broadcast('subscription_updated', { id: subId, sub: updatedSub });

    // 导入或刷新订阅后，自动测试节点延迟：成功则加入整合订阅，失败则不加入，并同步该条订阅状态
    setTimeout(async () => {
      try {
        const freshNodes = db.getNodes({ subId });
        if (!freshNodes || freshNodes.length === 0) return;
        const { aliveCount } = await testSubscriptionNodes(sub, freshNodes);
        const finalSub = db.updateSubscription(subId, {
          nodeCount: freshNodes.length,
          aliveCount,
          lastUpdate: new Date().toISOString(),
          lastStatus: 'success',
          lastMessage: `同步完成：共 ${freshNodes.length} 节点，${aliveCount} 个可用`
        });
        db.addLog('info', `订阅 [${sub.name}] 自动延迟测试完毕：${aliveCount} 个可用节点已自动纳入整合订阅`, { subId, aliveCount });
        broadcast('subscription_updated', { id: subId, sub: finalSub });

        if (options.auto) {
          autoDisableIfNoAliveNodes(sub, aliveCount, '自动刷新后');
        }
      } catch (e) {
        console.error('[Fetcher] Auto-test after refresh error:', e.message);
        const fallbackSub = db.updateSubscription(subId, {
          lastStatus: 'success',
          lastMessage: `已解析 ${mergedNodes.length} 个节点 (自动测速异常: ${e.message})`
        });
        broadcast('subscription_updated', { id: subId, sub: fallbackSub });
      }
    }, 300);

    return {
      success: true,
      count: mergedNodes.length,
      message: `成功获取 ${mergedNodes.length} 个节点，正在后台自动测速`
    };

  } catch (err) {
    let errorMsg = err.response ? `HTTP ${err.response.status}: ${err.message}` : err.message;
    if (err.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
      errorMsg += '。证书域名与订阅地址不匹配；如确认订阅服务器可信，请在系统设置中开启「忽略 TLS 证书校验」后重试。';
    } else if (err.code === 'CERT_HAS_EXPIRED' || /certificate has expired/i.test(err.message || '')) {
      errorMsg += '。服务器证书已过期；确认服务器可信后，可在系统设置中开启「忽略 TLS 证书校验」后重试。';
    }
    const failedSub = db.updateSubscription(subId, {
      lastStatus: 'failed',
      lastMessage: errorMsg
    });
    broadcast('subscription_updated', { id: subId, sub: failedSub });
    db.addLog('error', `订阅 [${sub.name}] 刷新失败: ${errorMsg}`, { subId });
    throw new Error(errorMsg);
  }
}

async function fetchAllSubscriptions() {
  const subs = db.getSubscriptions().filter(s => s.enabled);
  const results = [];
  for (const s of subs) {
    try {
      const res = await fetchSubscription(s.id);
      results.push({ id: s.id, name: s.name, success: true, count: res.count });
    } catch (e) {
      results.push({ id: s.id, name: s.name, success: false, error: e.message });
    }
  }
  return results;
}

module.exports = {
  fetchSubscription,
  fetchAllSubscriptions,
  setBroadcast
};
