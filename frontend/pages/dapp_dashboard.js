// Reference: ethics/core.mdx
async function loadJSON(path) {
  const res = await fetch(path).catch(() => null);
  if (!res || !res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function loadLeaderboard() {
  return loadJSON('../../dashboards/loyalty_ranks.json') || [];
}

async function loadScorecard() {
  return loadJSON('../../user_scorecard.json') || {};
}

async function loadLedger() {
  return loadJSON('../../logs/token_ledger.json') || [];
}

async function loadPartners() {
  return loadJSON('../../partners.json') || [];
}

function displayLeaderboard(rows) {
  const tbody = document.querySelector('#leaderboard tbody');
  tbody.innerHTML = '';
  (rows || []).forEach(r => {
    const tr = document.createElement('tr');
    const user = document.createElement('td');
    user.textContent = r.user_id || r.user || 'unknown';
    const score = document.createElement('td');
    score.textContent = r.score || 0;
    tr.appendChild(user);
    tr.appendChild(score);
    tbody.appendChild(tr);
  });
}

function ethicsScore(card) {
  const q = card.alignment_score || 0;
  const b = card.trust_behavior || 0;
  const t = card.trust_bonus || 0;
  return Math.round((q * 0.4 + b * 0.4 + t * 0.2) * 100) / 100;
}

function displayEthicsScores(data) {
  const tbody = document.querySelector('#ethics tbody');
  tbody.innerHTML = '';
  Object.entries(data || {}).forEach(([user, card]) => {
    const tr = document.createElement('tr');
    const u = document.createElement('td');
    u.textContent = user;
    const s = document.createElement('td');
    s.textContent = ethicsScore(card);
    tr.appendChild(u);
    tr.appendChild(s);
    tbody.appendChild(tr);
  });
}

function displayLedger(rows) {
  const container = document.getElementById('ledger');
  container.innerHTML = '';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Wallet</th><th>Token</th><th>Amount</th></tr>';
  const tbody = document.createElement('tbody');
  (rows || []).forEach(r => {
    const tr = document.createElement('tr');
    ['wallet', 'token', 'amount'].forEach(k => {
      const td = document.createElement('td');
      td.textContent = r[k] || '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

function updateVoteDisplay(id) {
  const span = document.querySelector(`#vote-${id}`);
  if (!span) return;
  const votes = JSON.parse(localStorage.getItem('votes') || '{}');
  const count = votes[id] || 0;
  span.textContent = count;
}

function displayPartners(list) {
  const container = document.getElementById('proposalList');
  container.innerHTML = '';
  (list || []).forEach(p => {
    const div = document.createElement('div');
    div.textContent = `${p.partner_id} [${p.wallet}]`;
    const up = document.createElement('span');
    up.textContent = '▲';
    up.className = 'vote';
    up.addEventListener('click', () => {
      const votes = JSON.parse(localStorage.getItem('votes') || '{}');
      votes[p.partner_id] = (votes[p.partner_id] || 0) + 1;
      localStorage.setItem('votes', JSON.stringify(votes));
      updateVoteDisplay(p.partner_id);
    });
    const score = document.createElement('span');
    score.id = `vote-${p.partner_id}`;
    score.textContent = '0';
    div.appendChild(up);
    div.appendChild(score);
    container.appendChild(div);
    updateVoteDisplay(p.partner_id);
  });
}

async function init() {
  const lb = await loadLeaderboard();
  displayLeaderboard(lb);

  const sc = await loadScorecard();
  displayEthicsScores(sc);

  const ledgerData = await loadLedger();
  displayLedger(ledgerData);

  const partners = await loadPartners();
  displayPartners(partners);
}

document.getElementById('revealLedger').addEventListener('click', () => {
  document.getElementById('ledger').classList.add('visible');
});

document.getElementById('addPartner').addEventListener('click', () => {
  const pid = document.getElementById('newPartnerId').value.trim();
  const wallet = document.getElementById('newPartnerWallet').value.trim();
  if (!pid || !wallet) return;
  const item = { partner_id: pid, wallet: wallet };
  const container = document.getElementById('proposalList');
  const div = document.createElement('div');
  div.textContent = `${pid} [${wallet}]`;
  const up = document.createElement('span');
  up.textContent = '▲';
  up.className = 'vote';
  up.addEventListener('click', () => {
    const votes = JSON.parse(localStorage.getItem('votes') || '{}');
    votes[pid] = (votes[pid] || 0) + 1;
    localStorage.setItem('votes', JSON.stringify(votes));
    updateVoteDisplay(pid);
  });
  const score = document.createElement('span');
  score.id = `vote-${pid}`;
  score.textContent = '0';
  div.appendChild(up);
  div.appendChild(score);
  container.appendChild(div);
  updateVoteDisplay(pid);
});

document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('theme-dark');
});

init();
