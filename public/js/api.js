// ===== API client =====
const API = {
  async request(method, url, data) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (data !== undefined) opts.body = JSON.stringify(data);
    const r = await fetch(url, opts);
    return r.json();
  },
  get: (url) => API.request('GET', url),
  post: (url, data) => API.request('POST', url, data),
  put: (url, data) => API.request('PUT', url, data),
  del: (url) => API.request('DELETE', url)
};

// ===== Toast =====
function showToast(msg, type = 'info', duration = 3000) {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(10px)';
    t.style.transition = 'all 0.2s';
    setTimeout(() => t.remove(), 200);
  }, duration);
}

// ===== HTML escape =====
function escapeHTML(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== Time ago =====
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// ===== Sidebar nav (injected into #sidebar-slot) =====
(function injectNav() {
  const slot = document.getElementById('sidebar-slot');
  if (!slot) return;
  const p = window.location.pathname;
  const isHome = p === '/' || p === '/index.html';
  const isSrc = p === '/sources.html';
  const isCfg = p === '/config.html';

  slot.outerHTML = `
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon">🌾</div>
      <div class="logo-title">农机行业通</div>
      <div class="logo-sub">全球农业科技信息聚合<br>农用无人机 · 无人车 · 机器人</div>
    </div>
    <div class="sidebar-divider"></div>
    <nav class="sidebar-nav">
      <a href="/" class="nav-item${isHome ? ' active' : ''}"><span class="nav-icon">📰</span>资讯首页</a>
      <a href="/sources.html" class="nav-item${isSrc ? ' active' : ''}"><span class="nav-icon">📡</span>信源配置</a>
      <a href="/config.html" class="nav-item${isCfg ? ' active' : ''}"><span class="nav-icon">⚙️</span>系统配置</a>
    </nav>
    <div class="sidebar-footer">农用无人机 · 农用无人车<br>农业机器人 · 精准农业</div>
  </aside>`;
})();
