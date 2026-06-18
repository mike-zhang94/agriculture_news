const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { fetchAllSources } = require('../services/rssService');
const { editNews, translateText } = require('../services/llmService');

// GET /api/news — list non-hidden items grouped by source
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { sourceId } = req.query;
    let query = 'SELECT * FROM news_items WHERE hidden = 0';
    const params = [];
    if (sourceId) { query += ' AND source_id = ?'; params.push(sourceId); }
    query += ' ORDER BY fetched_at DESC, pub_date DESC';
    const items = db.prepare(query).all(...params);
    res.json({ success: true, data: items });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// POST /api/news/fetch — re-fetch all enabled sources
router.post('/fetch', async (req, res) => {
  try {
    const db = getDB();
    const results = await fetchAllSources();

    let totalNew = 0;
    const errors = [];

    for (const { source, items, error } of results) {
      if (error) { errors.push(`${source.name}: ${error}`); continue; }

      const insert = db.prepare(`
        INSERT OR IGNORE INTO news_items
        (id, source_id, source_name, title, description, link, pub_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      let newCount = 0;
      const toTranslate = [];

      db.transaction(() => {
        for (const item of items) {
          const r = insert.run(item.id, source.id, source.name, item.title, item.description, item.link, item.pubDate);
          if (r.changes > 0) { newCount++; if (source.translate) toTranslate.push(item); }
        }
      })();

      totalNew += newCount;

      // Translate + edit + generate reason asynchronously (don't block response)
      if (toTranslate.length > 0 && source.translate) {
        setImmediate(async () => {
          for (const item of toTranslate) {
            try {
              const result = await editNews(item.title, item.description || '');
              db.prepare('UPDATE news_items SET translated_title=?, translated_description=?, selection_reason=? WHERE id=?')
                .run(result.title, result.summary, result.reason || '', item.id);
            } catch (err) {
              console.error('[EditNews]', err.message);
            }
          }
        });
      }
    }

    res.json({ success: true, data: { totalNew, errors } });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// POST /api/news/:id/hide
router.post('/:id/hide', (req, res) => {
  try {
    getDB().prepare('UPDATE news_items SET hidden = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// GET /api/news/:id
router.get('/:id', (req, res) => {
  try {
    const item = getDB().prepare('SELECT * FROM news_items WHERE id = ?').get(req.params.id);
    if (!item) return res.json({ success: false, error: '未找到该资讯' });
    res.json({ success: true, data: item });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// POST /api/news/:id/regen-reason — generate selection_reason on demand
router.post('/:id/regen-reason', async (req, res) => {
  try {
    const db = getDB();
    const item = db.prepare('SELECT * FROM news_items WHERE id = ?').get(req.params.id);
    if (!item) return res.json({ success: false, error: '未找到该资讯' });

    const result = await editNews(item.translated_title || item.title, item.translated_description || item.description || '');
    const reason = result.reason || '';
    db.prepare('UPDATE news_items SET selection_reason = ? WHERE id = ?').run(reason, item.id);
    res.json({ success: true, data: { reason } });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
