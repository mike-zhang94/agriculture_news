const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3737;

// Init DB and required directories
initDB();
['uploads', 'public/renders', 'data'].forEach(d => fs.mkdirSync(d, { recursive: true }));

// Allow env var to override rsshub_base_url (used in Docker deployment)
if (process.env.RSSHUB_BASE_URL) {
  const { getDB } = require('./db');
  getDB().prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('rsshub_base_url', process.env.RSSHUB_BASE_URL);
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/sources', require('./routes/sources'));
app.use('/api/news', require('./routes/news'));
app.use('/api/config', require('./routes/config'));
app.use('/api/ainews', require('./routes/ainews'));
app.use('/api/makecontent', require('./routes/makecontent'));
app.use('/api/render', require('./routes/render'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n农机行业通 is running → http://localhost:${PORT}\n`);
});
