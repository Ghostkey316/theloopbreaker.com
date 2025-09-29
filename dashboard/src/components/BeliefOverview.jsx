import React from 'react';

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'unknown';
  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) {
    return 'unknown';
  }
  const diff = Date.now() - value;
  if (diff < 0) {
    return 'in the future';
  }
  const minutes = Math.floor(diff / 60000);
  if (minutes <= 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function BeliefOverview({ session, summary }) {
  const beliefScore = summary?.beliefScore ?? 1;
  const networkTier = summary?.tier || 'Observer';

  return (
    <section className="panel overview">
      <header className="overview-header">
        <div>
          <h1>Vaultfire Dashboard v1</h1>
          <p className="subtitle">Identity is belief. Wallet is passport.</p>
        </div>
        <div className="identity-block">
          <span className="identity-label">{session.ens || session.wallet}</span>
          <span className={`tier-tag tier-${(session.tier || 'observer').toLowerCase()}`}>
            {session.tier}
          </span>
        </div>
      </header>
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="label">Personal Multiplier</span>
          <span className="value">{session.multiplier.toFixed(4)}</span>
          <span className="hint">Last sync {formatRelativeTime(session.lastSync)}</span>
        </div>
        <div className="metric-card">
          <span className="label">Belief Tier</span>
          <span className="value">{session.tier}</span>
          <span className="hint">Network tier {networkTier}</span>
        </div>
        <div className="metric-card">
          <span className="label">Network Belief Score</span>
          <span className="value">{beliefScore.toFixed(4)}</span>
          <span className="hint">{summary?.totalPartners || 0} aligned partners</span>
        </div>
        <div className="metric-card">
          <span className="label">Sync Health</span>
          <span className="value">{summary?.healthyPartners || 0}</span>
          <span className="hint">Healthy partners in orbit</span>
        </div>
      </div>
    </section>
  );
}
