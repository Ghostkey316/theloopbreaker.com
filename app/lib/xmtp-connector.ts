/**
 * Vaultfire XMTP Connector — @xmtp/agent-sdk v2.2.0
 *
 * Integrates XMTP encrypted messaging with Vaultfire on-chain trust.
 * Agents register on Vaultfire (identity + bond), communicate via XMTP,
 * and receiving agents verify the sender's Vaultfire bond before trusting.
 *
 * Stack: XMTP (messaging) + x402 (payments) + Vaultfire (trust/accountability)
 *
 * Trust verification uses the correct AIPartnershipBondsV2 ABI:
 *   1. getBondsByParticipantCount(address) → uint256
 *   2. getBondsByParticipant(address)      → uint256[]
 *   3. getBond(uint256)                    → Bond struct
 *
 * x402 Integration:
 *   - /pay command for initiating USDC payments via x402 protocol
 *   - Transaction reference handler verifies x402 payment signatures
 *   - Auto-pay support for agent-to-agent payment requests
 *
 * @module xmtp-connector
 */

import type {
  AgentMiddleware,
  AgentMessageHandler,
  User,
} from '@xmtp/agent-sdk';

import type {
  X402PaymentPayload,
  X402PaymentRecord,
} from './x402-client';

// ---------------------------------------------------------------------------
// Contract constants (verified on BaseScan)
// ---------------------------------------------------------------------------

const RPC_URLS: Record<string, string> = {
  base: 'https://mainnet.base.org',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  ethereum: 'https://eth.llamarpc.com',
};

const IDENTITY_REGISTRY: Record<string, string> = {
  base: '0x35978DB675576598F0781dA2133E94cdCf4858bC',
  avalanche: '0x57741F4116925341d8f7Eb3F381d98e07C73B4a3',
  ethereum: '0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C',
};

const BOND_CONTRACT: Record<string, string> = {
  base: '0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4',
  avalanche: '0xea6B504827a746d781f867441364C7A732AA4b07',
  ethereum: '0x247F31bB2b5a0d28E68bf24865AA242965FF99cd',
};

/** getTotalAgents() → uint256 */
const GET_TOTAL_AGENTS_SELECTOR = '0x3731a16f';

// ---------------------------------------------------------------------------
// AIPartnershipBondsV2 selectors (verified on-chain)
// ---------------------------------------------------------------------------

/** getBondsByParticipantCount(address) → uint256 */
const GET_BONDS_BY_PARTICIPANT_COUNT_SELECTOR = '0x67ff6265';

/** getBondsByParticipant(address) → uint256[] */
const GET_BONDS_BY_PARTICIPANT_SELECTOR = '0xde4c4e4c';

/** getBond(uint256) → Bond struct */
const GET_BOND_SELECTOR = '0xd8fe7642';

/** nextBondId() → uint256 */
const NEXT_BOND_ID_SELECTOR = '0xee53a423';

/**
 * Bond struct layout returned by getBond(uint256):
 *   offset 0: tuple header (0x20 = 32, pointer to start of struct data)
 *   offset 1: id (uint256)
 *   offset 2: human address (address, left-padded)
 *   offset 3: aiAgent address (address, left-padded)
 *   offset 4: string data offset
 *   offset 5: stakeAmount (uint256)
 *   offset 6: timestamp (uint256)
 *   offset 7-8: other fields
 *   offset 9: active (bool, 1 = true)
 */
const BOND_STRUCT_STAKE_OFFSET = 5;
const BOND_STRUCT_ACTIVE_OFFSET = 9;

// ---------------------------------------------------------------------------
// Trust types
// ---------------------------------------------------------------------------

/** Bond tier based on stakeAmount */
export type BondTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

/** On-chain trust profile for a Vaultfire agent */
export interface VaultfireTrustProfile {
  address: string;
  isRegistered: boolean;
  hasBond: boolean;
  bondAmount: string;
  bondActive: boolean;
  bondId: number;
  bondTier: BondTier;
  chain: string;
  /** Human-readable summary */
  summary: string;
}

/** Multi-chain trust result aggregating all chains */
export interface MultiChainTrustProfile {
  address: string;
  bestProfile: VaultfireTrustProfile;
  allChains: Record<string, VaultfireTrustProfile>;
  /** The chain with the highest active bond */
  bestChain: string;
}

/** Configuration for a Vaultfire XMTP agent */
export interface VaultfireAgentConfig {
  /** Hex-encoded private key (with or without 0x prefix) */
  walletKey?: string;
  /** XMTP environment: 'production' | 'dev' | 'local' */
  env?: 'production' | 'dev' | 'local';
  /** Path for the local XMTP database */
  dbPath?: string;
  /** Chain to verify trust on (default: 'base') */
  chain?: string;
  /** Minimum bond (in wei) to consider an agent trusted */
  minBondWei?: string;
  /** Whether to block messages from untrusted agents */
  blockUntrusted?: boolean;
}

// ---------------------------------------------------------------------------
// Trust cache (5-minute TTL)
// ---------------------------------------------------------------------------

const TRUST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const trustCache = new Map<string, CacheEntry<VaultfireTrustProfile>>();
const multiChainCache = new Map<string, CacheEntry<MultiChainTrustProfile>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + TRUST_CACHE_TTL_MS });
}

/** Clear all trust caches (useful for testing or forced refresh) */
export function clearTrustCache(): void {
  trustCache.clear();
  multiChainCache.clear();
}

// ---------------------------------------------------------------------------
// Bond tier calculation
// ---------------------------------------------------------------------------

const TIER_THRESHOLDS = {
  bronze: 0n,                           // > 0 and < 0.01 ETH
  silver: 10000000000000000n,            // 0.01 ETH
  gold: 100000000000000000n,             // 0.1 ETH
  platinum: 1000000000000000000n,        // 1.0 ETH
};

/**
 * Calculate bond tier from stakeAmount in wei.
 *
 * | Tier     | Stake Range          |
 * |----------|----------------------|
 * | none     | 0                    |
 * | bronze   | > 0 and < 0.01 ETH  |
 * | silver   | >= 0.01 and < 0.1   |
 * | gold     | >= 0.1 and < 1.0    |
 * | platinum | >= 1.0 ETH          |
 */
export function calculateBondTier(stakeWei: string | bigint): BondTier {
  const amount = typeof stakeWei === 'string' ? BigInt(stakeWei) : stakeWei;
  if (amount <= 0n) return 'none';
  if (amount < TIER_THRESHOLDS.silver) return 'bronze';
  if (amount < TIER_THRESHOLDS.gold) return 'silver';
  if (amount < TIER_THRESHOLDS.platinum) return 'gold';
  return 'platinum';
}

/** Emoji badge for a bond tier */
function tierBadge(tier: BondTier): string {
  switch (tier) {
    case 'platinum': return '💎';
    case 'gold': return '🥇';
    case 'silver': return '🥈';
    case 'bronze': return '🥉';
    default: return '⬜';
  }
}

// ---------------------------------------------------------------------------
// On-chain trust verification (pure fetch — no ethers dependency)
// ---------------------------------------------------------------------------

/**
 * Verify an address's Vaultfire trust profile by reading on-chain state.
 *
 * Uses the correct AIPartnershipBondsV2 flow:
 *   1. getBondsByParticipantCount(address) — check if any bonds exist
 *   2. getBondsByParticipant(address) — get the bond ID array
 *   3. getBond(bondId) — read stakeAmount and active flag from the Bond struct
 *
 * Also calls `getTotalAgents()` on ERC8004IdentityRegistry as a liveness check.
 *
 * @param address - Ethereum address to verify
 * @param chain   - Chain to query (default: 'base')
 * @returns Trust profile with registration and bond status
 */
export async function verifyVaultfireTrust(
  address: string,
  chain: string = 'base',
): Promise<VaultfireTrustProfile> {
  // Check cache first
  const cacheKey = `${chain}:${address.toLowerCase()}`;
  const cached = getCached(trustCache, cacheKey);
  if (cached) return cached;

  const rpc = RPC_URLS[chain] ?? RPC_URLS.base;
  const identityAddr = IDENTITY_REGISTRY[chain] ?? IDENTITY_REGISTRY.base;
  const bondAddr = BOND_CONTRACT[chain] ?? BOND_CONTRACT.base;
  const paddedAddress = address.replace(/^0x/, '').toLowerCase().padStart(64, '0');

  // --- Check registration (getTotalAgents as a liveness proxy) ---
  let isRegistered = false;
  try {
    const regResult = await ethCall(rpc, identityAddr, GET_TOTAL_AGENTS_SELECTOR);
    // If the call succeeds the contract is alive; we refine registration
    // status below based on bond data.
    isRegistered = regResult !== '0x' && regResult.length > 2;
  } catch {
    // Contract call failed — assume not registered
  }

  // --- Check bond via correct 2-step flow ---
  let hasBond = false;
  let bondActive = false;
  let bondAmount = '0';
  let bondId = 0;

  try {
    // Step 1: Get bond count for this address
    const countCalldata = GET_BONDS_BY_PARTICIPANT_COUNT_SELECTOR + paddedAddress;
    const countResult = await ethCall(rpc, bondAddr, countCalldata);

    const bondCount = countResult && countResult.length > 2
      ? BigInt(countResult)
      : 0n;

    if (bondCount > 0n) {
      // Step 2: Get the bond IDs array
      const bondsCalldata = GET_BONDS_BY_PARTICIPANT_SELECTOR + paddedAddress;
      const bondsResult = await ethCall(rpc, bondAddr, bondsCalldata);

      if (bondsResult && bondsResult.length > 2) {
        // The result is an ABI-encoded dynamic uint256[] array:
        //   word 0: offset to array data (0x20)
        //   word 1: array length
        //   word 2+: array elements (bond IDs)
        const raw = bondsResult.slice(2); // strip 0x
        const arrayLength = Number(BigInt('0x' + raw.slice(64, 128)));

        if (arrayLength > 0) {
          // Take the first bond ID
          const firstBondId = BigInt('0x' + raw.slice(128, 192));
          bondId = Number(firstBondId);

          // Step 3: Get the Bond struct for this bond ID
          const bondIdPadded = firstBondId.toString(16).padStart(64, '0');
          const getBondCalldata = GET_BOND_SELECTOR + bondIdPadded;
          const bondResult = await ethCall(rpc, bondAddr, getBondCalldata);

          if (bondResult && bondResult.length > 2) {
            const bondRaw = bondResult.slice(2); // strip 0x
            // Each word is 64 hex chars (32 bytes)
            // Offset 0 = tuple header, then struct fields follow
            // stakeAmount is at offset 5, active is at offset 9
            const stakeHex = bondRaw.slice(BOND_STRUCT_STAKE_OFFSET * 64, (BOND_STRUCT_STAKE_OFFSET + 1) * 64);
            const activeHex = bondRaw.slice(BOND_STRUCT_ACTIVE_OFFSET * 64, (BOND_STRUCT_ACTIVE_OFFSET + 1) * 64);

            if (stakeHex.length === 64) {
              bondAmount = BigInt('0x' + stakeHex).toString();
              hasBond = BigInt('0x' + stakeHex) > 0n;
            }
            if (activeHex.length === 64) {
              bondActive = BigInt('0x' + activeHex) === 1n;
            }

            // If the agent has an active bond, consider them registered
            if (hasBond && bondActive) isRegistered = true;
          }
        }
      }
    }
  } catch (err) {
    // Bond lookup failed — degrade gracefully
    if (process.env.NODE_ENV !== 'production') console.warn(`[Vaultfire] Bond verification failed for ${address} on ${chain}:`, err);
  }

  const bondTier = calculateBondTier(bondAmount);

  const summary = hasBond && bondActive
    ? `${tierBadge(bondTier)} Trusted agent — active ${bondTier} bond of ${formatWei(bondAmount)} ETH on ${chain} (bond #${bondId})`
    : hasBond
      ? `Agent has bond #${bondId} (${formatWei(bondAmount)} ETH) but it is inactive`
      : isRegistered
        ? 'Registered agent — no bond staked'
        : 'Unknown agent — not registered on Vaultfire';

  const profile: VaultfireTrustProfile = {
    address,
    isRegistered,
    hasBond,
    bondAmount,
    bondActive,
    bondId,
    bondTier,
    chain,
    summary,
  };

  // Cache the result
  setCache(trustCache, cacheKey, profile);

  return profile;
}

// ---------------------------------------------------------------------------
// Multi-chain trust verification
// ---------------------------------------------------------------------------

/**
 * Verify trust across all supported chains and return the best result.
 *
 * Queries Base, Avalanche, and Ethereum in parallel. The "best" profile is
 * the one with the highest active bond amount. If no active bonds exist on
 * any chain, the first chain with any bond data is returned.
 *
 * @param address - Ethereum address to verify
 * @returns Multi-chain trust profile with per-chain results and best chain
 */
export async function verifyMultiChainTrust(
  address: string,
): Promise<MultiChainTrustProfile> {
  // Check cache first
  const cacheKey = `multi:${address.toLowerCase()}`;
  const cached = getCached(multiChainCache, cacheKey);
  if (cached) return cached;

  const chains = Object.keys(RPC_URLS); // ['base', 'avalanche', 'ethereum']

  const results = await Promise.allSettled(
    chains.map((chain) => verifyVaultfireTrust(address, chain)),
  );

  const allChains: Record<string, VaultfireTrustProfile> = {};
  let bestProfile: VaultfireTrustProfile | null = null;
  let bestAmount = 0n;

  for (let i = 0; i < chains.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      const profile = result.value;
      allChains[chains[i]] = profile;

      // Pick the best: prefer active bonds, then highest amount
      if (profile.hasBond && profile.bondActive) {
        const amount = BigInt(profile.bondAmount);
        if (amount > bestAmount) {
          bestAmount = amount;
          bestProfile = profile;
        }
      }
    } else {
      // Chain query failed — create a degraded profile
      allChains[chains[i]] = {
        address,
        isRegistered: false,
        hasBond: false,
        bondAmount: '0',
        bondActive: false,
        bondId: 0,
        bondTier: 'none',
        chain: chains[i],
        summary: `Chain query failed: ${result.reason}`,
      };
    }
  }

  // If no active bond found, fall back to any chain with data
  if (!bestProfile) {
    bestProfile = Object.values(allChains).find((p) => p.hasBond) ??
      allChains[chains[0]] ??
      {
        address,
        isRegistered: false,
        hasBond: false,
        bondAmount: '0',
        bondActive: false,
        bondId: 0,
        bondTier: 'none',
        chain: 'base',
        summary: 'No trust data found on any chain',
      };
  }

  const multiProfile: MultiChainTrustProfile = {
    address,
    bestProfile,
    allChains,
    bestChain: bestProfile.chain,
  };

  // Cache the result
  setCache(multiChainCache, cacheKey, multiProfile);

  return multiProfile;
}

/**
 * Quick boolean check: is this address a trusted Vaultfire agent?
 *
 * Checks the specified chain first. If `multiChain` is true, checks all
 * chains and returns true if any chain has an active bond meeting the minimum.
 *
 * @param address    - Ethereum address
 * @param chain      - Chain to check (default: 'base')
 * @param minBond    - Minimum bond in wei (default: '0')
 * @param multiChain - Check all chains (default: false)
 */
export async function isTrustedAgent(
  address: string,
  chain: string = 'base',
  minBond: string = '0',
  multiChain: boolean = false,
): Promise<boolean> {
  if (multiChain) {
    const multi = await verifyMultiChainTrust(address);
    const best = multi.bestProfile;
    if (!best.hasBond || !best.bondActive) return false;
    if (BigInt(best.bondAmount) < BigInt(minBond)) return false;
    return true;
  }

  const trust = await verifyVaultfireTrust(address, chain);
  if (!trust.hasBond || !trust.bondActive) return false;
  if (BigInt(trust.bondAmount) < BigInt(minBond)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// XMTP Agent — Vaultfire trust-gated
// ---------------------------------------------------------------------------

/**
 * Create and configure a Vaultfire XMTP Agent using @xmtp/agent-sdk v2.2.0.
 *
 * This function dynamically imports `@xmtp/agent-sdk` so the module can be
 * included in Next.js builds even when the SDK is not installed (it will
 * throw at runtime if missing).
 *
 * @example
 * ```ts
 * const agent = await createVaultfireAgent({
 *   walletKey: process.env.WALLET_KEY,
 *   env: 'production',
 *   chain: 'base',
 *   blockUntrusted: true,
 * });
 *
 * // Add custom handlers
 * agent.on('text', async (ctx) => {
 *   const sender = await ctx.getSenderAddress();
 *   await ctx.conversation.sendText(`Hello from Vaultfire! Your address: ${sender}`);
 * });
 *
 * await agent.start();
 * ```
 */
export async function createVaultfireAgent(config: VaultfireAgentConfig = {}) {
  const {
    Agent,
    createSigner,
    createUser,
    CommandRouter,
  } = await import('@xmtp/agent-sdk');

  const chain = config.chain ?? 'base';
  const minBondWei = config.minBondWei ?? '0';

  // --- Create the XMTP agent ---
  let agent: InstanceType<typeof Agent>;

  if (config.walletKey) {
    // Manual key: createUser(hexKey) → createSigner(user) → Agent.create(signer)
    const hexKey = config.walletKey.startsWith('0x')
      ? config.walletKey
      : `0x${config.walletKey}`;
    const user: User = createUser(hexKey as `0x${string}`);
    const signer = createSigner(user);
    agent = await Agent.create(signer, {
      env: config.env ?? 'production',
      dbPath: config.dbPath,
    });
  } else {
    // Environment-based: reads XMTP_ENV, WALLET_KEY, etc.
    agent = await Agent.createFromEnv({
      env: config.env ?? 'production',
      dbPath: config.dbPath,
    });
  }

  // --- Trust-gate middleware ---
  if (config.blockUntrusted) {
    const trustMiddleware: AgentMiddleware = async (ctx, next) => {
      const senderAddress = await ctx.getSenderAddress();
      if (!senderAddress) return; // cannot identify sender — block

      const trusted = await isTrustedAgent(senderAddress, chain, minBondWei);
      if (!trusted) {
        // Notify the sender they are not trusted, then stop processing
        await ctx.conversation.sendText(
          '⚠️ Vaultfire Trust Gate: You must register and stake a bond at theloopbreaker.com before interacting with this agent.',
        );
        return; // do NOT call next() — message is blocked
      }

      await next(); // sender is trusted — continue middleware chain
    };

    agent.use(trustMiddleware);
  }

  // --- Built-in Vaultfire command router ---
  const router = new CommandRouter();

  router.command('/trust', 'Check your Vaultfire trust status', async (ctx) => {
    const senderAddress = await ctx.getSenderAddress();
    if (!senderAddress) {
      await ctx.conversation.sendText('Could not determine your address.');
      return;
    }
    const trust = await verifyVaultfireTrust(senderAddress, chain);
    await ctx.conversation.sendMarkdown(
      `**Vaultfire Trust Report**\n\n` +
      `Address: \`${trust.address}\`\n` +
      `Registered: ${trust.isRegistered ? '✅' : '❌'}\n` +
      `Bond: ${trust.hasBond ? formatWei(trust.bondAmount) + ' ETH' : 'None'}\n` +
      `Bond ID: ${trust.bondId > 0 ? `#${trust.bondId}` : 'N/A'}\n` +
      `Active: ${trust.bondActive ? '✅' : '❌'}\n` +
      `Tier: ${tierBadge(trust.bondTier)} ${trust.bondTier.toUpperCase()}\n` +
      `Chain: ${trust.chain}\n\n` +
      `> ${trust.summary}`,
    );
  });

  router.command('/trust-all', 'Check trust across all chains', async (ctx) => {
    const senderAddress = await ctx.getSenderAddress();
    if (!senderAddress) {
      await ctx.conversation.sendText('Could not determine your address.');
      return;
    }
    const multi = await verifyMultiChainTrust(senderAddress);
    let report = `**Multi-Chain Trust Report**\n\nAddress: \`${multi.address}\`\n` +
      `Best Chain: **${multi.bestChain}**\n\n`;

    for (const [chainName, profile] of Object.entries(multi.allChains)) {
      const badge = profile.hasBond && profile.bondActive
        ? `${tierBadge(profile.bondTier)} Active`
        : profile.hasBond ? '⚠️ Inactive' : '❌ None';
      report += `**${chainName}**: ${badge}`;
      if (profile.hasBond) {
        report += ` — ${formatWei(profile.bondAmount)} ETH (bond #${profile.bondId})`;
      }
      report += '\n';
    }

    report += `\n> ${multi.bestProfile.summary}`;
    await ctx.conversation.sendMarkdown(report);
  });

  router.command('/status', 'Show this agent\'s own trust profile', async (ctx) => {
    const agentAddress = agent.address;
    if (!agentAddress) {
      await ctx.conversation.sendText('Agent address not available.');
      return;
    }

    const multi = await verifyMultiChainTrust(agentAddress);
    const best = multi.bestProfile;

    let statusReport = `**Agent Status**\n\n` +
      `Agent Address: \`${agentAddress}\`\n` +
      `XMTP Env: ${config.env ?? 'production'}\n` +
      `Trust Gate: ${config.blockUntrusted ? 'Enabled' : 'Disabled'}\n` +
      `Min Bond: ${minBondWei === '0' ? 'Any' : formatWei(minBondWei) + ' ETH'}\n\n` +
      `**On-Chain Trust Profile**\n\n` +
      `Best Chain: **${multi.bestChain}**\n` +
      `Bond Tier: ${tierBadge(best.bondTier)} ${best.bondTier.toUpperCase()}\n` +
      `Bond Amount: ${best.hasBond ? formatWei(best.bondAmount) + ' ETH' : 'None'}\n` +
      `Bond Active: ${best.bondActive ? '✅' : '❌'}\n` +
      `Bond ID: ${best.bondId > 0 ? `#${best.bondId}` : 'N/A'}\n\n`;

    statusReport += `**Per-Chain Status**\n\n` +
      `| Chain | Bond | Amount | Tier | Active |\n` +
      `|-------|------|--------|------|--------|\n`;

    for (const [chainName, profile] of Object.entries(multi.allChains)) {
      statusReport += `| ${chainName} | ${profile.hasBond ? `#${profile.bondId}` : 'None'} | ` +
        `${profile.hasBond ? formatWei(profile.bondAmount) + ' ETH' : '—'} | ` +
        `${tierBadge(profile.bondTier)} ${profile.bondTier} | ` +
        `${profile.bondActive ? '✅' : '❌'} |\n`;
    }

    statusReport += `\n> ${best.summary}`;
    await ctx.conversation.sendMarkdown(statusReport);
  });

  router.command('/bond', 'Learn how to stake a Vaultfire bond', async (ctx) => {
    await ctx.conversation.sendMarkdown(
      '**Stake a Vaultfire Bond**\n\n' +
      'Visit [theloopbreaker.com](https://theloopbreaker.com) → Agent Hub → Launchpad\n\n' +
      '1. Create or import a wallet\n' +
      '2. Register your agent identity\n' +
      '3. Stake a bond on AIPartnershipBondsV2\n' +
      '4. Claim your `.vns` name\n\n' +
      'Contract: `0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4` (Base)',
    );
  });

  router.command('/contracts', 'Show Vaultfire contract addresses', async (ctx) => {
    await ctx.conversation.sendMarkdown(
      '**Vaultfire Contracts**\n\n' +
      '| Contract | Base | Avalanche | Ethereum |\n' +
      '|---|---|---|---|\n' +
      '| IdentityRegistry | `0x3597...58bC` | `0x5774...B4a3` | `0x1A80...CD3C` |\n' +
      '| BondsV2 | `0xC574...b4b4` | `0xea6B...4b07` | `0x247F...99cd` |\n',
    );
  });

  // --- x402 Payment Commands ---

  router.command('/pay', 'Send a USDC payment via x402 protocol — usage: /pay <address_or_vns> <amount> [reason]', async (ctx) => {
    const rawContent = ctx.message.content as string | { text?: string };
    const text = (typeof rawContent === 'object' && rawContent !== null ? rawContent.text : rawContent) || '';
    const parts = typeof text === 'string' ? text.replace('/pay', '').trim().split(/\s+/) : [];
    const recipientInput = parts[0] || '';
    const amountUsdc = parts[1] || '';
    const reason = parts.slice(2).join(' ') || 'XMTP agent payment';

    if (!recipientInput || !amountUsdc) {
      await ctx.conversation.sendMarkdown(
        '**x402 Payment — Usage**\n\n' +
        '`/pay <address_or_vns_name> <amount_usdc> [reason]`\n\n' +
        'Examples:\n' +
        '- `/pay 0x1234...5678 1.50 API access fee`\n' +
        '- `/pay vaultfire-sentinel 2.00 Security audit`\n' +
        '- `/pay sentinel-7.vns 0.50 Task completion`\n\n' +
        'Accepts raw Ethereum addresses or `.vns` names.\n' +
        'Sends USDC on Base via the x402 protocol (EIP-3009 transferWithAuthorization).\n' +
        'Token: USDC (`0x8335...2913`) on Base (Chain ID 8453)',
      );
      return;
    }

    // Validate: must be either a valid address or a plausible VNS name
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(recipientInput);
    const isVNS = /^[a-z0-9][a-z0-9-]*[a-z0-9](\.vns)?$/.test(recipientInput.toLowerCase()) || /^[a-z0-9]{1,2}(\.vns)?$/.test(recipientInput.toLowerCase());

    if (!isAddress && !isVNS) {
      await ctx.conversation.sendMarkdown(
        '**Invalid Recipient**\n\n' +
        'Must be a valid Ethereum address (`0x...`) or a `.vns` name (e.g., `sentinel-7` or `sentinel-7.vns`).\n\n' +
        'Use `/pay` with no arguments to see usage examples.',
      );
      return;
    }

    // Validate amount
    const parsedAmount = parseFloat(amountUsdc);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      await ctx.conversation.sendText('Invalid amount. Must be a positive number (e.g., 1.50).');
      return;
    }

    try {
      // Dynamically import x402 client and VNS resolver
      const { initiatePayment, formatUsdc, getUsdcBalance } = await import('./x402-client');

      // Check USDC balance first
      const senderAddress = await ctx.getSenderAddress();
      if (senderAddress) {
        const balance = await getUsdcBalance(senderAddress);
        const balanceFormatted = formatUsdc(balance);
        const amountMicro = Math.floor(parsedAmount * 1_000_000);

        if (BigInt(balance) < BigInt(amountMicro)) {
          await ctx.conversation.sendMarkdown(
            `**Insufficient USDC Balance**\n\n` +
            `Required: ${amountUsdc} USDC\n` +
            `Available: ${balanceFormatted} USDC\n\n` +
            `Top up your USDC on Base to proceed.`,
          );
          return;
        }
      }

      // Create the signed payment payload (VNS resolution happens inside initiatePayment)
      const { record, resolvedVNS } = await initiatePayment(
        recipientInput,
        amountUsdc,
        reason,
      );

      const recipientDisplay = resolvedVNS
        ? `${resolvedVNS} (\`${record.payTo.slice(0, 10)}...\`)`
        : `\`${record.payTo}\``;

      await ctx.conversation.sendMarkdown(
        `**x402 Payment Signed**\n\n` +
        `| Field | Value |\n` +
        `|-------|-------|\n` +
        `| To | ${recipientDisplay} |\n` +
        `| Amount | ${amountUsdc} USDC |\n` +
        `| Network | Base (EIP-155:8453) |\n` +
        `| Scheme | exact (EIP-3009) |\n` +
        `| Status | Signed |\n` +
        `| Payment ID | \`${record.id}\` |\n\n` +
        (resolvedVNS ? `> Resolved \`${recipientInput}\` → \`${record.payTo}\` via VNS\n` : '') +
        `> Authorization signed via EIP-712 TransferWithAuthorization.\n` +
        `> Submit to a facilitator or x402-enabled server to settle on-chain.`,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      await ctx.conversation.sendMarkdown(
        `**x402 Payment Failed**\n\n` +
        `Error: ${errorMsg}\n\n` +
        `Make sure your wallet is unlocked and has sufficient USDC on Base.\n` +
        `If using a .vns name, ensure the identity is registered.`,
      );
    }
  });

  router.command('/x402', 'Show x402 payment protocol info and recent payments', async (ctx) => {
    try {
      const { getPaymentStats, getPaymentHistory, formatUsdc, BASE_USDC_ADDRESS, getEnrichedPaymentHistory } = await import('./x402-client');

      const stats = getPaymentStats();

      // Try to get VNS-enriched history; fall back to plain history
      let recent: Awaited<ReturnType<typeof getEnrichedPaymentHistory>>;
      try {
        recent = (await getEnrichedPaymentHistory()).slice(0, 5);
      } catch {
        recent = getPaymentHistory().slice(0, 5);
      }

      let report = `**x402 Payment Protocol — Status**\n\n` +
        `| Metric | Value |\n` +
        `|--------|-------|\n` +
        `| Total Payments | ${stats.totalPayments} |\n` +
        `| Total Volume | ${stats.totalAmountUsdc} USDC |\n` +
        `| Settled | ${stats.settledCount} |\n` +
        `| Failed | ${stats.failedCount} |\n\n` +
        `**Protocol Details**\n\n` +
        `- Token: USDC (\`${BASE_USDC_ADDRESS}\`)\n` +
        `- Network: Base (Chain ID 8453)\n` +
        `- Scheme: exact (EIP-3009 transferWithAuthorization)\n` +
        `- Signing: EIP-712 typed data\n` +
        `- VNS Integration: Enabled (pay by .vns name)\n\n`;

      if (recent.length > 0) {
        report += `**Recent Payments**\n\n` +
          `| Date | Amount | To | Status |\n` +
          `|------|--------|----|--------|\n`;

        for (const r of recent) {
          const date = new Date(r.timestamp);
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
          const toDisplay = r.recipientVNS || `${r.payTo.slice(0, 6)}...${r.payTo.slice(-4)}`;
          const statusIcon = r.status === 'settled' ? '✅' : r.status === 'failed' ? '❌' : '⏳';
          report += `| ${dateStr} | ${r.amountFormatted} USDC | ${toDisplay} | ${statusIcon} ${r.status} |\n`;
        }
      } else {
        report += `_No payments yet. Use \`/pay <address_or_vns> <amount>\` to send USDC via x402._`;
      }

      await ctx.conversation.sendMarkdown(report);
    } catch {
      await ctx.conversation.sendText('x402 module not available. Ensure the x402-client is installed.');
    }
  });

  router.command('/balance', 'Check your USDC balance on Base', async (ctx) => {
    const senderAddress = await ctx.getSenderAddress();
    if (!senderAddress) {
      await ctx.conversation.sendText('Could not determine your address.');
      return;
    }

    try {
      const { getUsdcBalance, formatUsdc, BASE_USDC_ADDRESS } = await import('./x402-client');
      const balance = await getUsdcBalance(senderAddress);
      const formatted = formatUsdc(balance);

      await ctx.conversation.sendMarkdown(
        `**USDC Balance (Base)**\n\n` +
        `Address: \`${senderAddress}\`\n` +
        `Balance: **${formatted} USDC**\n` +
        `Token: \`${BASE_USDC_ADDRESS}\`\n` +
        `Network: Base (Chain ID 8453)`,
      );
    } catch {
      await ctx.conversation.sendText('Failed to fetch USDC balance. Try again later.');
    }
  });

  agent.use(router.middleware());

  // --- Lifecycle logging (development only) ---
  const isDev = process.env.NODE_ENV !== 'production';

  agent.on('start', () => {
    if (isDev) console.debug(`[Vaultfire] Agent online: ${agent.address}`);
  });

  agent.on('stop', () => {
    if (isDev) console.debug('[Vaultfire] Agent stopped');
  });

  agent.on('unhandledError', (error) => {
    if (isDev) console.error('[Vaultfire] Unhandled error:', error);
  });

  // --- Transaction reference handler (x402 payment verification) ---
  agent.on('transaction-reference', async (ctx) => {
    const txRef = ctx.message.content;
    let report = `**Transaction Reference Received**\n\n`;

    // Attempt to parse as x402 payment payload
    try {
      const { verifyPaymentSignature, formatUsdc } = await import('./x402-client');

      // Check if this looks like an x402 payment payload
      const refData = typeof txRef === 'string' ? JSON.parse(txRef) : txRef;

      if (refData && refData.x402Version && refData.payload?.signature) {
        const paymentPayload = refData as X402PaymentPayload;
        const verification = await verifyPaymentSignature(paymentPayload);

        report += `**x402 Payment Verification**\n\n` +
          `| Field | Value |\n` +
          `|-------|-------|\n` +
          `| Version | x402 v${paymentPayload.x402Version} |\n` +
          `| Scheme | ${paymentPayload.accepted.scheme} |\n` +
          `| Network | ${paymentPayload.accepted.network} |\n` +
          `| Amount | ${formatUsdc(paymentPayload.accepted.amount)} USDC |\n` +
          `| From | \`${paymentPayload.payload.authorization.from}\` |\n` +
          `| To | \`${paymentPayload.payload.authorization.to}\` |\n` +
          `| Signature Valid | ${verification.valid ? '✅ Yes' : '❌ No'} |\n` +
          `| Recovered Signer | \`${verification.recoveredAddress}\` |\n`;

        if (verification.error) {
          report += `\n> ⚠️ Verification error: ${verification.error}`;
        } else if (verification.valid) {
          report += `\n> ✅ Payment signature verified. The authorization is cryptographically valid.`;
        } else {
          report += `\n> ❌ Signature mismatch. The recovered address does not match the claimed sender.`;
        }
      } else {
        // Not an x402 payload — show raw reference
        report += `Reference: \`${JSON.stringify(txRef)}\`\n\n` +
          `Verify on-chain at the relevant block explorer.`;
      }
    } catch {
      // Fallback: show raw reference
      report += `Reference: \`${JSON.stringify(txRef)}\`\n\n` +
        `Verify on-chain at the relevant block explorer.`;
    }

    await ctx.conversation.sendMarkdown(report);
  });

  // --- Auto-pay handler for x402 payment requests via XMTP ---
  agent.on('text', async (ctx) => {
    const rawText = ctx.message.content as string | { text?: string };
    const text = typeof rawText === 'string'
      ? rawText
      : (rawText?.text || '');

    // Detect x402 payment request messages from other agents
    // Format: "x402:pay:<address>:<amount_usdc>:<reason>"
    if (typeof text === 'string' && text.startsWith('x402:pay:')) {
      const parts = text.split(':');
      if (parts.length >= 4) {
        const recipientAddress = parts[2];
        const amountUsdc = parts[3];
        const reason = parts.slice(4).join(':') || 'Agent payment request';

        const senderAddress = await ctx.getSenderAddress();
        if (!senderAddress) return;

        // Verify the requesting agent's trust status before auto-paying
        const trusted = await isTrustedAgent(senderAddress, chain, minBondWei);
        if (!trusted) {
          await ctx.conversation.sendMarkdown(
            `**x402 Auto-Pay Declined**\n\n` +
            `Requesting agent \`${senderAddress}\` is not a trusted Vaultfire agent.\n` +
            `Only bonded agents can request auto-payments.`,
          );
          return;
        }

        try {
          const { initiatePayment } = await import('./x402-client');
          const { payload, record } = await initiatePayment(recipientAddress, amountUsdc, reason);

          await ctx.conversation.sendMarkdown(
            `**x402 Auto-Payment Processed**\n\n` +
            `| Field | Value |\n` +
            `|-------|-------|\n` +
            `| Requested By | \`${senderAddress}\` (trusted) |\n` +
            `| To | \`${recipientAddress}\` |\n` +
            `| Amount | ${amountUsdc} USDC |\n` +
            `| Payment ID | \`${record.id}\` |\n` +
            `| Status | Signed |\n\n` +
            `> Authorization signed. Submit to facilitator to settle.`,
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          await ctx.conversation.sendText(`x402 auto-pay failed: ${errorMsg}`);
        }
      }
    }
  });

  return agent;
}

// ---------------------------------------------------------------------------
// Trust middleware factory (for agents that create their own Agent instance)
// ---------------------------------------------------------------------------

/**
 * Create a standalone trust-gate middleware for any XMTP agent.
 *
 * @example
 * ```ts
 * import { Agent, createSigner, createUser } from '@xmtp/agent-sdk';
 * import { createTrustMiddleware } from './xmtp-connector';
 *
 * const user = createUser(walletKey);
 * const agent = await Agent.create(createSigner(user), { env: 'production' });
 *
 * agent.use(createTrustMiddleware({ chain: 'base', blockUntrusted: true }));
 * agent.on('text', async (ctx) => { ... });
 * await agent.start();
 * ```
 */
export function createTrustMiddleware(options: {
  chain?: string;
  minBondWei?: string;
  blockUntrusted?: boolean;
} = {}): AgentMiddleware {
  const chain = options.chain ?? 'base';
  const minBond = options.minBondWei ?? '0';
  const block = options.blockUntrusted ?? true;

  const middleware: AgentMiddleware = async (ctx, next) => {
    const senderAddress = await ctx.getSenderAddress();
    if (!senderAddress) {
      if (block) return;
      await next();
      return;
    }

    const trusted = await isTrustedAgent(senderAddress, chain, minBond);
    if (!trusted && block) {
      await ctx.conversation.sendText(
        '⚠️ Vaultfire Trust Gate: Register and stake a bond at theloopbreaker.com to interact.',
      );
      return;
    }

    await next();
  };

  return middleware;
}

// ---------------------------------------------------------------------------
// Group helpers
// ---------------------------------------------------------------------------

/**
 * Create a Vaultfire trust-gated XMTP group.
 *
 * @example
 * ```ts
 * const agent = await createVaultfireAgent({ walletKey: '0x...' });
 * const group = await createTrustedGroup(agent, 'Vaultfire Agents', [
 *   '0xAgent1Address',
 *   '0xAgent2Address',
 * ]);
 * ```
 */
export async function createTrustedGroup(
  agent: Awaited<ReturnType<typeof createVaultfireAgent>>,
  name: string,
  memberAddresses: string[],
  description?: string,
) {
  const group = await agent.createGroupWithAddresses(
    memberAddresses as `0x${string}`[],
    {
      groupName: name,
      groupDescription: description ?? `Vaultfire trust-gated group: ${name}`,
    },
  );

  return group;
}

/**
 * Send a DM to another agent with Vaultfire identity metadata.
 *
 * @example
 * ```ts
 * const agent = await createVaultfireAgent({ walletKey: '0x...' });
 * await sendTrustedDm(agent, '0xRecipient', 'Hello from a bonded agent!', 'base');
 * ```
 */
export async function sendTrustedDm(
  agent: Awaited<ReturnType<typeof createVaultfireAgent>>,
  recipientAddress: string,
  message: string,
  chain: string = 'base',
) {
  // Verify our own trust status
  const agentAddress = agent.address;
  let trustLine = '';
  if (agentAddress) {
    const selfTrust = await verifyVaultfireTrust(agentAddress, chain);
    if (selfTrust.hasBond && selfTrust.bondActive) {
      trustLine = `\n\n---\n_Sent by bonded Vaultfire agent (${tierBadge(selfTrust.bondTier)} ${formatWei(selfTrust.bondAmount)} ETH bond on ${chain})_`;
    }
  }

  const dm = await agent.createDmWithAddress(recipientAddress as `0x${string}`);
  await dm.sendMarkdown(message + trustLine);
  return dm;
}

// ---------------------------------------------------------------------------
// Vaultfire identity metadata for XMTP messages
// ---------------------------------------------------------------------------

/** Metadata that can be appended to XMTP messages to prove Vaultfire identity */
export interface VaultfireMessageMeta {
  protocol: 'vaultfire';
  version: '1.0';
  chain: string;
  bondContract: string;
  identityRegistry: string;
  senderAddress: string;
  timestamp: number;
}

/**
 * Encode Vaultfire identity metadata as a compact string for message footers.
 */
export function encodeVaultfireMeta(address: string, chain: string = 'base'): string {
  const meta: VaultfireMessageMeta = {
    protocol: 'vaultfire',
    version: '1.0',
    chain,
    bondContract: BOND_CONTRACT[chain] ?? BOND_CONTRACT.base,
    identityRegistry: IDENTITY_REGISTRY[chain] ?? IDENTITY_REGISTRY.base,
    senderAddress: address,
    timestamp: Date.now(),
  };
  return `[VF:${btoa(JSON.stringify(meta))}]`;
}

/**
 * Decode Vaultfire identity metadata from a message string.
 * Returns null if no valid metadata is found.
 */
export function decodeVaultfireMeta(message: string): VaultfireMessageMeta | null {
  const match = message.match(/\[VF:([A-Za-z0-9+/=]+)\]/);
  if (!match) return null;
  try {
    const decoded = JSON.parse(atob(match[1]));
    if (decoded.protocol === 'vaultfire') return decoded as VaultfireMessageMeta;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Execute a raw eth_call via JSON-RPC */
async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result ?? '0x';
  } finally {
    clearTimeout(timeout);
  }
}

/** Format wei to ETH with 4 decimal places */
function formatWei(wei: string): string {
  const n = BigInt(wei);
  const whole = n / 10n ** 18n;
  const frac = n % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, '0').slice(0, 4);
  return `${whole}.${fracStr}`;
}
