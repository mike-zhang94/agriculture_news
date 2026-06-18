const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'agritech.db');
let db;

function getDB() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('rsshub', 'rss')),
      url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      fetch_limit INTEGER NOT NULL DEFAULT 20,
      translate INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS news_items (
      id TEXT PRIMARY KEY,
      source_id INTEGER NOT NULL,
      source_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      link TEXT DEFAULT '',
      pub_date TEXT DEFAULT '',
      translated_title TEXT DEFAULT '',
      translated_description TEXT DEFAULT '',
      hidden INTEGER NOT NULL DEFAULT 0,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS ainews_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      news_id TEXT NOT NULL,
      doc_date TEXT NOT NULL,
      news_title TEXT DEFAULT '',
      sent_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS feishu_docs (
      date TEXT PRIMARY KEY,
      node_token TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Migration: add selection_reason if not present (safe to run on existing DBs)
  try {
    db.exec(`ALTER TABLE news_items ADD COLUMN selection_reason TEXT DEFAULT ''`);
  } catch (_) { /* column already exists */ }

  const defaultConfig = {
    rsshub_base_url: 'http://localhost:1200',
    translate_llm_model: '',
    translate_llm_baseurl: '',
    translate_llm_key: '',
    translate_llm_prompt: '',
    edit_llm_model: '',
    edit_llm_baseurl: '',
    edit_llm_key: '',
    edit_llm_prompt: '',
    create_llm_model: '',
    create_llm_baseurl: '',
    create_llm_key: '',
    create_llm_prompt: '',
    feishu_app_id: '',
    feishu_app_secret: '',
    feishu_space_id: '',
    feishu_parent_node_token: '',
    blacklist_keywords: '广告,推广,招聘,求职,理财,股票推荐,二手,促销,折扣'
  };

  const insertConfig = db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultConfig)) {
    insertConfig.run(key, value);
  }

  const { count } = db.prepare('SELECT COUNT(*) as count FROM sources').get();
  if (count === 0) {
    const ins = db.prepare(
      'INSERT INTO sources (name, type, url, enabled, fetch_limit, translate) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const defaults = [
      ['微博-农用无人机', 'rsshub', '/weibo/search/keyword/农用无人机', 1, 15, 0],
      ['微博-农业机器人', 'rsshub', '/weibo/search/keyword/农业机器人', 1, 15, 0],
      ['微博-农用无人车', 'rsshub', '/weibo/search/keyword/农用无人车', 1, 15, 0],
      ['AgFunder News', 'rss', 'https://agfundernews.com/feed/', 1, 20, 1],
      ['The Robot Report', 'rss', 'https://www.therobotreport.com/category/agriculture/feed/', 1, 20, 1],
      ['Precision Ag Today', 'rss', 'https://www.precisionag.com/feed/', 1, 20, 1],
      ['AgriTech Tomorrow', 'rss', 'https://www.agritechtomorrow.com/rss.asp', 1, 20, 1],
      ['AUVSI News', 'rss', 'https://www.auvsi.org/rss.xml', 1, 20, 1],
      ['Future Farming', 'rss', 'https://www.futurefarming.com/rss', 1, 20, 1],
    ];
    for (const row of defaults) ins.run(...row);
  }

  console.log('Database initialized at', DB_PATH);
  return db;
}

module.exports = { getDB, initDB };
