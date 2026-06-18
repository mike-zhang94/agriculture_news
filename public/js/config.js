const CONFIG_KEYS = [
  'rsshub_base_url',
  'translate_llm_model', 'translate_llm_baseurl', 'translate_llm_key', 'translate_llm_prompt',
  'edit_llm_model', 'edit_llm_baseurl', 'edit_llm_key', 'edit_llm_prompt',
  'create_llm_model', 'create_llm_baseurl', 'create_llm_key', 'create_llm_prompt',
  'feishu_app_id', 'feishu_app_secret', 'feishu_space_id', 'feishu_parent_node_token',
  'blacklist_keywords'
];

window.addEventListener('load', loadConfig);

async function loadConfig() {
  const res = await API.get('/api/config');
  if (!res.success) { showToast('配置加载失败: ' + res.error, 'error'); return; }
  const cfg = res.data;
  CONFIG_KEYS.forEach(k => {
    const el = document.getElementById(k);
    if (el) el.value = cfg[k] || '';
  });
}

async function saveConfig() {
  const payload = {};
  CONFIG_KEYS.forEach(k => {
    const el = document.getElementById(k);
    if (el) payload[k] = el.value.trim();
  });

  const res = await API.put('/api/config', payload);
  if (res.success) {
    showToast('配置已保存', 'success');
  } else {
    showToast('保存失败: ' + res.error, 'error');
  }
}
