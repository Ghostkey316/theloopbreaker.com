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
function ArrowDownIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>);
}
function SwapIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>);
}
function LockIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>);
}
function ShieldIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
}
function ClockIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
}

type ChainKey = "ethereum" | "base" | "avalanche";

const CHAIN_OPTIONS: { key: ChainKey; label: string; symbol: string; color: string }[] = [
  { key: "ethereum", label: "Ethereum", symbol: "ETH", color: "#627EEA" },
  { key: "base", label: "Base", symbol: "ETH", color: "#0052FF" },
  { key: "avalanche", label: "Avalanche", symbol: "AVAX", color: "#E84142" },
];

export default function Bridge() {
  const [baseBridge, setBaseBridge] = useState<BridgeStats | null>(null);
  const [avaxBridge, setAvaxBridge] = useState<BridgeStats | null>(null);
  const [baseChain, setBaseChain] = useState<RPCResult | null>(null);
  const [avaxChain, setAvaxChain] = useState<RPCResult | null>(null);
  const [ethChain, setEthChain] = useState<RPCResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [sourceChain, setSourceChain] = useState<ChainKey>("ethereum");
  const [destChain, setDestChain] = useState<ChainKey>("base");
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"bridge" | "teleporter">("bridge");

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
      <div style={{
        marginBottom: 32,
        paddingLeft: isMobile ? 48 : 0,
      }}>
        <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color: "#F4F4F5", letterSpacing: "-0.03em" }}>
          Bridge
        </h1>
        <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>
          Cross-chain asset transfer across Ethereum, Base, and Avalanche
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
          { key: "bridge" as const, label: "Vaultfire Bridge" },
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
          VAULTFIRE BRIDGE — Custom lock-and-mint
          ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "bridge" && (
        <div>
          {/* Coming Soon Banner */}
          <div style={{
            padding: "16px 20px",
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
                Vaultfire Bridge is in testnet. Mainnet deployment pending security audit.
              </p>
            </div>
          </div>

          {/* Bridge Interface Card */}
          <div style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            backgroundColor: "rgba(255,255,255,0.02)",
            overflow: "hidden",
          }}>
            {/* Source Chain */}
            <div style={{ padding: "24px 24px 16px" }}>
              <p style={{ fontSize: 11, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>From</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {CHAIN_OPTIONS.map(c => (
                  <button
                    key={c.key}
                    onClick={() => {
                      setSourceChain(c.key);
                      if (destChain === c.key) {
                        const other = CHAIN_OPTIONS.find(x => x.key !== c.key);
                        if (other) setDestChain(other.key);
                      }
                    }}
                    style={{
                      padding: "8px 14px", borderRadius: 8,
                      border: sourceChain === c.key ? `1px solid ${c.color}40` : "1px solid rgba(255,255,255,0.06)",
                      backgroundColor: sourceChain === c.key ? `${c.color}10` : "transparent",
                      color: sourceChain === c.key ? c.color : "#71717A",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: 10,
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <input
                  type="text"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "");
                    setAmount(v);
                  }}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    fontSize: 24, fontWeight: 700, color: "#F4F4F5",
                    ...mono,
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#71717A" }}>
                  {CHAIN_OPTIONS.find(c => c.key === sourceChain)?.symbol}
                </span>
              </div>
            </div>

            {/* Swap Button */}
            <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
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
            </div>

            {/* Destination Chain */}
            <div style={{ padding: "16px 24px 24px" }}>
              <p style={{ fontSize: 11, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>To</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {CHAIN_OPTIONS.filter(c => c.key !== sourceChain).map(c => (
                  <button
                    key={c.key}
                    onClick={() => setDestChain(c.key)}
                    style={{
                      padding: "8px 14px", borderRadius: 8,
                      border: destChain === c.key ? `1px solid ${c.color}40` : "1px solid rgba(255,255,255,0.06)",
                      backgroundColor: destChain === c.key ? `${c.color}10` : "transparent",
                      color: destChain === c.key ? c.color : "#71717A",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div style={{
                padding: "14px 16px", borderRadius: 10,
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: amount ? "#F4F4F5" : "#3F3F46", ...mono }}>
                  {amount || "0.0"}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#71717A", marginLeft: 12 }}>
                  {CHAIN_OPTIONS.find(c => c.key === destChain)?.symbol}
                </span>
              </div>
            </div>

            {/* Bridge Button */}
            <div style={{ padding: "0 24px 24px" }}>
              <button
                onClick={() => showToast("Vaultfire Bridge is currently in testnet. Mainnet deployment pending security audit.", "info")}
                style={{
                  width: "100%", padding: "14px",
                  borderRadius: 10, border: "none",
                  backgroundColor: "rgba(249,115,22,0.15)",
                  color: "#F97316",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.15s ease",
                  opacity: 0.7,
                }}
              >
                Bridge — Coming Soon
              </button>
            </div>
          </div>

          {/* Architecture Info */}
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
              Architecture
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
              gap: 12,
            }}>
              {[
                { icon: <LockIcon size={16} />, title: "Lock & Mint", desc: "Lock tokens on source chain, mint equivalents on destination", color: "#F97316" },
                { icon: <ShieldIcon size={16} />, title: "Multi-Sig Relay", desc: "Relayer validation with N-of-M signature requirements", color: "#22C55E" },
                { icon: <ClockIcon size={16} />, title: "Timelock Safety", desc: "Large transfers require timelock period for security", color: "#38BDF8" },
              ].map(item => (
                <div key={item.title} style={{
                  padding: 18, borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}>
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

          {/* Chain Status */}
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
              Chain Status
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {CHAIN_OPTIONS.map((c, i) => (
                <div key={c.key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 0",
                  borderBottom: i < CHAIN_OPTIONS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      backgroundColor: chainStatus(c.key) ? "#22C55E" : loading ? "#71717A" : "#EF4444",
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#F4F4F5" }}>{c.label}</span>
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
            The Teleporter Bridge enables cross-chain communication between Base and Avalanche
            using Avalanche Warp Messaging (AWM) for trustless message relay.
          </p>
        </div>
      )}
    </div>
  );
}
