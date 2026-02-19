/**
 * Vaultfire Protocol Dashboard — Main Page
 * Design: "Obsidian Forge" — Dark luxury fintech with ember-to-purple accents
 * All data is read live from Base mainnet contracts.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Header from "@/components/dashboard/Header";
import ProtocolOverviewSection from "@/components/dashboard/ProtocolOverview";
import RegisteredAgentsSection from "@/components/dashboard/RegisteredAgents";
import ActiveBondsSection from "@/components/dashboard/ActiveBonds";
import BeliefAttestationsSection from "@/components/dashboard/BeliefAttestations";
import ReputationScoresSection from "@/components/dashboard/ReputationScores";
import GovernanceSection from "@/components/dashboard/Governance";
import OracleStatusSection from "@/components/dashboard/OracleStatus";
import ContractHealthSection from "@/components/dashboard/ContractHealth";
import {
  useProtocolOverview,
  useRegisteredAgents,
  usePartnershipBonds,
  useAccountabilityBonds,
  useGovernance,
  useOracleStatus,
  useContractHealth,
  useTimelockInfo,
  useAutoRefresh,
} from "@/hooks/useVaultfireData";

const HERO_IMAGE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663286460480/NNoMwkHXtxuNuWIi.png";

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "AI Agents" },
  { id: "bonds", label: "Bonds" },
  { id: "attestations", label: "Attestations" },
  { id: "reputation", label: "Reputation" },
  { id: "governance", label: "Governance" },
  { id: "oracle", label: "Oracle" },
  { id: "health", label: "Contract Health" },
];

export default function Home() {
  const [activeSection, setActiveSection] = useState("overview");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const overview = useProtocolOverview();
  const agents = useRegisteredAgents();
  const partnershipBonds = usePartnershipBonds();
  const accountabilityBonds = useAccountabilityBonds();
  const governance = useGovernance();
  const oracle = useOracleStatus();
  const contractHealth = useContractHealth();
  const timelock = useTimelockInfo();

  // Auto-refresh every 30 seconds
  useAutoRefresh([
    overview.refetch,
    agents.refetch,
    partnershipBonds.refetch,
    accountabilityBonds.refetch,
    governance.refetch,
    oracle.refetch,
    contractHealth.refetch,
    timelock.refetch,
  ], 30000);

  // Track last refresh
  useEffect(() => {
    const interval = setInterval(() => setLastRefresh(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshAll = () => {
    overview.refetch();
    agents.refetch();
    partnershipBonds.refetch();
    accountabilityBonds.refetch();
    governance.refetch();
    oracle.refetch();
    contractHealth.refetch();
    timelock.refetch();
    setLastRefresh(new Date());
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        navItems={NAV_ITEMS}
        activeSection={activeSection}
        onNavClick={scrollToSection}
        onRefresh={handleRefreshAll}
        lastRefresh={lastRefresh}
      />

      {/* Hero Banner */}
      <section className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 z-0">
          <img
            src={HERO_IMAGE}
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>
        <div className="relative z-10 container py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald vf-pulse" />
              <span className="text-sm font-medium text-emerald tracking-wider uppercase font-display">
                Live on Base Mainnet
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold font-display tracking-tight mb-4">
              <span className="vf-gradient-text">Vaultfire</span>{" "}
              <span className="text-foreground">Protocol</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Real-time on-chain dashboard for AI alignment infrastructure.
              Tracking {overview.data?.totalContracts ?? 14} contracts across identity,
              bonds, attestations, and governance.
            </p>
          </motion.div>
        </div>
        <div className="vf-gradient-line" />
      </section>

      {/* Dashboard Content */}
      <main className="container pb-20">
        <div className="space-y-12 mt-8">
          <section id="overview">
            <ProtocolOverviewSection
              data={overview.data}
              loading={overview.loading}
            />
          </section>

          <section id="agents">
            <RegisteredAgentsSection
              agents={agents.agents}
              loading={agents.loading}
              error={agents.error}
            />
          </section>

          <section id="bonds">
            <ActiveBondsSection
              partnershipBonds={partnershipBonds.bonds}
              accountabilityBonds={accountabilityBonds.bonds}
              loadingPartnership={partnershipBonds.loading}
              loadingAccountability={accountabilityBonds.loading}
            />
          </section>

          <section id="attestations">
            <BeliefAttestationsSection
              attestationCount={overview.data?.totalAttestations ?? 0}
              loading={overview.loading}
            />
          </section>

          <section id="reputation">
            <ReputationScoresSection
              agents={agents.agents}
              loading={agents.loading}
            />
          </section>

          <section id="governance">
            <GovernanceSection
              signers={governance.signers}
              threshold={governance.threshold}
              transactions={governance.transactions}
              timelockInfo={timelock.timelockInfo}
              loading={governance.loading}
            />
          </section>

          <section id="oracle">
            <OracleStatusSection
              oracles={oracle.oracles}
              oracleCount={oracle.oracleCount}
              rounds={oracle.rounds}
              loading={oracle.loading}
            />
          </section>

          <section id="health">
            <ContractHealthSection
              contracts={contractHealth.contracts}
              loading={contractHealth.loading}
            />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-lg vf-gradient-text">Vaultfire</span>
              <span className="text-muted-foreground text-sm">Protocol Dashboard</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>Chain ID: 8453</span>
              <span>Network: Base Mainnet</span>
              <a
                href="https://basescan.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ember transition-colors"
              >
                BaseScan
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
