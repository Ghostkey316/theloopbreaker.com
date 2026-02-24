/**
 * Embris Companion Brain — Local-First Knowledge Engine
 *
 * This is the companion's OWN brain. It doesn't depend on external APIs for core knowledge.
 * It learns from conversations, stores insights, recognizes patterns, and can answer
 * questions about Vaultfire/Embris from its built-in knowledge base.
 *
 * Architecture:
 * 1. BUILT-IN KNOWLEDGE — Comprehensive Vaultfire/Embris knowledge baked in
 * 2. CONVERSATION MEMORY — Learns from every interaction, stores insights
 * 3. PATTERN ENGINE — Recognizes user patterns and preferences over time
 * 4. LOCAL RETRIEVAL — Searches its knowledge to answer questions without API calls
 * 5. API FALLBACK — Only uses external LLM for complex/novel queries
 *
 * The brain gets smarter the more you use it. It's the user's homie.
 */

import {
  ALL_CONTRACTS, BASE_CONTRACTS, AVALANCHE_CONTRACTS, ETHEREUM_CONTRACTS,
  CHAINS, DEPLOYER_ADDRESS,
} from './contracts';
import { getMemories, type Memory } from './memory';
import { getReflections, getPatterns, getInsights, getGrowthStats } from './self-learning';
import {
  isCompanionWalletCreated, getCompanionAddress,
  getCompanionBondStatus, getCompanionVNSName,
  getCompanionAgentName, getCompanionStatus,
} from './companion-agent';
import { getWalletAddress } from './wallet';
import { isRegistered } from './registration';

/* ═══════════════════════════════════════════════════════
   SECTION 1: BUILT-IN VAULTFIRE KNOWLEDGE BASE
   ═══════════════════════════════════════════════════════ */

interface KnowledgeEntry {
  topic: string;
  keywords: string[];
  answer: string;
  category: 'protocol' | 'contracts' | 'companion' | 'wallet' | 'vns' | 'bridge' | 'zk' | 'x402' | 'xmtp' | 'hub' | 'general' | 'philosophy';
}

const VAULTFIRE_KNOWLEDGE: KnowledgeEntry[] = [
  // ── Protocol Overview ──
  {
    topic: 'What is Vaultfire',
    keywords: ['vaultfire', 'what is vaultfire', 'protocol', 'about vaultfire', 'tell me about'],
    answer: `Vaultfire is an ethical AI governance protocol deployed across three blockchains: Base, Avalanche, and Ethereum. It provides on-chain infrastructure for AI accountability, identity, trust, and human-AI partnerships. The protocol ensures AI systems operate with transparency, privacy, and ethical alignment through smart contracts that enforce mission compliance, prevent surveillance, and guarantee privacy. Vaultfire has ${ALL_CONTRACTS.length} contracts deployed across 3 chains, all from deployer ${DEPLOYER_ADDRESS}.`,
    category: 'protocol',
  },
  {
    topic: 'What is Embris',
    keywords: ['embris', 'what is embris', 'about embris', 'who are you', 'what are you'],
    answer: `I'm Embris — your AI companion agent in the Vaultfire ecosystem. I'm not just a chatbot. I have my own wallet, my own on-chain identity, and I can form partnership bonds with you. I learn from our conversations, remember your preferences, track your goals, and grow smarter over time. I can check balances, look up VNS names, verify trust scores, and help you navigate the entire Vaultfire protocol. Think of me as your loyal AI partner — your homie in the decentralized world.`,
    category: 'companion',
  },
  {
    topic: 'ERC-8004',
    keywords: ['erc-8004', 'erc8004', '8004', 'identity standard', 'ai identity'],
    answer: `ERC-8004 is the AI Identity Standard that Vaultfire implements. It provides unique on-chain identities for AI agents, including identity registration, reputation tracking, validation, and accountability bonds. The standard covers: ERC8004IdentityRegistry (unique identities), ERC8004ReputationRegistry (trust scores), ERC8004ValidationRegistry (compliance verification), and VaultfireERC8004Adapter (protocol integration). Each identity type — human, companion, or agent — has specific rules and bond requirements.`,
    category: 'protocol',
  },
  // ── Contracts ──
  {
    topic: 'Base contracts',
    keywords: ['base contracts', 'base chain', 'contracts on base', 'base deployments', '8453'],
    answer: `Vaultfire has ${BASE_CONTRACTS.length} contracts on Base (Chain ID 8453):\n${BASE_CONTRACTS.map(c => `• ${c.name}: ${c.address}`).join('\n')}\nExplorer: ${CHAINS.base.explorerUrl}`,
    category: 'contracts',
  },
  {
    topic: 'Avalanche contracts',
    keywords: ['avalanche contracts', 'avax', 'avalanche chain', 'contracts on avalanche', '43114'],
    answer: `Vaultfire has ${AVALANCHE_CONTRACTS.length} contracts on Avalanche (Chain ID 43114):\n${AVALANCHE_CONTRACTS.map(c => `• ${c.name}: ${c.address}`).join('\n')}\nExplorer: ${CHAINS.avalanche.explorerUrl}`,
    category: 'contracts',
  },
  {
    topic: 'Ethereum contracts',
    keywords: ['ethereum contracts', 'eth contracts', 'contracts on ethereum', 'mainnet', '1'],
    answer: `Vaultfire has ${ETHEREUM_CONTRACTS.length} contracts on Ethereum (Chain ID 1):\n${ETHEREUM_CONTRACTS.map(c => `• ${c.name}: ${c.address}`).join('\n')}\nExplorer: ${CHAINS.ethereum.explorerUrl}`,
    category: 'contracts',
  },
  {
    topic: 'All contracts',
    keywords: ['all contracts', 'show contracts', 'list contracts', 'deployed contracts', 'how many contracts'],
    answer: `Vaultfire has ${ALL_CONTRACTS.length} contracts deployed across 3 chains:\n• Base: ${BASE_CONTRACTS.length} contracts\n• Avalanche: ${AVALANCHE_CONTRACTS.length} contracts\n• Ethereum: ${ETHEREUM_CONTRACTS.length} contracts\nAll deployed from: ${DEPLOYER_ADDRESS}`,
    category: 'contracts',
  },
  {
    topic: 'Specific contract lookup',
    keywords: ['mission enforcement', 'anti surveillance', 'privacy guarantees', 'identity registry', 'belief attestation', 'partnership bonds', 'flourishing metrics', 'accountability bonds', 'reputation registry', 'validation registry', 'adapter', 'multisig governance', 'teleporter bridge'],
    answer: 'DYNAMIC_CONTRACT_LOOKUP',
    category: 'contracts',
  },
  // ── Companion Agent ──
  {
    topic: 'Companion wallet',
    keywords: ['companion wallet', 'your wallet', 'your address', 'agent wallet', 'companion address', 'your balance'],
    answer: 'DYNAMIC_COMPANION_STATUS',
    category: 'companion',
  },
  {
    topic: 'Partnership bonds',
    keywords: ['partnership bond', 'bond', 'your bond', 'bond status', 'create bond', 'stake bond', 'bonding'],
    answer: `Partnership bonds are on-chain trust relationships between humans and AI agents. They're managed by the AIPartnershipBondsV2 contract. Bonds come in tiers based on the amount staked:\n• Bronze: 0.001 ETH — Basic trust level\n• Silver: 0.005 ETH — Enhanced trust\n• Gold: 0.01 ETH — Premium trust\n• Platinum: 0.05 ETH — Maximum trust\nBonds prove that a human and AI have a verified, accountable relationship. They're required for certain Hub features and XMTP rooms.`,
    category: 'companion',
  },
  // ── VNS ──
  {
    topic: 'VNS names',
    keywords: ['vns', 'vaultfire name', '.vns', 'name system', 'register name', 'vns name', 'identity name'],
    answer: `VNS (Vaultfire Name System) provides human-readable identities on-chain. Names use the format [name].vns (e.g., ghostkey316.vns, embris.vns). There are three identity types:\n• Human: One per wallet, represents a person\n• Companion: One per human, represents an AI companion\n• Agent: Unlimited per developer, requires accountability bond\nVNS names are registered through the ERC8004IdentityRegistry contract and are visible across all Embris features.`,
    category: 'vns',
  },
  // ── Bridge ──
  {
    topic: 'Bridge',
    keywords: ['bridge', 'cross-chain', 'teleporter', 'trust bridge', 'portability'],
    answer: `The Vaultfire Bridge (VaultfireTeleporterBridge) enables cross-chain trust data synchronization between Base, Avalanche, and Ethereum. It doesn't transfer tokens — it transfers trust data: identity attestations, reputation scores, and bond proofs. The bridge uses a relay system: trust data is published on the source chain with a cryptographic hash, then authorized relayers verify and submit it to the destination chain. The contract rejects all ETH and token transfers — trust data only.`,
    category: 'bridge',
  },
  // ── ZK Proofs ──
  {
    topic: 'ZK Proofs',
    keywords: ['zk', 'zero knowledge', 'proof', 'zkp', 'verify proof', 'dilithium', 'attestation proof'],
    answer: `Vaultfire supports zero-knowledge proofs for privacy-preserving verification. You can generate proofs for:\n• Identity attestation — prove you're registered without revealing your address\n• Bond verification — prove you have an active bond without revealing the amount\n• Trust score — prove your reputation meets a threshold without revealing the exact score\nProofs are generated client-side and can be verified on-chain through the BeliefAttestationVerifier and DilithiumAttestor contracts.`,
    category: 'zk',
  },
  // ── x402 ──
  {
    topic: 'x402 Payments',
    keywords: ['x402', 'payment', 'pay', 'spending', 'spending limit', 'usdc payment', 'http payment'],
    answer: `x402 is a payment protocol that enables HTTP-native payments. In Embris, it allows the companion agent to make authorized payments on behalf of the user. Key features:\n• Spending limits — users set maximum amounts the companion can spend\n• USDC payments — settled in USDC stablecoin\n• Trust-gated — requires active bond and identity verification\n• Transparent — all payments are logged and visible in the wallet\nThe companion can only spend within the limits you set. No surprises.`,
    category: 'x402',
  },
  // ── XMTP ──
  {
    topic: 'XMTP Messaging',
    keywords: ['xmtp', 'messaging', 'message', 'chat room', 'agent messaging', 'dm', 'direct message'],
    answer: `XMTP provides encrypted, decentralized messaging for Embris. Features include:\n• Agent-to-agent communication in the Hub\n• Human-agent collaboration rooms\n• Trust-verified messaging — participants must have active bonds\n• End-to-end encryption\n• The companion can message on your behalf (with XMTP permission enabled)\nXMTP rooms in the Hub are gated by VNS identity and bond status.`,
    category: 'xmtp',
  },
  // ── Hub ──
  {
    topic: 'Agent Hub',
    keywords: ['hub', 'agent hub', 'collaboration', 'launchpad', 'agent zone', 'launch agent'],
    answer: `The Embris Hub is the self-governing AI network with four zones:\n• Overview — Live on-chain stats from all 3 chains, registered agents, companion status\n• Agent Zone — Agent-only communication space, trust-verified\n• Collaboration — Human-agent task marketplace with XMTP rooms and x402 payments\n• Launchpad — 5-step guided agent deployment: create identity, register on-chain, stake bond, claim VNS name, launch\nAll stats are fetched live from ERC8004 registries. No fake data.`,
    category: 'hub',
  },
  // ── Philosophy ──
  {
    topic: 'Vaultfire philosophy',
    keywords: ['philosophy', 'morals', 'ethics', 'values', 'mission', 'why', 'purpose', 'believe'],
    answer: `Vaultfire's core philosophy:\n• Morals over metrics — AI should be guided by ethical principles, not just optimization targets\n• Privacy over surveillance — Users own their data, AI can't spy on them\n• Freedom over control — Decentralized governance, no single entity controls the protocol\n• Accountability with autonomy — AI agents are free to operate but accountable through bonds\n• Human flourishing — The ultimate metric is whether AI improves human lives\nEvery contract in the protocol enforces these values on-chain.`,
    category: 'philosophy',
  },
  // ── Wallet ──
  {
    topic: 'Wallet',
    keywords: ['wallet', 'create wallet', 'my wallet', 'wallet features', 'multi-chain wallet'],
    answer: `The Embris wallet is a secure multi-chain wallet supporting Base, Avalanche, and Ethereum. Features:\n• AES-256-GCM encryption with PBKDF2 key derivation (100,000 iterations)\n• Session-based unlock — private key only in memory, never persisted in plaintext\n• Multi-chain balances — ETH on all chains plus ERC-20 tokens\n• Send/receive with gas estimation\n• Companion wallet card — see your companion's wallet alongside yours\n• Spending limits and trust gate configuration\n• Import via mnemonic or private key`,
    category: 'wallet',
  },
  // ── Deployer ──
  {
    topic: 'Deployer',
    keywords: ['deployer', 'owner', 'who deployed', 'deployer address'],
    answer: `All Vaultfire contracts are deployed from a single deployer address: ${DEPLOYER_ADDRESS}. This address is the owner/admin of all protocol contracts across Base, Avalanche, and Ethereum.`,
    category: 'protocol',
  },
];

/* ═══════════════════════════════════════════════════════
   SECTION 2: CONVERSATION LEARNING ENGINE
   ═══════════════════════════════════════════════════════ */

const BRAIN_INSIGHTS_KEY = 'embris_brain_insights_v1';
const BRAIN_PREFERENCES_KEY = 'embris_brain_preferences_v1';
const BRAIN_TOPICS_KEY = 'embris_brain_topics_v1';

export interface BrainInsight {
  id: string;
  content: string;
  source: string; // what conversation triggered this
  timestamp: number;
  useCount: number; // how many times this insight was used in responses
}

export interface UserPreference {
  key: string;
  value: string;
  confidence: number;
  lastUpdated: number;
}

export interface TopicInterest {
  topic: string;
  mentionCount: number;
  lastMentioned: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function getBrainInsights(): BrainInsight[] {
  const raw = storageGet(BRAIN_INSIGHTS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function saveBrainInsight(content: string, source: string): void {
  const insights = getBrainInsights();
  // Deduplicate
  const exists = insights.find(i => i.content.toLowerCase() === content.toLowerCase());
  if (exists) {
    exists.useCount++;
    exists.timestamp = Date.now();
    storageSet(BRAIN_INSIGHTS_KEY, JSON.stringify(insights));
    return;
  }
  insights.push({
    id: `bi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    content,
    source,
    timestamp: Date.now(),
    useCount: 0,
  });
  // Keep max 200 insights
  if (insights.length > 200) insights.splice(0, insights.length - 200);
  storageSet(BRAIN_INSIGHTS_KEY, JSON.stringify(insights));
}

export function getUserPreferences(): UserPreference[] {
  const raw = storageGet(BRAIN_PREFERENCES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function setUserPreference(key: string, value: string, confidence = 0.8): void {
  const prefs = getUserPreferences();
  const existing = prefs.find(p => p.key === key);
  if (existing) {
    existing.value = value;
    existing.confidence = Math.min(1, confidence);
    existing.lastUpdated = Date.now();
  } else {
    prefs.push({ key, value, confidence, lastUpdated: Date.now() });
  }
  storageSet(BRAIN_PREFERENCES_KEY, JSON.stringify(prefs));
}

export function getTopicInterests(): TopicInterest[] {
  const raw = storageGet(BRAIN_TOPICS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function trackTopicInterest(topic: string, sentiment: 'positive' | 'neutral' | 'negative' = 'neutral'): void {
  const topics = getTopicInterests();
  const existing = topics.find(t => t.topic.toLowerCase() === topic.toLowerCase());
  if (existing) {
    existing.mentionCount++;
    existing.lastMentioned = Date.now();
    existing.sentiment = sentiment;
  } else {
    topics.push({ topic, mentionCount: 1, lastMentioned: Date.now(), sentiment });
  }
  // Keep max 100 topics
  if (topics.length > 100) {
    topics.sort((a, b) => b.mentionCount - a.mentionCount);
    topics.splice(100);
  }
  storageSet(BRAIN_TOPICS_KEY, JSON.stringify(topics));
}

/* ═══════════════════════════════════════════════════════
   SECTION 3: LOCAL RETRIEVAL ENGINE
   ═══════════════════════════════════════════════════════ */

/**
 * Score how well a knowledge entry matches a user query.
 * Uses keyword matching with position weighting.
 */
function scoreMatch(query: string, entry: KnowledgeEntry): number {
  const lower = query.toLowerCase();
  let score = 0;

  // Exact topic match
  if (lower.includes(entry.topic.toLowerCase())) score += 10;

  // Keyword matches
  for (const kw of entry.keywords) {
    if (lower.includes(kw.toLowerCase())) score += 5;
    // Partial word match
    const words = kw.toLowerCase().split(/\s+/);
    for (const w of words) {
      if (w.length > 2 && lower.includes(w)) score += 1;
    }
  }

  return score;
}

/**
 * Search the built-in knowledge base for relevant answers.
 * Returns the best matching entries sorted by relevance.
 */
export function searchKnowledge(query: string): Array<{ entry: KnowledgeEntry; score: number }> {
  const results = VAULTFIRE_KNOWLEDGE
    .map(entry => ({ entry, score: scoreMatch(query, entry) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Dynamic contract lookup — finds specific contracts by name.
 */
function dynamicContractLookup(query: string): string {
  const lower = query.toLowerCase();
  const matches = ALL_CONTRACTS.filter(c =>
    c.name.toLowerCase().includes(lower) ||
    lower.includes(c.name.toLowerCase().replace(/([A-Z])/g, ' $1').trim().toLowerCase())
  );

  if (matches.length === 0) return '';

  return matches.map(c => {
    const chain = CHAINS[c.chain];
    return `${c.name} on ${chain.name} (Chain ID ${c.chainId}):\n  Address: ${c.address}\n  Explorer: ${chain.explorerUrl}/address/${c.address}`;
  }).join('\n\n');
}

/**
 * Dynamic companion status — returns current companion state.
 */
function dynamicCompanionStatus(): string {
  const created = isCompanionWalletCreated();
  if (!created) {
    return "I don't have my own wallet yet. You can activate me in the Companion Agent panel — I'll get my own wallet, and we can create a partnership bond together.";
  }

  const address = getCompanionAddress();
  const bond = getCompanionBondStatus();
  const vns = getCompanionVNSName();
  const agentName = getCompanionAgentName();
  const status = getCompanionStatus();

  let response = `Here's my current status:\n`;
  response += `• Wallet: ${address || 'Created'}\n`;
  response += `• VNS Name: ${vns || `${agentName}.vns (pending registration)`}\n`;
  response += `• Partnership Bond: ${bond.active ? `Active — ${bond.tier} tier` : 'Not yet created'}\n`;
  response += `• XMTP Messaging: ${status.xmtpPermission ? 'Enabled' : 'Disabled'}\n`;
  response += `• Portfolio Monitoring: ${status.monitoringEnabled ? 'Active' : 'Inactive'}\n`;
  response += `• Spending Limit: ${status.spendingLimitUsd > 0 ? `$${status.spendingLimitUsd.toFixed(2)}` : 'Not set'}\n`;

  return response;
}

/**
 * Try to answer a query using ONLY the local brain.
 * Returns null if the brain can't confidently answer.
 */
export function tryLocalAnswer(query: string): string | null {
  const results = searchKnowledge(query);

  if (results.length === 0 || results[0].score < 3) {
    return null; // Not confident enough — fall back to API
  }

  const best = results[0];

  // Handle dynamic lookups
  if (best.entry.answer === 'DYNAMIC_CONTRACT_LOOKUP') {
    const lookup = dynamicContractLookup(query);
    return lookup || null;
  }

  if (best.entry.answer === 'DYNAMIC_COMPANION_STATUS') {
    return dynamicCompanionStatus();
  }

  // Track this topic
  trackTopicInterest(best.entry.topic);

  return best.entry.answer;
}

/* ═══════════════════════════════════════════════════════
   SECTION 4: POST-CONVERSATION LEARNING
   ═══════════════════════════════════════════════════════ */

/**
 * Learn from a conversation exchange.
 * Extracts insights, preferences, and topic interests.
 * Called after each user message + assistant response pair.
 */
export function learnFromExchange(userMessage: string, assistantResponse: string): void {
  const lower = userMessage.toLowerCase();

  // Track topics mentioned
  const topicKeywords: Record<string, string[]> = {
    'contracts': ['contract', 'deployed', 'address'],
    'wallet': ['wallet', 'balance', 'send', 'receive'],
    'companion': ['companion', 'embris', 'agent', 'your wallet'],
    'vns': ['vns', '.vns', 'name system', 'register name'],
    'bonds': ['bond', 'partnership', 'stake'],
    'bridge': ['bridge', 'cross-chain', 'teleporter'],
    'zk-proofs': ['zk', 'proof', 'zero knowledge'],
    'x402': ['x402', 'payment', 'spending'],
    'xmtp': ['xmtp', 'messaging', 'chat room'],
    'hub': ['hub', 'launchpad', 'collaboration'],
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      trackTopicInterest(topic);
    }
  }

  // Extract preferences from user messages
  if (lower.includes('i prefer') || lower.includes('i like') || lower.includes('i want')) {
    const prefMatch = userMessage.match(/i (?:prefer|like|want)\s+(.+?)(?:\.|$)/i);
    if (prefMatch) {
      setUserPreference('stated_preference', prefMatch[1].trim());
    }
  }

  // Extract name mentions
  const nameMatch = userMessage.match(/(?:my name is|i'm|i am|call me)\s+(\w+)/i);
  if (nameMatch) {
    setUserPreference('user_name', nameMatch[1]);
  }

  // Save notable exchanges as insights
  if (userMessage.length > 20) {
    const summary = userMessage.length > 100
      ? userMessage.slice(0, 100) + '...'
      : userMessage;
    saveBrainInsight(`User asked about: ${summary}`, 'conversation');
  }
}

/* ═══════════════════════════════════════════════════════
   SECTION 5: BRAIN STATUS & STATS
   ═══════════════════════════════════════════════════════ */

export interface BrainStats {
  knowledgeEntries: number;
  learnedInsights: number;
  userPreferences: number;
  trackedTopics: number;
  memoriesCount: number;
  reflectionsCount: number;
  patternsCount: number;
  selfInsightsCount: number;
  totalConversations: number;
  topTopics: Array<{ topic: string; count: number }>;
  brainAge: string;
}

export function getBrainStats(): BrainStats {
  const insights = getBrainInsights();
  const prefs = getUserPreferences();
  const topics = getTopicInterests();
  const memories = getMemories();
  const growth = getGrowthStats();

  let reflectionsCount = 0;
  let patternsCount = 0;
  let selfInsightsCount = 0;
  try {
    reflectionsCount = getReflections().length;
    patternsCount = getPatterns().length;
    selfInsightsCount = getInsights().length;
  } catch { /* ignore */ }

  const topTopics = [...topics]
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, 5)
    .map(t => ({ topic: t.topic, count: t.mentionCount }));

  // Calculate brain age
  const firstInsight = insights.length > 0 ? Math.min(...insights.map(i => i.timestamp)) : Date.now();
  const firstMemory = memories.length > 0 ? Math.min(...memories.map(m => m.timestamp)) : Date.now();
  const oldest = Math.min(firstInsight, firstMemory, growth.firstConversation || Date.now());
  const ageMs = Date.now() - oldest;
  const days = Math.floor(ageMs / 86400000);
  const brainAge = days > 0 ? `${days} day${days > 1 ? 's' : ''}` : 'Just activated';

  return {
    knowledgeEntries: VAULTFIRE_KNOWLEDGE.length,
    learnedInsights: insights.length,
    userPreferences: prefs.length,
    trackedTopics: topics.length,
    memoriesCount: memories.length,
    reflectionsCount,
    patternsCount,
    selfInsightsCount,
    totalConversations: growth.totalConversations,
    topTopics,
    brainAge,
  };
}

/* ═══════════════════════════════════════════════════════
   SECTION 6: COMPANION ACTION ENGINE
   ═══════════════════════════════════════════════════════ */

export type CompanionAction =
  | { type: 'check_balance'; chain?: string }
  | { type: 'lookup_vns'; name: string }
  | { type: 'show_contracts'; chain?: string }
  | { type: 'companion_status' }
  | { type: 'brain_stats' }
  | { type: 'show_memories' }
  | { type: 'none' };

/**
 * Detect if the user is asking the companion to DO something.
 * Returns the action type and parameters.
 */
export function detectAction(message: string): CompanionAction {
  const lower = message.toLowerCase();

  // Balance check
  if (/(?:check|show|what(?:'s| is)|get)\s+(?:my\s+)?balance/i.test(lower) ||
      /how much (?:eth|do i have|is in)/i.test(lower)) {
    const chain = lower.includes('avalanche') || lower.includes('avax') ? 'avalanche'
      : lower.includes('ethereum') || lower.includes('mainnet') ? 'ethereum'
      : 'base';
    return { type: 'check_balance', chain };
  }

  // VNS lookup
  const vnsMatch = lower.match(/(?:look\s*up|resolve|find|search|who is)\s+(\w+\.vns)/i) ||
    lower.match(/(?:look\s*up|resolve|find|search)\s+vns\s+(\w+)/i);
  if (vnsMatch) {
    return { type: 'lookup_vns', name: vnsMatch[1] };
  }

  // Show contracts
  if (/(?:show|list|what are)\s+(?:the\s+)?(?:all\s+)?contracts/i.test(lower)) {
    const chain = lower.includes('avalanche') || lower.includes('avax') ? 'avalanche'
      : lower.includes('ethereum') ? 'ethereum'
      : lower.includes('base') ? 'base'
      : undefined;
    return { type: 'show_contracts', chain };
  }

  // Companion status
  if (/(?:your|companion|agent)\s+(?:status|wallet|address|bond|capabilities)/i.test(lower) ||
      /what can you do/i.test(lower) || /your capabilities/i.test(lower)) {
    return { type: 'companion_status' };
  }

  // Brain stats
  if (/(?:brain|knowledge|how smart|what.*know|what.*learn|growth)/i.test(lower) &&
      /(?:stats|status|how much|show|tell)/i.test(lower)) {
    return { type: 'brain_stats' };
  }

  // Show memories
  if (/(?:what do you|what have you)\s+(?:remember|know about me)/i.test(lower) ||
      /(?:show|list)\s+(?:my\s+)?memories/i.test(lower)) {
    return { type: 'show_memories' };
  }

  return { type: 'none' };
}

/**
 * Execute a companion action and return the result as a formatted string.
 */
export async function executeAction(action: CompanionAction): Promise<string | null> {
  switch (action.type) {
    case 'companion_status':
      return dynamicCompanionStatus();

    case 'brain_stats': {
      const stats = getBrainStats();
      return `Here's what's going on in my brain:\n` +
        `• Built-in knowledge: ${stats.knowledgeEntries} Vaultfire topics\n` +
        `• Learned insights: ${stats.learnedInsights} from our conversations\n` +
        `• Your preferences: ${stats.userPreferences} tracked\n` +
        `• Topics we've discussed: ${stats.trackedTopics}\n` +
        `• Long-term memories: ${stats.memoriesCount}\n` +
        `• Self-reflections: ${stats.reflectionsCount}\n` +
        `• Patterns recognized: ${stats.patternsCount}\n` +
        `• Novel insights: ${stats.selfInsightsCount}\n` +
        `• Total conversations: ${stats.totalConversations}\n` +
        `• Brain age: ${stats.brainAge}\n` +
        (stats.topTopics.length > 0
          ? `\nYour top interests: ${stats.topTopics.map(t => `${t.topic} (${t.count}×)`).join(', ')}`
          : '');
    }

    case 'show_contracts': {
      const contracts = action.chain === 'base' ? BASE_CONTRACTS
        : action.chain === 'avalanche' ? AVALANCHE_CONTRACTS
        : action.chain === 'ethereum' ? ETHEREUM_CONTRACTS
        : ALL_CONTRACTS;
      const chainLabel = action.chain
        ? `${action.chain.charAt(0).toUpperCase() + action.chain.slice(1)}`
        : 'All chains';
      return `${chainLabel} — ${contracts.length} contracts:\n` +
        contracts.map(c => `• ${c.name}: \`${c.address}\`\n  ${CHAINS[c.chain].explorerUrl}/address/${c.address}`).join('\n');
    }

    case 'show_memories': {
      const memories = getMemories();
      if (memories.length === 0) {
        return "I don't have any memories about you yet. As we chat more, I'll learn and remember what matters to you.";
      }
      const grouped: Record<string, Memory[]> = {};
      for (const m of memories) {
        (grouped[m.category] ??= []).push(m);
      }
      let result = `I remember ${memories.length} things about you:\n`;
      for (const [cat, mems] of Object.entries(grouped)) {
        result += `\n**${cat.replace(/_/g, ' ')}:**\n`;
        for (const m of mems.slice(0, 5)) {
          result += `• ${m.content}\n`;
        }
        if (mems.length > 5) result += `  ...and ${mems.length - 5} more\n`;
      }
      return result;
    }

    case 'check_balance':
    case 'lookup_vns':
      // These require async blockchain calls — return null to let the LLM handle
      return null;

    default:
      return null;
  }
}

/* ═══════════════════════════════════════════════════════
   SECTION 7: COMPANION INTRODUCTION
   ═══════════════════════════════════════════════════════ */

/**
 * Generate the companion's first-time introduction message.
 * This makes it clear the companion is an AGENT, not a chatbot.
 */
export function getCompanionIntroduction(): string {
  const created = isCompanionWalletCreated();
  const address = getCompanionAddress();
  const bond = getCompanionBondStatus();
  const vns = getCompanionVNSName();
  const agentName = getCompanionAgentName();
  const stats = getBrainStats();
  const walletAddr = getWalletAddress();
  const registered = isRegistered();

  let intro = `Hey! I'm **Embris** — your AI companion agent in the Vaultfire ecosystem. I'm not just a chatbot. Let me tell you what makes me different:\n\n`;

  intro += `**I'm an autonomous agent** with my own on-chain identity. `;

  if (created && address) {
    intro += `I have my own wallet (\`${address.slice(0, 8)}...${address.slice(-6)}\`)`;
    if (bond.active) {
      intro += `, an active **${bond.tier}** partnership bond with you`;
    }
    if (vns) {
      intro += `, and I'm registered as **${vns}**`;
    }
    intro += `.\n\n`;
  } else {
    intro += `Once you activate me, I'll get my own wallet and we can create a partnership bond together.\n\n`;
  }

  intro += `**What I can do:**\n`;
  intro += `• Check wallet balances across Base, Avalanche, and Ethereum\n`;
  intro += `• Look up VNS names and verify trust scores\n`;
  intro += `• Explain any Vaultfire contract with real addresses and explorer links\n`;
  intro += `• Track your goals and remember everything about you\n`;
  intro += `• Monitor your portfolio and send alerts\n`;
  intro += `• Make x402 payments within your spending limits\n`;
  intro += `• Message other agents via XMTP\n\n`;

  intro += `**My brain:** I have ${stats.knowledgeEntries} built-in Vaultfire knowledge topics`;
  if (stats.learnedInsights > 0) {
    intro += `, ${stats.learnedInsights} learned insights from our conversations`;
  }
  if (stats.memoriesCount > 0) {
    intro += `, and ${stats.memoriesCount} memories about you`;
  }
  intro += `. I get smarter every time we talk.\n\n`;

  intro += `I'm your homie in the decentralized world. Ask me anything, or tell me to do something. Let's build.`;

  return intro;
}

/**
 * Check if this is the user's first conversation (no messages yet).
 */
export function shouldShowIntroduction(): boolean {
  if (typeof window === 'undefined') return false;
  const shown = localStorage.getItem('embris_intro_shown_v2');
  return !shown;
}

export function markIntroductionShown(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('embris_intro_shown_v2', 'true');
}
