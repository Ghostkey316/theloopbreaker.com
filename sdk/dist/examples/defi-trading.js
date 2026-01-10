"use strict";
/**
 * DeFi & Trading Integration Example
 *
 * Shows how to use Vaultfire for:
 * - Proving trading track record
 * - Sybil-resistant airdrops
 * - Privacy-preserved credit scores
 * - Reputation-weighted lending
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.proveTradingProfit = proveTradingProfit;
exports.sybilResistantAirdrop = sybilResistantAirdrop;
exports.privacyCreditScore = privacyCreditScore;
exports.reputationWeightedLP = reputationWeightedLP;
const vaultfire_1 = require("../vaultfire");
const ethers_1 = require("ethers");
// ============================================================================
// Example 1: Prove Trading Profitability (without revealing positions)
// ============================================================================
async function proveTradingProfit(sdk) {
    console.log('\n--- DeFi Example: Prove Trading Profit ---\n');
    // Trader proves they achieved 15% profit in Q1 without revealing trades
    const statement = 'Achieved +15% profit in Q1 2026';
    const result = await sdk.verifyBelief({
        beliefHash: sdk.hashBelief(statement),
        moduleId: vaultfire_1.ModuleType.REPUTATION,
        metadata: {
            // Metadata stays off-chain
            pnl: '+15%',
            trades: 47,
            period: 'Q1 2026',
        },
    });
    if (result.verified) {
        console.log('✓ Trading profit verified!');
        console.log('  TX:', result.txHash);
        console.log('  Gas used:', result.gasUsed?.toString());
        console.log('\nTrader can now:');
        console.log('  • Access lower fees on DEXes');
        console.log('  • Qualify for pro trading features');
        console.log('  • Build anonymous reputation');
    }
}
// ============================================================================
// Example 2: Sybil-Resistant Airdrop
// ============================================================================
async function sybilResistantAirdrop(sdk, userAddress) {
    console.log('\n--- DeFi Example: Sybil-Resistant Airdrop ---\n');
    // Protocol checks if user has real activity attestations
    const attestations = await sdk.getAttestations(userAddress, 100);
    // Filter for genuine activity (not just wallet creation)
    const realActivity = attestations.filter((a) => a.zkVerified &&
        [vaultfire_1.ModuleType.GITHUB, vaultfire_1.ModuleType.BASE, vaultfire_1.ModuleType.REPUTATION].includes(a.moduleId));
    const qualifies = realActivity.length >= 5; // Minimum threshold
    console.log(`User: ${userAddress}`);
    console.log(`Real activity attestations: ${realActivity.length}`);
    console.log(`Qualifies for airdrop: ${qualifies ? 'YES ✓' : 'NO ✗'}`);
    if (qualifies) {
        console.log('\nAirdrop allocation:');
        console.log(`  Base: 100 tokens`);
        console.log(`  Bonus: ${realActivity.length * 10} tokens (reputation)`);
        console.log(`  Total: ${100 + realActivity.length * 10} tokens`);
    }
    return qualifies;
}
// ============================================================================
// Example 3: Privacy-Preserved Credit Score
// ============================================================================
async function privacyCreditScore(sdk) {
    console.log('\n--- DeFi Example: Privacy Credit Score ---\n');
    // User proves creditworthiness without revealing financial details
    const beliefs = [
        'No liquidations in past 12 months',
        'Portfolio value > $10k',
        'Active DeFi user for 2+ years',
    ];
    const results = await Promise.all(beliefs.map((belief) => sdk.verifyBelief({
        beliefHash: sdk.hashBelief(belief),
        moduleId: vaultfire_1.ModuleType.REPUTATION,
    })));
    const score = results.filter((r) => r.verified).length;
    console.log(`Credit factors verified: ${score}/${beliefs.length}`);
    console.log('\nLending eligibility:');
    if (score >= 3) {
        console.log('  • Tier: Premium ⭐');
        console.log('  • Max borrow: $50,000');
        console.log('  • Interest rate: 5% APY');
    }
    else if (score >= 2) {
        console.log('  • Tier: Standard');
        console.log('  • Max borrow: $10,000');
        console.log('  • Interest rate: 8% APY');
    }
    else {
        console.log('  • Tier: Limited');
        console.log('  • Max borrow: $1,000');
        console.log('  • Interest rate: 12% APY');
    }
    return score;
}
// ============================================================================
// Example 4: Reputation-Weighted Liquidity Pools
// ============================================================================
async function reputationWeightedLP(sdk, lpProvider) {
    console.log('\n--- DeFi Example: Reputation-Weighted LP ---\n');
    // LP providers with better reputation get higher yield
    const attestations = await sdk.getAttestations(lpProvider, 100);
    const reputationScore = attestations.filter((a) => a.zkVerified && a.moduleId === vaultfire_1.ModuleType.REPUTATION).length;
    const baseAPY = 10; // 10% base for everyone
    const reputationBonus = Math.min(reputationScore * 0.5, 15); // Up to +15%
    const totalAPY = baseAPY + reputationBonus;
    console.log(`LP Provider: ${lpProvider}`);
    console.log(`Reputation score: ${reputationScore} attestations`);
    console.log(`\nYield breakdown:`);
    console.log(`  Base APY: ${baseAPY}%`);
    console.log(`  Reputation bonus: +${reputationBonus.toFixed(1)}%`);
    console.log(`  Total APY: ${totalAPY.toFixed(1)}%`);
    return totalAPY;
}
// ============================================================================
// Main Example Runner
// ============================================================================
async function main() {
    // Initialize SDK
    const sdk = new vaultfire_1.VaultfireSDK({ chain: 'base' });
    // Connect wallet (in production, use user's wallet)
    const wallet = new ethers_1.Wallet(process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey);
    sdk.connect(wallet);
    console.log('═══════════════════════════════════════════');
    console.log('  Vaultfire DeFi Integration Examples');
    console.log('═══════════════════════════════════════════');
    // Run examples
    await proveTradingProfit(sdk);
    await sybilResistantAirdrop(sdk, wallet.address);
    await privacyCreditScore(sdk);
    await reputationWeightedLP(sdk, wallet.address);
    console.log('\n═══════════════════════════════════════════');
    console.log('  Examples completed!');
    console.log('═══════════════════════════════════════════\n');
}
// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}
