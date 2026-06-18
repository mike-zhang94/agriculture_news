let sources = [];

window.addEventListener('load', loadSources);

async function loadSources() {
  const res = await API.get('/api/sources');
  if (!res.success) { showToast(res.error, 'error'); return; }
  sources = res.data;
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('sources-tbody');
  if (!sources.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px">暂无信源，点击右上角添加</td></tr>`;
    return;
  }

  tbody.innerHTML = sources.map(s => {
    const typeLabel = s.type === 'rsshub' ? '<span class="badge badge-rsshub">RSSHub</span>' : '<span class="badge badge-rss">RSS</span>';
    const urlDisplay = s.type === 'rsshub' ? s.url : (s.url.length > 40 ? s.url.slice(0, 40) + '...' : s.url);
    return `
    <tr>
      <td><strong>${escapeHTML(s.name)}</strong></td>
      <td>${typeLabel}</td>
      <td style="font-size:12px;color:var(--text-muted);word-break:break-all;max-width:200px">${escapeHTML(urlDisplay)}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleEnabled(${s.id}, this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td style="color:var(--text-muted)">${s.type === 'rsshub' ? s.fetch_limit : '-'}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" ${s.translate ? 'checked' : ''} onchange="toggleTranslate(${s.id}, this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-sm" onclick="openEditModal(${s.id})">编辑</button>
        <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="deleteSource(${s.id})">删除</button>
      </td>
    </tr>`;
  }).join('');
}

/* ===== Toggle inline ===== */
async function toggleEnabled(id, val) {
  const s = sources.find(x => x.id === id);
  if (!s) return;
  const res = await API.put(`/api/sources/${id}`, { ...s, enabled: val ? 1 : 0 });
  if (res.success) { s.enabled = val ? 1 : 0; showToast(val ? '已开启' : '已暂停', 'info'); }
  else showToast(res.error, 'error');
}

async function toggleTranslate(id, val) {
  const s = sources.find(x => x.id === id);
  if (!s) return;
  const res = await API.put(`/api/sources/${id}`, { ...s, translate: val ? 1 : 0 });
  if (res.success) { s.translate = val ? 1 : 0; showToast(val ? '已开启翻译' : '已关闭翻译', 'info'); }
  else showToast(res.error, 'error');
}

/* ===== Modal ===== */
function openAddModal() {
  document.getElementById('modal-title').textContent = '添加信源';
  document.getElementById('edit-id').value = '';
  document.getElementById('f-name').value = '';
  document.getElementById('f-type').value = 'rsshub';
  document.getElementById('f-url').value = '';
  document.getElementById('f-limit').value = '20';
  document.getElementById('f-translate').checked = false;
  document.getElementById('f-enabled').checked = true;
  onTypeChange();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function openEditModal(id) {
  const s = sources.find(x => x.id === id);
  if (!s) return;
  document.getElementById('modal-title').textContent = '编辑信源';
  document.getElementById('edit-id').value = s.id;
  document.getElementById('f-name').value = s.name;
  document.getElementById('f-type').value = s.type;
  document.getElementById('f-url').value = s.url;
  document.getElementById('f-limit').value = s.fetch_limit;
  document.getElementById('f-translate').checked = !!s.translate;
  document.getElementById('f-enabled').checked = !!s.enabled;
  onTypeChange();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// Close on overlay click
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

function onTypeChange() {
  const type = document.getElementById('f-type').value;
  const label = document.getElementById('url-label');
  const urlInput = document.getElementById('f-url');
  const limitGroup = document.getElementById('limit-group');

  if (type === 'rsshub') {
    label.textContent = 'RSSHub 路由 *';
    urlInput.placeholder = '/weibo/search/keyword/农用无人机';
    limitGroup.style.display = '';
  } else {
    label.textContent = 'RSS 地址 *';
    urlInput.placeholder = 'https://example.com/feed/';
    limitGroup.style.display = 'none';
  }
}

async function saveSource() {
  const editId = document.getElementById('edit-id').value;
  const name = document.getElementById('f-name').value.trim();
  const type = document.getElementById('f-type').value;
  const url = document.getElementById('f-url').value.trim();
  const fetch_limit = parseInt(document.getElementById('f-limit').value) || 20;
  const translate = document.getElementById('f-translate').checked ? 1 : 0;
  const enabled = document.getElementById('f-enabled').checked ? 1 : 0;

  if (!name || !url) { showToast('名称和 URL 不能为空', 'error'); return; }

  const payload = { name, type, url, fetch_limit, translate, enabled };
  let res;

  if (editId) {
    res = await API.put(`/api/sources/${editId}`, payload);
  } else {
    res = await API.post('/api/sources', payload);
  }

  if (res.success) {
    showToast(editId ? '已更新' : '已添加', 'success');
    closeModal();
    await loadSources();
  } else {
    showToast(res.error, 'error');
  }
}

async function deleteSource(id) {
  if (!confirm('确认删除该信源？已拉取的资讯不受影响。')) return;
  const res = await API.del(`/api/sources/${id}`);
  if (res.success) {
    showToast('已删除', 'info');
    await loadSources();
  } else {
    showToast(res.error, 'error');
  }
}
