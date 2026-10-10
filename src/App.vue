<template>
  <div class="app-layout">
    <!-- Login Screen if not logged in -->
    <LoginModal v-if="!isLoggedIn" @login-success="handleLoginSuccess" />

    <!-- Main Dashboard when logged in -->
    <div v-else class="app-shell">
      <!-- Mobile Backdrop -->
      <div
        v-if="isMobileMenuOpen"
        class="mobile-backdrop"
        @click="closeMobileMenu"
      ></div>

      <!-- Sidebar Navigation -->
      <aside :class="['sidebar', 'glass', { 'sidebar-open': isMobileMenuOpen }]">
        <div class="sidebar-brand">
          <div class="brand-logo">
            <Zap :size="24" />
          </div>
          <div class="brand-text">
            <span class="brand-title">SUB</span>
            <span class="brand-sub">Mihomo Core</span>
          </div>
          <button class="mobile-close-btn" @click="closeMobileMenu">
            <X :size="20" />
          </button>
        </div>

        <nav class="sidebar-nav">
          <button
            :class="['nav-item', { active: currentTab === 'dashboard' }]"
            @click="switchTab('dashboard')"
          >
            <LayoutDashboard :size="18" />
            <span>仪表盘概览</span>
          </button>

          <button
            :class="['nav-item', { active: currentTab === 'subscriptions' }]"
            @click="switchTab('subscriptions')"
          >
            <Radio :size="18" />
            <span>机场订阅管理</span>
            <span class="nav-count" v-if="stats.totalSubs">{{ stats.totalSubs }}</span>
          </button>

          <button
            :class="['nav-item', { active: currentTab === 'nodes' }]"
            @click="viewAllNodesMobile"
          >
            <Layers :size="18" />
            <span>节点池与测速</span>
            <span class="nav-count" v-if="stats.totalNodes">{{ stats.totalNodes }}</span>
          </button>

          <button
            :class="['nav-item', { active: currentTab === 'profiles' }]"
            @click="switchTab('profiles')"
          >
            <Shield :size="18" />
            <span>整合订阅 (分流)</span>
          </button>

          <button
            :class="['nav-item', { active: currentTab === 'settings' }]"
            @click="switchTab('settings')"
          >
            <Settings :size="18" />
            <span>系统配置</span>
          </button>
        </nav>

        <div class="sidebar-footer">
          <div class="user-info">
            <div class="user-avatar">
              <User :size="16" />
            </div>
            <div class="user-text">
              <span class="username">{{ currentUser }}</span>
              <span class="user-role">Administrator</span>
            </div>
          </div>
          <button class="logout-btn" title="退出登录" @click="handleLogout">
            <LogOut :size="16" />
          </button>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="main-wrapper">
        <!-- Top App Bar -->
        <header class="app-header glass">
          <div class="header-left">
            <button class="mobile-menu-btn" @click="toggleMobileMenu" title="打开导航菜单">
              <Menu :size="20" />
            </button>
            <span class="tab-crumb">{{ tabNames[currentTab] }}</span>
          </div>

          <div class="header-right">
            <div class="status-pill cursor-pointer" v-if="isTesting" @click="showTestModal = !showTestModal" title="点击展开/收起测速详情气泡">
              <span class="pulse-dot"></span>
              <span class="status-pill-text">测速中: {{ testProgress.current }}/{{ testProgress.total }}</span>
            </div>

            <!-- Theme Toggle Button (Light by default) -->
            <button
              class="btn btn-secondary btn-sm theme-btn"
              @click="toggleTheme"
              :title="currentTheme === 'light' ? '切换为暗色模式' : '切换为明亮模式'"
            >
              <Sun v-if="currentTheme === 'light'" :size="15" class="text-warning" />
              <Moon v-else :size="15" class="text-primary" />
              <span class="hide-mobile">{{ currentTheme === 'light' ? '明亮' : '暗色' }}</span>
            </button>

            <button class="btn btn-secondary btn-sm" @click="refreshAllData">
              <RefreshCw :size="14" :class="{ 'animate-spin': isRefreshingData }" />
              <span class="hide-mobile">刷新</span>
            </button>
          </div>
        </header>

        <!-- Dynamic View Content -->
        <div class="content-scroll">
          <DashboardView
            v-if="currentTab === 'dashboard'"
            :stats="stats"
            :isTesting="isTesting"
            :refreshingAll="isRefreshingAllSubs"
            @quick-test="handleStartSpeedTest"
            @quick-filter="handleQuickFilter"
            @quick-refresh="handleQuickRefreshAll"
          />

          <SubscriptionsView
            v-else-if="currentTab === 'subscriptions'"
            @view-nodes="handleViewSubNodes"
            @data-changed="refreshAllData"
          />

          <NodesView
            v-else-if="currentTab === 'nodes'"
            ref="nodesViewRef"
            :initialSubId="selectedSubFilter"
            :isTesting="isTesting"
            :testProgress="testProgress"
            @start-test="handleStartSpeedTest"
            @data-changed="refreshAllData"
          />

          <ProfilesView
            v-else-if="currentTab === 'profiles'"
            @data-changed="refreshAllData"
          />

          <SettingsView
            v-else-if="currentTab === 'settings'"
            @data-changed="refreshAllData"
          />
        </div>
      </main>
    </div>

    <!-- Live Speed Test Floating Widget (右下角精致悬浮动态气泡，不遮挡页面) -->
    <transition name="slide-up">
      <div v-if="showTestModal || isTesting" class="test-floating-card glass">
        <div class="test-card-header">
          <div class="test-header-left">
            <Activity :size="16" class="text-primary animate-pulse" />
            <span class="test-header-title">{{ isTesting ? 'Mihomo 并发测速中' : '测速完成' }}</span>
          </div>
          <div class="test-header-actions">
            <button class="test-icon-btn" title="最小化/关闭" @click="showTestModal = false">×</button>
          </div>
        </div>

        <div class="test-card-body">
          <div class="test-stats-row">
            <div class="test-stat-item">
              <span class="label">进度</span>
              <span class="val">{{ testProgress.current }} / {{ testProgress.total }}</span>
            </div>
            <div class="test-stat-item">
              <span class="label">完成比例</span>
              <span class="val text-primary">{{ testPercentage }}%</span>
            </div>
            <div class="test-stat-item">
              <span class="label">状态</span>
              <span class="val">{{ isTesting ? '测试中' : '已就绪' }}</span>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="progress-container">
            <div class="progress-fill" :style="{ width: testPercentage + '%' }"></div>
          </div>

          <!-- Latest test node line -->
          <div class="latest-tested-box" v-if="testProgress.latest || testProgress.retrying">
            <div class="latest-label">{{ testProgress.retrying ? '节点超时重试中：' : '最新测速节点：' }}</div>
            <div class="latest-row" v-if="testProgress.retrying">
              <span class="latest-name">{{ testProgress.retrying.name }}</span>
              <span class="latest-delay text-warning">
                重试第 {{ testProgress.retrying.currentRetry }}/{{ testProgress.retrying.totalRetries }} 次
              </span>
            </div>
            <div class="latest-row" v-else-if="testProgress.latest">
              <span class="latest-name">{{ testProgress.latest.name }}</span>
              <span :class="['latest-delay', testProgress.latest.delay > 0 ? 'text-success' : 'text-danger']">
                {{ testProgress.latest.delay > 0 ? `${testProgress.latest.delay} ms` : '超时/移出' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import {
  Zap,
  LayoutDashboard,
  Radio,
  Layers,
  Shield,
  Settings,
  User,
  LogOut,
  RefreshCw,
  Activity,
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-vue-next';
import api from './api';
import LoginModal from './components/LoginModal.vue';
import DashboardView from './views/DashboardView.vue';
import SubscriptionsView from './views/SubscriptionsView.vue';
import NodesView from './views/NodesView.vue';
import ProfilesView from './views/ProfilesView.vue';
import SettingsView from './views/SettingsView.vue';

const isLoggedIn = ref(!!localStorage.getItem('sub_token'));
const currentUser = ref(localStorage.getItem('sub_user') || 'admin');
const isMobileMenuOpen = ref(false);

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false;
};

const switchTab = (tab) => {
  currentTab.value = tab;
  closeMobileMenu();
};

// Default Theme is 'light'
const currentTheme = ref(localStorage.getItem('sub_theme') || 'light');

const toggleTheme = () => {
  currentTheme.value = currentTheme.value === 'light' ? 'dark' : 'light';
  localStorage.setItem('sub_theme', currentTheme.value);
  applyTheme(currentTheme.value);
};

const applyTheme = (theme) => {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
};

const currentTab = ref('dashboard');
const selectedSubFilter = ref('');
const nodesViewRef = ref(null);

const stats = reactive({
  totalSubs: 0,
  totalNodes: 0,
  combinedNodes: 0,
  aliveNodes: 0,
  failedNodes: 0,
  untestedNodes: 0,
  protocols: {}
});

const isTesting = ref(false);
const showTestModal = ref(false);
const testProgress = reactive({
  current: 0,
  total: 0,
  latest: null
});

const isRefreshingData = ref(false);
const isRefreshingAllSubs = ref(false);

const tabNames = {
  dashboard: '仪表盘概览',
  subscriptions: '机场订阅管理',
  nodes: '节点池与测速',
  profiles: '整合订阅生成 (Loyalsoldier 规则)',
  settings: '系统配置'
};

const testPercentage = computed(() => {
  if (!testProgress.total) return 0;
  return Math.min(100, Math.round((testProgress.current / testProgress.total) * 100));
});

const handleLoginSuccess = (res) => {
  isLoggedIn.value = true;
  currentUser.value = res.username;
  refreshAllData();
  setupWebSocket();
};

const handleLogout = () => {
  localStorage.removeItem('sub_token');
  localStorage.removeItem('sub_user');
  isLoggedIn.value = false;
};

const fetchStats = async () => {
  try {
    const data = await api.get('/dashboard/stats');
    Object.assign(stats, data);
    if (typeof data.isTesting === 'boolean') {
      isTesting.value = data.isTesting;
    }
  } catch (e) {}
};

const refreshAllData = async () => {
  isRefreshingData.value = true;
  try {
    await fetchStats();
    if (nodesViewRef.value && currentTab.value === 'nodes') {
      nodesViewRef.value.fetchNodes();
    }
  } finally {
    isRefreshingData.value = false;
  }
};

const handleViewSubNodes = (subId) => {
  selectedSubFilter.value = subId;
  currentTab.value = 'nodes';
};

const viewAllNodes = () => {
  selectedSubFilter.value = '';
  currentTab.value = 'nodes';
};

const viewAllNodesMobile = () => {
  viewAllNodes();
  closeMobileMenu();
};

const handleStartSpeedTest = async (ids) => {
  try {
    const payload = Array.isArray(ids) ? { ids } : {};
    const res = await api.post('/nodes/test-speed', payload);
    isTesting.value = true;
    testProgress.current = 0;
    testProgress.total = res.total || 0;
    testProgress.latest = null;
    showTestModal.value = true;
  } catch (err) {
    alert(err.message);
  }
};

const handleQuickFilter = async () => {
  if (!confirm(`确定过滤并删除所有检测失败的 ${stats.failedNodes} 个节点吗？`)) return;
  try {
    const res = await api.post('/nodes/filter-failed');
    alert(`已清除 ${res.removedCount} 个失效节点`);
    refreshAllData();
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
};

const handleQuickRefreshAll = async () => {
  isRefreshingAllSubs.value = true;
  try {
    await api.post('/subscriptions/refresh-all');
    alert('全部订阅刷新任务已执行完成');
    refreshAllData();
  } catch (e) {
    alert('刷新失败: ' + e.message);
  } finally {
    isRefreshingAllSubs.value = false;
  }
};

// WebSocket setup for real-time latency test progress
let ws = null;
const setupWebSocket = () => {
  if (ws) {
    ws.close();
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.port === '5173' ? `${window.location.hostname}:3580` : window.location.host;
  const wsUrl = `${protocol}//${wsHost}`;
  ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'test_started') {
        isTesting.value = true;
        testProgress.total = data.payload.total;
        testProgress.current = 0;
      } else if (data.type === 'test_progress') {
        isTesting.value = true;
        testProgress.current = data.payload.current;
        testProgress.total = data.payload.total;
        testProgress.latest = data.payload.latest;
        testProgress.retrying = data.payload.retrying;
      } else if (data.type === 'test_completed') {
        isTesting.value = false;
        refreshAllData();
      } else if (data.type === 'test_error') {
        isTesting.value = false;
        alert('测速失败: ' + (data.payload?.error || 'Mihomo 内核启动或执行异常'));
        refreshAllData();
      } else if (data.type === 'subscription_updated' || data.type === 'nodes_cleaned') {
        refreshAllData();
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    setTimeout(() => {
      if (isLoggedIn.value) setupWebSocket();
    }, 3000);
  };
};

onMounted(() => {
  applyTheme(currentTheme.value);
  if (isLoggedIn.value) {
    refreshAllData();
    setupWebSocket();
  }
  window.addEventListener('auth-expired', handleLogout);
});
</script>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 250px;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  border-left: none;
  border-top: none;
  border-bottom: none;
  border-right: 1px solid var(--border-color);
  background: var(--bg-card);
  z-index: 50;
  flex-shrink: 0;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 20px;
  border-bottom: 1px solid var(--border-color);
}

.brand-logo {
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, var(--primary) 0%, #06b6d4 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px var(--primary-glow);
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.5px;
  line-height: 1.1;
  color: var(--text-main);
}

.brand-sub {
  font-size: 11px;
  color: var(--text-dim);
}

.sidebar-nav {
  flex: 1;
  padding: 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 13.5px;
  font-weight: 500;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  text-align: left;
}

.nav-item:hover {
  background: var(--bg-card-subtle);
  color: var(--text-main);
}

.nav-item.active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 600;
  border-left: 3px solid var(--primary);
}

.nav-count {
  margin-left: auto;
  font-size: 11px;
  background: var(--bg-card-subtle);
  border: 1px solid var(--border-subtle);
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--text-muted);
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-card-subtle);
  border: 1px solid var(--border-subtle);
  color: var(--text-main);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-text {
  display: flex;
  flex-direction: column;
}

.username {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--text-main);
}

.user-role {
  font-size: 11px;
  color: var(--text-dim);
}

.logout-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

/* Main Area */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.app-header {
  height: 64px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 0;
  border-top: none;
  border-left: none;
  border-right: none;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-card);
  z-index: 40;
}

.tab-crumb {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--text-main);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  background: var(--primary-light);
  border: 1px solid rgba(79, 70, 229, 0.3);
  border-radius: 999px;
  font-size: 12px;
  color: var(--primary);
  font-weight: 500;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 8px var(--primary);
  animation: pulse 1.5s infinite;
}

.content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px;
}

/* Speedtest Floating Widget (右下角优雅悬浮气泡) */
.test-floating-card {
  position: fixed;
  right: 28px;
  bottom: 28px;
  width: 360px;
  max-width: calc(100vw - 40px);
  z-index: 9999;
  border-radius: 16px;
  box-shadow: 0 16px 36px -4px rgba(15, 23, 42, 0.2), 0 0 0 1px var(--border-color);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.test-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.test-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.test-header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.test-icon-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 6px;
  transition: all 0.2s;
}

.test-icon-btn:hover {
  background: var(--bg-card-subtle);
  color: var(--text-main);
}

.test-card-body {
  display: flex;
  flex-direction: column;
}

.test-stats-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.test-stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.test-stat-item .label {
  font-size: 11px;
  color: var(--text-dim);
}

.test-stat-item .val {
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text-main);
}

.progress-container {
  width: 100%;
  height: 8px;
  background: var(--bg-card-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), #06b6d4);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.latest-tested-box {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  background: var(--bg-card-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
}

.latest-label {
  color: var(--text-dim);
  font-size: 11px;
}

.latest-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.latest-name {
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.latest-delay {
  font-family: var(--font-mono);
  font-weight: 600;
  flex-shrink: 0;
  font-size: 12px;
}

/* Slide up animation for floating widget */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(24px) scale(0.96);
}

.cursor-pointer {
  cursor: pointer;
}

/* Mobile Responsive Adjustments */
.mobile-menu-btn,
.mobile-close-btn {
  display: none;
  background: transparent;
  border: none;
  color: var(--text-main);
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
}

.mobile-close-btn {
  margin-left: auto;
}

.mobile-backdrop {
  display: none;
}

@media (max-width: 768px) {
  .mobile-menu-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .mobile-close-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .mobile-backdrop {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(4px);
    z-index: 99;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 270px;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  }

  .sidebar.sidebar-open {
    transform: translateX(0);
  }

  .app-header {
    padding: 0 16px;
    height: 56px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .tab-crumb {
    font-size: 15px;
  }

  .content-scroll {
    padding: 16px;
  }

  .hide-mobile {
    display: none;
  }

  .status-pill {
    padding: 4px 8px;
    font-size: 11px;
  }

  .status-pill-text {
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .test-floating-card {
    right: 12px;
    bottom: 12px;
    left: 12px;
    width: auto;
    max-width: none;
    padding: 14px 16px;
  }
}
</style>
