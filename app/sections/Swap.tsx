"use client";
/**
 * Swap — In-app DEX swap using ParaSwap API.
 * Executes through the user's browser wallet (window.ethereum).
 * Supports ETH, AVAX, USDC on Base, Avalanche, Ethereum.
 */
import { useState, useEffect, useCallback } from "react";
import { useWalletAuth } from "../lib/WalletAuthContext";
import { showToast } from "../components/Toast";
import { AlphaBanner } from "../components/DisclaimerBanner";

type ChainKey = "ethereum" | "base" | "avalanche";

const CHAIN_CONFIG: Record<ChainKey, { label: string; chainId: number; color: string; nativeSymbol: string }> = {
  ethereum: { label: "Ethereum", chainId: 1, color: "#627EEA", nativeSymbol: "ETH" },
  base: { label: "Base", chainId: 8453, color: "#0052FF", nativeSymbol: "ETH" },
  avalanche: { label: "Avalanche", chainId: 43114, color: "#E84142", nativeSymbol: "AVAX" },
};

const TOKENS_BY_CHAIN: Record<ChainKey, string[]> = {
  ethereum: ["ETH", "USDC", "USDT", "WETH"],
  base: ["ETH", "USDC", "USDbC", "WETH"],
  avalanche: ["AVAX", "USDC", "USDC.e", "WAVAX"],
};

interface QuoteResult {
  success: boolean;
  from: { symbol: string; amount: string; amountRaw: string };
  to: { symbol: string; amount: string; amountRaw: string };
  rate: string;
  gasCostUSD: string | null;
  priceRoute: Record<string, unknown>;
  source: string;
  error?: string;
}

function SwapIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <div style={{
      width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)",
      borderTopColor: "#F97316", borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
  );
}

export default function Swap() {
  const { isUnlocked, address } = useWalletAuth();
  const [chain, setChain] = useState<ChainKey>("base");
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("USDC");
  const [amount, setAmount] = useState("0.01");
  const [slippage, setSlippage] = useState(0.5);
  const [showSlippage, setShowSlippage] = useState(false);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Update tokens when chain changes
  useEffect(() => {
    const tokens = TOKENS_BY_CHAIN[chain];
    setFromToken(tokens[0]);
    setToToken(tokens[1]);
    setQuote(null);
    setTxHash(null);
  }, [chain]);

  const fetchQuote = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    setQuote(null);
    try {
      const params = new URLSearchParams({
        chain,
        from: fromToken,
        to: toToken,
        amount,
        userAddress: address || "0x0000000000000000000000000000000000000000",
        slippage: slippage.toString(),
      });
      const res = await fetch(`/api/swap/quote?${params}`);
      const data = await res.json();
      setQuote(data);
    } catch (e) {
      setQuote({ success: false, error: e instanceof Error ? e.message : "Failed to fetch quote" } as QuoteResult);
    }
    setLoading(false);
  }, [chain, fromToken, toToken, amount, address, slippage]);

  // Auto-fetch quote when inputs change (debounced)
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) return;
    const timer = setTimeout(fetchQuote, 800);
    return () => clearTimeout(timer);
  }, [fetchQuote, amount]);

  const flipTokens = () => {
    const tmp = fromToken;
    setFromToken(toToken);
    setToToken(tmp);
    setQuote(null);
  };

  const executeSwap = async () => {
    if (!quote?.success || !quote.priceRoute || !address) return;
    if (!window.ethereum) {
      showToast("No wallet detected. Please install MetaMask or another Web3 wallet.", "warning");
      return;
    }

    setExecuting(true);
    setTxHash(null);
    try {
      // Ensure correct chain
      const chainId = CHAIN_CONFIG[chain].chainId;
      const currentChainHex = await window.ethereum.request({ method: "eth_chainId" });
      const currentChainId = parseInt(currentChainHex as string, 16);
      if (currentChainId !== chainId) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x" + chainId.toString(16) }],
          });
        } catch {
          showToast(`Please switch to ${CHAIN_CONFIG[chain].label} in your wallet`, "warning");
          setExecuting(false);
          return;
        }
      }

      // Get transaction data from API
      const txRes = await fetch("/api/swap/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          from: fromToken,
          to: toToken,
          amount,
          userAddress: address,
          slippage,
          priceRoute: quote.priceRoute,
        }),
      });
      const txData = await txRes.json();

      if (!txData.success || !txData.tx) {
        showToast(txData.error || "Failed to build transaction", "warning");
        setExecuting(false);
        return;
      }

      // Send transaction through user's wallet
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const hash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: (accounts as string[])[0],
          to: txData.tx.to,
          data: txData.tx.data,
          value: txData.tx.value === "0" ? "0x0" : "0x" + BigInt(txData.tx.value).toString(16),
          gas: "0x" + parseInt(txData.tx.gasLimit).toString(16),
        }],
      });

      setTxHash(hash as string);
      showToast("Swap transaction submitted!", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Swap failed";
      if (msg.includes("rejected") || msg.includes("denied")) {
        showToast("Transaction rejected by user", "info");
      } else {
        showToast(`Swap failed: ${msg}`, "warning");
      }
    }
    setExecuting(false);
  };

  const explorerUrl = chain === "base" ? "https://basescan.org" : chain === "avalanche" ? "https://snowtrace.io" : "https://etherscan.io";
  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div className="page-enter" style={{ padding: isMobile ? "24px 16px 48px" : "40px 40px 48px", maxWidth: 560, margin: "0 auto" }}>
      <AlphaBanner />

      <div style={{ marginBottom: 32, paddingLeft: isMobile ? 48 : 0 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color: "#F4F4F5", letterSpacing: "-0.03em" }}>
          Swap
        </h1>
        <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>
          In-app DEX swap powered by ParaSwap — real quotes, real execution
        </p>
      </div>

      {/* Chain Selector */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 24, padding: 4, borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      }}>
        {(Object.keys(CHAIN_CONFIG) as ChainKey[]).map(c => (
          <button key={c} onClick={() => setChain(c)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600,
            backgroundColor: chain === c ? `${CHAIN_CONFIG[c].color}18` : "transparent",
            color: chain === c ? CHAIN_CONFIG[c].color : "#71717A",
            transition: "all 0.2s ease",
          }}>
            {CHAIN_CONFIG[c].label}
          </button>
        ))}
      </div>

      {/* Swap Card */}
      <div style={{
        borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)",
        backgroundColor: "rgba(255,255,255,0.02)", padding: isMobile ? 16 : 24,
      }}>
        {/* From */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>You Pay</label>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <input
              type="number" step="any" min="0" value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.0"
              style={{
                flex: 1, padding: "14px 16px", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                color: "#F4F4F5", fontSize: 18, fontWeight: 600, outline: "none", ...mono,
              }}
            />
            <select value={fromToken} onChange={e => { setFromToken(e.target.value); setQuote(null); }} style={{
              padding: "14px 16px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
              color: "#F4F4F5", fontSize: 14, fontWeight: 600, outline: "none", cursor: "pointer",
            }}>
              {TOKENS_BY_CHAIN[chain].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Flip Button */}
        <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
          <button onClick={flipTokens} style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#71717A", transition: "all 0.2s ease",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.12)"; e.currentTarget.style.color = "#F97316"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#71717A"; }}
          >
            <SwapIcon size={16} />
          </button>
        </div>

        {/* To */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>You Receive</label>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <div style={{
              flex: 1, padding: "14px 16px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)",
              color: quote?.success ? "#F4F4F5" : "#52525B",
              fontSize: 18, fontWeight: 600, ...mono,
              display: "flex", alignItems: "center",
            }}>
              {loading ? <LoadingSpinner /> : quote?.success ? quote.to.amount : "—"}
            </div>
            <select value={toToken} onChange={e => { setToToken(e.target.value); setQuote(null); }} style={{
              padding: "14px 16px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
              color: "#F4F4F5", fontSize: 14, fontWeight: 600, outline: "none", cursor: "pointer",
            }}>
              {TOKENS_BY_CHAIN[chain].filter(t => t !== fromToken).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Quote Details */}
        {quote?.success && (
          <div style={{
            padding: "12px 16px", borderRadius: 10, marginBottom: 16,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#71717A" }}>Rate</span>
              <span style={{ fontSize: 12, color: "#A1A1AA", ...mono }}>1 {fromToken} = {quote.rate} {toToken}</span>
            </div>
            {quote.gasCostUSD && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#71717A" }}>Est. Gas</span>
                <span style={{ fontSize: 12, color: "#A1A1AA", ...mono }}>${quote.gasCostUSD}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#71717A" }}>Slippage</span>
              <span style={{ fontSize: 12, color: "#A1A1AA", ...mono }}>{slippage}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#71717A" }}>Source</span>
              <span style={{ fontSize: 12, color: "#F97316", fontWeight: 600 }}>{quote.source}</span>
            </div>
          </div>
        )}

        {quote && !quote.success && quote.error && (
          <div style={{
            padding: "12px 16px", borderRadius: 10, marginBottom: 16,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
            fontSize: 12, color: "#EF4444",
          }}>
            {quote.error}
          </div>
        )}

        {/* Slippage Settings */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowSlippage(!showSlippage)} style={{
            fontSize: 11, color: "#52525B", background: "none", border: "none",
            cursor: "pointer", padding: 0, textDecoration: "underline",
          }}>
            {showSlippage ? "Hide" : "Show"} slippage settings
          </button>
          {showSlippage && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {[0.1, 0.5, 1.0, 3.0].map(s => (
                <button key={s} onClick={() => setSlippage(s)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  background: slippage === s ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                  color: slippage === s ? "#F97316" : "#71717A",
                }}>
                  {s}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Execute Button */}
        {!isUnlocked ? (
          <div style={{
            padding: "14px 0", borderRadius: 12, textAlign: "center",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
            fontSize: 13, color: "#71717A",
          }}>
            Connect your wallet to swap
          </div>
        ) : (
          <button
            onClick={executeSwap}
            disabled={!quote?.success || executing || loading}
            style={{
              width: "100%", padding: "16px 0", borderRadius: 12, border: "none",
              cursor: (!quote?.success || executing) ? "not-allowed" : "pointer",
              background: executing ? "#52525B" : "#F97316",
              color: "#fff", fontSize: 15, fontWeight: 700,
              opacity: (!quote?.success || executing) ? 0.5 : 1,
              transition: "all 0.2s ease",
            }}
          >
            {executing ? "Confirming in Wallet..." : loading ? "Getting Quote..." : quote?.success ? `Swap ${fromToken} → ${toToken}` : "Enter amount"}
          </button>
        )}

        {/* Transaction Result */}
        {txHash && (
          <div style={{
            marginTop: 16, padding: "12px 16px", borderRadius: 10,
            background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#22C55E", marginBottom: 4 }}>Transaction Submitted</div>
            <a
              href={`${explorerUrl}/tx/${txHash}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: "#F97316", ...mono, wordBreak: "break-all" }}
            >
              {txHash.slice(0, 20)}...{txHash.slice(-12)}
            </a>
          </div>
        )}
      </div>

      {/* Info */}
      <p style={{ fontSize: 12, color: "#3F3F46", lineHeight: 1.8, marginTop: 24 }}>
        Swaps execute through your connected browser wallet (MetaMask, Rabby, etc.) using ParaSwap aggregation.
        Vaultfire never holds your funds. Always verify transaction details in your wallet before confirming.
      </p>
    </div>
  );
}

