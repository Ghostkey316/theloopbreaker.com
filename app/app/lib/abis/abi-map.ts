// ABI lookup map for contracts.ts
// Maps contract names to their ABIs for each chain

import { MissionEnforcement_ABI } from './MissionEnforcement';
import { AntiSurveillance_ABI } from './AntiSurveillance';
import { PrivacyGuarantees_ABI } from './PrivacyGuarantees';
import { ERC8004IdentityRegistry_ABI } from './ERC8004IdentityRegistry';
import { BeliefAttestationVerifier_ABI } from './BeliefAttestationVerifier';
import { AIPartnershipBondsV2_ABI } from './AIPartnershipBondsV2';
import { FlourishingMetricsOracle_ABI } from './FlourishingMetricsOracle';
import { AIAccountabilityBondsV2_ABI } from './AIAccountabilityBondsV2';
import { ERC8004ReputationRegistry_ABI } from './ERC8004ReputationRegistry';
import { ERC8004ValidationRegistry_ABI } from './ERC8004ValidationRegistry';
import { VaultfireERC8004Adapter_ABI } from './VaultfireERC8004Adapter';
import { MultisigGovernance_ABI } from './MultisigGovernance';
import { ProductionBeliefAttestationVerifier_ABI } from './ProductionBeliefAttestationVerifier';
import { DilithiumAttestor_ABI } from './DilithiumAttestor';
import { VaultfireTeleporterBridge_ABI } from './VaultfireTeleporterBridge';
import { TrustDataBridge_ABI } from './TrustDataBridge';

/** Lookup table: contract name → ABI array */
export const ABI_MAP: Record<string, readonly any[]> = {
  MissionEnforcement: MissionEnforcement_ABI,
  AntiSurveillance: AntiSurveillance_ABI,
  PrivacyGuarantees: PrivacyGuarantees_ABI,
  ERC8004IdentityRegistry: ERC8004IdentityRegistry_ABI,
  BeliefAttestationVerifier: BeliefAttestationVerifier_ABI,
  AIPartnershipBondsV2: AIPartnershipBondsV2_ABI,
  FlourishingMetricsOracle: FlourishingMetricsOracle_ABI,
  AIAccountabilityBondsV2: AIAccountabilityBondsV2_ABI,
  ERC8004ReputationRegistry: ERC8004ReputationRegistry_ABI,
  ERC8004ValidationRegistry: ERC8004ValidationRegistry_ABI,
  VaultfireERC8004Adapter: VaultfireERC8004Adapter_ABI,
  MultisigGovernance: MultisigGovernance_ABI,
  ProductionBeliefAttestationVerifier: ProductionBeliefAttestationVerifier_ABI,
  DilithiumAttestor: DilithiumAttestor_ABI,
  VaultfireTeleporterBridge: VaultfireTeleporterBridge_ABI,
  TrustDataBridge: TrustDataBridge_ABI,
};

/** Get ABI for a contract by name. Returns empty array if not found. */
export function getABI(contractName: string): readonly any[] {
  return ABI_MAP[contractName] ?? [];
}
