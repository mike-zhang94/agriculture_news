const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

router.get('/', (req, res) => {
  try {
    const sources = getDB().prepare('SELECT * FROM sources ORDER BY id ASC').all();
    res.json({ success: true, data: sources });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, type, url, enabled, fetch_limit, translate } = req.body;
    if (!name || !type || !url) return res.json({ success: false, error: '缺少必填字段' });
    const db = getDB();
    const r = db.prepare(
      'INSERT INTO sources (name, type, url, enabled, fetch_limit, translate) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, type, url, enabled ? 1 : 0, fetch_limit || 20, translate ? 1 : 0);
    const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(r.lastInsertRowid);
    res.json({ success: true, data: source });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, type, url, enabled, fetch_limit, translate } = req.body;
    const db = getDB();
    db.prepare(
      'UPDATE sources SET name=?, type=?, url=?, enabled=?, fetch_limit=?, translate=? WHERE id=?'
    ).run(name, type, url, enabled ? 1 : 0, fetch_limit || 20, translate ? 1 : 0, req.params.id);
    const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: source });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    getDB().prepare('DELETE FROM sources WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
