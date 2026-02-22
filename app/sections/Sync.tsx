"use client";
import { useEffect, useState } from "react";
import { clearAllMemories } from "../lib/memory";
import { clearSelfLearningData } from "../lib/self-learning";
import {
  exportAllData,
  importAllData,
  getEnhancedDataStats,
  clearEmotionalData,
  clearSessionData,
  clearGoalData,
  clearPersonalityData,
  type EnhancedSyncData,
} from "../lib/enhanced-export";
import { getSessionSummaries, type SessionSummary } from "../lib/conversation-summaries";
import { getGoals, type Goal } from "../lib/goal-tracking";
import { getPersonalitySummary } from "../lib/personality-tuning";

interface EnhancedStats {
  chatMessages: number;
  memories: number;
  reflections: number;
  patterns: number;
  insights: number;
  emotionalEntries: number;
  sessionSummaries: number;
  goals: number;
  hasPersonality: boolean;
  isRegistered: boolean;
  totalDataSize: string;
  walletConnected: boolean;
  lastSync: string | null;
}

function DownloadIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>);
}
function UploadIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>);
}
function TrashIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>);
}
function CheckIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>);
}
function ChevronIcon({ size = 14, open }: { size?: number; open: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function Sync() {
  const [stats, setStats] = useState<EnhancedStats>({
    chatMessages: 0, memories: 0, reflections: 0, patterns: 0, insights: 0,
    emotionalEntries: 0, sessionSummaries: 0, goals: 0, hasPersonality: false,
    isRegistered: false,
    totalDataSize: "0 KB", walletConnected: false, lastSync: null,
  });
  const [exportSuccess, setExportSuccess] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const [importDetails, setImportDetails] = useState<string[]>([]);
  const [clearing, setClearing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showPersonality, setShowPersonality] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [personalitySummary, setPersonalitySummary] = useState("");

  const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadStats(); }, []);

  const loadStats = () => {
    if (typeof window === "undefined") return;
    const enhanced = getEnhancedDataStats();
    const walletAddr = localStorage.getItem("vaultfire_wallet_address");
    const lastSync = localStorage.getItem("vaultfire_last_sync");

    setStats({
      ...enhanced,
      isRegistered: enhanced.isRegistered ?? false,
      walletConnected: !!walletAddr,
      lastSync,
    });

    setSessions(getSessionSummaries());
    setGoals(getGoals());
    setPersonalitySummary(getPersonalitySummary());
  };

  const handleExport = () => {
    const data = exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `embris-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem("vaultfire_last_sync", new Date().toISOString());
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
    loadStats();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError("");
    setImportSuccess(false);
    setImportDetails([]);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as EnhancedSyncData;
        const result = importAllData(data);
        setImportSuccess(true);
        setImportDetails(result.imported);
        setTimeout(() => { setImportSuccess(false); setImportDetails([]); }, 5000);
        loadStats();
      } catch {
        setImportError("Invalid backup file. Please use a valid Embris export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClearAll = () => {
    if (!confirm("Clear ALL local data? This will delete your chat history, memories, wallet, self-learning, goals, personality, session summaries, and emotional data. This cannot be undone.")) return;
    setClearing(true);
    clearAllMemories();
    clearSelfLearningData();
    clearEmotionalData();
    clearSessionData();
    clearGoalData();
    clearPersonalityData();
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("vaultfire_") || key.startsWith("embris_"))) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    setTimeout(() => { setClearing(false); loadStats(); }, 500);
  };

  return (
    <div className="page-enter" style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 40 : 48 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#F4F4F5", letterSpacing: "-0.03em" }}>Data</h1>
        <p style={{ fontSize: 14, color: "#52525B", marginTop: 6 }}>Export, import, and manage your complete Embris profile</p>
      </div>

      {/* Stats — enhanced grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap: isMobile ? "24px 16px" : "24px 32px",
        marginBottom: 16,
      }}>
        {[
          { label: "Messages", value: String(stats.chatMessages) },
          { label: "Memories", value: String(stats.memories) },
          { label: "Reflections", value: String(stats.reflections) },
          { label: "Patterns", value: String(stats.patterns) },
        ].map((stat) => (
          <div key={stat.label}>
            <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>{stat.label}</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: "#F4F4F5", ...monoStyle, letterSpacing: "-0.02em" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap: isMobile ? "24px 16px" : "24px 32px",
        marginBottom: 40,
      }}>
        {[
          { label: "Insights", value: String(stats.insights) },
          { label: "Goals", value: String(stats.goals), color: stats.goals > 0 ? "#F59E0B" : undefined },
          { label: "Sessions", value: String(stats.sessionSummaries) },
          { label: "Size", value: stats.totalDataSize },
        ].map((stat) => (
          <div key={stat.label}>
            <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>{stat.label}</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: (stat as { color?: string }).color || "#F4F4F5", ...monoStyle, letterSpacing: "-0.02em" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {stats.lastSync && (
        <p style={{ fontSize: 12, color: "#3F3F46", marginBottom: 24 }}>
          Last export: {new Date(stats.lastSync).toLocaleString()}
        </p>
      )}

      {/* ── Expandable Sections ── */}

      {/* Previous Sessions */}
      {sessions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowSessions(!showSessions)} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", padding: "14px 0",
            backgroundColor: "transparent", border: "none", cursor: "pointer",
            borderBottom: "1px solid rgba(255,255,255,0.03)",
          }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#F4F4F5" }}>
              Previous Sessions ({sessions.length})
            </span>
            <ChevronIcon size={14} open={showSessions} />
          </button>
          {showSessions && (
            <div style={{ padding: "12px 0" }}>
              {sessions.slice().reverse().slice(0, 10).map((s) => (
                <div key={s.id} style={{
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.02)",
                }}>
                  <p style={{ fontSize: 11, color: "#52525B", marginBottom: 4, ...monoStyle }}>
                    {new Date(s.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}{s.messageCount} messages · {s.duration}min
                  </p>
                  <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.5 }}>{s.summary}</p>
                  {s.topics.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {s.topics.map((t, i) => (
                        <span key={i} style={{
                          fontSize: 10, color: "#71717A", backgroundColor: "rgba(255,255,255,0.03)",
                          padding: "2px 8px", borderRadius: 4,
                        }}>{t}</span>
                      ))}
                    </div>
                  )}
                  {s.decisions.length > 0 && (
                    <p style={{ fontSize: 12, color: "#F97316", marginTop: 4, opacity: 0.7 }}>
                      Decisions: {s.decisions.join('; ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowGoals(!showGoals)} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", padding: "14px 0",
            backgroundColor: "transparent", border: "none", cursor: "pointer",
            borderBottom: "1px solid rgba(255,255,255,0.03)",
          }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#F4F4F5" }}>
              Goals ({goals.length})
            </span>
            <ChevronIcon size={14} open={showGoals} />
          </button>
          {showGoals && (
            <div style={{ padding: "12px 0" }}>
              {goals.map((g) => (
                <div key={g.id} style={{
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.02)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 500, textTransform: "uppercase",
                      color: g.status === 'active' ? '#22C55E' : g.status === 'completed' ? '#F97316' : '#71717A',
                      ...monoStyle,
                    }}>{g.status}</span>
                    <span style={{ fontSize: 13, color: "#F4F4F5", fontWeight: 500 }}>{g.title}</span>
                  </div>
                  {g.description && (
                    <p style={{ fontSize: 12, color: "#71717A", marginBottom: 4 }}>{g.description}</p>
                  )}
                  {/* Progress bar */}
                  <div style={{
                    width: "100%", height: 3, backgroundColor: "rgba(255,255,255,0.04)",
                    borderRadius: 2, marginTop: 6,
                  }}>
                    <div style={{
                      width: `${g.progress}%`, height: "100%",
                      backgroundColor: g.status === 'completed' ? '#F97316' : '#22C55E',
                      borderRadius: 2, transition: "width 0.3s ease",
                    }} />
                  </div>
                  <p style={{ fontSize: 10, color: "#3F3F46", marginTop: 4, ...monoStyle }}>
                    {g.progress}% · Created {new Date(g.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Personality */}
      {stats.hasPersonality && (
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => setShowPersonality(!showPersonality)} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", padding: "14px 0",
            backgroundColor: "transparent", border: "none", cursor: "pointer",
            borderBottom: "1px solid rgba(255,255,255,0.03)",
          }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#F4F4F5" }}>
              Personality Settings
            </span>
            <ChevronIcon size={14} open={showPersonality} />
          </button>
          {showPersonality && (
            <div style={{ padding: "12px 0" }}>
              {personalitySummary.split('\n').map((line, i) => (
                <p key={i} style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6 }}>{line}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions — clean list */}
      <div style={{ marginBottom: 32 }}>
        {/* Export */}
        <button onClick={handleExport} style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 0", width: "100%",
          backgroundColor: "transparent", border: "none",
          cursor: "pointer", textAlign: "left",
          borderBottom: "1px solid rgba(255,255,255,0.03)",
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: 7,
            backgroundColor: "rgba(249,115,22,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#F97316", flexShrink: 0,
          }}>
            {exportSuccess ? <CheckIcon size={13} /> : <DownloadIcon size={13} />}
          </span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#F4F4F5" }}>
              {exportSuccess ? "Exported!" : "Export Full Profile"}
            </p>
            <p style={{ fontSize: 12, color: "#3F3F46" }}>
              Download complete backup — memories, goals, personality, sessions, and more
            </p>
          </div>
        </button>

        {/* Import */}
        <label style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 0", cursor: "pointer",
          backgroundColor: "transparent",
          borderBottom: "1px solid rgba(255,255,255,0.03)",
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: 7,
            backgroundColor: "rgba(255,255,255,0.02)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#52525B", flexShrink: 0,
          }}>
            {importSuccess ? <CheckIcon size={13} /> : <UploadIcon size={13} />}
          </span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#F4F4F5" }}>
              {importSuccess ? "Imported!" : "Import Profile"}
            </p>
            <p style={{ fontSize: 12, color: "#3F3F46" }}>Restore your complete Embris profile from backup</p>
          </div>
          <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
        </label>

        {/* Import details */}
        {importDetails.length > 0 && (
          <div style={{ padding: "8px 0 8px 42px" }}>
            {importDetails.map((d, i) => (
              <p key={i} style={{ fontSize: 11, color: "#22C55E", lineHeight: 1.6 }}>✓ {d}</p>
            ))}
          </div>
        )}

        {/* Clear */}
        <button onClick={handleClearAll} disabled={clearing} style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 0", width: "100%",
          backgroundColor: "transparent", border: "none",
          cursor: clearing ? "default" : "pointer", textAlign: "left",
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: 7,
            backgroundColor: "rgba(239,68,68,0.04)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#EF4444", flexShrink: 0,
          }}>
            <TrashIcon size={13} />
          </span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#EF4444" }}>
              {clearing ? "Clearing..." : "Clear All Data"}
            </p>
            <p style={{ fontSize: 12, color: "#3F3F46" }}>Delete all local data permanently</p>
          </div>
        </button>
      </div>

      {importError && (
        <p style={{ fontSize: 12, color: "#EF4444", marginBottom: 16 }}>{importError}</p>
      )}

      <p style={{ fontSize: 11, color: "#27272A", lineHeight: 1.8 }}>
        All data is stored locally in your browser. Exporting creates a complete backup including memories,
        self-learning data, goals, personality settings, session summaries, and emotional patterns.
        Import on any device to restore your full Embris profile.
      </p>
    </div>
  );
}
