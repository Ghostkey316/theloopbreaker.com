const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'visual_config.json');

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { engine: 'three', width: 800, height: 600 };
  }
}

function renderModel(record) {
  const cfg = loadConfig();
  const engine = cfg.engine === 'babylon' ? 'babylon' : 'three';
  const meta = [];
  if (record.watermark) meta.push('watermark');
  if (record.timed_reveal) meta.push('timed_reveal');
  if (record.partner_lock) meta.push('partner_lock');
  const overlay = meta.map(m => `<span class="meta">${m}</span>`).join(' ');
  const script = engine === 'babylon'
    ? '<script src="https://cdn.babylonjs.com/babylon.js"></script>'
    : '<script src="https://cdn.jsdelivr.net/npm/three@0.157/build/three.min.js"></script>';
  return [
    script,
    `<canvas id="${record.object_id}" width="${cfg.width}" height="${cfg.height}" data-model="${record.file}"></canvas>`,
    `<div class="overlay">${overlay}</div>`
  ].join('\n');
}

module.exports = { loadConfig, renderModel };
