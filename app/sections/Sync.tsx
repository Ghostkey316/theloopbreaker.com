"use client";
import { useEffect, useState } from "react";
import { exportData, importData, clearAllMemories, type SyncData } from "../lib/memory";
import { clearSelfLearningData } from "../lib/self-learning";

interface SyncStats {
  chatMessages: number;
  memories: number;
  walletConnected: boolean;
  lastSync: string | null;
  dataSize: string;
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

export default function Sync() {
  const [stats, setStats] = useState<SyncStats>({
    chatMessages: 0, memories: 0, walletConnected: false, lastSync: null, dataSize: "0 KB",
  });
  const [exportSuccess, setExportSuccess] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
    const chatHistory = localStorage.getItem("vaultfire_chat_history");
    const memories = localStorage.getItem("vaultfire_memories");
    const walletAddr = localStorage.getItem("vaultfire_wallet_address");
    const lastSync = localStorage.getItem("vaultfire_last_sync");

    const chatMessages = chatHistory ? JSON.parse(chatHistory).length : 0;
    const memoryCount = memories ? JSON.parse(memories).length : 0;

    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("vaultfire_") || key.startsWith("embris_") || key.startsWith("ember_"))) {
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
    a.download = `embris-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
        setImportError("Invalid backup file. Please use a valid Embris export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClearAll = () => {
    if (!confirm("Clear ALL local data? This will delete your chat history, memories, wallet, and self-learning data. This cannot be undone.")) return;
    setClearing(true);
    clearAllMemories();
    clearSelfLearningData();
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("vaultfire_") || key.startsWith("embris_"))) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    setTimeout(() => { setClearing(false); loadStats(); }, 500);
  };

  return (
    <div style={{ padding: isMobile ? "24px 16px 48px" : "48px 40px", maxWidth: 560, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 40 : 48 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#F4F4F5", letterSpacing: "-0.03em" }}>Data</h1>
        <p style={{ fontSize: 14, color: "#52525B", marginTop: 6 }}>Export, import, and manage your local data</p>
      </div>

      {/* Stats — large numbers, whitespace separated */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap: isMobile ? "24px 16px" : "24px 32px",
        marginBottom: 40,
      }}>
        {[
          { label: "Messages", value: String(stats.chatMessages) },
          { label: "Memories", value: String(stats.memories) },
          { label: "Wallet", value: stats.walletConnected ? "Connected" : "None" },
          { label: "Size", value: stats.dataSize },
        ].map((stat) => (
          <div key={stat.label}>
            <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>{stat.label}</p>
            <p style={{
              fontSize: 20, fontWeight: 600, color: "#F4F4F5",
              ...monoStyle,
              letterSpacing: "-0.02em",
            }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {stats.lastSync && (
        <p style={{ fontSize: 12, color: "#3F3F46", marginBottom: 24 }}>
          Last export: {new Date(stats.lastSync).toLocaleString()}
        </p>
      )}

      {/* Actions — clean list, no card borders */}
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
              {exportSuccess ? "Exported!" : "Export Backup"}
            </p>
            <p style={{ fontSize: 12, color: "#3F3F46" }}>Download JSON backup of all data</p>
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
              {importSuccess ? "Imported!" : "Import Backup"}
            </p>
            <p style={{ fontSize: 12, color: "#3F3F46" }}>Restore from a backup file</p>
          </div>
          <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
        </label>

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
        All data is stored locally in your browser. Exporting creates a backup you can restore later.
        Clearing data is permanent and cannot be undone.
      </p>
    </div>
  );
}
