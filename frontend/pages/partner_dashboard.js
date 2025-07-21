async function loadDashboard() {
  const res = await fetch('../../dashboards/partner_earnings.json').catch(() => null);
  if (!res || !res.ok) return [];
  try { return await res.json(); } catch { return []; }
}

function displayTable(data) {
  const tbody = document.querySelector('#earningsTable tbody');
  tbody.innerHTML = '';
  (data || []).forEach(row => {
    const tr = document.createElement('tr');
    const wallet = document.createElement('td');
    wallet.textContent = row.wallet;
    const earnings = document.createElement('td');
    const parts = [];
    if (row.totals) {
      for (const [token, amt] of Object.entries(row.totals)) {
        parts.push(`${amt} ${token}`);
      }
    }
    earnings.textContent = parts.join(', ');
    const last = document.createElement('td');
    last.textContent = row.last_payment || '';
    tr.appendChild(wallet);
    tr.appendChild(earnings);
    tr.appendChild(last);
    tbody.appendChild(tr);
  });
}

async function init() {
  const data = await loadDashboard();
  displayTable(data);
}

document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('theme-dark');
});

init();
