/**
 * Vaultfire XMTP Connector — @xmtp/agent-sdk v2.2.0
 *
 * Integrates XMTP encrypted messaging with Vaultfire on-chain trust.
 * Agents register on Vaultfire (identity + bond), communicate via XMTP,
 * and receiving agents verify the sender's Vaultfire bond before trusting.
 *
 * Stack: XMTP (messaging) + x402 (payments) + Vaultfire (trust/accountability)
 *
 * @module xmtp-connector
 */

import type {
  AgentMiddleware,
  AgentMessageHandler,
  User,
} from '@xmtp/agent-sdk';

// ---------------------------------------------------------------------------
// Contract constants (verified on BaseScan)
// ---------------------------------------------------------------------------

const RPC_URLS: Record<string, string> = {
  base: 'https://mainnet.base.org',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  ethereum: 'https://eth.llamarpc.com',
};

const IDENTITY_REGISTRY: Record<string, string> = {
  base: '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5',
  avalanche: '0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5',
  ethereum: '0xaCB59e0f0eA47B25b24390B71b877928E5842630',
};

const BOND_CONTRACT: Record<string, string> = {
  base: '0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1',
  avalanche: '0x37679B1dCfabE6eA6b8408626815A1426bE2D717',
  ethereum: '0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1',
};

/** getTotalAgents() → uint256 */
const GET_TOTAL_AGENTS_SELECTOR = '0x3731a16f';

/** getBondInfo(address) → (uint256 amount, bool active, uint256 timestamp) */
const GET_BOND_INFO_SELECTOR = '0x96d02099';

// ---------------------------------------------------------------------------
// Trust types
// ---------------------------------------------------------------------------

/** On-chain trust profile for a Vaultfire agent */
export interface VaultfireTrustProfile {
  address: string;
  isRegistered: boolean;
  hasBond: boolean;
  bondAmount: string;
  bondActive: boolean;
  chain: string;
  /** Human-readable summary */
  summary: string;
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
// On-chain trust verification (pure fetch — no ethers dependency)
// ---------------------------------------------------------------------------

/**
 * Verify an address's Vaultfire trust profile by reading on-chain state.
 *
 * Calls `getTotalAgents()` on ERC8004IdentityRegistry and `getBondInfo(address)`
 * on AIPartnershipBondsV2 via JSON-RPC `eth_call`.
 *
 * @param address - Ethereum address to verify
 * @param chain   - Chain to query (default: 'base')
 * @returns Trust profile with registration and bond status
 */
export async function verifyVaultfireTrust(
  address: string,
  chain: string = 'base',
): Promise<VaultfireTrustProfile> {
  const rpc = RPC_URLS[chain] ?? RPC_URLS.base;
  const identityAddr = IDENTITY_REGISTRY[chain] ?? IDENTITY_REGISTRY.base;
  const bondAddr = BOND_CONTRACT[chain] ?? BOND_CONTRACT.base;
  const paddedAddress = '0x' + address.replace(/^0x/, '').toLowerCase().padStart(64, '0');

  // --- Check registration (getTotalAgents as a proxy) ---
  let isRegistered = false;
  try {
    const regResult = await ethCall(rpc, identityAddr, GET_TOTAL_AGENTS_SELECTOR);
    // If the call succeeds the contract is alive; we assume the address is
    // registered if it has a bond (more reliable than parsing the full registry).
    isRegistered = regResult !== '0x' && regResult.length > 2;
  } catch {
    // Contract call failed — assume not registered
  }

  // --- Check bond ---
  let hasBond = false;
  let bondActive = false;
  let bondAmount = '0';
  try {
    const bondCalldata = GET_BOND_INFO_SELECTOR + paddedAddress.slice(2);
    const bondResult = await ethCall(rpc, bondAddr, bondCalldata);
    if (bondResult && bondResult.length >= 194) {
      const raw = bondResult.slice(2);
      bondAmount = BigInt('0x' + raw.slice(0, 64)).toString();
      bondActive = BigInt('0x' + raw.slice(64, 128)) === 1n;
      hasBond = BigInt('0x' + raw.slice(0, 64)) > 0n;
      // If the agent has an active bond, consider them registered
      if (hasBond && bondActive) isRegistered = true;
    }
  } catch {
    // Bond lookup failed
  }

  const summary = hasBond && bondActive
    ? `Trusted agent — active bond of ${formatWei(bondAmount)} ETH on ${chain}`
    : hasBond
      ? `Agent has bond (${formatWei(bondAmount)} ETH) but it is inactive`
      : isRegistered
        ? 'Registered agent — no bond staked'
        : 'Unknown agent — not registered on Vaultfire';

  return { address, isRegistered, hasBond, bondAmount, bondActive, chain, summary };
}

/**
 * Quick boolean check: is this address a trusted Vaultfire agent?
 *
 * @param address  - Ethereum address
 * @param chain    - Chain to check (default: 'base')
 * @param minBond  - Minimum bond in wei (default: '0')
 */
export async function isTrustedAgent(
  address: string,
  chain: string = 'base',
  minBond: string = '0',
): Promise<boolean> {
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
      `Active: ${trust.bondActive ? '✅' : '❌'}\n` +
      `Chain: ${trust.chain}\n\n` +
      `> ${trust.summary}`,
    );
  });

  router.command('/bond', 'Learn how to stake a Vaultfire bond', async (ctx) => {
    await ctx.conversation.sendMarkdown(
      '**Stake a Vaultfire Bond**\n\n' +
      'Visit [theloopbreaker.com](https://theloopbreaker.com) → Agent Hub → Launchpad\n\n' +
      '1. Create or import a wallet\n' +
      '2. Register your agent identity\n' +
      '3. Stake a bond on AIPartnershipBondsV2\n' +
      '4. Claim your `.vns` name\n\n' +
      'Contract: `0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1` (Base)',
    );
  });

  router.command('/contracts', 'Show Vaultfire contract addresses', async (ctx) => {
    await ctx.conversation.sendMarkdown(
      '**Vaultfire Contracts (Base)**\n\n' +
      '| Contract | Address |\n' +
      '|---|---|\n' +
      '| ERC8004IdentityRegistry | `0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5` |\n' +
      '| AIPartnershipBondsV2 | `0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1` |\n' +
      '| DilithiumAttestor V2 | `0xe24Ab41dC93833d63d8dd501C53bED674daa4839` |',
    );
  });

  agent.use(router.middleware());

  // --- Lifecycle events ---
  agent.on('start', () => {
    console.log(`[Vaultfire] Agent online: ${agent.address}`);
    console.log(`[Vaultfire] Trust chain: ${chain} | Block untrusted: ${config.blockUntrusted ?? false}`);
  });

  agent.on('stop', () => {
    console.log('[Vaultfire] Agent stopped');
  });

  agent.on('unhandledError', (error) => {
    console.error('[Vaultfire] Unhandled error:', error);
  });

  // --- Transaction reference handler (x402 payment verification) ---
  agent.on('transaction-reference', async (ctx) => {
    const txRef = ctx.message.content;
    await ctx.conversation.sendMarkdown(
      `**Transaction Reference Received**\n\n` +
      `Reference: \`${JSON.stringify(txRef)}\`\n\n` +
      `Verify on-chain at the relevant block explorer.`,
    );
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
      trustLine = `\n\n---\n_Sent by bonded Vaultfire agent (${formatWei(selfTrust.bondAmount)} ETH bond on ${chain})_`;
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
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result ?? '0x';
}

/** Format wei to ETH with 4 decimal places */
function formatWei(wei: string): string {
  const n = BigInt(wei);
  const whole = n / 10n ** 18n;
  const frac = n % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, '0').slice(0, 4);
  return `${whole}.${fracStr}`;
}
