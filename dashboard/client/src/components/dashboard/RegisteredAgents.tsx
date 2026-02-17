/**
 * Registered AI Agents Section — List from ERC8004IdentityRegistry
 */

import { Bot } from "lucide-react";
import { SectionHeader, DashCard, EmptyState, LoadingSkeleton, AddressLink, StatusBadge, DataTable } from "./shared";
import type { AgentInfo } from "@/hooks/useVaultfireData";

interface Props {
  agents: AgentInfo[];
  loading: boolean;
  error: string | null;
}

function formatDate(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function RegisteredAgentsSection({ agents, loading, error }: Props) {
  return (
    <div>
      <SectionHeader
        title="Registered AI Agents"
        subtitle="Sovereign identities from ERC-8004 Identity Registry"
        icon={<Bot className="w-5 h-5" />}
        badge={
          <span className="text-xs font-mono-data text-muted-foreground bg-surface px-3 py-1.5 rounded-md border border-border/50">
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </span>
        }
      />
      <DashCard>
        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : error ? (
          <EmptyState message={error} />
        ) : agents.length === 0 ? (
          <EmptyState message="No agents registered yet" />
        ) : (
          <DataTable headers={["Agent Address", "Type", "Registered", "Status"]}>
            {agents.map((agent) => (
              <tr key={agent.address} className="hover:bg-surface-hover/50 transition-colors">
                <td className="px-5 md:px-6 py-3.5">
                  <AddressLink address={agent.address} />
                </td>
                <td className="px-5 md:px-6 py-3.5 text-sm text-foreground">
                  {agent.agentType || "Unknown"}
                </td>
                <td className="px-5 md:px-6 py-3.5 text-sm text-muted-foreground font-mono-data">
                  {formatDate(agent.registeredAt)}
                </td>
                <td className="px-5 md:px-6 py-3.5">
                  <StatusBadge status={agent.active ? "active" : "inactive"} />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </DashCard>
    </div>
  );
}
