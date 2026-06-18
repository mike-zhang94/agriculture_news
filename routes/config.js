const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

router.get('/', (req, res) => {
  try {
    const rows = getDB().prepare('SELECT key, value FROM config').all();
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({ success: true, data: cfg });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

router.put('/', (req, res) => {
  try {
    const db = getDB();
    const upsert = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
    const update = db.transaction((pairs) => {
      for (const [k, v] of pairs) upsert.run(k, v ?? '');
    });
    update(Object.entries(req.body));
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
