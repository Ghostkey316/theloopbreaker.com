/**
 * Reputation Scores Section — Data from ERC8004ReputationRegistry
 * Fetches reputation for each registered agent
 */

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { Star } from "lucide-react";
import { SectionHeader, DashCard, EmptyState, LoadingSkeleton, AddressLink, DataTable } from "./shared";
import { CONTRACTS, ERC8004ReputationRegistryABI } from "@/lib/contracts";
import type { AgentInfo } from "@/hooks/useVaultfireData";

interface AgentReputation {
  address: string;
  averageRating: number;
  totalFeedbacks: number;
  verifiedFeedbacks: number;
  lastUpdated: number;
}

interface Props {
  agents: AgentInfo[];
  loading: boolean;
}

const BASE_NETWORK = new ethers.Network("base", 8453);

export default function ReputationScoresSection({ agents, loading }: Props) {
  const [reputations, setReputations] = useState<AgentReputation[]>([]);
  const [repLoading, setRepLoading] = useState(true);

  const fetchReputations = useCallback(async () => {
    if (agents.length === 0) {
      setReputations([]);
      setRepLoading(false);
      return;
    }

    try {
      setRepLoading(true);
      const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", BASE_NETWORK, { staticNetwork: BASE_NETWORK });
      const contract = new ethers.Contract(CONTRACTS.ERC8004ReputationRegistry, ERC8004ReputationRegistryABI, provider);

      const results: AgentReputation[] = [];
      for (const agent of agents) {
        try {
          const rep = await contract.getReputation(agent.address);
          results.push({
            address: agent.address,
            averageRating: Number(rep[0] ?? rep.averageRating),
            totalFeedbacks: Number(rep[1] ?? rep.totalFeedbacks),
            verifiedFeedbacks: Number(rep[2] ?? rep.verifiedFeedbacks),
            lastUpdated: Number(rep[3] ?? rep.lastUpdated),
          });
        } catch {
          results.push({
            address: agent.address,
            averageRating: 0,
            totalFeedbacks: 0,
            verifiedFeedbacks: 0,
            lastUpdated: 0,
          });
        }
      }

      setReputations(results);
    } catch {
      // Silent fail
    } finally {
      setRepLoading(false);
    }
  }, [agents]);

  useEffect(() => {
    fetchReputations();
  }, [fetchReputations]);

  const isLoading = loading || repLoading;

  // Rating is in basis points (0-10000), convert to percentage
  function formatRating(bps: number) {
    if (bps === 0) return "—";
    return `${(bps / 100).toFixed(1)}%`;
  }

  function ratingColor(bps: number) {
    if (bps === 0) return "text-muted-foreground";
    if (bps >= 8000) return "text-emerald";
    if (bps >= 5000) return "text-ember";
    return "text-destructive";
  }

  return (
    <div>
      <SectionHeader
        title="Reputation Scores"
        subtitle="Agent reputation from ERC-8004 Reputation Registry"
        icon={<Star className="w-5 h-5" />}
      />
      <DashCard>
        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : reputations.length === 0 ? (
          <EmptyState message="No reputation data available — no agents registered yet" />
        ) : (
          <DataTable headers={["Agent", "Avg Rating", "Total Feedbacks", "Verified", "Last Updated"]}>
            {reputations.map((rep) => (
              <tr key={rep.address} className="hover:bg-surface-hover/50 transition-colors">
                <td className="px-5 md:px-6 py-3.5">
                  <AddressLink address={rep.address} />
                </td>
                <td className={`px-5 md:px-6 py-3.5 font-mono-data font-semibold ${ratingColor(rep.averageRating)}`}>
                  {formatRating(rep.averageRating)}
                </td>
                <td className="px-5 md:px-6 py-3.5 font-mono-data text-sm text-foreground">
                  {rep.totalFeedbacks}
                </td>
                <td className="px-5 md:px-6 py-3.5 font-mono-data text-sm text-foreground">
                  {rep.verifiedFeedbacks}
                </td>
                <td className="px-5 md:px-6 py-3.5 text-sm text-muted-foreground font-mono-data">
                  {rep.lastUpdated > 0
                    ? new Date(rep.lastUpdated * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </DashCard>
    </div>
  );
}
