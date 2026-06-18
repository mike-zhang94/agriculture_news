const express = require('express');
const router = express.Router();
const { generateContent } = require('../services/llmService');

// POST /api/makecontent/generate
router.post('/generate', async (req, res) => {
  try {
    const { title, description, supplementary } = req.body;
    if (!title) return res.json({ success: false, error: '缺少资讯标题' });

    const content = await generateContent(title, description || '', supplementary || '');
    res.json({ success: true, data: content });
  } catch (e) {
    console.error('[MakeContent]', e);
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
