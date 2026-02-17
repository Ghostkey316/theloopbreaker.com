/**
 * Governance Section — MultisigGovernance proposals, signers, threshold, timelock
 */

import { ethers } from "ethers";
import { Vote, Users, Clock, Shield } from "lucide-react";
import { SectionHeader, DashCard, EmptyState, LoadingSkeleton, AddressLink, StatusBadge, DataTable, StatCard } from "./shared";
import { CONTRACTS, basescanAddress, shortenAddress } from "@/lib/contracts";
import type { GovernanceTransaction, TimelockInfo } from "@/hooks/useVaultfireData";

const GOV_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663286460480/OMbKZjkvUqaMlkIh.png";

interface Props {
  signers: string[];
  threshold: number;
  transactions: GovernanceTransaction[];
  timelockInfo: TimelockInfo | null;
  loading: boolean;
}

function formatDate(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

export default function GovernanceSection({ signers, threshold, transactions, timelockInfo, loading }: Props) {
  const hasTimelock = timelockInfo && timelockInfo.pendingImageId !== ZERO_BYTES32;

  return (
    <div>
      <SectionHeader
        title="Governance"
        subtitle="Multisig governance, proposals, and timelock status"
        icon={<Vote className="w-5 h-5" />}
      />

      {/* Governance banner */}
      <div className="relative rounded-xl overflow-hidden mb-6 h-32 md:h-40">
        <img src={GOV_IMAGE} alt="" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 flex items-center px-6 md:px-8">
          <div>
            <h3 className="font-display font-bold text-lg md:text-xl text-foreground">Decentralized Governance</h3>
            <p className="text-sm text-muted-foreground mt-1">Multisig with {threshold}-of-{signers.length} threshold for protocol changes</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Signers" value={signers.length} icon={<Users className="w-4 h-4" />} loading={loading} accent="violet" />
        <StatCard label="Threshold" value={`${threshold}/${signers.length}`} icon={<Shield className="w-4 h-4" />} loading={loading} accent="ember" delay={0.05} />
        <StatCard label="Proposals" value={transactions.length} icon={<Vote className="w-4 h-4" />} loading={loading} accent="emerald" delay={0.1} />
        <StatCard
          label="Timelock"
          value={hasTimelock ? "Pending" : "Clear"}
          icon={<Clock className="w-4 h-4" />}
          loading={loading}
          accent={hasTimelock ? "ember" : "emerald"}
          delay={0.15}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Signers */}
        <DashCard delay={0.1}>
          <h3 className="font-display font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet" />
            Authorized Signers
          </h3>
          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : signers.length === 0 ? (
            <EmptyState message="No signers found" />
          ) : (
            <div className="space-y-2">
              {signers.map((signer, i) => (
                <div key={signer} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-surface-hover/50 transition-colors">
                  <span className="text-xs font-mono-data text-muted-foreground w-5">#{i + 1}</span>
                  <AddressLink address={signer} />
                </div>
              ))}
            </div>
          )}
        </DashCard>

        {/* Proposals */}
        <DashCard className="lg:col-span-2" delay={0.15}>
          <h3 className="font-display font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
            <Vote className="w-4 h-4 text-ember" />
            Recent Proposals
          </h3>
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : transactions.length === 0 ? (
            <EmptyState message="No governance proposals yet" />
          ) : (
            <DataTable headers={["TX ID", "Target", "Confirmations", "Proposed", "Status"]}>
              {transactions.map((tx) => (
                <tr key={tx.txId} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="px-5 md:px-6 py-3 font-mono-data text-ember">#{tx.txId}</td>
                  <td className="px-5 md:px-6 py-3">
                    <AddressLink address={tx.to} />
                  </td>
                  <td className="px-5 md:px-6 py-3 font-mono-data text-sm">
                    <span className={tx.confirmationCount >= threshold ? "text-emerald" : "text-muted-foreground"}>
                      {tx.confirmationCount}/{threshold}
                    </span>
                  </td>
                  <td className="px-5 md:px-6 py-3 text-sm text-muted-foreground font-mono-data">
                    {formatDate(tx.proposedAt)}
                  </td>
                  <td className="px-5 md:px-6 py-3">
                    <StatusBadge
                      status={tx.executed ? "executed" : tx.isReady ? "pending" : "inactive"}
                      label={tx.executed ? "Executed" : tx.isReady ? "Ready" : "Pending"}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </DashCard>
      </div>

      {/* Timelock Info */}
      {hasTimelock && (
        <DashCard className="mt-6" delay={0.2}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-ember" />
            <h3 className="font-display font-semibold text-sm text-foreground">Pending Timelock Change</h3>
            <StatusBadge status={timelockInfo.isReady ? "pending" : "inactive"} label={timelockInfo.isReady ? "Ready to Execute" : "Waiting"} />
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Pending Image ID:</span>
              <p className="font-mono-data text-xs mt-1 text-foreground break-all">{timelockInfo.pendingImageId}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Effective At:</span>
              <p className="font-mono-data text-sm mt-1 text-foreground">{formatDate(timelockInfo.effectiveAt)}</p>
            </div>
          </div>
        </DashCard>
      )}
    </div>
  );
}
