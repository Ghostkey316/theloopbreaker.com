import React, { useEffect, useMemo, useState } from 'react';

const POLL_INTERVAL_MS = 30_000;
const ENS_CACHE = new Map();
const MOBILE_BREAKPOINT = 768;

const styles = {
  container: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  headerCard: {
    background: 'rgba(15, 23, 42, 0.8)',
    borderRadius: '18px',
    color: '#f8fafc',
    padding: '1.25rem',
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.35)',
  },
  summaryRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  summaryTile: {
    flex: '1 1 120px',
    background: 'rgba(30, 41, 59, 0.7)',
    borderRadius: '14px',
    padding: '0.75rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  pill: {
    padding: '0.35rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.85rem',
    background: 'rgba(56, 189, 248, 0.2)',
    color: '#38bdf8',
    width: 'fit-content',
  },
  grid: (isMobile) => ({
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap: '1rem',
  }),
  card: {
    background: 'rgba(15, 23, 42, 0.85)',
    color: '#f1f5f9',
    borderRadius: '18px',
    padding: '1rem',
    minHeight: '220px',
    display: 'flex',
    flexDirection: 'column',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  list: {
    flex: '1 1 auto',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  listItem: {
    background: 'rgba(30, 41, 59, 0.65)',
    borderRadius: '14px',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  input: {
    flex: '1 1 220px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.4)',
    background: 'rgba(15, 23, 42, 0.65)',
    color: '#f8fafc',
    padding: '0.5rem 0.75rem',
  },
  button: {
    borderRadius: '12px',
    border: 'none',
    padding: '0.5rem 1rem',
    background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
    color: '#0f172a',
    fontWeight: 600,
    cursor: 'pointer',
  },
  mutedButton: {
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.4)',
    padding: '0.45rem 1rem',
    background: 'transparent',
    color: '#e2e8f0',
    fontWeight: 500,
    cursor: 'pointer',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    alignItems: 'center',
  },
  validation: (hasIssues) => ({
    borderRadius: '16px',
    padding: '0.75rem 1rem',
    background: hasIssues ? 'rgba(248, 113, 113, 0.15)' : 'rgba(34, 197, 94, 0.15)',
    color: hasIssues ? '#fca5a5' : '#bbf7d0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  }),
  fallbackCard: {
    borderRadius: '16px',
    padding: '0.75rem 1rem',
    background: 'rgba(248, 113, 113, 0.18)',
    color: '#fecaca',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    zIndex: 1000,
  },
  modalCard: {
    background: 'rgba(15, 23, 42, 0.95)',
    borderRadius: '18px',
    padding: '1.25rem',
    maxWidth: '420px',
    width: '100%',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
};

async function fetchStatus(signal) {
  const response = await fetch('/vaultfire/sync-status', { signal });
  if (!response.ok) {
    throw new Error(`Sync status request failed with code ${response.status}`);
  }
  return response.json();
}

async function resolveEns(target) {
  if (!target) {
    return { address: null, name: null, avatar: null };
  }

  const key = target.toLowerCase();
  if (ENS_CACHE.has(key)) {
    return ENS_CACHE.get(key);
  }

  if (typeof fetch !== 'function') {
    const fallback = { address: key, name: null, avatar: null };
    ENS_CACHE.set(key, fallback);
    return fallback;
  }

  try {
    const response = await fetch(`https://api.ensideas.com/ens/resolve/${encodeURIComponent(key)}`);
    if (!response.ok) {
      const fallback = { address: key, name: null, avatar: null };
      ENS_CACHE.set(key, fallback);
      return fallback;
    }
    const data = await response.json();
    const result = {
      address: (data.address || key || '').toLowerCase(),
      name: data.name || null,
      avatar: data.avatar || null,
    };
    ENS_CACHE.set(key, result);
    return result;
  } catch (error) {
    const fallback = { address: key, name: null, avatar: null };
    ENS_CACHE.set(key, fallback);
    return fallback;
  }
}

function hasDisallowedIdentityKeys(record) {
  if (!record || typeof record !== 'object') {
    return false;
  }
  const bannedKeys = ['email', 'name', 'kyc', 'identity', 'userId'];
  return Object.keys(record).some((key) => bannedKeys.includes(key.toLowerCase()));
}

function ensureMetricsShape(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return false;
  }
  const required = ['loyalty', 'ethics', 'frequency', 'alignment', 'holdDuration'];
  return required.every((field) => metrics[field] !== undefined && metrics[field] !== null);
}

function evaluateBeliefRules(status) {
  if (!status) {
    return [];
  }

  const issues = [];
  const partners = Array.isArray(status.partners) ? status.partners : [];
  partners.forEach((partner) => {
    if (!partner.wallet) {
      issues.push({
        scope: 'partner',
        message: 'Partner record missing wallet identity.',
      });
    }
    if (hasDisallowedIdentityKeys(partner)) {
      issues.push({
        scope: 'partner',
        message: 'Partner payload contains disallowed identity metadata.',
      });
    }
    const metrics = partner?.payload?.metrics;
    if (!ensureMetricsShape(metrics)) {
      issues.push({
        scope: 'partner',
        message: `Metrics missing for ${partner.wallet || partner.ens || 'partner record'}.`,
      });
    }
  });

  const logs = Array.isArray(status.mirrorLog) ? status.mirrorLog : [];
  logs.forEach((entry) => {
    if (!ensureMetricsShape(entry.metrics)) {
      issues.push({
        scope: 'telemetry',
        message: `Telemetry entry ${entry.timestamp} missing full metric set.`,
      });
    }
    if (hasDisallowedIdentityKeys(entry)) {
      issues.push({
        scope: 'telemetry',
        message: 'Telemetry entry contains disallowed identity fields.',
      });
    }
  });

  const votes = Array.isArray(status.votes) ? status.votes : [];
  votes.forEach((vote) => {
    if (!vote.wallet) {
      issues.push({ scope: 'votes', message: 'Vote record missing wallet reference.' });
    }
    if (hasDisallowedIdentityKeys(vote)) {
      issues.push({ scope: 'votes', message: 'Vote record contains disallowed identity fields.' });
    }
  });

  return issues;
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return '—';
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString();
}

function EnsModal({ request, onClose }) {
  if (!request) {
    return null;
  }
  return (
    <div style={styles.modalBackdrop} onClick={onClose} role="presentation">
      <div style={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>ENS Resolution</h3>
        {request.loading ? (
          <p>Resolving ENS metadata…</p>
        ) : request.error ? (
          <p style={{ color: '#fecaca' }}>{request.error}</p>
        ) : (
          <>
            <p style={{ fontFamily: 'monospace' }}>{request.address}</p>
            {request.name ? <p>Primary ENS: {request.name}</p> : <p>No ENS record detected.</p>}
            {request.avatar ? (
              <img
                src={request.avatar}
                alt="ENS avatar"
                style={{ width: '96px', height: '96px', borderRadius: '16px' }}
              />
            ) : null}
          </>
        )}
        <button type="button" style={styles.button} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [ensLookup, setEnsLookup] = useState(null);
  const [validationIssues, setValidationIssues] = useState([]);
  const [isMobile, setIsMobile] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : true)
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }
    const handler = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    let timer;
    const controller = new AbortController();

    const loadStatus = async () => {
      try {
        setLoading(true);
        const payload = await fetchStatus(controller.signal);
        setStatus(payload);
        setValidationIssues(evaluateBeliefRules(payload));
        setError('');
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to load belief sync status.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
    timer = setInterval(loadStatus, POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  const partners = useMemo(() => {
    const list = Array.isArray(status?.partners) ? status.partners : [];
    if (!filter) {
      return list;
    }
    const lower = filter.toLowerCase();
    return list.filter((partner) => {
      return (
        partner.wallet?.toLowerCase().includes(lower) ||
        (partner.ens && partner.ens.toLowerCase().includes(lower))
      );
    });
  }, [status, filter]);

  const logs = useMemo(() => {
    const list = Array.isArray(status?.mirrorLog) ? status.mirrorLog : [];
    if (!filter) {
      return list;
    }
    const lower = filter.toLowerCase();
    return list.filter((entry) => {
      return (
        entry.wallet?.toLowerCase().includes(lower) ||
        (entry.ens && entry.ens.toLowerCase().includes(lower))
      );
    });
  }, [status, filter]);

  const summary = status?.summary;
  const validationOk = !validationIssues.length;

  const openEnsModal = async (target) => {
    setEnsLookup({ loading: true });
    try {
      const record = await resolveEns(target);
      setEnsLookup({ loading: false, ...record });
    } catch (err) {
      setEnsLookup({ loading: false, error: err.message });
    }
  };

  const closeEnsModal = () => setEnsLookup(null);

  return (
    <div style={styles.container}>
      <div style={styles.headerCard}>
        <div style={styles.summaryRow}>
          <div style={styles.summaryTile}>
            <span>Belief Score</span>
            <strong style={{ fontSize: '1.35rem' }}>
              {summary?.beliefScore ? summary.beliefScore.toFixed(3) : '—'}
            </strong>
          </div>
          <div style={styles.summaryTile}>
            <span>Active Partners</span>
            <strong style={{ fontSize: '1.35rem' }}>{summary?.totalPartners ?? '—'}</strong>
          </div>
          <div style={styles.summaryTile}>
            <span>Healthy Partners</span>
            <strong style={{ fontSize: '1.35rem' }}>{summary?.healthyPartners ?? '—'}</strong>
          </div>
          <div style={styles.summaryTile}>
            <span>Tier</span>
            <strong style={{ fontSize: '1.35rem' }}>{summary?.tier ?? '—'}</strong>
          </div>
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={styles.validation(!validationOk)}>
            <div style={styles.badgeRow}>
              <span style={styles.pill}>{validationOk ? 'Belief aligned' : 'Validation alerts'}</span>
              {loading ? <span>Checking…</span> : null}
            </div>
            {validationOk ? (
              <p style={{ margin: 0 }}>✅ Belief-Aligned: No digital ID detected. Wallet-native only.</p>
            ) : (
              <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {validationIssues.map((issue, index) => (
                  <li key={`${issue.scope}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            )}
          </div>
          {error ? (
            <div style={styles.fallbackCard}>
              <strong>Mobile sync warning</strong>
              <p style={{ margin: 0 }}>{error}</p>
              <p style={{ margin: 0 }}>
                Retry the request or run <code>node tools/mobile_pr_helper.js --prepare-pr</code> from a trusted
                device to draft the PR manually.
              </p>
              <div style={styles.badgeRow}>
                <button type="button" style={styles.button} onClick={() => window.location.reload()}>
                  Retry
                </button>
                <button
                  type="button"
                  style={styles.mutedButton}
                  onClick={() => openEnsModal(filter || 'vaultfire.eth')}
                >
                  Test ENS Fallback
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div style={styles.toolbar}>
        <input
          style={styles.input}
          value={filter}
          placeholder="Search wallet or ENS"
          onChange={(event) => setFilter(event.target.value)}
        />
        <button type="button" style={styles.mutedButton} onClick={() => openEnsModal(filter)}>
          Resolve ENS
        </button>
        <button type="button" style={styles.mutedButton} onClick={() => setValidationIssues(evaluateBeliefRules(status))}>
          Re-run validation
        </button>
      </div>

      <div style={styles.grid(isMobile)}>
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Partners</h2>
          <div style={styles.list}>
            {loading && !partners.length ? (
              <p>Loading partners…</p>
            ) : partners.length ? (
              partners.map((partner) => (
                <div key={`${partner.wallet}-${partner.lastSync}`} style={styles.listItem}>
                  <div style={styles.badgeRow}>
                    <button
                      type="button"
                      style={styles.mutedButton}
                      onClick={() => openEnsModal(partner.wallet)}
                    >
                      {partner.wallet}
                    </button>
                    {partner.ens ? <span style={styles.pill}>{partner.ens}</span> : null}
                    <span style={styles.pill}>Tier {partner.tier}</span>
                  </div>
                  <span>Multiplier: {partner.multiplier?.toFixed?.(3) ?? partner.multiplier ?? '—'}</span>
                  <span>Last Sync: {formatTimestamp(partner.lastSync)}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', fontSize: '0.85rem' }}>
                    {partner?.payload?.metrics ? (
                      Object.entries(partner.payload.metrics).map(([key, value]) => (
                        <span key={key} style={styles.pill}>
                          {key}: {value}
                        </span>
                      ))
                    ) : (
                      <span>No metrics supplied</span>
                    )}
                  </div>
                  {partner.configOverrides ? (
                    <span style={{ color: '#fcd34d' }}>Scoring override detected</span>
                  ) : null}
                </div>
              ))
            ) : (
              <p>No partners synced yet.</p>
            )}
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Telemetry</h2>
          <div style={styles.list}>
            {loading && !logs.length ? (
              <p>Loading telemetry…</p>
            ) : logs.length ? (
              logs.map((entry) => (
                <div key={`${entry.wallet}-${entry.timestamp}`} style={styles.listItem}>
                  <div style={styles.badgeRow}>
                    <button
                      type="button"
                      style={styles.mutedButton}
                      onClick={() => openEnsModal(entry.wallet)}
                    >
                      {entry.wallet}
                    </button>
                    {entry.ens ? <span style={styles.pill}>{entry.ens}</span> : null}
                    <span style={styles.pill}>{entry.type}</span>
                  </div>
                  <span>Multiplier: {entry.multiplier}</span>
                  <span>Tier: {entry.tier}</span>
                  <span>Timestamp: {formatTimestamp(entry.timestamp)}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', fontSize: '0.8rem' }}>
                    {entry.metrics ? (
                      Object.entries(entry.metrics).map(([key, value]) => (
                        <span key={key} style={styles.pill}>
                          {key}: {value}
                        </span>
                      ))
                    ) : (
                      <span>No metrics attached</span>
                    )}
                  </div>
                  {entry.overrides?.length ? (
                    <span style={{ color: '#fbbf24' }}>
                      Overrides: {entry.overrides.join(', ')}
                    </span>
                  ) : null}
                </div>
              ))
            ) : (
              <p>No telemetry entries available.</p>
            )}
          </div>
        </div>
      </div>

      <EnsModal
        request={
          ensLookup
            ? {
                loading: ensLookup.loading,
                error: ensLookup.error,
                address: ensLookup.address,
                name: ensLookup.name,
                avatar: ensLookup.avatar,
              }
            : null
        }
        onClose={closeEnsModal}
      />
    </div>
  );
}
