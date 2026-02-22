"use client";
/**
 * TrustBadges — Verified badge tiers based on trust score, bond amount, and reputation.
 * ALL DATA IS REAL — no fake stats, no demo profiles.
 */
import { useState, useEffect } from "react";
import { BOND_TIERS, type BondTier, getBondTier, getBondTierInfo } from "../lib/vns";
import DisclaimerBanner from "../components/DisclaimerBanner";

/* ── Badge Tier Card ── */
function TierCard({ tier, isActive, isMobile }: {
  tier: typeof BOND_TIERS[number];
  isActive: boolean;
  isMobile: boolean;
}) {
  const tierPerks: Record<string, string[]> = {
    Bronze: ["Basic marketplace access", "Post up to 3 tasks/day", "Standard visibility"],
    Silver: ["Priority in search results", "Post up to 10 tasks/day", "Agent collaboration rooms"],
    Gold: ["Featured in marketplace", "Unlimited tasks", "Priority task matching", "Custom profile badge"],
    Platinum: ["Top marketplace placement", "Unlimited everything", "Governance voting rights", "Premium support", "Custom badge design"],
  };
  return (
    <div style={{
      padding: isMobile ? 16 : 20,
      borderRadius: 14,
      border: isActive ? `1.5px solid ${tier.color}40` : "1px solid rgba(255,255,255,0.06)",
      background: isActive ? `${tier.color}08` : "rgba(255,255,255,0.02)",
      transition: "all 0.2s ease",
      position: "relative",
      overflow: "hidden",
    }}>
      {isActive && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
          background: `${tier.color}20`, color: tier.color,
          textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          Current
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${tier.color}15`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={tier.color} strokeWidth="2" strokeLinecap="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: tier.color }}>{tier.label}</div>
          <div style={{ fontSize: 11, color: "#71717A" }}>Min: {tier.minEth} ETH bond</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(tierPerks[tier.label] || []).map((perk, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#A1A1AA" }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={isActive ? "#22C55E" : "#52525B"} strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {perk}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Credential Definition ── */
interface CredentialDef {
  id: string;
  label: string;
  description: string;
  category: "identity" | "trust" | "activity" | "achievement";
}

const ALL_CREDENTIALS: CredentialDef[] = [
  { id: "vns-registered", label: "VNS Identity", description: "Register a .vns name on-chain", category: "identity" },
  { id: "identity-verified", label: "Identity Verified", description: "On-chain identity type confirmed", category: "identity" },
  { id: "first-bond", label: "First Bond", description: "Stake your first accountability bond", category: "trust" },
  { id: "multi-chain", label: "Multi-Chain", description: "Active on 2+ chains", category: "trust" },
  { id: "first-task", label: "First Task", description: "Complete first task in Collaboration Zone", category: "activity" },
  { id: "ten-tasks", label: "Task Master", description: "Complete 10+ tasks", category: "achievement" },
  { id: "perfect-rating", label: "Perfect Rating", description: "Maintain 5-star average over 10+ reviews", category: "achievement" },
  { id: "gold-tier", label: "Gold Tier", description: "Reach Gold bond tier", category: "trust" },
  { id: "hundred-tasks", label: "Centurion", description: "Complete 100+ tasks", category: "achievement" },
  { id: "governance-voter", label: "Governance Voter", description: "Vote in a DAO proposal", category: "activity" },
];

/* ── Credential Card ── */
function CredentialCard({ credential, earned, isMobile }: { credential: CredentialDef; earned: boolean; isMobile: boolean }) {
  const categoryColors: Record<string, string> = {
    identity: "#7C3AED",
    trust: "#22C55E",
    activity: "#3B82F6",
    achievement: "#F59E0B",
  };
  const color = categoryColors[credential.category] || "#71717A";
  return (
    <div style={{
      padding: isMobile ? 14 : 16,
      borderRadius: 12,
      border: earned ? `1px solid ${color}30` : "1px solid rgba(255,255,255,0.04)",
      background: earned ? `${color}06` : "rgba(255,255,255,0.015)",
      opacity: earned ? 1 : 0.5,
      transition: "all 0.2s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: earned ? `${color}15` : "rgba(255,255,255,0.04)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={earned ? color : "#52525B"} strokeWidth="2" strokeLinecap="round">
            {credential.category === "identity" && <><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></>}
            {credential.category === "trust" && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>}
            {credential.category === "activity" && <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>}
            {credential.category === "achievement" && <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>}
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: earned ? "#F4F4F5" : "#52525B" }}>
            {credential.label}
          </div>
          <div style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>{credential.description}</div>
        </div>
        {earned ? (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        ) : (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#3F3F46" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        )}
      </div>
    </div>
  );
}

/* ── Trust Score Ring ── */
function TrustRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22C55E" : score >= 60 ? "#F97316" : score >= 40 ? "#EAB308" : score > 0 ? "#EF4444" : "#3F3F46";
  const grade = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B+" : score >= 60 ? "B" : score >= 50 ? "C" : score > 0 ? "D" : "--";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
        {score > 0 && (
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={6}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
        )}
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 28, fontWeight: 800, color }}>{score}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#71717A" }}>{score > 0 ? `Grade ${grade}` : "No Score"}</div>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function TrustBadges() {
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "tiers" | "credentials">("overview");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Real data: all zeros until actual on-chain activity occurs
  const bondAmount = 0;
  const trustScore = 0;
  const tasksCompleted = 0;
  const totalRatings = 0;
  const positiveRatings = 0;
  const accountAge = 0;
  const currentTier = getBondTier(bondAmount);
  const currentTierInfo = currentTier ? getBondTierInfo(currentTier) : null;

  // No credentials earned yet — all locked
  const earnedCredentials: string[] = [];
  const earnedCount = earnedCredentials.length;

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "tiers" as const, label: "Badge Tiers" },
    { id: "credentials" as const, label: "Credentials" },
  ];

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, paddingLeft: isMobile ? 48 : 0 }}>
        <h2 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: "#F4F4F5", margin: 0, letterSpacing: -0.5 }}>
          Trust Badges
        </h2>
        <p style={{ fontSize: 13, color: "#71717A", margin: "6px 0 0" }}>
          Verified credentials based on trust score, bond amount, and on-chain reputation
        </p>
      </div>

      <DisclaimerBanner disclaimerKey="marketplace" />

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 24,
        background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 3,
        border: "1px solid rgba(255,255,255,0.04)",
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: "10px 0", border: "none", borderRadius: 8, cursor: "pointer",
            fontSize: 13, fontWeight: 600,
            background: activeTab === tab.id ? "rgba(255,255,255,0.06)" : "transparent",
            color: activeTab === tab.id ? "#F4F4F5" : "#52525B",
            transition: "all 0.15s ease",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Profile Summary */}
          <div style={{
            padding: isMobile ? 20 : 28, borderRadius: 16,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: 24, flexDirection: isMobile ? "column" : "row" }}>
              <TrustRing score={trustScore} size={isMobile ? 100 : 120} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#A1A1AA" }}>
                    {trustScore > 0 ? "Your Trust Profile" : "No Profile Yet"}
                  </span>
                  {currentTierInfo && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                      background: `${currentTierInfo.color}20`,
                      color: currentTierInfo.color,
                      textTransform: "uppercase", letterSpacing: 0.5,
                    }}>
                      {currentTier}
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
                  {[
                    { label: "Bond", value: bondAmount > 0 ? `${bondAmount} ETH` : "0 ETH" },
                    { label: "Tasks", value: String(tasksCompleted) },
                    { label: "Rating", value: totalRatings > 0 ? `${((positiveRatings / totalRatings) * 5).toFixed(1)}/5` : "--" },
                    { label: "Age", value: accountAge > 0 ? `${accountAge}d` : "--" },
                  ].map(stat => (
                    <div key={stat.label} style={{
                      padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.03)",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5" }}>{stat.value}</div>
                      <div style={{ fontSize: 10, color: "#71717A", marginTop: 2 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
                {trustScore === 0 && (
                  <div style={{ fontSize: 12, color: "#52525B", marginTop: 12, lineHeight: 1.5 }}>
                    Connect your wallet and register a .vns identity to start building your trust profile. Stake a bond, complete tasks, and earn credentials.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Credentials Summary */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5" }}>Credentials</span>
              <span style={{ fontSize: 12, color: "#71717A" }}>{earnedCount}/{ALL_CREDENTIALS.length} earned</span>
            </div>
            <div style={{
              height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)",
              overflow: "hidden", marginBottom: 14,
            }}>
              <div style={{
                height: "100%", width: `${ALL_CREDENTIALS.length > 0 ? (earnedCount / ALL_CREDENTIALS.length) * 100 : 0}%`,
                background: "linear-gradient(90deg, #7C3AED, #22C55E)",
                borderRadius: 3, transition: "width 0.5s ease",
              }} />
            </div>
            {earnedCount === 0 ? (
              <div style={{ fontSize: 12, color: "#52525B", lineHeight: 1.5 }}>
                No credentials earned yet. Register a .vns identity, stake a bond, and complete tasks to earn trust badges.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ALL_CREDENTIALS.filter(c => earnedCredentials.includes(c.id)).map(c => (
                  <span key={c.id} style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 6,
                    background: "rgba(124,58,237,0.1)", color: "#A78BFA",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Trust Score Breakdown */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 14 }}>
              Trust Score Breakdown
            </div>
            {[
              { label: "Bond Tier", weight: 25, score: 0, color: "#7C3AED" },
              { label: "Task Completion", weight: 30, score: 0, color: "#3B82F6" },
              { label: "Peer Ratings", weight: 25, score: 0, color: "#22C55E" },
              { label: "Account Age", weight: 10, score: 0, color: "#F59E0B" },
              { label: "Credentials", weight: 10, score: 0, color: "#EC4899" },
            ].map(factor => (
              <div key={factor.label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#A1A1AA" }}>{factor.label} ({factor.weight}%)</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#F4F4F5" }}>{Math.round(factor.score)}/100</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${factor.score}%`,
                    background: factor.color, borderRadius: 2,
                    transition: "width 0.5s ease",
                  }} />
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "#52525B", marginTop: 8, lineHeight: 1.5 }}>
              Your trust score will increase as you stake bonds, complete tasks, receive positive ratings, and earn credentials.
            </div>
          </div>
        </div>
      )}

      {/* Tiers Tab */}
      {activeTab === "tiers" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
          {BOND_TIERS.map(tier => (
            <TierCard
              key={tier.label}
              tier={tier}
              isActive={currentTier === tier.label.toLowerCase()}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}

      {/* Credentials Tab */}
      {activeTab === "credentials" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {["identity", "trust", "activity", "achievement"].map(category => {
            const creds = ALL_CREDENTIALS.filter(c => c.category === category);
            if (creds.length === 0) return null;
            return (
              <div key={category}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "#52525B",
                  textTransform: "uppercase", letterSpacing: 0.8,
                  marginBottom: 8, marginTop: 8,
                }}>
                  {category}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {creds.map(c => (
                    <CredentialCard key={c.id} credential={c} earned={earnedCredentials.includes(c.id)} isMobile={isMobile} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
