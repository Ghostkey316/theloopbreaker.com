async function loadJSON(path) {
  const res = await fetch(path).catch(() => null);
  if (!res || !res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function loadIdentity() {
  return loadJSON('../../dashboards/contributor_snapshot.json');
}

async function loadValues() {
  return loadJSON('../../vaultfire-core/ghostkey_values.json');
}

function displayIdentity(data) {
  const pre = document.getElementById('identityData');
  pre.textContent = JSON.stringify(data, null, 2);
}

function displayValues(data) {
  const list = document.getElementById('valueList');
  list.innerHTML = '';
  if (!data) return;
  const keys = ['truth_over_hype','loyalty_over_trend','service_over_status'];
  keys.forEach(k => {
    if (data[k]) {
      const li = document.createElement('li');
      li.className = 'value';
      li.textContent = data[k];
      list.appendChild(li);
    }
  });
  const info = document.getElementById('loyaltyInfo');
  if (data.loyalty_multipliers) {
    info.textContent = JSON.stringify(data.loyalty_multipliers, null, 2);
  }
}

async function init() {
  const id = await loadIdentity();
  displayIdentity(id);
  const values = await loadValues();
  displayValues(values);
}

init();

document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('theme-dark');
});
