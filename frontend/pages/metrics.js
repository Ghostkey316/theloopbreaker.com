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

function renderTable(dashboard) {
  const table = document.getElementById('cohortTable');
  if (!table || !dashboard || !Array.isArray(dashboard.cohorts)) return;
  const header = `
    <tr>
      <th>Segment</th>
      <th>Active Wallets</th>
      <th>Mission Completion</th>
      <th>Retention Day 30</th>
      <th>Belief Alignment</th>
      <th>ROI Multiplier</th>
    </tr>
  `;
  const rows = dashboard.cohorts.map(cohort => `
    <tr>
      <td>${cohort.segment.replace(/_/g, ' ')}</td>
      <td>${cohort.active_wallets.toLocaleString()}</td>
      <td>${(cohort.mission_completion_pct * 100).toFixed(1)}%</td>
      <td>${(cohort.retention_day_30 * 100).toFixed(1)}%</td>
      <td>${cohort.belief_alignment_score}</td>
      <td>${cohort.roi_multiplier.toFixed(2)}x</td>
    </tr>
  `).join('');
  table.innerHTML = header + rows;
}

function renderChart(chart) {
  const container = document.getElementById('chartData');
  if (!container || !chart) return;
  container.innerHTML = '';
  const title = document.createElement('strong');
  title.textContent = chart.title;
  container.appendChild(title);
  const list = document.createElement('pre');
  list.textContent = JSON.stringify(chart.series, null, 2);
  container.appendChild(list);
}

async function init() {
  const dashboard = await loadJSON('../../dashboards/adoption_mission_dashboard.json');
  renderTable(dashboard);

  const chart = await loadJSON('../../charts/adoption_vs_mission.json');
  renderChart(chart);

  const roi = await loadText('../../docs/loyalty_engine_roi_model.md');
  const pre = document.getElementById('roiMarkdown');
  if (pre) pre.textContent = roi;
}

init();
