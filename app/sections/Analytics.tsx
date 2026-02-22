"use client";
import { useEffect, useState } from "react";
import { getAnalyticsData, type AnalyticsData } from "../lib/analytics";
import { isRegistered } from "../lib/registration";

function RefreshIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const reg = isRegistered();
    setRegistered(reg);
    if (reg) {
      setData(getAnalyticsData());
    }
  }, []);

  const refresh = () => {
    if (isRegistered()) {
      setData(getAnalyticsData());
    }
  };

  const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  if (!registered) {
    return (
      <div style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#F4F4F5", letterSpacing: "-0.03em", marginBottom: 8 }}>Analytics</h1>
        <p style={{ fontSize: 14, color: "#52525B", marginBottom: 40 }}>Your Embris intelligence data</p>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "60px 24px", textAlign: "center",
        }}>
          <div style={{ color: "#3F3F46", marginBottom: 16 }}><LockIcon size={32} /></div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#F4F4F5", marginBottom: 8 }}>Register to Unlock Analytics</h2>
          <p style={{ fontSize: 14, color: "#52525B", maxWidth: 360, lineHeight: 1.6 }}>
            Analytics tracks your Embris growth — conversations, memories, patterns, insights, goals, and emotional trends.
            Register on-chain to start building your profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: 680, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "space-between", marginBottom: isMobile ? 40 : 48,
        flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 0,
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#F4F4F5", letterSpacing: "-0.03em" }}>Analytics</h1>
          <p style={{ fontSize: 12, color: "#3F3F46", marginTop: 4 }}>Your Embris intelligence data</p>
        </div>
        <button onClick={refresh}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", background: "#F97316",
            border: "none", borderRadius: 8,
            color: "#09090B", fontSize: 12, fontWeight: 600, cursor: "pointer",
            alignSelf: isMobile ? "stretch" : "auto", justifyContent: "center",
          }}>
          <RefreshIcon size={12} />
          Refresh
        </button>
      </div>

      {data && (
        <>
          {/* Primary Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            gap: isMobile ? "24px 16px" : "24px 32px",
            marginBottom: 16,
          }}>
            {[
              { label: "Conversations", value: String(data.totalConversations), color: "#F4F4F5" },
              { label: "Memories", value: String(data.totalMemories), color: "#F4F4F5" },
              { label: "Reflections", value: String(data.reflectionsCount), color: "#F4F4F5" },
              { label: "Patterns", value: String(data.patternsCount), color: "#F4F4F5" },
            ].map((stat) => (
              <div key={stat.label}>
                <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>{stat.label}</p>
                <p style={{ fontSize: 20, fontWeight: 600, color: stat.color, ...monoStyle, letterSpacing: "-0.02em" }}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            gap: isMobile ? "24px 16px" : "24px 32px",
            marginBottom: 48,
          }}>
            {[
              { label: "Insights", value: String(data.insightsCount), color: "#F4F4F5" },
              { label: "Goals Active", value: String(data.goalsActive), color: data.goalsActive > 0 ? "#F59E0B" : "#F4F4F5" },
              { label: "Goals Done", value: String(data.goalsCompleted), color: data.goalsCompleted > 0 ? "#22C55E" : "#F4F4F5" },
              { label: "Growth Rate", value: `${data.growthRate}/conv`, color: "#F97316" },
            ].map((stat) => (
              <div key={stat.label}>
                <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>{stat.label}</p>
                <p style={{ fontSize: 20, fontWeight: 600, color: stat.color, ...monoStyle, letterSpacing: "-0.02em" }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Memory Categories */}
          {Object.keys(data.memoryCategories).length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 11, fontWeight: 500, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Memory Categories</h2>
              {Object.entries(data.memoryCategories)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => {
                  const total = data.totalMemories || 1;
                  const percent = Math.round((count / total) * 100);
                  return (
                    <div key={category} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: "#A1A1AA", textTransform: "capitalize" }}>
                          {category.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: 12, color: "#71717A", ...monoStyle }}>{count} ({percent}%)</span>
                      </div>
                      <div style={{
                        width: "100%", height: 3, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 2,
                      }}>
                        <div style={{
                          width: `${percent}%`, height: "100%",
                          backgroundColor: "#F97316", borderRadius: 2,
                          transition: "width 0.5s ease", opacity: 0.7,
                        }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Top Moods */}
          {data.topMoods.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 11, fontWeight: 500, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Emotional Patterns</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {data.topMoods.map(({ mood, count }) => {
                  const moodColors: Record<string, string> = {
                    excited: '#F59E0B', happy: '#22C55E', neutral: '#71717A',
                    confused: '#A78BFA', frustrated: '#EF4444', stressed: '#F97316',
                    sad: '#6366F1', curious: '#06B6D4', determined: '#F97316',
                  };
                  return (
                    <div key={mood} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 12px",
                      backgroundColor: "rgba(255,255,255,0.02)",
                      borderRadius: 8,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        backgroundColor: moodColors[mood] || '#71717A',
                      }} />
                      <span style={{ fontSize: 12, color: "#A1A1AA", textTransform: "capitalize" }}>{mood}</span>
                      <span style={{ fontSize: 11, color: "#52525B", ...monoStyle }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pattern Categories */}
          {Object.keys(data.patternCategories).length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 11, fontWeight: 500, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Pattern Categories</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(data.patternCategories)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => (
                    <div key={category} style={{
                      padding: "6px 12px",
                      backgroundColor: "rgba(255,255,255,0.02)",
                      borderRadius: 8,
                      fontSize: 12, color: "#A1A1AA",
                      textTransform: "capitalize",
                    }}>
                      {category} <span style={{ color: "#52525B", ...monoStyle }}>({count})</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {data.totalConversations === 0 && (
            <div style={{
              textAlign: "center", padding: "40px 24px",
              color: "#3F3F46",
            }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>No data yet</p>
              <p style={{ fontSize: 12, color: "#27272A" }}>Start chatting with Embris to see your analytics grow.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
