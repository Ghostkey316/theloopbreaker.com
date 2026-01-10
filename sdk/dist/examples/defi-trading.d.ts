/**
 * DeFi & Trading Integration Example
 *
 * Shows how to use Vaultfire for:
 * - Proving trading track record
 * - Sybil-resistant airdrops
 * - Privacy-preserved credit scores
 * - Reputation-weighted lending
 */
import { VaultfireSDK } from '../vaultfire';
declare function proveTradingProfit(sdk: VaultfireSDK): Promise<void>;
declare function sybilResistantAirdrop(sdk: VaultfireSDK, userAddress: string): Promise<boolean>;
declare function privacyCreditScore(sdk: VaultfireSDK): Promise<number>;
declare function reputationWeightedLP(sdk: VaultfireSDK, lpProvider: string): Promise<number>;
export { proveTradingProfit, sybilResistantAirdrop, privacyCreditScore, reputationWeightedLP };
