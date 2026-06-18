const Parser = require('rss-parser');
const axios = require('axios');
const { getDB } = require('../db');

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'AgriTechNews/1.0' },
  customFields: { item: ['description', 'content:encoded', 'summary'] }
});

function generateId(link, title) {
  const str = link || title || Date.now().toString();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return Math.abs(hash).toString(36) + str.length.toString(36);
}

function stripHTML(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 8000);
}

async function fetchArticleContent(url) {
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      },
      maxContentLength: 2000000,
      responseType: 'text'
    });
    const text = stripHTML(String(res.data || ''));
    // 跳过页面前段可能的导航/菜单文字（通常正文在靠后位置），取最信息密集的部分
    return text.slice(0, 6000);
  } catch {
    return '';
  }
}

function getConfig() {
  const db = getDB();
  const rows = db.prepare('SELECT key, value FROM config').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function isBlocked(text, blacklist) {
  if (!blacklist) return false;
  const keywords = blacklist.split(',').map(k => k.trim()).filter(Boolean);
  const lower = (text || '').toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

async function fetchSource(source) {
  const cfg = getConfig();
  const rsshubBase = cfg.rsshub_base_url || process.env.RSSHUB_BASE_URL || 'http://localhost:1200';
  const blacklist = cfg.blacklist_keywords || '';

  const url = source.type === 'rsshub'
    ? encodeURI(`${rsshubBase}${source.url}`) + (source.url.includes('?') ? '&' : '?') + `limit=${source.fetch_limit || 20}`
    : source.url;

  let feed;
  try {
    feed = await parser.parseURL(url);
  } catch (err) {
    console.error(`[RSS] Failed to fetch "${source.name}": ${err.message}`);
    if (/Status code (403|404)/i.test(err.message)) {
      try {
        getDB().prepare('UPDATE sources SET enabled = 0 WHERE id = ?').run(source.id);
        console.log(`[RSS] Auto-disabled "${source.name}" (permanent HTTP error)`);
      } catch (_) {}
      return { source, items: [], error: `${source.name} 访问失败（${err.message.match(/\d{3}/)?.[0]}），已自动关闭此信源` };
    }
    return { source, items: [], error: err.message };
  }

  const rawItems = await Promise.all(
    (feed.items || [])
      .slice(0, source.fetch_limit || 20)
      .map(async item => {
        const title = item.title || '';
        let description = stripHTML(item['content:encoded'] || item.description || item.summary || item.contentSnippet || '');
        const link = item.link || item.guid || '';
        const pubDate = item.pubDate || item.isoDate || '';

        // 若 RSS 只提供短摘要，自动抓取原文补充内容
        if (description.length < 300 && link) {
          const fetched = await fetchArticleContent(link);
          if (fetched.length > description.length) description = fetched;
        }

        return { id: generateId(link, title), title, description, link, pubDate };
      })
  );
  const items = rawItems.filter(item => item.title && !isBlocked(`${item.title} ${item.description}`, blacklist));

  return { source, items, error: null };
}

async function fetchAllSources() {
  const db = getDB();
  const sources = db.prepare('SELECT * FROM sources WHERE enabled = 1').all();
  const results = await Promise.allSettled(sources.map(s => fetchSource(s)));

  const allResults = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      allResults.push(results[i].value);
    } else {
      allResults.push({ source: sources[i], items: [], error: results[i].reason.message });
    }
  }
  return allResults;
}

module.exports = { fetchSource, fetchAllSources };
