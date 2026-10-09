#!/usr/bin/env bash
# ========================================================
#   SUB - 机场订阅聚合与节点管理系统 (Linux 启动脚本)
# ========================================================

set -e

PORT=${PORT:-3580}

echo "========================================================"
echo "       SUB - 机场订阅聚合与节点管理系统 (Mihomo Core)     "
echo "========================================================"

if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装 Node.js (推荐 v18+)"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check Mihomo Linux binary
if [ ! -f "mihomo" ] && [ ! -f "backend/mihomo" ]; then
    echo "[提示] 检测到 Linux 环境下未放置 mihomo 二进制文件，正在尝试自动下载 Linux amd64 版本..."
    MIHOMO_URL="https://github.com/MetaCubeX/mihomo/releases/download/v1.19.0/mihomo-linux-amd64-v1.19.0.gz"
    if command -v curl &> /dev/null; then
        curl -sL "$MIHOMO_URL" -o mihomo.gz && gzip -d mihomo.gz && chmod +x mihomo || echo "[警告] 自动下载失败，如需测速请手动放置 mihomo 文件并给予执行权限"
    elif command -v wget &> /dev/null; then
        wget -q "$MIHOMO_URL" -O mihomo.gz && gzip -d mihomo.gz && chmod +x mihomo || echo "[警告] 自动下载失败，如需测速请手动放置 mihomo 文件并给予执行权限"
    fi
fi

if [ -f "mihomo" ]; then
    chmod +x mihomo
fi

if [ ! -d "node_modules" ]; then
    echo "[提示] 正在安装服务端依赖..."
    npm install
fi

if [ ! -d "dist" ]; then
    echo "[提示] 正在编译前端..."
    npm run build
fi

echo "[提示] 服务启动成功！"
echo "浏览器访问: http://0.0.0.0:$PORT"
echo "默认管理员: admin / admin123456"
echo "========================================================"

PORT=$PORT node backend/server.js
