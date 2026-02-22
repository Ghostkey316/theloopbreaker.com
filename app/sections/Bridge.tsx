"use client";
import { useEffect, useState } from "react";
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, CHAINS } from "../lib/contracts";
import { getTeleporterBridgeStats, checkChainConnectivity, type BridgeStats, type RPCResult } from "../lib/blockchain";
import { showToast } from "../components/Toast";

const BASE_BRIDGE = BASE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge");
const AVAX_BRIDGE = AVALANCHE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge");

/* ── Icons ── */
function RefreshIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>);
}
function ExternalIcon({ size = 10 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>);
}
function SwapIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>);
}
function ShieldIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
}
function ClockIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
}
function UserIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>);
}
function StarIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>);
}
function LinkIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>);
}
function HandshakeIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17a4 4 0 0 0 4-4V7" /><path d="M7 7h10" /><path d="M17 7l-4 4" /><path d="M7 7l4 4" /><path d="M3 11l4-4" /><path d="M21 11l-4-4" /></svg>);
}
function DatabaseIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>);
}
function CheckIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>);
}

type ChainKey = "ethereum" | "base" | "avalanche";

const CHAIN_INFO: { key: ChainKey; label: string; chainId: number; color: string }[] = [
  { key: "ethereum", label: "Ethereum", chainId: 1, color: "#627EEA" },
  { key: "base", label: "Base", chainId: 8453, color: "#0052FF" },
  { key: "avalanche", label: "Avalanche", chainId: 43114, color: "#E84142" },
];

/* Trust data types that can be synced */
const TRUST_DATA_TYPES = [
  { key: "identity", label: "Identity Attestations", desc: "ERC-8004 identity registrations and attestation proofs", icon: UserIcon, color: "#F97316", source: "ERC8004IdentityRegistry" },
  { key: "reputation", label: "Reputation Scores", desc: "Trust scores and confidence ratings from the adapter", icon: StarIcon, color: "#22C55E", source: "VaultfireERC8004Adapter" },
  { key: "vns", label: "VNS Registrations", desc: "Vaultfire Name Service name-to-address bindings", icon: LinkIcon, color: "#38BDF8", source: "VNS Registry" },
  { key: "accountability", label: "Accountability Bonds", desc: "Bond status, amounts, and compliance records", icon: ShieldIcon, color: "#A855F7", source: "AIAccountabilityBondsV2" },
  { key: "partnership", label: "Partnership Bonds", desc: "Partnership bond status and counterparty data", icon: HandshakeIcon, color: "#EC4899", source: "AIPartnershipBondsV2" },
];

export default function Bridge() {
  const [baseBridge, setBaseBridge] = useState<BridgeStats | null>(null);
  const [avaxBridge, setAvaxBridge] = useState<BridgeStats | null>(null);
  const [baseChain, setBaseChain] = useState<RPCResult | null>(null);
  const [avaxChain, setAvaxChain] = useState<RPCResult | null>(null);
  const [ethChain, setEthChain] = useState<RPCResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"trust" | "teleporter">("trust");
  const [sourceChain, setSourceChain] = useState<ChainKey>("ethereum");
  const [destChain, setDestChain] = useState<ChainKey>("base");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(["identity", "reputation", "vns", "accountability", "partnership"]));

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const promises: Promise<unknown>[] = [
      checkChainConnectivity("base"),
      checkChainConnectivity("avalanche"),
      checkChainConnectivity("ethereum"),
    ];
    if (BASE_BRIDGE) promises.push(getTeleporterBridgeStats("base", BASE_BRIDGE.address));
    if (AVAX_BRIDGE) promises.push(getTeleporterBridgeStats("avalanche", AVAX_BRIDGE.address));

    const results = await Promise.all(promises);
    setBaseChain(results[0] as RPCResult);
    setAvaxChain(results[1] as RPCResult);
    setEthChain(results[2] as RPCResult);
    if (BASE_BRIDGE) setBaseBridge(results[3] as BridgeStats);
    if (AVAX_BRIDGE) setAvaxBridge(results[BASE_BRIDGE ? 4 : 3] as BridgeStats);
    setLoading(false);
  };

  const swapChains = () => {
    setSourceChain(destChain);
    setDestChain(sourceChain);
  };

  const toggleType = (key: string) => {
    const next = new Set(selectedTypes);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedTypes(next);
  };

  const chainStatus = (key: ChainKey) => {
    if (key === "base") return baseChain?.success;
    if (key === "avalanche") return avaxChain?.success;
    return ethChain?.success;
  };

  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
  const px = isMobile ? 20 : 40;

  return (
    <div className="page-enter" style={{ padding: `${isMobile ? 24 : 40}px ${px}px 48px`, maxWidth: 720, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 32, paddingLeft: isMobile ? 48 : 0 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color: "#F4F4F5", letterSpacing: "-0.03em" }}>
          Bridge
        </h1>
        <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>
          Cross-chain trust data synchronisation across Ethereum, Base, and Avalanche
        </p>
      </div>

      {/* Tab Selector */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 32,
        padding: 4, borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        {[
          { key: "trust" as const, label: "Trust Data Bridge" },
          { key: "teleporter" as const, label: "Teleporter" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: "10px 16px", borderRadius: 8,
              border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              backgroundColor: activeTab === tab.key ? "rgba(249,115,22,0.12)" : "transparent",
              color: activeTab === tab.key ? "#F97316" : "#71717A",
              transition: "all 0.2s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TRUST DATA BRIDGE — Cross-chain trust sync
          ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "trust" && (
        <div>
          {/* Coming Soon Banner */}
          <div style={{
            padding: "14px 18px",
            borderRadius: 12,
            backgroundColor: "rgba(249,115,22,0.06)",
            border: "1px solid rgba(249,115,22,0.12)",
            marginBottom: 24,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <ClockIcon size={16} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#F97316" }}>Coming Soon</p>
              <p style={{ fontSize: 12, color: "#A1A1AA", marginTop: 2 }}>
                TrustDataBridge is in development. Mainnet deployment pending security audit.
              </p>
            </div>
          </div>

          {/* Bridge Diagram */}
          <div style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            backgroundColor: "rgba(255,255,255,0.02)",
            padding: isMobile ? 20 : 28,
            marginBottom: 24,
          }}>
            {/* Source → Destination Visual */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: isMobile ? 16 : 32, marginBottom: 24,
            }}>
              {/* Source Chain */}
              <div style={{ textAlign: "center", flex: 1 }}>
                <p style={{ fontSize: 11, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Source</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {CHAIN_INFO.map(c => (
                    <button
                      key={c.key}
                      onClick={() => {
                        setSourceChain(c.key);
                        if (destChain === c.key) {
                          const other = CHAIN_INFO.find(x => x.key !== c.key);
                          if (other) setDestChain(other.key);
                        }
                      }}
                      style={{
                        padding: "10px 14px", borderRadius: 10,
                        border: sourceChain === c.key ? `1px solid ${c.color}50` : "1px solid rgba(255,255,255,0.06)",
                        backgroundColor: sourceChain === c.key ? `${c.color}15` : "transparent",
                        color: sourceChain === c.key ? c.color : "#52525B",
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}
                    >
                      <span>{c.label}</span>
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%",
                        backgroundColor: chainStatus(c.key) ? "#22C55E" : loading ? "#52525B" : "#EF4444",
                      }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Arrow / Swap */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 24 }}>
                <button
                  onClick={swapChains}
                  style={{
                    width: 40, height: 40, borderRadius: 10,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#A1A1AA", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  <SwapIcon size={16} />
                </button>
                <span style={{ fontSize: 9, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Sync</span>
              </div>

              {/* Destination Chain */}
              <div style={{ textAlign: "center", flex: 1 }}>
                <p style={{ fontSize: 11, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Destination</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {CHAIN_INFO.filter(c => c.key !== sourceChain).map(c => (
                    <button
                      key={c.key}
                      onClick={() => setDestChain(c.key)}
                      style={{
                        padding: "10px 14px", borderRadius: 10,
                        border: destChain === c.key ? `1px solid ${c.color}50` : "1px solid rgba(255,255,255,0.06)",
                        backgroundColor: destChain === c.key ? `${c.color}15` : "transparent",
                        color: destChain === c.key ? c.color : "#52525B",
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}
                    >
                      <span>{c.label}</span>
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%",
                        backgroundColor: chainStatus(c.key) ? "#22C55E" : loading ? "#52525B" : "#EF4444",
                      }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Data Type Selector */}
            <p style={{ fontSize: 11, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
              Trust Data to Sync
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {TRUST_DATA_TYPES.map(dt => {
                const Icon = dt.icon;
                const selected = selectedTypes.has(dt.key);
                return (
                  <button
                    key={dt.key}
                    onClick={() => toggleType(dt.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 10,
                      border: selected ? `1px solid ${dt.color}30` : "1px solid rgba(255,255,255,0.05)",
                      backgroundColor: selected ? `${dt.color}08` : "transparent",
                      cursor: "pointer", textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      backgroundColor: selected ? `${dt.color}15` : "rgba(255,255,255,0.03)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: selected ? dt.color : "#52525B",
                      flexShrink: 0,
                    }}>
                      <Icon size={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: selected ? "#F4F4F5" : "#71717A" }}>{dt.label}</p>
                      <p style={{ fontSize: 11, color: "#52525B", marginTop: 1 }}>{dt.source}</p>
                    </div>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5,
                      border: selected ? `1.5px solid ${dt.color}` : "1.5px solid rgba(255,255,255,0.1)",
                      backgroundColor: selected ? dt.color : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {selected && <CheckIcon size={10} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Sync Button */}
            <button
              onClick={() => showToast("TrustDataBridge is in development. Cross-chain trust sync will be available after security audit.", "info")}
              style={{
                width: "100%", padding: "14px",
                borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.1))",
                color: "#F97316",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
                transition: "all 0.15s ease",
                opacity: 0.8,
              }}
            >
              Sync Trust Data — Coming Soon
            </button>
          </div>

          {/* How It Works */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
              How It Works
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
              gap: 12,
            }}>
              {[
                { icon: <DatabaseIcon size={16} />, title: "Emit", desc: "Trust data is published on the source chain with a cryptographic hash for verification", color: "#F97316", step: "1" },
                { icon: <SwapIcon size={16} />, title: "Relay", desc: "Authorised relayers verify the data and submit it to the destination chain", color: "#22C55E", step: "2" },
                { icon: <ShieldIcon size={16} />, title: "Verify & Store", desc: "Destination chain verifies hash integrity and stores the trust record", color: "#38BDF8", step: "3" },
              ].map(item => (
                <div key={item.title} style={{
                  padding: 18, borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  position: "relative",
                }}>
                  <div style={{
                    position: "absolute", top: 12, right: 14,
                    fontSize: 11, fontWeight: 700, color: `${item.color}40`,
                    ...mono,
                  }}>
                    {item.step}
                  </div>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    backgroundColor: `${item.color}10`,
                    border: `1px solid ${item.color}20`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: item.color, marginBottom: 12,
                  }}>
                    {item.icon}
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#F4F4F5", marginBottom: 4 }}>{item.title}</p>
                  <p style={{ fontSize: 12, color: "#71717A", lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Architecture Details */}
          <div style={{
            padding: 18, borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#F4F4F5", marginBottom: 12 }}>Architecture</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Contract", value: "TrustDataBridge.sol", color: "#F97316" },
                { label: "Pattern", value: "Emit → Relay → Verify → Store", color: "#22C55E" },
                { label: "Security", value: "Multi-relayer quorum, nonce replay protection, hash verification", color: "#38BDF8" },
                { label: "Data Types", value: "Identity, Reputation, VNS, Accountability Bonds, Partnership Bonds", color: "#A855F7" },
                { label: "ETH Safety", value: "Contract rejects all ETH and token transfers — trust data only", color: "#EF4444" },
              ].map(item => (
                <div key={item.label} style={{
                  display: "flex", alignItems: isMobile ? "flex-start" : "center",
                  flexDirection: isMobile ? "column" : "row",
                  gap: isMobile ? 2 : 12,
                }}>
                  <span style={{ fontSize: 11, color: item.color, fontWeight: 600, minWidth: 90, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: 12, color: "#A1A1AA", lineHeight: 1.5 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chain Status */}
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
              Chain Status
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {CHAIN_INFO.map((c, i) => (
                <div key={c.key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 0",
                  borderBottom: i < CHAIN_INFO.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      backgroundColor: chainStatus(c.key) ? "#22C55E" : loading ? "#71717A" : "#EF4444",
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#F4F4F5" }}>{c.label}</span>
                    <span style={{ fontSize: 11, color: "#3F3F46", ...mono }}>{c.chainId}</span>
                  </div>
                  <span style={{ fontSize: 12, color: chainStatus(c.key) ? "#22C55E" : "#71717A", fontWeight: 500 }}>
                    {loading ? "Connecting..." : chainStatus(c.key) ? "Online" : "Offline"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TELEPORTER — Existing Base ↔ Avalanche bridge
          ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "teleporter" && (
        <div>
          {/* Bridge Architecture Diagram */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: isMobile ? 20 : 40,
            marginBottom: 32, padding: "20px 0",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                backgroundColor: baseChain?.success ? "#22C55E" : "#3F3F46",
                margin: "0 auto 10px",
              }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: "#F4F4F5" }}>Base</p>
              <p style={{ fontSize: 11, color: "#3F3F46", ...mono }}>8453</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <SwapIcon size={14} />
              <span style={{ fontSize: 9, color: "#3F3F46", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Teleporter</span>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                backgroundColor: avaxChain?.success ? "#22C55E" : "#3F3F46",
                margin: "0 auto 10px",
              }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: "#F4F4F5" }}>Avalanche</p>
              <p style={{ fontSize: 11, color: "#3F3F46", ...mono }}>43114</p>
            </div>
          </div>

          {/* Bridge Status */}
          <div>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
              Teleporter Status
            </h2>

            {[
              { label: "Base Bridge", stats: baseBridge, chainResult: baseChain, address: BASE_BRIDGE?.address, chain: "base" as const },
              { label: "Avalanche Bridge", stats: avaxBridge, chainResult: avaxChain, address: AVAX_BRIDGE?.address, chain: "avalanche" as const },
            ].map((item, i) => (
              <div key={item.label} style={{
                padding: "20px 0",
                borderBottom: i === 0 ? "1px solid rgba(255,255,255,0.03)" : "none",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: item.chainResult?.success ? "#22C55E" : "#3F3F46" }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#F4F4F5" }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: item.chainResult?.success ? "#22C55E" : "#3F3F46" }}>
                    {loading ? "..." : item.chainResult?.success ? "Online" : "Offline"}
                  </span>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: isMobile ? 12 : 24,
                }}>
                  <div>
                    <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>Messages</p>
                    <p style={{ fontSize: 20, fontWeight: 600, color: "#F4F4F5", ...mono }}>
                      {loading ? "\u2014" : item.stats?.messageCount?.toLocaleString() ?? "N/A"}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>Status</p>
                    <p style={{ fontSize: 14, fontWeight: 500, color: item.stats?.paused ? "#EF4444" : "#22C55E" }}>
                      {loading ? "\u2014" : item.stats?.isAlive ? (item.stats.paused ? "Paused" : "Active") : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>Nonce</p>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "#A1A1AA", ...mono }}>
                      {loading ? "\u2014" : item.stats?.nonce ?? "N/A"}
                    </p>
                  </div>
                </div>

                {item.address && (
                  <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <code style={{
                      fontSize: 11, color: "#3F3F46", ...mono,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                    }}>
                      {isMobile ? `${item.address.slice(0, 14)}...${item.address.slice(-8)}` : item.address}
                    </code>
                    <a href={`${CHAINS[item.chain].explorerUrl}/address/${item.address}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", color: "#3F3F46", textDecoration: "none" }}>
                      <ExternalIcon size={10} />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, color: "#3F3F46", lineHeight: 1.8, marginTop: 32 }}>
            The Teleporter Bridge enables cross-chain trust data synchronisation between Base and Avalanche
            using Avalanche Warp Messaging (AWM) for trustless message relay.
          </p>
        </div>
      )}
    </div>
  );
}
