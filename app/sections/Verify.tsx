"use client";
import { useEffect, useState } from "react";
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, ALL_CONTRACTS, CHAINS, type ContractInfo } from "../lib/contracts";
import { checkContractAlive } from "../lib/blockchain";
import { SectionDisclaimer } from "../components/DisclaimerBanner";

type ChainFilter = "all" | "base" | "avalanche" | "ethereum";

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
    const all = ALL_CONTRACTS.map((c) => ({
      ...c, alive: null as boolean | null, checking: false,
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

  const verifySingle = async (address: string, chain: "base" | "avalanche" | "ethereum") => {
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

  const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div className="page-enter" style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 32 : 40, paddingLeft: isMobile ? 48 : 0 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.04em" }}>Verification</h1>
        <p style={{ fontSize: 14, color: "#52525B", marginTop: 6 }}>Verify all {contracts.length} deployed smart contracts on-chain</p>
      </div>

      {/* Contract Verification Disclaimer */}
      <SectionDisclaimer text="Smart contracts are deployed on Ethereum, Base, and Avalanche. Vaultfire Protocol has not been formally audited. Verify contract addresses independently before interacting. All on-chain transactions are irreversible." type="warning" />

      {/* Stats — inline, monospace numbers */}
      <div style={{
        display: "flex", gap: 32, marginBottom: 24,
        fontSize: 13,
      }}>
        <div>
          <span style={{ color: "#71717A", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Total</span>
          <span style={{ color: "#F4F4F5", fontWeight: 600, ...monoStyle, marginLeft: 8, fontSize: 14 }}>{contracts.length}</span>
        </div>
        <div>
          <span style={{ color: "#71717A", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Verified</span>
          <span style={{ color: "#22C55E", fontWeight: 600, ...monoStyle, marginLeft: 8, fontSize: 14 }}>{verifiedCount}</span>
        </div>
        <div>
          <span style={{ color: "#71717A", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Failed</span>
          <span style={{ color: failedCount > 0 ? "#EF4444" : "#3F3F46", fontWeight: 600, ...monoStyle, marginLeft: 8, fontSize: 14 }}>{failedCount}</span>
        </div>
      </div>

      {/* Controls — clean, minimal */}
      <div style={{
        display: "flex", flexDirection: isMobile ? "column" : "row",
        gap: 8, marginBottom: 24, alignItems: isMobile ? "stretch" : "center",
      }}>
        {/* Chain filter — segmented control */}
        <div style={{
          display: "flex", gap: 0,
          backgroundColor: "rgba(255,255,255,0.02)",
          borderRadius: 8, padding: 2,
        }}>
          {(["all", "base", "avalanche", "ethereum"] as ChainFilter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 14px", borderRadius: 6, border: "none",
              fontSize: 12, fontWeight: 500, cursor: "pointer", flex: isMobile ? 1 : "none",
              backgroundColor: filter === f ? "rgba(255,255,255,0.06)" : "transparent",
              color: filter === f ? "#F4F4F5" : "#52525B",
              transition: "all 0.12s ease",
            }}>
              {f === "all" ? "All" : f === "base" ? "Base" : f === "avalanche" ? "Avax" : "ETH"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          padding: "0 12px",
          backgroundColor: "rgba(255,255,255,0.02)",
          borderRadius: 8,
        }}>
          <SearchIcon size={13} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..."
            style={{
              flex: 1, padding: "8px 0", backgroundColor: "transparent",
              border: "none", color: "#F4F4F5", fontSize: 13, outline: "none",
            }} />
        </div>

        {/* Verify All — primary CTA */}
        <button onClick={verifyAll} disabled={verifyingAll} style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "8px 16px", borderRadius: 8,
          background: verifyingAll ? "rgba(255,255,255,0.03)" : "#F97316",
          border: "none", color: verifyingAll ? "#3F3F46" : "#09090B",
          fontSize: 12, fontWeight: 600, cursor: verifyingAll ? "default" : "pointer",
          flexShrink: 0,
        }}>
          <RefreshIcon size={12} />
          {verifyingAll ? "Verifying..." : "Verify All"}
        </button>
      </div>

      {/* Table header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "0 0 8px",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
        gap: 8,
      }}>
        <span style={{ width: 12 }} />
        <span style={{ flex: 1, fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Contract</span>
        {!isMobile && <span style={{ width: 60, fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500, textAlign: "center" }}>Chain</span>}
        <span style={{ width: isMobile ? 100 : 160, fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Address</span>
        <span style={{ width: 72 }} />
      </div>

      {/* Contract rows — alternating backgrounds, monospace data */}
      {filtered.map((contract, idx) => (
        <div key={`${contract.chain}-${contract.address}`} style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: isMobile ? "10px 0" : "8px 0",
          backgroundColor: idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
          borderBottom: "1px solid rgba(255,255,255,0.02)",
        }}>
          {/* Status dot */}
          <div style={{ width: 12, display: "flex", justifyContent: "center" }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              backgroundColor: contract.checking ? "#52525B" : contract.alive === true ? "#22C55E" : contract.alive === false ? "#EF4444" : "#3F3F46",
              animation: contract.checking ? "statusPulse 1.5s infinite" : "none",
            }} />
          </div>

          {/* Name */}
          <span style={{
            flex: 1, minWidth: 0,
            fontSize: 13, fontWeight: 400, color: "#E4E4E7",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{contract.name}</span>

          {/* Chain tag — tiny, subtle */}
          {!isMobile && (
            <span style={{
              width: 60, textAlign: "center",
              fontSize: 10, fontWeight: 500, color: "#52525B",
              ...monoStyle,
            }}>
              {contract.chain === "base" ? "Base" : contract.chain === "avalanche" ? "Avax" : "ETH"}
            </span>
          )}

          {/* Address — monospace */}
          <code style={{
            width: isMobile ? 100 : 160,
            fontSize: 11, color: "#3F3F46",
            ...monoStyle,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {isMobile ? `${contract.address.slice(0, 8)}...${contract.address.slice(-4)}` : `${contract.address.slice(0, 14)}...${contract.address.slice(-8)}`}
          </code>

          {/* Actions — tiny, subtle */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, width: 72, justifyContent: "flex-end" }}>
            <button onClick={() => verifySingle(contract.address, contract.chain)}
              disabled={contract.checking}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 4, borderRadius: 4, border: "none",
                backgroundColor: "transparent", color: "#3F3F46",
                cursor: contract.checking ? "default" : "pointer", flexShrink: 0,
              }}>
              <RefreshIcon size={10} />
            </button>
            <button onClick={() => copyAddress(contract.address)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 4, borderRadius: 4, border: "none",
                backgroundColor: "transparent",
                color: copied === contract.address ? "#22C55E" : "#3F3F46",
                cursor: "pointer", flexShrink: 0,
              }}>
              {copied === contract.address ? <CheckIcon size={10} /> : <CopyIcon size={10} />}
            </button>
            <a href={`${CHAINS[contract.chain].explorerUrl}/address/${contract.address}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 4, color: "#3F3F46", textDecoration: "none", flexShrink: 0,
              }}>
              <ExternalLinkIcon size={10} />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
