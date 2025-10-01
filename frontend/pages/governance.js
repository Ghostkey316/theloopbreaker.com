async function loadJSON(path) {
  const res = await fetch(path).catch(() => null);
  if (!res || !res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function loadText(path) {
  const res = await fetch(path).catch(() => null);
  if (!res || !res.ok) return '';
  return res.text();
}

function renderStats(dashboard) {
  const container = document.getElementById('governanceStats');
  if (!container || !dashboard || !Array.isArray(dashboard.cohorts)) return;
  container.innerHTML = '';
  dashboard.cohorts.forEach(cohort => {
    const card = document.createElement('div');
    card.className = 'card';
    const title = document.createElement('h3');
    title.textContent = cohort.segment.replace(/_/g, ' ').toUpperCase();
    const list = document.createElement('ul');
    list.innerHTML = `
      <li>Active Wallets: ${cohort.active_wallets.toLocaleString()}</li>
      <li>Mission Completion: ${(cohort.mission_completion_pct * 100).toFixed(1)}%</li>
      <li>Retention Day 30: ${(cohort.retention_day_30 * 100).toFixed(1)}%</li>
      <li>Belief Alignment Score: ${cohort.belief_alignment_score}</li>
    `;
    card.appendChild(title);
    card.appendChild(list);
    container.appendChild(card);
  });
}

async function init() {
  const dashboard = await loadJSON('../../dashboards/adoption_mission_dashboard.json');
  renderStats(dashboard);

  const multisig = await loadText('../../governance/multisig_template.yaml');
  const multisigPre = document.getElementById('multisigYaml');
  if (multisigPre) multisigPre.textContent = multisig;

  const dao = await loadText('../../governance/dao_pathway.md');
  const daoPre = document.getElementById('daoMarkdown');
  if (daoPre) daoPre.textContent = dao;
}

init();
