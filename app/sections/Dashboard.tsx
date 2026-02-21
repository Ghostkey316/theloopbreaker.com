"use client";
import { useEffect, useState } from "react";
import { ALL_CONTRACTS, BASE_CONTRACTS, AVALANCHE_CONTRACTS, CHAINS } from "../lib/contracts";
import { checkAllChains, getMultipleContractStatus, getGovernanceData, getTeleporterBridgeStats, type RPCResult, type GovernanceData, type BridgeStats } from "../lib/blockchain";

interface ContractWithStatus {
  name: string;
  address: string;
  chain: "base" | "avalanche";
  chainId: number;
  alive: boolean | null;
}

/* ── SVG Icons ── */
function GridIcon({ size = 18 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>);
}
function RefreshIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>);
}
function ExternalIcon({ size = 10 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>);
}
function ActivityIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>);
}

export default function Dashboard() {
  const [chainStatus, setChainStatus] = useState<Record<string, RPCResult>>({});
  const [contractStatus, setContractStatus] = useState<Record<string, boolean | null>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [baseGov, setBaseGov] = useState<GovernanceData | null>(null);
  const [avaxGov, setAvaxGov] = useState<GovernanceData | null>(null);
  const [baseBridge, setBaseBridge] = useState<BridgeStats | null>(null);
  const [avaxBridge, setAvaxBridge] = useState<BridgeStats | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [chains, baseStatus, avaxStatus] = await Promise.all([
      checkAllChains(),
      getMultipleContractStatus("base", BASE_CONTRACTS.map((c) => c.address)),
      getMultipleContractStatus("avalanche", AVALANCHE_CONTRACTS.map((c) => c.address)),
    ]);
    setChainStatus(chains);
    setContractStatus({ ...baseStatus, ...avaxStatus });

    // Load governance and bridge data
    const baseGovContract = BASE_CONTRACTS.find((c) => c.name === "MultisigGovernance");
    const avaxGovContract = AVALANCHE_CONTRACTS.find((c) => c.name === "MultisigGovernance");
    const baseBridgeContract = BASE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge");
    const avaxBridgeContract = AVALANCHE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge");

    const [bg, ag, bb, ab] = await Promise.all([
      baseGovContract ? getGovernanceData("base", baseGovContract.address) : Promise.resolve(null),
      avaxGovContract ? getGovernanceData("avalanche", avaxGovContract.address) : Promise.resolve(null),
      baseBridgeContract ? getTeleporterBridgeStats("base", baseBridgeContract.address) : Promise.resolve(null),
      avaxBridgeContract ? getTeleporterBridgeStats("avalanche", avaxBridgeContract.address) : Promise.resolve(null),
    ]);
    setBaseGov(bg);
    setAvaxGov(ag);
    setBaseBridge(bb);
    setAvaxBridge(ab);

    setLastUpdated(new Date());
    setLoading(false);
  };

  const contractsWithStatus: ContractWithStatus[] = ALL_CONTRACTS.map((c) => ({
    ...c,
    alive: contractStatus[c.address] ?? null,
  }));

  const baseContracts = contractsWithStatus.filter((c) => c.chain === "base");
  const avaxContracts = contractsWithStatus.filter((c) => c.chain === "avalanche");
  const aliveCount = Object.values(contractStatus).filter(Boolean).length;
  const totalChecked = Object.keys(contractStatus).length;
  const healthScore = totalChecked > 0 ? Math.round((aliveCount / totalChecked) * 100) : null;

  const statCards = [
    { label: "Health Score", value: healthScore !== null ? `${healthScore}%` : "\u2014", color: healthScore !== null ? (healthScore >= 90 ? "#22C55E" : healthScore >= 70 ? "#EAB308" : "#EF4444") : "#52525B" },
    { label: "Contracts Live", value: `${aliveCount}/${totalChecked || ALL_CONTRACTS.length}`, color: "#22C55E" },
    { label: "Base Block", value: chainStatus.base?.blockNumber?.toLocaleString() || "\u2014", color: "#0EA5E9" },
    { label: "Avax Block", value: chainStatus.avalanche?.blockNumber?.toLocaleString() || "\u2014", color: "#E84142" },
    { label: "Base Latency", value: chainStatus.base?.latency ? `${chainStatus.base.latency}ms` : "\u2014", color: "#A1A1AA" },
    { label: "Avax Latency", value: chainStatus.avalanche?.latency ? `${chainStatus.avalanche.latency}ms` : "\u2014", color: "#A1A1AA" },
  ];

  return (
    <div style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: "64rem", margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "space-between", marginBottom: isMobile ? 24 : 32,
        flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: isMobile ? 40 : 44, height: isMobile ? 40 : 44, borderRadius: 14,
            background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))",
            border: "1px solid rgba(249,115,22,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(249,115,22,0.06)", color: "#F97316",
          }}>
            <GridIcon size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: "#FAFAFA", letterSpacing: "-0.03em" }}>Protocol Dashboard</h1>
            <p style={{ fontSize: 13, color: "#52525B" }}>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading..."}</p>
          </div>
        </div>
        <button onClick={loadAll} disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px",
            background: loading ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, #F97316, #EA580C)",
            border: "none", borderRadius: 8,
            color: loading ? "#52525B" : "#09090B",
            fontSize: 12, fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            alignSelf: isMobile ? "stretch" : "auto", justifyContent: "center",
            transition: "all 0.2s ease", letterSpacing: "-0.01em",
            boxShadow: loading ? "none" : "0 2px 12px rgba(249,115,22,0.2)",
          }}>
          <RefreshIcon size={12} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
        gap: 8, marginBottom: 20,
      }}>
        {statCards.map((card) => (
          <div key={card.label} className="card-hover-effect" style={{
            background: "#0F0F12",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 12, padding: isMobile ? "12px 10px" : "14px 16px",
          }}>
            <p style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 500 }}>{card.label}</p>
            <p style={{
              fontSize: isMobile ? 18 : 22, fontWeight: 700, color: card.color,
              fontFamily: "'JetBrains Mono', monospace",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              letterSpacing: "-0.02em",
            }}>{loading ? "\u2014" : card.value}</p>
          </div>
        ))}
      </div>

      {/* Governance & Bridge Row */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 8, marginBottom: 20 }}>
          {/* Governance Card */}
          <div style={{
            background: "#0F0F12", border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 12, padding: isMobile ? "16px" : "18px 20px",
          }}>
            <p style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500, marginBottom: 12 }}>Multisig Governance</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {[
                { label: "Base", alive: baseGov?.isAlive, threshold: baseGov?.threshold, owners: baseGov?.ownerCount },
                { label: "Avalanche", alive: avaxGov?.isAlive, threshold: avaxGov?.threshold, owners: avaxGov?.ownerCount },
              ].map((g) => (
                <div key={g.label} style={{ backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px", border: "1px solid rgba(255,255,255,0.03)" }}>
                  <p style={{ fontSize: 11, color: "#A1A1AA", fontWeight: 500, marginBottom: 6 }}>{g.label}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: g.alive ? "#22C55E" : "#3F3F46", boxShadow: g.alive ? "0 0 6px rgba(34,197,94,0.3)" : "none" }} />
                    <span style={{ fontSize: 12, color: g.alive ? "#22C55E" : "#52525B", fontWeight: 500 }}>{g.alive ? "Active" : "N/A"}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#52525B" }}>
                    Threshold: <span style={{ color: "#FAFAFA", fontFamily: "'JetBrains Mono', monospace" }}>{g.threshold ?? "N/A"}</span>
                    {" / "}Owners: <span style={{ color: "#FAFAFA", fontFamily: "'JetBrains Mono', monospace" }}>{g.owners ?? "N/A"}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Bridge Card */}
          <div style={{
            background: "#0F0F12", border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 12, padding: isMobile ? "16px" : "18px 20px",
          }}>
            <p style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500, marginBottom: 12 }}>Teleporter Bridge</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {[
                { label: "Base", data: baseBridge },
                { label: "Avalanche", data: avaxBridge },
              ].map((b) => (
                <div key={b.label} style={{ backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px", border: "1px solid rgba(255,255,255,0.03)" }}>
                  <p style={{ fontSize: 11, color: "#A1A1AA", fontWeight: 500, marginBottom: 6 }}>{b.label}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: b.data?.isAlive ? "#22C55E" : "#3F3F46", boxShadow: b.data?.isAlive ? "0 0 6px rgba(34,197,94,0.3)" : "none" }} />
                    <span style={{ fontSize: 12, color: b.data?.isAlive ? "#22C55E" : "#52525B", fontWeight: 500 }}>{b.data?.isAlive ? "Active" : "N/A"}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#52525B" }}>
                    Nonce: <span style={{ color: "#FAFAFA", fontFamily: "'JetBrains Mono', monospace" }}>{b.data?.nonce ?? "N/A"}</span>
                    {" / "}Paused: <span style={{ color: b.data?.paused ? "#EF4444" : "#22C55E", fontFamily: "'JetBrains Mono', monospace" }}>{b.data?.paused !== null && b.data?.paused !== undefined ? (b.data.paused ? "Yes" : "No") : "N/A"}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contract Lists */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 10 }}>
        {[
          { title: "Base Contracts", contracts: baseContracts, chain: "base" as const, color: "#0EA5E9" },
          { title: "Avalanche Contracts", contracts: avaxContracts, chain: "avalanche" as const, color: "#E84142" },
        ].map(({ title, contracts, chain, color }) => (
          <div key={chain} style={{
            background: "#0F0F12",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 14, overflow: "hidden",
          }}>
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color, boxShadow: `0 0 8px ${color}40` }} />
                <h2 style={{ fontSize: 13, fontWeight: 600, color: "#FAFAFA", letterSpacing: "-0.01em" }}>{title}</h2>
              </div>
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 100,
                backgroundColor: `${color}10`, color: color,
                fontWeight: 500, fontFamily: "'JetBrains Mono', monospace",
              }}>
                {CHAINS[chain].chainId}
              </span>
            </div>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {contracts.map((contract, idx) => (
                <div key={contract.address} style={{
                  display: "flex", alignItems: isMobile ? "flex-start" : "center",
                  flexDirection: isMobile ? "column" : "row",
                  gap: isMobile ? 3 : 8,
                  padding: isMobile ? "9px 14px" : "8px 16px",
                  borderBottom: idx < contracts.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                  transition: "background-color 0.15s ease",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minWidth: 0 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                      backgroundColor: loading ? "#EAB308" : contract.alive === true ? "#22C55E" : contract.alive === false ? "#EF4444" : "#3F3F46",
                      boxShadow: contract.alive === true ? "0 0 4px rgba(34,197,94,0.3)" : "none",
                    }} />
                    <p style={{
                      fontSize: 12, fontWeight: 500, color: "#FAFAFA",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      flex: 1, minWidth: 0, letterSpacing: "-0.01em",
                    }}>{contract.name}</p>
                    <a href={`${CHAINS[chain].explorerUrl}/address/${contract.address}`} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, padding: "3px 6px", borderRadius: 5,
                        backgroundColor: "rgba(255,255,255,0.03)", color: "#52525B",
                        textDecoration: "none", transition: "all 0.15s ease",
                      }}>
                      <ExternalIcon size={9} />
                    </a>
                  </div>
                  <p style={{
                    fontSize: 10, color: "#3F3F46", fontFamily: "'JetBrains Mono', monospace",
                    paddingLeft: isMobile ? 14 : 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
                  }}>
                    {`${contract.address.slice(0, 10)}...${contract.address.slice(-6)}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Activity Placeholder */}
      <div style={{ marginTop: isMobile ? 20 : 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em" }}>Recent Activity</h2>
          <div style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.04)" }} />
        </div>
        <div style={{
          background: "#0F0F12", border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: 12, padding: "32px 24px", textAlign: "center",
        }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.03)", marginBottom: 12, color: "#52525B" }}>
            <ActivityIcon size={18} />
          </div>
          <p style={{ fontSize: 14, color: "#52525B", fontWeight: 500, letterSpacing: "-0.01em" }}>Activity monitoring coming soon</p>
          <p style={{ fontSize: 12, color: "#3F3F46", marginTop: 4, letterSpacing: "-0.01em" }}>On-chain events will appear here in real-time</p>
        </div>
      </div>
    </div>
  );
}
