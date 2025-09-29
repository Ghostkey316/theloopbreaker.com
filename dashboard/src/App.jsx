import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import BeliefOverview from './components/BeliefOverview.jsx';
import SyncTable from './components/SyncTable.jsx';
import MirrorLog from './components/MirrorLog.jsx';
import VoteHistory from './components/VoteHistory.jsx';

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
  });

  useEffect(() => {
    if (wallet) {
      setMessage(
        `Vaultfire belief sync handshake :: wallet=${wallet.toLowerCase()} :: nonce=${Date.now()}`
      );
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
      await connect({ wallet, ens, signature, message, payload });
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
      </div>
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
