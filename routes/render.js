const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { renderCover, renderDetails } = require('../services/renderService');

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, crypto.randomBytes(8).toString('hex') + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只支持图片文件'));
  }
});

// POST /api/render/upload
router.post('/upload', upload.array('images', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.json({ success: false, error: '未接收到文件' });
  }
  const files = req.files.map(f => ({
    filename: f.filename,
    mimetype: f.mimetype,
    originalname: f.originalname
  }));
  res.json({ success: true, data: files });
});

// POST /api/render/do
router.post('/do', async (req, res) => {
  try {
    const { coverData, uploadFiles } = req.body;
    if (!coverData) return res.json({ success: false, error: '缺少封面数据' });

    const coverUrl = await renderCover(coverData);

    const detailUrls = [];
    if (Array.isArray(uploadFiles) && uploadFiles.length > 0) {
      for (const f of uploadFiles) {
        const filePath = path.join(__dirname, '..', 'uploads', f.filename);
        if (fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath);
          const url = await renderDetails(buf, f.mimetype || 'image/jpeg');
          detailUrls.push(url);
        }
      }
    }

    res.json({ success: true, data: { coverUrl, detailUrls } });
  } catch (e) {
    console.error('[Render]', e);
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
