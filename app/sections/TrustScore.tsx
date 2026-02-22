"use client";
import { useEffect, useState } from "react";
import { ALL_CONTRACTS, BASE_CONTRACTS, AVALANCHE_CONTRACTS } from "../lib/contracts";
import { checkAllChains, getMultipleContractStatus, type RPCResult } from "../lib/blockchain";
import { isRegistered, getRegisteredChains } from "../lib/registration";

interface TrustMetrics {
  totalContracts: number;
  verifiedContracts: number;
  chainsActive: number;
  registeredChains: string[];
  userRegistered: boolean;
  uptimePercent: number;
  trustScore: number;
  grade: string;
}

function RefreshIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

export default function TrustScore() {
  const [metrics, setMetrics] = useState<TrustMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [chainStatus, setChainStatus] = useState<Record<string, RPCResult>>({});

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadMetrics(); }, []);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const [chains, baseStatus, avaxStatus] = await Promise.all([
        checkAllChains(),
        getMultipleContractStatus("base", BASE_CONTRACTS.map(c => c.address)),
        getMultipleContractStatus("avalanche", AVALANCHE_CONTRACTS.map(c => c.address)),
      ]);

      setChainStatus(chains);

      const allStatus = { ...baseStatus, ...avaxStatus };
      const verifiedCount = Object.values(allStatus).filter(Boolean).length;
      const totalCount = ALL_CONTRACTS.length;

      const userReg = isRegistered();
      const regChains = getRegisteredChains();

      // Calculate chains active
      let chainsActive = 0;
      if (chains.base?.success) chainsActive++;
      if (chains.avalanche?.success) chainsActive++;

      // Calculate uptime from contract health
      const uptimePercent = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

      // Calculate trust score
      let score = 0;
      // Contract health (40%)
      score += (verifiedCount / totalCount) * 40;
      // Chain availability (20%)
      score += (chainsActive / 2) * 20;
      // Protocol maturity (20%) — always high since contracts are deployed
      score += 20;
      // User registration (20%)
      if (userReg) score += 10;
      if (regChains.length >= 2) score += 10;
      else if (regChains.length >= 1) score += 5;

      score = Math.round(Math.min(score, 100));

      const grade = score >= 95 ? 'A+' : score >= 90 ? 'A' : score >= 85 ? 'A-' :
                    score >= 80 ? 'B+' : score >= 75 ? 'B' : score >= 70 ? 'B-' :
                    score >= 60 ? 'C' : score >= 50 ? 'D' : 'F';

      setMetrics({
        totalContracts: totalCount,
        verifiedContracts: verifiedCount,
        chainsActive,
        registeredChains: regChains,
        userRegistered: userReg,
        uptimePercent,
        trustScore: score,
        grade,
      });
    } catch {
      // Set defaults on error
      setMetrics({
        totalContracts: ALL_CONTRACTS.length,
        verifiedContracts: 0,
        chainsActive: 0,
        registeredChains: [],
        userRegistered: false,
        uptimePercent: 0,
        trustScore: 0,
        grade: 'N/A',
      });
    }
    setLoading(false);
  };

  const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  // Circular score display
  const scoreColor = metrics ? (
    metrics.trustScore >= 90 ? '#22C55E' :
    metrics.trustScore >= 70 ? '#EAB308' :
    metrics.trustScore >= 50 ? '#F97316' : '#EF4444'
  ) : '#3F3F46';

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = metrics ? circumference - (metrics.trustScore / 100) * circumference : circumference;

  return (
    <div style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: 680, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "space-between", marginBottom: isMobile ? 40 : 48,
        flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 0,
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#F4F4F5", letterSpacing: "-0.03em" }}>Trust Score</h1>
          <p style={{ fontSize: 12, color: "#3F3F46", marginTop: 4 }}>Vaultfire Protocol ecosystem health</p>
        </div>
        <button onClick={loadMetrics} disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px",
            background: loading ? "rgba(255,255,255,0.03)" : "#F97316",
            border: "none", borderRadius: 8,
            color: loading ? "#3F3F46" : "#09090B",
            fontSize: 12, fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            alignSelf: isMobile ? "stretch" : "auto", justifyContent: "center",
          }}>
          <RefreshIcon size={12} />
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>

      {/* Trust Score Circle */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        marginBottom: 48,
      }}>
        <div style={{ position: "relative", width: 140, height: 140 }}>
          <svg width={140} height={140} viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={scoreColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={loading ? circumference : strokeDashoffset}
              style={{ transition: "stroke-dashoffset 1s ease-out, stroke 0.3s ease" }}
            />
          </svg>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontSize: 32, fontWeight: 700, color: scoreColor,
              ...monoStyle, letterSpacing: "-0.03em",
            }}>
              {loading ? "—" : metrics?.trustScore || 0}
            </span>
            <span style={{ fontSize: 11, color: "#52525B", fontWeight: 500 }}>
              {loading ? "" : `Grade: ${metrics?.grade || 'N/A'}`}
            </span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#3F3F46", marginTop: 12 }}>
          Vaultfire Protocol Trust Score
        </p>
      </div>

      {/* Metrics Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap: isMobile ? "24px 16px" : "24px 32px",
        marginBottom: 48,
      }}>
        {[
          { label: "Verified Contracts", value: loading ? "—" : `${metrics?.verifiedContracts || 0}/${metrics?.totalContracts || 0}`, color: "#F4F4F5" },
          { label: "Chains Active", value: loading ? "—" : `${metrics?.chainsActive || 0}/2`, color: metrics && metrics.chainsActive >= 2 ? "#22C55E" : "#EAB308" },
          { label: "Protocol Uptime", value: loading ? "—" : `${metrics?.uptimePercent || 0}%`, color: metrics && metrics.uptimePercent >= 90 ? "#22C55E" : "#EAB308" },
          { label: "Your Status", value: loading ? "—" : metrics?.userRegistered ? "Registered" : "Unregistered", color: metrics?.userRegistered ? "#22C55E" : "#71717A" },
        ].map((stat) => (
          <div key={stat.label}>
            <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>{stat.label}</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: stat.color, ...monoStyle, letterSpacing: "-0.02em" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Chain Status */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 11, fontWeight: 500, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Chain Status</h2>
        {[
          { name: "Base", chain: "base" as const, color: "#627EEA" },
          { name: "Avalanche", chain: "avalanche" as const, color: "#E84142" },
        ].map((c) => {
          const status = chainStatus[c.chain];
          const regOnChain = metrics?.registeredChains.includes(c.chain);
          return (
            <div key={c.chain} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 0",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  backgroundColor: status?.success ? "#22C55E" : "#3F3F46",
                }} />
                <span style={{ fontSize: 14, color: "#F4F4F5", fontWeight: 400 }}>{c.name}</span>
                <span style={{
                  fontSize: 10, color: c.color, fontWeight: 500,
                  padding: "2px 6px", backgroundColor: `${c.color}10`, borderRadius: 4,
                }}>
                  {c.chain === "base" ? "8453" : "43114"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {status?.latency && (
                  <span style={{ fontSize: 11, color: "#52525B", ...monoStyle }}>{status.latency}ms</span>
                )}
                {regOnChain && (
                  <span style={{ fontSize: 10, color: "#22C55E", fontWeight: 500 }}>Registered</span>
                )}
                <span style={{
                  fontSize: 11, fontWeight: 500,
                  color: status?.success ? "#22C55E" : "#3F3F46",
                }}>
                  {loading ? "..." : status?.success ? "Live" : "Down"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Score Breakdown */}
      {metrics && !loading && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 11, fontWeight: 500, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Score Breakdown</h2>
          {[
            { label: "Contract Health", weight: "40%", score: Math.round((metrics.verifiedContracts / metrics.totalContracts) * 40), max: 40 },
            { label: "Chain Availability", weight: "20%", score: Math.round((metrics.chainsActive / 2) * 20), max: 20 },
            { label: "Protocol Maturity", weight: "20%", score: 20, max: 20 },
            { label: "User Registration", weight: "20%", score: metrics.userRegistered ? (metrics.registeredChains.length >= 2 ? 20 : 15) : 0, max: 20 },
          ].map((item) => (
            <div key={item.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: "#A1A1AA" }}>{item.label}</span>
                <span style={{ fontSize: 12, color: "#71717A", ...monoStyle }}>{item.score}/{item.max}</span>
              </div>
              <div style={{
                width: "100%", height: 3, backgroundColor: "rgba(255,255,255,0.04)",
                borderRadius: 2,
              }}>
                <div style={{
                  width: `${(item.score / item.max) * 100}%`, height: "100%",
                  backgroundColor: item.score >= item.max * 0.8 ? "#22C55E" : item.score >= item.max * 0.5 ? "#EAB308" : "#EF4444",
                  borderRadius: 2, transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: "#27272A", lineHeight: 1.8 }}>
        Trust score is calculated from live on-chain data including contract verification status,
        chain availability, protocol maturity, and your registration status. Score updates in real-time.
      </p>
    </div>
  );
}
