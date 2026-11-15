# SUB · 机场订阅聚合与全协议节点管理系统

基于 **Mihomo（Clash.Meta）原生内核** 的一站式订阅聚合与节点管理平台：全协议解析、真并发延迟测速、Loyalsoldier 规则分流整合订阅、FOFA 订阅发现、内核在线更新、定时刷新与完整配置备份。

> 前端 Vue 3 + Vite，后端 Node.js + Express + WebSocket，数据以 JSON 本地持久化，单进程即可部署。

---

## ✨ 核心特性

### 1. 全协议识别与解析
- 支持协议：`VMess`、`VLESS`（Reality / Vision flow / VLESS Encryption）、`Shadowsocks`、`ShadowsocksR`、`Trojan`、`Hysteria 1/2`、`TUIC`、`AnyTLS`、`WireGuard`、`SSH`、`Snell`、`Mieru`、`SOCKS5`、`HTTP`。
- 支持订阅格式：Clash / Mihomo YAML、标准 Base64、多行 URI 混合文本。
- 支持直接粘贴原始节点链接导入，自动识别并归组。

### 2. 机场订阅管理
- **按订阅 IP 去重**：同一机场订阅（解析到相同 IP）自动跳过重复添加。
- **自动编号**：未填写名称时自动分配 `sub-1`、`sub-2`…；FOFA 自动导入同样沿用该编号体系。
- **批量录入**：一次粘贴多行订阅链接，逐条校验并按 IP 去重。
- **网格 / 列表双视图**、多维度排序（时间、名称、节点数），选择自动记忆。
- **刷新容错**：刷新失败（HTTP 非 200、请求超时、DNS/网络异常、TLS 证书问题）时，自动改为测试该订阅**上一次获取的已有节点**，并通过弹窗说明原因。
- **自动关闭空订阅**：定时自动刷新后若可用节点为 0，自动关闭该订阅，避免无效请求。
- **编辑弹窗内一键测速**：直接查看该订阅节点列表与可用/失败/未测统计，并一键并发测速。
- **关闭订阅即剔除统计**：禁用的订阅不计入仪表盘整体节点数。

### 3. Mihomo 原生并发测速
- 调用本机 Mihomo 内核，真实并发测试节点可用性与延迟（ms）。
- **导入即测速**：添加订阅、粘贴导入后自动在后台测速，可用节点自动纳入整合订阅。
- **失败自动重试**：手动测速失败自动重试 3 次；自动测速重试 2 次，减少冷启动误判。
- **多任务并发**：支持同时对多个节点/订阅发起测速，右下角气泡堆叠展示，完成后 5 秒自动关闭。
- **局部更新**：测速结果就地更新对应节点，不刷新整页、不重置分页与筛选。
- **协议兼容兜底**：订阅中存在当前内核不支持的协议时自动跳过该部分节点并继续测速，其余节点不受影响。
- 节点列表默认展示「处于整合订阅中」的节点，可随时切换筛选。

### 4. 整合订阅生成
- 汇聚多机场节点，一键生成单一订阅。
- 内置 [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules) 分流规则（广告拦截、Apple、Google、Telegram、国内外分流等）。
- 自动生成 `PROXY`、`自动选择 (url-test)`、`故障转移 (fallback)`、`负载均衡 (load-balance)` 策略组。
- 支持按订阅来源、可用性、延迟上限、协议、关键词包含/排除筛选节点。
- 导出格式：
  - **Clash / Mihomo YAML**：`/sub/<token>?format=clash`
  - **Base64 通用节点池**：`/sub/<token>?format=base64`

### 5. FOFA 订阅发现
- **API 查询模式**：填写 FOFA 邮箱与 API Key，按查询语句批量检索（消耗 F 点）。
- **手动候选模式**：粘贴 FOFA 网页结果中的 host / IP:端口，不调用 API、不消耗 F 点。
- 候选地址自动做公网校验、并发探测、Mihomo 实测与节点数筛选。
- 可设置每页结果、页数、最少/最多节点数与可用节点数、并发数、最多导入数。
- 验证通过后可自动导入为机场订阅，名称统一为 `sub-N FOFA IP:端口`。

### 6. Mihomo 内核管理
- 系统配置页查看当前内核版本与路径。
- 一键检查并安装 GitHub 最新稳定版内核，内置多个加速镜像源。
- 测速前自动校验执行权限，兼容 Docker / Linux / Windows。

### 7. 备份与恢复
- 一键导出全部订阅、节点、整合订阅策略与系统设置（JSON）。
- 支持**智能合并**与**完全覆盖**两种导入模式。

### 8. 定时刷新
- 内置 Cron 调度（默认每 6 小时），可自定义表达式。
- 刷新后自动测速并同步订阅状态；异常自动回退测速与自动关闭空订阅。

### 9. 界面与安全
- 明亮 / 暗色双主题，毛玻璃现代 UI，全站移动端响应式适配（抽屉导航、触摸优化弹窗）。
- JWT 认证 + Bcrypt 密码加密，支持在线修改管理员密码。
- 订阅链接一键复制（兼容 HTTP 非安全上下文环境）。

---

## 🚀 部署方式

### 方式 1：Windows 本地运行

1. 安装 [Node.js](https://nodejs.org/)（v18+）。
2. 双击 `start.bat`（自动安装依赖、下载 `mihomo.exe`、构建前端并启动）。
3. 访问 `http://127.0.0.1:3580`。

或手动执行：

```powershell
npm install
npm run build
node backend/server.js
```

### 方式 2：Linux 服务器

```bash
chmod +x start.sh
./start.sh
```

`start.sh` 会自动检测并下载 Linux 版 Mihomo 内核、安装依赖、构建前端。后台常驻推荐使用 pm2：

```bash
npm install -g pm2
pm2 start backend/server.js --name "sub-aggregator"
```

### 方式 3：Docker / Docker Compose

```bash
docker compose up -d --build
```

- 容器内置 Mihomo 内核与 Node 运行环境。
- 数据通过 `./data` 目录持久化。
- 默认端口 `3580`，时区 `Asia/Shanghai`（可在 `docker-compose.yml` 中调整）。

### 开发模式

```bash
npm install
npm run dev        # 同时启动后端 (3580) 与 Vite 前端 (5173)
```

---

## 🔑 默认登录凭据

- 后台地址：`http://127.0.0.1:3580`
- 用户名：`admin`
- 密码：`admin123456`

> 首次登录后请尽快在「系统配置」中修改密码。

---

## 📖 快速上手

1. **添加订阅**：进入「机场订阅管理」→「添加机场订阅」，粘贴订阅链接（支持多行批量）。
2. **自动测速**：添加后自动拉取并测速，可用节点自动纳入整合订阅；也可在编辑弹窗中一键测速。
3. **生成整合订阅**：进入「整合订阅生成」，按需设置筛选条件，复制 Clash 或 Base64 订阅链接导入客户端。
4. **配置定时刷新**：在「系统配置」中启用自动刷新并设置 Cron 表达式。
5. **FOFA 发现**（可选）：在「FOFA 订阅发现」中配置凭据或手动候选地址，验证通过后自动导入。

---

## 📁 目录结构

```
sub-hub/
├── backend/
│   ├── server.js          # Express API、WebSocket 与订阅分发
│   ├── parser.js          # 全协议解析器（URI / Base64 / YAML）
│   ├── fetcher.js         # 订阅抓取、容错回退与自动测速
│   ├── tester.js          # Mihomo 内核并发测速与多任务管理
│   ├── generator.js       # Loyalsoldier 规则与订阅配置生成
│   ├── scheduler.js       # 定时自动刷新任务
│   ├── coreManager.js     # Mihomo 内核版本检测与在线更新
│   ├── fofaManager.js     # FOFA 检索、候选验证与自动导入
│   └── db.js              # JSON 数据持久化引擎
├── src/
│   ├── views/             # 仪表盘 / 订阅 / 节点 / 整合订阅 / FOFA / 系统配置
│   ├── components/        # 登录弹窗等通用组件
│   ├── utils/clipboard.js # 兼容性剪贴板封装
│   ├── api.js             # Axios 封装与拦截器
│   ├── App.vue            # 布局、导航与测速气泡堆栈
│   └── assets/style.css   # 全局样式与双主题变量
├── data/                  # 数据持久化（database.json / 备份 / 临时测速配置）
├── dist/                  # 前端构建产物（由 Node 直接托管）
├── Dockerfile
├── docker-compose.yml
├── start.bat              # Windows 一键启动
├── start.sh               # Linux 一键启动
└── package.json
```

---

## ❓ 常见问题

**测速提示「无法启动 Mihomo 内核程序」**
- 确认项目根目录、`backend/` 或 `/usr/local/bin` 存在可执行的 `mihomo` / `mihomo.exe`。
- Docker 部署请确认容器内 `/usr/local/bin/mihomo` 存在。
- 可在「系统配置 → Mihomo 内核」中一键安装/更新。

**部分节点（如 AnyTLS）测速被跳过**
- 说明当前内核版本不支持该协议。请升级内核到最新版后重试；其余节点仍会正常测速。

**订阅刷新提示证书错误**
- 服务器证书过期或域名不匹配。确认可信后，在「系统配置」中开启「忽略 TLS 证书校验」。

**FOFA 提示 F 点余额不足**
- API 模式会消耗 F 点，可充值/开通额度，或改用「手动候选」模式（不消耗 F 点）。

**HTTP 环境下复制链接失败**
- 系统已内置 `execCommand` 回退方案；若浏览器仍拦截，请使用 `localhost` 或为站点启用 HTTPS。

---

## ⚠️ 说明

本项目仅用于管理你**合法拥有或获授权**的订阅与节点，请遵守当地法律法规及服务提供商条款。FOFA 相关功能需自行确保账号与使用行为符合平台规范。
