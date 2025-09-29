import React, { useMemo } from 'react';

function formatTimestamp(value) {
  if (!value) return 'pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function VoteHistory({ votes, wallet }) {
  const { personalVotes, networkVotes } = useMemo(() => {
    const normalized = wallet ? wallet.toLowerCase() : null;
    const network = [...votes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const personal = normalized
      ? network.filter((vote) => vote.wallet && vote.wallet.toLowerCase() === normalized)
      : [];
    return { personalVotes: personal.slice(0, 5), networkVotes: network.slice(0, 8) };
  }, [votes, wallet]);

  return (
    <section className="panel vote-history">
      <header>
        <h2>BeliefVote History</h2>
        <p className="subtitle">Governance choices weighted by belief</p>
      </header>
      <div className="vote-columns">
        <div>
          <h3>Your Votes</h3>
          <ul className="log-list">
            {personalVotes.length ? (
              personalVotes.map((vote) => (
                <li key={`${vote.proposalId}-${vote.timestamp}`}>
                  <div className="log-primary">
                    <span>{vote.proposalId}</span>
                    <span className="pill">choice {vote.choice}</span>
                  </div>
                  <div className="log-secondary">
                    <span>×{vote.weight.toFixed(4)}</span>
                    <span>{formatTimestamp(vote.timestamp)}</span>
                  </div>
                </li>
              ))
            ) : (
              <li>No votes recorded yet.</li>
            )}
          </ul>
        </div>
        <div>
          <h3>Network Signal</h3>
          <ul className="log-list">
            {networkVotes.length ? (
              networkVotes.map((vote) => (
                <li key={`${vote.wallet}-${vote.timestamp}`}>
                  <div className="log-primary">
                    <span>{vote.proposalId}</span>
                    <span className="pill tier-pill">{vote.tier}</span>
                  </div>
                  <div className="log-secondary">
                    <span>wallet {vote.wallet.slice(0, 6)}…{vote.wallet.slice(-4)}</span>
                    <span>×{vote.weight.toFixed(4)}</span>
                    <span>{formatTimestamp(vote.timestamp)}</span>
                  </div>
                </li>
              ))
            ) : (
              <li>Network votes will appear once recorded.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
