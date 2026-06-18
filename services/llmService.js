const axios = require('axios');
const { getDB } = require('../db');

function getConfig() {
  const db = getDB();
  const rows = db.prepare('SELECT key, value FROM config').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

function buildClient(baseurl, key) {
  return axios.create({
    baseURL: baseurl.replace(/\/$/, ''),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    timeout: 60000
  });
}

async function callLLM(client, model, systemPrompt, userContent, jsonMode = false) {
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ]
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await client.post('/chat/completions', body);
  return res.data.choices[0].message.content.trim();
}

async function translateText(text) {
  const cfg = getConfig();
  const baseurl = cfg.translate_llm_baseurl || cfg.edit_llm_baseurl || cfg.create_llm_baseurl;
  const key = cfg.translate_llm_key || cfg.edit_llm_key || cfg.create_llm_key;
  const model = cfg.translate_llm_model || cfg.edit_llm_model || cfg.create_llm_model;

  if (!baseurl || !key || !model) throw new Error('翻译模型未配置，请前往系统配置页面完成设置');

  const systemPrompt = cfg.translate_llm_prompt ||
    '你是一名专业翻译。请将以下文本翻译成中文，保持原意，简洁准确。直接输出翻译结果，不要添加任何解释。';

  const client = buildClient(baseurl, key);
  return callLLM(client, model, systemPrompt, text);
}

async function editNews(title, description) {
  const cfg = getConfig();
  const baseurl = cfg.edit_llm_baseurl || cfg.translate_llm_baseurl || cfg.create_llm_baseurl;
  const key = cfg.edit_llm_key || cfg.translate_llm_key || cfg.create_llm_key;
  const model = cfg.edit_llm_model || cfg.translate_llm_model || cfg.create_llm_model;

  if (!baseurl || !key || !model) throw new Error('编辑模型未配置，请前往系统配置页面完成设置');

  const systemPrompt = cfg.edit_llm_prompt ||
    '你是一名专注于农业科技的资讯编辑，擅长农用无人机、农用无人车和农业机器人领域。请将输入内容（可能为英文）翻译并分析，以JSON格式输出两个字段：title（中文标题，简洁精炼，不超过25字）、summary（完整中文译文，忠实还原原文全部信息，不得省略或压缩，长度不限）。只输出JSON，不要其他内容。';

  const client = buildClient(baseurl, key);
  const userContent = `标题：${title}\n\n内容：${description}`;
  const raw = await callLLM(client, model, systemPrompt, userContent, true);

  try {
    const parsed = JSON.parse(raw);
    return {
      title: parsed.title || title,
      summary: parsed.summary || description,
      reason: parsed.reason || ''
    };
  } catch {
    const extract = (field) => { const m = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`)); return m ? m[1] : ''; };
    return {
      title: extract('title') || title,
      summary: extract('summary') || description,
      reason: extract('reason') || ''
    };
  }
}

async function generateContent(title, description, supplementary) {
  const cfg = getConfig();
  const baseurl = cfg.create_llm_baseurl || cfg.edit_llm_baseurl || cfg.translate_llm_baseurl;
  const key = cfg.create_llm_key || cfg.edit_llm_key || cfg.translate_llm_key;
  const model = cfg.create_llm_model || cfg.edit_llm_model || cfg.translate_llm_model;

  if (!baseurl || !key || !model) throw new Error('创作模型未配置，请前往系统配置页面完成设置');

  const systemPrompt = cfg.create_llm_prompt ||
    '你是一名专注于农业科技领域的内容创作者，擅长创作关于农用无人机、农用无人车和农业机器人的深度内容。请根据提供的资讯，创作适合社交媒体（小红书风格）的内容。以JSON格式输出以下字段：cover_word（一个概括性英文单词）、cover_title（主标题，不超过15字）、cover_description（描述性文本，不超过20字）、cover_emoji（一个相关emoji）、title（内容标题，不超过20字）、content（内容正文，关于该资讯的深度论述，500-800字）。只输出JSON，不要其他内容。';

  const client = buildClient(baseurl, key);
  const userContent = `资讯标题：${title}\n\n资讯内容：${description}${supplementary ? `\n\n补充信息：${supplementary}` : ''}`;
  const raw = await callLLM(client, model, systemPrompt, userContent, true);

  try {
    return JSON.parse(raw);
  } catch {
    const extract = (field) => {
      const m = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`));
      return m ? m[1] : '';
    };
    return {
      cover_word: extract('cover_word') || 'Agriculture',
      cover_title: extract('cover_title') || title.slice(0, 15),
      cover_description: extract('cover_description') || '',
      cover_emoji: extract('cover_emoji') || '🌾',
      title: extract('title') || title,
      content: extract('content') || description
    };
  }
}

module.exports = { translateText, editNews, generateContent };
