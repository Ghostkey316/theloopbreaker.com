'use client';
import { useState, useEffect } from 'react';
import {
  registerWallet,
  isRegistered,
  getRegistration,
  getChainConfig,
  isRegisteredOnChain,
  type SupportedChain,
  type RegistrationResult,
  type ChainTxResult,
} from '../lib/registration';
import { getWalletAddress, isWalletCreated } from '../lib/wallet';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered: () => void;
}

/* ── Icons ── */

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

function ExternalLinkIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/* ── Feature list ── */
const FEATURES = [
  'Persistent memory across sessions',
  'Self-learning — reflections, patterns, insights',
  'Goal tracking with proactive check-ins',
  'Personality tuning to match your style',
  'Session continuity and summaries',
  'Full profile export and import',
];

type Step = 'intro' | 'chain-select' | 'connect' | 'manual' | 'registering' | 'success' | 'error';

export default function RegistrationModal({ isOpen, onClose, onRegistered }: RegistrationModalProps) {
  const [step, setStep] = useState<Step>('intro');
  const [manualAddress, setManualAddress] = useState('');
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [chainResults, setChainResults] = useState<ChainTxResult[]>([]);
  const [hasWallet, setHasWallet] = useState(false);
  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const [selectedChains, setSelectedChains] = useState<SupportedChain[]>(['base']);
  const [useManual, setUseManual] = useState(false);
  const [baseAlreadyDone, setBaseAlreadyDone] = useState(false);
  const [avaxAlreadyDone, setAvaxAlreadyDone] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const created = isWalletCreated();
      const addr = getWalletAddress();
      setHasWallet(created);
      setWalletAddr(addr);
      setStep('intro');
      setError('');
      setManualAddress('');
      setChainResults([]);
      setStatusText('');
      setUseManual(false);

      const bDone = isRegisteredOnChain('base');
      const aDone = isRegisteredOnChain('avalanche');
      setBaseAlreadyDone(bDone);
      setAvaxAlreadyDone(aDone);

      // Default selection: whatever isn't done yet
      if (bDone && !aDone) setSelectedChains(['avalanche']);
      else if (!bDone && aDone) setSelectedChains(['base']);
      else if (!bDone && !aDone) setSelectedChains(['base']);
      else setSelectedChains([]);

      if (isRegistered() && bDone && aDone) {
        const reg = getRegistration();
        setResultMessage('Registered on both Base and Avalanche.');
        setChainResults(reg?.chains.map(c => ({
          chain: c.chain,
          success: true,
          txHash: c.txHash || undefined,
          explorerUrl: c.explorerUrl || undefined,
          message: `Registered on ${getChainConfig(c.chain).name}`,
        })) || []);
        setStep('success');
      }
    }
  }, [isOpen]);

  const toggleChain = (chain: SupportedChain) => {
    setSelectedChains(prev => {
      if (prev.includes(chain)) return prev.filter(c => c !== chain);
      return [...prev, chain];
    });
  };

  const handleRegister = async () => {
    const addr = useManual ? manualAddress.trim() : walletAddr;
    if (!addr) {
      setError(useManual ? 'Please enter a wallet address.' : 'No wallet found.');
      return;
    }
    if (selectedChains.length === 0) {
      setError('Select at least one chain.');
      return;
    }

    setStep('registering');
    setError('');
    setChainResults([]);

    const chainNames = selectedChains.map(c => getChainConfig(c).name).join(' and ');
    setStatusText(`Registering on ${chainNames}...`);

    const result: RegistrationResult = await registerWallet(addr, {
      useVaultfireWallet: true,
      chains: selectedChains,
    });

    if (result.chainResults) setChainResults(result.chainResults);

    if (result.success) {
      setResultMessage(result.message);
      setStep('success');
    } else {
      setError(result.message);
      if (result.chainResults) setChainResults(result.chainResults);
      setStep('error');
    }
  };

  const handleSuccess = () => {
    onRegistered();
    onClose();
  };

  const handleRetry = () => {
    setError('');
    setStep('chain-select');
  };

  if (!isOpen) return null;

  const headerTitle = (() => {
    switch (step) {
      case 'success': return 'Registration complete';
      case 'error': return 'Registration issue';
      case 'registering': return 'Registering on-chain';
      default: return 'Register with Embris';
    }
  })();

  const headerSub = (() => {
    switch (step) {
      case 'success': return 'Full companion mode active';
      case 'error': return 'Something needs attention';
      case 'registering': return 'Transaction in progress';
      default: return 'Unlock the full AI companion experience';
    }
  })();

  return (
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
      <div
        className="modal-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#111113',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.05)',
          maxWidth: 440,
          width: '100%',
          overflow: 'hidden',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
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
              }}>{headerTitle}</h2>
              <p style={{ fontSize: 11.5, color: '#52525B', margin: 0, marginTop: 2 }}>{headerSub}</p>
            </div>
          </div>
          {step !== 'registering' && (
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: '#3F3F46',
                cursor: 'pointer', padding: 4, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#71717A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#3F3F46'; }}
            >
              <CloseIcon />
            </button>
          )}
        </div>

        <div style={{ padding: '18px 20px 20px' }}>

          {/* ── INTRO ── */}
          {step === 'intro' && (
            <div>
              <p style={{ fontSize: 13, color: '#71717A', lineHeight: 1.65, marginBottom: 16 }}>
                Register your wallet on-chain to unlock everything Embris can do. Vaultfire is deployed on Base and Avalanche — you can register on one or both.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
                {FEATURES.map((f) => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: 4,
                      backgroundColor: 'rgba(249,115,22,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: '#F97316',
                    }}><CheckIcon /></span>
                    <span style={{ fontSize: 12.5, color: '#A1A1AA', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <div style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(249,115,22,0.04)',
                border: '1px solid rgba(249,115,22,0.08)',
                borderRadius: 8, marginBottom: 16,
              }}>
                <p style={{ fontSize: 11.5, color: '#A1A1AA', margin: 0, lineHeight: 1.55 }}>
                  Requires a small amount of ETH (Base) or AVAX (Avalanche) for gas — less than $0.01 per chain. Transactions are permanent on-chain records.
                </p>
              </div>
              <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 16 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hasWallet && walletAddr && (
                  <button
                    onClick={() => { setUseManual(false); setStep('chain-select'); }}
                    style={{
                      width: '100%', padding: '11px 16px',
                      backgroundColor: '#F97316', color: '#09090B',
                      border: 'none', borderRadius: 10,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FB923C'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F97316'; }}
                  >Connect Vaultfire Wallet</button>
                )}
                <button
                  onClick={() => { setUseManual(true); setStep('chain-select'); }}
                  style={{
                    width: '100%', padding: '11px 16px',
                    backgroundColor: 'transparent', color: '#71717A',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#A1A1AA'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#71717A'; }}
                >{hasWallet ? 'Use a different address' : 'Enter wallet address'}</button>
              </div>
            </div>
          )}

          {/* ── CHAIN SELECT ── */}
          {step === 'chain-select' && (
            <div>
              {/* Wallet display */}
              {!useManual && walletAddr && (
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)',
                  marginBottom: 14,
                }}>
                  <p style={{ fontSize: 11, color: '#52525B', margin: 0, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
                    Vaultfire Wallet
                  </p>
                  <p style={{
                    fontSize: 12.5, color: '#D4D4D8', margin: 0,
                    fontFamily: "'JetBrains Mono', monospace",
                    wordBreak: 'break-all', lineHeight: 1.5,
                  }}>{walletAddr}</p>
                </div>
              )}

              {/* Manual address input */}
              {useManual && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 12.5, color: '#52525B', lineHeight: 1.65, marginBottom: 8 }}>
                    Enter your Ethereum wallet address:
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
                      borderRadius: 10, color: '#F4F4F5', fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: 'none', boxSizing: 'border-box', lineHeight: 1.5,
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                  />
                </div>
              )}

              <p style={{ fontSize: 13, color: '#71717A', lineHeight: 1.65, marginBottom: 12 }}>
                Choose which chain(s) to register on:
              </p>

              {/* Chain selection cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {(['base', 'avalanche'] as SupportedChain[]).map((chain) => {
                  const cfg = getChainConfig(chain);
                  const selected = selectedChains.includes(chain);
                  const alreadyDone = chain === 'base' ? baseAlreadyDone : avaxAlreadyDone;

                  return (
                    <button
                      key={chain}
                      onClick={() => !alreadyDone && toggleChain(chain)}
                      disabled={alreadyDone}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px',
                        backgroundColor: alreadyDone
                          ? 'rgba(34,197,94,0.03)'
                          : selected
                            ? 'rgba(249,115,22,0.05)'
                            : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${
                          alreadyDone
                            ? 'rgba(34,197,94,0.15)'
                            : selected
                              ? 'rgba(249,115,22,0.2)'
                              : 'rgba(255,255,255,0.05)'
                        }`,
                        borderRadius: 10,
                        cursor: alreadyDone ? 'default' : 'pointer',
                        width: '100%',
                        textAlign: 'left',
                        transition: 'border-color 0.15s, background-color 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Chain color dot */}
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          backgroundColor: cfg.color,
                          flexShrink: 0,
                        }} />
                        <div>
                          <p style={{
                            fontSize: 13, fontWeight: 600, color: '#E4E4E7',
                            margin: 0, lineHeight: 1.2,
                          }}>{cfg.name}</p>
                          <p style={{ fontSize: 11, color: '#52525B', margin: 0, marginTop: 2 }}>
                            {alreadyDone ? 'Already registered' : `Gas paid in ${cfg.gasSymbol}`}
                          </p>
                        </div>
                      </div>
                      {/* Status indicator */}
                      {alreadyDone ? (
                        <div style={{
                          width: 20, height: 20, borderRadius: 6,
                          backgroundColor: 'rgba(34,197,94,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#22C55E',
                        }}><CheckIcon /></div>
                      ) : (
                        <div style={{
                          width: 20, height: 20, borderRadius: 6,
                          border: `2px solid ${selected ? '#F97316' : 'rgba(255,255,255,0.1)'}`,
                          backgroundColor: selected ? '#F97316' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {selected && (
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#09090B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {error && (
                <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12, lineHeight: 1.5 }}>{error}</p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setStep('intro')}
                  style={{
                    flex: 1, padding: '10px 14px',
                    backgroundColor: 'transparent', color: '#52525B',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#71717A'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#52525B'; }}
                >Back</button>
                <button
                  onClick={handleRegister}
                  disabled={selectedChains.length === 0}
                  style={{
                    flex: 2, padding: '10px 14px',
                    backgroundColor: selectedChains.length > 0 ? '#F97316' : 'rgba(255,255,255,0.04)',
                    color: selectedChains.length > 0 ? '#09090B' : '#3F3F46',
                    border: 'none', borderRadius: 10,
                    fontSize: 13, fontWeight: 600,
                    cursor: selectedChains.length > 0 ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => { if (selectedChains.length > 0) e.currentTarget.style.backgroundColor = '#FB923C'; }}
                  onMouseLeave={(e) => { if (selectedChains.length > 0) e.currentTarget.style.backgroundColor = '#F97316'; }}
                >
                  {selectedChains.length === 2 ? 'Register on Both Chains' :
                   selectedChains.length === 1 ? `Register on ${getChainConfig(selectedChains[0]).name}` :
                   'Select a Chain'}
                </button>
              </div>
            </div>
          )}

          {/* ── REGISTERING ── */}
          {step === 'registering' && (
            <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <div style={{
                width: 28, height: 28, margin: '0 auto 16px',
                border: '2px solid rgba(255,255,255,0.06)',
                borderTopColor: '#F97316',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ fontSize: 13.5, color: '#A1A1AA', margin: 0 }}>
                {statusText || 'Sending transaction...'}
              </p>
              <p style={{ fontSize: 12, color: '#3F3F46', margin: '6px 0 0' }}>
                Do not close this window
              </p>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <div>
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(239,68,68,0.04)',
                border: '1px solid rgba(239,68,68,0.1)',
                borderRadius: 10, marginBottom: 14,
              }}>
                <p style={{ fontSize: 12.5, color: '#F87171', margin: 0, lineHeight: 1.55 }}>{error}</p>
              </div>

              {/* Per-chain results if any */}
              {chainResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {chainResults.map((cr) => {
                    const cfg = getChainConfig(cr.chain);
                    return (
                      <div key={cr.chain} style={{
                        padding: '8px 12px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cr.success ? '#22C55E' : '#EF4444' }} />
                          <span style={{ fontSize: 12, color: '#A1A1AA' }}>{cfg.name}</span>
                        </div>
                        {cr.txHash && cr.explorerUrl && (
                          <a href={cr.explorerUrl} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: '#F97316', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            {cfg.explorerName} <ExternalLinkIcon />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={{
                  flex: 1, padding: '10px 14px', backgroundColor: 'transparent', color: '#52525B',
                  border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#71717A'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#52525B'; }}
                >Close</button>
                <button onClick={handleRetry} style={{
                  flex: 2, padding: '10px 14px', backgroundColor: '#F97316', color: '#09090B',
                  border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FB923C'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F97316'; }}
                >Try Again</button>
              </div>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 14px',
                backgroundColor: 'rgba(34,197,94,0.04)',
                border: '1px solid rgba(34,197,94,0.1)',
                borderRadius: 10, marginBottom: 14,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22C55E', flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: '#A1A1AA', margin: 0, lineHeight: 1.5 }}>{resultMessage}</p>
              </div>

              {/* Per-chain transaction details */}
              {chainResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {chainResults.filter(cr => cr.success).map((cr) => {
                    const cfg = getChainConfig(cr.chain);
                    const shortHash = cr.txHash ? `${cr.txHash.slice(0, 10)}...${cr.txHash.slice(-8)}` : null;
                    return (
                      <div key={cr.chain} style={{
                        padding: '10px 12px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: shortHash ? 6 : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.color }} />
                            <span style={{ fontSize: 12, color: '#A1A1AA', fontWeight: 500 }}>{cfg.name}</span>
                          </div>
                          <div style={{
                            fontSize: 10.5, color: '#22C55E', backgroundColor: 'rgba(34,197,94,0.08)',
                            padding: '2px 7px', borderRadius: 4, fontWeight: 500,
                          }}>Confirmed</div>
                        </div>
                        {shortHash && cr.explorerUrl && (
                          <a href={cr.explorerUrl} target="_blank" rel="noopener noreferrer"
                            style={{
                              fontSize: 11.5, color: '#F97316', textDecoration: 'none',
                              fontFamily: "'JetBrains Mono', monospace",
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}>
                            {shortHash} <ExternalLinkIcon />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <p style={{ fontSize: 12.5, color: '#52525B', lineHeight: 1.65, marginBottom: 18 }}>
                Embris now has full access to memory, self-learning, goal tracking, personality tuning, and more. Your companion will grow with you from here.
              </p>

              <button
                onClick={handleSuccess}
                style={{
                  width: '100%', padding: '11px 16px',
                  backgroundColor: '#F97316', color: '#09090B',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FB923C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F97316'; }}
              >Start full experience</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
