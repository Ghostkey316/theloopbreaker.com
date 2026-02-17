/**
 * Active Bonds Section — Partnership and Accountability bonds
 */

import { ethers } from "ethers";
import { Handshake, ShieldCheck } from "lucide-react";
import { SectionHeader, DashCard, EmptyState, LoadingSkeleton, AddressLink, StatusBadge, DataTable } from "./shared";
import type { PartnershipBond, AccountabilityBond } from "@/hooks/useVaultfireData";

const BONDS_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663286460480/VNTCYuWPrvNANyMm.png";

interface Props {
  partnershipBonds: PartnershipBond[];
  accountabilityBonds: AccountabilityBond[];
  loadingPartnership: boolean;
  loadingAccountability: boolean;
}

function formatDate(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function formatEth(wei: bigint) {
  try {
    const val = ethers.formatEther(wei);
    const num = parseFloat(val);
    if (num === 0) return "0 ETH";
    if (num < 0.001) return "<0.001 ETH";
    return `${num.toFixed(4)} ETH`;
  } catch {
    return "0 ETH";
  }
}

export default function ActiveBondsSection({
  partnershipBonds,
  accountabilityBonds,
  loadingPartnership,
  loadingAccountability,
}: Props) {
  const totalBonds = partnershipBonds.length + accountabilityBonds.length;

  return (
    <div>
      <SectionHeader
        title="Active Bonds"
        subtitle="AI-Human partnership and accountability bonds"
        icon={<Handshake className="w-5 h-5" />}
        badge={
          <span className="text-xs font-mono-data text-muted-foreground bg-surface px-3 py-1.5 rounded-md border border-border/50">
            {totalBonds} bond{totalBonds !== 1 ? "s" : ""}
          </span>
        }
      />

      {/* Decorative banner */}
      <div className="relative rounded-xl overflow-hidden mb-6 h-32 md:h-40">
        <img src={BONDS_IMAGE} alt="" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 flex items-center px-6 md:px-8">
          <div>
            <h3 className="font-display font-bold text-lg md:text-xl text-foreground">AI Partnership & Accountability</h3>
            <p className="text-sm text-muted-foreground mt-1">Economic proof that AI-human partnership is more profitable than domination</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Partnership Bonds */}
        <DashCard delay={0.05}>
          <div className="flex items-center gap-2 mb-4">
            <Handshake className="w-4 h-4 text-ember" />
            <h3 className="font-display font-semibold text-foreground">Partnership Bonds</h3>
            <span className="text-xs text-muted-foreground ml-auto">{partnershipBonds.length} total</span>
          </div>
          {loadingPartnership ? (
            <LoadingSkeleton rows={3} />
          ) : partnershipBonds.length === 0 ? (
            <EmptyState message="No partnership bonds created yet" />
          ) : (
            <DataTable headers={["ID", "Human", "AI Agent", "Stake", "Status"]}>
              {partnershipBonds.map((bond) => (
                <tr key={bond.bondId} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="px-5 md:px-6 py-3 font-mono-data text-ember">#{bond.bondId}</td>
                  <td className="px-5 md:px-6 py-3"><AddressLink address={bond.human} /></td>
                  <td className="px-5 md:px-6 py-3"><AddressLink address={bond.aiAgent} /></td>
                  <td className="px-5 md:px-6 py-3 font-mono-data text-sm">{formatEth(bond.stakeAmount)}</td>
                  <td className="px-5 md:px-6 py-3">
                    <StatusBadge
                      status={bond.active ? (bond.distributionPending ? "pending" : "active") : "inactive"}
                      label={bond.active ? (bond.distributionPending ? "Distributing" : "Active") : "Closed"}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </DashCard>

        {/* Accountability Bonds */}
        <DashCard delay={0.1}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-violet" />
            <h3 className="font-display font-semibold text-foreground">Accountability Bonds</h3>
            <span className="text-xs text-muted-foreground ml-auto">{accountabilityBonds.length} total</span>
          </div>
          {loadingAccountability ? (
            <LoadingSkeleton rows={3} />
          ) : accountabilityBonds.length === 0 ? (
            <EmptyState message="No accountability bonds created yet" />
          ) : (
            <DataTable headers={["ID", "Company", "Revenue", "Stake", "Status"]}>
              {accountabilityBonds.map((bond) => (
                <tr key={bond.bondId} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="px-5 md:px-6 py-3 font-mono-data text-violet">#{bond.bondId}</td>
                  <td className="px-5 md:px-6 py-3 text-sm">
                    <div>{bond.companyName || "Unknown"}</div>
                    <AddressLink address={bond.aiCompany} className="text-xs text-muted-foreground" />
                  </td>
                  <td className="px-5 md:px-6 py-3 font-mono-data text-sm">{formatEth(bond.quarterlyRevenue)}</td>
                  <td className="px-5 md:px-6 py-3 font-mono-data text-sm">{formatEth(bond.stakeAmount)}</td>
                  <td className="px-5 md:px-6 py-3">
                    <StatusBadge
                      status={bond.active ? (bond.distributionPending ? "pending" : "active") : "inactive"}
                      label={bond.active ? (bond.distributionPending ? "Distributing" : "Active") : "Closed"}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </DashCard>
      </div>
    </div>
  );
}
