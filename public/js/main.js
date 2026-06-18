/* ===== State ===== */
let allNews = {};       // { source_id: [items] }
let currentSource = 'all';

/* ===== Init ===== */
window.addEventListener('load', loadNews);

async function loadNews() {
  const res = await API.get('/api/news');
  if (!res.success) return showToast(res.error, 'error');

  allNews = {};
  res.data.forEach(item => {
    if (!allNews[item.source_id]) allNews[item.source_id] = [];
    allNews[item.source_id].push(item);
  });

  buildTabs();
  renderCards();
  updateStatus(res.data.length);
}

/* ===== Tabs ===== */
function buildTabs() {
  const total = Object.values(allNews).flat().length;
  let html = `<button class="tab-btn ${currentSource === 'all' ? 'active' : ''}" onclick="filterSource('all',this)">全部 <span style="opacity:.6">${total}</span></button>`;

  Object.entries(allNews).forEach(([sid, items]) => {
    if (!items.length) return;
    const name = items[0].source_name;
    html += `<button class="tab-btn ${currentSource == sid ? 'active' : ''}" onclick="filterSource('${sid}',this)">${escapeHTML(name)} <span style="opacity:.6">${items.length}</span></button>`;
  });

  document.getElementById('source-tabs').innerHTML = html;
}

function filterSource(src, btn) {
  currentSource = src;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCards();
}

/* ===== Render cards ===== */
function renderCards() {
  const container = document.getElementById('news-container');
  let items = currentSource === 'all'
    ? Object.values(allNews).flat()
    : (allNews[currentSource] || []);

  items = items.slice().sort((a, b) => {
    const da = new Date(a.pub_date || a.fetched_at);
    const db_ = new Date(b.pub_date || b.fetched_at);
    return db_ - da;
  });

  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🌱</div><p>暂无资讯，点击「拉取最新」获取</p></div>`;
    return;
  }

  container.innerHTML = `<div class="news-grid">${items.map(cardHTML).join('')}</div>`;
}

function cardHTML(item) {
  const title = escapeHTML(item.translated_title || item.title);
  const desc = escapeHTML((item.translated_description || item.description || '').slice(0, 130));
  const when = timeAgo(item.pub_date || item.fetched_at);
  const safeId = item.id.replace(/'/g, "\\'");

  return `
  <div class="news-card" id="card-${item.id}">
    <div class="news-card-header">
      <span class="source-tag">${escapeHTML(item.source_name)}</span>
      <span class="card-time">${when}</span>
    </div>
    <h3 class="news-card-title" onclick="openNewsDetail('${safeId}')" title="点击查看详情">${title}</h3>
    ${desc ? `<p class="news-card-desc">${desc}${(item.translated_description || item.description || '').length > 130 ? '...' : ''}</p>` : ''}
    <div class="news-card-footer">
      <span></span>
      <div class="card-actions">
        <button class="btn-card btn-card-remove" onclick="removeNews('${safeId}')">移除</button>
        <button class="btn-card btn-card-make" onclick="gotoMakeContent('${safeId}')">创作内容</button>
      </div>
    </div>
  </div>`;
}

/* ===== News Detail Modal ===== */
function findNewsById(id) {
  for (const items of Object.values(allNews)) {
    const found = items.find(i => i.id === id);
    if (found) return found;
  }
  return null;
}

function openNewsDetail(id) {
  const item = findNewsById(id);
  if (!item) return;

  document.getElementById('detail-source').textContent = item.source_name;
  document.getElementById('detail-time').textContent = timeAgo(item.pub_date || item.fetched_at);
  document.getElementById('detail-title').textContent = item.translated_title || item.title;

  const summary = item.translated_description || item.description || '';
  const summaryEl = document.getElementById('detail-summary');
  const summarySection = document.getElementById('detail-summary-section');
  summaryEl.textContent = summary;
  summarySection.classList.toggle('hidden', !summary);

  const linkEl = document.getElementById('detail-link');
  if (item.link) {
    linkEl.href = item.link;
    linkEl.classList.remove('hidden');
  } else {
    linkEl.classList.add('hidden');
  }

  document.getElementById('detail-modal').classList.remove('hidden');
}

function closeDetailModal(e) {
  if (e && e.target !== document.getElementById('detail-modal')) return;
  document.getElementById('detail-modal').classList.add('hidden');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('detail-modal').classList.add('hidden');
});

/* ===== Fetch ===== */
async function fetchNews() {
  const btn = document.getElementById('fetch-btn');
  const statusEl = document.getElementById('fetch-status');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 拉取中...';
  statusEl.innerHTML = '正在从各信源拉取最新资讯...';

  try {
    const res = await API.post('/api/news/fetch');
    if (res.success) {
      const { totalNew, errors } = res.data;
      const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      document.getElementById('fetch-time').textContent = `${now} 已更新`;
      statusEl.innerHTML = `本次新增 <span class="highlight">${totalNew}</span> 条资讯`;
      if (errors.length) errors.forEach(e => showToast(e, 'warning', 5000));
      showToast(`拉取完成，新增 ${totalNew} 条`, 'success');
      document.getElementById('translate-hint').classList.toggle('hidden', totalNew === 0);
      await loadNews();
    } else {
      showToast(res.error, 'error');
      statusEl.textContent = '拉取失败，请检查信源配置';
    }
  } catch (e) {
    showToast('网络错误：' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '↻ 拉取最新';
  }
}

/* ===== Remove ===== */
async function removeNews(newsId) {
  const card = document.getElementById(`card-${newsId}`);
  if (card) card.classList.add('card-removing');
  await new Promise(r => setTimeout(r, 250));

  const res = await API.post(`/api/news/${newsId}/hide`);
  if (res.success) {
    for (const sid in allNews) {
      allNews[sid] = allNews[sid].filter(i => i.id !== newsId);
    }
    buildTabs();
    renderCards();
    updateStatus();
  } else {
    showToast(res.error, 'error');
    if (card) card.classList.remove('card-removing');
  }
}

/* ===== MakeContent ===== */
async function gotoMakeContent(newsId) {
  const res = await API.get(`/api/news/${newsId}`);
  if (!res.success) { showToast(res.error, 'error'); return; }
  sessionStorage.setItem('makecontent_news', JSON.stringify(res.data));
  window.location.href = '/makecontent.html';
}

/* ===== Status bar ===== */
function updateStatus(count) {
  const total = count !== undefined ? count : Object.values(allNews).flat().length;
  if (!total) return;
  const statusEl = document.getElementById('fetch-status');
  if (statusEl.textContent.includes('拉取')) return;
  statusEl.textContent = `当前共 ${total} 条资讯`;
}
