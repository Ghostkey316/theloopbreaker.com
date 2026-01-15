/**
 * Governance & DAO Integration Example
 *
 * Shows how to use Vaultfire for:
 * - Reputation-weighted voting
 * - Anonymous member verification
 * - Delegate trust scores
 * - Proposal gating by reputation
 */
import { VaultfireSDK } from '../vaultfire';
declare function reputationWeightedVoting(sdk: VaultfireSDK, voterAddress: string): Promise<number>;
declare function anonymousMemberVerification(sdk: VaultfireSDK): Promise<boolean>;
declare function delegateTrustScore(sdk: VaultfireSDK, delegateAddress: string): Promise<number>;
declare function reputationGatedProposals(sdk: VaultfireSDK, proposerAddress: string): Promise<boolean>;
export { reputationWeightedVoting, anonymousMemberVerification, delegateTrustScore, reputationGatedProposals, };
