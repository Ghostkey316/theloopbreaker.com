/**
 * Comprehensive test suite for Loyalty Score Calculators
 * Tests edge cases, boundary conditions, and scoring algorithms
 */

import {
  calculateGitHubLoyaltyScore,
  calculateNS3LoyaltyScore,
  calculateBaseLoyaltyScore,
  fetchGitHubActivity,
  generateActivityProof,
  GitHubActivity,
  NS3Activity,
  BaseActivity,
} from '../lib/loyalty-calculator';

describe('GitHub Loyalty Calculator', () => {
  it('should calculate score for typical GitHub user', () => {
    const activity: GitHubActivity = {
      totalCommits: 100,
      totalPRs: 50,
      accountAgeYears: 1.5,
      contributionStreak: 180,
      starsReceived: 500,
      followersCount: 50,
    };

    const score = calculateGitHubLoyaltyScore(activity);

    // Commits: 100 * 10 = 1000
    // PRs: 50 * 15 = 750
    // Age: 1.5 * 1000 = 1500
    // Streak: 180 * 5 = 900
    // Total: 4150
    expect(score).toBe(4150);
  });

  it('should cap total score at 10000', () => {
    const activity: GitHubActivity = {
      totalCommits: 500, // Would be 5000 points
      totalPRs: 300,     // Would be 4500 points
      accountAgeYears: 5,
      contributionStreak: 500,
      starsReceived: 1000,
      followersCount: 200,
    };

    const score = calculateGitHubLoyaltyScore(activity);
    expect(score).toBe(10000);
  });

  it('should cap commit score at 3000', () => {
    const activity: GitHubActivity = {
      totalCommits: 500, // 500 * 10 = 5000, but capped at 3000
      totalPRs: 0,
      accountAgeYears: 0,
      contributionStreak: 0,
      starsReceived: 0,
      followersCount: 0,
    };

    const score = calculateGitHubLoyaltyScore(activity);
    expect(score).toBe(3000);
  });

  it('should cap PR score at 3000', () => {
    const activity: GitHubActivity = {
      totalCommits: 0,
      totalPRs: 250, // 250 * 15 = 3750, but capped at 3000
      accountAgeYears: 0,
      contributionStreak: 0,
      starsReceived: 0,
      followersCount: 0,
    };

    const score = calculateGitHubLoyaltyScore(activity);
    expect(score).toBe(3000);
  });

  it('should cap account age score at 2000', () => {
    const activity: GitHubActivity = {
      totalCommits: 0,
      totalPRs: 0,
      accountAgeYears: 5, // 5 * 1000 = 5000, but capped at 2000
      contributionStreak: 0,
      starsReceived: 0,
      followersCount: 0,
    };

    const score = calculateGitHubLoyaltyScore(activity);
    expect(score).toBe(2000);
  });

  it('should cap streak score at 2000', () => {
    const activity: GitHubActivity = {
      totalCommits: 0,
      totalPRs: 0,
      accountAgeYears: 0,
      contributionStreak: 500, // 500 * 5 = 2500, but capped at 2000
      starsReceived: 0,
      followersCount: 0,
    };

    const score = calculateGitHubLoyaltyScore(activity);
    expect(score).toBe(2000);
  });

  it('should return 0 for new account with no activity', () => {
    const activity: GitHubActivity = {
      totalCommits: 0,
      totalPRs: 0,
      accountAgeYears: 0,
      contributionStreak: 0,
      starsReceived: 0,
      followersCount: 0,
    };

    const score = calculateGitHubLoyaltyScore(activity);
    expect(score).toBe(0);
  });

  it('should handle fractional account age correctly', () => {
    const activity: GitHubActivity = {
      totalCommits: 0,
      totalPRs: 0,
      accountAgeYears: 0.5, // 6 months
      contributionStreak: 0,
      starsReceived: 0,
      followersCount: 0,
    };

    const score = calculateGitHubLoyaltyScore(activity);
    expect(score).toBe(500); // 0.5 * 1000
  });
});

describe('NS3 Loyalty Calculator', () => {
  it('should calculate score for typical NS3 user', () => {
    const activity: NS3Activity = {
      totalMessages: 200,
      averageQualityScore: 80,
      accountAgeMonths: 6,
      recipientCount: 50,
      reputationScore: 85,
    };

    const score = calculateNS3LoyaltyScore(activity);

    // Messages: 200 * 3 = 600
    // Quality: 80 * 30 = 2400
    // Age: 6 * 200 = 1200
    // Network: 50 * 10 = 500
    // Total: 4700
    expect(score).toBe(4700);
  });

  it('should cap total score at 10000', () => {
    const activity: NS3Activity = {
      totalMessages: 2000,
      averageQualityScore: 100,
      accountAgeMonths: 15,
      recipientCount: 300,
      reputationScore: 100,
    };

    const score = calculateNS3LoyaltyScore(activity);
    expect(score).toBe(10000);
  });

  it('should cap message score at 3000', () => {
    const activity: NS3Activity = {
      totalMessages: 1500, // 1500 * 3 = 4500, capped at 3000
      averageQualityScore: 0,
      accountAgeMonths: 0,
      recipientCount: 0,
      reputationScore: 0,
    };

    const score = calculateNS3LoyaltyScore(activity);
    expect(score).toBe(3000);
  });

  it('should cap quality score at 3000', () => {
    const activity: NS3Activity = {
      totalMessages: 0,
      averageQualityScore: 100, // 100 * 30 = 3000
      accountAgeMonths: 0,
      recipientCount: 0,
      reputationScore: 0,
    };

    const score = calculateNS3LoyaltyScore(activity);
    expect(score).toBe(3000);
  });

  it('should return 0 for new account with no activity', () => {
    const activity: NS3Activity = {
      totalMessages: 0,
      averageQualityScore: 0,
      accountAgeMonths: 0,
      recipientCount: 0,
      reputationScore: 0,
    };

    const score = calculateNS3LoyaltyScore(activity);
    expect(score).toBe(0);
  });
});

describe('Base Loyalty Calculator', () => {
  it('should calculate score for typical Base user', () => {
    const activity: BaseActivity = {
      totalTransactions: 100,
      totalVolumeUSD: 5000,
      nftCount: 10,
      contractInteractions: 50,
      accountAgeMonths: 6,
      uniqueContractsInteracted: 20,
    };

    const score = calculateBaseLoyaltyScore(activity);

    // Transactions: 100 * 5 = 500
    // Volume: $5000 = 1000 points (tier)
    // NFTs: 10 * 20 = 200
    // Contracts: 20 * 10 = 200
    // Age: 6 * 100 = 600
    // Total: 2500
    expect(score).toBe(2500);
  });

  it('should handle volume tier: <$1000', () => {
    const activity: BaseActivity = {
      totalTransactions: 0,
      totalVolumeUSD: 500,
      nftCount: 0,
      contractInteractions: 0,
      accountAgeMonths: 0,
      uniqueContractsInteracted: 0,
    };

    const score = calculateBaseLoyaltyScore(activity);
    expect(score).toBe(500); // Direct value under $1000
  });

  it('should handle volume tier: $1000-$9999', () => {
    const activity: BaseActivity = {
      totalTransactions: 0,
      totalVolumeUSD: 5000,
      nftCount: 0,
      contractInteractions: 0,
      accountAgeMonths: 0,
      uniqueContractsInteracted: 0,
    };

    const score = calculateBaseLoyaltyScore(activity);
    expect(score).toBe(1000);
  });

  it('should handle volume tier: $10000-$49999', () => {
    const activity: BaseActivity = {
      totalTransactions: 0,
      totalVolumeUSD: 25000,
      nftCount: 0,
      contractInteractions: 0,
      accountAgeMonths: 0,
      uniqueContractsInteracted: 0,
    };

    const score = calculateBaseLoyaltyScore(activity);
    expect(score).toBe(1500);
  });

  it('should handle volume tier: $50000-$99999', () => {
    const activity: BaseActivity = {
      totalTransactions: 0,
      totalVolumeUSD: 75000,
      nftCount: 0,
      contractInteractions: 0,
      accountAgeMonths: 0,
      uniqueContractsInteracted: 0,
    };

    const score = calculateBaseLoyaltyScore(activity);
    expect(score).toBe(2000);
  });

  it('should handle volume tier: $100000+', () => {
    const activity: BaseActivity = {
      totalTransactions: 0,
      totalVolumeUSD: 200000,
      nftCount: 0,
      contractInteractions: 0,
      accountAgeMonths: 0,
      uniqueContractsInteracted: 0,
    };

    const score = calculateBaseLoyaltyScore(activity);
    expect(score).toBe(2500);
  });

  it('should cap transaction score at 2500', () => {
    const activity: BaseActivity = {
      totalTransactions: 1000, // 1000 * 5 = 5000, capped at 2500
      totalVolumeUSD: 0,
      nftCount: 0,
      contractInteractions: 0,
      accountAgeMonths: 0,
      uniqueContractsInteracted: 0,
    };

    const score = calculateBaseLoyaltyScore(activity);
    expect(score).toBe(2500);
  });

  it('should cap NFT score at 2000', () => {
    const activity: BaseActivity = {
      totalTransactions: 0,
      totalVolumeUSD: 0,
      nftCount: 150, // 150 * 20 = 3000, capped at 2000
      contractInteractions: 0,
      accountAgeMonths: 0,
      uniqueContractsInteracted: 0,
    };

    const score = calculateBaseLoyaltyScore(activity);
    expect(score).toBe(2000);
  });

  it('should cap contract interaction score at 2000', () => {
    const activity: BaseActivity = {
      totalTransactions: 0,
      totalVolumeUSD: 0,
      nftCount: 0,
      contractInteractions: 0,
      accountAgeMonths: 0,
      uniqueContractsInteracted: 250, // 250 * 10 = 2500, capped at 2000
    };

    const score = calculateBaseLoyaltyScore(activity);
    expect(score).toBe(2000);
  });

  it('should cap account age score at 1000', () => {
    const activity: BaseActivity = {
      totalTransactions: 0,
      totalVolumeUSD: 0,
      nftCount: 0,
      contractInteractions: 0,
      accountAgeMonths: 15, // 15 * 100 = 1500, capped at 1000
      uniqueContractsInteracted: 0,
    };

    const score = calculateBaseLoyaltyScore(activity);
    expect(score).toBe(1000);
  });

  it('should cap total score at 10000', () => {
    const activity: BaseActivity = {
      totalTransactions: 1000,
      totalVolumeUSD: 500000,
      nftCount: 200,
      contractInteractions: 500,
      accountAgeMonths: 20,
      uniqueContractsInteracted: 300,
    };

    const score = calculateBaseLoyaltyScore(activity);
    expect(score).toBe(10000);
  });

  it('should return 0 for new account with no activity', () => {
    const activity: BaseActivity = {
      totalTransactions: 0,
      totalVolumeUSD: 0,
      nftCount: 0,
      contractInteractions: 0,
      accountAgeMonths: 0,
      uniqueContractsInteracted: 0,
    };

    const score = calculateBaseLoyaltyScore(activity);
    expect(score).toBe(0);
  });
});

describe('Activity Proof Generation', () => {
  it('should generate valid JSON proof for GitHub', () => {
    const activity: GitHubActivity = {
      totalCommits: 100,
      totalPRs: 50,
      accountAgeYears: 1.5,
      contributionStreak: 180,
      starsReceived: 500,
      followersCount: 50,
    };

    const proof = generateActivityProof(0, activity);
    const parsed = JSON.parse(proof);

    expect(parsed.moduleId).toBe(0);
    expect(parsed.activity).toEqual(activity);
    expect(parsed.timestamp).toBeGreaterThan(0);
  });

  it('should generate valid JSON proof for NS3', () => {
    const activity: NS3Activity = {
      totalMessages: 200,
      averageQualityScore: 80,
      accountAgeMonths: 6,
      recipientCount: 50,
      reputationScore: 85,
    };

    const proof = generateActivityProof(1, activity);
    const parsed = JSON.parse(proof);

    expect(parsed.moduleId).toBe(1);
    expect(parsed.activity).toEqual(activity);
  });

  it('should generate valid JSON proof for Base', () => {
    const activity: BaseActivity = {
      totalTransactions: 100,
      totalVolumeUSD: 5000,
      nftCount: 10,
      contractInteractions: 50,
      accountAgeMonths: 6,
      uniqueContractsInteracted: 20,
    };

    const proof = generateActivityProof(2, activity);
    const parsed = JSON.parse(proof);

    expect(parsed.moduleId).toBe(2);
    expect(parsed.activity).toEqual(activity);
  });
});

describe('fetchGitHubActivity', () => {
  it('should handle GitHub API errors gracefully', async () => {
    // Mock fetch to return error
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({}),
      } as Response)
    );

    await expect(fetchGitHubActivity('nonexistent-user'))
      .rejects
      .toThrow('GitHub API error: Not Found');
  });

  it('should handle network errors', async () => {
    // Mock fetch to throw network error
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('Network error'))
    );

    await expect(fetchGitHubActivity('test-user'))
      .rejects
      .toThrow('Network error');
  });
});
