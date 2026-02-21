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

function RefreshIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>);
}
function ExternalIcon({ size = 10 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>);
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

  return (
    <div style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "space-between", marginBottom: isMobile ? 32 : 40,
        flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0,
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.03em" }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: "#52525B", marginTop: 2 }}>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading..."}</p>
        </div>
        <button onClick={loadAll} disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px",
            background: loading ? "rgba(255,255,255,0.03)" : "#F97316",
            border: "none", borderRadius: 8,
            color: loading ? "#52525B" : "#09090B",
            fontSize: 12, fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            alignSelf: isMobile ? "stretch" : "auto", justifyContent: "center",
          }}>
          <RefreshIcon size={12} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Stats — table-like grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
        gap: 1, marginBottom: 32,
        borderRadius: 12, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.04)",
      }}>
        {[
          { label: "Health", value: healthScore !== null ? `${healthScore}%` : "\u2014", color: healthScore !== null ? (healthScore >= 90 ? "#22C55E" : healthScore >= 70 ? "#EAB308" : "#EF4444") : "#52525B" },
          { label: "Contracts Live", value: `${aliveCount}/${totalChecked || ALL_CONTRACTS.length}`, color: "#22C55E" },
          { label: "Base Block", value: chainStatus.base?.blockNumber?.toLocaleString() || "\u2014", color: "#F4F4F5" },
          { label: "Avax Block", value: chainStatus.avalanche?.blockNumber?.toLocaleString() || "\u2014", color: "#F4F4F5" },
          { label: "Base Latency", value: chainStatus.base?.latency ? `${chainStatus.base.latency}ms` : "\u2014", color: "#A1A1AA" },
          { label: "Avax Latency", value: chainStatus.avalanche?.latency ? `${chainStatus.avalanche.latency}ms` : "\u2014", color: "#A1A1AA" },
        ].map((card) => (
          <div key={card.label} style={{
            background: "#111113",
            padding: isMobile ? "14px 12px" : "16px 18px",
          }}>
            <p style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 500 }}>{card.label}</p>
            <p style={{
              fontSize: isMobile ? 18 : 20, fontWeight: 600, color: card.color,
              fontFamily: "'JetBrains Mono', monospace",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              letterSpacing: "-0.02em",
            }}>{loading ? "\u2014" : card.value}</p>
          </div>
        ))}
      </div>

      {/* Governance & Bridge — clean rows */}
      {!loading && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 11, fontWeight: 500, color: "#52525B",
            textTransform: "uppercase", letterSpacing: "0.08em",
            marginBottom: 12,
          }}>Governance & Bridge</h2>

          <div style={{
            borderRadius: 12, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.04)",
          }}>
            {/* Governance rows */}
            {[
              { label: "Governance (Base)", alive: baseGov?.isAlive, threshold: baseGov?.threshold, owners: baseGov?.ownerCount },
              { label: "Governance (Avax)", alive: avaxGov?.isAlive, threshold: avaxGov?.threshold, owners: avaxGov?.ownerCount },
              { label: "Bridge (Base)", alive: baseBridge?.isAlive, paused: baseBridge?.paused, nonce: baseBridge?.nonce },
              { label: "Bridge (Avax)", alive: avaxBridge?.isAlive, paused: avaxBridge?.paused, nonce: avaxBridge?.nonce },
            ].map((row, i) => (
              <div key={row.label} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 18px",
                backgroundColor: "#111113",
                borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.03)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    backgroundColor: row.alive ? "#22C55E" : "#3F3F46",
                  }} />
                  <span style={{ fontSize: 13, color: "#F4F4F5", fontWeight: 500 }}>{row.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {'threshold' in row && (
                    <span style={{ fontSize: 12, color: "#71717A", fontFamily: "'JetBrains Mono', monospace" }}>
                      {row.threshold ?? "N/A"}/{row.owners ?? "N/A"} signers
                    </span>
                  )}
                  {'paused' in row && (
                    <span style={{ fontSize: 12, color: "#71717A", fontFamily: "'JetBrains Mono', monospace" }}>
                      {row.paused !== null && row.paused !== undefined ? (row.paused ? "Paused" : "Active") : "N/A"}
                    </span>
                  )}
                  <span style={{
                    fontSize: 11, fontWeight: 500,
                    color: row.alive ? "#22C55E" : "#52525B",
                  }}>
                    {row.alive ? "Live" : "N/A"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contract Lists — table style */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 16 }}>
        {[
          { title: "Base", contracts: baseContracts, chain: "base" as const, color: "#0EA5E9" },
          { title: "Avalanche", contracts: avaxContracts, chain: "avalanche" as const, color: "#E84142" },
        ].map(({ title, contracts, chain, color }) => (
          <div key={chain}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 8,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color }} />
              <h2 style={{ fontSize: 12, fontWeight: 600, color: "#F4F4F5" }}>{title}</h2>
              <span style={{ fontSize: 10, color: "#52525B", fontFamily: "'JetBrains Mono', monospace" }}>
                {CHAINS[chain].chainId}
              </span>
            </div>

            <div style={{
              borderRadius: 10, overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.04)",
            }}>
              {contracts.map((contract, idx) => (
                <div key={contract.address} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 14px",
                  backgroundColor: "#111113",
                  borderBottom: idx < contracts.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                }}>
                  <div style={{
                    width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                    backgroundColor: loading ? "#EAB308" : contract.alive === true ? "#22C55E" : contract.alive === false ? "#EF4444" : "#3F3F46",
                  }} />
                  <span style={{
                    fontSize: 12, fontWeight: 500, color: "#F4F4F5",
                    flex: 1, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{contract.name}</span>
                  <a href={`${CHAINS[chain].explorerUrl}/address/${contract.address}`} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, padding: 3, color: "#52525B",
                      textDecoration: "none",
                    }}>
                    <ExternalIcon size={9} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
