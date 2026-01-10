/**
 * Governance & DAO Integration Example
 *
 * Shows how to use Vaultfire for:
 * - Reputation-weighted voting
 * - Anonymous member verification
 * - Delegate trust scores
 * - Proposal gating by reputation
 */

import { VaultfireSDK, ModuleType } from '../vaultfire';
import { Wallet } from 'ethers';

// ============================================================================
// Example 1: Reputation-Weighted Voting
// ============================================================================

async function reputationWeightedVoting(sdk: VaultfireSDK, voterAddress: string) {
  console.log('\n--- DAO Example: Reputation-Weighted Voting ---\n');

  // Get voter's attestations to calculate reputation
  const attestations = await sdk.getAttestations(voterAddress, 100);

  // Different attestation types have different weights
  const weights = {
    [ModuleType.GITHUB]: 3, // Open source = high trust
    [ModuleType.GOVERNANCE]: 5, // Previous governance = highest
    [ModuleType.REPUTATION]: 2,
    [ModuleType.BASE]: 1,
  };

  const votingPower = attestations
    .filter((a) => a.zkVerified)
    .reduce((power, a) => {
      const weight = weights[a.moduleId as keyof typeof weights] || 1;
      return power + weight;
    }, 0);

  const baseVotes = 1; // Everyone gets 1 base vote
  const totalVotes = baseVotes + Math.min(votingPower, 50); // Cap at 50 bonus

  console.log(`Voter: ${voterAddress}`);
  console.log(`Attestations: ${attestations.length}`);
  console.log(`\nVoting power breakdown:`);
  console.log(`  Base votes: ${baseVotes}`);
  console.log(`  Reputation bonus: ${votingPower} (capped at 50)`);
  console.log(`  Total voting power: ${totalVotes}`);

  return totalVotes;
}

// ============================================================================
// Example 2: Anonymous Member Verification
// ============================================================================

async function anonymousMemberVerification(sdk: VaultfireSDK) {
  console.log('\n--- DAO Example: Anonymous Member Verification ---\n');

  // Verify membership without revealing identity
  const membershipBelief = 'DAO member since Q1 2025';

  const result = await sdk.verifyBelief({
    beliefHash: sdk.hashBelief(membershipBelief),
    moduleId: ModuleType.GOVERNANCE,
    metadata: {
      joinDate: '2025-01-15',
      contributions: 23,
      // Real identity stays private
    },
  });

  if (result.verified) {
    console.log('✓ Membership verified!');
    console.log('  Attestation ID:', result.attestationId);
    console.log('\nMember can now:');
    console.log('  • Vote on proposals (anonymously)');
    console.log('  • Access member-only channels');
    console.log('  • Receive token distributions');
    console.log('  • Build governance reputation');
    console.log('\n  All without revealing wallet or identity!');
  }

  return result.verified;
}

// ============================================================================
// Example 3: Delegate Trust Scores
// ============================================================================

async function delegateTrustScore(sdk: VaultfireSDK, delegateAddress: string) {
  console.log('\n--- DAO Example: Delegate Trust Score ---\n');

  const attestations = await sdk.getAttestations(delegateAddress, 200);

  // Analyze delegate's governance track record
  const govAttestations = attestations.filter(
    (a) => a.zkVerified && a.moduleId === ModuleType.GOVERNANCE
  );

  // Calculate trust metrics
  const proposalsVoted = govAttestations.length;
  const consistency = proposalsVoted > 0 ? Math.min(proposalsVoted / 20, 1) : 0;
  const longevity = govAttestations.length > 0
    ? (Date.now() / 1000 - Math.min(...govAttestations.map((a) => a.timestamp))) /
      (365 * 24 * 60 * 60) // Years active
    : 0;

  const trustScore = Math.round(
    consistency * 40 + longevity * 30 + Math.min(proposalsVoted / 100, 0.3) * 30
  );

  console.log(`Delegate: ${delegateAddress}`);
  console.log(`\nTrust metrics:`);
  console.log(`  Proposals voted: ${proposalsVoted}`);
  console.log(`  Voting consistency: ${(consistency * 100).toFixed(1)}%`);
  console.log(`  Years active: ${longevity.toFixed(1)}`);
  console.log(`\nTrust score: ${trustScore}/100`);

  if (trustScore >= 80) {
    console.log('  Rating: Highly Trusted ⭐⭐⭐');
  } else if (trustScore >= 50) {
    console.log('  Rating: Trusted ⭐⭐');
  } else if (trustScore >= 25) {
    console.log('  Rating: Active ⭐');
  } else {
    console.log('  Rating: New Delegate');
  }

  return trustScore;
}

// ============================================================================
// Example 4: Reputation-Gated Proposals
// ============================================================================

async function reputationGatedProposals(sdk: VaultfireSDK, proposerAddress: string) {
  console.log('\n--- DAO Example: Reputation-Gated Proposals ---\n');

  const attestations = await sdk.getAttestations(proposerAddress, 100);

  // Requirements for proposal submission
  const REQUIREMENTS = {
    minAttestations: 10,
    minGovernance: 5,
    minAge: 90 * 24 * 60 * 60, // 90 days
  };

  const totalAttestations = attestations.filter((a) => a.zkVerified).length;
  const governanceAttestations = attestations.filter(
    (a) => a.zkVerified && a.moduleId === ModuleType.GOVERNANCE
  ).length;

  const oldestAttestation = attestations.length > 0
    ? Math.min(...attestations.map((a) => a.timestamp))
    : Date.now() / 1000;
  const accountAge = Date.now() / 1000 - oldestAttestation;

  const canPropose =
    totalAttestations >= REQUIREMENTS.minAttestations &&
    governanceAttestations >= REQUIREMENTS.minGovernance &&
    accountAge >= REQUIREMENTS.minAge;

  console.log(`Proposer: ${proposerAddress}`);
  console.log(`\nProposal requirements:`);
  console.log(
    `  Total attestations: ${totalAttestations}/${REQUIREMENTS.minAttestations} ${
      totalAttestations >= REQUIREMENTS.minAttestations ? '✓' : '✗'
    }`
  );
  console.log(
    `  Governance attestations: ${governanceAttestations}/${REQUIREMENTS.minGovernance} ${
      governanceAttestations >= REQUIREMENTS.minGovernance ? '✓' : '✗'
    }`
  );
  console.log(
    `  Account age: ${Math.floor(accountAge / 86400)} days (min: 90) ${
      accountAge >= REQUIREMENTS.minAge ? '✓' : '✗'
    }`
  );

  console.log(`\nCan submit proposal: ${canPropose ? 'YES ✓' : 'NO ✗'}`);

  if (!canPropose) {
    console.log('\nTo qualify:');
    if (totalAttestations < REQUIREMENTS.minAttestations) {
      console.log(`  • Earn ${REQUIREMENTS.minAttestations - totalAttestations} more attestations`);
    }
    if (governanceAttestations < REQUIREMENTS.minGovernance) {
      console.log(
        `  • Participate in ${REQUIREMENTS.minGovernance - governanceAttestations} more votes`
      );
    }
    if (accountAge < REQUIREMENTS.minAge) {
      console.log(`  • Wait ${Math.ceil((REQUIREMENTS.minAge - accountAge) / 86400)} more days`);
    }
  }

  return canPropose;
}

// ============================================================================
// Main Example Runner
// ============================================================================

async function main() {
  const sdk = new VaultfireSDK({ chain: 'base' });
  // const wallet = new Wallet(process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001");
  sdk.connect(wallet);

  console.log('═══════════════════════════════════════════');
  console.log('  Vaultfire Governance & DAO Examples');
  console.log('═══════════════════════════════════════════');

  await reputationWeightedVoting(sdk, wallet.address);
  await anonymousMemberVerification(sdk);
  await delegateTrustScore(sdk, wallet.address);
  await reputationGatedProposals(sdk, wallet.address);

  console.log('\n═══════════════════════════════════════════');
  console.log('  Examples completed!');
  console.log('═══════════════════════════════════════════\n');
}

if (require.main === module) {
  main().catch(console.error);
}

export {
  reputationWeightedVoting,
  anonymousMemberVerification,
  delegateTrustScore,
  reputationGatedProposals,
};
