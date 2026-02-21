'use client';
import { useState, useEffect } from 'react';
import { registerWallet, isRegistered, getRegistration } from '../lib/registration';
import { getWalletAddress, isWalletCreated } from '../lib/wallet';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered: () => void;
}

/* ── Icons — matching existing SVG style (stroke, 1.7 weight) ── */

function CloseIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FlameIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
      <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
      <path d="M16 14c-.7 1-1.4 2.2-1.4 3.2 0 .77.63 1.4 1.4 1.4s1.4-.63 1.4-1.4c0-1-.7-2.2-1.4-3.2z" fill="#FDE68A" opacity="0.5" />
    </svg>
  );
}

/* ── Feature list items ── */
const FEATURES = [
  'Persistent memory across sessions',
  'Self-learning — reflections, patterns, insights',
  'Goal tracking with proactive check-ins',
  'Personality tuning to match your style',
  'Session continuity and summaries',
  'Full profile export and import',
];

export default function RegistrationModal({ isOpen, onClose, onRegistered }: RegistrationModalProps) {
  const [step, setStep] = useState<'intro' | 'connect' | 'manual' | 'registering' | 'success'>('intro');
  const [manualAddress, setManualAddress] = useState('');
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [hasWallet, setHasWallet] = useState(false);
  const [walletAddr, setWalletAddr] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const created = isWalletCreated();
      const addr = getWalletAddress();
      setHasWallet(created);
      setWalletAddr(addr);
      setStep('intro');
      setError('');
      setManualAddress('');

      if (isRegistered()) {
        const reg = getRegistration();
        const short = reg?.walletAddress
          ? `${reg.walletAddress.slice(0, 6)}...${reg.walletAddress.slice(-4)}`
          : '';
        setResultMessage(`Already registered${short ? ` with ${short}` : ''}.`);
        setStep('success');
      }
    }
  }, [isOpen]);

  const handleConnectWallet = async () => {
    if (!walletAddr) {
      setError('No wallet found. Please create a wallet first in the Wallet section.');
      return;
    }
    setStep('registering');
    setError('');
    const result = await registerWallet(walletAddr);
    if (result.success) {
      setResultMessage(result.message);
      setStep('success');
    } else {
      setError(result.message);
      setStep('connect');
    }
  };

  const handleManualRegister = async () => {
    const addr = manualAddress.trim();
    if (!addr) { setError('Please enter a wallet address.'); return; }
    setStep('registering');
    setError('');
    const result = await registerWallet(addr);
    if (result.success) {
      setResultMessage(result.message);
      setStep('success');
    } else {
      setError(result.message);
      setStep('manual');
    }
  };

  const handleSuccess = () => {
    onRegistered();
    onClose();
  };

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Modal panel */}
      <div
        className="modal-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#111113',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.05)',
          maxWidth: 420,
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '20px 20px 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FlameIcon size={22} />
            <div>
              <h2 style={{
                fontSize: 15, fontWeight: 600, color: '#F4F4F5',
                margin: 0, letterSpacing: '-0.025em', lineHeight: 1.2,
              }}>
                {step === 'success' ? 'Registration complete' : 'Register with Embris'}
              </h2>
              <p style={{ fontSize: 11.5, color: '#52525B', margin: 0, marginTop: 2 }}>
                {step === 'success' ? 'Full companion mode active' : 'Unlock the full AI companion experience'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#3F3F46',
              cursor: 'pointer', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#71717A'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#3F3F46'; }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '18px 20px 20px' }}>

          {/* INTRO */}
          {step === 'intro' && (
            <div>
              <p style={{ fontSize: 13, color: '#71717A', lineHeight: 1.65, marginBottom: 16 }}>
                Register your wallet on-chain to unlock everything Embris can do.
              </p>

              {/* Feature list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
                {FEATURES.map((f) => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: 4,
                      backgroundColor: 'rgba(249,115,22,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: '#F97316',
                    }}>
                      <CheckIcon />
                    </span>
                    <span style={{ fontSize: 12.5, color: '#A1A1AA', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 16 }} />

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hasWallet && walletAddr && (
                  <button
                    onClick={() => setStep('connect')}
                    style={{
                      width: '100%', padding: '11px 16px',
                      backgroundColor: '#F97316',
                      color: '#09090B',
                      border: 'none', borderRadius: 10,
                      fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                      letterSpacing: '-0.01em',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FB923C'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F97316'; }}
                  >
                    Connect Vaultfire Wallet
                  </button>
                )}
                <button
                  onClick={() => setStep('manual')}
                  style={{
                    width: '100%', padding: '11px 16px',
                    backgroundColor: 'transparent',
                    color: '#71717A',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10,
                    fontSize: 13, fontWeight: 500,
                    cursor: 'pointer',
                    letterSpacing: '-0.01em',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = '#A1A1AA';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.color = '#71717A';
                  }}
                >
                  {hasWallet ? 'Use a different address' : 'Enter wallet address'}
                </button>
              </div>
            </div>
          )}

          {/* CONNECT WALLET */}
          {step === 'connect' && (
            <div>
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: 14,
              }}>
                <p style={{ fontSize: 11, color: '#52525B', margin: 0, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
                  Vaultfire Wallet
                </p>
                <p style={{
                  fontSize: 12.5, color: '#D4D4D8', margin: 0,
                  fontFamily: "'JetBrains Mono', monospace",
                  wordBreak: 'break-all', lineHeight: 1.5,
                }}>
                  {walletAddr}
                </p>
              </div>

              <p style={{ fontSize: 12.5, color: '#52525B', lineHeight: 1.65, marginBottom: 16 }}>
                This will register your wallet with the Vaultfire Protocol and verify it against the ERC-8004 Identity Registry on Base.
              </p>

              {error && (
                <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12, lineHeight: 1.5 }}>{error}</p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setStep('intro')}
                  style={{
                    flex: 1, padding: '10px 14px',
                    backgroundColor: 'transparent',
                    color: '#52525B',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#71717A'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#52525B'; }}
                >
                  Back
                </button>
                <button
                  onClick={handleConnectWallet}
                  style={{
                    flex: 2, padding: '10px 14px',
                    backgroundColor: '#F97316',
                    color: '#09090B',
                    border: 'none', borderRadius: 10,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    letterSpacing: '-0.01em',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FB923C'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F97316'; }}
                >
                  Register On-Chain
                </button>
              </div>
            </div>
          )}

          {/* MANUAL ADDRESS */}
          {step === 'manual' && (
            <div>
              <p style={{ fontSize: 12.5, color: '#52525B', lineHeight: 1.65, marginBottom: 14 }}>
                Enter your Ethereum wallet address to register with the Vaultfire Protocol.
              </p>

              <input
                type="text"
                value={manualAddress}
                onChange={(e) => { setManualAddress(e.target.value); setError(''); }}
                placeholder="0x..."
                autoFocus
                style={{
                  width: '100%', padding: '10px 13px',
                  backgroundColor: '#09090B',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  color: '#F4F4F5', fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: 'none', marginBottom: 12,
                  boxSizing: 'border-box', lineHeight: 1.5,
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              />

              {error && (
                <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12, lineHeight: 1.5 }}>{error}</p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setStep('intro')}
                  style={{
                    flex: 1, padding: '10px 14px',
                    backgroundColor: 'transparent',
                    color: '#52525B',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#71717A'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#52525B'; }}
                >
                  Back
                </button>
                <button
                  onClick={handleManualRegister}
                  disabled={!manualAddress.trim()}
                  style={{
                    flex: 2, padding: '10px 14px',
                    backgroundColor: manualAddress.trim() ? '#F97316' : 'rgba(255,255,255,0.04)',
                    color: manualAddress.trim() ? '#09090B' : '#3F3F46',
                    border: 'none', borderRadius: 10,
                    fontSize: 13, fontWeight: 600,
                    cursor: manualAddress.trim() ? 'pointer' : 'default',
                    letterSpacing: '-0.01em',
                    transition: 'background-color 0.15s, color 0.15s',
                  }}
                >
                  Register
                </button>
              </div>
            </div>
          )}

          {/* REGISTERING */}
          {step === 'registering' && (
            <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <div style={{
                width: 28, height: 28, margin: '0 auto 16px',
                border: '2px solid rgba(255,255,255,0.06)',
                borderTopColor: '#F97316',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ fontSize: 13.5, color: '#A1A1AA', margin: 0, letterSpacing: '-0.01em' }}>
                Registering with the Vaultfire Protocol...
              </p>
              <p style={{ fontSize: 12, color: '#3F3F46', margin: '6px 0 0' }}>
                Verifying on-chain identity registry
              </p>
            </div>
          )}

          {/* SUCCESS */}
          {step === 'success' && (
            <div>
              {/* Success indicator — minimal dot, not a big checkmark */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 14px',
                backgroundColor: 'rgba(34,197,94,0.04)',
                border: '1px solid rgba(34,197,94,0.1)',
                borderRadius: 10,
                marginBottom: 16,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: '#22C55E', flexShrink: 0,
                }} />
                <p style={{ fontSize: 12.5, color: '#A1A1AA', margin: 0, lineHeight: 1.5 }}>
                  {resultMessage}
                </p>
              </div>

              <p style={{ fontSize: 12.5, color: '#52525B', lineHeight: 1.65, marginBottom: 18 }}>
                Embris now has full access to memory, self-learning, goal tracking, personality tuning, and more. Your companion will grow with you from here.
              </p>

              <button
                onClick={handleSuccess}
                style={{
                  width: '100%', padding: '11px 16px',
                  backgroundColor: '#F97316',
                  color: '#09090B',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FB923C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F97316'; }}
              >
                Start full experience
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
