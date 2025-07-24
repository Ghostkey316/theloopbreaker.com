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

async function init() {
  const data = await loadLineage();
  const toggle = document.getElementById('toggle');
  toggle.addEventListener('change', () => display(data, toggle.checked));
  display(data, false);
}

init();
