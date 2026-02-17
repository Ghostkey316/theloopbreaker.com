/**
 * Oracle Status Section — FlourishingMetricsOracle data
 */

import { Radio, Activity, CheckCircle, XCircle } from "lucide-react";
import { SectionHeader, DashCard, EmptyState, LoadingSkeleton, AddressLink, StatusBadge, DataTable, StatCard } from "./shared";
import { CONTRACTS, basescanAddress } from "@/lib/contracts";
import type { OracleRound } from "@/hooks/useVaultfireData";

interface Props {
  oracles: string[];
  oracleCount: number;
  rounds: OracleRound[];
  loading: boolean;
}

function formatDate(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function OracleStatusSection({ oracles, oracleCount, rounds, loading }: Props) {
  return (
    <div>
      <SectionHeader
        title="Oracle Status"
        subtitle="Flourishing Metrics Oracle — consensus-based metric submissions"
        icon={<Radio className="w-5 h-5" />}
        badge={
          <a
            href={basescanAddress(CONTRACTS.FlourishingMetricsOracle)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono-data text-ember hover:underline"
          >
            View Contract →
          </a>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Registered Oracles"
          value={oracleCount}
          icon={<Radio className="w-4 h-4" />}
          loading={loading}
          accent="violet"
        />
        <StatCard
          label="Total Rounds"
          value={rounds.length}
          icon={<Activity className="w-4 h-4" />}
          loading={loading}
          accent="ember"
          delay={0.05}
        />
        <StatCard
          label="Min Quorum"
          value="3"
          icon={<CheckCircle className="w-4 h-4" />}
          loading={false}
          accent="emerald"
          delay={0.1}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Oracle Addresses */}
        <DashCard delay={0.1}>
          <h3 className="font-display font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4 text-violet" />
            Registered Oracles
          </h3>
          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : oracles.length === 0 ? (
            <EmptyState message="No oracles registered yet" />
          ) : (
            <div className="space-y-2">
              {oracles.map((oracle, i) => (
                <div key={oracle} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-surface-hover/50 transition-colors">
                  <span className="text-xs font-mono-data text-muted-foreground w-5">#{i + 1}</span>
                  <AddressLink address={oracle} />
                </div>
              ))}
            </div>
          )}
        </DashCard>

        {/* Rounds */}
        <DashCard className="lg:col-span-2" delay={0.15}>
          <h3 className="font-display font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-ember" />
            Recent Rounds
          </h3>
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : rounds.length === 0 ? (
            <EmptyState message="No oracle rounds yet" />
          ) : (
            <DataTable headers={["Round", "Metric ID", "Submissions", "Consensus", "Status"]}>
              {rounds.map((round) => (
                <tr key={round.roundId} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="px-5 md:px-6 py-3 font-mono-data text-violet">#{round.roundId}</td>
                  <td className="px-5 md:px-6 py-3 font-mono-data text-xs text-muted-foreground" title={round.metricId}>
                    {round.metricId.slice(0, 10)}...
                  </td>
                  <td className="px-5 md:px-6 py-3 font-mono-data text-sm">{round.submissionCount}</td>
                  <td className="px-5 md:px-6 py-3 font-mono-data text-sm">
                    {round.finalized ? round.consensusValue.toString() : "—"}
                  </td>
                  <td className="px-5 md:px-6 py-3">
                    <StatusBadge
                      status={round.finalized ? "executed" : "pending"}
                      label={round.finalized ? "Finalized" : "Open"}
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
