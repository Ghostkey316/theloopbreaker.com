"use client";
import { useEffect, useState } from "react";
import { createWallet, importFromMnemonic, importFromPrivateKey, deleteWallet, isWalletCreated, getWalletAddress, getWalletMnemonic, type WalletData } from "../lib/wallet";
import { getAllBalances, type ChainBalance } from "../lib/blockchain";

type WalletView = "none" | "created" | "import-mnemonic" | "import-pk";

export default function Wallet() {
  const [view, setView] = useState<WalletView>("none");
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [loadingBals, setLoadingBals] = useState(false);
  const [importInput, setImportInput] = useState("");
  const [importError, setImportError] = useState("");
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [copied, setCopied] = useState("");

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

  if (view === "none") {
    return (
      <div style={{ padding: 32, maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💼</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#ECEDEE", marginBottom: 8 }}>Vaultfire Wallet</h1>
          <p style={{ fontSize: 14, color: "#9BA1A6", lineHeight: 1.6 }}>Create or import an Ethereum-compatible wallet. Keys stored locally in your browser.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button onClick={handleCreate} style={{ padding: "14px 24px", backgroundColor: "#FF6B35", border: "none", borderRadius: 12, color: "#0A0A0C", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>✨ Create New Wallet</button>
          <button onClick={() => setView("import-mnemonic")} style={{ padding: "14px 24px", backgroundColor: "#1A1A1E", border: "1px solid #2A2A2E", borderRadius: 12, color: "#ECEDEE", fontSize: 15, cursor: "pointer" }}>📝 Import Seed Phrase</button>
          <button onClick={() => setView("import-pk")} style={{ padding: "14px 24px", backgroundColor: "#1A1A1E", border: "1px solid #2A2A2E", borderRadius: 12, color: "#ECEDEE", fontSize: 15, cursor: "pointer" }}>🔑 Import Private Key</button>
        </div>
        <div style={{ marginTop: 24, padding: 14, backgroundColor: "#F59E0B10", border: "1px solid #F59E0B30", borderRadius: 10 }}>
          <p style={{ fontSize: 12, color: "#F59E0B", lineHeight: 1.6 }}>⚠️ Browser-based wallet for demo purposes. Do not store significant funds.</p>
        </div>
      </div>
    );
  }

  if (view === "import-mnemonic" || view === "import-pk") {
    const isMnemonic = view === "import-mnemonic";
    return (
      <div style={{ padding: 32, maxWidth: 480, margin: "0 auto" }}>
        <button onClick={() => { setView("none"); setImportInput(""); setImportError(""); }} style={{ background: "none", border: "none", color: "#9BA1A6", cursor: "pointer", marginBottom: 24, fontSize: 14 }}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#ECEDEE", marginBottom: 8 }}>{isMnemonic ? "Import Seed Phrase" : "Import Private Key"}</h2>
        <p style={{ fontSize: 13, color: "#9BA1A6", marginBottom: 20 }}>{isMnemonic ? "Enter your 12 or 24 word seed phrase." : "Enter your private key (with or without 0x prefix)."}</p>
        <textarea value={importInput} onChange={(e) => setImportInput(e.target.value)} placeholder={isMnemonic ? "word1 word2 word3 ..." : "0x..."} rows={isMnemonic ? 4 : 2}
          style={{ width: "100%", padding: "12px 14px", backgroundColor: "#1A1A1E", border: "1px solid #2A2A2E", borderRadius: 10, color: "#ECEDEE", fontSize: 13, resize: "none", fontFamily: "monospace", outline: "none", boxSizing: "border-box" }} />
        {importError && <p style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}>{importError}</p>}
        <button
          onClick={isMnemonic ? handleImportMnemonic : handleImportPK}
          disabled={importInput.trim().length === 0}
          style={{ marginTop: 16, width: "100%", padding: "14px", backgroundColor: importInput.trim() ? "#FF6B35" : "#2A2A2E", border: "none", borderRadius: 12, color: importInput.trim() ? "#0A0A0C" : "#9BA1A6", fontSize: 15, fontWeight: 600, cursor: importInput.trim() ? "pointer" : "default" }}>
          Import Wallet
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#ECEDEE" }}>My Wallet</h1>
        <button onClick={handleDelete} style={{ fontSize: 12, color: "#EF4444", background: "none", border: "1px solid #EF444440", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Delete Wallet</button>
      </div>
      <div style={{ backgroundColor: "#1A1A1E", border: "1px solid #2A2A2E", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: "#9BA1A6", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Address</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <code style={{ flex: 1, fontSize: 13, color: "#ECEDEE", wordBreak: "break-all", fontFamily: "monospace" }}>{walletData?.address}</code>
          <button onClick={() => copyToClipboard(walletData?.address || "", "address")}
            style={{ flexShrink: 0, padding: "6px 12px", backgroundColor: copied === "address" ? "#22C55E20" : "#2A2A2E", border: "none", borderRadius: 8, color: copied === "address" ? "#22C55E" : "#9BA1A6", fontSize: 12, cursor: "pointer" }}>
            {copied === "address" ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>
      <div style={{ backgroundColor: "#1A1A1E", border: "1px solid #2A2A2E", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontSize: 11, color: "#9BA1A6", textTransform: "uppercase", letterSpacing: "0.05em" }}>Balances</p>
          <button onClick={() => walletData && loadBalances(walletData.address)} style={{ fontSize: 12, color: "#FF6B35", background: "none", border: "none", cursor: "pointer" }}>{loadingBals ? "Loading..." : "↻ Refresh"}</button>
        </div>
        {loadingBals ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0,1,2].map(i => <div key={i} className="shimmer" style={{ height: 44, borderRadius: 8 }} />)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {balances.map((bal) => (
              <div key={bal.chain} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#0A0A0C", borderRadius: 10, border: "1px solid #2A2A2E" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: bal.color }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#ECEDEE" }}>{bal.chain}</p>
                    <p style={{ fontSize: 11, color: "#9BA1A6" }}>Chain {bal.chainId}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#ECEDEE", fontFamily: "monospace" }}>{bal.balanceFormatted}</p>
                  <p style={{ fontSize: 11, color: "#9BA1A6" }}>{bal.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {walletData?.mnemonic && (
        <div style={{ backgroundColor: "#1A1A1E", border: "1px solid #2A2A2E", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: "#9BA1A6", textTransform: "uppercase", letterSpacing: "0.05em" }}>Seed Phrase</p>
            <button onClick={() => setShowMnemonic(!showMnemonic)} style={{ fontSize: 12, color: "#FF6B35", background: "none", border: "none", cursor: "pointer" }}>{showMnemonic ? "Hide" : "Reveal"}</button>
          </div>
          {showMnemonic ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10 }}>
                {walletData.mnemonic.split(" ").map((word, i) => (
                  <div key={i} style={{ padding: "6px 10px", backgroundColor: "#0A0A0C", border: "1px solid #2A2A2E", borderRadius: 6, fontSize: 12, color: "#ECEDEE", fontFamily: "monospace" }}>
                    <span style={{ color: "#9BA1A6", marginRight: 6 }}>{i + 1}.</span>{word}
                  </div>
                ))}
              </div>
              <button onClick={() => copyToClipboard(walletData.mnemonic, "mnemonic")}
                style={{ width: "100%", padding: "8px", backgroundColor: copied === "mnemonic" ? "#22C55E20" : "#2A2A2E", border: "none", borderRadius: 8, color: copied === "mnemonic" ? "#22C55E" : "#9BA1A6", fontSize: 12, cursor: "pointer" }}>
                {copied === "mnemonic" ? "✓ Copied" : "Copy Seed Phrase"}
              </button>
            </div>
          ) : (
            <div style={{ padding: "12px 14px", backgroundColor: "#0A0A0C", borderRadius: 8, border: "1px solid #2A2A2E" }}>
              <p style={{ fontSize: 13, color: "#9BA1A6", fontFamily: "monospace", letterSpacing: "0.2em" }}>•••• •••• •••• •••• •••• ••••</p>
            </div>
          )}
        </div>
      )}
      <div style={{ padding: 14, backgroundColor: "#F59E0B10", border: "1px solid #F59E0B30", borderRadius: 10 }}>
        <p style={{ fontSize: 12, color: "#F59E0B", lineHeight: 1.6 }}>⚠️ Never share your seed phrase or private key. Store them securely offline.</p>
      </div>
    </div>
  );
}
