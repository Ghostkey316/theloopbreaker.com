"use client";
/**
 * Bridge — Real cross-chain bridge using VaultfireTeleporterBridge (Base/Avalanche)
 * and TrustDataBridge (Ethereum). Executes through user's wallet.
 */
import { useEffect, useState, useCallback } from "react";
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, ETHEREUM_CONTRACTS, CHAINS } from "../lib/contracts";
import { getTeleporterBridgeStats, checkChainConnectivity, type BridgeStats, type RPCResult } from "../lib/blockchain";
import { getBridgeAddress, encodeSendTrustTier } from "../lib/onchain-reader";
import { useWalletAuth } from "../lib/WalletAuthContext";
import { showToast } from "../components/Toast";
import { AlphaBanner } from "../components/DisclaimerBanner";

const BASE_BRIDGE = BASE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge");
const AVAX_BRIDGE = AVALANCHE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge");
const ETH_BRIDGE = ETHEREUM_CONTRACTS.find((c) => c.name === "TrustDataBridge");

function SwapIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>);
}
function ShieldIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
}
function ExternalIcon({ size = 10 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>);
}

type ChainKey = "ethereum" | "base" | "avalanche";

const CHAIN_INFO: { key: ChainKey; label: string; chainId: number; color: string }[] = [
  { key: "ethereum", label: "Ethereum", chainId: 1, color: "#627EEA" },
  { key: "base", label: "Base", chainId: 8453, color: "#0052FF" },
  { key: "avalanche", label: "Avalanche", chainId: 43114, color: "#E84142" },
];

const TRUST_DATA_TYPES = [
  { key: "trustTier", label: "Trust Tier", desc: "Send your trust tier score to another chain", value: "0" },
  { key: "vnsIdentity", label: "VNS Identity", desc: "Bridge your VNS name registration", value: "1" },
  { key: "zkAttestation", label: "ZK Attestation", desc: "Bridge zero-knowledge attestation proof", value: "2" },
];

export default function Bridge() {
  const { isUnlocked, address } = useWalletAuth();
  const [baseBridge, setBaseBridge] = useState<BridgeStats | null>(null);
  const [avaxBridge, setAvaxBridge] = useState<BridgeStats | null>(null);
  const [baseChain, setBaseChain] = useState<RPCResult | null>(null);
  const [avaxChain, setAvaxChain] = useState<RPCResult | null>(null);
  const [ethChain, setEthChain] = useState<RPCResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"bridge" | "status">("bridge");
  const [sourceChain, setSourceChain] = useState<ChainKey>("base");
  const [destChain, setDestChain] = useState<ChainKey>("avalanche");
  const [selectedDataType, setSelectedDataType] = useState("trustTier");
  const [bridging, setBridging] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [baseRpc, avaxRpc, ethRpc] = await Promise.all([
      checkChainConnectivity("base"),
      checkChainConnectivity("avalanche"),
      checkChainConnectivity("ethereum"),
    ]);
    setBaseChain(baseRpc);
    setAvaxChain(avaxRpc);
    setEthChain(ethRpc);

    const [baseBridgeResult, avaxBridgeResult] = await Promise.all([
      BASE_BRIDGE ? getTeleporterBridgeStats("base", BASE_BRIDGE.address) : Promise.resolve(null),
      AVAX_BRIDGE ? getTeleporterBridgeStats("avalanche", AVAX_BRIDGE.address) : Promise.resolve(null),
    ]);
    if (baseBridgeResult) setBaseBridge(baseBridgeResult);
    if (avaxBridgeResult) setAvaxBridge(avaxBridgeResult);
    setLoading(false);
  };

  const swapChains = () => {
    setSourceChain(destChain);
    setDestChain(sourceChain);
  };

  const chainStatus = (key: ChainKey) => {
    if (key === "base") return baseChain?.success;
    if (key === "avalanche") return avaxChain?.success;
    return ethChain?.success;
  };

  const executeBridge = useCallback(async () => {
    if (!isUnlocked || !address) {
      showToast("Connect your wallet first", "warning");
      return;
    }
    if (!window.ethereum) {
      showToast("No wallet detected. Install MetaMask or another Web3 wallet.", "warning");
      return;
    }
    if (sourceChain === destChain) {
      showToast("Source and destination chains must be different", "warning");
      return;
    }

    setBridging(true);
    setTxHash(null);

    try {
      // Switch to source chain
      const sourceChainId = CHAIN_INFO.find(c => c.key === sourceChain)!.chainId;
      const destChainId = CHAIN_INFO.find(c => c.key === destChain)!.chainId;
      const currentChainHex = await window.ethereum.request({ method: "eth_chainId" });
      const currentChainId = parseInt(currentChainHex as string, 16);

      if (currentChainId !== sourceChainId) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x" + sourceChainId.toString(16) }],
          });
        } catch {
          showToast(`Please switch to ${sourceChain} in your wallet`, "warning");
          setBridging(false);
          return;
        }
      }

      // Get bridge contract address
      const bridgeAddr = getBridgeAddress(sourceChain);
      if (!bridgeAddr) {
        showToast("Bridge contract not found for this chain", "warning");
        setBridging(false);
        return;
      }

      // Encode the bridge call
      const tierValue = parseInt(TRUST_DATA_TYPES.find(t => t.key === selectedDataType)?.value || "0");
      const callData = encodeSendTrustTier(destChainId, address, tierValue);

      // Send transaction through wallet
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const hash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: (accounts as string[])[0],
          to: bridgeAddr,
          data: callData,
          value: "0x0",
          gas: "0x" + (200000).toString(16),
        }],
      });

      setTxHash(hash as string);
      showToast("Bridge transaction submitted! Trust data is being synced.", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bridge failed";
      if (msg.includes("rejected") || msg.includes("denied")) {
        showToast("Transaction rejected by user", "info");
      } else {
        showToast(`Bridge failed: ${msg}`, "warning");
      }
    }
    setBridging(false);
  }, [isUnlocked, address, sourceChain, destChain, selectedDataType]);

  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
  const px = isMobile ? 16 : 40;
  const explorerUrl = sourceChain === "base" ? "https://basescan.org" : sourceChain === "avalanche" ? "https://snowtrace.io" : "https://etherscan.io";

  return (
    <div className="page-enter" style={{ padding: `${isMobile ? 24 : 40}px ${px}px 48px`, maxWidth: 720, margin: "0 auto" }}>
      <AlphaBanner />

      <div style={{ marginBottom: 32, paddingLeft: isMobile ? 48 : 0 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color: "#F4F4F5", letterSpacing: "-0.03em" }}>Bridge</h1>
        <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>Cross-chain trust data synchronisation — real contract calls</p>
      </div>

      {/* Tab Selector */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 32, padding: 4, borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      }}>
        {[
          { key: "bridge" as const, label: "Bridge Trust Data" },
          { key: "status" as const, label: "Network Status" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600,
            backgroundColor: activeTab === tab.key ? "rgba(249,115,22,0.12)" : "transparent",
            color: activeTab === tab.key ? "#F97316" : "#71717A",
            transition: "all 0.2s ease",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ BRIDGE TAB ═══ */}
      {activeTab === "bridge" && (
        <div>
          {/* Deployment Banner */}
          <div style={{
            padding: "14px 18px", borderRadius: 12,
            backgroundColor: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)",
            marginBottom: 24, display: "flex", alignItems: "center", gap: 12,
          }}>
            <ShieldIcon size={16} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#22C55E" }}>Live Contracts</p>
              <p style={{ fontSize: 12, color: "#A1A1AA", marginTop: 2 }}>
                VaultfireTeleporterBridge on Base &amp; Avalanche. TrustDataBridge on Ethereum.
              </p>
            </div>
          </div>

          {/* Chain Selection */}
          <div style={{
            borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)",
            backgroundColor: "rgba(255,255,255,0.02)", padding: isMobile ? 16 : 24, marginBottom: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
              {/* Source Chain */}
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>From</label>
                <select value={sourceChain} onChange={e => setSourceChain(e.target.value as ChainKey)} style={{
                  width: "100%", marginTop: 8, padding: "12px 14px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                  color: "#F4F4F5", fontSize: 14, fontWeight: 600, outline: "none", cursor: "pointer",
                }}>
                  {CHAIN_INFO.map(c => (
                    <option key={c.key} value={c.key}>{c.label} ({c.chainId})</option>
                  ))}
                </select>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: chainStatus(sourceChain) ? "#22C55E" : "#EF4444" }} />
                  <span style={{ fontSize: 11, color: chainStatus(sourceChain) ? "#22C55E" : "#EF4444" }}>
                    {loading ? "..." : chainStatus(sourceChain) ? "Online" : "Offline"}
                  </span>
                </div>
              </div>

              {/* Swap Button */}
              <button onClick={swapChains} style={{
                width: 36, height: 36, borderRadius: "50%", marginTop: 16,
                border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "#71717A",
              }}>
                <SwapIcon size={14} />
              </button>

              {/* Dest Chain */}
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>To</label>
                <select value={destChain} onChange={e => setDestChain(e.target.value as ChainKey)} style={{
                  width: "100%", marginTop: 8, padding: "12px 14px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                  color: "#F4F4F5", fontSize: 14, fontWeight: 600, outline: "none", cursor: "pointer",
                }}>
                  {CHAIN_INFO.filter(c => c.key !== sourceChain).map(c => (
                    <option key={c.key} value={c.key}>{c.label} ({c.chainId})</option>
                  ))}
                </select>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: chainStatus(destChain) ? "#22C55E" : "#EF4444" }} />
                  <span style={{ fontSize: 11, color: chainStatus(destChain) ? "#22C55E" : "#EF4444" }}>
                    {loading ? "..." : chainStatus(destChain) ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            </div>

            {/* Data Type Selection */}
            <div style={{ marginTop: 20 }}>
              <label style={{ fontSize: 11, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, display: "block" }}>
                Trust Data to Bridge
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {TRUST_DATA_TYPES.map(dt => (
                  <button key={dt.key} onClick={() => setSelectedDataType(dt.key)} style={{
                    padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: selectedDataType === dt.key ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.03)",
                    borderLeft: selectedDataType === dt.key ? "3px solid #F97316" : "3px solid transparent",
                    textAlign: "left", transition: "all 0.15s ease",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: selectedDataType === dt.key ? "#F4F4F5" : "#A1A1AA" }}>{dt.label}</div>
                    <div style={{ fontSize: 11, color: "#52525B", marginTop: 2 }}>{dt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bridge Info */}
            <div style={{
              marginTop: 16, padding: "10px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.03)", fontSize: 12, color: "#52525B", lineHeight: 1.6,
            }}>
              Bridge contract: <code style={{ color: "#71717A", ...mono, fontSize: 11 }}>
                {sourceChain === "ethereum"
                  ? ETH_BRIDGE?.address.slice(0, 14) + "..." + ETH_BRIDGE?.address.slice(-8)
                  : sourceChain === "base"
                    ? BASE_BRIDGE?.address.slice(0, 14) + "..." + BASE_BRIDGE?.address.slice(-8)
                    : AVAX_BRIDGE?.address.slice(0, 14) + "..." + AVAX_BRIDGE?.address.slice(-8)}
              </code>
              <br />
              Estimated time: ~2-5 minutes for Teleporter, ~15 minutes for Ethereum bridge
            </div>

            {/* Execute */}
            {!isUnlocked ? (
              <div style={{
                marginTop: 16, padding: "14px 0", borderRadius: 12, textAlign: "center",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 13, color: "#71717A",
              }}>
                Connect your wallet to bridge trust data
              </div>
            ) : (
              <button onClick={executeBridge} disabled={bridging || sourceChain === destChain} style={{
                width: "100%", marginTop: 16, padding: "14px 0", borderRadius: 12, border: "none",
                cursor: bridging ? "not-allowed" : "pointer",
                background: bridging ? "#52525B" : "#F97316",
                color: "#fff", fontSize: 14, fontWeight: 700,
                opacity: sourceChain === destChain ? 0.4 : 1,
                transition: "all 0.2s ease",
              }}>
                {bridging ? "Confirming in Wallet..." : `Bridge ${TRUST_DATA_TYPES.find(t => t.key === selectedDataType)?.label} → ${CHAIN_INFO.find(c => c.key === destChain)?.label}`}
              </button>
            )}

            {/* Tx Result */}
            {txHash && (
              <div style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 10,
                background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#22C55E", marginBottom: 4 }}>Bridge Transaction Submitted</div>
                <a href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#F97316", ...mono, wordBreak: "break-all" }}>
                  {txHash.slice(0, 20)}...{txHash.slice(-12)}
                </a>
                <p style={{ fontSize: 11, color: "#52525B", marginTop: 6 }}>
                  Trust data will be available on {CHAIN_INFO.find(c => c.key === destChain)?.label} after confirmation.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ STATUS TAB ═══ */}
      {activeTab === "status" && (
        <div>
          {/* Bridge Contracts Status */}
          <div style={{
            borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)",
            backgroundColor: "rgba(255,255,255,0.02)", overflow: "hidden",
          }}>
            {[
              { label: "Base Teleporter", chain: "base" as const, address: BASE_BRIDGE?.address, stats: baseBridge, chainResult: baseChain },
              { label: "Avalanche Teleporter", chain: "avalanche" as const, address: AVAX_BRIDGE?.address, stats: avaxBridge, chainResult: avaxChain },
              { label: "Ethereum TrustDataBridge", chain: "ethereum" as const, address: ETH_BRIDGE?.address, stats: null, chainResult: ethChain },
            ].map((item, i) => (
              <div key={item.chain} style={{
                padding: isMobile ? 16 : 24,
                borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.03)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: item.chainResult?.success ? "#22C55E" : "#3F3F46" }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#F4F4F5" }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: item.chainResult?.success ? "#22C55E" : "#3F3F46" }}>
                    {loading ? "..." : item.chainResult?.success ? "Online" : "Offline"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: isMobile ? 12 : 24 }}>
                  <div>
                    <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>Messages</p>
                    <p style={{ fontSize: 20, fontWeight: 600, color: "#F4F4F5", ...mono }}>
                      {loading ? "\u2014" : item.stats?.messageCount?.toLocaleString() ?? "N/A"}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>Status</p>
                    <p style={{ fontSize: 14, fontWeight: 500, color: item.stats?.paused ? "#EF4444" : "#22C55E" }}>
                      {loading ? "\u2014" : item.stats?.isAlive ? (item.stats.paused ? "Paused" : "Active") : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 500 }}>Latency</p>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "#A1A1AA", ...mono }}>
                      {loading ? "\u2014" : item.chainResult?.latency ? `${item.chainResult.latency}ms` : "N/A"}
                    </p>
                  </div>
                </div>

                {item.address && (
                  <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <code style={{ fontSize: 11, color: "#3F3F46", ...mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {isMobile ? `${item.address.slice(0, 14)}...${item.address.slice(-8)}` : item.address}
                    </code>
                    <a href={`${CHAINS[item.chain].explorerUrl}/address/${item.address}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", color: "#3F3F46", textDecoration: "none" }}>
                      <ExternalIcon size={10} />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, color: "#3F3F46", lineHeight: 1.8, marginTop: 32 }}>
            The Teleporter Bridge enables cross-chain trust data synchronisation between Base and Avalanche
            using Avalanche Warp Messaging (AWM). The TrustDataBridge handles Ethereum mainnet.
          </p>
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}
