/**
 * Contract Health Section — All 14 contracts with verification status, owners, BaseScan links
 */

import { Heart, ExternalLink, CheckCircle, XCircle, ArrowLeftRight } from "lucide-react";
import { motion } from "framer-motion";
import { SectionHeader, DashCard, LoadingSkeleton, AddressLink, StatusBadge } from "./shared";
import { basescanAddress, snowtraceAddress, AVAX_CONTRACTS } from "@/lib/contracts";
import type { ContractHealth } from "@/hooks/useVaultfireData";

interface Props {
  contracts: ContractHealth[];
  loading: boolean;
}

// Contract descriptions for context
const CONTRACT_DESCRIPTIONS: Record<string, string> = {
  PrivacyGuarantees: "GDPR-aligned privacy with consent management and data deletion",
  MissionEnforcement: "Enforces protocol mission alignment across contracts",
  AntiSurveillance: "Blocks surveillance data types and bans violating modules",
  ERC8004IdentityRegistry: "Sovereign AI agent identities with portable reputation",
  BeliefAttestationVerifier: "STARK proof verification for belief attestations (dev)",
  ERC8004ReputationRegistry: "Agent reputation tracking with feedback system",
  ERC8004ValidationRegistry: "Cross-platform agent validation with staking",
  AIPartnershipBondsV2: "AI-Human partnership bonds with yield pool",
  AIAccountabilityBondsV2: "AI accountability bonds — works with zero employment",
  VaultfireERC8004Adapter: "Bridges Vaultfire bonds with ERC-8004 ecosystem",
  MultisigGovernance: "Multi-signature governance for protocol changes",
  FlourishingMetricsOracle: "Consensus-based oracle for flourishing metrics",
  ProductionBeliefAttestationVerifier: "Production RISC Zero verifier with timelock",
  VaultfireTeleporterBridge: "Cross-chain trust bridge — Base ↔ Avalanche via Teleporter",
};

export default function ContractHealthSection({ contracts, loading }: Props) {
  const deployedCount = contracts.filter(c => c.hasCode).length;

  return (
    <div>
      <SectionHeader
        title="Contract Health"
        subtitle="Deployment status and ownership for all 14 protocol contracts"
        icon={<Heart className="w-5 h-5" />}
        badge={
          <span className="text-xs font-mono-data text-emerald bg-emerald-glow px-3 py-1.5 rounded-md border border-emerald/30">
            {deployedCount}/14 deployed
          </span>
        }
      />

      {loading ? (
        <DashCard>
          <LoadingSkeleton rows={14} />
        </DashCard>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contracts.map((contract, i) => {
            const isBridge = contract.name === "VaultfireTeleporterBridge";
            const explorerUrl = basescanAddress(contract.address);

            return (
              <motion.div
                key={contract.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className={`vf-card rounded-xl p-5 group ${isBridge ? "border border-ember/20 bg-ember-glow/5" : ""}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isBridge ? (
                      <ArrowLeftRight className="w-4 h-4 text-ember flex-shrink-0" />
                    ) : contract.hasCode ? (
                      <CheckCircle className="w-4 h-4 text-emerald flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                    )}
                    <h3 className="font-display font-semibold text-sm text-foreground leading-tight">
                      {contract.name}
                    </h3>
                  </div>
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-surface-hover transition-colors text-muted-foreground hover:text-ember opacity-0 group-hover:opacity-100"
                    title="View on BaseScan"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  {CONTRACT_DESCRIPTIONS[contract.name] || "Protocol contract"}
                </p>

                {/* Address — Base */}
                <div className="mb-2">
                  <span className="text-xs text-muted-foreground block mb-1">
                    {isBridge ? "Base Mainnet" : "Address"}
                  </span>
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono-data text-xs text-foreground hover:text-ember transition-colors break-all"
                  >
                    {contract.address}
                  </a>
                </div>

                {/* Avalanche address for bridge */}
                {isBridge && (
                  <div className="mb-3">
                    <span className="text-xs text-muted-foreground block mb-1">Avalanche C-Chain</span>
                    <a
                      href={snowtraceAddress(AVAX_CONTRACTS.VaultfireTeleporterBridge)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono-data text-xs text-foreground hover:text-ember transition-colors break-all"
                    >
                      {AVAX_CONTRACTS.VaultfireTeleporterBridge}
                    </a>
                  </div>
                )}

                {/* Owner & Status */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/30">
                  <div className="text-xs">
                    {contract.owner ? (
                      <span className="text-muted-foreground">
                        Owner: <AddressLink address={contract.owner} className="text-xs" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No owner function</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isBridge && (
                      <StatusBadge
                        status="healthy"
                        label="Cross-chain"
                      />
                    )}
                    {contract.paused !== null && !isBridge && (
                      <StatusBadge
                        status={contract.paused ? "paused" : "active"}
                        label={contract.paused ? "Paused" : "Active"}
                      />
                    )}
                    <StatusBadge
                      status={contract.hasCode ? "healthy" : "inactive"}
                      label={contract.hasCode ? "Deployed" : "Not Found"}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
