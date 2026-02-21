"use client";
import { useEffect, useState } from "react";
import { exportData, importData, clearAllMemories, type SyncData } from "../lib/memory";

interface SyncStats {
  chatMessages: number;
  memories: number;
  walletConnected: boolean;
  lastSync: string | null;
  dataSize: string;
}

/* ── SVG Icons ── */
function SyncIcon({ size = 18 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" /></svg>);
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
function CheckCircleIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>);
}

export default function Sync() {
  const [stats, setStats] = useState<SyncStats>({
    chatMessages: 0, memories: 0, walletConnected: false, lastSync: null, dataSize: "0 KB",
  });
  const [exportSuccess, setExportSuccess] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadStats(); }, []);

  const loadStats = () => {
    if (typeof window === "undefined") return;
    const chatHistory = localStorage.getItem("vaultfire_chat_history");
    const memories = localStorage.getItem("vaultfire_memories");
    const walletAddr = localStorage.getItem("vaultfire_wallet_address");
    const lastSync = localStorage.getItem("vaultfire_last_sync");

    const chatMessages = chatHistory ? JSON.parse(chatHistory).length : 0;
    const memoryCount = memories ? JSON.parse(memories).length : 0;

    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("vaultfire_")) {
        totalBytes += (localStorage.getItem(key) || "").length * 2;
      }
    }
    const dataSize = totalBytes < 1024 ? `${totalBytes} B` : totalBytes < 1024 * 1024 ? `${(totalBytes / 1024).toFixed(1)} KB` : `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;

    setStats({ chatMessages, memories: memoryCount, walletConnected: !!walletAddr, lastSync, dataSize });
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vaultfire-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as SyncData;
        importData(data);
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
        loadStats();
      } catch {
        setImportError("Invalid backup file. Please use a valid Vaultfire export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClearAll = () => {
    if (!confirm("Clear ALL local data? This will delete your chat history, memories, and wallet. This cannot be undone.")) return;
    setClearing(true);
    clearAllMemories();
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("vaultfire_")) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    setTimeout(() => { setClearing(false); loadStats(); }, 500);
  };

  const statItems = [
    { label: "Chat Messages", value: String(stats.chatMessages), color: "#F97316" },
    { label: "Memories", value: String(stats.memories), color: "#A855F7" },
    { label: "Wallet", value: stats.walletConnected ? "Connected" : "None", color: stats.walletConnected ? "#22C55E" : "#52525B" },
    { label: "Data Size", value: stats.dataSize, color: "#A1A1AA" },
  ];

  return (
    <div style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: 640, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 24 : 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: isMobile ? 40 : 44, height: isMobile ? 40 : 44, borderRadius: 14,
            background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))",
            border: "1px solid rgba(249,115,22,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(249,115,22,0.06)", color: "#F97316",
          }}>
            <SyncIcon size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: "#FAFAFA", letterSpacing: "-0.03em" }}>Data Sync</h1>
            <p style={{ fontSize: 14, color: "#A1A1AA", letterSpacing: "-0.01em" }}>Export and import your Vaultfire data</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap: 8, marginBottom: 16,
      }}>
        {statItems.map((stat) => (
          <div key={stat.label} style={{
            background: "#0F0F12",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 10, padding: isMobile ? "10px" : "12px 14px",
          }}>
            <p style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontWeight: 500 }}>{stat.label}</p>
            <p style={{
              fontSize: isMobile ? 16 : 18, fontWeight: 700, color: stat.color,
              fontFamily: "'JetBrains Mono', monospace",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              letterSpacing: "-0.02em",
            }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {stats.lastSync && (
        <div style={{
          marginBottom: 12, padding: "10px 14px",
          backgroundColor: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.1)",
          borderRadius: 10, display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircleIcon size={13} />
          <p style={{ fontSize: 12, color: "#22C55E", fontWeight: 500 }}>Last export: {new Date(stats.lastSync).toLocaleString()}</p>
        </div>
      )}

      {/* Export Card */}
      <div style={{
        background: "#0F0F12",
        border: "1px solid rgba(255,255,255,0.04)",
        borderRadius: 14, padding: isMobile ? "18px" : "20px 22px",
        marginBottom: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "rgba(249,115,22,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#F97316",
          }}>
            <DownloadIcon size={15} />
          </div>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#FAFAFA", letterSpacing: "-0.015em" }}>Export Data</h2>
            <p style={{ fontSize: 12, color: "#52525B" }}>Download a JSON backup</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#A1A1AA", marginBottom: 14, lineHeight: 1.6, letterSpacing: "-0.01em" }}>
          Download a JSON backup of all your chat history, memories, and wallet address.
        </p>
        <button onClick={handleExport}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "10px 20px",
            background: exportSuccess ? "#22C55E" : "linear-gradient(135deg, #F97316, #EA580C)",
            border: "none", borderRadius: 10, color: "#09090B",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            width: isMobile ? "100%" : "auto",
            transition: "all 0.2s ease", letterSpacing: "-0.01em",
            boxShadow: "0 4px 16px rgba(249,115,22,0.2)",
          }}>
          {exportSuccess ? <><CheckCircleIcon size={13} /> Exported!</> : <><DownloadIcon size={13} /> Export Backup</>}
        </button>
      </div>

      {/* Import Card */}
      <div style={{
        background: "#0F0F12",
        border: "1px solid rgba(255,255,255,0.04)",
        borderRadius: 14, padding: isMobile ? "18px" : "20px 22px",
        marginBottom: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "rgba(255,255,255,0.03)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#A1A1AA",
          }}>
            <UploadIcon size={15} />
          </div>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#FAFAFA", letterSpacing: "-0.015em" }}>Import Data</h2>
            <p style={{ fontSize: 12, color: "#52525B" }}>Restore from a backup file</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#A1A1AA", marginBottom: 14, lineHeight: 1.6, letterSpacing: "-0.01em" }}>
          Restore from a previously exported backup file. This will merge with your existing data.
        </p>
        {importError && (
          <div style={{ marginBottom: 12, padding: "8px 12px", backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: "#EF4444" }}>{importError}</p>
          </div>
        )}
        {importSuccess && (
          <div style={{ marginBottom: 12, padding: "8px 12px", backgroundColor: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)", borderRadius: 8, display: "flex", alignItems: "center", gap: 7 }}>
            <CheckCircleIcon size={12} />
            <p style={{ fontSize: 12, color: "#22C55E" }}>Data imported successfully!</p>
          </div>
        )}
        <label style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
          padding: "10px 20px", backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10,
          color: "#FAFAFA", fontSize: 13, cursor: "pointer", textAlign: "center",
          width: isMobile ? "100%" : "auto",
          transition: "all 0.15s ease", fontWeight: 500, letterSpacing: "-0.01em",
        }}>
          <UploadIcon size={13} />
          Choose Backup File
          <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
        </label>
      </div>

      {/* Clear Data Card */}
      <div style={{
        background: "#0F0F12",
        border: "1px solid rgba(239,68,68,0.08)",
        borderRadius: 14, padding: isMobile ? "18px" : "20px 22px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "rgba(239,68,68,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444",
          }}>
            <TrashIcon size={15} />
          </div>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#EF4444", letterSpacing: "-0.015em" }}>Clear All Data</h2>
            <p style={{ fontSize: 12, color: "#52525B" }}>Permanently delete everything</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#A1A1AA", marginBottom: 14, lineHeight: 1.6, letterSpacing: "-0.01em" }}>
          Permanently delete all local data including chat history, memories, and wallet. Export a backup first.
        </p>
        <button onClick={handleClearAll} disabled={clearing}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "10px 20px", backgroundColor: "transparent",
            border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10,
            color: "#EF4444", fontSize: 13, fontWeight: 500,
            cursor: clearing ? "default" : "pointer",
            width: isMobile ? "100%" : "auto",
            transition: "all 0.15s ease", letterSpacing: "-0.01em",
          }}>
          <TrashIcon size={13} />
          {clearing ? "Clearing..." : "Clear All Local Data"}
        </button>
      </div>

      {/* Info */}
      <div style={{
        marginTop: 16,
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 16px",
        backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
        borderRadius: 10,
      }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <p style={{ fontSize: 12, color: "#52525B", lineHeight: 1.6, letterSpacing: "-0.01em" }}>
          All data is stored locally in your browser. Exporting creates a portable backup. Importing merges with existing local data.
        </p>
      </div>
    </div>
  );
}
