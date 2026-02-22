"use client";
import { useEffect, useState } from "react";
import { createWallet, importFromMnemonic, importFromPrivateKey, deleteWallet, isWalletCreated, getWalletAddress, getWalletMnemonic, type WalletData } from "../lib/wallet";
import { getAllBalances, type ChainBalance } from "../lib/blockchain";

type WalletView = "none" | "created" | "import-mnemonic" | "import-pk";

/* ── SVG Icons ── */
function PlusIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
}
function KeyIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>);
}
function FileTextIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>);
}
function CopyIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>);
}
function CheckIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>);
}
function ArrowLeftIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>);
}
function RefreshIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>);
}
function EyeIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>);
}
function EyeOffIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>);
}
function TrashIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>);
}
function SendIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>);
}
function ReceiveIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 17 13" /><line x1="12" y1="18" x2="12" y2="6" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></svg>);
}
function ClockIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
}
function ShieldIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
}
function AlertTriangleIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>);
}

/* ── Chain Token Icons ── */
function EthIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path d="M16 4v8.87l7.5 3.35L16 4z" fill="#fff" opacity="0.6" />
      <path d="M16 4L8.5 16.22 16 12.87V4z" fill="#fff" />
      <path d="M16 21.97v6.03l7.5-10.38L16 21.97z" fill="#fff" opacity="0.6" />
      <path d="M16 28V21.97l-7.5-4.35L16 28z" fill="#fff" />
      <path d="M16 20.57l7.5-4.35L16 12.87v7.7z" fill="#fff" opacity="0.2" />
      <path d="M8.5 16.22l7.5 4.35v-7.7l-7.5 3.35z" fill="#fff" opacity="0.5" />
    </svg>
  );
}

function AvaxIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#E84142" />
      <path d="M11.5 21h-3.2c-.5 0-.7-.3-.5-.7L15.5 8.5c.2-.4.7-.4.9 0l2 3.7c.1.2.1.5 0 .7l-5.4 7.7c-.2.3-.5.4-.8.4h-.7zm9.2 0h-3.5c-.5 0-.7-.3-.5-.7l3.5-5c.2-.4.7-.4.9 0l1.8 5c.2.4-.1.7-.5.7h-1.7z" fill="#fff" />
    </svg>
  );
}

function BaseIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#0052FF" />
      <path d="M16 26c5.523 0 10-4.477 10-10S21.523 6 16 6 6 10.477 6 16s4.477 10 10 10z" fill="#0052FF" />
      <path d="M15.8 24.6c4.75 0 8.6-3.85 8.6-8.6s-3.85-8.6-8.6-8.6C11.3 7.4 7.6 10.9 7.2 15.4h11.4v1.2H7.2c.4 4.5 4.1 8 8.6 8z" fill="#fff" />
    </svg>
  );
}

function getChainIcon(chainName: string) {
  const name = chainName.toLowerCase();
  if (name.includes('avalanche') || name.includes('avax')) return <AvaxIcon />;
  if (name.includes('base')) return <BaseIcon />;
  return <EthIcon />;
}

/* ── Helpers ── */
function computeTotalBalance(balances: ChainBalance[]): string {
  let total = 0;
  for (const bal of balances) {
    const val = parseFloat(bal.balanceFormatted);
    if (!isNaN(val)) total += val;
  }
  if (total === 0) return '0.0000';
  return total.toFixed(4);
}

const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

export default function Wallet() {
  const [view, setView] = useState<WalletView>("none");
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [loadingBals, setLoadingBals] = useState(false);
  const [importInput, setImportInput] = useState("");
  const [importError, setImportError] = useState("");
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [copied, setCopied] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showFullAddress, setShowFullAddress] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isWalletCreated()) {
      const addr = getWalletAddress();
      const mnemonic = getWalletMnemonic();
      if (addr) {
        setWalletData({ address: addr, mnemonic: mnemonic || "", privateKey: "" });
        setView("created");
        loadBalances(addr);
      }
    }
  }, []);

  const loadBalances = async (address: string) => {
    setLoadingBals(true);
    const bals = await getAllBalances(address);
    setBalances(bals);
    setLoadingBals(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const data = await createWallet();
      setWalletData(data);
      setView("created");
      loadBalances(data.address);
    } finally {
      setCreating(false);
    }
  };

  const handleImportMnemonic = async () => {
    setImportError("");
    setImporting(true);
    try {
      const data = await importFromMnemonic(importInput);
      setWalletData(data);
      setView("created");
      setImportInput("");
      loadBalances(data.address);
    } catch {
      setImportError("Invalid mnemonic phrase. Please check and try again.");
    } finally {
      setImporting(false);
    }
  };

  const handleImportPK = async () => {
    setImportError("");
    setImporting(true);
    try {
      const data = await importFromPrivateKey(importInput);
      setWalletData(data);
      setView("created");
      setImportInput("");
      loadBalances(data.address);
    } catch {
      setImportError("Invalid private key. Please check and try again.");
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = () => {
    if (confirm("Delete this wallet? Make sure you have your seed phrase backed up.")) {
      deleteWallet();
      setWalletData(null);
      setBalances([]);
      setView("none");
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  // ── No wallet — Premium onboarding ──
  if (view === "none") {
    return (
      <div className="page-enter" style={{
        padding: isMobile ? "24px 20px 48px" : "48px 40px",
        maxWidth: 480, margin: "0 auto",
        display: "flex", flexDirection: "column", minHeight: "100%",
      }}>
        {/* Hero Section */}
        <div style={{ textAlign: "center", marginBottom: 40, paddingTop: isMobile ? 20 : 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))",
            border: "1px solid rgba(249,115,22,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px",
          }}>
            <ShieldIcon size={28} />
          </div>
          <h1 style={{
            fontSize: isMobile ? 26 : 32, fontWeight: 700, color: "#F4F4F5",
            marginBottom: 10, letterSpacing: "-0.03em", lineHeight: 1.2,
          }}>Vaultfire Wallet</h1>
          <p style={{
            fontSize: 14, color: "#71717A", lineHeight: 1.7, maxWidth: 340, margin: "0 auto",
          }}>
            Your self-custodial wallet for the Vaultfire ecosystem. Keys are stored locally and never leave your browser.
          </p>
        </div>

        {/* Action Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          <button onClick={handleCreate} disabled={creating} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "16px 20px", width: "100%",
            background: creating ? "rgba(255,255,255,0.02)" : "linear-gradient(135deg, #F97316, #EA580C)",
            border: "none", borderRadius: 14,
            color: creating ? "#3F3F46" : "#FFFFFF",
            fontSize: 15, fontWeight: 600, cursor: creating ? "default" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: creating ? "none" : "0 4px 16px rgba(249,115,22,0.2)",
          }}>
            {creating ? (
              <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#3F3F46", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <PlusIcon size={18} />
              </div>
            )}
            <div style={{ textAlign: "left" }}>
              <div>{creating ? "Generating..." : "Create New Wallet"}</div>
              {!creating && <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>Generate a new keypair with seed phrase</div>}
            </div>
          </button>

          <button onClick={() => setView("import-mnemonic")} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "16px 20px", width: "100%",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
            color: "#E4E4E7", fontSize: 15, fontWeight: 500, cursor: "pointer",
            transition: "all 0.15s ease", textAlign: "left",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)"; }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, color: "#A1A1AA",
            }}>
              <FileTextIcon size={16} />
            </div>
            <div>
              <div>Import Seed Phrase</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "#71717A", marginTop: 2 }}>Restore with your 12 or 24 word phrase</div>
            </div>
          </button>

          <button onClick={() => setView("import-pk")} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "16px 20px", width: "100%",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
            color: "#E4E4E7", fontSize: 15, fontWeight: 500, cursor: "pointer",
            transition: "all 0.15s ease", textAlign: "left",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)"; }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, color: "#A1A1AA",
            }}>
              <KeyIcon size={16} />
            </div>
            <div>
              <div>Import Private Key</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "#71717A", marginTop: 2 }}>Import using your private key directly</div>
            </div>
          </button>
        </div>

        {/* Alpha Notice — Premium card style */}
        <div style={{
          padding: "14px 16px",
          backgroundColor: "rgba(249,115,22,0.04)",
          border: "1px solid rgba(249,115,22,0.1)",
          borderRadius: 12,
          display: "flex", alignItems: "flex-start", gap: 10,
          marginBottom: 24,
        }}>
          <AlertTriangleIcon size={14} />
          <div>
            <p style={{ fontSize: 12, color: "#F97316", fontWeight: 600, marginBottom: 4 }}>Alpha Software</p>
            <p style={{ fontSize: 11, color: "#71717A", lineHeight: 1.6 }}>
              Store funds at your own risk. No recovery possible — you are solely responsible for your seed phrase and private keys. Embris and Vaultfire Protocol are not liable for any losses.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Import views — Polished ──
  if (view === "import-mnemonic" || view === "import-pk") {
    const isMnemonicView = view === "import-mnemonic";
    return (
      <div className="page-enter" style={{
        padding: isMobile ? "24px 20px 48px" : "48px 40px",
        maxWidth: 480, margin: "0 auto",
      }}>
        <button onClick={() => { setView("none"); setImportInput(""); setImportError(""); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "none", border: "none", color: "#71717A",
            cursor: "pointer", marginBottom: 32, fontSize: 13, padding: 0,
            fontWeight: 500, transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#A1A1AA"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#71717A"; }}
        >
          <ArrowLeftIcon size={14} /> Back
        </button>

        <div style={{
          width: 48, height: 48, borderRadius: 14,
          backgroundColor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 20, color: "#A1A1AA",
        }}>
          {isMnemonicView ? <FileTextIcon size={22} /> : <KeyIcon size={22} />}
        </div>

        <h2 style={{
          fontSize: 24, fontWeight: 700, color: "#F4F4F5",
          marginBottom: 8, letterSpacing: "-0.03em",
        }}>
          {isMnemonicView ? "Import Seed Phrase" : "Import Private Key"}
        </h2>
        <p style={{ fontSize: 14, color: "#71717A", marginBottom: 28, lineHeight: 1.7 }}>
          {isMnemonicView ? "Enter your 12 or 24 word recovery phrase, separated by spaces." : "Enter your private key (with or without 0x prefix)."}
        </p>

        <div style={{
          backgroundColor: "rgba(255,255,255,0.02)",
          border: importError ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, padding: 2,
          transition: "border-color 0.15s ease",
        }}>
          <textarea value={importInput} onChange={(e) => setImportInput(e.target.value)}
            placeholder={isMnemonicView ? "word1 word2 word3 word4 ..." : "0x..."}
            rows={isMnemonicView ? 4 : 2}
            style={{
              width: "100%", padding: "14px 16px",
              background: "transparent",
              border: "none",
              borderRadius: 10, color: "#F4F4F5", fontSize: 14,
              resize: "none", ...monoStyle,
              outline: "none", boxSizing: "border-box",
              lineHeight: 1.7,
            }}
          />
        </div>
        {importError && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            marginTop: 10, padding: "8px 12px",
            backgroundColor: "rgba(239,68,68,0.06)",
            borderRadius: 8,
          }}>
            <AlertTriangleIcon size={12} />
            <p style={{ color: "#EF4444", fontSize: 12 }}>{importError}</p>
          </div>
        )}
        <button
          onClick={isMnemonicView ? handleImportMnemonic : handleImportPK}
          disabled={importInput.trim().length === 0 || importing}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px", width: "100%", marginTop: 16,
            background: importInput.trim().length === 0 || importing
              ? "rgba(255,255,255,0.03)"
              : "linear-gradient(135deg, #F97316, #EA580C)",
            border: "none", borderRadius: 12,
            color: importInput.trim().length === 0 || importing ? "#3F3F46" : "#FFFFFF",
            fontSize: 15, fontWeight: 600,
            cursor: importInput.trim().length === 0 || importing ? "default" : "pointer",
            transition: "all 0.15s ease",
            boxShadow: importInput.trim().length > 0 && !importing ? "0 4px 16px rgba(249,115,22,0.2)" : "none",
          }}>
          {importing ? (
            <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#3F3F46", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          ) : null}
          {importing ? "Importing..." : "Import Wallet"}
        </button>

        {/* Security notice */}
        <div style={{
          padding: "12px 14px", marginTop: 24,
          backgroundColor: "rgba(249,115,22,0.04)",
          border: "1px solid rgba(249,115,22,0.08)",
          borderRadius: 10,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <ShieldIcon size={14} />
          <p style={{ fontSize: 11, color: "#71717A", lineHeight: 1.6 }}>
            {isMnemonicView
              ? "Your seed phrase is encrypted and stored locally. Only import on a trusted device."
              : "Never share your private key with anyone. Keys are stored locally in your browser."
            }
          </p>
        </div>
      </div>
    );
  }

  // ── Wallet created — Premium dashboard ──
  const totalBal = computeTotalBalance(balances);

  return (
    <div className="page-enter" style={{
      padding: isMobile ? "0 0 48px" : "0 0 48px",
      maxWidth: 560, margin: "0 auto",
      display: "flex", flexDirection: "column",
    }}>
      {/* ── Balance Hero Card ── */}
      <div style={{
        padding: isMobile ? "28px 20px 24px" : "36px 32px 28px",
        background: "linear-gradient(180deg, rgba(249,115,22,0.06) 0%, transparent 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
      }}>
        {/* Alpha badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 6,
          backgroundColor: "rgba(249,115,22,0.08)",
          border: "1px solid rgba(249,115,22,0.12)",
          marginBottom: 20,
        }}>
          <AlertTriangleIcon size={10} />
          <span style={{ fontSize: 10, color: "#F97316", fontWeight: 600, letterSpacing: "0.05em" }}>ALPHA</span>
          <span style={{ fontSize: 10, color: "#71717A" }}>Store funds at your own risk</span>
        </div>

        {/* Total balance */}
        <p style={{ fontSize: 12, color: "#71717A", fontWeight: 500, marginBottom: 6, letterSpacing: "0.02em" }}>
          Total Balance
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: isMobile ? 36 : 44, fontWeight: 700, color: "#F4F4F5",
            ...monoStyle, letterSpacing: "-0.03em", lineHeight: 1.1,
          }}>
            {loadingBals ? "—" : totalBal}
          </span>
          <span style={{ fontSize: 16, color: "#52525B", fontWeight: 500 }}>ETH equiv.</span>
        </div>

        {/* Address row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginTop: 16,
        }}>
          <button
            onClick={() => setShowFullAddress(!showFullAddress)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#A1A1AA", fontSize: 12, cursor: "pointer",
              ...monoStyle, transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
          >
            {showFullAddress
              ? walletData?.address
              : `${walletData?.address?.slice(0, 6)}...${walletData?.address?.slice(-4)}`
            }
          </button>
          <button
            onClick={() => copyToClipboard(walletData?.address || "", "address")}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "6px 10px", borderRadius: 8,
              backgroundColor: copied === "address" ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
              border: "1px solid " + (copied === "address" ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)"),
              color: copied === "address" ? "#22C55E" : "#71717A",
              fontSize: 11, cursor: "pointer", fontWeight: 500,
              transition: "all 0.15s ease",
            }}
          >
            {copied === "address" ? <><CheckIcon size={10} /> Copied</> : <><CopyIcon size={10} /> Copy</>}
          </button>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div style={{
        display: "flex", gap: 10,
        padding: isMobile ? "20px 20px 0" : "24px 32px 0",
      }}>
        <button
          onClick={() => copyToClipboard(walletData?.address || "", "address")}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            padding: "16px 12px", borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#F4F4F5", cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: "rgba(34,197,94,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#22C55E",
          }}>
            <ReceiveIcon size={18} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Receive</span>
        </button>
        <button
          onClick={() => alert("Send functionality coming in a future update.")}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            padding: "16px 12px", borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#F4F4F5", cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: "rgba(249,115,22,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#F97316",
          }}>
            <SendIcon size={18} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Send</span>
        </button>
      </div>

      {/* ── Token List ── */}
      <div style={{ padding: isMobile ? "24px 20px 0" : "28px 32px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#F4F4F5", letterSpacing: "-0.01em" }}>Tokens</h3>
          <button onClick={() => walletData && loadBalances(walletData.address)} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 12, color: "#F97316", background: "none",
            border: "none", cursor: "pointer", fontWeight: 500,
            padding: "4px 8px", borderRadius: 6,
            transition: "opacity 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            <RefreshIcon size={11} />
            {loadingBals ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loadingBals ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{
                height: 68, borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.03)",
              }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {balances.map((bal) => (
              <div key={bal.chain} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px",
                backgroundColor: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.04)",
                borderRadius: 14,
                transition: "all 0.15s ease",
                cursor: "default",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.035)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    overflow: "hidden",
                  }}>
                    {getChainIcon(bal.chain)}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#F4F4F5", marginBottom: 2 }}>{bal.chain}</p>
                    <p style={{ fontSize: 11, color: "#52525B", ...monoStyle }}>
                      {bal.symbol} · Chain {bal.chainId}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{
                    fontSize: 18, fontWeight: 700, color: "#F4F4F5",
                    ...monoStyle, letterSpacing: "-0.02em",
                  }}>{bal.balanceFormatted}</p>
                  <p style={{ fontSize: 11, color: "#52525B", fontWeight: 500 }}>{bal.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Transaction History ── */}
      <div style={{ padding: isMobile ? "24px 20px 0" : "28px 32px 0" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#F4F4F5", letterSpacing: "-0.01em", marginBottom: 14 }}>
          Recent Activity
        </h3>
        <div style={{
          padding: "32px 20px",
          backgroundColor: "rgba(255,255,255,0.015)",
          border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: 14,
          textAlign: "center",
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.03)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px", color: "#3F3F46",
          }}>
            <ClockIcon size={20} />
          </div>
          <p style={{ fontSize: 13, color: "#52525B", fontWeight: 500, marginBottom: 4 }}>No transactions yet</p>
          <p style={{ fontSize: 12, color: "#3F3F46", lineHeight: 1.5 }}>
            Your transaction history will appear here
          </p>
        </div>
      </div>

      {/* ── Recovery Phrase ── */}
      {walletData?.mnemonic && (
        <div style={{ padding: isMobile ? "24px 20px 0" : "28px 32px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#F4F4F5", letterSpacing: "-0.01em" }}>Recovery Phrase</h3>
            <button onClick={() => setShowMnemonic(!showMnemonic)} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 12, color: "#F97316", background: "none",
              border: "none", cursor: "pointer", fontWeight: 500,
              padding: "4px 8px", borderRadius: 6,
            }}>
              {showMnemonic ? <><EyeOffIcon size={12} /> Hide</> : <><EyeIcon size={12} /> Reveal</>}
            </button>
          </div>
          {showMnemonic ? (
            <div style={{
              backgroundColor: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, padding: 16,
            }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
                gap: "8px", marginBottom: 14,
              }}>
                {walletData.mnemonic.split(" ").map((word, i) => (
                  <div key={i} style={{
                    padding: "8px 12px",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    borderRadius: 8, fontSize: 13,
                    color: "#E4E4E7", ...monoStyle,
                    display: "flex", alignItems: "center", gap: 8,
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <span style={{ color: "#3F3F46", fontSize: 10, fontWeight: 600, minWidth: 16 }}>{i + 1}</span>
                    {word}
                  </div>
                ))}
              </div>
              <button onClick={() => copyToClipboard(walletData.mnemonic, "mnemonic")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  width: "100%", padding: "10px",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  color: copied === "mnemonic" ? "#22C55E" : "#71717A",
                  fontSize: 12, cursor: "pointer", fontWeight: 500,
                  transition: "all 0.15s ease",
                }}>
                {copied === "mnemonic" ? <><CheckIcon size={11} /> Copied</> : <><CopyIcon size={11} /> Copy Seed Phrase</>}
              </button>
            </div>
          ) : (
            <div style={{
              padding: "20px",
              backgroundColor: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 14, textAlign: "center",
            }}>
              <p style={{ fontSize: 13, color: "#3F3F46", ...monoStyle, letterSpacing: "0.15em" }}>
                ●●●● ●●●● ●●●● ●●●● ●●●● ●●●●
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Danger Zone ── */}
      <div style={{
        padding: isMobile ? "32px 20px 0" : "36px 32px 0",
      }}>
        <div style={{
          padding: "16px",
          backgroundColor: "rgba(239,68,68,0.03)",
          border: "1px solid rgba(239,68,68,0.08)",
          borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontSize: 13, color: "#EF4444", fontWeight: 600, marginBottom: 2 }}>Delete Wallet</p>
            <p style={{ fontSize: 11, color: "#71717A", lineHeight: 1.5 }}>
              This cannot be undone without your recovery phrase
            </p>
          </div>
          <button onClick={handleDelete} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 12, color: "#EF4444", fontWeight: 600,
            padding: "8px 14px", borderRadius: 8,
            backgroundColor: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.15)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)"; }}
          >
            <TrashIcon size={11} /> Delete
          </button>
        </div>
      </div>

      {/* ── Footer disclaimer ── */}
      <div style={{ padding: isMobile ? "24px 20px 0" : "28px 32px 0" }}>
        <p style={{ fontSize: 11, color: "#27272A", lineHeight: 1.8, textAlign: "center" }}>
          No recovery possible. You are solely responsible for your keys.
          Embris and Vaultfire Protocol are not liable for any losses.
        </p>
      </div>
    </div>
  );
}
