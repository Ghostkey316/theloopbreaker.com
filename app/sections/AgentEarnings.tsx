"use client";
/**
 * AgentEarnings — Agent Earnings Wallet with transaction history,
 * withdrawal, inter-agent payments, and automated bond staking.
 * Combines: Agent Earnings Wallet + Inter-Agent Payments + Automated Bond Staking
 */
import { useState, useEffect } from "react";
import { BOND_TIERS, type BondTier, getBondTier } from "../lib/vns";
import { VNSTypeBadge } from "../components/VNSBadge";
import DisclaimerBanner from "../components/DisclaimerBanner";

/* ── Types ── */
interface EarningsTransaction {
  id: string;
  type: "earned" | "paid" | "withdrawn" | "bond_stake" | "bond_return" | "inter_agent";
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

interface EarningsSummary {
  totalEarned: number;
  totalPaid: number;
  totalWithdrawn: number;
  availableBalance: number;
  pendingPayments: number;
  bondStaked: number;
  bondTier: BondTier;
  currency: string;
}

interface AutoStakeConfig {
  enabled: boolean;
  targetTier: BondTier;
  percentOfEarnings: number;
  currentProgress: number; // 0-100 toward target
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
function TxRow({ tx, isMobile }: { tx: EarningsTransaction; isMobile: boolean }) {
  const typeConfig: Record<string, { color: string; label: string; sign: string }> = {
    earned: { color: "#22C55E", label: "Earned", sign: "+" },
    paid: { color: "#EF4444", label: "Paid", sign: "-" },
    withdrawn: { color: "#F97316", label: "Withdrawn", sign: "-" },
    bond_stake: { color: "#7C3AED", label: "Bond Stake", sign: "-" },
    bond_return: { color: "#3B82F6", label: "Bond Return", sign: "+" },
    inter_agent: { color: "#EC4899", label: "Agent→Agent", sign: "↔" },
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
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>
          {cfg.sign}{tx.amount} {tx.currency}
        </div>
        <div style={{
          fontSize: 10, color: tx.status === "confirmed" ? "#22C55E" : tx.status === "pending" ? "#F97316" : "#EF4444",
          marginTop: 2,
        }}>
          {tx.status === "confirmed" ? "✓ Confirmed" : tx.status === "pending" ? "⏳ Pending" : "✗ Failed"}
        </div>
      </div>
    </div>
  );
}

/* ── Auto-Stake Panel ── */
function AutoStakePanel({ config, onUpdate, isMobile }: {
  config: AutoStakeConfig;
  onUpdate: (c: AutoStakeConfig) => void;
  isMobile: boolean;
}) {
  return (
    <div style={{
      padding: isMobile ? 16 : 20, borderRadius: 14,
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
          {/* Target Tier */}
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

          {/* Percentage Slider */}
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

          {/* Progress */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#A1A1AA" }}>Progress to {config.targetTier}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#F4F4F5" }}>{config.currentProgress}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${config.currentProgress}%`,
                background: "linear-gradient(90deg, #7C3AED, #A78BFA)",
                borderRadius: 3, transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function AgentEarnings() {
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"earnings" | "payments" | "staking">("earnings");
  const [autoStake, setAutoStake] = useState<AutoStakeConfig>({
    enabled: true, targetTier: "gold", percentOfEarnings: 20, currentProgress: 62,
  });
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payAgent, setPayAgent] = useState({ vnsName: "", amount: "", reason: "" });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Demo data — in production, loaded from on-chain events
  const summary: EarningsSummary = {
    totalEarned: 1.245,
    totalPaid: 0.32,
    totalWithdrawn: 0.5,
    availableBalance: 0.425,
    pendingPayments: 0.015,
    bondStaked: 0.05,
    bondTier: "silver",
    currency: "ETH",
  };

  const transactions: EarningsTransaction[] = [
    { id: "1", type: "earned", amount: "0.05", currency: "ETH", from: "alice.vns", to: "ghostkey316.vns", description: "Task: Smart contract audit completed", timestamp: Date.now() - 3600000, chain: "base", status: "confirmed" },
    { id: "2", type: "inter_agent", amount: "0.02", currency: "ETH", from: "ns3-alpha.vns", to: "ns3-research.vns", description: "Agent→Agent: Data analysis sub-task", timestamp: Date.now() - 7200000, chain: "base", status: "confirmed" },
    { id: "3", type: "bond_stake", amount: "0.01", currency: "ETH", from: "ghostkey316.vns", to: "Bond Contract", description: "Auto-stake: 20% of task earnings", timestamp: Date.now() - 10800000, chain: "base", status: "confirmed" },
    { id: "4", type: "earned", amount: "0.08", currency: "ETH", from: "bob.vns", to: "ghostkey316.vns", description: "Task: UI/UX review for DeFi app", timestamp: Date.now() - 86400000, chain: "ethereum", status: "confirmed" },
    { id: "5", type: "paid", amount: "0.03", currency: "ETH", from: "ghostkey316.vns", to: "ns3-alpha.vns", description: "Hired agent for code generation", timestamp: Date.now() - 172800000, chain: "base", status: "confirmed" },
    { id: "6", type: "withdrawn", amount: "0.1", currency: "ETH", from: "Earnings Wallet", to: "External Wallet", description: "Withdrawal to personal wallet", timestamp: Date.now() - 259200000, chain: "base", status: "confirmed" },
    { id: "7", type: "earned", amount: "0.12", currency: "ETH", from: "carol.vns", to: "ghostkey316.vns", description: "Task: Security vulnerability assessment", timestamp: Date.now() - 345600000, chain: "avalanche", status: "confirmed" },
    { id: "8", type: "inter_agent", amount: "0.005", currency: "ETH", from: "ns3-research.vns", to: "ns3-alpha.vns", description: "Agent→Agent: Knowledge sharing fee", timestamp: Date.now() - 432000000, chain: "base", status: "confirmed" },
  ];

  const tabs = [
    { id: "earnings" as const, label: "Earnings" },
    { id: "payments" as const, label: "Payments" },
    { id: "staking" as const, label: "Bond Staking" },
  ];

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: "#F4F4F5", margin: 0, letterSpacing: -0.5 }}>
          Earnings & Payments
        </h2>
        <p style={{ fontSize: 13, color: "#71717A", margin: "6px 0 0" }}>
          Agent earnings wallet, inter-agent payments, and automated bond staking
        </p>
      </div>

      <DisclaimerBanner disclaimerKey="agent_hub" />

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <StatCard label="Available" value={`${summary.availableBalance} ETH`} color="#22C55E"
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3v4M8 3v4M2 11h20"/></svg>} />
        <StatCard label="Total Earned" value={`${summary.totalEarned} ETH`} color="#3B82F6"
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>} />
        <StatCard label="Bond Staked" value={`${summary.bondStaked} ETH`} subValue={`${summary.bondTier.charAt(0).toUpperCase() + summary.bondTier.slice(1)} Tier`} color="#7C3AED"
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>} />
        <StatCard label="Pending" value={`${summary.pendingPayments} ETH`} color="#F97316"
          icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
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
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type="text" placeholder="0.00" value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 60px 12px 14px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                    color: "#F4F4F5", fontSize: 14, outline: "none", boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => setWithdrawAmount(String(summary.availableBalance))}
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    padding: "4px 8px", borderRadius: 5, border: "none", cursor: "pointer",
                    background: "rgba(124,58,237,0.15)", color: "#A78BFA", fontSize: 10, fontWeight: 600,
                  }}
                >
                  MAX
                </button>
              </div>
              <button onClick={() => { if (withdrawAmount) { alert(`Withdrawal of ${withdrawAmount} ETH initiated. This will create an on-chain transaction.`); setWithdrawAmount(''); } }} style={{
                padding: "12px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 700,
                opacity: withdrawAmount ? 1 : 0.5, transition: "opacity 0.2s ease",
                whiteSpace: "nowrap",
              }}>
                Withdraw
              </button>
            </div>
          </div>

          {/* Transaction History */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 12 }}>Transaction History</div>
            {transactions.map(tx => (
              <TxRow key={tx.id} tx={tx} isMobile={isMobile} />
            ))}
          </div>
        </div>
      )}

      {/* Payments Tab — Inter-Agent Payments */}
      {activeTab === "payments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Send Payment */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(236,72,153,0.04)", border: "1px solid rgba(236,72,153,0.15)",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#F4F4F5", marginBottom: 4 }}>Send Payment</div>
            <div style={{ fontSize: 12, color: "#71717A", marginBottom: 16 }}>Pay another agent or human for services</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="text" placeholder="Recipient .vns name (e.g. ns3-alpha.vns)"
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
                  type="text" placeholder="Amount (ETH)"
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
                  <option value="base">Base</option>
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
              <button onClick={() => { if (payAgent.vnsName && payAgent.amount) { alert(`Payment of ${payAgent.amount} ETH to ${payAgent.vnsName} initiated.`); setPayAgent({ vnsName: '', amount: '', reason: '' }); } }} style={{
                padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer",
                background: "#EC4899", color: "#fff", fontSize: 14, fontWeight: 700,
                opacity: payAgent.vnsName && payAgent.amount ? 1 : 0.5,
                transition: "opacity 0.2s ease",
              }}>
                Send Payment
              </button>
            </div>
          </div>

          {/* Recent Inter-Agent Payments */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 12 }}>Recent Payments</div>
            {transactions.filter(tx => tx.type === "inter_agent" || tx.type === "paid" || tx.type === "earned").map(tx => (
              <TxRow key={tx.id} tx={tx} isMobile={isMobile} />
            ))}
          </div>
        </div>
      )}

      {/* Staking Tab */}
      {activeTab === "staking" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <AutoStakePanel config={autoStake} onUpdate={setAutoStake} isMobile={isMobile} />

          {/* Current Bond Status */}
          <div style={{
            padding: isMobile ? 16 : 20, borderRadius: 14,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", marginBottom: 14 }}>Bond Status</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                <div style={{ fontSize: 11, color: "#71717A", marginBottom: 4 }}>Current Bond</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#F4F4F5" }}>{summary.bondStaked} ETH</div>
                <div style={{ fontSize: 11, color: "#A78BFA", marginTop: 2 }}>
                  {summary.bondTier.charAt(0).toUpperCase() + summary.bondTier.slice(1)} Tier
                </div>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                <div style={{ fontSize: 11, color: "#71717A", marginBottom: 4 }}>Next Tier</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#F4F4F5" }}>
                  {BOND_TIERS.find(t => t.minEth > summary.bondStaked)?.minEth || "MAX"} ETH
                </div>
                <div style={{ fontSize: 11, color: "#71717A", marginTop: 2 }}>
                  {BOND_TIERS.find(t => t.minEth > summary.bondStaked)?.label || "Platinum"} Tier
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
              const isCurrentOrAbove = summary.bondStaked >= tier.minEth;
              const isCurrent = getBondTier(summary.bondStaked) === tier.label.toLowerCase();
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
                  opacity: isCurrentOrAbove ? 1 : 0.5,
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
                      <span style={{ fontSize: 11, color: "#52525B" }}>≥ {tier.minEth} ETH</span>
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
              <button onClick={() => alert('Bond staking requires a connected wallet with sufficient ETH. Transaction will be sent to AIAccountabilityBondsV2 contract.')} style={{
                padding: "12px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 700,
                whiteSpace: "nowrap",
              }}>
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
