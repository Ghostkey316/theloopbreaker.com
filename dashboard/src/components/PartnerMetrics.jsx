import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchMetrics, subscribeToSignalCompass } from '../services/api.js';

const EMPTY_SNAPSHOT = { incoming: [], timeSeries: [], intentFrequency: [], ethicsTriggers: [] };

function formatBeliefScore(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${(value * 100).toFixed(1)}%`;
  }
  return '—';
}

function safeMask(wallet) {
  const masked = maskWallet(wallet || '');
  return masked || 'Unknown wallet';
}

function safeIntent(intent) {
  if (typeof intent === 'string' && intent.trim()) {
    return intent;
  }
  return 'Unclassified intent';
}

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
    const validSeries = snapshot.timeSeries.filter((entry) => typeof entry.beliefScore === 'number');
    if (!validSeries.length) {
      return { average: 0, latest: null };
    }
    const scores = validSeries.map((entry) => entry.beliefScore);
    const average = scores.reduce((acc, value) => acc + value, 0) / scores.length;
    const latest = validSeries[validSeries.length - 1];
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
            <span className="value">{formatBeliefScore(insights.average)}</span>
        </div>
        {insights.latest ? (
          <div className="compass-metric">
            <span className="label">Last Signal</span>
            <span className="value">{formatBeliefScore(insights.latest.beliefScore)}</span>
            <span className="hint">{formatTimestamp(insights.latest.timestamp)}</span>
          </div>
        ) : null}
      </header>
      <div className="compass-grid">
        <div className="compass-column">
          <h3>Incoming Belief Payloads</h3>
          <ul className="compass-list">
            {snapshot.incoming.slice(0, 6).map((entry, index) => (
              <li key={`${entry.walletId || 'incoming'}-${entry.timestamp || index}`}>
                <div className="primary">{safeMask(entry.walletId)}</div>
                <div className="secondary">{formatBeliefScore(entry.beliefScore)} belief</div>
                <div className="tertiary">{formatTimestamp(entry.timestamp)}</div>
              </li>
            ))}
            {!snapshot.incoming.length && <li>No belief payloads received yet.</li>}
          </ul>
        </div>
        <div className="compass-column">
          <h3>Intent Frequency</h3>
          <ul className="compass-list">
            {snapshot.intentFrequency.slice(0, 6).map((intent, index) => (
              <li key={intent.intent || `intent-${index}`}>
                <div className="primary">{safeIntent(intent.intent)}</div>
                <div className="secondary">{typeof intent.count === 'number' ? intent.count : 0} detections</div>
              </li>
            ))}
            {!snapshot.intentFrequency.length && <li>No intents detected.</li>}
          </ul>
        </div>
        <div className="compass-column">
          <h3>Ethics Triggers</h3>
          <ul className="compass-list">
            {snapshot.ethicsTriggers.slice(0, 6).map((trigger, index) => (
              <li key={`${trigger.flag || 'ethics'}-${index}`}>
                <div className="primary">{trigger.flag || 'No flag supplied'}</div>
                <div className="secondary">{safeMask(trigger.walletId)}</div>
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
