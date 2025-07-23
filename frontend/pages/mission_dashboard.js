// Reference: ethics/core.mdx
async function loadMissions() {
  const res = await fetch('../../logs/daily_missions.json').catch(() => null);
  if (!res || !res.ok) return {};
  try { return await res.json(); } catch { return {}; }
}

async function loadPoints() {
  const res = await fetch('../../logs/vault_points.json').catch(() => null);
  if (!res || !res.ok) return {};
  try { return await res.json(); } catch { return {}; }
}

function displayMissions(data) {
  const tbody = document.querySelector('#missionTable tbody');
  tbody.innerHTML = '';
  Object.entries(data || {}).forEach(([user, info]) => {
    const tr = document.createElement('tr');
    const u = document.createElement('td');
    u.textContent = user;
    const m = document.createElement('td');
    m.textContent = (info.mission || '').slice(0, 80);
    tr.appendChild(u);
    tr.appendChild(m);
    tbody.appendChild(tr);
  });
}

function displayPoints(data) {
  const tbody = document.querySelector('#pointsTable tbody');
  tbody.innerHTML = '';
  Object.entries(data || {}).forEach(([user, domains]) => {
    const tr = document.createElement('tr');
    const u = document.createElement('td');
    u.textContent = user;
    const t = document.createElement('td');
    const total = Object.values(domains || {}).reduce((a, b) => a + b, 0);
    t.textContent = total;
    tr.appendChild(u);
    tr.appendChild(t);
    tbody.appendChild(tr);
  });
}

async function init() {
  const missions = await loadMissions();
  displayMissions(missions);
  const points = await loadPoints();
  displayPoints(points);
}

document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('theme-dark');
});

init();
