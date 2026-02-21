"use client";
import { useEffect, useState } from "react";
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, CHAINS } from "../lib/contracts";
import { getTeleporterBridgeStats, checkChainConnectivity, type BridgeStats, type RPCResult } from "../lib/blockchain";

const BASE_BRIDGE = BASE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge")!;
const AVAX_BRIDGE = AVALANCHE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge")!;

function RefreshIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>);
}
function ExternalIcon({ size = 10 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>);
}
function ArrowRightIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>);
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
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [bStats, aStats, bChain, aChain] = await Promise.all([
      getTeleporterBridgeStats("base", BASE_BRIDGE.address),
      getTeleporterBridgeStats("avalanche", AVAX_BRIDGE.address),
      checkChainConnectivity("base"),
      checkChainConnectivity("avalanche"),
    ]);
    setBaseBridge(bStats);
    setAvaxBridge(aStats);
    setBaseChain(bChain);
    setAvaxChain(aChain);
    setLoading(false);
  };

  return (
    <div style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: 680, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: isMobile ? 32 : 40, gap: 12, flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.03em" }}>Bridge</h1>
          <p style={{ fontSize: 14, color: "#71717A", marginTop: 4 }}>Cross-chain communication via Teleporter</p>
        </div>
        <button onClick={loadData} disabled={loading} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 16px", borderRadius: 8,
          background: loading ? "rgba(255,255,255,0.03)" : "#F97316",
          border: "none",
          color: loading ? "#52525B" : "#09090B",
          fontSize: 12, fontWeight: 600, cursor: loading ? "default" : "pointer",
        }}>
          <RefreshIcon size={12} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Bridge Architecture — minimal */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: isMobile ? 16 : 32,
        marginBottom: isMobile ? 32 : 40,
        padding: "24px 0",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            backgroundColor: "#0EA5E9", margin: "0 auto 8px",
          }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "#F4F4F5" }}>Base</p>
          <p style={{ fontSize: 11, color: "#52525B", fontFamily: "'JetBrains Mono', monospace" }}>8453</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#52525B" }}>
            <div style={{ width: isMobile ? 32 : 56, height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
            <ArrowRightIcon size={12} />
          </div>
          <span style={{ fontSize: 9, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>Teleporter</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#52525B", transform: "rotate(180deg)" }}>
            <div style={{ width: isMobile ? 32 : 56, height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
            <ArrowRightIcon size={12} />
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            backgroundColor: "#E84142", margin: "0 auto 8px",
          }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "#F4F4F5" }}>Avalanche</p>
          <p style={{ fontSize: 11, color: "#52525B", fontFamily: "'JetBrains Mono', monospace" }}>43114</p>
        </div>
      </div>

      {/* Bridge Status — table rows */}
      <div style={{
        borderRadius: 12, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.04)",
        marginBottom: 24,
      }}>
        {[
          { label: "Base Bridge", stats: baseBridge, chainResult: baseChain, address: BASE_BRIDGE.address, chain: "base" as const, color: "#0EA5E9" },
          { label: "Avalanche Bridge", stats: avaxBridge, chainResult: avaxChain, address: AVAX_BRIDGE.address, chain: "avalanche" as const, color: "#E84142" },
        ].map((item, i) => (
          <div key={item.label} style={{
            padding: isMobile ? "16px" : "18px 20px",
            backgroundColor: "#111113",
            borderBottom: i === 0 ? "1px solid rgba(255,255,255,0.03)" : "none",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: item.color }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#F4F4F5" }}>{item.label}</span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 500,
                color: item.chainResult?.success ? "#22C55E" : "#EF4444",
              }}>
                {loading ? "..." : item.chainResult?.success ? "Online" : "Offline"}
              </span>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: isMobile ? 8 : 12,
            }}>
              <div>
                <p style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontWeight: 500 }}>Messages</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#F4F4F5", fontFamily: "'JetBrains Mono', monospace" }}>
                  {loading ? "\u2014" : item.stats?.messageCount?.toLocaleString() ?? "N/A"}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontWeight: 500 }}>Status</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: item.stats?.paused ? "#EF4444" : "#22C55E" }}>
                  {loading ? "\u2014" : item.stats?.isAlive ? (item.stats.paused ? "Paused" : "Active") : "N/A"}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontWeight: 500 }}>Nonce</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: "#A1A1AA", fontFamily: "'JetBrains Mono', monospace" }}>
                  {loading ? "\u2014" : item.stats?.nonce ?? "N/A"}
                </p>
              </div>
            </div>

            {/* Contract address */}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <code style={{
                fontSize: 11, color: "#3F3F46", fontFamily: "'JetBrains Mono', monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1,
              }}>
                {isMobile ? `${item.address.slice(0, 14)}...${item.address.slice(-8)}` : item.address}
              </code>
              <a href={`${CHAINS[item.chain].explorerUrl}/address/${item.address}`} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  color: "#52525B", textDecoration: "none", fontSize: 11, flexShrink: 0,
                }}>
                <ExternalIcon size={10} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Info text */}
      <p style={{
        fontSize: 13, color: "#52525B", lineHeight: 1.7,
      }}>
        The Teleporter Bridge enables cross-chain communication between Base and Avalanche
        using Avalanche Warp Messaging (AWM) for trustless message relay.
      </p>
    </div>
  );
}
