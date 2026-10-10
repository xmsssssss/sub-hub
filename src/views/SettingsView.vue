<template>
  <div class="settings-container">
    <!-- Top Header -->
    <div class="view-header">
      <div>
        <h2>系统配置与维护</h2>
        <p class="subtitle">调整 Mihomo 内核测速参数、配置定时自动更新机制、全量数据导入导出及账号安全</p>
      </div>
      <button class="btn btn-primary" @click="saveSettings" :disabled="saving">
        <Save :size="16" />
        <span>{{ saving ? '保存中...' : '保存测速与定时配置' }}</span>
      </button>
    </div>

    <!-- 1. 全量配置文件备份与恢复 Banner (突出展示) -->
    <div class="card glass backup-banner-card">
      <div class="backup-banner-header">
        <div class="backup-header-left">
          <div class="backup-icon-box">
            <DatabaseBackup :size="24" class="text-primary" />
          </div>
          <div>
            <h3 class="backup-title">系统全量配置文件备份与恢复</h3>
            <p class="backup-desc">
              支持一键将当前系统的所有机场订阅、节点池数据、整合订阅策略（含 Loyalsoldier 规则）及系统设置导出为 JSON 备份，也可在任意设备上直接导入还原。
            </p>
          </div>
        </div>

        <div class="backup-actions">
          <button class="btn btn-primary" @click="exportConfigFile" :disabled="exporting">
            <Download :size="16" />
            <span>{{ exporting ? '生成备份中...' : '导出全部配置文件 (备份)' }}</span>
          </button>

          <label class="btn btn-secondary file-upload-btn">
            <Upload :size="16" />
            <span>导入备份配置文件...</span>
            <input type="file" accept=".json" @change="handleConfigFileSelected" style="display: none;" />
          </label>
        </div>
      </div>
    </div>

    <!-- 2. 二列网格配置项 -->
    <div class="settings-grid">
      <!-- Speedtest Settings -->
      <div class="card glass">
        <div class="card-header">
          <div class="card-title">
            <Zap class="text-primary" :size="18" />
            <span>Mihomo 延迟测速设置</span>
          </div>
        </div>

        <div class="card-body form-body">
          <div class="form-group">
            <label>测速目标 URL</label>
            <input v-model="settings.testUrl" type="text" placeholder="http://www.gstatic.com/generate_204" />
            <span class="hint">建议使用稳定且无重定向的探测地址（如 Google 204 或 Cloudflare trace）</span>
          </div>

          <div class="form-row">
            <div class="form-group col-6">
              <label>测速超时时间 (毫秒)</label>
              <input v-model.number="settings.testTimeout" type="number" placeholder="5000" />
            </div>
            <div class="form-group col-6">
              <label>并发测速协程数</label>
              <input v-model.number="settings.testConcurrency" type="number" placeholder="15" />
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="settings.autoTestAfterRefresh" />
              <span>订阅刷新后自动执行延迟测速</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Schedule & Automation -->
      <div class="card glass">
        <div class="card-header">
          <div class="card-title">
            <Clock class="text-primary" :size="18" />
            <span>定时刷新与自动化任务</span>
          </div>
        </div>

        <div class="card-body form-body">
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="settings.autoRefreshEnabled" />
              <span class="font-bold">开启定时自动刷新订阅</span>
            </label>
          </div>

          <div class="form-group" v-if="settings.autoRefreshEnabled">
            <label>Crontab 表达式</label>
            <input v-model="settings.autoRefreshInterval" type="text" placeholder="0 */6 * * *" />
            <span class="hint">默认每 6 小时刷新一次 (<code>0 */6 * * *</code>)，支持标准 Linux Cron 语法</span>
          </div>

          <div class="quick-cron-tags" v-if="settings.autoRefreshEnabled">
            <span class="cron-tag" @click="settings.autoRefreshInterval = '0 */2 * * *'">每 2 小时</span>
            <span class="cron-tag" @click="settings.autoRefreshInterval = '0 */6 * * *'">每 6 小时</span>
            <span class="cron-tag" @click="settings.autoRefreshInterval = '0 0,12 * * *'">每天两次</span>
            <span class="cron-tag" @click="settings.autoRefreshInterval = '0 4 * * *'">每天凌晨4点</span>
          </div>
        </div>
      </div>

      <!-- Account Security -->
      <div class="card glass full-width-card">
        <div class="card-header">
          <div class="card-title">
            <Lock class="text-primary" :size="18" />
            <span>管理员账号安全</span>
          </div>
        </div>

        <div class="card-body form-body">
          <form @submit.prevent="updatePassword">
            <div class="form-row">
              <div class="form-group col-4">
                <label>当前原密码</label>
                <input v-model="pwdForm.oldPassword" type="password" placeholder="请输入原密码" required />
              </div>
              <div class="form-group col-4">
                <label>设置新密码</label>
                <input v-model="pwdForm.newPassword" type="password" placeholder="最少 6 位" required minlength="6" />
              </div>
              <div class="form-group col-4">
                <label>确认新密码</label>
                <input v-model="pwdForm.confirmPassword" type="password" placeholder="重复新密码" required minlength="6" />
              </div>
            </div>

            <div style="margin-top: 14px;">
              <button type="submit" class="btn btn-secondary btn-sm" :disabled="pwdUpdating">
                <span>{{ pwdUpdating ? '修改中...' : '修改管理员密码' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Import Config Confirm Modal -->
    <div v-if="showImportModal" class="modal-backdrop" @click.self="showImportModal = false">
      <div class="modal-card glass">
        <div class="modal-header">
          <h3>导入全量系统配置文件</h3>
          <button class="modal-close" @click="showImportModal = false">×</button>
        </div>

        <div class="modal-body">
          <div class="import-preview-box" v-if="importPreview">
            <div class="preview-item">
              <span class="label">机场订阅数：</span>
              <span class="val">{{ (importPreview.subscriptions || []).length }} 个</span>
            </div>
            <div class="preview-item">
              <span class="label">节点池数量：</span>
              <span class="val">{{ (importPreview.nodes || []).length }} 个</span>
            </div>
            <div class="preview-item">
              <span class="label">整合订阅配置：</span>
              <span class="val">{{ (importPreview.profiles || []).length }} 个</span>
            </div>
            <div class="preview-item" v-if="importPreview.exportTime">
              <span class="label">备份导出时间：</span>
              <span class="val">{{ new Date(importPreview.exportTime).toLocaleString() }}</span>
            </div>
          </div>

          <div class="form-group">
            <label>选择导入方式</label>
            <div class="import-mode-options">
              <label class="radio-label">
                <input type="radio" value="merge" v-model="importMode" />
                <div>
                  <div class="mode-title">智能合并 (推荐)</div>
                  <div class="mode-desc">自动比对去重，保留现有订阅和节点，仅追加不存在的内容</div>
                </div>
              </label>

              <label class="radio-label">
                <input type="radio" value="overwrite" v-model="importMode" />
                <div>
                  <div class="mode-title text-danger">完全覆盖</div>
                  <div class="mode-desc">清空并替换现有的所有订阅、节点和聚合规则为备份文件内容</div>
                </div>
              </label>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showImportModal = false">取消</button>
            <button class="btn btn-primary" @click="executeImportConfig" :disabled="importing">
              <span>{{ importing ? '正在导入中...' : '确认导入' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import {
  Save,
  Zap,
  Clock,
  Lock,
  DatabaseBackup,
  Download,
  Upload
} from 'lucide-vue-next';
import api from '../api';

const emit = defineEmits(['data-changed']);

const settings = reactive({
  testUrl: 'http://www.gstatic.com/generate_204',
  testTimeout: 5000,
  testConcurrency: 15,
  autoRefreshEnabled: true,
  autoRefreshInterval: '0 */6 * * *',
  autoTestAfterRefresh: true
});

const saving = ref(false);
const exporting = ref(false);
const importing = ref(false);

const showImportModal = ref(false);
const importPreview = ref(null);
const importMode = ref('merge');

const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
});
const pwdUpdating = ref(false);

const fetchSettings = async () => {
  try {
    const data = await api.get('/settings');
    Object.assign(settings, data);
  } catch (e) {}
};

const saveSettings = async () => {
  saving.value = true;
  try {
    await api.post('/settings', settings);
    alert('系统配置已成功保存！');
  } catch (e) {
    alert('保存失败: ' + e.message);
  } finally {
    saving.value = false;
  }
};

// 导出全量配置文件
const exportConfigFile = async () => {
  exporting.value = true;
  try {
    const token = localStorage.getItem('sub_token');
    const res = await fetch('/api/system/config/export', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error('导出配置文件失败');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sub_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (e) {
    alert('导出失败: ' + e.message);
  } finally {
    exporting.value = false;
  }
};

// 选中并解析本地导入文件
const handleConfigFileSelected = (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('不是标准的 JSON 格式文件');
      }
      importPreview.value = parsed;
      showImportModal.value = true;
    } catch (err) {
      alert('解析导入文件失败: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
};

// 执行导入配置文件
const executeImportConfig = async () => {
  if (!importPreview.value) return;
  importing.value = true;
  try {
    const res = await api.post('/system/config/import', {
      configData: importPreview.value,
      mode: importMode.value
    });
    showImportModal.value = false;
    alert(`全量配置导入成功！\n- 机场订阅数：${res.totalSubs}\n- 节点池总数：${res.totalNodes}\n- 整合配置数：${res.totalProfiles}`);
    emit('data-changed');
    await fetchSettings();
  } catch (e) {
    alert('导入失败: ' + e.message);
  } finally {
    importing.value = false;
  }
};

const updatePassword = async () => {
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    alert('两次输入的新密码不一致，请重新确认');
    return;
  }

  pwdUpdating.value = true;
  try {
    await api.post('/user/update-password', {
      oldPassword: pwdForm.oldPassword,
      newPassword: pwdForm.newPassword
    });
    alert('密码修改成功，请牢记您的新密码！');
    pwdForm.oldPassword = '';
    pwdForm.newPassword = '';
    pwdForm.confirmPassword = '';
  } catch (e) {
    alert('修改密码失败: ' + e.message);
  } finally {
    pwdUpdating.value = false;
  }
};

onMounted(() => {
  fetchSettings();
});
</script>

<style scoped>
.settings-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
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

/* 顶部全量备份 Banner 卡片 */
.backup-banner-card {
  padding: 24px 28px;
  border-left: 4px solid var(--primary);
}

.backup-banner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.backup-header-left {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  max-width: 650px;
}

.backup-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.backup-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 4px;
}

.backup-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

.backup-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.file-upload-btn {
  cursor: pointer;
  margin: 0;
}

/* 栅格布局 */
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

@media (max-width: 860px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

.full-width-card {
  grid-column: 1 / -1;
}

.form-body {
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
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main);
}

.hint {
  font-size: 11.5px;
  color: var(--text-dim);
}

.form-row {
  display: flex;
  gap: 12px;
}

.col-4 { flex: 4; }
.col-6 { flex: 6; }

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
}

.checkbox-label input {
  width: auto;
}

.quick-cron-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.cron-tag {
  font-size: 11px;
  padding: 4px 10px;
  background: var(--bg-card-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.cron-tag:hover {
  background: var(--primary-light);
  color: var(--primary);
  border-color: var(--primary);
}

/* 导入配置弹窗样式 */
.import-preview-box {
  background: var(--bg-card-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.preview-item {
  display: flex;
  justify-content: space-between;
}

.preview-item .label {
  color: var(--text-muted);
}

.preview-item .val {
  font-weight: 600;
  color: var(--text-main);
  font-family: var(--font-mono);
}

.import-mode-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 6px;
}

.radio-label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: border-color 0.2s;
}

.radio-label:hover {
  border-color: var(--primary);
}

.radio-label input {
  margin-top: 3px;
  width: auto;
}

.mode-title {
  font-size: 13.5px;
  font-weight: 600;
}

.mode-desc {
  font-size: 11.5px;
  color: var(--text-dim);
  margin-top: 2px;
}

@media (max-width: 768px) {
  .backup-banner {
    padding: 16px 14px;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  .backup-actions {
    width: 100%;
    gap: 8px;
  }

  .backup-actions .btn {
    flex: 1;
    justify-content: center;
  }

  .form-row {
    flex-direction: column;
    gap: 10px;
  }

  .col-4, .col-6 {
    flex: 1;
    width: 100%;
  }
}
</style>
