/**
 * Vaultfire Loyalty Score Calculator
 *
 * Calculates reputation scores (0-10000 basis points) based on user activity
 * across different platforms: GitHub, NS3 Protocol, Base Blockchain
 */

export interface GitHubActivity {
  totalCommits: number;
  totalPRs: number;
  accountAgeYears: number;
  contributionStreak: number;
  starsReceived: number;
  followersCount: number;
}

export interface NS3Activity {
  totalMessages: number;
  averageQualityScore: number; // 0-100
  accountAgeMonths: number;
  recipientCount: number;
  reputationScore: number; // 0-100
}

export interface BaseActivity {
  totalTransactions: number;
  totalVolumeUSD: number;
  nftCount: number;
  contractInteractions: number;
  accountAgeMonths: number;
  uniqueContractsInteracted: number;
}

/**
 * Calculate GitHub-based loyalty score (0-10000 basis points)
 *
 * Scoring breakdown:
 * - Commits: Up to 3000 points (10 points per commit, max 300 commits)
 * - Pull Requests: Up to 3000 points (15 points per PR, max 200 PRs)
 * - Account Age: Up to 2000 points (1000 points per year, max 2 years)
 * - Contribution Streak: Up to 2000 points (5 points per day, max 400 days)
 *
 * @param activity GitHub activity data
 * @returns Loyalty score in basis points (0-10000)
 */
export function calculateGitHubLoyaltyScore(activity: GitHubActivity): number {
  // Commits score (0-3000 points)
  const commitScore = Math.min(activity.totalCommits * 10, 3000);

  // Pull Requests score (0-3000 points)
  const prScore = Math.min(activity.totalPRs * 15, 3000);

  // Account age score (0-2000 points)
  const ageScore = Math.min(activity.accountAgeYears * 1000, 2000);

  // Contribution streak score (0-2000 points)
  const streakScore = Math.min(activity.contributionStreak * 5, 2000);

  // Total score (max 10000)
  const totalScore = Math.min(
    commitScore + prScore + ageScore + streakScore,
    10000
  );

  return Math.floor(totalScore);
}

/**
 * Calculate NS3 Protocol-based loyalty score (0-10000 basis points)
 *
 * Scoring breakdown:
 * - Message Count: Up to 3000 points (3 points per message, max 1000 messages)
 * - Quality Score: Up to 3000 points (30x average quality)
 * - Account Age: Up to 2000 points (200 points per month, max 10 months)
 * - Network Effect: Up to 2000 points (10 points per unique recipient, max 200)
 *
 * @param activity NS3 activity data
 * @returns Loyalty score in basis points (0-10000)
 */
export function calculateNS3LoyaltyScore(activity: NS3Activity): number {
  // Message count score (0-3000 points)
  const messageScore = Math.min(activity.totalMessages * 3, 3000);

  // Quality score (0-3000 points)
  const qualityScore = Math.min(activity.averageQualityScore * 30, 3000);

  // Account age score (0-2000 points)
  const ageScore = Math.min(activity.accountAgeMonths * 200, 2000);

  // Network effect score (0-2000 points)
  const networkScore = Math.min(activity.recipientCount * 10, 2000);

  // Total score (max 10000)
  const totalScore = Math.min(
    messageScore + qualityScore + ageScore + networkScore,
    10000
  );

  return Math.floor(totalScore);
}

/**
 * Calculate Base blockchain activity-based loyalty score (0-10000 basis points)
 *
 * Scoring breakdown:
 * - Transaction Count: Up to 2500 points (5 points per tx, max 500 txs)
 * - Volume: Up to 2500 points (based on USD volume tiers)
 * - NFT Holdings: Up to 2000 points (20 points per NFT, max 100 NFTs)
 * - Contract Interactions: Up to 2000 points (10 points per unique contract, max 200)
 * - Account Age: Up to 1000 points (100 points per month, max 10 months)
 *
 * @param activity Base blockchain activity data
 * @returns Loyalty score in basis points (0-10000)
 */
export function calculateBaseLoyaltyScore(activity: BaseActivity): number {
  // Transaction count score (0-2500 points)
  const txScore = Math.min(activity.totalTransactions * 5, 2500);

  // Volume score (0-2500 points) - tiered
  let volumeScore = 0;
  if (activity.totalVolumeUSD >= 100000) {
    volumeScore = 2500;
  } else if (activity.totalVolumeUSD >= 50000) {
    volumeScore = 2000;
  } else if (activity.totalVolumeUSD >= 10000) {
    volumeScore = 1500;
  } else if (activity.totalVolumeUSD >= 1000) {
    volumeScore = 1000;
  } else {
    volumeScore = Math.min(activity.totalVolumeUSD, 1000);
  }

  // NFT holdings score (0-2000 points)
  const nftScore = Math.min(activity.nftCount * 20, 2000);

  // Contract interaction score (0-2000 points)
  const contractScore = Math.min(activity.uniqueContractsInteracted * 10, 2000);

  // Account age score (0-1000 points)
  const ageScore = Math.min(activity.accountAgeMonths * 100, 1000);

  // Total score (max 10000)
  const totalScore = Math.min(
    txScore + volumeScore + nftScore + contractScore + ageScore,
    10000
  );

  return Math.floor(totalScore);
}

/**
 * Fetch GitHub activity data for a user
 * @param username GitHub username
 * @returns GitHub activity data
 */
export async function fetchGitHubActivity(username: string): Promise<GitHubActivity> {
  try {
    // Fetch user data
    const userResponse = await fetch(`https://api.github.com/users/${username}`);
    if (!userResponse.ok) {
      throw new Error(`GitHub API error: ${userResponse.statusText}`);
    }
    const userData = await userResponse.json();

    // Fetch repos
    const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`);
    const repos = await reposResponse.json();

    // Calculate stats
    const totalCommits = repos.reduce((sum: number, repo: any) => {
      return sum + (repo.size || 0); // Approximation
    }, 0);

    const accountCreated = new Date(userData.created_at);
    const accountAgeYears = (Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24 * 365);

    // Fetch contribution activity (requires authentication for accurate data)
    // For now, use approximations
    const contributionStreak = Math.min(Math.floor(accountAgeYears * 100), 400);

    return {
      totalCommits: Math.min(totalCommits, 1000),
      totalPRs: userData.public_repos || 0,
      accountAgeYears,
      contributionStreak,
      starsReceived: repos.reduce((sum: number, repo: any) => sum + (repo.stargazers_count || 0), 0),
      followersCount: userData.followers || 0,
    };
  } catch (error) {
    console.error('Error fetching GitHub activity:', error);
    throw error;
  }
}

/**
 * Generate activity proof data (to be submitted with ZK proof)
 * @param moduleId Module ID (0=GitHub, 1=NS3, 2=Base)
 * @param activity Activity data
 * @returns JSON string of activity proof
 */
export function generateActivityProof(
  moduleId: number,
  activity: GitHubActivity | NS3Activity | BaseActivity
): string {
  return JSON.stringify({
    moduleId,
    activity,
    timestamp: Date.now(),
  });
}
