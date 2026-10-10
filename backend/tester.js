const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const yaml = require('yaml');

class MihomoTester {
  constructor() {
    this.process = null;
    this.configDir = path.join(__dirname, '..', 'data', 'temp_mihomo');
    this.configFile = path.join(this.configDir, 'config.yaml');
    this.apiPort = 29090;
    this.mixedPort = 27890;
    this.secret = 'mihomo_sub_test_' + Math.random().toString(36).substring(2, 8);
    this.isTesting = false;
    this.mihomoBinary = this.findBinary();
  }

  findBinary() {
    const isWin = process.platform === 'win32';
    const binName = isWin ? 'mihomo.exe' : 'mihomo';

    // 1. Look in root directory of project
    const rootPath = path.join(__dirname, '..', binName);
    if (fs.existsSync(rootPath)) return rootPath;

    // 2. Look in backend directory
    const backendPath = path.join(__dirname, binName);
    if (fs.existsSync(backendPath)) return backendPath;

    // 3. Look in /app directory (Docker container root)
    const appPath = path.join('/app', binName);
    if (fs.existsSync(appPath)) return appPath;

    // 4. Look in /usr/local/bin or system standard directories
    const usrLocalPath = path.join('/usr/local/bin', binName);
    if (fs.existsSync(usrLocalPath)) return usrLocalPath;

    // 5. Fallback to system PATH
    return binName;
  }

  setBinary(binPath) {
    if (binPath && fs.existsSync(binPath)) {
      this.mihomoBinary = binPath;
      return true;
    }
    return false;
  }

  cleanProxyForMihomo(node) {
    // Clone node and filter out UI-specific fields before feeding into Mihomo yaml
    const p = { ...node };
    delete p.id;
    delete p.subId;
    delete p.delay;
    delete p.status;
    delete p.lastTestTime;
    delete p.createTime;
    delete p.checked;
    delete p.inCombinedSub;
    delete p.retriesUsed;

    // Ensure port is int
    if (p.port) p.port = parseInt(p.port, 10);
    // Ensure alterId is int if vmess
    if (p.alterId !== undefined) p.alterId = parseInt(p.alterId, 10);

    return p;
  }

  ensureTempDir() {
    // 优先使用 /tmp/temp_mihomo 或系统临时目录，避免 Docker volume 目录由于宿主机挂载文件权限 umask 导致不可执行或写锁冲突
    if (process.platform !== 'win32') {
      this.configDir = '/tmp/sub_temp_mihomo';
      this.configFile = path.join(this.configDir, 'config.yaml');
    }
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  async stopMihomo() {
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
        await new Promise(r => setTimeout(r, 400));
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      } catch (e) {}
      this.process = null;
    }
  }

  async startMihomoWithNodes(nodes) {
    await this.stopMihomo();
    this.ensureTempDir();

    const cleanProxies = nodes.map(n => this.cleanProxyForMihomo(n));

    // Mihomo configuration
    const configData = {
      'mixed-port': 0, // 设为 0 关闭本地代理端口监听，测速仅需 external-controller RESTful API，避免端口冲突或权限限制
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'warning',
      'external-controller': `127.0.0.1:${this.apiPort}`,
      secret: this.secret,
      proxies: cleanProxies
    };

    fs.writeFileSync(this.configFile, yaml.stringify(configData), 'utf8');

    return new Promise((resolve, reject) => {
      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          resolve(false);
        }
      }, 7000);

      try {
        this.process = spawn(this.mihomoBinary, ['-d', this.configDir, '-f', this.configFile]);

        this.process.stdout.on('data', d => {
          const str = d.toString();
          if (str.includes('RESTful API listening at') || str.includes('Initial configuration complete')) {
            if (!started) {
              started = true;
              clearTimeout(timeout);
              resolve(true);
            }
          }
        });

        this.process.stderr.on('data', d => {
          const str = d.toString();
          console.error('[Mihomo stderr]:', str);
          if (str.includes('RESTful API listening at') || str.includes('Initial configuration complete')) {
            if (!started) {
              started = true;
              clearTimeout(timeout);
              resolve(true);
            }
          }
        });

        this.process.on('error', err => {
          console.error('[Mihomo] Process spawn error:', err.message);
          if (!started) {
            started = true;
            clearTimeout(timeout);
            resolve(false);
          }
        });

        this.process.on('exit', (code, signal) => {
          console.warn(`[Mihomo] Process exited with code ${code}, signal ${signal}`);
          this.process = null;
          if (!started) {
            started = true;
            clearTimeout(timeout);
            resolve(false);
          }
        });

        // Also polling health check
        const interval = setInterval(async () => {
          if (started) {
            clearInterval(interval);
            return;
          }
          const ok = await this.pingApi();
          if (ok) {
            started = true;
            clearInterval(interval);
            clearTimeout(timeout);
            resolve(true);
          }
        }, 300);

      } catch (err) {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  pingApi() {
    return new Promise(resolve => {
      const req = http.request(`http://127.0.0.1:${this.apiPort}/version`, {
        headers: { 'Authorization': `Bearer ${this.secret}` },
        timeout: 1000
      }, res => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }

  testSingleProxyDelay(proxyName, testUrl = 'http://www.gstatic.com/generate_204', timeout = 5000) {
    return new Promise(resolve => {
      const encodedName = encodeURIComponent(proxyName);
      const url = `http://127.0.0.1:${this.apiPort}/proxies/${encodedName}/delay?url=${encodeURIComponent(testUrl)}&timeout=${timeout}`;

      const req = http.request(url, {
        headers: { 'Authorization': `Bearer ${this.secret}` },
        timeout: timeout + 1500
      }, res => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(body);
              if (typeof data.delay === 'number') {
                return resolve(data.delay);
              }
            } catch (e) {}
          }
          resolve(-1); // failed or timeout
        });
      });

      req.on('error', () => resolve(-1));
      req.on('timeout', () => {
        req.destroy();
        resolve(-1);
      });
      req.end();
    });
  }

  /**
   * Test single proxy with optional automatic retries on failure
   */
  async testSingleProxyWithRetry(proxyName, testUrl = 'http://www.gstatic.com/generate_204', timeout = 5000, maxRetries = 0, onRetry = null) {
    let delay = await this.testSingleProxyDelay(proxyName, testUrl, timeout);
    if (delay > 0) {
      return { delay, retriesUsed: 0 };
    }

    // Failed on initial try, run extra retries if configured
    for (let r = 1; r <= maxRetries; r++) {
      if (onRetry) onRetry(proxyName, r, maxRetries);
      // Brief pause between retries
      await new Promise(res => setTimeout(res, 250));
      delay = await this.testSingleProxyDelay(proxyName, testUrl, timeout);
      if (delay > 0) {
        return { delay, retriesUsed: r };
      }
    }

    return { delay: -1, retriesUsed: maxRetries };
  }

  /**
   * Run speed / delay test in batches with concurrency limit
   */
  async testNodes(nodes, { testUrl = 'http://www.gstatic.com/generate_204', timeout = 5000, concurrency = 10, maxRetries = 0, onProgress = null } = {}) {
    if (this.isTesting) {
      throw new Error('当前正在进行延迟测试，请稍候...');
    }
    if (!nodes || nodes.length === 0) {
      return [];
    }

    this.isTesting = true;
    try {
      // 1. Start mihomo instance loaded with these nodes
      const started = await this.startMihomoWithNodes(nodes);
      if (!started) {
        throw new Error(`无法启动 Mihomo 内核程序 (${this.mihomoBinary})，请检查内核文件是否存在并具有执行权限。`);
      }

      // 2. Queue for testing
      const results = [];
      let index = 0;
      const total = nodes.length;

      const worker = async () => {
        while (index < total) {
          const currentIndex = index++;
          const node = nodes[currentIndex];
          const testRes = await this.testSingleProxyWithRetry(
            node.name,
            testUrl,
            timeout,
            maxRetries,
            (name, currentRetry, totalRetries) => {
              if (onProgress) {
                onProgress({
                  current: results.length,
                  total,
                  retrying: { name, currentRetry, totalRetries }
                });
              }
            }
          );

          const delay = testRes.delay;
          const isAlive = delay > 0;

          const result = {
            id: node.id,
            name: node.name,
            delay: delay,
            status: isAlive ? 'alive' : 'failed',
            inCombinedSub: isAlive, // 成功的加入整合订阅，失败/重试超时的不加入
            retriesUsed: testRes.retriesUsed,
            lastTestTime: new Date().toISOString()
          };
          results.push(result);
          if (onProgress) {
            onProgress({
              current: results.length,
              total,
              latest: result
            });
          }
        }
      };

      const workers = [];
      const workerCount = Math.min(concurrency, total);
      for (let i = 0; i < workerCount; i++) {
        workers.push(worker());
      }

      await Promise.all(workers);
      return results;

    } finally {
      this.isTesting = false;
      await this.stopMihomo();
      // Clean temporary directory config
      try {
        if (fs.existsSync(this.configFile)) fs.unlinkSync(this.configFile);
      } catch (e) {}
    }
  }
}

module.exports = new MihomoTester();
