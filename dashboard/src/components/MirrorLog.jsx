import React, { useEffect, useMemo, useState } from 'react';
import EnsResolverModal from './EnsResolverModal.jsx';

export default function MirrorLog({ logs }) {
  const [query, setQuery] = useState('');
  const [activeIdentity, setActiveIdentity] = useState(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia('(max-width: 768px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return () => {};
    }
    const media = window.matchMedia('(max-width: 768px)');
    const listener = (event) => setIsMobile(event.matches);
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      media.addListener(listener);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, []);

  const filteredLogs = useMemo(() => {
    const recent = [...logs].slice(-50).reverse();
    if (!query) {
      return recent;
    }
    const normalized = query.toLowerCase();
    return recent.filter((entry) => {
      const haystack = `${entry.wallet || ''} ${entry.ens || ''} ${entry.type || ''}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [logs, query]);

  const visibleEntries = useMemo(
    () => filteredLogs.slice(0, isMobile ? 12 : 20),
    [filteredLogs, isMobile]
  );

  return (
    <section className={`panel mirror-log ${isMobile ? 'mirror-log--mobile' : ''}`}>
      <header>
        <div>
          <h2>Mirror Reflection Log</h2>
          <p className="subtitle">Hourly AI resonance of belief signals</p>
        </div>
        <div className="mirror-log__controls">
          <input
            className="mirror-log__search"
            type="search"
            value={query}
            placeholder="Search wallet / ENS / type"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </header>
      <div className="mirror-log__viewport">
        <ul className="log-list">
          {visibleEntries.length ? (
            visibleEntries.map((entry) => (
              <li key={`${entry.wallet}-${entry.timestamp}`} className="log-item">
                <div className="log-primary">
                  <button
                    type="button"
                    className="log-wallet"
                    onClick={() => setActiveIdentity({ wallet: entry.wallet, ens: entry.ens })}
                  >
                    {entry.ens || entry.wallet}
                  </button>
                  <span className={`tier-tag tier-${(entry.tier || 'observer').toLowerCase()}`}>
                    {entry.tier}
                  </span>
                </div>
                <div className="log-secondary">
                  <span className="log-type">{entry.type}</span>
                  <span className="log-multiplier">×{entry.multiplier.toFixed(4)}</span>
                  <span className="log-timestamp">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
              </li>
            ))
          ) : (
            <li>No mirror reflections captured yet.</li>
          )}
        </ul>
      </div>
      <EnsResolverModal identity={activeIdentity} onClose={() => setActiveIdentity(null)} />
    </section>
  );
}
