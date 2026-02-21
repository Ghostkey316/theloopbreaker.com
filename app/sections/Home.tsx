'use client';
import { useEffect, useState } from 'react';
import { checkAllChains, type RPCResult } from '../lib/blockchain';
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS } from '../lib/contracts';
import { isRegistered, getRegistration } from '../lib/registration';

interface ChainStatus {
  name: string;
  chainId: number;
  result: RPCResult | null;
  loading: boolean;
  contractCount: number;
}

export default function Home() {
  const [chains, setChains] = useState<ChainStatus[]>([
    { name: 'Base', chainId: 8453, result: null, loading: true, contractCount: BASE_CONTRACTS.length },
    { name: 'Avalanche', chainId: 43114, result: null, loading: true, contractCount: AVALANCHE_CONTRACTS.length },
  ]);
  const [isMobile, setIsMobile] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registrationAddress, setRegistrationAddress] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    // Check registration status
    const reg = isRegistered();
    setRegistered(reg);
    if (reg) {
      const data = getRegistration();
      setRegistrationAddress(data?.walletAddress || null);
    }

    // Check chain connectivity
    checkAllChains().then((results) => {
      setChains([
        { name: 'Base', chainId: 8453, result: results.base, loading: false, contractCount: BASE_CONTRACTS.length },
        { name: 'Avalanche', chainId: 43114, result: results.avalanche, loading: false, contractCount: AVALANCHE_CONTRACTS.length },
      ]);
    });
  }, []);

  const totalContracts = BASE_CONTRACTS.length + AVALANCHE_CONTRACTS.length;
  const allConnected = chains.every(c => !c.loading && c.result?.success);
  const anyLoading = chains.some(c => c.loading);

  return (
    <div style={{ padding: isMobile ? '32px 20px 48px' : '56px 48px', maxWidth: 640, margin: '0 auto' }}>

      {/* ── Hero ── */}
      <div style={{ marginBottom: isMobile ? 56 : 72 }}>
        {/* Flame brand mark */}
        <div style={{ marginBottom: 24 }}>
          <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
            <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
            <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
          </svg>
        </div>

        <h1 style={{
          fontSize: isMobile ? 36 : 48,
          fontWeight: 600,
          color: '#F4F4F5',
          letterSpacing: '-0.04em',
          lineHeight: 1.05,
          marginBottom: 12,
        }}>
          Embris
        </h1>

        {/* ── Mission Statement — front and center ── */}
        <p style={{
          fontSize: isMobile ? 18 : 21,
          color: '#E4E4E7',
          fontWeight: 500,
          letterSpacing: '-0.025em',
          lineHeight: 1.35,
          marginBottom: 16,
          maxWidth: 480,
        }}>
          Making human thriving more profitable than extraction.
        </p>

        <p style={{
          fontSize: isMobile ? 14 : 15,
          color: '#52525B',
          fontWeight: 400,
          letterSpacing: '-0.01em',
          lineHeight: 1.5,
          marginBottom: 12,
        }}>
          Your ethical AI companion
        </p>

        <p style={{
          fontSize: 11,
          color: '#3F3F46',
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          Powered by Vaultfire Protocol
        </p>

        {/* Registration status — inline, minimal */}
        {registered && registrationAddress && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 20,
            padding: '5px 10px',
            backgroundColor: 'rgba(34,197,94,0.05)',
            border: '1px solid rgba(34,197,94,0.1)',
            borderRadius: 8,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              backgroundColor: '#22C55E',
            }} />
            <span style={{
              fontSize: 11,
              color: '#52525B',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {registrationAddress.slice(0, 6)}...{registrationAddress.slice(-4)}
            </span>
            <span style={{
              fontSize: 11,
              color: '#3F3F46',
              fontWeight: 500,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              registered
            </span>
          </div>
        )}
      </div>

      {/* ── Network Status ── */}
      <div style={{ marginBottom: isMobile ? 48 : 56 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <h2 style={{
            fontSize: 11, fontWeight: 500, color: '#71717A',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>Network Status</h2>
          <span style={{
            fontSize: 12, fontWeight: 500,
            color: anyLoading ? '#71717A' : allConnected ? '#22C55E' : '#EF4444',
          }}>
            {anyLoading ? 'Checking...' : allConnected ? 'All systems operational' : 'Degraded'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {chains.map((chain, i) => (
            <div key={chain.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 0',
              borderBottom: i < chains.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: chain.loading ? '#52525B' : chain.result?.success ? '#22C55E' : '#EF4444',
                }} />
                <div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#F4F4F5' }}>{chain.name}</span>
                  <span style={{ fontSize: 12, color: '#3F3F46', marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                    {chain.chainId}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 20 : 32 }}>
                {!chain.loading && chain.result?.success && (
                  <>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{
                        fontSize: 13, color: '#F4F4F5',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 500,
                      }}>
                        {chain.result.blockNumber?.toLocaleString()}
                      </p>
                      <p style={{ fontSize: 10, color: '#3F3F46', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>block</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{
                        fontSize: 13, color: '#A1A1AA',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {chain.result.latency}ms
                      </p>
                      <p style={{ fontSize: 10, color: '#3F3F46', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>latency</p>
                    </div>
                  </>
                )}
                {chain.loading && (
                  <span style={{ fontSize: 12, color: '#3F3F46' }}>connecting...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Protocol Overview ── */}
      <div style={{ marginBottom: isMobile ? 48 : 56 }}>
        <h2 style={{
          fontSize: 11, fontWeight: 500, color: '#71717A',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 20,
        }}>Protocol Overview</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? '24px 16px' : '24px 32px',
        }}>
          {[
            { label: 'Contracts', value: String(totalContracts), sub: `${BASE_CONTRACTS.length} per chain` },
            { label: 'Chains', value: '2', sub: 'Base + Avalanche' },
            { label: 'Standard', value: 'ERC-8004', sub: 'AI Identity', mono: false },
            { label: 'Bridge', value: 'Teleporter', sub: 'Cross-chain', mono: false },
          ].map((item) => (
            <div key={item.label}>
              <p style={{
                fontSize: 11, color: '#71717A', fontWeight: 500,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 8,
              }}>{item.label}</p>
              <p style={{
                fontSize: isMobile ? 24 : 28, fontWeight: 600, color: '#F4F4F5',
                letterSpacing: '-0.03em', lineHeight: 1.1,
                fontFamily: item.mono !== false ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
              }}>{item.value}</p>
              <p style={{ fontSize: 12, color: '#3F3F46', marginTop: 4 }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── About ── */}
      <div>
        <h2 style={{
          fontSize: 11, fontWeight: 500, color: '#71717A',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 20,
        }}>About</h2>

        <div style={{
          fontSize: 14, color: '#A1A1AA', lineHeight: 1.8,
          letterSpacing: '-0.01em',
        }}>
          <p style={{ marginBottom: 16 }}>
            Embris is an ethical AI companion built on Vaultfire Protocol&apos;s decentralized trust infrastructure.
            It operates on three core principles: <span style={{ color: '#F4F4F5', fontWeight: 500 }}>morals over metrics</span>,{' '}
            <span style={{ color: '#F4F4F5', fontWeight: 500 }}>privacy over surveillance</span>, and{' '}
            <span style={{ color: '#F4F4F5', fontWeight: 500 }}>freedom over control</span>.
          </p>
          <p>
            The protocol manages {totalContracts} smart contracts across Base and Avalanche networks,
            connected via the Teleporter bridge for cross-chain communication. All governance
            is on-chain and verifiable.
          </p>
        </div>
      </div>
    </div>
  );
}
