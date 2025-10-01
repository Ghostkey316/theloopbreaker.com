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

function renderTimeline(timeline) {
  const container = document.getElementById('auditTimeline');
  if (!container || !Array.isArray(timeline)) return;
  container.innerHTML = '';
  timeline.forEach(item => {
    const block = document.createElement('div');
    const span = document.createElement('span');
    span.textContent = `${item.date} — ${item.partner}`;
    const p = document.createElement('p');
    p.textContent = item.summary;
    block.appendChild(span);
    block.appendChild(p);
    container.appendChild(block);
  });
}

function renderTelemetryList(paths) {
  const pre = document.getElementById('telemetryList');
  if (!pre) return;
  pre.textContent = paths.map(p => `- ${p.name}: ${p.path}`).join('\n');
}

async function init() {
  const dashboard = await loadJSON('../../dashboards/adoption_mission_dashboard.json');
  if (dashboard && dashboard.cohorts) {
    const timeline = dashboard.cohorts.map(cohort => ({
      date: dashboard.updated_at.split('T')[0],
      partner: cohort.segment.replace(/_/g, ' ').toUpperCase(),
      summary: `Wallets: ${cohort.active_wallets.toLocaleString()} · Mission Completion: ${(cohort.mission_completion_pct * 100).toFixed(1)}% · ROI Multiplier: ${cohort.roi_multiplier}`
    }));
    renderTimeline(timeline);
  }

  renderTelemetryList([
    { name: 'Wallet Activity Baseline', path: '../../telemetry/templates/wallet_activity_baseline.yaml' },
    { name: 'XP Yield Baseline', path: '../../telemetry/templates/xp_yield_baseline.yaml' },
    { name: 'Retention Baseline', path: '../../telemetry/templates/retention_baseline.yaml' }
  ]);

  const attestations = await loadText('../../docs/attestations/attestation_requests.md');
  const pre = document.getElementById('attestationMarkdown');
  if (pre) pre.textContent = attestations;
}

init();
