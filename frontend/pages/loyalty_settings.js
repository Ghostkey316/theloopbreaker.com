async function loadConfig() {
  const res = await fetch('/config').catch(() => null);
  if (!res || !res.ok) return {};
  try { return await res.json(); } catch { return {}; }
}

async function updateConfig(data) {
  await fetch('/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

function bindToggle(id, key) {
  const el = document.getElementById(id);
  el.addEventListener('change', () => {
    const payload = {}; payload[key] = el.checked; updateConfig(payload);
  });
}

async function init() {
  const cfg = await loadConfig();
  document.getElementById('weeklyToggle').checked = !!cfg.weekly_drops_enabled;
  document.getElementById('boostToggle').checked = !!cfg.multiplier_boosts_enabled;
  document.getElementById('streakToggle').checked = !!cfg.belief_streaks_enabled;
  bindToggle('weeklyToggle', 'weekly_drops_enabled');
  bindToggle('boostToggle', 'multiplier_boosts_enabled');
  bindToggle('streakToggle', 'belief_streaks_enabled');
}

init();
