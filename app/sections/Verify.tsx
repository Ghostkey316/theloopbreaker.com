"use client";
import { useEffect, useState } from "react";
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, CHAINS, type ContractInfo } from "../lib/contracts";
import { checkContractAlive } from "../lib/blockchain";

type ChainFilter = "all" | "base" | "avalanche";

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

  return (
    <div style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 24 : 32 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.03em" }}>Verification</h1>
        <p style={{ fontSize: 14, color: "#71717A", marginTop: 4 }}>Verify all {contracts.length} deployed smart contracts on-chain</p>
      </div>

      {/* Stats */}
      <div style={{
        display: "flex", gap: 24, marginBottom: 20,
        fontSize: 13,
      }}>
        <span style={{ color: "#71717A" }}>Total <span style={{ color: "#F4F4F5", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{contracts.length}</span></span>
        <span style={{ color: "#71717A" }}>Verified <span style={{ color: "#22C55E", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{verifiedCount}</span></span>
        <span style={{ color: "#71717A" }}>Failed <span style={{ color: "#EF4444", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{failedCount}</span></span>
      </div>

      {/* Controls */}
      <div style={{
        display: "flex", flexDirection: isMobile ? "column" : "row",
        gap: 8, marginBottom: 16, alignItems: isMobile ? "stretch" : "center",
      }}>
        {/* Chain filter */}
        <div style={{
          display: "flex", gap: 1,
          backgroundColor: "#111113",
          borderRadius: 8, padding: 2,
          border: "1px solid rgba(255,255,255,0.04)",
        }}>
          {(["all", "base", "avalanche"] as ChainFilter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "5px 12px", borderRadius: 6, border: "none",
              fontSize: 12, fontWeight: 500, cursor: "pointer", flex: isMobile ? 1 : "none",
              backgroundColor: filter === f ? "rgba(255,255,255,0.06)" : "transparent",
              color: filter === f ? "#F4F4F5" : "#52525B",
              transition: "all 0.15s ease",
            }}>
              {f === "all" ? "All" : f === "base" ? "Base" : "Avax"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          padding: "0 12px",
          backgroundColor: "#111113",
          border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8,
        }}>
          <SearchIcon size={13} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..."
            style={{
              flex: 1, padding: "8px 0", backgroundColor: "transparent",
              border: "none", color: "#F4F4F5", fontSize: 13, outline: "none",
            }} />
        </div>

        {/* Verify All */}
        <button onClick={verifyAll} disabled={verifyingAll} style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "8px 16px", borderRadius: 8,
          background: verifyingAll ? "rgba(255,255,255,0.03)" : "#F97316",
          border: "none", color: verifyingAll ? "#52525B" : "#09090B",
          fontSize: 12, fontWeight: 600, cursor: verifyingAll ? "default" : "pointer",
          flexShrink: 0,
        }}>
          <RefreshIcon size={12} />
          {verifyingAll ? "Verifying..." : "Verify All"}
        </button>
      </div>

      {/* Contract List — clean table */}
      <div style={{
        borderRadius: 10, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.04)",
      }}>
        {filtered.map((contract, idx) => {
          const chainColor = contract.chain === "base" ? "#0EA5E9" : "#E84142";
          return (
            <div key={`${contract.chain}-${contract.address}`} style={{
              display: "flex",
              alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 6 : 8,
              padding: isMobile ? "12px 14px" : "9px 16px",
              backgroundColor: "#111113",
              borderBottom: idx < filtered.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
            }}>
              {/* Status + Name + Chain */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, width: "100%" }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: contract.checking ? "#EAB308" : contract.alive === true ? "#22C55E" : contract.alive === false ? "#EF4444" : "#3F3F46",
                  animation: contract.checking ? "statusPulse 1.5s infinite" : "none",
                }} />
                <span style={{
                  fontSize: 13, fontWeight: 500, color: "#F4F4F5",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  flex: 1, minWidth: 0,
                }}>{contract.name}</span>
                <span style={{
                  fontSize: 10, fontWeight: 500, padding: "1px 6px", borderRadius: 4,
                  backgroundColor: `${chainColor}10`, color: chainColor,
                  flexShrink: 0,
                }}>
                  {contract.chain === "base" ? "Base" : "Avax"}
                </span>
              </div>

              {/* Address + Actions */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                paddingLeft: isMobile ? 14 : 0,
                width: isMobile ? "100%" : "auto",
              }}>
                <code style={{
                  fontSize: 11, color: "#52525B",
                  fontFamily: "'JetBrains Mono', monospace",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {isMobile ? `${contract.address.slice(0, 10)}...${contract.address.slice(-6)}` : `${contract.address.slice(0, 14)}...${contract.address.slice(-8)}`}
                </code>

                <button onClick={() => verifySingle(contract.address, contract.chain)}
                  disabled={contract.checking}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 4, borderRadius: 4, border: "none",
                    backgroundColor: "transparent", color: "#52525B",
                    cursor: contract.checking ? "default" : "pointer", flexShrink: 0,
                  }}>
                  <RefreshIcon size={11} />
                </button>
                <button onClick={() => copyAddress(contract.address)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 4, borderRadius: 4, border: "none",
                    backgroundColor: "transparent",
                    color: copied === contract.address ? "#22C55E" : "#52525B",
                    cursor: "pointer", flexShrink: 0,
                  }}>
                  {copied === contract.address ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
                </button>
                <a href={`${CHAINS[contract.chain].explorerUrl}/address/${contract.address}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 4, color: "#52525B", textDecoration: "none", flexShrink: 0,
                  }}>
                  <ExternalLinkIcon size={11} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
