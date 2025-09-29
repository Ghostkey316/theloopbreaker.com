import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchMetrics } from '../services/api.js';

export default function PartnerMetrics() {
  const { session } = useAuth();
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!session) return undefined;

    async function load() {
      setLoading(true);
      const response = await fetchMetrics(session.token);
      if (!cancelled) {
        setMetrics(response.entries);
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session]);

  if (loading) {
    return <div className="panel">Loading belief telemetry…</div>;
  }

  return (
    <section className="panel">
      <h2>Belief Telemetry</h2>
      <table>
        <thead>
          <tr>
            <th>Signal</th>
            <th>Confidence</th>
            <th>Last Sync</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((entry) => (
            <tr key={entry.signalId}>
              <td>{entry.signalId}</td>
              <td>{entry.confidence}</td>
              <td>{entry.lastSynced}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
