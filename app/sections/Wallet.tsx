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

  const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

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

  // ── No wallet view ──
  if (view === "none") {
    return (
      <div style={{ padding: isMobile ? "24px 20px 48px" : "48px 40px", maxWidth: 440, margin: "0 auto" }}>
        {/* Alpha banner — minimal inline notice */}
        <div style={{
          padding: "8px 0", marginBottom: 40,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 10, color: "#F97316", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Alpha</span>
          <span style={{ fontSize: 12, color: "#3F3F46" }}>Store funds at your own risk</span>
        </div>

        <div style={{ marginBottom: 40 }}>
          <h1 style={{
            fontSize: 28, fontWeight: 600, color: "#F4F4F5",
            marginBottom: 8, letterSpacing: "-0.03em",
          }}>Wallet</h1>
          <p style={{ fontSize: 14, color: "#52525B", lineHeight: 1.7 }}>
            Create or import an Ethereum-compatible wallet. Keys are stored locally in your browser.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={handleCreate} disabled={creating} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px", width: "100%",
            background: creating ? "rgba(255,255,255,0.03)" : "#F97316",
            border: "none", borderRadius: 10,
            color: creating ? "#3F3F46" : "#09090B",
            fontSize: 14, fontWeight: 600, cursor: creating ? "default" : "pointer",
          }}>
            {creating ? (
              <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.06)", borderTopColor: "#3F3F46", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            ) : (
              <PlusIcon size={15} />
            )}
            {creating ? "Generating..." : "Create New Wallet"}
          </button>
          <button onClick={() => setView("import-mnemonic")} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px", width: "100%",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10,
            color: "#A1A1AA", fontSize: 14, fontWeight: 500, cursor: "pointer",
          }}>
            <FileTextIcon size={14} /> Import Seed Phrase
          </button>
          <button onClick={() => setView("import-pk")} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px", width: "100%",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10,
            color: "#A1A1AA", fontSize: 14, fontWeight: 500, cursor: "pointer",
          }}>
            <KeyIcon size={14} /> Import Private Key
          </button>
        </div>

        <div style={{ marginTop: 32 }}>
          <p style={{ fontSize: 11, color: "#27272A", lineHeight: 1.8, textAlign: "center" }}>
            No recovery possible. You are solely responsible for your seed phrase and private keys.
            Embris and Vaultfire Protocol are not liable for any losses.
          </p>
        </div>
      </div>
    );
  }

  // ── Import views ──
  if (view === "import-mnemonic" || view === "import-pk") {
    const isMnemonicView = view === "import-mnemonic";
    return (
      <div style={{ padding: isMobile ? "24px 20px 48px" : "48px 40px", maxWidth: 440, margin: "0 auto" }}>
        {/* Alpha banner */}
        <div style={{
          padding: "8px 0", marginBottom: 32,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 10, color: "#F97316", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Alpha</span>
          <span style={{ fontSize: 12, color: "#3F3F46" }}>Only import keys on a trusted device</span>
        </div>

        <button onClick={() => { setView("none"); setImportInput(""); setImportError(""); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "none", border: "none", color: "#52525B",
            cursor: "pointer", marginBottom: 24, fontSize: 13, padding: 0,
            fontWeight: 400,
          }}>
          <ArrowLeftIcon size={13} /> Back
        </button>

        <h2 style={{
          fontSize: 24, fontWeight: 600, color: "#F4F4F5",
          marginBottom: 6, letterSpacing: "-0.03em",
        }}>
          {isMnemonicView ? "Import Seed Phrase" : "Import Private Key"}
        </h2>
        <p style={{ fontSize: 14, color: "#52525B", marginBottom: 24, lineHeight: 1.7 }}>
          {isMnemonicView ? "Enter your 12 or 24 word seed phrase." : "Enter your private key (with or without 0x prefix)."}
        </p>

        <textarea value={importInput} onChange={(e) => setImportInput(e.target.value)}
          placeholder={isMnemonicView ? "word1 word2 word3 ..." : "0x..."}
          rows={isMnemonicView ? 3 : 2}
          style={{
            width: "100%", padding: "12px 14px",
            background: "rgba(255,255,255,0.02)",
            border: "none",
            borderRadius: 10, color: "#F4F4F5", fontSize: 13,
            resize: "none", ...monoStyle,
            outline: "none", boxSizing: "border-box",
            lineHeight: 1.6,
          }}
        />
        {importError && <p style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}>{importError}</p>}
        <button
          onClick={isMnemonicView ? handleImportMnemonic : handleImportPK}
          disabled={importInput.trim().length === 0 || importing}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px", width: "100%", marginTop: 12,
            background: importInput.trim().length === 0 || importing ? "rgba(255,255,255,0.03)" : "#F97316",
            border: "none", borderRadius: 10,
            color: importInput.trim().length === 0 || importing ? "#3F3F46" : "#09090B",
            fontSize: 14, fontWeight: 600,
            cursor: importInput.trim().length === 0 || importing ? "default" : "pointer",
          }}>
          {importing ? "Importing..." : "Import Wallet"}
        </button>

        <p style={{ fontSize: 11, color: "#27272A", lineHeight: 1.8, textAlign: "center", marginTop: 24 }}>
          Never share your seed phrase or private key with anyone.
        </p>
      </div>
    );
  }

  // ── Wallet created view ──
  return (
    <div style={{ padding: isMobile ? "24px 20px 48px" : "48px 40px", maxWidth: 520, margin: "0 auto" }}>
      {/* Alpha banner */}
      <div style={{
        padding: "8px 0", marginBottom: 32,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 10, color: "#F97316", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Alpha</span>
        <span style={{ fontSize: 12, color: "#3F3F46" }}>Store funds at your own risk</span>
      </div>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 40,
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#F4F4F5", letterSpacing: "-0.03em" }}>Wallet</h1>
        <button onClick={handleDelete} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 12, color: "#EF4444", background: "none",
          border: "none", padding: "6px 0", cursor: "pointer", fontWeight: 500,
        }}>
          <TrashIcon size={11} /> Delete
        </button>
      </div>

      {/* Address */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>Address</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <code style={{
            flex: 1, fontSize: isMobile ? 11 : 12, color: "#F4F4F5",
            wordBreak: "break-all", ...monoStyle,
            lineHeight: 1.6,
          }}>{walletData?.address}</code>
          <button onClick={() => copyToClipboard(walletData?.address || "", "address")}
            style={{
              flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4,
              padding: "5px 10px",
              backgroundColor: "transparent",
              border: "none",
              borderRadius: 6,
              color: copied === "address" ? "#22C55E" : "#52525B",
              fontSize: 11, cursor: "pointer", fontWeight: 500,
            }}>
            {copied === "address" ? <><CheckIcon size={10} /> Copied</> : <><CopyIcon size={10} /> Copy</>}
          </button>
        </div>
      </div>

      {/* Balance — large numbers like Coinbase */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Balances</p>
          <button onClick={() => walletData && loadBalances(walletData.address)} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, color: "#F97316", background: "none",
            border: "none", cursor: "pointer", fontWeight: 500,
          }}>
            <RefreshIcon size={10} />
            {loadingBals ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loadingBals ? (
          <div style={{ padding: "20px 0" }}>
            <p style={{ fontSize: 13, color: "#3F3F46" }}>Loading balances...</p>
          </div>
        ) : (
          <div>
            {balances.map((bal, idx) => (
              <div key={bal.chain} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 0",
                backgroundColor: idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
                borderBottom: idx < balances.length - 1 ? "1px solid rgba(255,255,255,0.02)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 5, height: 5, borderRadius: "50%",
                    backgroundColor: bal.color,
                  }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#F4F4F5" }}>{bal.chain}</p>
                    <p style={{ fontSize: 10, color: "#3F3F46", ...monoStyle }}>{bal.chainId}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{
                    fontSize: 18, fontWeight: 600, color: "#F4F4F5",
                    ...monoStyle,
                    letterSpacing: "-0.02em",
                  }}>{bal.balanceFormatted}</p>
                  <p style={{ fontSize: 11, color: "#3F3F46" }}>{bal.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seed Phrase */}
      {walletData?.mnemonic && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>Recovery Phrase</p>
            <button onClick={() => setShowMnemonic(!showMnemonic)} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, color: "#F97316", background: "none",
              border: "none", cursor: "pointer", fontWeight: 500,
            }}>
              {showMnemonic ? <><EyeOffIcon size={11} /> Hide</> : <><EyeIcon size={11} /> Reveal</>}
            </button>
          </div>
          {showMnemonic ? (
            <div>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
                gap: isMobile ? "6px 8px" : "6px 10px", marginBottom: 12,
              }}>
                {walletData.mnemonic.split(" ").map((word, i) => (
                  <div key={i} style={{
                    padding: "6px 10px",
                    backgroundColor: "rgba(255,255,255,0.02)",
                    borderRadius: 6, fontSize: 12,
                    color: "#E4E4E7", ...monoStyle,
                  }}>
                    <span style={{ color: "#3F3F46", marginRight: 6, fontSize: 10 }}>{i + 1}.</span>{word}
                  </div>
                ))}
              </div>
              <button onClick={() => copyToClipboard(walletData.mnemonic, "mnemonic")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  width: "100%", padding: "8px",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: 8,
                  color: copied === "mnemonic" ? "#22C55E" : "#52525B",
                  fontSize: 11, cursor: "pointer", fontWeight: 500,
                }}>
                {copied === "mnemonic" ? <><CheckIcon size={10} /> Copied</> : <><CopyIcon size={10} /> Copy Seed Phrase</>}
              </button>
            </div>
          ) : (
            <div style={{ padding: "12px 0" }}>
              <p style={{ fontSize: 13, color: "#27272A", ...monoStyle, letterSpacing: "0.2em" }}>---- ---- ---- ---- ---- ----</p>
            </div>
          )}
        </div>
      )}

      {/* Minimal disclaimer */}
      <p style={{ fontSize: 11, color: "#27272A", lineHeight: 1.8, textAlign: "center" }}>
        No recovery possible. You are solely responsible for your keys.
        Embris and Vaultfire Protocol are not liable for any losses.
      </p>
    </div>
  );
}
