import React from 'react';

function maskWallet(wallet = '') {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function formatTimestamp(value) {
  if (!value) return 'pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function SyncTable({ partners }) {
  return (
    <section className="panel sync-table">
      <header>
        <h2>Partner Syncs</h2>
        <p className="subtitle">Real-time belief sync confirmations</p>
      </header>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Wallet</th>
              <th>ENS</th>
              <th>Multiplier</th>
              <th>Tier</th>
              <th>Last Sync</th>
            </tr>
          </thead>
          <tbody>
            {partners.length ? (
              partners.map((partner) => (
                <tr key={partner.wallet}>
                  <td>{maskWallet(partner.wallet)}</td>
                  <td>{partner.ens || '—'}</td>
                  <td>{partner.multiplier.toFixed(4)}</td>
                  <td>
                    <span className={`tier-tag tier-${(partner.tier || 'observer').toLowerCase()}`}>
                      {partner.tier}
                    </span>
                  </td>
                  <td>{formatTimestamp(partner.lastSync)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>Awaiting first partner sync.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
