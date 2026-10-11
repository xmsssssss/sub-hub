<template>
  <div class="nodes-container">
    <!-- Header with Filters & Bulk Actions -->
    <div class="view-header">
      <div>
        <h2>节点列表与测速 ({{ filteredNodes.length }} / {{ totalNodesCount }})</h2>
        <p class="subtitle">实时监控节点延迟、支持失败自动重试、整合订阅状态维护、关键字检索及一键失效过滤</p>
      </div>

      <div class="header-actions">
        <button
          class="btn btn-primary"
          @click="startSpeedTest"
          :disabled="isTesting || filteredNodes.length === 0"
          title="手动测试当前筛选节点（超时时额外自动重试3次，失败则移出整合订阅）"
        >
          <Activity :size="16" :class="{ 'animate-spin': isTesting }" />
          <span>{{ isTesting ? `测速中 (${testProgress.current}/${testProgress.total})` : '测试当前筛选节点 (含3次重试)' }}</span>
        </button>

        <button class="btn btn-secondary" @click="deduplicateNodes">
          <Copy :size="16" />
          <span>节点去重</span>
        </button>

        <button
          v-if="selectedIds.length > 0"
          class="btn btn-secondary"
          @click="batchIncludeInCombined(true)"
          title="将选中节点纳入整合订阅"
        >
          <ShieldCheck :size="16" class="text-success" />
          <span>设为纳入整合 ({{ selectedIds.length }})</span>
        </button>

        <button
          v-if="selectedIds.length > 0"
          class="btn btn-secondary"
          @click="batchIncludeInCombined(false)"
          title="将选中节点移出整合订阅"
        >
          <ShieldAlert :size="16" class="text-warning" />
          <span>移出整合 ({{ selectedIds.length }})</span>
        </button>

        <button
          v-if="selectedIds.length > 0"
          class="btn btn-danger"
          @click="batchDeleteSelected"
        >
          <span>批量删除 ({{ selectedIds.length }})</span>
        </button>
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="toolbar glass">
      <div class="search-box">
        <Search :size="16" class="text-dim" />
        <input
          v-model="filters.keyword"
          type="text"
          placeholder="按名称、服务器 IP 或域名搜索..."
        />
      </div>

      <div class="filter-selects">
        <select v-model="filters.subId">
          <option value="">全部所属订阅</option>
          <option v-for="sub in subs" :key="sub.id" :value="sub.id">{{ sub.name }}</option>
        </select>

        <select v-model="filters.protocol">
          <option value="">全部协议类型</option>
          <option value="vmess">VMess</option>
          <option value="vless">VLESS</option>
          <option value="ss">Shadowsocks</option>
          <option value="ssr">ShadowsocksR</option>
          <option value="trojan">Trojan</option>
          <option value="hysteria2">Hysteria 2</option>
          <option value="hysteria">Hysteria 1</option>
          <option value="tuic">TUIC</option>
          <option value="socks5">SOCKS5 / HTTP</option>
        </select>

        <select v-model="filters.status">
          <option value="">全部测速状态</option>
          <option value="alive">仅可用节点</option>
          <option value="failed">仅失效节点</option>
          <option value="untested">未测速节点</option>
        </select>

        <select v-model="filters.inCombinedSub">
          <option value="">全部整合状态</option>
          <option value="true">处于整合订阅中</option>
          <option value="false">未在整合订阅中</option>
        </select>

        <button class="btn btn-secondary btn-sm" @click="fetchNodes">
          <RefreshCw :size="14" />
          <span>刷新</span>
        </button>
      </div>
    </div>

    <!-- Nodes Table Card -->
    <div class="card glass no-padding table-card">
      <div v-if="loading" class="loading-state">
        <Loader2 class="animate-spin" :size="32" />
        <span>正在加载节点...</span>
      </div>

      <div v-else-if="filteredNodes.length === 0" class="empty-state">
        <Radio :size="40" class="text-dim" />
        <p>没有匹配的节点数据</p>
      </div>

      <div v-else class="table-responsive">
        <table class="nodes-table">
          <thead>
            <tr>
              <th width="40">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                />
              </th>
              <th>节点名称</th>
              <th width="100">协议类型</th>
              <th>服务器地址 : 端口</th>
              <th width="110">网络 / 伪装</th>
              <th width="130">整合订阅状态</th>
              <th width="120">延迟 (Latency)</th>
              <th width="100">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="node in pagedNodes"
              :key="node.id"
              :class="{ 'row-selected': selectedIds.includes(node.id) }"
            >
              <td>
                <input
                  type="checkbox"
                  :value="node.id"
                  v-model="selectedIds"
                />
              </td>

              <td class="node-name-cell">
                <div class="node-name-wrap" :title="node.name">
                  <span class="node-name">{{ node.name }}</span>
                  <span class="sub-source" v-if="getSubName(node.subId)">
                    {{ getSubName(node.subId) }}
                  </span>
                </div>
              </td>

              <td>
                <span :class="['badge', 'badge-' + (node.type || '').toLowerCase()]">
                  {{ node.type }}
                </span>
              </td>

              <td class="node-server-cell">
                <span class="server-host">{{ node.server }}</span>
                <span class="server-port">:{{ node.port }}</span>
              </td>

              <td class="node-net-cell">
                <span class="net-tag">{{ node.network || 'tcp' }}</span>
                <span v-if="node.tls" class="tls-tag">TLS</span>
              </td>

              <!-- 处于整合订阅中状态 -->
              <td>
                <button
                  :class="['combined-toggle-pill', node.inCombinedSub ? 'in-combined' : 'out-combined']"
                  @click="toggleNodeCombined(node)"
                  :title="node.inCombinedSub ? '点击将此节点移出整合订阅' : '点击将此节点加入整合订阅'"
                >
                  <ShieldCheck v-if="node.inCombinedSub" :size="13" />
                  <ShieldAlert v-else :size="13" />
                  <span>{{ node.inCombinedSub ? '整合中' : '未整合' }}</span>
                </button>
              </td>

              <td>
                <div class="delay-wrapper">
                  <span
                    v-if="node.delay && node.delay > 0"
                    :class="getDelayClass(node.delay)"
                  >
                    {{ node.delay }} ms
                  </span>
                  <span v-else-if="node.delay === -1 || node.status === 'failed'" class="delay-failed">
                    超时 / 失败
                  </span>
                  <span v-else class="delay-untested">未测速</span>
                </div>
              </td>

              <td>
                <div class="table-actions">
                  <button
                    class="action-btn"
                    title="单独测速 (超时自动重试3次)"
                    @click="testSingleNode(node)"
                    :disabled="testingNodeIds.has(node.id)"
                  >
                    <RefreshCw v-if="testingNodeIds.has(node.id)" :size="14" class="animate-spin text-primary" />
                    <Zap v-else :size="14" />
                  </button>
                  <button class="action-btn" title="编辑节点" @click="openEditNode(node)">
                    <Edit3 :size="14" />
                  </button>
                  <button class="action-btn btn-del" title="删除节点" @click="deleteNode(node)">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination-footer" v-if="filteredNodes.length > pageSize">
        <span class="page-info">
          显示 {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, filteredNodes.length) }} 项，共 {{ filteredNodes.length }} 项
        </span>
        <div class="page-buttons">
          <button
            class="btn btn-secondary btn-sm"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            上一页
          </button>
          <span class="current-page-num">{{ currentPage }} / {{ totalPages }}</span>
          <button
            class="btn btn-secondary btn-sm"
            :disabled="currentPage >= totalPages"
            @click="currentPage++"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Node Modal -->
    <div v-if="showEditModal" class="modal-backdrop" @click.self="showEditModal = false">
      <div class="modal-card glass">
        <div class="modal-header">
          <h3>编辑节点参数</h3>
          <button class="modal-close" @click="showEditModal = false">×</button>
        </div>

        <form @submit.prevent="submitEditNode" class="modal-body">
          <div class="form-group">
            <label>节点名称 (备注)</label>
            <input v-model="editForm.name" type="text" required />
          </div>

          <div class="form-row">
            <div class="form-group col-8">
              <label>服务器地址 (IP / 域名)</label>
              <input v-model="editForm.server" type="text" required />
            </div>
            <div class="form-group col-4">
              <label>端口</label>
              <input v-model.number="editForm.port" type="number" required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-6">
              <label>协议类型</label>
              <input :value="editForm.type" disabled />
            </div>
            <div class="form-group col-6" v-if="editForm.cipher">
              <label>加密方式</label>
              <input v-model="editForm.cipher" type="text" />
            </div>
          </div>

          <div class="form-group" v-if="editForm.uuid">
            <label>UUID / 密码</label>
            <input v-model="editForm.uuid" type="text" />
          </div>

          <div class="form-group" v-if="editForm.password">
            <label>密码</label>
            <input v-model="editForm.password" type="text" />
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="editForm.inCombinedSub" />
              <span>纳入整合订阅 (导出 Clash / Base64 时包含此节点)</span>
            </label>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showEditModal = false">取消</button>
            <button type="submit" class="btn btn-primary">保存修改</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import {
  Activity,
  Trash2,
  Copy,
  Search,
  RefreshCw,
  Zap,
  Edit3,
  Radio,
  Loader2,
  ShieldCheck,
  ShieldAlert
} from 'lucide-vue-next';
import api from '../api';

const props = defineProps({
  initialSubId: { type: String, default: '' },
  isTesting: { type: Boolean, default: false },
  testProgress: { type: Object, default: () => ({ current: 0, total: 0 }) }
});

const emit = defineEmits(['start-test', 'data-changed']);

const nodes = ref([]);
const subs = ref([]);
const loading = ref(false);
const selectedIds = ref([]);
const testingNodeIds = ref(new Set());

const currentPage = ref(1);
const pageSize = ref(30);

const filters = reactive({
  keyword: '',
  subId: props.initialSubId || '',
  protocol: '',
  status: '',
  inCombinedSub: ''
});

// Edit Node Modal State
const showEditModal = ref(false);
const editForm = reactive({});

watch(() => props.initialSubId, (newVal) => {
  if (newVal !== undefined) {
    filters.subId = newVal;
  }
});

const fetchSubs = async () => {
  try {
    subs.value = await api.get('/subscriptions');
  } catch (e) {}
};

const fetchNodes = async () => {
  loading.value = true;
  try {
    nodes.value = await api.get('/nodes');
    testingNodeIds.value.clear();
  } catch (e) {
  } finally {
    loading.value = false;
  }
};

const getSubName = (subId) => {
  if (subId === 'manual') return '手动导入';
  const s = subs.value.find(sub => sub.id === subId);
  return s ? s.name : '';
};

const totalNodesCount = computed(() => nodes.value.length);
const failedNodesCount = computed(() => nodes.value.filter(n => n.delay === -1 || n.status === 'failed').length);

const filteredNodes = computed(() => {
  let list = nodes.value;
  if (filters.subId) {
    list = list.filter(n => n.subId === filters.subId);
  }
  if (filters.protocol) {
    list = list.filter(n => n.type === filters.protocol);
  }
  if (filters.status) {
    if (filters.status === 'alive') list = list.filter(n => n.delay && n.delay > 0);
    else if (filters.status === 'failed') list = list.filter(n => n.delay === -1 || n.status === 'failed');
    else if (filters.status === 'untested') list = list.filter(n => !n.delay || n.delay === 0);
  }
  if (filters.inCombinedSub !== '') {
    const wantIn = filters.inCombinedSub === 'true';
    list = list.filter(n => Boolean(n.inCombinedSub) === wantIn);
  }
  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase();
    list = list.filter(n =>
      (n.name && n.name.toLowerCase().includes(kw)) ||
      (n.server && n.server.toLowerCase().includes(kw))
    );
  }
  return list;
});

const totalPages = computed(() => Math.ceil(filteredNodes.value.length / pageSize.value) || 1);

const pagedNodes = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredNodes.value.slice(start, start + pageSize.value);
});

const isAllSelected = computed(() => {
  if (pagedNodes.value.length === 0) return false;
  return pagedNodes.value.every(n => selectedIds.value.includes(n.id));
});

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    const pagedIdSet = new Set(pagedNodes.value.map(n => n.id));
    selectedIds.value = selectedIds.value.filter(id => !pagedIdSet.has(id));
  } else {
    const currentSet = new Set(selectedIds.value);
    pagedNodes.value.forEach(n => currentSet.add(n.id));
    selectedIds.value = Array.from(currentSet);
  }
};

const getDelayClass = (delay) => {
  if (delay <= 300) return 'delay-fast';
  if (delay <= 800) return 'delay-medium';
  return 'delay-slow';
};

const startSpeedTest = () => {
  const targetIds = filteredNodes.value.map(n => n.id);
  emit('start-test', targetIds);
};

const testSingleNode = (node) => {
  testingNodeIds.value.add(node.id);
  emit('start-test', [node.id]);
};

const toggleNodeCombined = async (node) => {
  const nextVal = !node.inCombinedSub;
  try {
    await api.put(`/nodes/${node.id}`, { inCombinedSub: nextVal });
    node.inCombinedSub = nextVal;
    emit('data-changed');
  } catch (e) {
    alert('修改状态失败: ' + e.message);
  }
};

const batchIncludeInCombined = async (status) => {
  try {
    await api.post('/nodes/batch-combined-status', {
      ids: selectedIds.value,
      inCombinedSub: status
    });
    await fetchNodes();
    emit('data-changed');
    alert(`已更新 ${selectedIds.value.length} 个节点的整合订阅状态`);
  } catch (e) {
    alert('批量设置失败: ' + e.message);
  }
};

const filterFailedNodes = async () => {
  if (!confirm(`确定要一键过滤并删除所有检测失败的 ${failedNodesCount.value} 个节点吗？`)) return;
  try {
    const res = await api.post('/nodes/filter-failed');
    alert(`已成功清除 ${res.removedCount} 个失败节点`);
    await fetchNodes();
    emit('data-changed');
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
};

const deduplicateNodes = async () => {
  try {
    const res = await api.post('/nodes/deduplicate');
    alert(`去重完成：移除了 ${res.removedCount} 个重复节点`);
    await fetchNodes();
    emit('data-changed');
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
};

const batchDeleteSelected = async () => {
  if (!confirm(`确定删除选中的 ${selectedIds.value.length} 个节点吗？`)) return;
  try {
    await api.post('/nodes/batch-delete', { ids: selectedIds.value });
    selectedIds.value = [];
    await fetchNodes();
    emit('data-changed');
  } catch (e) {
    alert('删除失败: ' + e.message);
  }
};

const deleteNode = async (node) => {
  if (!confirm(`确定删除节点「${node.name}」吗？`)) return;
  try {
    await api.delete(`/nodes/${node.id}`);
    await fetchNodes();
    emit('data-changed');
  } catch (e) {
    alert('删除失败: ' + e.message);
  }
};

const openEditNode = (node) => {
  Object.assign(editForm, JSON.parse(JSON.stringify(node)));
  showEditModal.value = true;
};

const submitEditNode = async () => {
  try {
    await api.put(`/nodes/${editForm.id}`, editForm);
    showEditModal.value = false;
    await fetchNodes();
    emit('data-changed');
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
};

onMounted(() => {
  fetchSubs();
  fetchNodes();
});

defineExpose({
  fetchNodes
});
</script>

<style scoped>
.nodes-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.view-header h2 {
  font-size: 20px;
  font-weight: 700;
}

.subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar {
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 240px;
}

.search-box input {
  width: 100%;
}

.filter-selects {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-selects select {
  width: auto;
  min-width: 135px;
  padding: 8px 12px;
}

.table-card {
  overflow: hidden;
}

.table-responsive {
  overflow-x: auto;
}

.nodes-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.nodes-table th {
  background: var(--bg-table-header);
  padding: 12px 16px;
  color: var(--text-muted);
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.nodes-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.nodes-table tr:hover {
  background: var(--bg-table-hover);
}

.row-selected {
  background: rgba(79, 70, 229, 0.08) !important;
}

.node-name-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 320px;
}

.node-name {
  font-weight: 500;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-source {
  font-size: 11px;
  color: var(--text-dim);
}

.node-server-cell {
  font-family: var(--font-mono);
  font-size: 12px;
  white-space: nowrap;
}

.server-host {
  color: #2563eb;
}
[data-theme="dark"] .server-host {
  color: #93c5fd;
}

.server-port {
  color: var(--text-muted);
}
[data-theme="dark"] .server-port {
  color: #cbd5e1;
}

.node-net-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.net-tag {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
}

.tls-tag {
  font-size: 10px;
  padding: 1px 4px;
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
  border-radius: 4px;
  font-weight: 600;
}
[data-theme="dark"] .tls-tag {
  color: #34d399;
}

/* Combined status toggle pill */
.combined-toggle-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
  white-space: nowrap;
}

.in-combined {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  border-color: rgba(16, 185, 129, 0.3);
}
.in-combined:hover {
  background: rgba(16, 185, 129, 0.22);
}

.out-combined {
  background: rgba(156, 163, 175, 0.15);
  color: var(--text-dim);
  border-color: var(--border-subtle);
}
.out-combined:hover {
  background: rgba(156, 163, 175, 0.25);
  color: var(--text-main);
}

.delay-wrapper {
  font-family: var(--font-mono);
  font-size: 12px;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-card-subtle);
  color: var(--text-main);
}

.btn-del:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}

.pagination-footer {
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border-color);
  font-size: 13px;
  color: var(--text-muted);
}

.page-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-page-num {
  font-family: var(--font-mono);
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--text-muted);
}

/* Modal styles */
.modal-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--modal-backdrop);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-card {
  width: 100%;
  max-width: 500px;
  padding: 24px;
  animation: modalIn 0.25s ease-out;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal-header h3 {
  font-size: 17px;
  font-weight: 600;
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12.5px;
  color: var(--text-muted);
  font-weight: 500;
}

.form-row {
  display: flex;
  gap: 12px;
}

.col-4 { flex: 4; }
.col-6 { flex: 6; }
.col-8 { flex: 8; }

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px !important;
  color: var(--text-main) !important;
}

.checkbox-label input {
  width: auto;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}

@media (max-width: 768px) {
  .toolbar {
    padding: 12px 14px;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .search-box {
    min-width: 100%;
  }

  .filter-selects {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    width: 100%;
  }

  .filter-selects select {
    min-width: 0;
    width: 100%;
  }

  .batch-banner {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
  }

  .batch-actions {
    width: 100%;
    flex-wrap: wrap;
    gap: 6px;
  }

  .batch-actions .btn {
    flex: 1;
    justify-content: center;
    font-size: 11.5px;
    padding: 6px 8px;
  }

  .form-row {
    flex-direction: column;
    gap: 10px;
  }

  .col-4, .col-6, .col-8 {
    flex: 1;
    width: 100%;
  }
}
</style>
