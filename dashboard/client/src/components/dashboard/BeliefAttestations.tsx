/**
 * Belief Attestations Section — ZK proof attestation history
 */

import { FileCheck, Lock, Cpu } from "lucide-react";
import { SectionHeader, DashCard, EmptyState, StatCard } from "./shared";
import { CONTRACTS, basescanAddress } from "@/lib/contracts";

interface Props {
  attestationCount: number;
  loading: boolean;
}

export default function BeliefAttestationsSection({ attestationCount, loading }: Props) {
  return (
    <div>
      <SectionHeader
        title="Belief Attestations"
        subtitle="Zero-knowledge proof attestations for AI alignment verification"
        icon={<FileCheck className="w-5 h-5" />}
      />

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total Attestations"
          value={attestationCount}
          icon={<FileCheck className="w-4 h-4" />}
          loading={loading}
          accent="ember"
          delay={0}
        />
        <StatCard
          label="Proof System"
          value="STARK"
          icon={<Lock className="w-4 h-4" />}
          loading={false}
          accent="violet"
          delay={0.05}
        />
        <StatCard
          label="Min Belief Threshold"
          value="80%"
          icon={<Cpu className="w-4 h-4" />}
          loading={false}
          accent="emerald"
          delay={0.1}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <DashCard delay={0.15}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-ember" />
            <h3 className="font-display font-semibold text-sm text-foreground">BeliefAttestationVerifier</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Development verifier using STARK proofs for belief attestation. Validates that AI agents meet the minimum belief alignment threshold.
          </p>
          <a
            href={basescanAddress(CONTRACTS.BeliefAttestationVerifier)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono-data text-ember hover:underline"
          >
            View on BaseScan →
          </a>
        </DashCard>

        <DashCard delay={0.2}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-violet" />
            <h3 className="font-display font-semibold text-sm text-foreground">ProductionBeliefAttestationVerifier</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Production verifier with RISC Zero integration and 48-hour timelock for image ID changes. {attestationCount} attestation{attestationCount !== 1 ? "s" : ""} recorded.
          </p>
          {attestationCount === 0 ? (
            <EmptyState message="No attestations recorded yet" />
          ) : (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono-data text-emerald">{attestationCount}</span> verified attestations on-chain
            </div>
          )}
          <a
            href={basescanAddress(CONTRACTS.ProductionBeliefAttestationVerifier)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono-data text-violet hover:underline mt-3 inline-block"
          >
            View on BaseScan →
          </a>
        </DashCard>
      </div>
    </div>
  );
}
