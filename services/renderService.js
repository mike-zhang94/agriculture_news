const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none'
      ]
    });
  }
  return browserInstance;
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCoverHTML(data) {
  const { cover_word, cover_title, cover_description, cover_emoji } = data;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 1080px; height: 1440px; overflow: hidden; background: #0E1A09; }
.cover { position: relative; width: 1080px; height: 1440px; background: #0E1A09; overflow: hidden; }
.cover_word {
  position: absolute; width: 700px; left: 90px; top: 140px;
  font-family: 'Noto Sans SC', sans-serif; font-weight: 900;
  color: #5A7A3A; white-space: nowrap; transform-origin: left center;
}
.cover_title {
  position: absolute; width: 900px; height: 600px; left: 90px; top: 330px;
  font-family: 'Noto Sans SC', sans-serif; font-weight: 900; color: #E9C84A;
  display: flex; align-items: center; justify-content: flex-start; overflow: hidden;
}
.cover_title span { display: block; width: 100%; line-height: 1.1; }
.cover_description {
  position: absolute; width: 900px; height: 200px; left: 90px; top: 951px;
  font-family: 'Noto Sans SC', sans-serif; font-weight: 400; color: #EDE8D8;
  display: flex; align-items: center; justify-content: flex-start; overflow: hidden;
}
.cover_description span { display: block; width: 100%; line-height: 1.2; }
.cover_emoji {
  position: absolute; width: 300px; height: 300px; left: 690px; top: 1097px;
  font-size: 220px; line-height: 300px; opacity: 0.5;
  display: flex; align-items: center; justify-content: center;
}
.cover_emoji img { width: 260px; height: 260px; opacity: 0.5; }
</style>
</head>
<body>
<div class="cover">
  <div class="cover_word" id="coverWord">${escapeHTML(cover_word)}</div>
  <div class="cover_title" id="coverTitle"><span>${escapeHTML(cover_title)}</span></div>
  <div class="cover_description" id="coverDesc"><span>${escapeHTML(cover_description)}</span></div>
  <div class="cover_emoji" id="coverEmoji">${escapeHTML(cover_emoji)}</div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/twemoji.min.js" crossorigin="anonymous"></script>
<script>
function fitText(el, maxW, maxH, maxFs) {
  let fs = maxFs; el.style.fontSize = fs + 'px';
  if (!maxH) {
    while (el.scrollWidth > maxW && fs > 10) { fs--; el.style.fontSize = fs + 'px'; }
  } else {
    const sp = el.querySelector('span');
    while ((sp.scrollWidth > maxW || sp.scrollHeight > maxH) && fs > 10) { fs--; sp.style.fontSize = fs + 'px'; }
  }
}
window.onload = function() {
  twemoji.parse(document.getElementById('coverEmoji'), {
    folder: 'svg', ext: '.svg',
    base: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/'
  });
  setTimeout(function() {
    fitText(document.getElementById('coverWord'), 700, null, 150);
    fitText(document.getElementById('coverTitle'), 900, 600, 150);
    fitText(document.getElementById('coverDesc'), 900, 200, 80);
  }, 500);
};
</script>
</body>
</html>`;
}

function getDetailsHTML(imageBase64, mimeType) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 1080px; height: 1440px; overflow: hidden; background: #0E1A09; }
.details { position: relative; width: 1080px; height: 1440px; background: #0E1A09; overflow: hidden; }
.image-container {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  box-shadow: 20px 20px 0px #E9C84A; border-radius: 50px; overflow: hidden;
}
.image-container img { display: block; width: 100%; height: 100%; object-fit: contain; border-radius: 50px; }
</style>
</head>
<body>
<div class="details">
  <div class="image-container" id="imgContainer">
    <img src="data:${mimeType};base64,${imageBase64}" id="demoImage" />
  </div>
</div>
<script>
function adjustImage() {
  const container = document.getElementById('imgContainer');
  const img = document.getElementById('demoImage');
  const maxW = 1080 - 160; const maxH = 1440 - 160;
  const w = img.naturalWidth || 920; const h = img.naturalHeight || 1280;
  const scale = Math.min(maxW / w, maxH / h, 1);
  container.style.width = (w * scale) + 'px';
  container.style.height = (h * scale) + 'px';
}
window.onload = adjustImage;
</script>
</body>
</html>`;
}

async function renderHTML(html, width, height) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 800));
    const buffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height }
    });
    return buffer;
  } finally {
    await page.close();
  }
}

async function renderCover(coverData) {
  const html = getCoverHTML(coverData);
  const buf = await renderHTML(html, 1080, 1440);
  const filename = `cover_${crypto.randomBytes(6).toString('hex')}.png`;
  const outPath = path.join(__dirname, '..', 'public', 'renders', filename);
  fs.writeFileSync(outPath, buf);
  return `/renders/${filename}`;
}

async function renderDetails(imageBuffer, mimeType) {
  const b64 = imageBuffer.toString('base64');
  const html = getDetailsHTML(b64, mimeType || 'image/jpeg');
  const buf = await renderHTML(html, 1080, 1440);
  const filename = `detail_${crypto.randomBytes(6).toString('hex')}.png`;
  const outPath = path.join(__dirname, '..', 'public', 'renders', filename);
  fs.writeFileSync(outPath, buf);
  return `/renders/${filename}`;
}

module.exports = { renderCover, renderDetails };
