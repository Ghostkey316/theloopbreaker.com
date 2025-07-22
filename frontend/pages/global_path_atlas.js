async function loadJSON(path) {
  const res = await fetch(path).catch(() => null);
  if (!res || !res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

function displayAtlas(data) {
  const container = document.getElementById('atlas');
  container.innerHTML = '';
  if (!data) return;
  const groups = {};
  (data.participants || []).forEach(p => {
    const list = groups[p.path] = groups[p.path] || [];
    list.push(p);
  });
  Object.entries(groups).forEach(([path, list]) => {
    const div = document.createElement('div');
    div.className = 'arc';
    const h = document.createElement('h3');
    h.textContent = path;
    div.appendChild(h);
    list.forEach(u => {
      const d = document.createElement('div');
      d.className = 'participant';
      d.textContent = u.user;
      d.addEventListener('click', () => connectTo(u.user));
      div.appendChild(d);
    });
    container.appendChild(div);
  });
}

function connectTo(user) {
  const box = document.getElementById('connect');
  box.textContent = `Connect with ${user} to co-build a mission.`;
}

async function init() {
  const data = await loadJSON('../../dashboards/path_atlas.json');
  displayAtlas(data);
}

init();
