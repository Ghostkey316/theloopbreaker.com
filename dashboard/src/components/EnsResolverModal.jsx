import React, { useEffect, useState } from 'react';
import { resolveEns } from '../services/ens.js';

export default function EnsResolverModal({ identity, onClose }) {
  const [loading, setLoading] = useState(false);
  const [resolution, setResolution] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!identity || !identity.wallet) {
      setResolution(null);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    async function hydrate() {
      setLoading(true);
      setError(null);
      try {
        const target = identity.ens || identity.wallet;
        const result = await resolveEns(target);
        if (!cancelled) {
          setResolution(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [identity]);

  if (!identity) {
    return null;
  }

  const displayName = resolution?.name || identity.ens || 'Unregistered ENS';
  const displayAddress = resolution?.address || identity.wallet;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <header className="modal-header">
          <h3>ENS Identity</h3>
          <button type="button" className="ghost-button modal-close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="modal-body">
          <p className="modal-field">
            <span className="label">Wallet</span>
            <span className="value">{displayAddress}</span>
          </p>
          <p className="modal-field">
            <span className="label">Resolved ENS</span>
            <span className="value">{displayName}</span>
          </p>
          {resolution?.avatar ? (
            <div className="modal-avatar">
              <img src={resolution.avatar} alt="ENS avatar" />
            </div>
          ) : null}
          {loading ? <p className="hint">Resolving ENS…</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
