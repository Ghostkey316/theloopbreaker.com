"use client";
/**
 * TrustBadges — Verified badge tiers based on trust score, bond amount, and reputation.
 * Displayed next to .vns names everywhere. This section lets users view their credentials,
 * see tier requirements, and understand the trust system.
 */
import { useState, useEffect } from "react";
import { BOND_TIERS, type BondTier, type IdentityType, getBondTier, getBondTierInfo } from "../lib/vns";
import { VNSTypeBadge } from "../components/VNSBadge";
import DisclaimerBanner from "../components/DisclaimerBanner";

/* ── Types ── */
interface Credential {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  earnedAt?: number;
  icon: string;
  category: "identity" | "trust" | "activity" | "achievement";
}

interface TrustProfile {
  vnsName: string;
  identityType: IdentityType;
  bondTier: BondTier;
  bondAmount: number;
  trustScore: number;
  tasksCompleted: number;
  positiveRatings: number;
  totalRatings: number;
  accountAge: number; // days
  credentials: Credential[];
}

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

/* ── Credential Card ── */
function CredentialCard({ credential, isMobile }: { credential: Credential; isMobile: boolean }) {
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
      border: credential.earned ? `1px solid ${color}30` : "1px solid rgba(255,255,255,0.04)",
      background: credential.earned ? `${color}06` : "rgba(255,255,255,0.015)",
      opacity: credential.earned ? 1 : 0.5,
      transition: "all 0.2s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>{credential.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: credential.earned ? "#F4F4F5" : "#52525B" }}>
            {credential.label}
          </div>
          <div style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>{credential.description}</div>
        </div>
        {credential.earned && (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
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
  const color = score >= 80 ? "#22C55E" : score >= 60 ? "#F97316" : score >= 40 ? "#EAB308" : "#EF4444";
  const grade = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B+" : score >= 60 ? "B" : score >= 50 ? "C" : "D";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 28, fontWeight: 800, color }}>{score}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#71717A" }}>Grade {grade}</div>
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

  // Demo profile — in production, loaded from on-chain + localStorage
  const profile: TrustProfile = {
    vnsName: "ghostkey316",
    identityType: "human",
    bondTier: "silver",
    bondAmount: 0.05,
    trustScore: 78,
    tasksCompleted: 12,
    positiveRatings: 11,
    totalRatings: 12,
    accountAge: 45,
    credentials: [
      { id: "vns-registered", label: "VNS Identity", description: "Registered a .vns name on-chain", earned: true, earnedAt: Date.now() - 45 * 86400000, icon: "🌐", category: "identity" },
      { id: "identity-verified", label: "Identity Verified", description: "On-chain identity type confirmed", earned: true, earnedAt: Date.now() - 45 * 86400000, icon: "✓", category: "identity" },
      { id: "first-bond", label: "First Bond", description: "Staked first accountability bond", earned: true, earnedAt: Date.now() - 30 * 86400000, icon: "🔒", category: "trust" },
      { id: "multi-chain", label: "Multi-Chain", description: "Active on 2+ chains", earned: true, earnedAt: Date.now() - 20 * 86400000, icon: "⛓", category: "trust" },
      { id: "first-task", label: "First Task", description: "Completed first task in Collaboration Zone", earned: true, earnedAt: Date.now() - 15 * 86400000, icon: "📋", category: "activity" },
      { id: "ten-tasks", label: "Task Master", description: "Completed 10+ tasks", earned: true, earnedAt: Date.now() - 5 * 86400000, icon: "🏆", category: "achievement" },
      { id: "perfect-rating", label: "Perfect Rating", description: "Maintained 5-star average over 10+ reviews", earned: false, icon: "⭐", category: "achievement" },
      { id: "gold-tier", label: "Gold Tier", description: "Reached Gold bond tier", earned: false, icon: "🥇", category: "trust" },
      { id: "hundred-tasks", label: "Centurion", description: "Completed 100+ tasks", earned: false, icon: "💯", category: "achievement" },
      { id: "governance-voter", label: "Governance Voter", description: "Voted in a DAO proposal", earned: false, icon: "🗳", category: "activity" },
    ],
  };

  const earnedCount = profile.credentials.filter(c => c.earned).length;
  const currentTierInfo = getBondTierInfo(profile.bondTier);

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "tiers" as const, label: "Badge Tiers" },
    { id: "credentials" as const, label: "Credentials" },
  ];

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
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
              <TrustRing score={profile.trustScore} size={isMobile ? 100 : 120} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#F4F4F5" }}>{profile.vnsName}.vns</span>
                  <VNSTypeBadge identityType={profile.identityType} size="sm" />
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                    background: `${currentTierInfo?.color || "#CD7F32"}20`,
                    color: currentTierInfo?.color || "#CD7F32",
                    textTransform: "uppercase", letterSpacing: 0.5,
                  }}>
                    {profile.bondTier}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
                  {[
                    { label: "Bond", value: `${profile.bondAmount} ETH` },
                    { label: "Tasks", value: String(profile.tasksCompleted) },
                    { label: "Rating", value: `${profile.totalRatings > 0 ? ((profile.positiveRatings / profile.totalRatings) * 5).toFixed(1) : "—"}/5` },
                    { label: "Age", value: `${profile.accountAge}d` },
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
              <span style={{ fontSize: 12, color: "#71717A" }}>{earnedCount}/{profile.credentials.length} earned</span>
            </div>
            <div style={{
              height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)",
              overflow: "hidden", marginBottom: 14,
            }}>
              <div style={{
                height: "100%", width: `${(earnedCount / profile.credentials.length) * 100}%`,
                background: "linear-gradient(90deg, #7C3AED, #22C55E)",
                borderRadius: 3, transition: "width 0.5s ease",
              }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {profile.credentials.filter(c => c.earned).map(c => (
                <span key={c.id} style={{
                  fontSize: 11, padding: "3px 8px", borderRadius: 6,
                  background: "rgba(124,58,237,0.1)", color: "#A78BFA",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  {c.icon} {c.label}
                </span>
              ))}
            </div>
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
              { label: "Bond Tier", weight: 25, score: profile.bondTier === "platinum" ? 100 : profile.bondTier === "gold" ? 75 : profile.bondTier === "silver" ? 50 : 25, color: "#7C3AED" },
              { label: "Task Completion", weight: 30, score: Math.min(100, profile.tasksCompleted * 10), color: "#3B82F6" },
              { label: "Peer Ratings", weight: 25, score: profile.totalRatings > 0 ? (profile.positiveRatings / profile.totalRatings) * 100 : 0, color: "#22C55E" },
              { label: "Account Age", weight: 10, score: Math.min(100, profile.accountAge * 2), color: "#F59E0B" },
              { label: "Credentials", weight: 10, score: (earnedCount / profile.credentials.length) * 100, color: "#EC4899" },
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
              isActive={tier.label.toLowerCase() === profile.bondTier}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}

      {/* Credentials Tab */}
      {activeTab === "credentials" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {["identity", "trust", "activity", "achievement"].map(category => {
            const creds = profile.credentials.filter(c => c.category === category);
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
                    <CredentialCard key={c.id} credential={c} isMobile={isMobile} />
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
