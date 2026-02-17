/**
 * Protocol Overview Section — KPI cards showing aggregate stats
 */

import { Users, Link2, Shield, Activity, FileCheck, MessageSquare } from "lucide-react";
import { StatCard } from "./shared";
import type { ProtocolOverview } from "@/hooks/useVaultfireData";

interface Props {
  data: ProtocolOverview | null;
  loading: boolean;
}

export default function ProtocolOverviewSection({ data, loading }: Props) {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Contracts"
          value={data?.totalContracts ?? 13}
          icon={<Shield className="w-4 h-4" />}
          loading={loading}
          delay={0}
          accent="violet"
        />
        <StatCard
          label="AI Agents"
          value={data?.totalAgents ?? 0}
          icon={<Users className="w-4 h-4" />}
          loading={loading}
          delay={0.05}
          accent="ember"
        />
        <StatCard
          label="Partnership Bonds"
          value={data?.totalPartnershipBonds ?? 0}
          icon={<Link2 className="w-4 h-4" />}
          loading={loading}
          delay={0.1}
          accent="emerald"
        />
        <StatCard
          label="Accountability Bonds"
          value={data?.totalAccountabilityBonds ?? 0}
          icon={<Activity className="w-4 h-4" />}
          loading={loading}
          delay={0.15}
          accent="violet"
        />
        <StatCard
          label="Attestations"
          value={data?.totalAttestations ?? 0}
          icon={<FileCheck className="w-4 h-4" />}
          loading={loading}
          delay={0.2}
          accent="ember"
        />
        <StatCard
          label="Feedbacks"
          value={data?.totalFeedbacks ?? 0}
          icon={<MessageSquare className="w-4 h-4" />}
          loading={loading}
          delay={0.25}
          accent="emerald"
        />
      </div>
    </div>
  );
}
