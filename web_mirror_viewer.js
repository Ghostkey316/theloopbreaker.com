const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'embed_config.json');

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { width: 600, height: 400 };
  }
}

function createIframe(url) {
  const cfg = loadConfig();
  const w = cfg.width || 600;
  const h = cfg.height || 400;
  return `<iframe src="${url}" width="${w}" height="${h}" frameborder="0" allowfullscreen></iframe>`;
}

module.exports = { createIframe, loadConfig };
