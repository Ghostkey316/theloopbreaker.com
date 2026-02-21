'use client';
import { useEffect, useState } from 'react';
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, CHAINS } from '../lib/contracts';
import { getTeleporterBridgeStats, checkChainConnectivity, type BridgeStats, type RPCResult } from '../lib/blockchain';

const BASE_BRIDGE = BASE_CONTRACTS.find((c) => c.name === 'VaultfireTeleporterBridge')!;
const AVAX_BRIDGE = AVALANCHE_CONTRACTS.find((c) => c.name === 'VaultfireTeleporterBridge')!;

function RefreshIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ExternalIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ArrowRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
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
      <div style={{
        backgroundColor: '#111114',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: isMobile ? '16px' : '18px 20px',
        borderTop: `2px solid ${cfg.color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: cfg.color,
              boxShadow: `0 0 8px ${cfg.color}40`,
            }} />
            <div>
              <h3 style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.01em' }}>{cfg.name}</h3>
              <p style={{ fontSize: 11, color: '#666670' }}>Chain {cfg.chainId}</p>
            </div>
          </div>
          <span style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 20,
            backgroundColor: chainResult?.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            color: chainResult?.success ? '#22C55E' : '#EF4444',
            flexShrink: 0,
            fontWeight: 500,
          }}>
            {chainResult?.success ? 'Online' : 'Offline'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: isMobile ? '10px 12px' : '12px 14px' }}>
            <p style={{ fontSize: 10, color: '#666670', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Messages Sent</p>
            <p style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#F97316', fontFamily: "'SF Mono', monospace", letterSpacing: '-0.02em' }}>
              {loading ? '—' : stats?.messageCount !== null ? stats?.messageCount?.toLocaleString() : 'N/A'}
            </p>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: isMobile ? '10px 12px' : '12px 14px' }}>
            <p style={{ fontSize: 10, color: '#666670', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Status</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: stats?.paused ? '#EF4444' : '#22C55E' }}>
              {loading ? '—' : stats?.isAlive ? (stats.paused ? 'Paused' : 'Active') : 'Not deployed'}
            </p>
          </div>
        </div>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: isMobile ? '10px 12px' : '12px 14px', marginBottom: 12 }}>
          <p style={{ fontSize: 10, color: '#666670', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Contract Address</p>
          <code style={{
            fontSize: isMobile ? 10 : 11,
            color: '#FFFFFF',
            fontFamily: "'SF Mono', monospace",
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: isMobile ? 'nowrap' : 'normal',
            wordBreak: isMobile ? 'normal' : 'break-all',
          }}>{isMobile ? `${address.slice(0, 16)}...${address.slice(-10)}` : address}</code>
        </div>

        <a href={`${cfg.explorerUrl}/address/${address}`} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            color: '#A0A0A8',
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 500,
            transition: 'all 0.15s ease',
            letterSpacing: '-0.01em',
          }}>
          View on {cfg.name === 'Base' ? 'Basescan' : 'Snowtrace'} <ExternalIcon size={10} />
        </a>
      </div>
    );
  };

  return (
    <div style={{ padding: isMobile ? '20px 16px 40px' : '40px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: '#FFFFFF', marginBottom: 6, letterSpacing: '-0.03em' }}>Cross-Chain Bridge</h1>
        <p style={{ fontSize: isMobile ? 13 : 14, color: '#A0A0A8', lineHeight: 1.6, letterSpacing: '-0.01em' }}>The VaultfireTeleporterBridge enables cross-chain communication between Base and Avalanche.</p>
      </div>

      {/* Bridge Architecture */}
      <div style={{
        backgroundColor: '#111114',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: isMobile ? '18px 16px' : '24px',
        marginBottom: 24,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: '#666670', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Bridge Architecture</h2>
          <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 12 : 20, flexWrap: 'wrap' }}>
          {/* Base */}
          <div style={{
            textAlign: 'center',
            padding: isMobile ? '12px 18px' : '14px 24px',
            backgroundColor: 'rgba(0,217,255,0.06)',
            border: '1px solid rgba(0,217,255,0.15)',
            borderRadius: 10,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#00D9FF', margin: '0 auto 6px', boxShadow: '0 0 8px rgba(0,217,255,0.3)' }} />
            <p style={{ fontSize: 12, fontWeight: 600, color: '#00D9FF', letterSpacing: '-0.01em' }}>Base</p>
            <p style={{ fontSize: 10, color: '#666670' }}>Chain 8453</p>
          </div>

          {/* Arrow + Teleporter */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#F97316' }}>
              <div style={{ width: 24, height: 1, backgroundColor: 'rgba(249,115,22,0.4)' }} />
              <ArrowRightIcon size={14} />
            </div>
            <div style={{
              padding: '3px 10px',
              background: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.2)',
              borderRadius: 20,
            }}>
              <p style={{ fontSize: 9, color: '#F97316', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Teleporter</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#F97316', transform: 'rotate(180deg)' }}>
              <div style={{ width: 24, height: 1, backgroundColor: 'rgba(249,115,22,0.4)' }} />
              <ArrowRightIcon size={14} />
            </div>
          </div>

          {/* Avalanche */}
          <div style={{
            textAlign: 'center',
            padding: isMobile ? '12px 18px' : '14px 24px',
            backgroundColor: 'rgba(232,65,66,0.06)',
            border: '1px solid rgba(232,65,66,0.15)',
            borderRadius: 10,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#E84142', margin: '0 auto 6px', boxShadow: '0 0 8px rgba(232,65,66,0.3)' }} />
            <p style={{ fontSize: 12, fontWeight: 600, color: '#E84142', letterSpacing: '-0.01em' }}>Avalanche</p>
            <p style={{ fontSize: 10, color: '#666670' }}>Chain 43114</p>
          </div>
        </div>

        <p style={{ fontSize: 11, color: '#666670', textAlign: 'center', marginTop: 16, letterSpacing: '-0.01em' }}>
          Messages relayed trustlessly using Avalanche Warp Messaging (AWM)
        </p>
      </div>

      {/* Bridge Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: 14,
        marginBottom: 24,
      }}>
        <BridgeCard chain="base" stats={baseBridge} chainResult={baseChain} address={BASE_BRIDGE.address} />
        <BridgeCard chain="avalanche" stats={avaxBridge} chainResult={avaxChain} address={AVAX_BRIDGE.address} />
      </div>

      <button onClick={loadData} disabled={loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '10px 20px',
          backgroundColor: loading ? 'rgba(255,255,255,0.04)' : '#F97316',
          border: 'none',
          borderRadius: 8,
          color: loading ? '#666670' : '#0A0A0C',
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? 'default' : 'pointer',
          width: isMobile ? '100%' : 'auto',
          transition: 'all 0.2s ease',
          letterSpacing: '-0.01em',
        }}>
        <RefreshIcon size={13} />
        {loading ? 'Loading...' : 'Refresh Bridge Data'}
      </button>
    </div>
  );
}
