"use client";
import { useEffect, useState } from "react";
import { ALL_CONTRACTS, BASE_CONTRACTS, AVALANCHE_CONTRACTS, CHAINS } from "../lib/contracts";
import { checkAllChains, getMultipleContractStatus, getGovernanceData, getTeleporterBridgeStats, type RPCResult, type GovernanceData, type BridgeStats } from "../lib/blockchain";
import { SectionDisclaimer } from "../components/DisclaimerBanner";

interface ContractWithStatus {
  name: string;
  address: string;
  chain: "base" | "avalanche" | "ethereum";
  chainId: number;
  alive: boolean | null;
}

function RefreshIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>);
}
function ExternalIcon({ size = 10 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>);
}

// Skeleton for a stat card
function StatSkeleton() {
  return (
    <div>
      <div className="skeleton skeleton-text-sm" style={{ width: '55%', marginBottom: 10 }} />
      <div className="skeleton skeleton-title" style={{ width: '40%' }} />
    </div>
  );
}

// Skeleton for a contract row
function ContractRowSkeleton({ idx }: { idx: number }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 0",
      backgroundColor: idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
    }}>
      <div className="skeleton skeleton-circle" style={{ width: 4, height: 4, flexShrink: 0 }} />
      <div className="skeleton skeleton-text" style={{ flex: 1 }} />
      <div className="skeleton skeleton-circle" style={{ width: 12, height: 12, flexShrink: 0 }} />
    </div>
  );
}

export default function Dashboard() {
  const [chainStatus, setChainStatus] = useState<Record<string, RPCResult>>({});
  const [contractStatus, setContractStatus] = useState<Record<string, boolean | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
    if (!loading) setRefreshing(true);
    setLoading(true);
    const [chains, baseStatus, avaxStatus] = await Promise.all([
      checkAllChains(),
      getMultipleContractStatus("base", BASE_CONTRACTS.map((c) => c.address)),
      getMultipleContractStatus("avalanche", AVALANCHE_CONTRACTS.map((c) => c.address)),
    ]);
    setChainStatus(chains);
    setContractStatus({ ...baseStatus, ...avaxStatus });

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
    setRefreshing(false);
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

  const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  const statCards = [
    { label: "Health", value: healthScore !== null ? `${healthScore}%` : "\u2014", color: healthScore !== null ? (healthScore >= 90 ? "#22C55E" : healthScore >= 70 ? "#EAB308" : "#EF4444") : "#3F3F46" },
    { label: "Contracts Live", value: `${aliveCount}/${totalChecked || ALL_CONTRACTS.length}`, color: "#F4F4F5" },
    { label: "Base Block", value: chainStatus.base?.blockNumber?.toLocaleString() || "\u2014", color: "#F4F4F5" },
    { label: "Avax Block", value: chainStatus.avalanche?.blockNumber?.toLocaleString() || "\u2014", color: "#F4F4F5" },
    { label: "Base Latency", value: chainStatus.base?.latency ? `${chainStatus.base.latency}ms` : "\u2014", color: "#A1A1AA" },
    { label: "Avax Latency", value: chainStatus.avalanche?.latency ? `${chainStatus.avalanche.latency}ms` : "\u2014", color: "#A1A1AA" },
  ];

  return (
    <div className="page-enter" style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "space-between", marginBottom: isMobile ? 40 : 48,
        flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 0,
        paddingLeft: isMobile ? 48 : 0,
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.04em", lineHeight: 1.25 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: "#52525B", marginTop: 4, lineHeight: 1.5 }}>
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading on-chain data..."}
          </p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px",
            background: loading ? "rgba(255,255,255,0.03)" : "#F97316",
            border: "none", borderRadius: 8,
            color: loading ? "#3F3F46" : "#09090B",
            fontSize: 12, fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            alignSelf: isMobile ? "stretch" : "auto", justifyContent: "center",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = '#FB923C';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.background = '#F97316';
              e.currentTarget.style.transform = 'none';
            }
          }}
        >
          <span style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none', display: 'flex' }}>
            <RefreshIcon size={12} />
          </span>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Dashboard Disclaimer */}
      <SectionDisclaimer text="Dashboard data is fetched live from Base and Avalanche RPCs. On-chain data may be delayed. All transactions are irreversible. This is not financial advice." />

      {/* Stats — skeleton while loading */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
        gap: isMobile ? 12 : 16,
        marginBottom: 48,
      }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)
          : statCards.map((card) => (
            <div key={card.label} style={{
              padding: isMobile ? '14px 12px' : '16px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 12,
            }}>
              <p style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 600 }}>{card.label}</p>
              <p style={{
                fontSize: isMobile ? 20 : 24, fontWeight: 600, color: card.color,
                ...monoStyle,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                letterSpacing: "-0.02em",
              }}>{card.value}</p>
            </div>
          ))
        }
      </div>

      {/* Governance & Bridge */}
      {!loading && (
        <div style={{ marginBottom: 48 }}>
          <h2 style={{
            fontSize: 11, fontWeight: 500, color: "#71717A",
            textTransform: "uppercase", letterSpacing: "0.1em",
            marginBottom: 16,
          }}>Governance & Bridge</h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr auto auto" : "1fr auto auto auto",
            gap: 16,
            padding: "0 0 8px",
            borderBottom: "1px solid rgba(255,255,255,0.03)",
          }}>
            <span style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Component</span>
            <span style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500, textAlign: "right" }}>Detail</span>
            {!isMobile && <span style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500, textAlign: "right" }}></span>}
            <span style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500, textAlign: "right" }}>Status</span>
          </div>

          {[
            { label: "Governance (Base)", alive: baseGov?.isAlive, detail: baseGov ? `${baseGov.threshold}/${baseGov.ownerCount} signers` : "N/A" },
            { label: "Governance (Avax)", alive: avaxGov?.isAlive, detail: avaxGov ? `${avaxGov.threshold}/${avaxGov.ownerCount} signers` : "N/A" },
            { label: "Bridge (Base)", alive: baseBridge?.isAlive, detail: baseBridge?.paused !== null && baseBridge?.paused !== undefined ? (baseBridge.paused ? "Paused" : "Active") : "N/A" },
            { label: "Bridge (Avax)", alive: avaxBridge?.isAlive, detail: avaxBridge?.paused !== null && avaxBridge?.paused !== undefined ? (avaxBridge.paused ? "Paused" : "Active") : "N/A" },
          ].map((row, i) => (
            <div key={row.label} style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr auto auto" : "1fr auto auto auto",
              gap: 16,
              alignItems: "center",
              padding: "12px 0",
              backgroundColor: i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
              borderBottom: "1px solid rgba(255,255,255,0.02)",
              transition: "background-color 0.12s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 5, height: 5, borderRadius: "50%",
                  backgroundColor: row.alive ? "#22C55E" : "#3F3F46",
                  transition: "background-color 0.3s ease",
                }} />
                <span style={{ fontSize: 13, color: "#F4F4F5", fontWeight: 400, lineHeight: 1.5 }}>{row.label}</span>
              </div>
              <span style={{ fontSize: 12, color: "#71717A", ...monoStyle, textAlign: "right" }}>
                {row.detail}
              </span>
              {!isMobile && <span />}
              <span style={{
                fontSize: 11, fontWeight: 500,
                color: row.alive ? "#22C55E" : "#3F3F46",
                textAlign: "right",
                transition: "color 0.3s ease",
              }}>
                {row.alive ? "Live" : "N/A"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Contract Tables */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: isMobile ? 40 : 32 }}>
        {[
          { title: "Base", contracts: baseContracts, chain: "base" as const },
          { title: "Avalanche", contracts: avaxContracts, chain: "avalanche" as const },
        ].map(({ title, contracts, chain }) => (
          <div key={chain}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 12,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 500, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</h2>
              <span style={{ fontSize: 10, color: "#3F3F46", ...monoStyle }}>
                {CHAINS[chain].chainId}
              </span>
            </div>

            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0 0 6px",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              marginBottom: 2,
            }}>
              <span style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Contract</span>
              <span style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Link</span>
            </div>

            {loading
              ? Array.from({ length: 5 }).map((_, i) => <ContractRowSkeleton key={i} idx={i} />)
              : contracts.map((contract, idx) => (
                <div key={contract.address} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 0",
                  backgroundColor: idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
                  borderBottom: idx < contracts.length - 1 ? "1px solid rgba(255,255,255,0.02)" : "none",
                  transition: "background-color 0.12s ease",
                }}>
                  <div style={{
                    width: 4, height: 4, borderRadius: "50%", flexShrink: 0,
                    backgroundColor: loading ? "#52525B" : contract.alive === true ? "#22C55E" : contract.alive === false ? "#EF4444" : "#3F3F46",
                    transition: "background-color 0.3s ease",
                  }} />
                  <span style={{
                    fontSize: 12, fontWeight: 400, color: "#E4E4E7",
                    flex: 1, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    ...monoStyle,
                  }}>{contract.name}</span>
                  <a
                    href={`${CHAINS[chain].explorerUrl}/address/${contract.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, padding: 4, color: "#3F3F46",
                      textDecoration: "none", borderRadius: 4,
                      transition: "color 0.15s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#F97316'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#3F3F46'; }}
                  >
                    <ExternalIcon size={9} />
                  </a>
                </div>
              ))
            }
          </div>
        ))}
      </div>
    </div>
  );
}
