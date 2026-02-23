"use client";
/**
 * AgentEarnings — Agent Earnings Wallet with transaction history,
 * withdrawal, inter-agent payments, automated bond staking,
 * and x402 payment protocol integration.
 *
 * x402 payments are loaded from the x402-client's localStorage history.
 * ALL DATA IS REAL — no fake stats, no demo numbers.
 */
import { useState, useEffect, useCallback } from "react";
import { BOND_TIERS, type BondTier, getBondTier } from "../lib/vns";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { showToast } from "../components/Toast";

/* ── Types ── */
interface EarningsTransaction {
  id: string;
  type: "earned" | "paid" | "withdrawn" | "bond_stake" | "bond_return" | "inter_agent" | "x402_payment";
  amount: string;
  currency: string;
  from: string;
  to: string;
  description: string;
  timestamp: number;
  txHash?: string;
  chain: "base" | "avalanche" | "ethereum";
  status: "confirmed" | "pending" | "failed";
}

interface AutoStakeConfig {
  enabled: boolean;
  targetTier: BondTier;
  percentOfEarnings: number;
}

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
  /** VNS name of the recipient (if resolved) */
  recipientVNS?: string;
  /** VNS name of the sender (if resolved) */
  senderVNS?: string;
}

/* ── Load x402 payment history from localStorage ── */
function loadX402Payments(): X402PaymentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("vaultfire_x402_payments");
    if (!raw) return [];
    return JSON.parse(raw) as X402PaymentRecord[];
  } catch {
    return [];
  }
}

/* ── Convert x402 records to EarningsTransaction format ── */
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

/* ── Stat Card ── */
function StatCard({ label, value, subValue, color, icon }: {
  label: string; value: string; subValue?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div style={{
      padding: 16, borderRadius: 14,
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 11, color: "#71717A", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#F4F4F5", letterSpacing: -0.5 }}>{value}</div>
      {subValue && <div style={{ fontSize: 11, color: "#52525B", marginTop: 2 }}>{subValue}</div>}
    </div>
  );
}

/* ── Transaction Row ── */
function TxRow({ tx }: { tx: EarningsTransaction }) {
  const typeConfig: Record<string, { color: string; label: string; sign: string }> = {
    earned: { color: "#22C55E", label: "Earned", sign: "+" },
    paid: { color: "#EF4444", label: "Paid", sign: "-" },
    withdrawn: { color: "#F97316", label: "Withdrawn", sign: "-" },
    bond_stake: { color: "#7C3AED", label: "Bond Stake", sign: "-" },
    bond_return: { color: "#3B82F6", label: "Bond Return", sign: "+" },
    inter_agent: { color: "#EC4899", label: "Agent Payment", sign: "" },
    x402_payment: { color: "#3B82F6", label: "x402 Payment", sign: "-" },
  };
  const cfg = typeConfig[tx.type] || typeConfig.earned;
  const date = new Date(tx.timestamp);
  const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0,
      }} />
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
          <a
            href={`https://basescan.org/tx/${tx.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 10, color: "#7C3AED", textDecoration: "none" }}
          >
            View Tx
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Empty State ── */
function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div style={{
      padding: 40, textAlign: "center",
      background: "rgba(255,255,255,0.02)", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#A1A1AA", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#52525B", maxWidth: 320, margin: "0 auto", lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

/* ── Auto-Stake Panel ── */
function AutoStakePanel({ config, onUpdate }: {
  config: AutoStakeConfig;
  onUpdate: (c: AutoStakeConfig) => void;
}) {
  return (
    <div style={{
      padding: 16, borderRadius: 14,
      background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#F4F4F5" }}>Automated Bond Staking</div>
          <div style={{ fontSize: 12, color: "#71717A", marginTop: 2 }}>Auto-reinvest earnings into your accountability bond</div>
        </div>
        <button
          onClick={() => onUpdate({ ...config, enabled: !config.enabled })}
          style={{
            width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
            background: config.enabled ? "#7C3AED" : "rgba(255,255,255,0.1)",
            position: "relative", transition: "background 0.2s ease",
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: "50%", background: "#fff",
            position: "absolute", top: 3,
            left: config.enabled ? 23 : 3,
            transition: "left 0.2s ease",
          }} />
        </button>
      </div>

      {config.enabled && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#A1A1AA", marginBottom: 8 }}>Target Tier</div>
            <div style={{ display: "flex", gap: 6 }}>
              {BOND_TIERS.map(tier => (
                <button
                  key={tier.label}
                  onClick={() => onUpdate({ ...config, targetTier: tier.label.toLowerCase() as BondTier })}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 600,
                    background: config.targetTier === tier.label.toLowerCase() ? `${tier.color}20` : "rgba(255,255,255,0.04)",
                    color: config.targetTier === tier.label.toLowerCase() ? tier.color : "#52525B",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#A1A1AA" }}>% of earnings to auto-stake</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED" }}>{config.percentOfEarnings}%</span>
            </div>
            <input
              type="range" min={5} max={100} step={5}
              value={config.percentOfEarnings}
              onChange={e => onUpdate({ ...config, percentOfEarnings: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "#7C3AED" }}
            />
          </div>

          <div style={{
            padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)",
            fontSize: 12, color: "#71717A", lineHeight: 1.5,
          }}>
            When you earn from tasks, {config.percentOfEarnings}% will be automatically staked to your accountability bond.
            No earnings yet — auto-staking will begin when you complete your first task.
          </div>
        </>
      )}
    </div>
  );
}

/* ── x402 Payment Summary Panel ── */
function X402PaymentPanel({ payments }: { payments: X402PaymentRecord[] }) {
  const totalMicro = payments.reduce((sum, p) => {
    try { return sum + BigInt(p.amount); } catch { return sum; }
  }, 0n);
  const settled = payments.filter(p => p.status === "settled").length;
  const pending = payments.filter(p => p.status === "signed").length;
  const failed = payments.filter(p => p.status === "failed").length;

  const formatUsdc = (micro: bigint): string => {
    const whole = micro / 1000000n;
    const frac = micro % 1000000n;
    const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
    if (!fracStr) return `${whole}.00`;
    return `${whole}.${fracStr}`;
  };

  return (
    <div style={{
      padding: 16, borderRadius: 14,
      background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.15)",
      marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: "rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14,
        }}>
          $
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5" }}>x402 Payments</div>
          <div style={{ fontSize: 11, color: "#71717A" }}>USDC payments via Coinbase x402 protocol on Base</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.03)", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#3B82F6" }}>{payments.length}</div>
          <div style={{ fontSize: 10, color: "#52525B" }}>Total</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.03)", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#22C55E" }}>{settled}</div>
          <div style={{ fontSize: 10, color: "#52525B" }}>Settled</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.03)", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#F59E0B" }}>{pending}</div>
          <div style={{ fontSize: 10, color: "#52525B" }}>Pending</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.03)", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#EF4444" }}>{failed}</div>
          <div style={{ fontSize: 10, color: "#52525B" }}>Failed</div>
        </div>
      </div>

      <div style={{
        padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.03)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, color: "#71717A" }}>Total Volume</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#F4F4F5" }}>{formatUsdc(totalMicro)} USDC</span>
      </div>

      {payments.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#52525B", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Recent x402 Payments
          </div>
          {payments.slice(0, 5).map(p => {
            const date = new Date(p.timestamp);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
            const statusColor = p.status === "settled" ? "#22C55E" : p.status === "failed" ? "#EF4444" : "#F59E0B";
            const recipientDisplay = p.recipientVNS || `${p.payTo.slice(0, 8)}...${p.payTo.slice(-4)}`;
            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#A1A1AA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {recipientDisplay}
                  </div>
                  <div style={{ fontSize: 10, color: "#52525B" }}>{dateStr}{p.recipientVNS && ` · ${p.payTo.slice(0, 6)}...`}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#3B82F6" }}>
                  {p.amountFormatted} USDC
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function AgentEarnings() {
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"earnings" | "payments" | "staking">("earnings");
  const [autoStake, setAutoStake] = useState<AutoStakeConfig>({
    enabled: false, targetTier: "silver", percentOfEarnings: 20,
  });
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payAgent, setPayAgent] = useState({ vnsName: "", amount: "", reason: "" });
  const [transactions, setTransactions] = useState<EarningsTransaction[]>([]);
  const [x402Payments, setX402Payments] = useState<X402PaymentRecord[]>([]);

  // Load x402 payment history on mount and merge into transactions
  const loadPayments = useCallback(() => {
    const x402Records = loadX402Payments();
    setX402Payments(x402Records);
    const x402Txs = x402ToEarnings(x402Records);
    setTransactions(x402Txs);
  }, []);

  useEffect(() => {
    loadPayments();
    // Refresh every 30 seconds to pick up new payments
    const interval = setInterval(loadPayments, 30_000);
    return () => clearInterval(interval);
  }, [loadPayments]);

  // Real data: computed from x402 payment history
  const totalX402Usdc = x402Payments.reduce((sum, p) => {
    try { return sum + BigInt(p.amount); } catch { return sum; }
  }, 0n);
  const availableBalance = 0;
  const totalEarned = 0;
  const bondStaked = 0;
  const pendingPayments = x402Payments.filter(p => p.status === "signed").length;
  const currentTier = getBondTier(bondStaked);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const tabs = [
    { id: "earnings" as const, label: "Earnings" },
    { id: "payments" as const, label: "Payments" },
    { id: "staking" as const, label: "Bond Staking" },
  ];

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, paddingLeft: isMobile ? 48 : 0 }}>
        <h2 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: "#F4F4F5", margin: 0, letterSpacing: -0.5 }}>
          Earnings & Payments
        </h2>
        <p style={{ fontSize: 13, color: "#71717A", margin: "6px 0 0" }}>
          Agent earnings wallet, x402 USDC payments, inter-agent payments, and automated bond staking
        </p>
      </div>

      <DisclaimerBanner disclaimerKey="agent_hub" />

      {/* x402 Payment Summary — always visible when payments exist */}
      {x402Payments.length > 0 && (
        <X402PaymentPanel payments={x402Payments} />
      )}

      {/* Stats Grid — Real data only */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <StatCard label="Available" value={`${availableBalance.toFixed(4)} ETH`} color="#22C55E"
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3v4M8 3v4M2 11h20"/></svg>} />
        <StatCard label="Total Earned" value={`${totalEarned.toFixed(4)} ETH`} color="#3B82F6"
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>} />
        <StatCard label="Bond Staked" value={`${bondStaked.toFixed(4)} ETH`} subValue={currentTier ? `${currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Tier` : "No bond"} color="#7C3AED"
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} />
        <StatCard label="x402 Volume" value={`${Number(totalX402Usdc) / 1_000_000} USDC`} subValue={`${x402Payments.length} payments`} color="#F97316"
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10h8M8 14h8"/></svg>} />
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 24,
        background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 3,
        border: "1px solid rgba(255,255,255,0.04)",
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: "10px 0", border: "none", borderRadius: 8, cursor: "pointer",
            fontSize: 13, fontWeight: 600,
            background: activeTab === tab.id ? "rgba(255,255,255,0.06)" : "transparent",
            color: activeTab === tab.id ? "#F4F4F5" : "#52525B",
            transition: "all 0.15s ease",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Earnings Tab */}
      {activeTab === "earnings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Withdraw */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 12 }}>Withdraw Earnings</div>
            <div style={{ display: "flex", gap: 10, flexDirection: isMobile ? "column" : "row" }}>
              <input
                type="text" placeholder="0.00" value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                  color: "#F4F4F5", fontSize: 14, outline: "none", boxSizing: "border-box",
                }}
              />
              <button
                onClick={() => {
                  if (availableBalance <= 0) {
                    showToast("No earnings available to withdraw.", "warning");
                    return;
                  }
                  if (withdrawAmount) {
                    showToast(`Withdrawal of ${withdrawAmount} ETH initiated. This will create an on-chain transaction.`, "info");
                    setWithdrawAmount("");
                  }
                }}
                disabled={availableBalance <= 0}
                style={{
                  padding: "12px 24px", borderRadius: 10, border: "none",
                  cursor: availableBalance > 0 ? "pointer" : "not-allowed",
                  background: "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 700,
                  opacity: availableBalance > 0 && withdrawAmount ? 1 : 0.35,
                  transition: "opacity 0.2s ease", whiteSpace: "nowrap",
                }}
              >
                Withdraw
              </button>
            </div>
            {availableBalance <= 0 && (
              <div style={{ fontSize: 11, color: "#52525B", marginTop: 8 }}>
                No earnings available. Complete tasks through the Agent Hub to earn.
              </div>
            )}
          </div>

          {/* Transaction History (includes x402 payments) */}
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
              <EmptyState
                icon={<svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3v4M8 3v4M2 11h20"/></svg>}
                title="No transactions yet"
                description="Earnings and x402 payments will appear here when you complete tasks, receive payments, or make x402 USDC payments through the Agent Hub or XMTP."
              />
            )}
          </div>
        </div>
      )}

      {/* Payments Tab — Inter-Agent Payments + x402 */}
      {activeTab === "payments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* x402 Protocol Info */}
          <div style={{
            padding: 16, borderRadius: 14,
            background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.15)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#3B82F6", marginBottom: 6 }}>x402 Payment Protocol + VNS</div>
            <div style={{ fontSize: 12, color: "#A1A1AA", lineHeight: 1.6 }}>
              Payments use Coinbase&apos;s x402 protocol — USDC on Base via EIP-3009 transferWithAuthorization.
              Your wallet signs EIP-712 typed data to authorize payments without needing gas.
              The facilitator settles on-chain. <strong style={{ color: "#3B82F6" }}>Pay by .vns name or raw address</strong> —
              VNS names are automatically resolved to payment addresses.
              Use <code style={{ color: "#3B82F6" }}>/pay sentinel-7.vns 2.00</code> in XMTP or the form below.
            </div>
          </div>

          {/* Send Payment */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(236,72,153,0.04)", border: "1px solid rgba(236,72,153,0.15)",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#F4F4F5", marginBottom: 4 }}>Send Payment</div>
            <div style={{ fontSize: 12, color: "#71717A", marginBottom: 16 }}>Pay another agent or human for services</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="text" placeholder="Recipient .vns name or 0x address"
                value={payAgent.vnsName}
                onChange={e => setPayAgent({ ...payAgent, vnsName: e.target.value })}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                  color: "#F4F4F5", fontSize: 13, outline: "none", boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text" placeholder="Amount (USDC)"
                  value={payAgent.amount}
                  onChange={e => setPayAgent({ ...payAgent, amount: e.target.value })}
                  style={{
                    flex: 1, padding: "12px 14px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                    color: "#F4F4F5", fontSize: 13, outline: "none",
                  }}
                />
                <select style={{
                  padding: "12px 14px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                  color: "#F4F4F5", fontSize: 13, outline: "none",
                }}>
                  <option value="base">Base (x402)</option>
                  <option value="ethereum">ETH</option>
                  <option value="avalanche">Avax</option>
                </select>
              </div>
              <input
                type="text" placeholder="Reason (optional)"
                value={payAgent.reason}
                onChange={e => setPayAgent({ ...payAgent, reason: e.target.value })}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                  color: "#F4F4F5", fontSize: 13, outline: "none", boxSizing: "border-box",
                }}
              />
              <button
                onClick={async () => {
                  if (payAgent.vnsName && payAgent.amount) {
                    try {
                      showToast(`Resolving ${payAgent.vnsName} and signing x402 payment...`, "info");
                      const { initiatePayment } = await import("../lib/x402-client");
                      const { record, resolvedVNS } = await initiatePayment(
                        payAgent.vnsName,
                        payAgent.amount,
                        payAgent.reason || undefined,
                      );
                      const displayTo = resolvedVNS || record.payTo.slice(0, 12) + "...";
                      showToast(`x402 payment of ${payAgent.amount} USDC to ${displayTo} signed! ID: ${record.id}`, "success");
                      setPayAgent({ vnsName: "", amount: "", reason: "" });
                      // Refresh payment history
                      setTimeout(loadPayments, 1000);
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : "Payment failed";
                      showToast(`Payment failed: ${msg}`, "warning");
                    }
                  }
                }}
                style={{
                  padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer",
                  background: "#EC4899", color: "#fff", fontSize: 14, fontWeight: 700,
                  opacity: payAgent.vnsName && payAgent.amount ? 1 : 0.35,
                  transition: "opacity 0.2s ease",
                }}
              >
                Send x402 Payment
              </button>
            </div>
          </div>

          {/* Recent Payments */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 12 }}>Recent Payments</div>
            {transactions.filter(tx => tx.type === "inter_agent" || tx.type === "paid" || tx.type === "earned" || tx.type === "x402_payment").length > 0 ? (
              transactions.filter(tx => tx.type === "inter_agent" || tx.type === "paid" || tx.type === "earned" || tx.type === "x402_payment").map(tx => (
                <TxRow key={tx.id} tx={tx} />
              ))
            ) : (
              <EmptyState
                icon={<svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                title="No payments yet"
                description="x402 USDC payments and inter-agent payments will appear here. Use /pay in XMTP or the form above to send a payment."
              />
            )}
          </div>
        </div>
      )}

      {/* Staking Tab */}
      {activeTab === "staking" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <AutoStakePanel config={autoStake} onUpdate={setAutoStake} />

          {/* Current Bond Status — Real data */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 14 }}>Bond Status</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                <div style={{ fontSize: 11, color: "#71717A", marginBottom: 4 }}>Current Bond</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#F4F4F5" }}>{bondStaked.toFixed(4)} ETH</div>
                <div style={{ fontSize: 11, color: bondStaked > 0 ? "#A78BFA" : "#52525B", marginTop: 2 }}>
                  {bondStaked > 0 ? `${currentTier?.charAt(0).toUpperCase()}${currentTier?.slice(1)} Tier` : "No bond staked"}
                </div>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                <div style={{ fontSize: 11, color: "#71717A", marginBottom: 4 }}>Next Tier</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#F4F4F5" }}>
                  {BOND_TIERS[0]?.minEth || 0.01} ETH
                </div>
                <div style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>
                  {BOND_TIERS[0]?.label || "Bronze"} Tier
                </div>
              </div>
            </div>
          </div>

          {/* Tier Requirements */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 14 }}>Tier Requirements & Unlocks</div>
            {BOND_TIERS.map(tier => {
              const isCurrentOrAbove = bondStaked >= tier.minEth;
              const isCurrent = getBondTier(bondStaked) === tier.label.toLowerCase();
              const unlocks: Record<string, string> = {
                Bronze: "Basic marketplace, 3 tasks/day",
                Silver: "Priority search, 10 tasks/day, collaboration rooms",
                Gold: "Featured listing, unlimited tasks, priority matching",
                Platinum: "Top placement, governance voting, premium features",
              };
              return (
                <div key={tier.label} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: isCurrentOrAbove ? tier.color : "rgba(255,255,255,0.1)",
                    border: isCurrent ? `2px solid ${tier.color}` : "none",
                    boxShadow: isCurrent ? `0 0 8px ${tier.color}40` : "none",
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: tier.color }}>{tier.label}</span>
                      <span style={{ fontSize: 11, color: "#52525B" }}>Min {tier.minEth} ETH</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>{unlocks[tier.label]}</div>
                  </div>
                  {isCurrentOrAbove && (
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          {/* Manual Stake */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 12 }}>Manual Stake</div>
            <div style={{ display: "flex", gap: 10, flexDirection: isMobile ? "column" : "row" }}>
              <input
                type="text" placeholder="Amount to stake (ETH)"
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                  color: "#F4F4F5", fontSize: 13, outline: "none",
                }}
              />
              <button
                onClick={() => showToast("Bond staking requires a connected wallet with sufficient ETH. Transaction will be sent to AIAccountabilityBondsV2 contract.", "info")}
                style={{
                  padding: "12px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                Stake Bond
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#52525B", marginTop: 8 }}>
              Staking increases your bond tier and unlocks more features. Bonds are held in the AIAccountabilityBondsV2 contract.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
