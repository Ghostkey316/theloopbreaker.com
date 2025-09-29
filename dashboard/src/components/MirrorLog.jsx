import React from 'react';

export default function MirrorLog({ logs }) {
  const latest = logs.slice(-8).reverse();

  return (
    <section className="panel mirror-log">
      <header>
        <h2>Mirror Reflection Log</h2>
        <p className="subtitle">Hourly AI resonance of belief signals</p>
      </header>
      <ul className="log-list">
        {latest.length ? (
          latest.map((entry) => (
            <li key={`${entry.wallet}-${entry.timestamp}`}>
              <div className="log-primary">
                <span className="log-wallet">{entry.ens || entry.wallet}</span>
                <span className={`tier-tag tier-${(entry.tier || 'observer').toLowerCase()}`}>
                  {entry.tier}
                </span>
              </div>
              <div className="log-secondary">
                <span>{entry.type}</span>
                <span>×{entry.multiplier.toFixed(4)}</span>
                <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
              </div>
            </li>
          ))
        ) : (
          <li>No mirror reflections captured yet.</li>
        )}
      </ul>
    </section>
  );
}
