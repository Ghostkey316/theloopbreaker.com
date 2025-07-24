async function loadLineage() {
  const res = await fetch('../../.vaultfire/core/ethics.json').catch(() => null);
  if (!res || !res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

function display(data, visible) {
  const pre = document.getElementById('lineage');
  if (!data) { pre.textContent = 'Unavailable'; return; }
  pre.textContent = visible ? JSON.stringify(data, null, 2) : 'Attribution cloaked';
}

function displayNoise(data, visible) {
  const pre = document.getElementById('noiseLog');
  if (!data) { pre.textContent = 'Unavailable'; return; }
  pre.textContent = visible ? JSON.stringify(data, null, 2) : 'Noise suppressed';
}

async function loadNoise() {
  const res = await fetch('../../dashboards/signal_filtered.json').catch(() => null);
  if (!res || !res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function init() {
  const data = await loadLineage();
  const noise = await loadNoise();
  const toggle = document.getElementById('toggle');
  const vision = document.getElementById('visionToggle');
  toggle.addEventListener('change', () => display(data, toggle.checked));
  vision.addEventListener('change', () => displayNoise(noise, vision.checked));
  display(data, false);
  displayNoise(noise, false);
}

init();
