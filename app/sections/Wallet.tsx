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
function AlertIcon({ size = 13 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>);
}
function ShieldOffIcon({ size = 13 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19.69 14a6.9 6.9 0 0 0 .31-2V5l-8-3-3.16 1.18" /><path d="M4.73 4.73L4 5v7c0 6 8 10 8 10a20.29 20.29 0 0 0 5.62-4.38" /><line x1="1" y1="1" x2="23" y2="23" /></svg>);
}

/* ── Alpha Warning Banner ── */
function AlphaWarningBanner() {
  return (
    <div style={{
      padding: '12px 16px', marginBottom: 20,
      background: 'rgba(249,115,22,0.04)',
      border: '1px solid rgba(249,115,22,0.12)',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <AlertIcon size={14} />
        <p style={{ fontSize: 12, fontWeight: 600, color: '#F97316', letterSpacing: '-0.01em' }}>
          Alpha Software — Store Funds at Your Own Risk
        </p>
      </div>
      <p style={{ fontSize: 12, color: '#A1A1AA', lineHeight: 1.6, letterSpacing: '-0.01em', paddingLeft: 22 }}>
        Vaultfire Wallet is in alpha. Vaultfire Protocol is not responsible for lost, stolen, or inaccessible funds.
        You are solely responsible for securing your seed phrase and private keys.
      </p>
    </div>
  );
}

/* ── Full Wallet Disclaimer Block ── */
function WalletDisclaimerBlock() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 14px', backgroundColor: 'rgba(239,68,68,0.04)',
        border: '1px solid rgba(239,68,68,0.08)', borderRadius: 10,
      }}>
        <ShieldOffIcon size={13} />
        <p style={{ fontSize: 12, color: '#FCA5A5', lineHeight: 1.6, letterSpacing: '-0.01em' }}>
          <span style={{ fontWeight: 600 }}>No recovery possible.</span>{' '}
          Vaultfire Protocol cannot recover lost or stolen funds. You are solely responsible for securing your seed phrase and private keys.
        </p>
      </div>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 14px', backgroundColor: 'rgba(234,179,8,0.03)',
        border: '1px solid rgba(234,179,8,0.06)', borderRadius: 10,
      }}>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p style={{ fontSize: 12, color: '#FCD34D', lineHeight: 1.6, letterSpacing: '-0.01em' }}>
          <span style={{ fontWeight: 600 }}>No liability.</span>{' '}
          Vaultfire Protocol and its contributors are not liable for any losses, damages, or harms arising from use of this wallet.
        </p>
      </div>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10,
      }}>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p style={{ fontSize: 12, color: '#A1A1AA', lineHeight: 1.6, letterSpacing: '-0.01em' }}>
          Never share your seed phrase or private key with anyone. Store them securely offline, away from internet-connected devices.
        </p>
      </div>
    </div>
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
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

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
    if (confirm("Delete this wallet? Make sure you have your seed phrase backed up. Vaultfire Protocol cannot recover deleted wallets.")) {
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

  const btnPrimary = (disabled: boolean) => ({
    display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8,
    padding: "13px 24px", width: "100%",
    background: disabled ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #F97316, #EA580C)',
    border: "none", borderRadius: 10,
    color: disabled ? '#52525B' : "#09090B",
    fontSize: 14, fontWeight: 600, cursor: disabled ? "default" : "pointer",
    transition: 'all 0.2s ease', letterSpacing: '-0.01em',
    boxShadow: disabled ? 'none' : '0 4px 16px rgba(249,115,22,0.2)',
  });

  const btnSecondary = {
    display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8,
    padding: "13px 24px", width: "100%",
    background: '#0F0F12',
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10, color: "#FAFAFA", fontSize: 14,
    cursor: "pointer", transition: 'all 0.2s ease',
    letterSpacing: '-0.01em', fontWeight: 500,
  };

  // ── No wallet view ──
  if (view === "none") {
    return (
      <div style={{ padding: isMobile ? '24px 20px 48px' : '48px 40px', maxWidth: 480, margin: "0 auto" }}>
        <AlphaWarningBanner />
        <div style={{ textAlign: "center", marginBottom: isMobile ? 24 : 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: isMobile ? 56 : 64, height: isMobile ? 56 : 64, borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))',
            border: '1px solid rgba(249,115,22,0.15)', marginBottom: 16,
            boxShadow: '0 8px 32px rgba(249,115,22,0.06)',
          }}>
            <svg width={isMobile ? 24 : 28} height={isMobile ? 24 : 28} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
            </svg>
          </div>
          <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: "#FAFAFA", marginBottom: 8, letterSpacing: '-0.03em' }}>Vaultfire Wallet</h1>
          <p style={{ fontSize: isMobile ? 14 : 15, color: "#A1A1AA", lineHeight: 1.6, letterSpacing: '-0.01em' }}>
            Create or import an Ethereum-compatible wallet. Keys are generated locally and stored in your browser only.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={handleCreate} disabled={creating} style={btnPrimary(creating)}>
            {creating ? (<div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#52525B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />) : (<PlusIcon size={16} />)}
            {creating ? 'Generating Keypair...' : 'Create New Wallet'}
          </button>
          <button onClick={() => setView("import-mnemonic")} style={btnSecondary}>
            <FileTextIcon size={15} /> Import Seed Phrase
          </button>
          <button onClick={() => setView("import-pk")} style={btnSecondary}>
            <KeyIcon size={15} /> Import Private Key
          </button>
        </div>
        <WalletDisclaimerBlock />
      </div>
    );
  }

  // ── Import views ──
  if (view === "import-mnemonic" || view === "import-pk") {
    const isMnemonicView = view === "import-mnemonic";
    return (
      <div style={{ padding: isMobile ? '24px 20px 48px' : '48px 40px', maxWidth: 480, margin: "0 auto" }}>
        <AlphaWarningBanner />
        <button onClick={() => { setView("none"); setImportInput(""); setImportError(""); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: "none", border: "none", color: "#A1A1AA",
            cursor: "pointer", marginBottom: 24, fontSize: 13,
            padding: 0, transition: 'color 0.2s ease', letterSpacing: '-0.01em', fontWeight: 500,
          }}>
          <ArrowLeftIcon size={14} /> Back
        </button>
        <h2 style={{ fontSize: isMobile ? 22 : 24, fontWeight: 700, color: "#FAFAFA", marginBottom: 6, letterSpacing: '-0.03em' }}>
          {isMnemonicView ? "Import Seed Phrase" : "Import Private Key"}
        </h2>
        <p style={{ fontSize: 14, color: "#A1A1AA", marginBottom: 16, letterSpacing: '-0.01em', lineHeight: 1.6 }}>
          {isMnemonicView ? "Enter your 12 or 24 word seed phrase." : "Enter your private key (with or without 0x prefix)."}
        </p>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: '10px 14px', marginBottom: 16,
          backgroundColor: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.08)', borderRadius: 10,
        }}>
          <AlertIcon size={12} />
          <p style={{ fontSize: 12, color: '#FCA5A5', lineHeight: 1.6, letterSpacing: '-0.01em' }}>
            Only import keys on a device you trust. Vaultfire Protocol is not responsible for funds lost due to compromised keys.
          </p>
        </div>
        <textarea value={importInput} onChange={(e) => setImportInput(e.target.value)}
          placeholder={isMnemonicView ? "word1 word2 word3 ..." : "0x..."}
          rows={isMnemonicView ? 3 : 2}
          style={{
            width: "100%", padding: "12px 14px",
            background: '#0F0F12',
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10, color: "#FAFAFA", fontSize: 13,
            resize: "none", fontFamily: "'JetBrains Mono', monospace",
            outline: "none", boxSizing: "border-box",
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease', letterSpacing: '0.01em',
            lineHeight: 1.6,
          }}
        />
        {importError && <p style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}>{importError}</p>}
        <button
          onClick={isMnemonicView ? handleImportMnemonic : handleImportPK}
          disabled={importInput.trim().length === 0 || importing}
          style={{
            ...btnPrimary(importInput.trim().length === 0 || importing),
            marginTop: 12,
          }}>
          {importing ? 'Importing...' : 'Import Wallet'}
        </button>
        <WalletDisclaimerBlock />
      </div>
    );
  }

  // ── Wallet created view ──
  return (
    <div style={{ padding: isMobile ? '24px 20px 48px' : '48px 40px', maxWidth: 580, margin: "0 auto" }}>
      <AlphaWarningBanner />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, gap: 8,
      }}>
        <h1 style={{ fontSize: isMobile ? 24 : 26, fontWeight: 700, color: "#FAFAFA", letterSpacing: '-0.03em' }}>My Wallet</h1>
        <button onClick={handleDelete} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: "#EF4444", background: "none",
          border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8,
          padding: "6px 12px", cursor: "pointer",
          transition: 'all 0.2s ease', fontWeight: 500,
        }}>
          <TrashIcon size={11} /> Delete
        </button>
      </div>

      {/* Address Card */}
      <div style={{
        background: '#0F0F12', border: "1px solid rgba(255,255,255,0.04)",
        borderRadius: 12, padding: isMobile ? '16px' : '18px 20px', marginBottom: 8,
      }}>
        <p style={{ fontSize: 10, color: "#52525B", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>Wallet Address</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <code style={{
            flex: 1, fontSize: isMobile ? 11 : 12, color: "#FAFAFA",
            wordBreak: "break-all", fontFamily: "'JetBrains Mono', monospace",
            overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.5,
          }}>{walletData?.address}</code>
          <button onClick={() => copyToClipboard(walletData?.address || "", "address")}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: "6px 12px",
              backgroundColor: copied === "address" ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
              border: "1px solid " + (copied === "address" ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)"),
              borderRadius: 8,
              color: copied === "address" ? "#22C55E" : "#A1A1AA",
              fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
              transition: 'all 0.2s ease', fontWeight: 500,
            }}>
            {copied === "address" ? <><CheckIcon size={11} /> Copied</> : <><CopyIcon size={11} /> Copy</>}
          </button>
        </div>
      </div>

      {/* Balances Card */}
      <div style={{
        background: '#0F0F12', border: "1px solid rgba(255,255,255,0.04)",
        borderRadius: 12, padding: isMobile ? '16px' : '18px 20px', marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>Balances</p>
          <button onClick={() => walletData && loadBalances(walletData.address)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: "#F97316", background: "none",
            border: "none", cursor: "pointer", fontWeight: 500,
            transition: 'opacity 0.2s ease',
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
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: isMobile ? "10px 12px" : "10px 14px",
                backgroundColor: "rgba(255,255,255,0.02)",
                borderRadius: 10, gap: 8,
                border: '1px solid rgba(255,255,255,0.03)',
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    backgroundColor: bal.color, flexShrink: 0,
                    boxShadow: `0 0 8px ${bal.color}30`,
                  }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#FAFAFA", letterSpacing: '-0.01em' }}>{bal.chain}</p>
                    <p style={{ fontSize: 11, color: "#52525B" }}>Chain {bal.chainId}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{
                    fontSize: isMobile ? 13 : 14, fontWeight: 600, color: "#FAFAFA",
                    fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.01em',
                  }}>{bal.balanceFormatted}</p>
                  <p style={{ fontSize: 11, color: "#52525B" }}>{bal.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seed Phrase Card */}
      {walletData?.mnemonic && (
        <div style={{
          background: '#0F0F12', border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: 12, padding: isMobile ? '16px' : '18px 20px', marginBottom: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 10, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>Recovery Phrase</p>
            <button onClick={() => setShowMnemonic(!showMnemonic)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: "#F97316", background: "none",
              border: "none", cursor: "pointer", fontWeight: 500,
            }}>
              {showMnemonic ? <><EyeOffIcon size={12} /> Hide</> : <><EyeIcon size={12} /> Reveal</>}
            </button>
          </div>
          {showMnemonic ? (
            <div>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
                gap: 4, marginBottom: 10,
              }}>
                {walletData.mnemonic.split(" ").map((word, i) => (
                  <div key={i} style={{
                    padding: "6px 10px",
                    backgroundColor: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    borderRadius: 8, fontSize: isMobile ? 11 : 12,
                    color: "#FAFAFA", fontFamily: "'JetBrains Mono', monospace",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    <span style={{ color: "#52525B", marginRight: 5, fontSize: 10 }}>{i + 1}.</span>{word}
                  </div>
                ))}
              </div>
              <button onClick={() => copyToClipboard(walletData.mnemonic, "mnemonic")}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  width: "100%", padding: "8px",
                  backgroundColor: copied === "mnemonic" ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
                  border: "1px solid " + (copied === "mnemonic" ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)"),
                  borderRadius: 8,
                  color: copied === "mnemonic" ? "#22C55E" : "#A1A1AA",
                  fontSize: 11, cursor: "pointer",
                  transition: 'all 0.2s ease', fontWeight: 500,
                }}>
                {copied === "mnemonic" ? <><CheckIcon size={11} /> Copied</> : <><CopyIcon size={11} /> Copy Seed Phrase</>}
              </button>
            </div>
          ) : (
            <div style={{ padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 10 }}>
              <p style={{ fontSize: 13, color: "#52525B", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.2em" }}>---- ---- ---- ---- ---- ----</p>
            </div>
          )}
        </div>
      )}

      <WalletDisclaimerBlock />
    </div>
  );
}
