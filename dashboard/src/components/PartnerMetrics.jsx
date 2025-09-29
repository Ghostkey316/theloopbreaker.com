import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchMetrics, subscribeToSignalCompass } from '../services/api.js';

const EMPTY_SNAPSHOT = { incoming: [], timeSeries: [], intentFrequency: [], ethicsTriggers: [] };

function formatTimestamp(value) {
  try {
    return new Date(value).toLocaleTimeString();
  } catch (error) {
    return value;
  }
}

function maskWallet(wallet = '') {
  if (wallet.length <= 6) return wallet;
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

export default function PartnerMetrics() {
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session) return undefined;
    let unsubscribe = () => {};
    let cancelled = false;

    async function loadInitial() {
      try {
        setLoading(true);
        const data = await fetchMetrics(session.token);
        if (!cancelled) {
          setSnapshot(data);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    loadInitial();

    unsubscribe = subscribeToSignalCompass({
      token: session.token,
      onUpdate: (data) => {
        setSnapshot(data);
        setLoading(false);
        setError(null);
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [session]);

  const insights = useMemo(() => {
    if (!snapshot.timeSeries.length) {
      return { average: 0, latest: null };
    }
    const scores = snapshot.timeSeries.map((entry) => entry.beliefScore);
    const average = scores.reduce((acc, value) => acc + value, 0) / scores.length;
    const latest = snapshot.timeSeries[snapshot.timeSeries.length - 1];
    return { average, latest };
  }, [snapshot.timeSeries]);

  if (loading) {
    return <div className="panel">Loading signal compass…</div>;
  }

  if (error) {
    return <div className="panel error">Unable to load signal compass: {error}</div>;
  }

  return (
    <section className="panel signal-compass">
      <header className="compass-header">
        <div>
          <h2>Signal Compass</h2>
          <p className="compass-subtitle">Real-time synthesis of belief payloads and ethics posture</p>
        </div>
        <div className="compass-metric">
          <span className="label">Rolling Average</span>
          <span className="value">{(insights.average * 100).toFixed(1)}%</span>
        </div>
        {insights.latest ? (
          <div className="compass-metric">
            <span className="label">Last Signal</span>
            <span className="value">{(insights.latest.beliefScore * 100).toFixed(1)}%</span>
            <span className="hint">{formatTimestamp(insights.latest.timestamp)}</span>
          </div>
        ) : null}
      </header>
      <div className="compass-grid">
        <div className="compass-column">
          <h3>Incoming Belief Payloads</h3>
          <ul className="compass-list">
            {snapshot.incoming.slice(0, 6).map((entry) => (
              <li key={`${entry.walletId}-${entry.timestamp}`}>
                <div className="primary">{maskWallet(entry.walletId)}</div>
                <div className="secondary">{(entry.beliefScore * 100).toFixed(1)}% belief</div>
                <div className="tertiary">{formatTimestamp(entry.timestamp)}</div>
              </li>
            ))}
            {!snapshot.incoming.length && <li>No belief payloads received yet.</li>}
          </ul>
        </div>
        <div className="compass-column">
          <h3>Intent Frequency</h3>
          <ul className="compass-list">
            {snapshot.intentFrequency.slice(0, 6).map((intent) => (
              <li key={intent.intent}>
                <div className="primary">{intent.intent}</div>
                <div className="secondary">{intent.count} detections</div>
              </li>
            ))}
            {!snapshot.intentFrequency.length && <li>No intents detected.</li>}
          </ul>
        </div>
        <div className="compass-column">
          <h3>Ethics Triggers</h3>
          <ul className="compass-list">
            {snapshot.ethicsTriggers.slice(0, 6).map((trigger, index) => (
              <li key={`${trigger.flag}-${index}`}>
                <div className="primary">{trigger.flag}</div>
                <div className="secondary">{maskWallet(trigger.walletId)}</div>
                <div className="tertiary">{formatTimestamp(trigger.timestamp)}</div>
              </li>
            ))}
            {!snapshot.ethicsTriggers.length && <li>No ethics escalations recorded.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
