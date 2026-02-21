"use client";
import { useEffect, useState } from "react";
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, CHAINS, type ContractInfo } from "../lib/contracts";
import { checkContractAlive } from "../lib/blockchain";

type ChainFilter = "all" | "base" | "avalanche";

/* ── SVG Icons ── */
function ShieldCheckIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>);
}
function ExternalLinkIcon({ size = 11 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>);
}
function CopyIcon({ size = 11 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>);
}
function CheckIcon({ size = 11 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>);
}
function RefreshIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>);
}
function SearchIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>);
}

interface ContractRow extends ContractInfo {
  alive: boolean | null;
  checking: boolean;
}

export default function Verify() {
  const [filter, setFilter] = useState<ChainFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [copied, setCopied] = useState("");
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const all = [...BASE_CONTRACTS, ...AVALANCHE_CONTRACTS].map((c) => ({
      ...c, alive: null, checking: false,
    }));
    setContracts(all);
  }, []);

  const filtered = contracts.filter((c) => {
    const matchChain = filter === "all" || c.chain === filter;
    const matchSearch = searchQuery === "" ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchChain && matchSearch;
  });

  const verifyAll = async () => {
    setVerifyingAll(true);
    setContracts((prev) => prev.map((c) => ({ ...c, checking: true, alive: null })));

    const results = await Promise.all(
      contracts.map(async (c) => {
        const alive = await checkContractAlive(c.chain, c.address);
        return { ...c, alive, checking: false };
      })
    );
    setContracts(results);
    setVerifyingAll(false);
  };

  const verifySingle = async (address: string, chain: "base" | "avalanche") => {
    setContracts((prev) =>
      prev.map((c) => c.address === address && c.chain === chain ? { ...c, checking: true } : c)
    );
    const alive = await checkContractAlive(chain, address);
    setContracts((prev) =>
      prev.map((c) => c.address === address && c.chain === chain ? { ...c, alive, checking: false } : c)
    );
  };

  const copyAddress = async (addr: string) => {
    await navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(""), 2000);
  };

  const verifiedCount = contracts.filter((c) => c.alive === true).length;
  const failedCount = contracts.filter((c) => c.alive === false).length;
  const pendingCount = contracts.filter((c) => c.alive === null && !c.checking).length;

  return (
    <div style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: "56rem", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 24 : 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: isMobile ? 40 : 44, height: isMobile ? 40 : 44, borderRadius: 14,
            background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))",
            border: "1px solid rgba(249,115,22,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(249,115,22,0.06)",
          }}>
            <ShieldCheckIcon size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: "#FAFAFA", letterSpacing: "-0.03em" }}>Contract Verification</h1>
            <p style={{ fontSize: 14, color: "#A1A1AA", letterSpacing: "-0.01em" }}>Verify all 28 deployed smart contracts on-chain</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16,
      }}>
        {[
          { label: "Total", value: contracts.length, color: "#A1A1AA" },
          { label: "Verified", value: verifiedCount, color: "#22C55E" },
          { label: "Failed", value: failedCount, color: "#EF4444" },
          { label: "Pending", value: pendingCount, color: "#EAB308" },
        ].map((stat) => (
          <div key={stat.label} style={{
            background: "#0F0F12", border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 10, padding: isMobile ? "10px 8px" : "12px 14px", textAlign: "center",
          }}>
            <p style={{
              fontSize: isMobile ? 20 : 22, fontWeight: 700, color: stat.color,
              letterSpacing: "-0.02em", fontFamily: "'JetBrains Mono', monospace",
            }}>{stat.value}</p>
            <p style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2, fontWeight: 500 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{
        display: "flex", flexDirection: isMobile ? "column" : "row",
        gap: 8, marginBottom: 16, alignItems: isMobile ? "stretch" : "center",
      }}>
        {/* Chain filter */}
        <div style={{
          display: "flex", backgroundColor: "#0F0F12",
          border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, padding: 3,
        }}>
          {(["all", "base", "avalanche"] as ChainFilter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "5px 12px", borderRadius: 7, border: "none",
              fontSize: 12, fontWeight: 500, cursor: "pointer", flex: isMobile ? 1 : "none",
              backgroundColor: filter === f ? "rgba(249,115,22,0.08)" : "transparent",
              color: filter === f ? "#F97316" : "#52525B",
              transition: "all 0.2s ease", letterSpacing: "-0.01em",
            }}>
              {f === "all" ? `All (${contracts.length})` : f === "base" ? `Base (${BASE_CONTRACTS.length})` : `Avax (${AVALANCHE_CONTRACTS.length})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          padding: "0 12px", background: "#0F0F12",
          border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10,
        }}>
          <SearchIcon size={13} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search contracts..."
            style={{
              flex: 1, padding: "8px 0", backgroundColor: "transparent",
              border: "none", color: "#FAFAFA", fontSize: 13, outline: "none",
              letterSpacing: "-0.01em",
            }} />
        </div>

        {/* Verify All button */}
        <button onClick={verifyAll} disabled={verifyingAll} style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "8px 16px", borderRadius: 8,
          background: verifyingAll ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, #F97316, #EA580C)",
          border: "none", color: verifyingAll ? "#52525B" : "#09090B",
          fontSize: 12, fontWeight: 600, cursor: verifyingAll ? "default" : "pointer",
          transition: "all 0.2s ease", flexShrink: 0,
          boxShadow: verifyingAll ? "none" : "0 2px 8px rgba(249,115,22,0.15)",
        }}>
          <RefreshIcon size={12} />
          {verifyingAll ? "Verifying..." : "Verify All"}
        </button>
      </div>

      {/* Contract List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {filtered.map((contract) => {
          const chainColor = contract.chain === "base" ? "#0EA5E9" : "#E84142";
          return (
            <div key={`${contract.chain}-${contract.address}`} className="card-hover-effect" style={{
              background: "#0F0F12",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 10,
              padding: isMobile ? "12px 14px" : "10px 16px",
              display: "flex", flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "flex-start" : "center",
              gap: isMobile ? 8 : 10,
            }}>
              {/* Status + Name + Chain */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: contract.checking ? "#EAB308" : contract.alive === true ? "#22C55E" : contract.alive === false ? "#EF4444" : "#3F3F46",
                  boxShadow: contract.alive === true ? "0 0 6px rgba(34,197,94,0.3)" : "none",
                  animation: contract.checking ? "statusPulse 1.5s infinite" : "none",
                }} />
                <p style={{
                  fontSize: 13, fontWeight: 500, color: "#FAFAFA", letterSpacing: "-0.01em",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  flex: 1, minWidth: 0,
                }}>{contract.name}</p>
                <span style={{
                  fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 100,
                  backgroundColor: `${chainColor}10`, color: chainColor,
                  border: `1px solid ${chainColor}20`, flexShrink: 0,
                }}>
                  {contract.chain === "base" ? "Base" : "Avax"}
                </span>
              </div>

              {/* Address */}
              <code style={{
                fontSize: isMobile ? 10 : 11, color: "#52525B",
                fontFamily: "'JetBrains Mono', monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                paddingLeft: isMobile ? 15 : 0,
              }}>
                {isMobile ? `${contract.address.slice(0, 14)}...${contract.address.slice(-8)}` : contract.address}
              </code>

              {/* Actions */}
              <div style={{ display: "flex", gap: 4, flexShrink: 0, paddingLeft: isMobile ? 15 : 0 }}>
                <button onClick={() => verifySingle(contract.address, contract.chain)}
                  disabled={contract.checking}
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)",
                    background: "rgba(255,255,255,0.02)", color: "#A1A1AA",
                    fontSize: 11, cursor: contract.checking ? "default" : "pointer",
                    display: "inline-flex", alignItems: "center", gap: 4,
                    transition: "all 0.2s ease", fontWeight: 500,
                  }}>
                  {contract.checking ? (
                    <div style={{ width: 10, height: 10, border: "1.5px solid rgba(255,255,255,0.1)", borderTopColor: "#F97316", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  ) : (
                    <ShieldCheckIcon size={10} />
                  )}
                  {isMobile ? "" : "Verify"}
                </button>
                <button onClick={() => copyAddress(contract.address)}
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)",
                    background: copied === contract.address ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)",
                    color: copied === contract.address ? "#22C55E" : "#A1A1AA",
                    fontSize: 11, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 4,
                    transition: "all 0.2s ease", fontWeight: 500,
                  }}>
                  {copied === contract.address ? <CheckIcon size={10} /> : <CopyIcon size={10} />}
                  {isMobile ? "" : (copied === contract.address ? "Copied" : "Copy")}
                </button>
                <a href={`${CHAINS[contract.chain].explorerUrl}/address/${contract.address}`} target="_blank" rel="noopener noreferrer"
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)",
                    background: "rgba(255,255,255,0.02)", color: "#A1A1AA",
                    fontSize: 11, textDecoration: "none",
                    display: "inline-flex", alignItems: "center", gap: 4,
                    transition: "all 0.2s ease", fontWeight: 500,
                  }}>
                  <ExternalLinkIcon size={10} />
                  {isMobile ? "" : "Explorer"}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ fontSize: 13, color: "#52525B" }}>No contracts match your search.</p>
        </div>
      )}
    </div>
  );
}
