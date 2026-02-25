"use client";
/**
 * TrustScore — Real trust score calculated from ACTUAL on-chain data:
 *   - ERC8004IdentityRegistry (identity registered?)
 *   - AIPartnershipBondsV2 (partnership bonds?)
 *   - DilithiumAttestor (belief attestations?)
 *   - ERC8004ReputationRegistry (reputation entries?)
 *   - ERC8004ValidationRegistry (validated?)
 */
import { useEffect, useState, useCallback } from "react";
import { useWalletAuth } from "../lib/WalletAuthContext";
import {
  getMultiChainTrustProfile,
  type MultiChainTrustProfile,
  type TrustScoreBreakdown,
} from "../lib/onchain-reader";
import { checkAllChains, type RPCResult } from "../lib/blockchain";
import { AlphaBanner } from "../components/DisclaimerBanner";

function RefreshIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

const SCORE_FACTORS = [
  { key: "identityScore", label: "Identity Registration", max: 25, color: "#8B5CF6", desc: "ERC8004IdentityRegistry — registered on-chain identity", contract: "ERC8004IdentityRegistry" },
  { key: "partnershipScore", label: "Partnership Bonds", max: 25, color: "#F59E0B", desc: "AIPartnershipBondsV2 — active bonds with stake", contract: "AIPartnershipBondsV2" },
  { key: "attestationScore", label: "Belief Attestations", max: 20, color: "#22C55E", desc: "DilithiumAttestor — verified belief attestations", contract: "DilithiumAttestor" },
  { key: "reputationScore", label: "Reputation Score", max: 15, color: "#3B82F6", desc: "ERC8004ReputationRegistry — on-chain reputation entries", contract: "ERC8004ReputationRegistry" },
  { key: "validationScore", label: "Validation Status", max: 15, color: "#EC4899", desc: "ERC8004ValidationRegistry — validated by registry", contract: "ERC8004ValidationRegistry" },
];

export default function TrustScore() {
  const { isUnlocked, address } = useWalletAuth();
  const [profile, setProfile] = useState<MultiChainTrustProfile | null>(null);
  const [chainStatus, setChainStatus] = useState<Record<string, RPCResult>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadData = useCallback(async () => {
    if (loading) setRefreshing(true);
    setLoading(true);
    try {
      const chains = await checkAllChains();
      setChainStatus(chains);

      if (address) {
        const trustProfile = await getMultiChainTrustProfile(address);
        setProfile(trustProfile);
      }
    } catch (e) {
      console.error("Trust score load error:", e);
    }
    setLoading(false);
    setRefreshing(false);
  }, [address, loading]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const breakdown = profile?.breakdown;
  const score = breakdown?.totalScore ?? 0;
  const grade = score >= 95 ? "A+" : score >= 90 ? "A" : score >= 85 ? "A-" :
    score >= 80 ? "B+" : score >= 75 ? "B" : score >= 70 ? "B-" :
    score >= 60 ? "C" : score >= 50 ? "D" : score > 0 ? "F" : "—";

  const scoreColor = score >= 80 ? "#22C55E" : score >= 60 ? "#EAB308" : score >= 30 ? "#F97316" : score > 0 ? "#EF4444" : "#3F3F46";
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div className="page-enter" style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: 680, margin: "0 auto" }}>
      <AlphaBanner />

      {/* Header */}
      <div style={{
        display: "flex", alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "space-between", marginBottom: isMobile ? 40 : 48,
        flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 0,
        paddingLeft: isMobile ? 48 : 0,
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.04em", lineHeight: 1.25 }}>Trust Score</h1>
          <p style={{ fontSize: 12, color: "#3F3F46", marginTop: 4, lineHeight: 1.5 }}>
            Calculated from real on-chain data across all chains
          </p>
        </div>
        <button onClick={loadData} disabled={loading} style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
          background: loading ? "rgba(255,255,255,0.03)" : "#F97316",
          border: "none", borderRadius: 8,
          color: loading ? "#3F3F46" : "#09090B",
          fontSize: 12, fontWeight: 600, cursor: loading ? "default" : "pointer",
          transition: "all 0.15s ease",
        }}>
          <span style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none", display: "flex" }}>
            <RefreshIcon size={12} />
          </span>
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>

      {/* No Wallet Connected */}
      {!isUnlocked && (
        <div style={{
          padding: 40, textAlign: "center", borderRadius: 16,
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#A1A1AA", marginBottom: 8 }}>Connect Wallet to See Your Trust Score</h2>
          <p style={{ fontSize: 13, color: "#52525B", maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
            Your trust score is calculated from real on-chain data tied to your wallet address.
            Connect your wallet to see your score across all chains.
          </p>
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#71717A", marginBottom: 12 }}>How to Build Trust</h3>
            {SCORE_FACTORS.map(f => (
              <div key={f.key} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: f.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#A1A1AA", flex: 1, textAlign: "left" }}>{f.label}</span>
                <span style={{ fontSize: 11, color: "#52525B", ...mono }}>+{f.max} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trust Score Circle */}
      {isUnlocked && (
        <>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 48 }}>
            <div className="breathe" style={{ position: "relative", width: 160, height: 160 }}>
              <div style={{
                position: "absolute", inset: -20, borderRadius: "50%",
                background: `radial-gradient(circle, ${scoreColor}10 0%, transparent 70%)`,
                pointerEvents: "none",
              }} />
              <svg width={160} height={160} viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)", position: "relative", zIndex: 1 }}>
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
                <circle cx="60" cy="60" r="54" fill="none" stroke={scoreColor} strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={loading ? circumference : strokeDashoffset}
                  style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease", filter: `drop-shadow(0 0 8px ${scoreColor}40)` }}
                />
              </svg>
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", zIndex: 2,
              }}>
                <span style={{
                  fontSize: 36, fontWeight: 800, color: scoreColor, ...mono, letterSpacing: "-0.04em",
                  transition: "color 0.3s ease", textShadow: `0 0 20px ${scoreColor}30`,
                }}>
                  {loading ? "..." : score}
                </span>
                <span style={{ fontSize: 11, color: "#52525B", fontWeight: 600 }}>
                  Grade: {loading ? "..." : grade}
                </span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#52525B", marginTop: 16, fontWeight: 500 }}>
              {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : ""}
            </p>
          </div>

          {/* Score Breakdown */}
          {breakdown && !loading && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                On-Chain Score Breakdown
              </h2>
              {SCORE_FACTORS.map(factor => {
                const val = breakdown[factor.key as keyof TrustScoreBreakdown] as number;
                return (
                  <div key={factor.key} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.5 }}>{factor.label}</span>
                        <span style={{ fontSize: 10, color: "#3F3F46", marginLeft: 8 }}>{factor.contract}</span>
                      </div>
                      <span style={{ fontSize: 12, color: val > 0 ? factor.color : "#3F3F46", ...mono, fontWeight: 600 }}>
                        {val}/{factor.max}
                      </span>
                    </div>
                    <div style={{
                      width: "100%", height: 4, backgroundColor: "rgba(255,255,255,0.04)",
                      borderRadius: 2, overflow: "hidden",
                    }}>
                      <div style={{
                        width: `${(val / factor.max) * 100}%`, height: "100%",
                        backgroundColor: val > 0 ? factor.color : "transparent",
                        borderRadius: 2, transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                      }} />
                    </div>
                    <p style={{ fontSize: 10, color: "#3F3F46", marginTop: 4 }}>{factor.desc}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Details */}
          {breakdown && breakdown.details.length > 0 && !loading && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                Verification Details
              </h2>
              <div style={{
                borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)",
                backgroundColor: "rgba(255,255,255,0.02)", padding: 16,
              }}>
                {breakdown.details.map((detail, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                    borderBottom: i < breakdown.details.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      backgroundColor: detail.toLowerCase().includes("no ") || detail.toLowerCase().includes("not ") ? "#3F3F46" : "#22C55E",
                    }} />
                    <span style={{ fontSize: 12, color: "#A1A1AA" }}>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chain Status */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
              Chain Status
            </h2>
            {[
              { name: "Ethereum", chain: "ethereum" as const, color: "#627EEA", chainId: 1 },
              { name: "Base", chain: "base" as const, color: "#0052FF", chainId: 8453 },
              { name: "Avalanche", chain: "avalanche" as const, color: "#E84142", chainId: 43114 },
            ].map(c => {
              const status = chainStatus[c.chain];
              return (
                <div key={c.chain} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: status?.success ? "#22C55E" : "#3F3F46" }} />
                    <span style={{ fontSize: 14, color: "#F4F4F5", fontWeight: 400 }}>{c.name}</span>
                    <span style={{ fontSize: 10, color: c.color, fontWeight: 500, padding: "2px 6px", backgroundColor: `${c.color}10`, borderRadius: 4 }}>
                      {c.chainId}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {status?.latency && <span style={{ fontSize: 11, color: "#52525B", ...mono }}>{status.latency}ms</span>}
                    <span style={{ fontSize: 11, fontWeight: 500, color: status?.success ? "#22C55E" : "#3F3F46" }}>
                      {loading ? "..." : status?.success ? "Live" : "Down"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Zero Score Guidance */}
          {score === 0 && !loading && (
            <div style={{
              padding: "20px 24px", borderRadius: 14,
              background: "linear-gradient(135deg, rgba(249,115,22,0.04) 0%, rgba(139,92,246,0.03) 100%)",
              border: "1px solid rgba(249,115,22,0.15)",
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F97316", marginBottom: 8 }}>Build Your Trust Score</h3>
              <p style={{ fontSize: 12, color: "#A1A1AA", lineHeight: 1.8, marginBottom: 12 }}>
                Your trust score is 0 because no on-chain activity was found for this address. Here&apos;s how to build trust:
              </p>
              <ol style={{ fontSize: 12, color: "#A1A1AA", lineHeight: 2, paddingLeft: 20 }}>
                <li>Register your identity on ERC8004IdentityRegistry (+15-25 pts)</li>
                <li>Create a partnership bond on AIPartnershipBondsV2 (+10-25 pts)</li>
                <li>Get a belief attestation from DilithiumAttestor (+5-20 pts)</li>
                <li>Build reputation in ERC8004ReputationRegistry (+up to 15 pts)</li>
                <li>Get validated by ERC8004ValidationRegistry (+15 pts)</li>
              </ol>
            </div>
          )}
        </>
      )}

      {/* Accountability Statement */}
      <div style={{
        padding: "16px 20px", borderRadius: 12, marginTop: 24,
        background: "linear-gradient(135deg, rgba(249,115,22,0.04) 0%, rgba(167,139,250,0.03) 100%)",
        borderLeft: "3px solid #F97316",
      }}>
        <p style={{ fontSize: 12, color: "#A1A1AA", lineHeight: 1.8, marginBottom: 6 }}>
          Trust score is calculated entirely from verifiable on-chain data: identity registration,
          partnership bonds, belief attestations, reputation entries, and validation status. No free points.
        </p>
        <p style={{ fontSize: 11, color: "#F97316", fontWeight: 600, fontStyle: "italic" }}>
          &ldquo;In the Vaultfire Protocol, trust is not a promise — it is a provable, on-chain fact.&rdquo;
        </p>
      </div>
    </div>
  );
}
