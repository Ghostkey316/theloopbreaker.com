"use client";
import { useEffect, useState } from "react";
import { createWallet, importFromMnemonic, importFromPrivateKey, deleteWallet, isWalletCreated, getWalletAddress, getWalletMnemonic, type WalletData } from "../lib/wallet";
import { getAllBalances, type ChainBalance } from "../lib/blockchain";

type WalletView = "none" | "created" | "import-mnemonic" | "import-pk";

// SVG Icons
function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function KeyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function FileTextIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function CopyIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ArrowLeftIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function RefreshIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function EyeIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function TrashIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
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
    const data = await createWallet();
    setWalletData(data);
    setView("created");
    loadBalances(data.address);
  };

  const handleImportMnemonic = async () => {
    setImportError("");
    try {
      const data = await importFromMnemonic(importInput);
      setWalletData(data);
      setView("created");
      setImportInput("");
      loadBalances(data.address);
    } catch { setImportError("Invalid mnemonic phrase."); }
  };

  const handleImportPK = async () => {
    setImportError("");
    try {
      const data = await importFromPrivateKey(importInput);
      setWalletData(data);
      setView("created");
      setImportInput("");
      loadBalances(data.address);
    } catch { setImportError("Invalid private key."); }
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

  // No wallet view
  if (view === "none") {
    return (
      <div style={{ padding: isMobile ? '20px 16px 40px' : '40px 32px', maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? 28 : 36 }}>
          {/* Wallet icon */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: isMobile ? 56 : 64,
            height: isMobile ? 56 : 64,
            borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))',
            border: '1px solid rgba(249,115,22,0.2)',
            marginBottom: 16,
          }}>
            <svg width={isMobile ? 24 : 28} height={isMobile ? 24 : 28} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
            </svg>
          </div>
          <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: "#FFFFFF", marginBottom: 8, letterSpacing: '-0.03em' }}>Vaultfire Wallet</h1>
          <p style={{ fontSize: isMobile ? 13 : 14, color: "#A0A0A8", lineHeight: 1.6, letterSpacing: '-0.01em' }}>Create or import an Ethereum-compatible wallet. Keys stored locally in your browser.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={handleCreate} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: "13px 24px",
            backgroundColor: "#F97316",
            border: "none",
            borderRadius: 10,
            color: "#0A0A0C",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: 'all 0.2s ease',
            letterSpacing: '-0.01em',
          }}>
            <PlusIcon size={16} />
            Create New Wallet
          </button>
          <button onClick={() => setView("import-mnemonic")} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: "13px 24px",
            backgroundColor: "#111114",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            color: "#FFFFFF",
            fontSize: 14,
            cursor: "pointer",
            transition: 'all 0.15s ease',
            letterSpacing: '-0.01em',
            fontWeight: 500,
          }}>
            <FileTextIcon size={15} />
            Import Seed Phrase
          </button>
          <button onClick={() => setView("import-pk")} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: "13px 24px",
            backgroundColor: "#111114",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            color: "#FFFFFF",
            fontSize: 14,
            cursor: "pointer",
            transition: 'all 0.15s ease',
            letterSpacing: '-0.01em',
            fontWeight: 500,
          }}>
            <KeyIcon size={15} />
            Import Private Key
          </button>
        </div>

        <div style={{
          marginTop: 24,
          padding: '12px 14px',
          backgroundColor: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.12)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p style={{ fontSize: 12, color: "#F59E0B", lineHeight: 1.6, letterSpacing: '-0.01em' }}>Browser-based wallet for demo purposes. Do not store significant funds.</p>
        </div>
      </div>
    );
  }

  // Import views
  if (view === "import-mnemonic" || view === "import-pk") {
    const isMnemonicView = view === "import-mnemonic";
    return (
      <div style={{ padding: isMobile ? '20px 16px 40px' : '40px 32px', maxWidth: 480, margin: "0 auto" }}>
        <button onClick={() => { setView("none"); setImportInput(""); setImportError(""); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: "none",
            border: "none",
            color: "#A0A0A8",
            cursor: "pointer",
            marginBottom: 24,
            fontSize: 13,
            padding: 0,
            transition: 'color 0.15s ease',
            letterSpacing: '-0.01em',
          }}>
          <ArrowLeftIcon size={14} />
          Back
        </button>
        <h2 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: "#FFFFFF", marginBottom: 6, letterSpacing: '-0.03em' }}>{isMnemonicView ? "Import Seed Phrase" : "Import Private Key"}</h2>
        <p style={{ fontSize: 13, color: "#A0A0A8", marginBottom: 20, letterSpacing: '-0.01em' }}>{isMnemonicView ? "Enter your 12 or 24 word seed phrase." : "Enter your private key (with or without 0x prefix)."}</p>
        <textarea value={importInput} onChange={(e) => setImportInput(e.target.value)} placeholder={isMnemonicView ? "word1 word2 word3 ..." : "0x..."} rows={isMnemonicView ? 4 : 2}
          style={{
            width: "100%",
            padding: "12px 14px",
            backgroundColor: "#111114",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            color: "#FFFFFF",
            fontSize: 13,
            resize: "none",
            fontFamily: "'SF Mono', monospace",
            outline: "none",
            boxSizing: "border-box",
            transition: 'border-color 0.15s ease',
            letterSpacing: '0.01em',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
        />
        {importError && <p style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}>{importError}</p>}
        <button
          onClick={isMnemonicView ? handleImportMnemonic : handleImportPK}
          disabled={importInput.trim().length === 0}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "13px",
            backgroundColor: importInput.trim() ? "#F97316" : "rgba(255,255,255,0.04)",
            border: "none",
            borderRadius: 10,
            color: importInput.trim() ? "#0A0A0C" : "#666670",
            fontSize: 14,
            fontWeight: 600,
            cursor: importInput.trim() ? "pointer" : "default",
            transition: 'all 0.2s ease',
            letterSpacing: '-0.01em',
          }}>
          Import Wallet
        </button>
      </div>
    );
  }

  // Wallet created view
  return (
    <div style={{ padding: isMobile ? '20px 16px 40px' : '40px 32px', maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
        flexWrap: "wrap",
        gap: 8,
      }}>
        <h1 style={{ fontSize: isMobile ? 22 : 24, fontWeight: 700, color: "#FFFFFF", letterSpacing: '-0.03em' }}>My Wallet</h1>
        <button onClick={handleDelete} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          color: "#EF4444",
          background: "none",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 8,
          padding: "6px 12px",
          cursor: "pointer",
          transition: 'all 0.15s ease',
          fontWeight: 500,
        }}>
          <TrashIcon size={11} />
          Delete
        </button>
      </div>

      {/* Address Card */}
      <div style={{
        backgroundColor: "#111114",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: isMobile ? '14px 16px' : '16px 18px',
        marginBottom: 12,
      }}>
        <p style={{ fontSize: 10, color: "#666670", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>Address</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <code style={{
            flex: 1,
            fontSize: isMobile ? 11 : 12,
            color: "#FFFFFF",
            wordBreak: "break-all",
            fontFamily: "'SF Mono', monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>{walletData?.address}</code>
          <button onClick={() => copyToClipboard(walletData?.address || "", "address")}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: "6px 12px",
              backgroundColor: copied === "address" ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
              border: "none",
              borderRadius: 8,
              color: copied === "address" ? "#22C55E" : "#A0A0A8",
              fontSize: 11,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: 'all 0.15s ease',
              fontWeight: 500,
            }}>
            {copied === "address" ? <><CheckIcon size={11} /> Copied</> : <><CopyIcon size={11} /> Copy</>}
          </button>
        </div>
      </div>

      {/* Balances Card */}
      <div style={{
        backgroundColor: "#111114",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: isMobile ? '14px 16px' : '16px 18px',
        marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ fontSize: 10, color: "#666670", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>Balances</p>
          <button onClick={() => walletData && loadBalances(walletData.address)} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: "#F97316",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
            transition: 'opacity 0.15s ease',
          }}>
            <RefreshIcon size={11} />
            {loadingBals ? "Loading..." : "Refresh"}
          </button>
        </div>
        {loadingBals ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[0,1,2].map(i => <div key={i} className="shimmer" style={{ height: 44, borderRadius: 8 }} />)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {balances.map((bal) => (
              <div key={bal.chain} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: isMobile ? "10px 12px" : "10px 14px",
                backgroundColor: "rgba(255,255,255,0.03)",
                borderRadius: 8,
                gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: bal.color, flexShrink: 0, boxShadow: `0 0 6px ${bal.color}30` }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF", letterSpacing: '-0.01em' }}>{bal.chain}</p>
                    <p style={{ fontSize: 10, color: "#666670" }}>Chain {bal.chainId}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: "#FFFFFF", fontFamily: "'SF Mono', monospace", letterSpacing: '-0.01em' }}>{bal.balanceFormatted}</p>
                  <p style={{ fontSize: 10, color: "#666670" }}>{bal.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seed Phrase Card */}
      {walletData?.mnemonic && (
        <div style={{
          backgroundColor: "#111114",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12,
          padding: isMobile ? '14px 16px' : '16px 18px',
          marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 10, color: "#666670", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>Seed Phrase</p>
            <button onClick={() => setShowMnemonic(!showMnemonic)} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: "#F97316",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
            }}>
              {showMnemonic ? <><EyeOffIcon size={12} /> Hide</> : <><EyeIcon size={12} /> Reveal</>}
            </button>
          </div>
          {showMnemonic ? (
            <div>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
                gap: 4,
                marginBottom: 10,
              }}>
                {walletData.mnemonic.split(" ").map((word, i) => (
                  <div key={i} style={{
                    padding: "6px 10px",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    borderRadius: 6,
                    fontSize: isMobile ? 11 : 12,
                    color: "#FFFFFF",
                    fontFamily: "'SF Mono', monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    <span style={{ color: "#666670", marginRight: 6, fontSize: 10 }}>{i + 1}.</span>{word}
                  </div>
                ))}
              </div>
              <button onClick={() => copyToClipboard(walletData.mnemonic, "mnemonic")}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  width: "100%",
                  padding: "8px",
                  backgroundColor: copied === "mnemonic" ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
                  border: "none",
                  borderRadius: 8,
                  color: copied === "mnemonic" ? "#22C55E" : "#A0A0A8",
                  fontSize: 11,
                  cursor: "pointer",
                  transition: 'all 0.15s ease',
                  fontWeight: 500,
                }}>
                {copied === "mnemonic" ? <><CheckIcon size={11} /> Copied</> : <><CopyIcon size={11} /> Copy Seed Phrase</>}
              </button>
            </div>
          ) : (
            <div style={{ padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
              <p style={{ fontSize: 13, color: "#666670", fontFamily: "'SF Mono', monospace", letterSpacing: "0.2em" }}>•••• •••• •••• •••• •••• ••••</p>
            </div>
          )}
        </div>
      )}

      {/* Warning */}
      <div style={{
        padding: '12px 14px',
        backgroundColor: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.12)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p style={{ fontSize: 12, color: "#F59E0B", lineHeight: 1.6, letterSpacing: '-0.01em' }}>Never share your seed phrase or private key. Store them securely offline.</p>
      </div>
    </div>
  );
}
