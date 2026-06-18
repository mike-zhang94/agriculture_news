/* ===== State ===== */
let newsData = null;
let uploadedFiles = [];   // { filename, mimetype, previewUrl }
let renderedUrls = [];
let currentSlide = 0;

/* ===== Init ===== */
window.addEventListener('load', () => {
  loadNewsData();
});

function loadNewsData() {
  const raw = sessionStorage.getItem('makecontent_news');
  if (!raw) return;
  try {
    newsData = JSON.parse(raw);
    const title = newsData.translated_title || newsData.title || '';
    const desc = newsData.translated_description || newsData.description || '';
    const link = newsData.link || '';

    document.getElementById('ni-title').textContent = title;
    document.getElementById('ni-desc').textContent = desc;
    const linkEl = document.getElementById('ni-link');
    if (link) { linkEl.href = link; linkEl.textContent = link; }
    else linkEl.style.display = 'none';
  } catch (e) {
    console.error('Failed to parse news data', e);
  }
}

/* ===== Upload / Drag-drop ===== */
function onDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag-over');
}
function onDragLeave() {
  document.getElementById('upload-zone').classList.remove('drag-over');
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  handleFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
}
function onFileSelect(e) {
  handleFiles(Array.from(e.target.files));
  e.target.value = '';
}

async function handleFiles(files) {
  if (!files.length) return;
  const formData = new FormData();
  files.forEach(f => formData.append('images', f));

  try {
    const r = await fetch('/api/render/upload', { method: 'POST', body: formData });
    const res = await r.json();
    if (!res.success) { showToast(res.error, 'error'); return; }

    res.data.forEach((info, i) => {
      uploadedFiles.push({
        filename: info.filename,
        mimetype: info.mimetype,
        previewUrl: URL.createObjectURL(files[i])
      });
    });
    renderThumbnails();
    showToast(`已上传 ${res.data.length} 张图片`, 'success');
  } catch (e) {
    showToast('上传失败: ' + e.message, 'error');
  }
}

function renderThumbnails() {
  document.getElementById('image-previews').innerHTML = uploadedFiles.map((f, i) => `
    <div class="preview-thumb">
      <img src="${f.previewUrl}" alt="">
      <div class="preview-thumb-del" onclick="removeThumb(${i})">×</div>
    </div>`).join('');
}

function removeThumb(i) {
  URL.revokeObjectURL(uploadedFiles[i].previewUrl);
  uploadedFiles.splice(i, 1);
  renderThumbnails();
}

/* ===== Generate ===== */
async function generateContent() {
  const title = newsData ? (newsData.translated_title || newsData.title || '') : '';
  const desc = newsData ? (newsData.translated_description || newsData.description || '') : '';
  const supplementary = document.getElementById('supplementary').value.trim();

  if (!title) { showToast('请先从资讯列表选择一条资讯', 'error'); return; }

  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 创作中...';

  try {
    const res = await API.post('/api/makecontent/generate', { title, description: desc, supplementary });
    if (res.success) {
      fillFields(res.data);
      document.getElementById('content-section').classList.remove('hidden');
      document.getElementById('content-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('内容生成完成！', 'success');
    } else {
      showToast(res.error, 'error');
    }
  } catch (e) {
    showToast('生成失败: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✦ 创作内容';
  }
}

function fillFields(data) {
  document.getElementById('f-cover-word').value = data.cover_word || '';
  document.getElementById('f-cover-emoji').value = data.cover_emoji || '🌾';
  document.getElementById('f-cover-title').value = data.cover_title || '';
  document.getElementById('f-cover-desc').value = data.cover_description || '';
  document.getElementById('f-title').value = data.title || '';
  document.getElementById('f-content').value = data.content || '';
}

/* ===== Render ===== */
async function renderContent() {
  const coverData = {
    cover_word: document.getElementById('f-cover-word').value,
    cover_emoji: document.getElementById('f-cover-emoji').value,
    cover_title: document.getElementById('f-cover-title').value,
    cover_description: document.getElementById('f-cover-desc').value,
  };

  if (!coverData.cover_title) { showToast('请先填写封面标题', 'error'); return; }

  const btn = document.getElementById('render-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 渲染中...';

  try {
    const res = await API.post('/api/render/do', {
      coverData,
      uploadFiles: uploadedFiles.map(f => ({ filename: f.filename, mimetype: f.mimetype }))
    });

    if (res.success) {
      const { coverUrl, detailUrls } = res.data;
      renderedUrls = [coverUrl, ...detailUrls];
      showPreview();
      showToast('渲染完成！', 'success');
    } else {
      showToast(res.error, 'error');
    }
  } catch (e) {
    showToast('渲染失败: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🖼 渲染图片';
  }
}

/* ===== Preview / Carousel ===== */
function showPreview() {
  document.getElementById('preview-section').classList.remove('hidden');
  currentSlide = 0;
  updateCarousel();
  document.getElementById('preview-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateCarousel() {
  const img = document.getElementById('xhs-img');
  img.src = renderedUrls[currentSlide] + '?t=' + Date.now();

  const dotsEl = document.getElementById('xhs-dots');
  dotsEl.innerHTML = renderedUrls.map((_, i) =>
    `<div class="xhs-dot${i === currentSlide ? ' active' : ''}" onclick="goSlide(${i})"></div>`
  ).join('');

  document.getElementById('xhs-counter').textContent = `${currentSlide + 1} / ${renderedUrls.length}`;

  const navBtns = document.querySelectorAll('.xhs-nav-btn');
  navBtns[0].style.opacity = currentSlide === 0 ? '0.3' : '1';
  navBtns[1].style.opacity = currentSlide === renderedUrls.length - 1 ? '0.3' : '1';

  // Sync text
  document.getElementById('xhs-title').textContent = document.getElementById('f-title').value;
  document.getElementById('xhs-content').textContent = document.getElementById('f-content').value;
}

function prevSlide() { if (currentSlide > 0) { currentSlide--; updateCarousel(); } }
function nextSlide() { if (currentSlide < renderedUrls.length - 1) { currentSlide++; updateCarousel(); } }
function goSlide(i) { currentSlide = i; updateCarousel(); }

/* ===== Copy ===== */
function copyText(el) {
  navigator.clipboard.writeText(el.textContent).then(() => {
    showToast('已复制到剪贴板', 'success', 1500);
  }).catch(() => {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges(); sel.addRange(range);
    document.execCommand('copy');
    showToast('已复制', 'success', 1500);
  });
}
