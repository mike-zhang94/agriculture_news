const express = require('express');
const router = express.Router();

// AINews (飞书集成) — 功能待上线
router.post('/', async (req, res) => {
  res.json({ success: false, error: '飞书集成功能即将上线，敬请期待' });
});

module.exports = router;
