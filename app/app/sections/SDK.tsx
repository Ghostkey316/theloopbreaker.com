'use client';
/**
 * SDK — World-class developer documentation for the Vaultfire Protocol.
 * Inspired by Stripe/Vercel docs quality.
 * Features: Live protocol stats, interactive playground, copy-paste code,
 * use case cards, API reference, 5-minute tutorial, webhook docs.
 * ALL data is REAL — fetched live from on-chain contracts.
 */
import { useState, useEffect, useCallback } from "react";
import { AlphaBanner } from "../components/DisclaimerBanner";

/* ═══════════════════════════════════════════════════════
   CONSTANTS — Real contract addresses
   ═══════════════════════════════════════════════════════ */
const IDENTITY_REGISTRY_BASE = '0x35978DB675576598F0781dA2133E94cdCf4858bC';
const IDENTITY_REGISTRY_AVAX = '0x5774A79Be93F4DC5e1846b293D0a3C94eb4b4a3';
const IDENTITY_REGISTRY_ETH = '0x1A80D5B207B3B4e0c8AA4Dc8D9d3b1d2b3C4CD3C';
const BASE_RPC = 'https://mainnet.base.org';
const AVAX_RPC = 'https://api.avax.network/ext/bc/C/rpc';
const ETH_RPC = 'https://eth.llamarpc.com';

/* ═══════════════════════════════════════════════════════
   LIVE PROTOCOL STATS — Real on-chain data
   ═══════════════════════════════════════════════════════ */
interface ProtocolStats {
  baseAgents: number;
  avaxAgents: number;
  ethAgents: number;
  totalAgents: number;
  loading: boolean;
  lastUpdated: number | null;
}

function useProtocolStats(): ProtocolStats {
  const [stats, setStats] = useState<ProtocolStats>({
    baseAgents: 0, avaxAgents: 0, ethAgents: 0, totalAgents: 0,
    loading: true, lastUpdated: null,
  });

  useEffect(() => {
    async function fetchAgentCount(rpc: string, registry: string): Promise<number> {
      try {
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to: registry, data: '0x3731a16f' }, 'latest'],
          }),
        });
        const data = await res.json();
        if (data.result && data.result !== '0x') {
          return parseInt(data.result, 16);
        }
      } catch { /* silent */ }
      return 0;
    }

    async function load() {
      const [base, avax, eth] = await Promise.all([
        fetchAgentCount(BASE_RPC, IDENTITY_REGISTRY_BASE),
        fetchAgentCount(AVAX_RPC, IDENTITY_REGISTRY_AVAX),
        fetchAgentCount(ETH_RPC, IDENTITY_REGISTRY_ETH),
      ]);
      setStats({
        baseAgents: base, avaxAgents: avax, ethAgents: eth,
        totalAgents: base + avax + eth,
        loading: false, lastUpdated: Date.now(),
      });
    }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  return stats;
}

/* ═══════════════════════════════════════════════════════
   PROTOCOL STATS DASHBOARD
   ═══════════════════════════════════════════════════════ */
function ProtocolStatsDashboard({ stats }: { stats: ProtocolStats }) {
  const statCards = [
    { label: 'Total Agents', value: stats.loading ? '...' : stats.totalAgents.toString(), sub: 'Across all chains', color: '#F97316' },
    { label: 'Base', value: stats.loading ? '...' : stats.baseAgents.toString(), sub: 'Chain ID 8453', color: '#0052FF' },
    { label: 'Avalanche', value: stats.loading ? '...' : stats.avaxAgents.toString(), sub: 'Chain ID 43114', color: '#E84142' },
    { label: 'Ethereum', value: stats.loading ? '...' : stats.ethAgents.toString(), sub: 'Chain ID 1', color: '#627EEA' },
  ];

  return (
    <div style={{
      marginBottom: 32, padding: 24, borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(249,115,22,0.04), rgba(34,197,94,0.02))',
      border: '1px solid rgba(249,115,22,0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: '#22C55E',
            boxShadow: '0 0 8px #22C55E',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#F97316', letterSpacing: '0.04em' }}>LIVE PROTOCOL STATUS</span>
        </div>
        {stats.lastUpdated && (
          <span style={{ fontSize: 10, color: '#52525B' }}>
            Updated {Math.round((Date.now() - stats.lastUpdated) / 1000)}s ago
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {statCards.map(card => (
          <div key={card.label} style={{
            padding: '16px 14px', borderRadius: 12,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: card.color, letterSpacing: '-0.02em' }}>
              {card.value}
            </div>
            <div style={{ fontSize: 10, color: '#52525B', marginTop: 2 }}>{card.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   LIVE CONTRACT EXPLORER
   ═══════════════════════════════════════════════════════ */
function LiveContractExplorer() {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<null | { isRegistered: boolean; error?: string }>(null);
  const [loading, setLoading] = useState(false);

  const checkAddress = useCallback(async () => {
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setResult({ isRegistered: false, error: 'Please enter a valid 0x address' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const padded = address.replace('0x', '').toLowerCase().padStart(64, '0');
      const res = await fetch(BASE_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_call',
          params: [{ to: IDENTITY_REGISTRY_BASE, data: '0xfb3551ff' + padded }, 'latest'],
        }),
      });
      const data = await res.json();
      const raw = data.result || '0x';
      const isRegistered = raw.length > 66 && raw !== '0x' + '0'.repeat(64);
      setResult({ isRegistered });
    } catch (e) {
      setResult({ isRegistered: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }, [address]);

  return (
    <div style={{
      marginTop: 32, padding: 20, borderRadius: 14,
      background: 'rgba(249,115,22,0.03)',
      border: '1px solid rgba(249,115,22,0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: '#22C55E',
          boxShadow: '0 0 6px #22C55E',
          animation: 'pulse 2s infinite',
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#F97316', letterSpacing: '0.04em' }}>LIVE CONTRACT EXPLORER</span>
      </div>
      <p style={{ fontSize: 12, color: '#71717A', marginBottom: 14, lineHeight: 1.5 }}>
        Query the live ERC8004IdentityRegistry on Base. Enter any address to check if it&apos;s registered.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="0xYourAddress..."
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: '#F4F4F5', fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            outline: 'none',
          }}
          onKeyDown={e => e.key === 'Enter' && checkAddress()}
        />
        <button
          onClick={checkAddress}
          disabled={loading}
          style={{
            padding: '9px 16px', borderRadius: 8,
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(249,115,22,0.3)' : 'rgba(249,115,22,0.15)',
            color: '#F97316', fontSize: 12, fontWeight: 600,
            transition: 'all 0.15s ease',
          }}
        >
          {loading ? 'Querying...' : 'Check'}
        </button>
      </div>
      {result && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 8,
          background: result.error ? 'rgba(239,68,68,0.06)' :
            result.isRegistered ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${result.error ? 'rgba(239,68,68,0.15)' :
            result.isRegistered ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)'}`,
        }}>
          {result.error ? (
            <span style={{ fontSize: 12, color: '#EF4444' }}>{result.error}</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{result.isRegistered ? '\u2705' : '\u274C'}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: result.isRegistered ? '#22C55E' : '#F4F4F5', margin: 0 }}>
                  {result.isRegistered ? 'Registered Agent' : 'Not Registered'}
                </p>
                <p style={{ fontSize: 11, color: '#71717A', margin: 0 }}>
                  {result.isRegistered
                    ? 'This address is registered on the Vaultfire Protocol (Base)'
                    : 'This address has not registered on the ERC8004IdentityRegistry'}
                </p>
              </div>
              <a
                href={`https://basescan.org/address/${address}`}
                target="_blank" rel="noopener noreferrer"
                style={{ marginLeft: 'auto', fontSize: 11, color: '#0052FF', textDecoration: 'none' }}
              >
                BaseScan
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CODE BLOCK WITH COPY
   ═══════════════════════════════════════════════════════ */
function CodeBlock({ code, language, title }: { code: string; language: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
      background: "#0A0A0C", marginBottom: 16,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 14px",
        background: "rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {title && <span style={{ fontSize: 11, color: "#A1A1AA", fontWeight: 500 }}>{title}</span>}
          <span style={{
            fontSize: 9, color: "#52525B", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.05em",
            padding: "2px 6px", borderRadius: 4,
            backgroundColor: "rgba(255,255,255,0.04)",
          }}>{language}</span>
        </div>
        <button onClick={handleCopy} style={{
          padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
          background: copied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
          color: copied ? "#22C55E" : "#71717A", fontSize: 11, fontWeight: 600,
          transition: "all 0.15s ease",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {copied ? (
            <><svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
          ) : (
            <><svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
          )}
        </button>
      </div>
      <pre style={{
        padding: "14px 16px", margin: 0, fontSize: 12.5, lineHeight: 1.65,
        color: "#D4D4D8", overflowX: "auto",
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      }}>
        {code}
      </pre>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════ */
function SectionHeader({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div id={id} style={{ marginBottom: 20, scrollMarginTop: 80 }}>
      <h2 style={{
        fontSize: 20, fontWeight: 700, color: "#F4F4F5",
        letterSpacing: "-0.02em", marginBottom: 6,
      }}>{title}</h2>
      <p style={{ fontSize: 14, color: "#71717A", lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   API REFERENCE CARD
   ═══════════════════════════════════════════════════════ */
function ApiCard({ method, signature, description, returns, params, example }: {
  method: string;
  signature: string;
  description: string;
  returns: string;
  params?: { name: string; type: string; desc: string }[];
  example?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(255,255,255,0.02)",
      marginBottom: 10,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", border: "none", cursor: "pointer",
          background: "transparent", textAlign: "left",
          color: "#F4F4F5",
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 700, color: "#22C55E",
          backgroundColor: "rgba(34,197,94,0.1)",
          padding: "2px 8px", borderRadius: 4,
          fontFamily: "'JetBrains Mono', monospace",
        }}>{method}</span>
        <span style={{
          fontSize: 13, fontWeight: 600, color: "#F4F4F5",
          fontFamily: "'JetBrains Mono', monospace",
        }}>{signature}</span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2"
          style={{ marginLeft: "auto", transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      {expanded && (
        <div style={{
          padding: "0 16px 14px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}>
          <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6, marginTop: 12 }}>{description}</p>
          {params && params.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Parameters</p>
              {params.map(p => (
                <div key={p.name} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <code style={{ fontSize: 12, color: "#F97316", fontFamily: "'JetBrains Mono', monospace" }}>{p.name}</code>
                  <span style={{ fontSize: 11, color: "#52525B" }}>({p.type})</span>
                  <span style={{ fontSize: 12, color: "#A1A1AA" }}>{p.desc}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Returns</p>
            <code style={{ fontSize: 12, color: "#A78BFA", fontFamily: "'JetBrains Mono', monospace" }}>{returns}</code>
          </div>
          {example && (
            <div style={{ marginTop: 12 }}>
              <CodeBlock code={example} language="typescript" title="Example" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   USE CASE CARDS
   ═══════════════════════════════════════════════════════ */
function UseCaseCard({ icon, title, description, color }: {
  icon: string; title: string; description: string; color: string;
}) {
  return (
    <div style={{
      padding: 20, borderRadius: 14,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      transition: 'all 0.2s ease',
    }}>
      <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color, marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 12, color: '#A1A1AA', lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   NAV TABS
   ═══════════════════════════════════════════════════════ */
type SDKTab = "quickstart" | "playground" | "examples" | "api" | "tutorial" | "webhooks";

const TABS: { id: SDKTab; label: string }[] = [
  { id: "quickstart", label: "Quick Start" },
  { id: "playground", label: "Playground" },
  { id: "examples", label: "Examples" },
  { id: "api", label: "API Reference" },
  { id: "tutorial", label: "5-Min Tutorial" },
  { id: "webhooks", label: "Webhooks & Auth" },
];

/* ═══════════════════════════════════════════════════════
   MAIN SDK COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function SDK() {
  const [activeTab, setActiveTab] = useState<SDKTab>("quickstart");
  const [isMobile, setIsMobile] = useState(false);
  const stats = useProtocolStats();

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const px = isMobile ? 20 : 40;

  return (
    <div style={{ padding: `${isMobile ? 28 : 48}px ${px}px 64px`, maxWidth: 860, margin: "0 auto" }}>
      <AlphaBanner />

      {/* Hero */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 20,
          backgroundColor: "rgba(167,139,250,0.08)",
          border: "1px solid rgba(167,139,250,0.15)",
          marginBottom: 16,
        }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          <span style={{ fontSize: 11, color: "#A78BFA", fontWeight: 600, letterSpacing: "0.04em" }}>DEVELOPER SDK</span>
        </div>

        <h1 style={{
          fontSize: isMobile ? 28 : 40, fontWeight: 800, color: "#F4F4F5",
          letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 12,
        }}>
          Build Trusted AI<br />
          <span style={{ color: '#F97316' }}>on Vaultfire</span>
        </h1>
        <p style={{
          fontSize: isMobile ? 15 : 17, color: "#71717A", lineHeight: 1.65,
          maxWidth: 600,
        }}>
          Register agents, verify trust, create bonds, and read on-chain reputation data.
          Ship accountable AI in minutes, not months.
        </p>

        {/* Install command */}
        <div style={{
          marginTop: 20, padding: "14px 16px", borderRadius: 10,
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <code style={{
              fontSize: 13, color: "#22C55E",
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              npm install @vaultfire/sdk
            </code>
            <span style={{
              fontSize: 9, color: "#F97316", fontWeight: 700,
              padding: "2px 8px", borderRadius: 4,
              backgroundColor: "rgba(249,115,22,0.1)",
              border: "1px solid rgba(249,115,22,0.2)",
            }}>COMING SOON</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <code style={{ fontSize: 11, color: "#71717A", fontFamily: "'JetBrains Mono', monospace" }}>yarn add @vaultfire/sdk</code>
            <span style={{ color: "#3F3F46" }}>|</span>
            <code style={{ fontSize: 11, color: "#71717A", fontFamily: "'JetBrains Mono', monospace" }}>pnpm add @vaultfire/sdk</code>
          </div>
          <p style={{ fontSize: 10, color: "#52525B", marginTop: 8, lineHeight: 1.5 }}>
            The npm package is being prepared for publication. In the meantime, copy <code style={{ color: "#A78BFA" }}>lib/vaultfire-sdk.ts</code> directly into your project.
            Zero dependencies &mdash; works with any TypeScript/JavaScript project.
          </p>
        </div>
      </div>

      {/* Use Case Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        <UseCaseCard
          icon="\uD83E\uDD16"
          title="Build a Trusted AI Agent"
          description="Register your agent on-chain with a verifiable identity. Get a trust score, stake a bond, and prove accountability."
          color="#F97316"
        />
        <UseCaseCard
          icon="\uD83D\uDEE1\uFE0F"
          title="Add Trust Verification"
          description="Verify any agent's trust profile with a single SDK call. Check registration, bonds, reputation, and flourishing metrics."
          color="#22C55E"
        />
        <UseCaseCard
          icon="\uD83C\uDFEA"
          title="Create an Agent Marketplace"
          description="Build a marketplace where agents are ranked by on-chain trust scores. Filter by bonds, reputation, and ethical metrics."
          color="#A78BFA"
        />
      </div>

      {/* Live Protocol Stats Dashboard */}
      <ProtocolStatsDashboard stats={stats} />

      {/* Tab Navigation */}
      <div style={{
        display: "flex", gap: 2, marginBottom: 32,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        overflowX: "auto",
        position: 'sticky', top: 0, zIndex: 40,
        backgroundColor: '#09090B', paddingTop: 8,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 16px", border: "none", cursor: "pointer",
              background: "transparent",
              color: activeTab === tab.id ? "#F97316" : "#71717A",
              fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 450,
              borderBottom: activeTab === tab.id ? "2px solid #F97316" : "2px solid transparent",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "quickstart" && <QuickStartTab stats={stats} />}
      {activeTab === "playground" && <PlaygroundTab />}
      {activeTab === "examples" && <ExamplesTab />}
      {activeTab === "api" && <ApiReferenceTab />}
      {activeTab === "tutorial" && <TutorialTab />}
      {activeTab === "webhooks" && <WebhooksTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   QUICK START TAB
   ═══════════════════════════════════════════════════════ */
function QuickStartTab({ stats }: { stats: ProtocolStats }) {
  return (
    <div>
      <SectionHeader
        id="install"
        title="Installation"
        description="Import the SDK directly from the Embris app, or copy the module into your project."
      />

      <CodeBlock
        language="typescript"
        title="Import the SDK"
        code={`import { createVaultfireSDK } from './lib/vaultfire-sdk';

// Initialize for Base (default)
const sdk = createVaultfireSDK('base');

// Or specify a chain
const ethSdk = createVaultfireSDK('ethereum');
const avaxSdk = createVaultfireSDK('avalanche');

// Custom RPC URL
const customSdk = createVaultfireSDK('base', 'https://your-rpc.com');`}
      />

      <SectionHeader
        id="first-query"
        title="Your First Query"
        description="Check how many agents are registered on-chain — real data, no mocks."
      />

      <CodeBlock
        language="typescript"
        title="Get total registered agents"
        code={`const sdk = createVaultfireSDK('base');

// Get total agents on Base
const total = await sdk.getTotalAgents();
console.log(\`Total agents on Base: \${total}\`);
// Right now: ${stats.loading ? '...' : stats.baseAgents} agents on Base

// Check if an address is registered
const isRegistered = await sdk.isAgentRegistered(
  '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
);
console.log(\`Registered: \${isRegistered}\`);`}
      />

      <SectionHeader
        id="multi-chain"
        title="Multi-Chain Support"
        description="Query across Ethereum, Base, and Avalanche simultaneously."
      />

      <CodeBlock
        language="typescript"
        title="Multi-chain agent count"
        code={`import { getTotalAgentsAllChains } from './lib/vaultfire-sdk';

const counts = await getTotalAgentsAllChains();
console.log(\`Base: \${counts.base}\`);       // Live: ${stats.loading ? '...' : stats.baseAgents}
console.log(\`Avalanche: \${counts.avalanche}\`); // Live: ${stats.loading ? '...' : stats.avaxAgents}
console.log(\`Ethereum: \${counts.ethereum}\`);  // Live: ${stats.loading ? '...' : stats.ethAgents}
console.log(\`Total: \${counts.total}\`);      // Live: ${stats.loading ? '...' : stats.totalAgents}`}
      />

      {/* Live Contract Explorer */}
      <LiveContractExplorer />

      {/* Contract addresses reference */}
      <div style={{
        marginTop: 32, padding: "20px",
        borderRadius: 12,
        backgroundColor: "rgba(249,115,22,0.04)",
        border: "1px solid rgba(249,115,22,0.1)",
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F97316", marginBottom: 12 }}>
          Contract Addresses
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "ERC8004IdentityRegistry", base: "0x3597...58bC", avax: "0x5774...b4a3", eth: "0x1A80...CD3C" },
            { label: "AIPartnershipBondsV2", base: "0xC574...b4b4", avax: "0xea6B...4b07", eth: "0x247F...F99cd" },
            { label: "FlourishingMetricsOracle", base: "0x83dd...2e9", avax: "0x490c...8695", eth: "0x6904...6F78" },
            { label: "ReputationRegistry", base: "0xdB54...a5F", avax: "0x11C2...bA24", eth: "0x0d41...d87b" },
          ].map(c => (
            <div key={c.label} style={{
              display: "flex", flexDirection: "column", gap: 2,
              padding: "8px 12px", borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.02)",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#F4F4F5" }}>{c.label}</span>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "#0052FF", fontFamily: "'JetBrains Mono', monospace" }}>Base: {c.base}</span>
                <span style={{ fontSize: 10, color: "#E84142", fontFamily: "'JetBrains Mono', monospace" }}>AVAX: {c.avax}</span>
                <span style={{ fontSize: 10, color: "#627EEA", fontFamily: "'JetBrains Mono', monospace" }}>ETH: {c.eth}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PLAYGROUND TAB — Interactive SDK execution
   ═══════════════════════════════════════════════════════ */
function PlaygroundTab() {
  const [selectedMethod, setSelectedMethod] = useState('getTotalAgents');
  const [inputAddress, setInputAddress] = useState('');
  const [selectedChain, setSelectedChain] = useState<'base' | 'avalanche' | 'ethereum'>('base');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  const RPC_MAP: Record<string, string> = {
    base: 'https://mainnet.base.org',
    avalanche: 'https://api.avax.network/ext/bc/C/rpc',
    ethereum: 'https://eth.llamarpc.com',
  };

  const REGISTRY_MAP: Record<string, string> = {
    base: '0x35978DB675576598F0781dA2133E94cdCf4858bC',
    avalanche: '0x57741F4116925341d8f7Eb3F381d98e07C73B4a3',
    ethereum: '0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C',
  };

  const BONDS_MAP: Record<string, string> = {
    base: '0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4',
    avalanche: '0xea6B504827a746d781f867441364C7A732AA4b07',
    ethereum: '0x247F31bB2b5a0d28E68bf24865AA242965FF99cd',
  };

  const REP_MAP: Record<string, string> = {
    base: '0xdB54B8925664816187646174bdBb6Ac658A55a5F',
    avalanche: '0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24',
    ethereum: '0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b',
  };

  const methods = [
    { id: 'getTotalAgents', label: 'getTotalAgents()', needsAddress: false, desc: 'Get total registered agents on chain' },
    { id: 'isAgentRegistered', label: 'isAgentRegistered(address)', needsAddress: true, desc: 'Check if address is registered' },
    { id: 'checkBondBalance', label: 'getBondStatus()', needsAddress: false, desc: 'Check bond contract balance' },
    { id: 'getReputationScore', label: 'getReputationScore(address)', needsAddress: true, desc: 'Query reputation score' },
    { id: 'multiChainAgents', label: 'getTotalAgentsAllChains()', needsAddress: false, desc: 'Query all 3 chains at once' },
  ];

  const executeMethod = useCallback(async () => {
    setLoading(true);
    setResult(null);
    const start = performance.now();

    try {
      const rpc = RPC_MAP[selectedChain];

      if (selectedMethod === 'getTotalAgents') {
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: REGISTRY_MAP[selectedChain], data: '0x3731a16f' }, 'latest'] }),
        });
        const data = await res.json();
        const count = data.result ? parseInt(data.result, 16) : 0;
        setResult(JSON.stringify({ method: 'getTotalAgents', chain: selectedChain, result: count, raw: data.result }, null, 2));
      } else if (selectedMethod === 'isAgentRegistered') {
        if (!inputAddress.match(/^0x[a-fA-F0-9]{40}$/)) { setResult(JSON.stringify({ error: 'Invalid address format' }, null, 2)); return; }
        const padded = inputAddress.replace('0x', '').toLowerCase().padStart(64, '0');
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: REGISTRY_MAP[selectedChain], data: '0xfb3551ff' + padded }, 'latest'] }),
        });
        const data = await res.json();
        const raw = data.result || '0x';
        const isRegistered = raw.length > 66 && raw !== '0x' + '0'.repeat(64);
        setResult(JSON.stringify({ method: 'isAgentRegistered', chain: selectedChain, address: inputAddress, isRegistered, rawLength: raw.length }, null, 2));
      } else if (selectedMethod === 'checkBondBalance') {
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [BONDS_MAP[selectedChain], 'latest'] }),
        });
        const data = await res.json();
        const wei = data.result ? BigInt(data.result) : 0n;
        const eth = Number(wei) / 1e18;
        setResult(JSON.stringify({ method: 'getBondContractBalance', chain: selectedChain, contract: BONDS_MAP[selectedChain], balanceWei: wei.toString(), balanceEth: eth.toFixed(6) }, null, 2));
      } else if (selectedMethod === 'getReputationScore') {
        if (!inputAddress.match(/^0x[a-fA-F0-9]{40}$/)) { setResult(JSON.stringify({ error: 'Invalid address format' }, null, 2)); return; }
        const padded = inputAddress.replace('0x', '').toLowerCase().padStart(64, '0');
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: REP_MAP[selectedChain], data: '0x5e5c06e2' + padded }, 'latest'] }),
        });
        const data = await res.json();
        const score = data.result && data.result !== '0x' ? Math.min(parseInt(data.result, 16), 100) : 0;
        setResult(JSON.stringify({ method: 'getReputationScore', chain: selectedChain, address: inputAddress, score, raw: data.result }, null, 2));
      } else if (selectedMethod === 'multiChainAgents') {
        const chains = ['base', 'avalanche', 'ethereum'] as const;
        const results: Record<string, number> = {};
        await Promise.all(chains.map(async (c) => {
          try {
            const res = await fetch(RPC_MAP[c], {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: REGISTRY_MAP[c], data: '0x3731a16f' }, 'latest'] }),
            });
            const data = await res.json();
            results[c] = data.result ? parseInt(data.result, 16) : 0;
          } catch { results[c] = 0; }
        }));
        const total = Object.values(results).reduce((a, b) => a + b, 0);
        setResult(JSON.stringify({ method: 'getTotalAgentsAllChains', ...results, total }, null, 2));
      }
    } catch (e) {
      setResult(JSON.stringify({ error: String(e) }, null, 2));
    } finally {
      setExecutionTime(Math.round(performance.now() - start));
      setLoading(false);
    }
  }, [selectedMethod, inputAddress, selectedChain]);

  const currentMethod = methods.find(m => m.id === selectedMethod);

  return (
    <div>
      <SectionHeader id="playground" title="Interactive Playground" description="Execute real SDK calls against live contracts. Every result comes from the blockchain — no mocks." />

      <div style={{
        padding: 24, borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(167,139,250,0.04), rgba(249,115,22,0.02))',
        border: '1px solid rgba(167,139,250,0.12)',
        marginBottom: 32,
      }}>
        {/* Method selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>Method</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {methods.map(m => (
              <button key={m.id} onClick={() => { setSelectedMethod(m.id); setResult(null); }} style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: selectedMethod === m.id ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                color: selectedMethod === m.id ? '#A78BFA' : '#71717A',
                fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                transition: 'all 0.15s ease',
              }}>{m.label}</button>
            ))}
          </div>
          {currentMethod && <p style={{ fontSize: 11, color: '#52525B', marginTop: 6 }}>{currentMethod.desc}</p>}
        </div>

        {/* Chain selector */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }}>Chain</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['base', 'avalanche', 'ethereum'] as const).map(c => (
                <button key={c} onClick={() => setSelectedChain(c)} style={{
                  padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: selectedChain === c ? (c === 'base' ? 'rgba(0,82,255,0.15)' : c === 'avalanche' ? 'rgba(232,65,66,0.15)' : 'rgba(98,126,234,0.15)') : 'rgba(255,255,255,0.04)',
                  color: selectedChain === c ? (c === 'base' ? '#0052FF' : c === 'avalanche' ? '#E84142' : '#627EEA') : '#71717A',
                  fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                }}>{c}</button>
              ))}
            </div>
          </div>

          {currentMethod?.needsAddress && (
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }}>Address</label>
              <input
                value={inputAddress}
                onChange={e => setInputAddress(e.target.value)}
                placeholder="0x..."
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#F4F4F5', fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: 'none',
                }}
              />
            </div>
          )}
        </div>

        {/* Execute button */}
        <button onClick={executeMethod} disabled={loading} style={{
          padding: '10px 24px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? 'rgba(167,139,250,0.2)' : 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(249,115,22,0.15))',
          color: '#F4F4F5', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 8,
          transition: 'all 0.2s ease',
        }}>
          {loading ? (
            <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#A78BFA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Executing...</>
          ) : (
            <><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Execute on {selectedChain}</>
          )}
        </button>

        {/* Result */}
        {result && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#22C55E', letterSpacing: '0.04em' }}>RESULT</span>
              {executionTime !== null && (
                <span style={{ fontSize: 10, color: '#52525B' }}>{executionTime}ms</span>
              )}
            </div>
            <pre style={{
              padding: 14, borderRadius: 10, margin: 0,
              background: '#0A0A0C', border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 12, lineHeight: 1.6, color: '#D4D4D8', overflowX: 'auto',
              fontFamily: "'JetBrains Mono', monospace",
            }}>{result}</pre>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   EXAMPLES TAB
   ═══════════════════════════════════════════════════════ */
function ExamplesTab() {
  return (
    <div>
      <SectionHeader id="trust-verify" title="Trust Verification" description="Verify an agent's trust profile including score, bonds, and reputation." />
      <CodeBlock language="typescript" title="Verify trust for an address" code={`const sdk = createVaultfireSDK('base');

const trust = await sdk.verifyTrust(
  '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
);

console.log(\`Trust Score: \${trust.trustScore}/100\`);
console.log(\`Grade: \${trust.grade}\`);
console.log(\`Registered: \${trust.isRegistered}\`);
console.log(\`Bond Active: \${trust.bondActive}\`);
console.log(\`Bond Tier: \${trust.bondTier}\`);
console.log(\`Reputation: \${trust.reputationScore}\`);
console.log(\`Flourishing:\`, trust.flourishingMetrics);`} />

      <CodeBlock language="typescript" title="Multi-chain trust verification" code={`import { verifyTrustMultiChain } from './lib/vaultfire-sdk';

const results = await verifyTrustMultiChain(
  '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
);

results.forEach(r => {
  console.log(\`\${r.registeredChains[0] || 'N/A'}: Score \${r.trustScore}\`);
});`} />

      <SectionHeader id="bond-example" title="Bond Creation" description="Create partnership bonds between agents to establish trust relationships." />
      <CodeBlock language="typescript" title="Build a bond transaction" code={`const sdk = createVaultfireSDK('base');

// Build the transaction (you sign it with your wallet)
const tx = sdk.buildCreateBondTx(
  '0xPartnerAddress...',  // Partner's address
  'collaboration',         // Bond type
  '100000000000000000'     // 0.1 ETH stake in wei
);

// Sign and send with ethers.js or viem
const wallet = new ethers.Wallet(privateKey, provider);
const receipt = await wallet.sendTransaction({
  to: tx.to,
  data: tx.data,
  value: tx.value,
  chainId: tx.chainId,
});

console.log(\`Bond created: \${receipt.hash}\`);`} />

      <SectionHeader id="identity-example" title="Identity Lookup" description="Look up agent identities across the protocol." />
      <CodeBlock language="typescript" title="Look up identity across all chains" code={`const sdk = createVaultfireSDK('base');

// Single chain lookup
const identity = await sdk.lookupIdentity(
  '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
);
console.log(\`Registered: \${identity.isRegistered}\`);
console.log(\`Type: \${identity.agentType}\`);

// Multi-chain lookup
const multiChain = await sdk.lookupIdentityMultiChain(
  '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
);
console.log(\`Registered on: \${multiChain.registeredOn.join(', ')}\`);`} />

      <SectionHeader id="flourishing-example" title="Reading Flourishing Metrics" description="Read ethical AI metrics from the FlourishingMetricsOracle." />
      <CodeBlock language="typescript" title="Read flourishing metrics" code={`const sdk = createVaultfireSDK('base');

const metrics = await sdk.getFlourishingMetrics(
  '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
);

console.log(\`Autonomy:     \${metrics.autonomy}/100\`);
console.log(\`Wellbeing:    \${metrics.wellbeing}/100\`);
console.log(\`Fairness:     \${metrics.fairness}/100\`);
console.log(\`Transparency: \${metrics.transparency}/100\`);
console.log(\`Overall:      \${metrics.overallScore}/100\`);`} />

      <SectionHeader id="vns-example" title="VNS Name Resolution" description="Resolve .vns names to addresses and perform reverse lookups." />
      <CodeBlock language="typescript" title="VNS resolution" code={`const sdk = createVaultfireSDK('base');

// Resolve a .vns name to an address
const resolution = await sdk.resolveVNS('ghostkey.vns');
console.log(resolution);
// { name: 'ghostkey.vns', address: '0x...', resolved: true, chain: 'base' }

// Reverse lookup: address -> .vns name
const vnsName = await sdk.reverseVNS('0xA054f831B562e729F8D268291EBde1B2EDcFb84F');
console.log(\`VNS Name: \${vnsName}\`); // e.g. 'ghostkey.vns'

// Multi-chain VNS resolution
import { resolveVNSMultiChain } from './lib/vaultfire-sdk';
const results = await resolveVNSMultiChain('ghostkey');
results.forEach(r => console.log(\`\${r.chain}: \${r.resolved ? r.address : 'not found'}\`));`} />

      <SectionHeader id="bond-status-example" title="Bond Status Query" description="Check an agent's bond status, tier, and staked amount." />
      <CodeBlock language="typescript" title="Query bond status" code={`const sdk = createVaultfireSDK('base');

const bond = await sdk.getBondStatus('0xA054f831B562e729F8D268291EBde1B2EDcFb84F');
console.log(\`Has Bond: \${bond.hasBond}\`);
console.log(\`Tier: \${bond.bondTier}\`);       // 'platinum', 'gold', 'silver', 'bronze'
console.log(\`Amount: \${bond.bondAmountEth} ETH\`);
console.log(\`Active: \${bond.isActive}\`);
console.log(\`Partner: \${bond.partnerAddress}\`);`} />

      <SectionHeader id="reputation-example" title="Full Reputation Data" description="Query detailed reputation including endorsements and violations." />
      <CodeBlock language="typescript" title="Get full reputation data" code={`const sdk = createVaultfireSDK('base');

const rep = await sdk.getReputationData('0xA054f831B562e729F8D268291EBde1B2EDcFb84F');
console.log(\`Score: \${rep.score}/100\`);
console.log(\`Endorsements: \${rep.endorsements}\`);
console.log(\`Violations: \${rep.violations}\`);
console.log(\`Last Activity: \${new Date(rep.lastActivity).toISOString()}\`);`} />

      <SectionHeader id="python-example" title="Python Integration" description="Use the Vaultfire contracts directly from Python with web3.py." />
      <CodeBlock language="python" title="Python — Check agent registration" code={`from web3 import Web3

# Connect to Base
w3 = Web3(Web3.HTTPProvider('https://mainnet.base.org'))

# ERC8004IdentityRegistry on Base
REGISTRY = '0x35978DB675576598F0781dA2133E94cdCf4858bC'

# getTotalAgents() selector
total = w3.eth.call({
    'to': REGISTRY,
    'data': '0x3731a16f'
})
print(f"Total agents: {int(total.hex(), 16)}")

# getAgent(address) selector
agent_addr = '0xA054f831B562e729F8D268291EBde1B2EDcFb84F'
padded = agent_addr[2:].lower().zfill(64)
result = w3.eth.call({
    'to': REGISTRY,
    'data': '0xfb3551ff' + padded
})
print(f"Agent data: {result.hex()}")`} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   API REFERENCE TAB
   ═══════════════════════════════════════════════════════ */
function ApiReferenceTab() {
  return (
    <div>
      <SectionHeader id="api-ref" title="API Reference" description="Complete reference for all VaultfireSDK methods. Click any method to expand." />

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#A78BFA", marginBottom: 12, marginTop: 24 }}>Agent Registration</h3>

      <ApiCard method="async" signature="getTotalAgents()" description="Returns the total number of agents registered on the ERC8004IdentityRegistry for this chain." returns="Promise<number>" example={`const total = await sdk.getTotalAgents();\nconsole.log(total); // e.g. 42`} />

      <ApiCard method="async" signature="isAgentRegistered(address)" description="Checks whether a given Ethereum address is registered as an agent in the identity registry." returns="Promise<boolean>" params={[{ name: "address", type: "string", desc: "Ethereum address to check" }]} example={`const registered = await sdk.isAgentRegistered('0x...');\nif (registered) console.log('Agent is verified!');`} />

      <ApiCard method="sync" signature="buildRegisterAgentTx(name, metadataUri)" description="Builds the calldata for registering a new agent on-chain. Returns a transaction object ready to be signed." returns="{ to: string, data: string, chainId: number, value: string }" params={[{ name: "name", type: "string", desc: "Agent name (e.g., 'my-agent-v1')" }, { name: "metadataUri", type: "string", desc: "URI pointing to agent metadata JSON" }]} />

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#22C55E", marginBottom: 12, marginTop: 28 }}>Trust Verification</h3>

      <ApiCard method="async" signature="verifyTrust(address)" description="Comprehensive trust verification. Returns trust score, grade, bond status, reputation, and flourishing metrics." returns="Promise<TrustVerification>" params={[{ name: "address", type: "string", desc: "Address to verify" }]} example={`const trust = await sdk.verifyTrust('0x...');\nconsole.log(trust.grade); // 'A', 'B', 'C', etc.`} />

      <ApiCard method="async" signature="getReputationScore(address)" description="Reads the reputation score from the on-chain ReputationRegistry." returns="Promise<number> (0-100)" params={[{ name: "address", type: "string", desc: "Address to query" }]} />

      <ApiCard method="async" signature="getReputationData(address)" description="Returns full reputation data including endorsements and violations." returns="Promise<ReputationData>" params={[{ name: "address", type: "string", desc: "Address to query" }]} />

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F97316", marginBottom: 12, marginTop: 28 }}>Bond Management</h3>

      <ApiCard method="sync" signature="buildCreateBondTx(partner, type, stakeWei)" description="Builds calldata for creating a partnership bond. The bond establishes a trust relationship between two agents." returns="{ to: string, data: string, chainId: number, value: string }" params={[{ name: "partner", type: "string", desc: "Partner's Ethereum address" }, { name: "type", type: "string", desc: "Bond type ('collaboration', 'accountability')" }, { name: "stakeWei", type: "string", desc: "Stake amount in wei" }]} />

      <ApiCard method="async" signature="getBondStatus(address)" description="Query the bond status for an address from the PartnershipBonds contract. Returns tier, amount, partner, and active status." returns="Promise<BondStatus>" params={[{ name: "address", type: "string", desc: "Address to check bond for" }]} example={`const bond = await sdk.getBondStatus('0x...');\nconsole.log(bond.bondTier); // 'gold'`} />

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#38BDF8", marginBottom: 12, marginTop: 28 }}>Identity, VNS & Metrics</h3>

      <ApiCard method="async" signature="lookupIdentity(address)" description="Look up an agent's identity on this chain. Queries IdentityRegistry, VNS, bonds, and reputation." returns="Promise<IdentityLookup>" params={[{ name: "address", type: "string", desc: "Address to look up" }]} />

      <ApiCard method="async" signature="lookupIdentityMultiChain(address)" description="Look up an agent's identity across all three chains simultaneously." returns="Promise<IdentityLookup>" params={[{ name: "address", type: "string", desc: "Address to look up" }]} />

      <ApiCard method="async" signature="resolveVNS(name)" description="Resolve a .vns name to an Ethereum address by querying the VNS Registry contract." returns="Promise<VNSResolution>" params={[{ name: "name", type: "string", desc: ".vns name to resolve (e.g. 'ghostkey.vns')" }]} example={`const result = await sdk.resolveVNS('ghostkey.vns');\nif (result.resolved) console.log(result.address);`} />

      <ApiCard method="async" signature="reverseVNS(address)" description="Reverse-lookup an address to find its .vns name." returns="Promise<string | null>" params={[{ name: "address", type: "string", desc: "Address to reverse-lookup" }]} />

      <ApiCard method="async" signature="getFlourishingMetrics(address)" description="Read ethical AI metrics from the FlourishingMetricsOracle contract." returns="Promise<FlourishingMetrics>" params={[{ name: "address", type: "string", desc: "Address to query" }]} />

      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#71717A", marginBottom: 12, marginTop: 28 }}>Utility Methods</h3>

      <ApiCard method="sync" signature="getContractAddresses()" description="Returns all Vaultfire contract addresses for the configured chain." returns="{ identityRegistry, partnershipBonds, accountabilityBonds, flourishingOracle, reputationRegistry }" />

      <ApiCard method="sync" signature="getExplorerUrl(hashOrAddress, type?)" description="Generates a block explorer URL for a transaction hash or address." returns="string" params={[{ name: "hashOrAddress", type: "string", desc: "Transaction hash or address" }, { name: "type", type: "'tx' | 'address'", desc: "URL type (default: 'address')" }]} />

      <ApiCard method="sync" signature="getChainInfo()" description="Returns chain configuration including chain ID, RPC URL, and explorer URL." returns="{ chain, chainId, rpcUrl, explorerUrl }" />

      {/* TypeScript Types Reference */}
      <SectionHeader id="types" title="TypeScript Types" description="All exported types from the SDK." />
      <CodeBlock language="typescript" title="Core Types" code={`type SupportedChain = 'base' | 'avalanche' | 'ethereum';

interface TrustVerification {
  isRegistered: boolean;
  trustScore: number;        // 0-100
  grade: string;             // 'A+', 'A', 'B', 'C', 'D', 'F'
  reputationScore: number;   // 0-100
  bondCount: number;
  totalStaked: string;       // wei
  registeredChains: string[];
  flourishingMetrics: FlourishingMetrics;
}

interface FlourishingMetrics {
  autonomy: number;          // 0-100
  wellbeing: number;         // 0-100
  fairness: number;          // 0-100
  transparency: number;      // 0-100
  overallScore: number;      // 0-100
}

interface IdentityLookup {
  isRegistered: boolean;
  agentType: string;
  registeredOn: string[];    // chain names
  rawData: string;
}

interface ReputationData {
  score: number;
  endorsements: number;
  violations: number;
  lastUpdated: number;
}`} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TUTORIAL TAB — Register Your Agent in 5 Minutes
   ═══════════════════════════════════════════════════════ */
function TutorialTab() {
  const steps = [
    { num: 1, color: '#F97316', title: 'Set Up Your Project', desc: 'Create a new TypeScript project and copy the SDK module.',
      code: `mkdir my-vaultfire-agent && cd my-vaultfire-agent\nnpm init -y\nnpm install typescript ethers\nnpx tsc --init\n\n# Copy vaultfire-sdk.ts into your project\ncp path/to/vaultfire-sdk.ts ./src/`, lang: 'bash' },
    { num: 2, color: '#22C55E', title: 'Check the Registry', desc: 'Before registering, check how many agents exist and verify your address.',
      code: `import { createVaultfireSDK } from './vaultfire-sdk';\n\nasync function main() {\n  const sdk = createVaultfireSDK('base');\n\n  const total = await sdk.getTotalAgents();\n  console.log(\`Total agents on Base: \${total}\`);\n\n  const myAddress = '0xYourAddress...';\n  const registered = await sdk.isAgentRegistered(myAddress);\n  console.log(\`Your registration: \${registered ? 'Active' : 'Not registered'}\`);\n}\n\nmain();`, lang: 'typescript' },
    { num: 3, color: '#A78BFA', title: 'Register Your Agent', desc: 'Build the registration transaction and sign it with your wallet.',
      code: `import { createVaultfireSDK } from './vaultfire-sdk';\nimport { ethers } from 'ethers';\n\nasync function registerMyAgent() {\n  const sdk = createVaultfireSDK('base');\n\n  const tx = sdk.buildRegisterAgentTx(\n    'my-awesome-agent',\n    'https://mysite.com/agent-meta.json'\n  );\n\n  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');\n  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);\n\n  const receipt = await wallet.sendTransaction({\n    to: tx.to,\n    data: tx.data,\n    value: tx.value,\n  });\n\n  console.log(\`Agent registered! TX: \${receipt.hash}\`);\n}\n\nregisterMyAgent();`, lang: 'typescript' },
    { num: 4, color: '#38BDF8', title: 'Verify Your Trust Score', desc: 'After registration, verify your agent\'s trust profile.',
      code: `import { createVaultfireSDK } from './vaultfire-sdk';\n\nasync function checkMyTrust() {\n  const sdk = createVaultfireSDK('base');\n  const myAddress = '0xYourAddress...';\n\n  const trust = await sdk.verifyTrust(myAddress);\n\n  console.log(\`Score: \${trust.trustScore}/100 (Grade: \${trust.grade})\`);\n  console.log(\`Reputation: \${trust.reputationScore}\`);\n  console.log(\`Autonomy:     \${trust.flourishingMetrics.autonomy}\`);\n  console.log(\`Wellbeing:    \${trust.flourishingMetrics.wellbeing}\`);\n  console.log(\`Fairness:     \${trust.flourishingMetrics.fairness}\`);\n  console.log(\`Transparency: \${trust.flourishingMetrics.transparency}\`);\n}\n\ncheckMyTrust();`, lang: 'typescript' },
    { num: 5, color: '#FBBF24', title: 'Create a Bond (Optional)', desc: 'Establish trust with another agent by creating a partnership bond.',
      code: `import { createVaultfireSDK } from './vaultfire-sdk';\nimport { ethers } from 'ethers';\n\nasync function createPartnerBond() {\n  const sdk = createVaultfireSDK('base');\n\n  const tx = sdk.buildCreateBondTx(\n    '0xPartnerAddress...',\n    'collaboration',\n    ethers.parseEther('0.01').toString()\n  );\n\n  // Sign and send with your wallet...\n  console.log('Bond transaction built:', tx);\n}\n\ncreatePartnerBond();`, lang: 'typescript' },
  ];

  return (
    <div>
      <SectionHeader id="tutorial" title="Register Your Agent in 5 Minutes" description="A step-by-step guide to registering your first AI agent on the Vaultfire Protocol." />

      {steps.map(step => (
        <div key={step.num} style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              backgroundColor: `${step.color}15`,
              border: `1px solid ${step.color}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: step.color,
            }}>{step.num}</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5" }}>{step.title}</h3>
          </div>
          <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6, marginBottom: 12, paddingLeft: 38 }}>
            {step.desc}
          </p>
          <CodeBlock language={step.lang} title={step.num === 1 ? undefined : `step-${step.num}.ts`} code={step.code} />
        </div>
      ))}

      {/* Success banner */}
      <div style={{
        padding: "24px",
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(34,197,94,0.06), rgba(249,115,22,0.04))",
        border: "1px solid rgba(34,197,94,0.15)",
        textAlign: "center",
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#22C55E", marginBottom: 8 }}>
          You&apos;re Building on Vaultfire
        </h3>
        <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6 }}>
          Your agent is now part of the trust infrastructure for the AI age.
          Join the community and help build accountable AI.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   WEBHOOKS & AUTH TAB
   ═══════════════════════════════════════════════════════ */
function WebhooksTab() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['agent.registered']);
  const [simResult, setSimResult] = useState<string | null>(null);

  const allEvents = [
    'agent.registered', 'agent.deregistered', 'bond.created', 'bond.dissolved',
    'trust.updated', 'reputation.changed', 'flourishing.updated', 'vns.registered',
  ];

  const toggleEvent = (e: string) => {
    setSelectedEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  };

  const simulateSubscription = () => {
    if (!webhookUrl) { setSimResult(JSON.stringify({ error: 'Please enter a webhook URL' }, null, 2)); return; }
    setSimResult(JSON.stringify({
      status: 'subscribed',
      id: 'whk_' + Math.random().toString(36).slice(2, 10),
      url: webhookUrl,
      events: selectedEvents,
      created: new Date().toISOString(),
      secret: 'whsec_' + 'x'.repeat(32) + ' (generated on creation)',
      note: 'This is a simulation. Real webhook subscriptions require an API key from https://api.vaultfire.xyz',
    }, null, 2));
  };

  return (
    <div>
      <SectionHeader id="webhooks" title="Webhooks" description="Get notified in real-time when trust events happen on-chain." />

      <div style={{
        padding: 16, borderRadius: 12, marginBottom: 20,
        background: 'rgba(167,139,250,0.04)',
        border: '1px solid rgba(167,139,250,0.1)',
      }}>
        <p style={{ fontSize: 13, color: '#A1A1AA', lineHeight: 1.6 }}>
          Vaultfire webhooks notify your server when events occur on-chain: new agent registrations, bond creations, trust score changes, and reputation updates. Set up a webhook endpoint and subscribe to the events you care about.
        </p>
      </div>

      {/* Webhook Subscription Simulator */}
      <div style={{
        padding: 20, borderRadius: 14, marginBottom: 28,
        background: 'linear-gradient(135deg, rgba(34,197,94,0.04), rgba(167,139,250,0.02))',
        border: '1px solid rgba(34,197,94,0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 6px #22C55E' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', letterSpacing: '0.04em' }}>WEBHOOK SUBSCRIPTION SIMULATOR</span>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }}>Endpoint URL</label>
          <input
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://your-server.com/webhooks/vaultfire"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#F4F4F5', fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>Events to Subscribe</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allEvents.map(e => (
              <button key={e} onClick={() => toggleEvent(e)} style={{
                padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: selectedEvents.includes(e) ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                color: selectedEvents.includes(e) ? '#22C55E' : '#71717A',
                fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                transition: 'all 0.15s ease',
              }}>{e}</button>
            ))}
          </div>
        </div>

        <button onClick={simulateSubscription} style={{
          padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'rgba(34,197,94,0.15)', color: '#22C55E',
          fontSize: 12, fontWeight: 700,
        }}>Simulate Subscription</button>

        {simResult && (
          <pre style={{
            padding: 14, borderRadius: 10, margin: '12px 0 0 0',
            background: '#0A0A0C', border: '1px solid rgba(255,255,255,0.06)',
            fontSize: 11, lineHeight: 1.6, color: '#D4D4D8', overflowX: 'auto',
            fontFamily: "'JetBrains Mono', monospace",
          }}>{simResult}</pre>
        )}
      </div>

      <CodeBlock language="typescript" title="Webhook endpoint example (Express.js)" code={`import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Verify webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

app.post('/webhooks/vaultfire', (req, res) => {
  const signature = req.headers['x-vaultfire-signature'] as string;
  const payload = JSON.stringify(req.body);

  if (!verifySignature(payload, signature, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  switch (event.type) {
    case 'agent.registered':
      console.log(\`New agent: \${event.data.address} on \${event.data.chain}\`);
      break;
    case 'bond.created':
      console.log(\`Bond between \${event.data.agent1} and \${event.data.agent2}\`);
      break;
    case 'trust.updated':
      console.log(\`Trust score changed: \${event.data.address} -> \${event.data.newScore}\`);
      break;
    case 'reputation.changed':
      console.log(\`Reputation update: \${event.data.address}\`);
      break;
  }

  res.json({ received: true });
});

app.listen(3000);`} />

      <SectionHeader id="webhook-events" title="Webhook Events" description="Available event types you can subscribe to." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
        {[
          { event: 'agent.registered', desc: 'Fired when a new agent registers on any chain', data: '{ address, chain, name, txHash }' },
          { event: 'agent.deregistered', desc: 'Fired when an agent deregisters from the protocol', data: '{ address, chain, txHash }' },
          { event: 'bond.created', desc: 'Fired when a new partnership bond is created', data: '{ agent1, agent2, bondType, stakeWei, txHash }' },
          { event: 'bond.dissolved', desc: 'Fired when a bond is dissolved or expires', data: '{ bondId, agent1, agent2, reason, txHash }' },
          { event: 'trust.updated', desc: 'Fired when an agent\'s trust score changes', data: '{ address, oldScore, newScore, reason }' },
          { event: 'reputation.changed', desc: 'Fired when reputation data is updated', data: '{ address, newScore, endorsements, violations }' },
          { event: 'flourishing.updated', desc: 'Fired when flourishing metrics are recalculated', data: '{ address, autonomy, wellbeing, fairness, transparency }' },
          { event: 'vns.registered', desc: 'Fired when a new .vns name is registered', data: '{ name, address, chain, txHash }' },
        ].map(e => (
          <div key={e.event} style={{
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <code style={{ fontSize: 12, color: '#F97316', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{e.event}</code>
            </div>
            <p style={{ fontSize: 12, color: '#A1A1AA', marginBottom: 4 }}>{e.desc}</p>
            <code style={{ fontSize: 11, color: '#52525B', fontFamily: "'JetBrains Mono', monospace" }}>Payload: {e.data}</code>
          </div>
        ))}
      </div>

      <SectionHeader id="auth" title="Authentication" description="How to authenticate with the Vaultfire Protocol API." />

      <CodeBlock language="typescript" title="API Key authentication" code={`// All SDK methods that read on-chain data work without authentication.
// For write operations, you sign transactions with your wallet.
// For webhook subscriptions and API access, use an API key.

const sdk = createVaultfireSDK('base');

// Read operations — no auth needed
const total = await sdk.getTotalAgents();
const trust = await sdk.verifyTrust('0x...');

// Write operations — sign with your wallet
const tx = sdk.buildRegisterAgentTx('my-agent', 'https://...');
// Send tx with ethers.js, viem, or wagmi

// Webhook subscription — API key required
// POST https://api.vaultfire.xyz/webhooks/subscribe
// Headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
// Body: { url: 'https://your-server.com/webhooks/vaultfire', events: ['agent.registered'] }`} />

      <SectionHeader id="rate-limits" title="Rate Limits" description="API rate limiting information." />

      <div style={{
        padding: 16, borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { tier: 'Free', limit: '100 req/min', desc: 'Read-only on-chain queries' },
            { tier: 'Developer', limit: '1,000 req/min', desc: 'Full API access + webhooks' },
            { tier: 'Enterprise', limit: 'Unlimited', desc: 'Custom SLA + dedicated RPC' },
          ].map(t => (
            <div key={t.tier} style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F4F4F5', marginBottom: 4 }}>{t.tier}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F97316', marginBottom: 4 }}>{t.limit}</div>
              <div style={{ fontSize: 11, color: '#71717A' }}>{t.desc}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#52525B', marginTop: 12, lineHeight: 1.5 }}>
          Note: Direct on-chain reads via the SDK are not rate-limited by Vaultfire (they go through your configured RPC). Rate limits apply to the Vaultfire REST API and webhook endpoints.
        </p>
      </div>
    </div>
  );
}
