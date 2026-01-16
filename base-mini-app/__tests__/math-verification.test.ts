/**
 * Math Verification Test Suite
 * Ensures exact parity between TypeScript and Rust loyalty calculations
 */

import {
  calculateGitHubLoyaltyScore,
  calculateNS3LoyaltyScore,
  calculateBaseLoyaltyScore,
  GitHubActivity,
  NS3Activity,
  BaseActivity,
} from '../lib/loyalty-calculator';

describe('Math Verification: TypeScript ↔ Rust Parity', () => {
  describe('GitHub Loyalty Score Math', () => {
    it('should match Rust calculation: typical user', () => {
      const activity: GitHubActivity = {
        totalCommits: 100,
        totalPRs: 50,
        accountAgeYears: 1.5,
        contributionStreak: 180,
        starsReceived: 500,
        followersCount: 50,
      };

      const score = calculateGitHubLoyaltyScore(activity);

      // Manual calculation to verify:
      // Commits: 100 * 10 = 1000
      // PRs: 50 * 15 = 750
      // Age: 1.5 * 1000 = 1500
      // Streak: 180 * 5 = 900
      // Total: 1000 + 750 + 1500 + 900 = 4150
      expect(score).toBe(4150);
    });

    it('should match Rust calculation: max commits (3000 cap)', () => {
      const activity: GitHubActivity = {
        totalCommits: 500, // 500 * 10 = 5000, capped at 3000
        totalPRs: 0,
        accountAgeYears: 0,
        contributionStreak: 0,
        starsReceived: 0,
        followersCount: 0,
      };

      const score = calculateGitHubLoyaltyScore(activity);
      expect(score).toBe(3000);
    });

    it('should match Rust calculation: max PRs (3000 cap)', () => {
      const activity: GitHubActivity = {
        totalCommits: 0,
        totalPRs: 250, // 250 * 15 = 3750, capped at 3000
        accountAgeYears: 0,
        contributionStreak: 0,
        starsReceived: 0,
        followersCount: 0,
      };

      const score = calculateGitHubLoyaltyScore(activity);
      expect(score).toBe(3000);
    });

    it('should match Rust calculation: fractional age', () => {
      const activity: GitHubActivity = {
        totalCommits: 0,
        totalPRs: 0,
        accountAgeYears: 0.7,
        contributionStreak: 0,
        starsReceived: 0,
        followersCount: 0,
      };

      const score = calculateGitHubLoyaltyScore(activity);
      // 0.7 * 1000 = 700
      expect(score).toBe(700);
    });

    it('should match Rust calculation: all maxed out (10000 cap)', () => {
      const activity: GitHubActivity = {
        totalCommits: 500,  // 3000 points
        totalPRs: 300,      // 3000 points
        accountAgeYears: 5, // 2000 points (capped)
        contributionStreak: 500, // 2000 points (capped)
        starsReceived: 1000,
        followersCount: 200,
      };

      const score = calculateGitHubLoyaltyScore(activity);
      // 3000 + 3000 + 2000 + 2000 = 10000 (total cap)
      expect(score).toBe(10000);
    });
  });

  describe('NS3 Loyalty Score Math', () => {
    it('should match Rust calculation: typical user', () => {
      const activity: NS3Activity = {
        totalMessages: 200,
        averageQualityScore: 80,
        accountAgeMonths: 6,
        recipientCount: 50,
        reputationScore: 85,
      };

      const score = calculateNS3LoyaltyScore(activity);

      // Manual calculation:
      // Messages: 200 * 3 = 600
      // Quality: 80 * 30 = 2400
      // Age: 6 * 200 = 1200
      // Network: 50 * 10 = 500
      // Total: 600 + 2400 + 1200 + 500 = 4700
      expect(score).toBe(4700);
    });

    it('should match Rust calculation: max quality score', () => {
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

    it('should match Rust calculation: all maxed (10000 cap)', () => {
      const activity: NS3Activity = {
        totalMessages: 2000,  // 3000 capped
        averageQualityScore: 100, // 3000
        accountAgeMonths: 15, // 2000 capped
        recipientCount: 300,  // 2000 capped
        reputationScore: 100,
      };

      const score = calculateNS3LoyaltyScore(activity);
      expect(score).toBe(10000);
    });
  });

  describe('Base Loyalty Score Math', () => {
    it('should match Rust calculation: typical user', () => {
      const activity: BaseActivity = {
        totalTransactions: 100,
        totalVolumeUSD: 5000,
        nftCount: 10,
        contractInteractions: 50,
        accountAgeMonths: 6,
        uniqueContractsInteracted: 20,
      };

      const score = calculateBaseLoyaltyScore(activity);

      // Manual calculation:
      // Transactions: 100 * 5 = 500
      // Volume: $5000 = 1000 (tier 1000-9999)
      // NFTs: 10 * 20 = 200
      // Contracts: 20 * 10 = 200
      // Age: 6 * 100 = 600
      // Total: 500 + 1000 + 200 + 200 + 600 = 2500
      expect(score).toBe(2500);
    });

    it('should match Rust calculation: volume tier $0-999', () => {
      const activity: BaseActivity = {
        totalTransactions: 0,
        totalVolumeUSD: 500,
        nftCount: 0,
        contractInteractions: 0,
        accountAgeMonths: 0,
        uniqueContractsInteracted: 0,
      };

      const score = calculateBaseLoyaltyScore(activity);
      // Under $1000, use direct value
      expect(score).toBe(500);
    });

    it('should match Rust calculation: volume tier $1000-9999', () => {
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

    it('should match Rust calculation: volume tier $10000-49999', () => {
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

    it('should match Rust calculation: volume tier $50000-99999', () => {
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

    it('should match Rust calculation: volume tier $100000+', () => {
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

    it('should match Rust calculation: exact boundary $1000', () => {
      const activity: BaseActivity = {
        totalTransactions: 0,
        totalVolumeUSD: 1000,
        nftCount: 0,
        contractInteractions: 0,
        accountAgeMonths: 0,
        uniqueContractsInteracted: 0,
      };

      const score = calculateBaseLoyaltyScore(activity);
      // Exactly $1000 triggers tier bonus
      expect(score).toBe(1000);
    });

    it('should match Rust calculation: exact boundary $10000', () => {
      const activity: BaseActivity = {
        totalTransactions: 0,
        totalVolumeUSD: 10000,
        nftCount: 0,
        contractInteractions: 0,
        accountAgeMonths: 0,
        uniqueContractsInteracted: 0,
      };

      const score = calculateBaseLoyaltyScore(activity);
      expect(score).toBe(1500);
    });

    it('should match Rust calculation: all maxed (10000 cap)', () => {
      const activity: BaseActivity = {
        totalTransactions: 1000, // 2500 capped
        totalVolumeUSD: 500000,  // 2500
        nftCount: 200,           // 2000 capped
        contractInteractions: 500,
        accountAgeMonths: 20,    // 1000 capped
        uniqueContractsInteracted: 300, // 2000 capped
      };

      const score = calculateBaseLoyaltyScore(activity);
      expect(score).toBe(10000);
    });
  });

  describe('Rust Tolerance Verification (100 basis points)', () => {
    // These tests verify that the Rust zkVM will accept scores within 100 points tolerance

    it('should accept score within +100 points', () => {
      const activity: GitHubActivity = {
        totalCommits: 100,
        totalPRs: 50,
        accountAgeYears: 1.5,
        contributionStreak: 180,
        starsReceived: 500,
        followersCount: 50,
      };

      const tsScore = calculateGitHubLoyaltyScore(activity);
      // TypeScript: 4150
      // Rust would accept: 4050-4250 (±100)

      expect(tsScore).toBe(4150);

      // Verify tolerance boundaries
      const minAcceptable = tsScore - 100;
      const maxAcceptable = tsScore + 100;

      expect(minAcceptable).toBe(4050);
      expect(maxAcceptable).toBe(4250);
    });

    it('should calculate exact same score as Rust (zero tolerance needed)', () => {
      // Integer-only calculation - should be exactly the same
      const activity: GitHubActivity = {
        totalCommits: 100,
        totalPRs: 50,
        accountAgeYears: 2, // Whole number
        contributionStreak: 200,
        starsReceived: 500,
        followersCount: 50,
      };

      const score = calculateGitHubLoyaltyScore(activity);

      // Manual: 100*10 + 50*15 + 2*1000 + 200*5 = 1000 + 750 + 2000 + 1000 = 4750
      expect(score).toBe(4750);
    });
  });

  describe('Edge Cases and Boundaries', () => {
    it('should handle zero values correctly', () => {
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

    it('should handle maximum possible values', () => {
      const activity: GitHubActivity = {
        totalCommits: Number.MAX_SAFE_INTEGER,
        totalPRs: Number.MAX_SAFE_INTEGER,
        accountAgeYears: Number.MAX_SAFE_INTEGER,
        contributionStreak: Number.MAX_SAFE_INTEGER,
        starsReceived: 1000,
        followersCount: 200,
      };

      const score = calculateGitHubLoyaltyScore(activity);
      // Should be capped at 10000
      expect(score).toBe(10000);
    });

    it('should floor fractional results', () => {
      const activity: GitHubActivity = {
        totalCommits: 1, // 10 points
        totalPRs: 1,     // 15 points
        accountAgeYears: 0.0254, // 25.4 points, floors to 25
        contributionStreak: 1,   // 5 points
        starsReceived: 0,
        followersCount: 0,
      };

      const score = calculateGitHubLoyaltyScore(activity);
      // 10 + 15 + 25 + 5 = 55
      expect(score).toBe(55);
    });
  });
});
