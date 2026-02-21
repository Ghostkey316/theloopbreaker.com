'use client';
import { useEffect, useState } from 'react';
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, CHAINS } from '../lib/contracts';
import { getTeleporterBridgeStats, checkChainConnectivity, type BridgeStats, type RPCResult } from '../lib/blockchain';

const BASE_BRIDGE = BASE_CONTRACTS.find((c) => c.name === 'VaultfireTeleporterBridge')!;
const AVAX_BRIDGE = AVALANCHE_CONTRACTS.find((c) => c.name === 'VaultfireTeleporterBridge')!;

function RefreshIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ExternalIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ArrowRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function Bridge() {
  const [baseBridge, setBaseBridge] = useState<BridgeStats | null>(null);
  const [avaxBridge, setAvaxBridge] = useState<BridgeStats | null>(null);
  const [baseChain, setBaseChain] = useState<RPCResult | null>(null);
  const [avaxChain, setAvaxChain] = useState<RPCResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [bStats, aStats, bChain, aChain] = await Promise.all([
      getTeleporterBridgeStats('base', BASE_BRIDGE.address),
      getTeleporterBridgeStats('avalanche', AVAX_BRIDGE.address),
      checkChainConnectivity('base'),
      checkChainConnectivity('avalanche'),
    ]);
    setBaseBridge(bStats);
    setAvaxBridge(aStats);
    setBaseChain(bChain);
    setAvaxChain(aChain);
    setLoading(false);
  };

  const BridgeCard = ({ chain, stats, chainResult, address }: { chain: 'base' | 'avalanche'; stats: BridgeStats | null; chainResult: RPCResult | null; address: string }) => {
    const cfg = CHAINS[chain];
    return (
      <div className="card-hover-effect" style={{
        background: 'rgba(17,17,20,0.6)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 12, padding: isMobile ? '14px' : '16px 18px',
        borderTop: `2px solid ${cfg.color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}40` }} />
            <div>
              <h3 style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.01em' }}>{cfg.name}</h3>
              <p style={{ fontSize: 10, color: '#666670' }}>Chain {cfg.chainId}</p>
            </div>
          </div>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 20,
            backgroundColor: chainResult?.success ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
            color: chainResult?.success ? '#22C55E' : '#EF4444',
            flexShrink: 0, fontWeight: 500,
          }}>
            {chainResult?.success ? 'Online' : 'Offline'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 10 }}>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: isMobile ? '8px 10px' : '10px 12px' }}>
            <p style={{ fontSize: 9, color: '#666670', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Messages Sent</p>
            <p style={{ fontSize: isMobile ? 15 : 16, fontWeight: 700, color: '#F97316', fontFamily: "'SF Mono', monospace", letterSpacing: '-0.02em' }}>
              {loading ? '—' : stats?.messageCount !== null ? stats?.messageCount?.toLocaleString() : 'N/A'}
            </p>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: isMobile ? '8px 10px' : '10px 12px' }}>
            <p style={{ fontSize: 9, color: '#666670', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Status</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: stats?.paused ? '#EF4444' : '#22C55E' }}>
              {loading ? '—' : stats?.isAlive ? (stats.paused ? 'Paused' : 'Active') : 'Not deployed'}
            </p>
          </div>
        </div>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: isMobile ? '8px 10px' : '10px 12px', marginBottom: 10 }}>
          <p style={{ fontSize: 9, color: '#666670', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Contract Address</p>
          <code style={{
            fontSize: isMobile ? 9 : 10, color: '#FFFFFF', fontFamily: "'SF Mono', monospace",
            display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: isMobile ? 'nowrap' : 'normal', wordBreak: isMobile ? 'normal' : 'break-all',
          }}>{isMobile ? `${address.slice(0, 16)}...${address.slice(-10)}` : address}</code>
        </div>

        <a href={`${cfg.explorerUrl}/address/${address}`} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '8px', backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8,
            color: '#A0A0A8', textDecoration: 'none', fontSize: 11,
            fontWeight: 500, transition: 'all 0.15s ease', letterSpacing: '-0.01em',
          }}>
          View on {cfg.name === 'Base' ? 'Basescan' : 'Snowtrace'} <ExternalIcon size={9} />
        </a>
      </div>
    );
  };

  return (
    <div style={{ padding: isMobile ? '20px 16px 40px' : '32px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#FFFFFF', marginBottom: 4, letterSpacing: '-0.03em' }}>Cross-Chain Bridge</h1>
        <p style={{ fontSize: isMobile ? 12 : 13, color: '#A0A0A8', lineHeight: 1.6, letterSpacing: '-0.01em' }}>VaultfireTeleporterBridge enables cross-chain communication between Base and Avalanche.</p>
      </div>

      {/* Bridge Architecture */}
      <div style={{
        background: 'rgba(17,17,20,0.6)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 12, padding: isMobile ? '16px 14px' : '20px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 10, fontWeight: 600, color: '#666670', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bridge Architecture</h2>
          <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 10 : 16, flexWrap: 'wrap' }}>
          <div style={{
            textAlign: 'center', padding: isMobile ? '10px 16px' : '12px 20px',
            backgroundColor: 'rgba(0,217,255,0.04)', border: '1px solid rgba(0,217,255,0.12)',
            borderRadius: 10,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#00D9FF', margin: '0 auto 4px', boxShadow: '0 0 6px rgba(0,217,255,0.3)' }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: '#00D9FF', letterSpacing: '-0.01em' }}>Base</p>
            <p style={{ fontSize: 9, color: '#666670' }}>Chain 8453</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#F97316' }}>
              <div style={{ width: 20, height: 1, backgroundColor: 'rgba(249,115,22,0.3)' }} />
              <ArrowRightIcon size={12} />
            </div>
            <div style={{ padding: '2px 8px', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 20 }}>
              <p style={{ fontSize: 8, color: '#F97316', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Teleporter</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#F97316', transform: 'rotate(180deg)' }}>
              <div style={{ width: 20, height: 1, backgroundColor: 'rgba(249,115,22,0.3)' }} />
              <ArrowRightIcon size={12} />
            </div>
          </div>

          <div style={{
            textAlign: 'center', padding: isMobile ? '10px 16px' : '12px 20px',
            backgroundColor: 'rgba(232,65,66,0.04)', border: '1px solid rgba(232,65,66,0.12)',
            borderRadius: 10,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#E84142', margin: '0 auto 4px', boxShadow: '0 0 6px rgba(232,65,66,0.3)' }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: '#E84142', letterSpacing: '-0.01em' }}>Avalanche</p>
            <p style={{ fontSize: 9, color: '#666670' }}>Chain 43114</p>
          </div>
        </div>

        <p style={{ fontSize: 10, color: '#666670', textAlign: 'center', marginTop: 12, letterSpacing: '-0.01em' }}>
          Messages relayed trustlessly using Avalanche Warp Messaging (AWM)
        </p>
      </div>

      {/* Bridge Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        <BridgeCard chain="base" stats={baseBridge} chainResult={baseChain} address={BASE_BRIDGE.address} />
        <BridgeCard chain="avalanche" stats={avaxBridge} chainResult={avaxChain} address={AVAX_BRIDGE.address} />
      </div>

      <button onClick={loadData} disabled={loading}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 18px',
          background: loading ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #F97316, #EA6C0A)',
          border: 'none', borderRadius: 8,
          color: loading ? '#666670' : '#0A0A0C',
          fontSize: 12, fontWeight: 600,
          cursor: loading ? 'default' : 'pointer',
          width: isMobile ? '100%' : 'auto',
          transition: 'all 0.2s ease', letterSpacing: '-0.01em',
          boxShadow: loading ? 'none' : '0 2px 12px rgba(249,115,22,0.2)',
        }}>
        <RefreshIcon size={12} />
        {loading ? 'Loading...' : 'Refresh Bridge Data'}
      </button>
    </div>
  );
}
