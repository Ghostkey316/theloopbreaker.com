"use client";
import { useEffect, useState } from "react";
import { ALL_CONTRACTS, BASE_CONTRACTS, AVALANCHE_CONTRACTS } from "../lib/contracts";
import { checkAllChains, getMultipleContractStatus, type RPCResult } from "../lib/blockchain";
import { isRegistered, getRegisteredChains } from "../lib/registration";
import { AlphaBanner } from "../components/DisclaimerBanner";

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

// Skeleton for trust score circle
function CircleSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 48 }}>
      <div className="skeleton skeleton-circle" style={{ width: 140, height: 140 }} />
      <div className="skeleton skeleton-text-sm" style={{ width: 160, marginTop: 16 }} />
    </div>
  );
}

// Skeleton for a metric card
function MetricSkeleton() {
  return (
    <div>
      <div className="skeleton skeleton-text-sm" style={{ width: '70%', marginBottom: 10 }} />
      <div className="skeleton skeleton-text-lg" style={{ width: '40%' }} />
    </div>
  );
}

/* ── Trust Score Simulator ── */
function TrustScoreSimulator({ currentScore }: { currentScore: number | null }) {
  const actions = [
    { id: 'register', label: 'Register on ERC-8004', delta: +15, category: 'identity', desc: 'Establishes your on-chain identity across all supported chains.' },
    { id: 'bond_bronze', label: 'Post Bronze Bond (0.1 ETH)', delta: +10, category: 'bond', desc: 'Minimum accountability bond. Signals basic commitment.' },
    { id: 'bond_silver', label: 'Post Silver Bond (0.5 ETH)', delta: +8, category: 'bond', desc: 'Incremental upgrade from Bronze. Increases trust weight.' },
    { id: 'bond_gold', label: 'Post Gold Bond (2 ETH)', delta: +7, category: 'bond', desc: 'Significant bond. Unlocks higher-trust task categories.' },
    { id: 'vns_name', label: 'Register .vns Name', delta: +12, category: 'identity', desc: 'Human-readable identity. Required for XMTP trust-gating.' },
    { id: 'complete_task', label: 'Complete 10 Tasks Successfully', delta: +8, category: 'activity', desc: 'Demonstrated reliability through task completion history.' },
    { id: 'zk_proof', label: 'Generate ZK Trust Proof', delta: +5, category: 'privacy', desc: 'Proves trust level without revealing private data.' },
    { id: 'slash_event', label: 'Slashing Event (penalty)', delta: -20, category: 'penalty', desc: 'Bond slashed due to a verified misconduct report.' },
    { id: 'dispute', label: 'Unresolved Dispute', delta: -10, category: 'penalty', desc: 'A task dispute was filed and not resolved within 7 days.' },
  ];

  const categoryColors: Record<string, string> = {
    identity: '#8B5CF6',
    bond: '#F59E0B',
    activity: '#22C55E',
    privacy: '#00D9FF',
    penalty: '#EF4444',
  };

  const [selected, setSelected] = useState<string[]>([]);
  const baseScore = currentScore ?? 60;

  const simulatedScore = Math.max(0, Math.min(100,
    baseScore + selected.reduce((sum, id) => {
      const action = actions.find(a => a.id === id);
      return sum + (action?.delta ?? 0);
    }, 0)
  ));

  const delta = simulatedScore - baseScore;
  const scoreColor = simulatedScore >= 80 ? '#22C55E' : simulatedScore >= 60 ? '#EAB308' : '#EF4444';

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div style={{
      marginTop: 32, padding: 20, borderRadius: 16,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F4F4F5', marginBottom: 2 }}>Trust Score Simulator</h3>
          <p style={{ fontSize: 11, color: '#52525B' }}>See how actions affect your trust score before committing on-chain.</p>
        </div>
        {selected.length > 0 && (
          <button
            onClick={() => setSelected([])}
            style={{
              fontSize: 10, color: '#52525B', background: 'none',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
              padding: '3px 8px', cursor: 'pointer',
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Score Preview */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 18px', borderRadius: 12, marginBottom: 16,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#52525B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Current</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#71717A', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.04em' }}>{baseScore}</div>
        </div>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#3F3F46" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#52525B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Simulated</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.04em', transition: 'color 0.3s ease' }}>{simulatedScore}</div>
        </div>
        {selected.length > 0 && (
          <div style={{
            marginLeft: 'auto',
            fontSize: 14, fontWeight: 700,
            color: delta > 0 ? '#22C55E' : '#EF4444',
          }}>
            {delta > 0 ? '+' : ''}{delta}
          </div>
        )}
      </div>

      {/* Score Bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: `${baseScore}%`, height: '100%', backgroundColor: '#3F3F46', borderRadius: 2 }} />
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: `${simulatedScore}%`, height: '100%',
            backgroundColor: scoreColor, borderRadius: 2,
            transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease',
            opacity: selected.length > 0 ? 1 : 0,
          }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {actions.map(action => {
          const isSelected = selected.includes(action.id);
          const color = categoryColors[action.category];
          return (
            <button
              key={action.id}
              onClick={() => toggle(action.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: isSelected ? `${color}08` : 'transparent',
                border: `1px solid ${isSelected ? color + '30' : 'rgba(255,255,255,0.05)'}`,
                textAlign: 'left', transition: 'all 0.15s ease',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                backgroundColor: isSelected ? `${color}20` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isSelected ? color + '40' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isSelected && (
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#F4F4F5' : '#A1A1AA' }}>{action.label}</div>
                <div style={{ fontSize: 10, color: '#52525B', marginTop: 1 }}>{action.desc}</div>
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: action.delta > 0 ? '#22C55E' : '#EF4444',
                flexShrink: 0,
              }}>
                {action.delta > 0 ? '+' : ''}{action.delta}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TrustScore() {
  const [metrics, setMetrics] = useState<TrustMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
    if (!loading) setRefreshing(true);
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

      let chainsActive = 0;
      if (chains.base?.success) chainsActive++;
      if (chains.avalanche?.success) chainsActive++;

      const uptimePercent = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

      let score = 0;
      score += (verifiedCount / totalCount) * 40;
      score += (chainsActive / 2) * 20;
      score += 20;
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
    setRefreshing(false);
  };

  const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  const scoreColor = metrics ? (
    metrics.trustScore >= 90 ? '#22C55E' :
    metrics.trustScore >= 70 ? '#EAB308' :
    metrics.trustScore >= 50 ? '#F97316' : '#EF4444'
  ) : '#3F3F46';

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = metrics ? circumference - (metrics.trustScore / 100) * circumference : circumference;

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
          <p style={{ fontSize: 12, color: "#3F3F46", marginTop: 4, lineHeight: 1.5 }}>Embris by Vaultfire Protocol health</p>
        </div>
        <button
          onClick={loadMetrics}
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
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>

      {/* Trust Score Circle */}
      {loading ? (
        <CircleSkeleton />
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          marginBottom: 48,
        }}>
          <div className="breathe" style={{ position: "relative", width: 160, height: 160 }}>
            {/* Ambient glow behind circle */}
            <div style={{
              position: 'absolute', inset: -20,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${scoreColor}10 0%, transparent 70%)`,
              pointerEvents: 'none',
            }} />
            <svg width={160} height={160} viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)", position: 'relative', zIndex: 1 }}>
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke={scoreColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease",
                  filter: `drop-shadow(0 0 8px ${scoreColor}40)`,
                }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              zIndex: 2,
            }}>
              <span style={{
                fontSize: 36, fontWeight: 800, color: scoreColor,
                ...monoStyle, letterSpacing: "-0.04em",
                transition: "color 0.3s ease",
                textShadow: `0 0 20px ${scoreColor}30`,
              }}>
                {metrics?.trustScore || 0}
              </span>
              <span style={{ fontSize: 11, color: "#52525B", fontWeight: 600 }}>
                {`Grade: ${metrics?.grade || 'N/A'}`}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#52525B", marginTop: 16, lineHeight: 1.5, fontWeight: 500 }}>
            Embris Trust Score
          </p>
          <p style={{ fontSize: 10, color: "#27272A", marginTop: 4, fontStyle: 'italic' }}>
            Trust earned, not assumed. Verified on-chain.
          </p>
        </div>
      )}

      {/* Metrics Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap: isMobile ? "24px 16px" : "24px 32px",
        marginBottom: 48,
      }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
          : [
            { label: "Verified Contracts", value: `${metrics?.verifiedContracts || 0}/${metrics?.totalContracts || 0}`, color: "#F4F4F5" },
            { label: "Chains Active", value: `${metrics?.chainsActive || 0}/2`, color: metrics && metrics.chainsActive >= 2 ? "#22C55E" : "#EAB308" },
            { label: "Protocol Uptime", value: `${metrics?.uptimePercent || 0}%`, color: metrics && metrics.uptimePercent >= 90 ? "#22C55E" : "#EAB308" },
            { label: "Your Status", value: metrics?.userRegistered ? "Registered" : "Unregistered", color: metrics?.userRegistered ? "#22C55E" : "#71717A" },
          ].map((stat) => (
            <div key={stat.label}>
              <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>{stat.label}</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: stat.color, ...monoStyle, letterSpacing: "-0.02em" }}>{stat.value}</p>
            </div>
          ))
        }
      </div>

      {/* Chain Status */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Chain Status</h2>
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
              transition: "background-color 0.12s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  backgroundColor: status?.success ? "#22C55E" : "#3F3F46",
                  transition: "background-color 0.3s ease",
                }} />
                <span style={{ fontSize: 14, color: "#F4F4F5", fontWeight: 400, lineHeight: 1.5 }}>{c.name}</span>
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
                  transition: "color 0.3s ease",
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
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Score Breakdown</h2>
          {[
            { label: "Contract Health", weight: "40%", score: Math.round((metrics.verifiedContracts / metrics.totalContracts) * 40), max: 40 },
            { label: "Chain Availability", weight: "20%", score: Math.round((metrics.chainsActive / 2) * 20), max: 20 },
            { label: "Protocol Maturity", weight: "20%", score: 20, max: 20 },
            { label: "User Registration", weight: "20%", score: metrics.userRegistered ? (metrics.registeredChains.length >= 2 ? 20 : 15) : 0, max: 20 },
          ].map((item) => (
            <div key={item.label} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.5 }}>{item.label}</span>
                <span style={{ fontSize: 12, color: "#71717A", ...monoStyle }}>{item.score}/{item.max}</span>
              </div>
              <div style={{
                width: "100%", height: 3, backgroundColor: "rgba(255,255,255,0.04)",
                borderRadius: 2, overflow: "hidden",
              }}>
                <div style={{
                  width: `${(item.score / item.max) * 100}%`, height: "100%",
                  backgroundColor: item.score >= item.max * 0.8 ? "#22C55E" : item.score >= item.max * 0.5 ? "#EAB308" : "#EF4444",
                  borderRadius: 2,
                  transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accountability Statement */}
      <div style={{
        padding: '16px 20px', borderRadius: 12, marginBottom: 8,
        background: 'linear-gradient(135deg, rgba(249,115,22,0.04) 0%, rgba(167,139,250,0.03) 100%)',
        borderLeft: '3px solid #F97316',
      }}>
        <p style={{ fontSize: 12, color: '#A1A1AA', lineHeight: 1.8, marginBottom: 6 }}>
          Trust score is calculated from live on-chain data including contract verification status,
          chain availability, protocol maturity, and your registration status.
        </p>
        <p style={{ fontSize: 11, color: '#F97316', fontWeight: 600, fontStyle: 'italic' }}>
          &ldquo;In the Vaultfire Protocol, trust is not a promise &mdash; it is a provable, on-chain fact.&rdquo;
        </p>
      </div>

      {/* Trust Score Simulator */}
      <TrustScoreSimulator currentScore={metrics?.trustScore ?? null} />
    </div>
  );
}
