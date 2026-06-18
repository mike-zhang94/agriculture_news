const axios = require('axios');
const { getDB } = require('../db');

const FEISHU_BASE = 'https://open.feishu.cn/open-apis';
let tokenCache = { token: '', expireAt: 0 };

async function getAccessToken(appId, appSecret) {
  if (tokenCache.token && Date.now() < tokenCache.expireAt - 60000) {
    return tokenCache.token;
  }
  const res = await axios.post(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
    app_id: appId,
    app_secret: appSecret
  });
  if (res.data.code !== 0) throw new Error(`飞书授权失败: ${res.data.msg}`);
  tokenCache = {
    token: res.data.tenant_access_token,
    expireAt: Date.now() + res.data.expire * 1000
  };
  return tokenCache.token;
}

async function getOrCreateDailyDoc(date, token, spaceId, parentNodeToken) {
  const db = getDB();
  const existing = db.prepare('SELECT node_token FROM feishu_docs WHERE date = ?').get(date);
  if (existing) return existing.node_token;

  const res = await axios.post(
    `${FEISHU_BASE}/wiki/v2/spaces/${spaceId}/nodes`,
    {
      node_type: 'origin',
      obj_type: 'docx',
      parent_node_token: parentNodeToken,
      title: `${date} 农机行业通`
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  if (res.data.code !== 0) throw new Error(`创建飞书文档失败: ${res.data.msg}`);
  const nodeToken = res.data.data.node.node_token;
  db.prepare('INSERT OR REPLACE INTO feishu_docs (date, node_token) VALUES (?, ?)').run(date, nodeToken);
  return nodeToken;
}

async function convertMarkdown(markdown, token) {
  const res = await axios.post(
    `${FEISHU_BASE}/docx/v1/documents/blocks/convert`,
    { content: markdown, content_type: 'markdown' },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  if (res.data.code !== 0) throw new Error(`Markdown转换失败: ${res.data.msg}`);
  return {
    blocks: res.data.data.blocks,
    firstLevelIds: res.data.data.first_level_block_ids
  };
}

async function appendBlocksToDoc(docNodeToken, blocks, childrenIds, token) {
  const res = await axios.post(
    `${FEISHU_BASE}/docx/v1/documents/${docNodeToken}/blocks/${docNodeToken}/descendant?document_revision_id=-1`,
    { index: 0, children_id: childrenIds, descendants: blocks },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' } }
  );
  if (res.data.code !== 0) throw new Error(`写入文档失败: ${res.data.msg}`);
  return res.data;
}

async function sendToFeishu(newsTitle, newsSummary, newsLink) {
  const db = getDB();
  const cfg = Object.fromEntries(db.prepare('SELECT key, value FROM config').all().map(r => [r.key, r.value]));

  const { feishu_app_id, feishu_app_secret, feishu_space_id, feishu_parent_node_token } = cfg;
  if (!feishu_app_id || !feishu_app_secret || !feishu_space_id || !feishu_parent_node_token) {
    throw new Error('飞书配置不完整，请前往系统配置页面完成设置');
  }

  const token = await getAccessToken(feishu_app_id, feishu_app_secret);
  const today = new Date().toISOString().split('T')[0];
  const docNodeToken = await getOrCreateDailyDoc(today, token, feishu_space_id, feishu_parent_node_token);

  const markdown = `### ${newsTitle}\n> ${newsSummary}\n- 资讯链接：${newsLink}`;
  const { blocks, firstLevelIds } = await convertMarkdown(markdown, token);
  await appendBlocksToDoc(docNodeToken, blocks, firstLevelIds, token);

  return { docNodeToken, today };
}

module.exports = { sendToFeishu };
