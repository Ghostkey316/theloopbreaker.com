'use client';
import { useEffect, useState } from 'react';
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, CHAINS } from '../lib/contracts';
import { getTeleporterBridgeStats, checkChainConnectivity, type BridgeStats, type RPCResult } from '../lib/blockchain';

const BASE_BRIDGE = BASE_CONTRACTS.find((c) => c.name === 'VaultfireTeleporterBridge')!;
const AVAX_BRIDGE = AVALANCHE_CONTRACTS.find((c) => c.name === 'VaultfireTeleporterBridge')!;

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
      <div style={{ backgroundColor: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: 14, padding: isMobile ? 16 : 20, borderTopColor: cfg.color, borderTopWidth: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, color: '#ECEDEE' }}>{cfg.name}</h3>
            <p style={{ fontSize: 12, color: '#9BA1A6' }}>Chain ID: {cfg.chainId}</p>
          </div>
          <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, backgroundColor: chainResult?.success ? '#22C55E20' : '#EF444420', color: chainResult?.success ? '#22C55E' : '#EF4444', flexShrink: 0 }}>
            {chainResult?.success ? 'Online' : 'Offline'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: isMobile ? 8 : 10, marginBottom: 16 }}>
          <div style={{ backgroundColor: '#0A0A0C', borderRadius: 10, padding: isMobile ? '10px 12px' : '12px 14px' }}>
            <p style={{ fontSize: 11, color: '#9BA1A6', marginBottom: 4 }}>Messages Sent</p>
            <p style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#FF6B35', fontFamily: 'monospace' }}>
              {loading ? '—' : stats?.messageCount !== null ? stats?.messageCount?.toLocaleString() : 'N/A'}
            </p>
          </div>
          <div style={{ backgroundColor: '#0A0A0C', borderRadius: 10, padding: isMobile ? '10px 12px' : '12px 14px' }}>
            <p style={{ fontSize: 11, color: '#9BA1A6', marginBottom: 4 }}>Status</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: stats?.paused ? '#EF4444' : '#22C55E' }}>
              {loading ? '—' : stats?.isAlive ? (stats.paused ? 'Paused' : 'Active') : 'Not deployed'}
            </p>
          </div>
        </div>
        <div style={{ backgroundColor: '#0A0A0C', borderRadius: 10, padding: isMobile ? '10px 12px' : '12px 14px', marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: '#9BA1A6', marginBottom: 4 }}>Contract Address</p>
          <code style={{
            fontSize: isMobile ? 10 : 11,
            color: '#ECEDEE',
            fontFamily: 'monospace',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: isMobile ? 'nowrap' : 'normal',
            wordBreak: isMobile ? 'normal' : 'break-all',
          }}>{isMobile ? `${address.slice(0, 16)}...${address.slice(-10)}` : address}</code>
        </div>
        <a href={`${cfg.explorerUrl}/address/${address}`} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', textAlign: 'center', padding: '10px', backgroundColor: '#2A2A2E', borderRadius: 8, color: '#9BA1A6', textDecoration: 'none', fontSize: 13 }}>
          View on {cfg.name === 'Base' ? 'Basescan' : 'Snowtrace'} ↗
        </a>
      </div>
    );
  };

  return (
    <div style={{ padding: isMobile ? '16px 16px 32px' : 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#ECEDEE', marginBottom: 8 }}>Cross-Chain Bridge</h1>
        <p style={{ fontSize: isMobile ? 13 : 14, color: '#9BA1A6', lineHeight: 1.6 }}>The VaultfireTeleporterBridge enables cross-chain communication between Base and Avalanche.</p>
      </div>

      {/* Bridge Architecture Diagram */}
      <div style={{ backgroundColor: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: 14, padding: isMobile ? 16 : 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#ECEDEE', marginBottom: 16 }}>Bridge Architecture</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 10 : 16, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', padding: isMobile ? '10px 16px' : '12px 20px', backgroundColor: '#00D9FF20', border: '1px solid #00D9FF40', borderRadius: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#00D9FF' }}>Base</p>
            <p style={{ fontSize: 11, color: '#9BA1A6' }}>Chain ID 8453</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 20 }}>⟷</div>
            <div style={{ padding: '4px 10px', backgroundColor: '#FF6B3520', border: '1px solid #FF6B35', borderRadius: 6 }}>
              <p style={{ fontSize: 10, color: '#FF6B35', fontWeight: 600 }}>TELEPORTER</p>
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: isMobile ? '10px 16px' : '12px 20px', backgroundColor: '#E8414220', border: '1px solid #E8414240', borderRadius: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#E84142' }}>Avalanche</p>
            <p style={{ fontSize: 11, color: '#9BA1A6' }}>Chain ID 43114</p>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#9BA1A6', textAlign: 'center', marginTop: 12 }}>Messages relayed trustlessly using Avalanche Warp Messaging (AWM)</p>
      </div>

      {/* Bridge Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <BridgeCard chain="base" stats={baseBridge} chainResult={baseChain} address={BASE_BRIDGE.address} />
        <BridgeCard chain="avalanche" stats={avaxBridge} chainResult={avaxChain} address={AVAX_BRIDGE.address} />
      </div>

      <button onClick={loadData} disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: loading ? '#2A2A2E' : '#FF6B35',
          border: 'none',
          borderRadius: 10,
          color: loading ? '#9BA1A6' : '#0A0A0C',
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? 'default' : 'pointer',
          width: isMobile ? '100%' : 'auto',
        }}>
        {loading ? 'Loading...' : 'Refresh Bridge Data'}
      </button>
    </div>
  );
}
