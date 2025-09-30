import React, { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import BeliefOverview from './components/BeliefOverview.jsx';
import SyncTable from './components/SyncTable.jsx';
import MirrorLog from './components/MirrorLog.jsx';
import VoteHistory from './components/VoteHistory.jsx';
import {
  hasTelemetryConsent,
  setTelemetryConsent,
  trackTelemetryEvent,
} from './services/telemetryClient.js';

function WalletLogin() {
  const { connect, loading, error } = useAuth();
  const [wallet, setWallet] = useState('');
  const [ens, setEns] = useState('');
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [payload, setPayload] = useState({
    loyalty: 82,
    ethics: 91,
    interactionFrequency: 68,
    partnerAlignment: 77,
    holdDuration: 45,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [weights, setWeights] = useState({
    loyalty: '',
    ethics: '',
    frequency: '',
    alignment: '',
    holdDuration: '',
  });
  const [baselineMultiplier, setBaselineMultiplier] = useState('');
  const [telemetryOptIn, setTelemetryOptIn] = useState(false);

  const scoringConfig = useMemo(() => {
    const normalizedWeights = Object.entries(weights).reduce((acc, [key, value]) => {
      if (value === '') {
        return acc;
      }
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        acc[key === 'frequency' ? 'frequency' : key] = numeric;
      }
      return acc;
    }, {});
    const config = {};
    if (Object.keys(normalizedWeights).length) {
      config.weights = normalizedWeights;
    }
    const baselineValue = Number(baselineMultiplier);
    if (baselineMultiplier && !Number.isNaN(baselineValue)) {
      config.baselineMultiplier = baselineValue;
    }
    return Object.keys(config).length ? config : undefined;
  }, [weights, baselineMultiplier]);

  useEffect(() => {
    if (wallet) {
      setMessage(
        `Vaultfire belief sync handshake :: wallet=${wallet.toLowerCase()} :: nonce=${Date.now()}`
      );
      setTelemetryOptIn(hasTelemetryConsent(wallet));
    } else {
      setTelemetryOptIn(false);
    }
  }, [wallet]);

  const requestSignature = async () => {
    if (!window.ethereum) {
      throw new Error('Wallet provider not detected');
    }
    const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setWallet(account);
    const handshake = `Vaultfire belief sync handshake :: wallet=${account.toLowerCase()} :: nonce=${Date.now()}`;
    setMessage(handshake);
    const signed = await window.ethereum.request({
      method: 'personal_sign',
      params: [handshake, account],
    });
    setSignature(signed);
  };

  const handleConnect = async (event) => {
    event.preventDefault();
    try {
      const submissionPayload = scoringConfig
        ? { ...payload, scoringConfig }
        : payload;
      if (wallet) {
        setTelemetryConsent(wallet, telemetryOptIn);
      }
      await connect({ wallet, ens, signature, message, payload: submissionPayload });
    } catch (err) {
      console.error('Belief sync failed', err.message);
    }
  };

  return (
    <form className="panel login" onSubmit={handleConnect}>
      <h2>Connect Wallet</h2>
      <p className="subtitle">Sign a message to sync belief without compromise.</p>
      <label>
        Wallet Address
        <input value={wallet} onChange={(event) => setWallet(event.target.value)} required />
      </label>
      <label className="telemetry-optin">
        <input
          type="checkbox"
          checked={telemetryOptIn}
          onChange={(event) => {
            setTelemetryOptIn(event.target.checked);
            if (wallet) {
              setTelemetryConsent(wallet, event.target.checked);
            }
          }}
        />
        Share anonymized telemetry for belief votes and dashboard usage
      </label>
      <label>
        ENS Alias (optional)
        <input value={ens} onChange={(event) => setEns(event.target.value)} />
      </label>
      <label>
        Signed Message
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Vaultfire belief sync handshake"
          rows={3}
          required
        />
      </label>
      <label>
        Signature
        <textarea
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
          rows={3}
          required
        />
      </label>
      <div className="payload-grid">
        <label>
          Loyalty
          <input
            type="number"
            value={payload.loyalty}
            min="0"
            max="100"
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, loyalty: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Ethics
          <input
            type="number"
            value={payload.ethics}
            min="0"
            max="100"
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, ethics: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Frequency
          <input
            type="number"
            value={payload.interactionFrequency}
            min="0"
            max="100"
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, interactionFrequency: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Alignment
          <input
            type="number"
            value={payload.partnerAlignment}
            min="0"
            max="100"
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, partnerAlignment: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Hold Duration (days)
          <input
            type="number"
            value={payload.holdDuration}
            min="0"
            max="365"
            onChange={(event) =>
              setPayload((prev) => ({ ...prev, holdDuration: Number(event.target.value) }))
            }
          />
        </label>
      </div>
      <button
        type="button"
        className="ghost-button advanced-toggle"
        onClick={() => setShowAdvanced((prev) => !prev)}
      >
        {showAdvanced ? 'Hide Scoring Overrides' : 'Advanced: Scoring Overrides'}
      </button>
      {showAdvanced ? (
        <div className="advanced-grid">
          <p className="subtitle">
            Override the default belief weights (0-1 values are normalized automatically).
          </p>
          <div className="weights-grid">
            <label>
              Loyalty Weight
              <input
                type="number"
                inputMode="decimal"
                value={weights.loyalty}
                min="0"
                step="0.01"
                onChange={(event) => setWeights((prev) => ({ ...prev, loyalty: event.target.value }))}
              />
            </label>
            <label>
              Ethics Weight
              <input
                type="number"
                inputMode="decimal"
                value={weights.ethics}
                min="0"
                step="0.01"
                onChange={(event) => setWeights((prev) => ({ ...prev, ethics: event.target.value }))}
              />
            </label>
            <label>
              Frequency Weight
              <input
                type="number"
                inputMode="decimal"
                value={weights.frequency}
                min="0"
                step="0.01"
                onChange={(event) => setWeights((prev) => ({ ...prev, frequency: event.target.value }))}
              />
            </label>
            <label>
              Alignment Weight
              <input
                type="number"
                inputMode="decimal"
                value={weights.alignment}
                min="0"
                step="0.01"
                onChange={(event) => setWeights((prev) => ({ ...prev, alignment: event.target.value }))}
              />
            </label>
            <label>
              Hold Duration Weight
              <input
                type="number"
                inputMode="decimal"
                value={weights.holdDuration}
                min="0"
                step="0.01"
                onChange={(event) => setWeights((prev) => ({ ...prev, holdDuration: event.target.value }))}
              />
            </label>
          </div>
          <label>
            Baseline Multiplier
            <input
              type="number"
              inputMode="decimal"
              value={baselineMultiplier}
              min="0.5"
              step="0.01"
              onChange={(event) => setBaselineMultiplier(event.target.value)}
              placeholder="Default partner baseline is 1.15"
            />
          </label>
        </div>
      ) : null}
      <div className="actions">
        <button
          type="button"
          onClick={() => requestSignature().catch((err) => console.error('Wallet provider error', err))}
        >
          Use Wallet Provider
        </button>
        <button type="submit" disabled={loading}>
          {loading ? 'Syncing belief…' : 'Sync Belief'}
        </button>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
    </form>
  );
}

function DashboardShell() {
  const { session, status, logout, loading, error } = useAuth();

  useEffect(() => {
    if (session) {
      trackTelemetryEvent('dashboard.render', {
        wallet: session.wallet,
        tier: session.tier,
        multiplier: session.multiplier,
      });
    }
  }, [session?.wallet, session?.tier, session?.multiplier]);

  if (!session) {
    return <WalletLogin />;
  }

  return (
    <div className="dashboard">
      <BeliefOverview session={session} summary={status?.summary} />
      <div className="dashboard-meta">
        <span className="pill tier-pill">{session.tier}</span>
        <button type="button" onClick={logout} className="ghost-button">
          Disconnect
        </button>
        {loading ? <span className="hint">Refreshing belief state…</span> : null}
        {error ? <span className="error-text">{error}</span> : null}
      </div>
      <div className="dashboard-grid">
        <SyncTable partners={status?.partners || []} />
        <MirrorLog logs={status?.mirrorLog || []} />
        <VoteHistory votes={status?.votes || []} wallet={session.wallet} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardShell />
    </AuthProvider>
  );
}
