import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import PartnerMetrics from './components/PartnerMetrics.jsx';
import StatusCard from './components/StatusCard.jsx';

function LoginPanel() {
  const { authenticate, loading } = useAuth();
  const [userId, setUserId] = useState('demo-partner');
  const [token, setToken] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    await authenticate({ userId, token });
  };

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>Partner Login</h2>
      <label>
        Partner User ID
        <input value={userId} onChange={(event) => setUserId(event.target.value)} />
      </label>
      <label>
        Existing JWT (optional)
        <input value={token} onChange={(event) => setToken(event.target.value)} />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Authenticating...' : 'Access Dashboard'}
      </button>
    </form>
  );
}

function DashboardShell() {
  const { session, logout } = useAuth();

  if (!session) {
    return <LoginPanel />;
  }

  return (
    <div className="dashboard">
      <header>
        <h1>Vaultfire Partner Console</h1>
        <div className="session-meta">
          <span>{session.partnerId}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>
      <section className="grid">
        <StatusCard
          title="Activation Status"
          value={session.status}
          description="Belief-aligned partner activation state"
        />
        <StatusCard
          title="Average Yield"
          value={`${session.metrics.averageYield}%`}
          description="Weighted average yield across deployed cohorts"
        />
        <StatusCard
          title="Belief Signal Strength"
          value={session.metrics.signalConfidence}
          description="Aggregate signal confidence across belief vectors"
        />
      </section>
      <PartnerMetrics />
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
