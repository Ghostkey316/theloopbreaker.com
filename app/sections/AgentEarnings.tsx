"use client";
/**
 * AgentEarnings — Real agent earnings withdrawal via AIAccountabilityBondsV2.
 * Reads actual bond data from chain, shows real amounts, and executes
 * withdrawal/distribution through the user's wallet.
 */
import { useState, useEffect, useCallback } from "react";
import { useWalletAuth } from "../lib/WalletAuthContext";
import {
  getAccountabilityBonds,
  getPartnershipBonds,
  encodeRequestDistribution,
  encodeDistributeBond,
  type AccountabilityBondInfo,
  type BondInfo,
} from "../lib/onchain-reader";
import { ACCOUNTABILITY_BONDS, PARTNERSHIP_BONDS, EXPLORER_URLS, type SupportedChain } from "../lib/contracts";
import { BOND_TIERS, type BondTier, getBondTier } from "../lib/vns";
import { showToast } from "../components/Toast";
import { AlphaBanner } from "../components/DisclaimerBanner";

/* ── x402 Payment Record (matches x402-client.ts) ── */
interface X402PaymentRecord {
  id: string;
  timestamp: number;
  url: string;
  amount: string;
  amountFormatted: string;
  asset: string;
  network: string;
  payTo: string;
  from: string;
  txHash?: string;
  status: "signed" | "settled" | "failed";
  description?: string;
  recipientVNS?: string;
  senderVNS?: string;
}

interface EarningsTransaction {
  id: string;
  type: "earned" | "paid" | "withdrawn" | "bond_stake" | "bond_return" | "x402_payment";
  amount: string;
  currency: string;
  from: string;
  to: string;
  description: string;
  timestamp: number;
  txHash?: string;
  chain: SupportedChain;
  status: "confirmed" | "pending" | "failed";
}

function loadX402Payments(): X402PaymentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("vaultfire_x402_payments");
    if (!raw) return [];
    return JSON.parse(raw) as X402PaymentRecord[];
  } catch { return []; }
}

function x402ToEarnings(records: X402PaymentRecord[]): EarningsTransaction[] {
  return records.map((r) => ({
    id: r.id,
    type: "x402_payment" as const,
    amount: r.amountFormatted,
    currency: "USDC",
    from: r.from,
    to: r.payTo,
    description: r.description || `x402 payment to ${r.payTo.slice(0, 10)}...`,
    timestamp: r.timestamp,
    txHash: r.txHash,
    chain: "base" as const,
    status: r.status === "settled" ? "confirmed" as const : r.status === "failed" ? "failed" as const : "pending" as const,
  }));
}

function TxRow({ tx }: { tx: EarningsTransaction }) {
  const typeConfig: Record<string, { color: string; label: string; sign: string }> = {
    earned: { color: "#22C55E", label: "Earned", sign: "+" },
    paid: { color: "#EF4444", label: "Paid", sign: "-" },
    withdrawn: { color: "#F97316", label: "Withdrawn", sign: "-" },
    bond_stake: { color: "#7C3AED", label: "Bond Stake", sign: "-" },
    bond_return: { color: "#3B82F6", label: "Bond Return", sign: "+" },
    x402_payment: { color: "#3B82F6", label: "x402 Payment", sign: "-" },
  };
  const cfg = typeConfig[tx.type] || typeConfig.earned;
  const date = new Date(tx.timestamp);
  const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  const explorer = EXPLORER_URLS[tx.chain] || "https://basescan.org";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#F4F4F5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tx.description}
        </div>
        <div style={{ fontSize: 11, color: "#52525B", marginTop: 2 }}>
          {cfg.label} · {timeStr} · {tx.chain === "base" ? "Base" : tx.chain === "avalanche" ? "Avax" : "ETH"}
          {tx.status === "pending" && " · Pending"}
          {tx.status === "failed" && " · Failed"}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>
          {cfg.sign}{tx.amount} {tx.currency}
        </div>
        {tx.txHash && (
          <a href={`${explorer}/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 10, color: "#7C3AED", textDecoration: "none" }}>
            View Tx
          </a>
        )}
      </div>
    </div>
  );
}

export default function AgentEarnings() {
  const { isUnlocked, address } = useWalletAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "withdraw" | "history">("overview");
  const [withdrawing, setWithdrawing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<SupportedChain>("base");
  const [selectedBondId, setSelectedBondId] = useState<number | null>(null);

  // Real on-chain data
  const [accBonds, setAccBonds] = useState<Record<SupportedChain, AccountabilityBondInfo>>({
    base: { hasBond: false, bondCount: 0, totalStake: 0n, activeBonds: 0, bondIds: [], pendingDistributions: 0n },
    avalanche: { hasBond: false, bondCount: 0, totalStake: 0n, activeBonds: 0, bondIds: [], pendingDistributions: 0n },
    ethereum: { hasBond: false, bondCount: 0, totalStake: 0n, activeBonds: 0, bondIds: [], pendingDistributions: 0n },
  });
  const [partBonds, setPartBonds] = useState<Record<SupportedChain, BondInfo>>({
    base: { hasBond: false, bondCount: 0, totalStake: 0n, activeBonds: 0, bondIds: [] },
    avalanche: { hasBond: false, bondCount: 0, totalStake: 0n, activeBonds: 0, bondIds: [] },
    ethereum: { hasBond: false, bondCount: 0, totalStake: 0n, activeBonds: 0, bondIds: [] },
  });
  const [transactions, setTransactions] = useState<EarningsTransaction[]>([]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    // Load x402 payments
    const x402 = loadX402Payments();
    setTransactions(x402ToEarnings(x402));

    if (address) {
      const chains: SupportedChain[] = ["base", "avalanche", "ethereum"];
      const [accResults, partResults] = await Promise.all([
        Promise.all(chains.map(c => getAccountabilityBonds(c, address))),
        Promise.all(chains.map(c => getPartnershipBonds(c, address))),
      ]);

      const newAcc = {} as Record<SupportedChain, AccountabilityBondInfo>;
      const newPart = {} as Record<SupportedChain, BondInfo>;
      chains.forEach((c, i) => { newAcc[c] = accResults[i]; newPart[c] = partResults[i]; });
      setAccBonds(newAcc);
      setPartBonds(newPart);
    }
    setLoading(false);
  }, [address]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalAccStake = Object.values(accBonds).reduce((s, b) => s + b.totalStake, 0n);
  const totalPartStake = Object.values(partBonds).reduce((s, b) => s + b.totalStake, 0n);
  const totalActiveBonds = Object.values(accBonds).reduce((s, b) => s + b.activeBonds, 0);
  const totalBondCount = Object.values(accBonds).reduce((s, b) => s + b.bondCount, 0) + Object.values(partBonds).reduce((s, b) => s + b.bondCount, 0);
  const formatEth = (wei: bigint) => (Number(wei) / 1e18).toFixed(4);

  const executeWithdrawal = async (action: "request" | "distribute", bondId: number) => {
    if (!window.ethereum || !address) {
      showToast("Connect your wallet first", "warning");
      return;
    }

    setWithdrawing(true);
    setTxHash(null);

    try {
      const chainId = selectedChain === "base" ? 8453 : selectedChain === "avalanche" ? 43114 : 1;
      const currentChainHex = await window.ethereum.request({ method: "eth_chainId" });
      const currentChainId = parseInt(currentChainHex as string, 16);

      if (currentChainId !== chainId) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + chainId.toString(16) }],
        });
      }

      const contract = ACCOUNTABILITY_BONDS[selectedChain];
      const callData = action === "request"
        ? encodeRequestDistribution(bondId)
        : encodeDistributeBond(bondId);

      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const hash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: (accounts as string[])[0],
          to: contract,
          data: callData,
          value: "0x0",
          gas: "0x" + (150000).toString(16),
        }],
      });

      setTxHash(hash as string);
      showToast(
        action === "request"
          ? "Distribution request submitted! After timelock, you can claim."
          : "Bond distribution executed!",
        "success"
      );
      setTimeout(loadData, 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      if (msg.includes("rejected") || msg.includes("denied")) {
        showToast("Transaction rejected", "info");
      } else {
        showToast(`Failed: ${msg}`, "warning");
      }
    }
    setWithdrawing(false);
  };

  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div className="page-enter" style={{ padding: isMobile ? "24px 16px 48px" : "40px 40px 48px", maxWidth: 720, margin: "0 auto" }}>
      <AlphaBanner />

      <div style={{ marginBottom: 32, paddingLeft: isMobile ? 48 : 0 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color: "#F4F4F5", letterSpacing: "-0.03em" }}>Agent Earnings</h1>
        <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>Real bond data from AIAccountabilityBondsV2 &amp; AIPartnershipBondsV2</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Accountability Stake", value: `${formatEth(totalAccStake)} ETH`, color: "#22C55E" },
          { label: "Partnership Stake", value: `${formatEth(totalPartStake)} ETH`, color: "#8B5CF6" },
          { label: "Active Bonds", value: totalActiveBonds.toString(), color: "#F97316" },
          { label: "Total Bonds", value: totalBondCount.toString(), color: "#3B82F6" },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: 16, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 11, color: "#71717A", fontWeight: 500, marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: stat.color, ...mono, letterSpacing: "-0.02em" }}>
              {loading ? "..." : stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 24, padding: 4, borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      }}>
        {[
          { key: "overview" as const, label: "Bond Overview" },
          { key: "withdraw" as const, label: "Withdraw" },
          { key: "history" as const, label: "History" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600,
            backgroundColor: activeTab === tab.key ? "rgba(249,115,22,0.12)" : "transparent",
            color: activeTab === tab.key ? "#F97316" : "#71717A",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(["base", "avalanche", "ethereum"] as SupportedChain[]).map(chain => {
            const acc = accBonds[chain];
            const part = partBonds[chain];
            const hasData = acc.hasBond || part.hasBond;
            return (
              <div key={chain} style={{
                padding: isMobile ? 16 : 20, borderRadius: 14,
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: hasData ? "#22C55E" : "#3F3F46" }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", textTransform: "capitalize" }}>{chain}</span>
                  </div>
                  <a href={`${EXPLORER_URLS[chain]}/address/${ACCOUNTABILITY_BONDS[chain]}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 10, color: "#52525B", textDecoration: "none" }}>
                    View Contract →
                  </a>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: 11, color: "#71717A", marginBottom: 4 }}>Accountability Bonds</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5", ...mono }}>
                      {loading ? "..." : acc.bondCount}
                    </div>
                    <div style={{ fontSize: 11, color: "#52525B", marginTop: 2 }}>
                      Stake: {loading ? "..." : formatEth(acc.totalStake)} ETH
                    </div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: 11, color: "#71717A", marginBottom: 4 }}>Partnership Bonds</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#F4F4F5", ...mono }}>
                      {loading ? "..." : part.bondCount}
                    </div>
                    <div style={{ fontSize: 11, color: "#52525B", marginTop: 2 }}>
                      Stake: {loading ? "..." : formatEth(part.totalStake)} ETH
                    </div>
                  </div>
                </div>

                {!hasData && !loading && (
                  <p style={{ fontSize: 11, color: "#3F3F46", marginTop: 8, textAlign: "center" }}>
                    No bonds found on {chain}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Withdraw Tab */}
      {activeTab === "withdraw" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            padding: "14px 18px", borderRadius: 12,
            background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#F97316", marginBottom: 4 }}>How Withdrawals Work</p>
            <p style={{ fontSize: 12, color: "#A1A1AA", lineHeight: 1.6 }}>
              1. <strong>Request Distribution</strong> — calls <code>requestDistribution(bondId)</code> on AIAccountabilityBondsV2<br />
              2. <strong>Wait for Timelock</strong> — distribution timelock period must pass<br />
              3. <strong>Claim Distribution</strong> — calls <code>distributeBond(bondId)</code> to receive funds
            </p>
          </div>

          {/* Chain selector */}
          <div>
            <label style={{ fontSize: 11, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>
              Select Chain
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["base", "avalanche", "ethereum"] as SupportedChain[]).map(c => (
                <button key={c} onClick={() => { setSelectedChain(c); setSelectedBondId(null); }} style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                  background: selectedChain === c ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                  color: selectedChain === c ? "#F97316" : "#71717A",
                }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Bond Selection */}
          {accBonds[selectedChain].bondIds.length > 0 ? (
            <div>
              <label style={{ fontSize: 11, color: "#71717A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>
                Select Bond
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {accBonds[selectedChain].bondIds.map(id => (
                  <button key={id} onClick={() => setSelectedBondId(id)} style={{
                    padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: selectedBondId === id ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.03)",
                    borderLeft: selectedBondId === id ? "3px solid #F97316" : "3px solid transparent",
                    textAlign: "left",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: selectedBondId === id ? "#F4F4F5" : "#A1A1AA" }}>
                      Bond #{id}
                    </div>
                    <div style={{ fontSize: 11, color: "#52525B", marginTop: 2 }}>
                      AIAccountabilityBondsV2 on {selectedChain}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              padding: 32, textAlign: "center", borderRadius: 14,
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#71717A", marginBottom: 4 }}>
                No accountability bonds on {selectedChain}
              </div>
              <div style={{ fontSize: 12, color: "#52525B" }}>
                Create a bond first to enable withdrawals
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {selectedBondId !== null && (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => executeWithdrawal("request", selectedBondId)}
                disabled={withdrawing}
                style={{
                  flex: 1, padding: "14px 0", borderRadius: 12, border: "none",
                  cursor: withdrawing ? "not-allowed" : "pointer",
                  background: "#F97316", color: "#fff", fontSize: 13, fontWeight: 700,
                  opacity: withdrawing ? 0.5 : 1,
                }}
              >
                {withdrawing ? "Processing..." : "Request Distribution"}
              </button>
              <button
                onClick={() => executeWithdrawal("distribute", selectedBondId)}
                disabled={withdrawing}
                style={{
                  flex: 1, padding: "14px 0", borderRadius: 12, border: "none",
                  cursor: withdrawing ? "not-allowed" : "pointer",
                  background: "#22C55E", color: "#fff", fontSize: 13, fontWeight: 700,
                  opacity: withdrawing ? 0.5 : 1,
                }}
              >
                {withdrawing ? "Processing..." : "Claim Distribution"}
              </button>
            </div>
          )}

          {txHash && (
            <div style={{
              padding: "12px 16px", borderRadius: 10,
              background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#22C55E", marginBottom: 4 }}>Transaction Submitted</div>
              <a href={`${EXPLORER_URLS[selectedChain]}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: "#F97316", ...mono, wordBreak: "break-all" }}>
                {txHash}
              </a>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div style={{
          padding: isMobile ? 16 : 20, borderRadius: 14,
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5" }}>Transaction History</div>
            {transactions.length > 0 && (
              <span style={{ fontSize: 11, color: "#52525B" }}>{transactions.length} transactions</span>
            )}
          </div>
          {transactions.length > 0 ? (
            transactions.map(tx => <TxRow key={tx.id} tx={tx} />)
          ) : (
            <div style={{ padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#71717A", marginBottom: 6 }}>No transactions yet</div>
              <div style={{ fontSize: 12, color: "#52525B", lineHeight: 1.5 }}>
                Earnings from x402 payments and bond distributions will appear here.
              </div>
            </div>
          )}
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
