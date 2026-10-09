<template>
  <div class="dashboard-container">
    <!-- Stat Cards Grid -->
    <div class="stats-grid">
      <div class="stat-card glass">
        <div class="stat-icon icon-subs">
          <Radio :size="24" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalSubs || 0 }}</div>
          <div class="stat-label">机场订阅</div>
        </div>
      </div>

      <div class="stat-card glass">
        <div class="stat-icon icon-nodes">
          <Layers :size="24" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalNodes || 0 }}</div>
          <div class="stat-label">汇聚节点总数</div>
        </div>
      </div>

      <div class="stat-card glass">
        <div class="stat-icon icon-combined">
          <ShieldCheck :size="24" />
        </div>
        <div class="stat-content">
          <div class="stat-value text-primary">{{ stats.combinedNodes || 0 }}</div>
          <div class="stat-label">整合订阅中</div>
        </div>
      </div>

      <div class="stat-card glass">
        <div class="stat-icon icon-alive">
          <CheckCircle2 :size="24" />
        </div>
        <div class="stat-content">
          <div class="stat-value text-success">{{ stats.aliveNodes || 0 }}</div>
          <div class="stat-label">在线可用节点</div>
        </div>
      </div>

      <div class="stat-card glass">
        <div class="stat-icon icon-failed">
          <XCircle :size="24" />
        </div>
        <div class="stat-content">
          <div class="stat-value text-danger">{{ stats.failedNodes || 0 }}</div>
          <div class="stat-label">失败/失效节点</div>
        </div>
      </div>
    </div>

    <!-- Quick Action Banner -->
    <div class="action-banner glass">
      <div class="banner-info">
        <div class="banner-title">
          <Zap class="text-primary" :size="20" />
          <span>核心快捷操作</span>
        </div>
        <p class="banner-desc">基于 Mihomo 内核一键并发测速，快速筛选可用线路，保障网络顺畅。</p>
      </div>
      <div class="banner-buttons">
        <button class="btn btn-primary" @click="$emit('quick-test')" :disabled="isTesting || stats.totalNodes === 0">
          <Activity :size="16" :class="{ 'animate-spin': isTesting }" />
          <span>{{ isTesting ? '测速进行中...' : '一键测速所有节点' }}</span>
        </button>
        <button class="btn btn-secondary" @click="$emit('quick-refresh')" :disabled="refreshingAll">
          <RefreshCw :size="16" :class="{ 'animate-spin': refreshingAll }" />
          <span>更新所有订阅</span>
        </button>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="content-grid">
      <!-- Protocol Breakdown Card -->
      <div class="card glass">
        <div class="card-header">
          <div class="card-title">
            <Cpu :size="18" />
            <span>协议类型分布</span>
          </div>
          <span class="badge badge-vless">{{ Object.keys(stats.protocols || {}).length }} 种协议</span>
        </div>
        <div class="card-body">
          <div v-if="!stats.totalNodes" class="empty-state">
            暂无节点数据，请在「机场订阅」页面添加订阅
          </div>
          <div v-else class="protocol-list">
            <div v-for="(count, proto) in stats.protocols" :key="proto" class="protocol-item">
              <div class="proto-info">
                <span :class="['badge', 'badge-' + proto.toLowerCase()]">{{ proto }}</span>
                <span class="proto-count">{{ count }} 个 ({{ Math.round((count / stats.totalNodes) * 100) }}%)</span>
              </div>
              <div class="progress-bar-bg">
                <div
                  class="progress-bar-fill"
                  :style="{ width: ((count / stats.totalNodes) * 100) + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- System Logs & Status -->
      <div class="card glass">
        <div class="card-header">
          <div class="card-title">
            <Clock :size="18" />
            <span>最新活动日志</span>
          </div>
          <button class="btn btn-secondary btn-sm" @click="fetchLogs">
            <RefreshCw :size="14" />
          </button>
        </div>
        <div class="card-body logs-wrapper">
          <div v-if="logs.length === 0" class="empty-state">
            暂无活动日志
          </div>
          <div v-else class="logs-list">
            <div v-for="log in logs" :key="log.id" class="log-item">
              <span class="log-time">{{ formatTime(log.time) }}</span>
              <span :class="['log-badge', log.type === 'error' ? 'log-err' : 'log-info']">
                {{ log.type === 'error' ? 'ERR' : 'INFO' }}
              </span>
              <span class="log-msg">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import {
  Radio,
  Layers,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Zap,
  Activity,
  Trash2,
  RefreshCw,
  Cpu,
  Clock
} from 'lucide-vue-next';
import api from '../api';

const props = defineProps({
  stats: { type: Object, default: () => ({}) },
  isTesting: { type: Boolean, default: false },
  refreshingAll: { type: Boolean, default: false }
});

const emit = defineEmits(['quick-test', 'quick-filter', 'quick-refresh']);

const logs = ref([]);

const fetchLogs = async () => {
  try {
    logs.value = await api.get('/logs');
  } catch (e) {}
};

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

onMounted(() => {
  fetchLogs();
});
</script>

<style scoped>
.dashboard-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
}

.stat-card {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 18px;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-subs { background: rgba(99, 102, 241, 0.12); color: #4f46e5; }
.icon-nodes { background: rgba(59, 130, 246, 0.12); color: #2563eb; }
.icon-combined { background: rgba(14, 165, 233, 0.12); color: #0284c7; }
.icon-alive { background: rgba(16, 185, 129, 0.12); color: #059669; }
.icon-failed { background: rgba(239, 68, 68, 0.12); color: #dc2626; }

.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  font-family: var(--font-sans);
}

.stat-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.action-banner {
  padding: 22px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  background: linear-gradient(135deg, rgba(238, 242, 255, 0.85) 0%, rgba(255, 255, 255, 0.95) 100%);
  border: 1px solid rgba(199, 210, 254, 0.8);
}

[data-theme="dark"] .action-banner {
  background: linear-gradient(135deg, rgba(30, 27, 75, 0.5) 0%, rgba(17, 24, 39, 0.7) 100%);
  border: 1px solid rgba(99, 102, 241, 0.25);
}

.banner-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.banner-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.banner-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
}

.card {
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}

.protocol-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.protocol-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.proto-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.proto-count {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}

.progress-bar-bg {
  width: 100%;
  height: 6px;
  background: var(--bg-card-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4f46e5, #06b6d4);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.logs-wrapper {
  max-height: 320px;
  overflow-y: auto;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  padding: 8px 12px;
  background: var(--bg-card-subtle);
  border-radius: 6px;
  border-left: 3px solid var(--primary);
}

.log-time {
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.log-badge {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
}

.log-info { background: #dbeafe; color: #1d4ed8; }
.log-err { background: #fee2e2; color: #b91c1c; }

[data-theme="dark"] .log-info { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
[data-theme="dark"] .log-err { background: rgba(239, 68, 68, 0.2); color: #f87171; }

.log-msg {
  color: var(--text-main);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 30px;
  color: var(--text-dim);
  font-size: 13px;
}
</style>
