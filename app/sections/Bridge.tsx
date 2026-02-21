"use client";
import { useEffect, useState } from "react";
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, CHAINS } from "../lib/contracts";
import { getTeleporterBridgeStats, checkChainConnectivity, type BridgeStats, type RPCResult } from "../lib/blockchain";

const BASE_BRIDGE = BASE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge")!;
const AVAX_BRIDGE = AVALANCHE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge")!;

/* ── SVG Icons ── */
function BridgeIcon({ size = 18 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /><line x1="7" y1="12" x2="17" y2="12" /><polyline points="14 9 17 12 14 15" /></svg>);
}
function RefreshIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>);
}
function ExternalIcon({ size = 10 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>);
}
function ArrowRightIcon({ size = 16 }: { size?: number }) {
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

  const BridgeCard = ({ chain, stats, chainResult, address }: { chain: "base" | "avalanche"; stats: BridgeStats | null; chainResult: RPCResult | null; address: string }) => {
    const cfg = CHAINS[chain];
    return (
      <div className="card-hover-effect" style={{
        background: "#0F0F12",
        border: "1px solid rgba(255,255,255,0.04)",
        borderRadius: 14, padding: isMobile ? "16px" : "18px 20px",
        borderTop: `2px solid ${cfg.color}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: cfg.color, boxShadow: `0 0 8px ${cfg.color}40` }} />
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA", letterSpacing: "-0.015em" }}>{cfg.name}</h3>
              <p style={{ fontSize: 11, color: "#52525B" }}>Chain {cfg.chainId}</p>
            </div>
          </div>
          <span style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 100,
            backgroundColor: chainResult?.success ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            color: chainResult?.success ? "#22C55E" : "#EF4444",
            flexShrink: 0, fontWeight: 500,
          }}>
            {chainResult?.success ? "Online" : "Offline"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
          <div style={{ backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px", border: "1px solid rgba(255,255,255,0.03)" }}>
            <p style={{ fontSize: 10, color: "#52525B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>Messages</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#F97316", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em" }}>
              {loading ? "\u2014" : stats?.messageCount !== null ? stats?.messageCount?.toLocaleString() : "N/A"}
            </p>
          </div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px", border: "1px solid rgba(255,255,255,0.03)" }}>
            <p style={{ fontSize: 10, color: "#52525B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>Status</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: stats?.paused ? "#EF4444" : "#22C55E" }}>
              {loading ? "\u2014" : stats?.isAlive ? (stats.paused ? "Paused" : "Active") : "Not deployed"}
            </p>
          </div>
        </div>

        <div style={{ backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px", marginBottom: 12, border: "1px solid rgba(255,255,255,0.03)" }}>
          <p style={{ fontSize: 10, color: "#52525B", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>Contract</p>
          <code style={{
            fontSize: isMobile ? 10 : 11, color: "#FAFAFA", fontFamily: "'JetBrains Mono', monospace",
            display: "block", overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: isMobile ? "nowrap" : "normal", wordBreak: isMobile ? "normal" : "break-all",
            lineHeight: 1.5,
          }}>{isMobile ? `${address.slice(0, 16)}...${address.slice(-10)}` : address}</code>
        </div>

        <a href={`${cfg.explorerUrl}/address/${address}`} target="_blank" rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px", backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10,
            color: "#A1A1AA", textDecoration: "none", fontSize: 12,
            fontWeight: 500, transition: "all 0.15s ease", letterSpacing: "-0.01em",
          }}>
          View on {cfg.name === "Base" ? "Basescan" : "Snowtrace"} <ExternalIcon size={10} />
        </a>
      </div>
    );
  };

  return (
    <div style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: "56rem", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isMobile ? 24 : 32, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: isMobile ? 40 : 44, height: isMobile ? 40 : 44, borderRadius: 14,
            background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))",
            border: "1px solid rgba(249,115,22,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(249,115,22,0.06)", color: "#F97316",
          }}>
            <BridgeIcon size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: "#FAFAFA", letterSpacing: "-0.03em" }}>Cross-Chain Bridge</h1>
            <p style={{ fontSize: 14, color: "#A1A1AA", letterSpacing: "-0.01em" }}>VaultfireTeleporterBridge between Base and Avalanche</p>
          </div>
        </div>
        <button onClick={loadData} disabled={loading} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 8,
          background: loading ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, #F97316, #EA580C)",
          border: "none",
          color: loading ? "#52525B" : "#09090B",
          fontSize: 12, fontWeight: 600, cursor: loading ? "default" : "pointer",
          transition: "all 0.2s ease",
          boxShadow: loading ? "none" : "0 2px 12px rgba(249,115,22,0.2)",
        }}>
          <RefreshIcon size={12} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Bridge Architecture Visual */}
      <div style={{
        background: "#0F0F12", border: "1px solid rgba(255,255,255,0.04)",
        borderRadius: 16, padding: isMobile ? "20px 16px" : "28px 24px",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <h2 style={{ fontSize: 10, fontWeight: 600, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em" }}>Bridge Architecture</h2>
          <div style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.04)" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: isMobile ? 12 : 24, flexWrap: "wrap" }}>
          <div style={{
            textAlign: "center", padding: isMobile ? "12px 20px" : "14px 24px",
            backgroundColor: "rgba(14,165,233,0.04)", border: "1px solid rgba(14,165,233,0.12)",
            borderRadius: 12,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#0EA5E9", margin: "0 auto 6px", boxShadow: "0 0 8px rgba(14,165,233,0.3)" }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: "#0EA5E9", letterSpacing: "-0.01em" }}>Base</p>
            <p style={{ fontSize: 10, color: "#52525B" }}>Chain 8453</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#F97316" }}>
              <div style={{ width: isMobile ? 24 : 40, height: 2, background: "linear-gradient(90deg, #0EA5E9, #F97316)", borderRadius: 1 }} />
              <ArrowRightIcon size={12} />
            </div>
            <div style={{ padding: "3px 10px", background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 100 }}>
              <p style={{ fontSize: 9, color: "#F97316", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Teleporter</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#F97316", transform: "rotate(180deg)" }}>
              <div style={{ width: isMobile ? 24 : 40, height: 2, background: "linear-gradient(90deg, #E84142, #F97316)", borderRadius: 1 }} />
              <ArrowRightIcon size={12} />
            </div>
          </div>

          <div style={{
            textAlign: "center", padding: isMobile ? "12px 20px" : "14px 24px",
            backgroundColor: "rgba(232,65,66,0.04)", border: "1px solid rgba(232,65,66,0.12)",
            borderRadius: 12,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#E84142", margin: "0 auto 6px", boxShadow: "0 0 8px rgba(232,65,66,0.3)" }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: "#E84142", letterSpacing: "-0.01em" }}>Avalanche</p>
            <p style={{ fontSize: 10, color: "#52525B" }}>Chain 43114</p>
          </div>
        </div>

        <p style={{ fontSize: 11, color: "#52525B", textAlign: "center", marginTop: 14, letterSpacing: "-0.01em" }}>
          Messages relayed trustlessly using Avalanche Warp Messaging (AWM)
        </p>
      </div>

      {/* Bridge Cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
        <BridgeCard chain="base" stats={baseBridge} chainResult={baseChain} address={BASE_BRIDGE.address} />
        <BridgeCard chain="avalanche" stats={avaxBridge} chainResult={avaxChain} address={AVAX_BRIDGE.address} />
      </div>

      {/* Info */}
      <div style={{
        marginTop: 16,
        background: "rgba(249,115,22,0.03)", border: "1px solid rgba(249,115,22,0.08)",
        borderRadius: 12, padding: isMobile ? "14px 16px" : "16px 20px",
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#F97316", marginBottom: 6, letterSpacing: "-0.01em" }}>About the Teleporter Bridge</p>
        <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.65, letterSpacing: "-0.01em" }}>
          The Vaultfire Teleporter Bridge enables cross-chain communication between Base and Avalanche networks.
          It facilitates secure message passing and asset transfers between the two chains, maintaining protocol
          consistency across the multi-chain deployment.
        </p>
      </div>
    </div>
  );
}
