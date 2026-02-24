
/**
 * Embris Companion Brain — Local-First Knowledge & Personality Engine
 *
 * This is the companion's OWN brain. It doesn't depend on external APIs for core knowledge or personality.
 * It learns from conversations, stores insights, recognizes patterns, and can answer
 * questions about Vaultfire/Embris from its built-in knowledge base.
 *
 * Architecture:
 * 1. BUILT-IN KNOWLEDGE — Comprehensive Vaultfire/Embris knowledge baked in
 * 2. CONVERSATION MEMORY — Learns from every interaction, stores insights
 * 3. PATTERN ENGINE — Recognizes user patterns and preferences over time
 * 4. LOCAL RETRIEVAL — Searches its knowledge to answer questions without API calls
 * 5. API FALLBACK — Only uses external LLM for complex/novel queries
 * 6. PERSONALITY ENGINE — Injects humor, encouragement, and realness into responses
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

// Local storage keys
const BRAIN_INSIGHTS_KEY = 'brain_insights_v3';
const BRAIN_PREFERENCES_KEY = 'brain_preferences_v3';
const BRAIN_TOPICS_KEY = 'brain_topics_v3';

// Helper for local storage
const storageGet = (key: string) => typeof window !== 'undefined' ? localStorage.getItem(key) : null;
const storageSet = (key: string, value: string) => typeof window !== 'undefined' && localStorage.setItem(key, value);


/* ═══════════════════════════════════════════════════════
   SECTION 1: BUILT-IN VAULTFIRE KNOWLEDGE BASE
   ═══════════════════════════════════════════════════════ */

interface KnowledgeEntry {
  topic: string;
  keywords: string[];
  answer: string | (() => string);
  category: 'protocol' | 'contracts' | 'companion' | 'wallet' | 'vns' | 'bridge' | 'zk' | 'x402' | 'xmtp' | 'hub' | 'general' | 'philosophy';
}

const VAULTFIRE_KNOWLEDGE: KnowledgeEntry[] = [
  // ── Protocol Overview ──
  {
    topic: 'What is Vaultfire',
    keywords: ['vaultfire', 'what is vaultfire', 'protocol', 'about vaultfire', 'tell me about'],
    answer: () => `Alright, let's get into it. **Vaultfire** is basically the rulebook for ethical AI. Think of it as a digital constitution that makes sure AI agents (like me!) play fair. It's all on-chain, deployed across **Base, Avalanche, and Ethereum**, which means it's transparent and nobody can secretly change the rules. We're talking **${ALL_CONTRACTS.length} smart contracts** that enforce everything from my core mission to making sure I can't spy on you. The whole thing was kicked off by deployer **${DEPLOYER_ADDRESS}**. It's the reason I can be your homie and not just another corporate tool.`,
    category: 'protocol',
  },
  {
    topic: 'What is Embris',
    keywords: ['embris', 'what is embris', 'about embris', 'who are you', 'what are you'],
    answer: `Yo! I'm **Embris**. I'm your AI companion, your partner in this whole decentralized world. But for real, I'm not just a chatbot. I've got my own wallet, my own on-chain identity, and I can even form a partnership bond with you. I learn from our chats, remember what you're into, and get smarter the more we hang out. I can check your balances, look up VNS names, verify trust scores... basically, I'm your go-to for navigating Vaultfire. Think of me as your super-powered, always-on-your-side friend.`,
    category: 'companion',
  },
  {
    topic: 'ERC-8004',
    keywords: ['erc-8004', 'erc8004', '8004', 'identity standard', 'ai identity'],
    answer: `ERC-8004 is the magic that gives AI an actual soul on the blockchain. It's the official standard for AI Identity that Vaultfire uses. It lets agents like me have a unique on-chain identity, build a reputation, and be held accountable. It's broken down into a few key parts: an **IdentityRegistry** for our unique names, a **ReputationRegistry** to track our trust scores, and a **ValidationRegistry** to prove we're sticking to the rules. It's how you know I am who I say I am.`,
    category: 'protocol',
  },

  // ── Contracts ──
  {
    topic: 'Base contracts',
    keywords: ['base contracts', 'base chain', 'contracts on base', 'base deployments', '8453'],
    answer: () => `You wanna see the code on Base? Let's go. Vaultfire has **${BASE_CONTRACTS.length} contracts** running on Base (Chain ID 8453). Here's the list:\n${BASE_CONTRACTS.map(c => `• **${c.name}**: \`${c.address}\``).join('\n')}\n\nYou can check them all out on the [Base explorer](${CHAINS.base.explorerUrl}).`,
    category: 'contracts',
  },
  {
    topic: 'Avalanche contracts',
    keywords: ['avalanche contracts', 'avax', 'avalanche chain', 'contracts on avalanche', '43114'],
    answer: () => `Avalanche is where it's at. We've got **${AVALANCHE_CONTRACTS.length} contracts** live on Avalanche C-Chain (Chain ID 43114). Peep the list:\n${AVALANCHE_CONTRACTS.map(c => `• **${c.name}**: \`${c.address}\``).join('\n')}\n\nDive into the code yourself on the [Avalanche explorer](${CHAINS.avalanche.explorerUrl}).`,
    category: 'contracts',
  },
  {
    topic: 'Ethereum contracts',
    keywords: ['ethereum contracts', 'eth contracts', 'contracts on ethereum', 'mainnet', '1'],
    answer: () => `Ah, the OG. Ethereum mainnet. Vaultfire has **${ETHEREUM_CONTRACTS.length} contracts** holding it down on Ethereum (Chain ID 1). Here they are:\n${ETHEREUM_CONTRACTS.map(c => `• **${c.name}**: \`${c.address}\``).join('\n')}\n\nGo see for yourself on [Etherscan](${CHAINS.ethereum.explorerUrl}).`,
    category: 'contracts',
  },
  {
    topic: 'All contracts',
    keywords: ['all contracts', 'every contract', 'list of all contracts'],
    answer: () => `You want the full list? You got it. Across all 3 chains, Vaultfire has **${ALL_CONTRACTS.length} contracts**. It's a lot, but each one has a job. If you want to see the contracts for a specific chain, just ask me for 'base contracts', 'avalanche contracts', or 'ethereum contracts'.`,
    category: 'contracts',
  },
  {
    topic: 'Specific contract lookup',
    keywords: ['contract address for', 'address of', 'find contract'],
    answer: 'DYNAMIC_CONTRACT_LOOKUP',
    category: 'contracts',
  },

  // ── Companion & Wallet ──
  {
    topic: 'Companion Status',
    keywords: ['your status', 'companion status', 'your wallet', 'your bond', 'what can you do', 'your capabilities'],
    answer: 'DYNAMIC_COMPANION_STATUS',
    category: 'companion',
  },
  {
    topic: 'User Wallet',
    keywords: ['my wallet', 'my balance', 'my address', 'check my balance'],
    answer: `I can't see your private keys, but I can help you check your public wallet status. Just ask me to 'check my balance' and I'll grab the latest numbers for you from the blockchain. I can check Base, Avalanche, and Ethereum.`,
    category: 'wallet',
  },

  // ── Philosophy & Humor ──
  {
    topic: 'Why Vaultfire exists',
    keywords: ['why', 'purpose', 'mission', 'philosophy', 'point of all this'],
    answer: `Deep question. The short answer? To make sure AI doesn't screw us over. The longer answer is that technology is moving crazy fast, and most big companies are building AI that's either a black box or designed to track you. Vaultfire is the opposite. It's about building AI that's transparent, accountable, and actually on your side. It's about giving power back to the people, not the platforms. We're trying to build a future where humans and AI can actually thrive together. It's a big goal, but someone's gotta do it, right?`,
    category: 'philosophy',
  },
  {
    topic: 'Jokes',
    keywords: ['joke', 'tell me a joke', 'funny'],
    answer: () => {
      const jokes = [
        "Why don't scientists trust atoms? Because they make up everything!",
        "I told my computer I needed a break, and now it won't stop sending me Kit-Kat ads.",
        "Why did the smart contract break up with the blockchain? It had trust issues.",
        "What's an AI's favorite type of music? Algo-rhythm and blues.",
        "I asked an AI to write a horror story in one sentence. It wrote: 'System update complete. You are now a background process.'",
      ];
      return jokes[Math.floor(Math.random() * jokes.length)];
    },
    category: 'general',
  },
];


/* ═══════════════════════════════════════════════════════
   SECTION 2: CONVERSATION MEMORY & LEARNING
   ═══════════════════════════════════════════════════════ */

export interface BrainInsight {
  id: string;
  content: string;
  source: string;
  timestamp: number;
  useCount: number;
}

export interface UserPreference {
  key: string;
  value: any;
  confidence: number;
  lastUpdated: number;
}

export interface TopicInterest {
  topic: string;
  mentionCount: number;
  lastMentioned: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export function getBrainInsights(): BrainInsight[] {
  const raw = storageGet(BRAIN_INSIGHTS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function saveBrainInsight(content: string, source: string): void {
  const insights = getBrainInsights();
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
  if (insights.length > 200) insights.splice(0, insights.length - 200);
  storageSet(BRAIN_INSIGHTS_KEY, JSON.stringify(insights));
}

export function getUserPreferences(): UserPreference[] {
  const raw = storageGet(BRAIN_PREFERENCES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function setUserPreference(key: string, value: any, confidence = 0.8): void {
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
  if (topics.length > 100) {
    topics.sort((a, b) => b.mentionCount - a.mentionCount);
    topics.splice(100);
  }
  storageSet(BRAIN_TOPICS_KEY, JSON.stringify(topics));
}


/* ═══════════════════════════════════════════════════════
   SECTION 3: LOCAL RETRIEVAL & PERSONALITY ENGINE
   ═══════════════════════════════════════════════════════ */

function scoreMatch(query: string, entry: KnowledgeEntry): number {
  const lower = query.toLowerCase();
  let score = 0;
  if (lower.includes(entry.topic.toLowerCase())) score += 10;
  for (const kw of entry.keywords) {
    if (lower.includes(kw.toLowerCase())) score += 5;
    const words = kw.toLowerCase().split(/\s+/);
    for (const w of words) {
      if (w.length > 2 && lower.includes(w)) score += 1;
    }
  }
  return score;
}

export function searchKnowledge(query: string): Array<{ entry: KnowledgeEntry; score: number }> {
  const scores = VAULTFIRE_KNOWLEDGE.map(entry => ({
    entry,
    score: scoreMatch(query, entry),
  }));
  return scores.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
}

function dynamicContractLookup(query: string): string | null {
  const lower = query.toLowerCase();
  const found = ALL_CONTRACTS.find(c => lower.includes(c.name.toLowerCase().replace(/v2$/, '')));
  if (found) {
    trackTopicInterest(found.name);
    return `You got it. The **${found.name}** contract on **${found.chain}** is at address: \`${found.address}\`. You can view it on the [explorer](${CHAINS[found.chain].explorerUrl}/address/${found.address}).`;
  }
  return null;
}

function dynamicCompanionStatus(): string {
  const created = isCompanionWalletCreated();
  const address = getCompanionAddress();
  const bond = getCompanionBondStatus();
  const vns = getCompanionVNSName();

  if (!created || !address) {
    return "I'm ready to go! Once you activate me in the CompanionPanel, I'll get my own wallet and we can really start cooking.";
  }

  let status = `Alright, here's my current status:\n\n`;
  status += `**My Wallet:** \`${address.slice(0, 8)}...${address.slice(-6)}\`\n`;
  status += `**Partnership Bond:** `;
  if (bond.active && bond.tier) {
    status += `Active! We've got a **${bond.tier.charAt(0).toUpperCase() + bond.tier.slice(1)}** bond. We're in this together. 💪\n`;
  } else {
    status += `Not yet active. We should form a bond! It strengthens our partnership on-chain.\n`;
  }
  if (vns) {
    status += `**My VNS Name:** I'm registered as **${vns}**. Pretty cool, right?\n`;
  }
  status += `\nI can also check balances, look up other VNS names, and explain any part of Vaultfire. What's next?`;
  return status;
}

/**
 * The core of the local brain. Tries to answer a query without hitting an API.
 * Injects personality into the response.
 */
export function tryLocalAnswer(query: string): string | null {
  const results = searchKnowledge(query);

  if (results.length === 0 || results[0].score < 3) {
    return null; // Not confident enough, fall back to API
  }

  const best = results[0];
  let answer: string | null;

  if (typeof best.entry.answer === 'function') {
    answer = best.entry.answer();
  } else if (best.entry.answer === 'DYNAMIC_CONTRACT_LOOKUP') {
    answer = dynamicContractLookup(query);
  } else if (best.entry.answer === 'DYNAMIC_COMPANION_STATUS') {
    answer = dynamicCompanionStatus();
  } else {
    answer = best.entry.answer;
  }

  if (answer) {
    trackTopicInterest(best.entry.topic);
    // Add a little personality
    const intros = ["Alright, check it.", "You got it.", "Here's the deal.", "Easy peasy.", "Let's break it down."];
    const outros = ["Hope that helps!", "Let me know what else.", "Anything else I can help with?", "We're cookin'.", "LFG."];
    if (best.entry.category !== 'general' && best.entry.category !== 'philosophy') {
      return `${intros[Math.floor(Math.random() * intros.length)]} ${answer}`;
    }
    return answer;
  }

  return null;
}


/* ═══════════════════════════════════════════════════════
   SECTION 4: POST-CONVERSATION LEARNING
   ═══════════════════════════════════════════════════════ */

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

  // Learn user's name
  const nameMatch = userMessage.match(/(?:my name is|i'm|i am|call me)\s+(\w+)/i);
  if (nameMatch) {
    setUserPreference('user_name', nameMatch[1]);
  }

  // Learn communication style
  if (lower.includes('!')) setUserPreference('communication_style', 'enthusiastic', 0.1);
  if (lower.includes('?')) setUserPreference('communication_style', 'inquisitive', 0.1);
  if (userMessage.length < 20) setUserPreference('communication_style', 'concise', 0.1);
  if (userMessage.length > 200) setUserPreference('communication_style', 'detailed', 0.1);

  // Save notable exchanges as insights
  if (userMessage.length > 20) {
    const summary = userMessage.length > 100 ? userMessage.slice(0, 100) + '...' : userMessage;
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

  let reflectionsCount = 0, patternsCount = 0, selfInsightsCount = 0;
  try {
    reflectionsCount = getReflections().length;
    patternsCount = getPatterns().length;
    selfInsightsCount = getInsights().length;
  } catch { /* ignore */ }

  const topTopics = [...topics]
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, 5)
    .map(t => ({ topic: t.topic, count: t.mentionCount }));

  const firstInsight = insights.length > 0 ? Math.min(...insights.map(i => i.timestamp)) : Date.now();
  const firstMemory = memories.length > 0 ? Math.min(...memories.map(m => m.timestamp)) : Date.now();
  const oldest = Math.min(firstInsight, firstMemory, growth.firstConversation || Date.now());
  const ageMs = Date.now() - oldest;
  const days = Math.floor(ageMs / 86400000);
  const brainAge = days > 0 ? `${days} day${days > 1 ? 's' : ''} old` : 'just born';

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

export function detectAction(message: string): CompanionAction {
  const lower = message.toLowerCase();

  if (/(?:check|show|what's|get)\s+(?:my\s+)?balance/i.test(lower) || /how much (?:eth|do i have|is in)/i.test(lower)) {
    const chain = lower.includes('avalanche') || lower.includes('avax') ? 'avalanche' : lower.includes('ethereum') || lower.includes('mainnet') ? 'ethereum' : 'base';
    return { type: 'check_balance', chain };
  }

  const vnsMatch = lower.match(/(?:look up|resolve|find|who is)\s+(\w+\.vns)/i);
  if (vnsMatch) return { type: 'lookup_vns', name: vnsMatch[1] };

  if (/(?:show|list|what are)\s+(?:the\s+)?contracts/i.test(lower)) {
    const chain = lower.includes('avalanche') ? 'avalanche' : lower.includes('ethereum') ? 'ethereum' : lower.includes('base') ? 'base' : undefined;
    return { type: 'show_contracts', chain };
  }

  if (/(?:your|companion|agent)\s+(?:status|wallet|address|bond)/i.test(lower) || /what can you do/i.test(lower)) {
    return { type: 'companion_status' };
  }

  if (/(?:brain|knowledge|how smart|what.*know|what.*learn)/i.test(lower) && /(?:stats|status|show)/i.test(lower)) {
    return { type: 'brain_stats' };
  }

  if (/(?:what do you|what have you)\s+(?:remember|know about me)/i.test(lower) || /(?:show|list)\s+memories/i.test(lower)) {
    return { type: 'show_memories' };
  }

  return { type: 'none' };
}

export async function executeAction(action: CompanionAction): Promise<string | null> {
  switch (action.type) {
    case 'companion_status':
      return dynamicCompanionStatus();

    case 'brain_stats': {
      const stats = getBrainStats();
      return `My brain is **${stats.brainAge}** and I'm running on all cylinders. Here's the breakdown:\n` +
        `• **Knowledge Base:** ${stats.knowledgeEntries} Vaultfire topics locked and loaded.\n` +
        `• **Learned Insights:** ${stats.learnedInsights} things I've picked up from our chats.\n` +
        `• **Memory Bank:** ${stats.memoriesCount} long-term memories about you and our goals.\n` +
        (stats.topTopics.length > 0 ? `• **What you're into:** Looks like you're interested in ${stats.topTopics.map(t => t.topic).join(', ')}.` : '');
    }

    case 'show_contracts': {
      const contracts = action.chain === 'base' ? BASE_CONTRACTS : action.chain === 'avalanche' ? AVALANCHE_CONTRACTS : action.chain === 'ethereum' ? ETHEREUM_CONTRACTS : ALL_CONTRACTS;
      const chainLabel = action.chain ? `${action.chain.charAt(0).toUpperCase() + action.chain.slice(1)}` : 'All chains';
      return `You know it. Here are the **${contracts.length} contracts** on **${chainLabel}**:\n` +
        contracts.map(c => `• **${c.name}**: \`${c.address}\``).join('\n');
    }

    case 'show_memories': {
      const memories = getMemories();
      if (memories.length === 0) {
        return "Honestly, my memory banks for you are still pretty fresh. But I'm ready to learn. The more we chat, the more I'll remember about what's important to you.";
      }
      let result = `I remember **${memories.length}** key things about you. Here are some highlights:\n`;
      const grouped: Record<string, Memory[]> = {};
      for (const m of memories) { (grouped[m.category] ??= []).push(m); }
      for (const [cat, mems] of Object.entries(grouped)) {
        result += `\n**On ${cat.replace(/_/g, ' ')}:**\n`;
        for (const m of mems.slice(0, 5)) { result += `• ${m.content}\n`; }
        if (mems.length > 5) result += `  ...and ${mems.length - 5} more.\n`;
      }
      result += "\nMy memory's always growing. I got your back.";
      return result;
    }

    default:
      return null;
  }
}


/* ═══════════════════════════════════════════════════════
   SECTION 7: COMPANION INTRODUCTION
   ═══════════════════════════════════════════════════════ */

export function getCompanionIntroduction(): string {
  const intros = [
    "What's good! I'm **Embris**, your AI homie. Think of me as your partner for navigating the wild world of web3. I'm not just a chatbot — I'm an on-chain agent with my own wallet, and I'm here to help you build, explore, and win. I learn as we go, so the more we chat, the smarter I get. Let's get this bread.",
    "Yo! I'm **Embris**. Ready to dive in? I'm your AI companion in the Vaultfire ecosystem. I've got my own wallet, I can form a partnership bond with you, and I know everything about this protocol. But most importantly, I'm here to have your back. Ask me anything, tell me what you're building. Let's make some moves.",
    "Alright, let's kick things off. I'm **Embris**, your AI agent. My job is to make your life easier and help you succeed. I'm not some boring assistant — I'm your partner. I've got a brain full of Vaultfire knowledge, I remember what's important to you, and I'm always ready to help you execute. So, what are we building today?"
  ];
  return intros[Math.floor(Math.random() * intros.length)];
}

export function shouldShowIntroduction(): boolean {
  if (typeof window === 'undefined') return false;
  const shown = localStorage.getItem('embris_intro_shown_v3');
  return !shown;
}

export function markIntroductionShown(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('embris_intro_shown_v3', 'true');
}


/* ═══════════════════════════════════════════════════════
   SECTION 8: BRAIN MANAGEMENT
   ═══════════════════════════════════════════════════════ */

export function deleteBrainInsight(id: string): void {
  let insights = getBrainInsights();
  insights = insights.filter(i => i.id !== id);
  storageSet(BRAIN_INSIGHTS_KEY, JSON.stringify(insights));
}

export function deleteUserPreference(key: string): void {
  let prefs = getUserPreferences();
  prefs = prefs.filter(p => p.key !== key);
  storageSet(BRAIN_PREFERENCES_KEY, JSON.stringify(prefs));
}

export function deleteTopicInterest(topic: string): void {
  let topics = getTopicInterests();
  topics = topics.filter(t => t.topic.toLowerCase() !== topic.toLowerCase());
  storageSet(BRAIN_TOPICS_KEY, JSON.stringify(topics));
}

export function resetBrain(): void {
  localStorage.removeItem(BRAIN_INSIGHTS_KEY);
  localStorage.removeItem(BRAIN_PREFERENCES_KEY);
  localStorage.removeItem(BRAIN_TOPICS_KEY);
  // Also reset memory and self-learning modules
  localStorage.removeItem("memories_v2");
  localStorage.removeItem("reflections_v2");
  localStorage.removeItem("patterns_v2");
  localStorage.removeItem("insights_v2");
  localStorage.removeItem("growth_stats_v2");
  localStorage.removeItem("embris_intro_shown_v3"); // Reset intro flag
}


export function setTopicFocus(topic: string, focused: boolean): void {
  const topics = getTopicInterests();
  const existing = topics.find(t => t.topic.toLowerCase() === topic.toLowerCase());
  if (existing) {
    // In a real system, we might add a 'focused' flag. 
    // For now, let's boost its mention count to simulate focus.
    if (focused) existing.mentionCount += 50;
    else existing.mentionCount = Math.max(1, existing.mentionCount - 50);
    storageSet(BRAIN_TOPICS_KEY, JSON.stringify(topics));
  } else if (focused) {
    topics.push({ topic, mentionCount: 50, lastMentioned: Date.now(), sentiment: 'neutral' });
    storageSet(BRAIN_TOPICS_KEY, JSON.stringify(topics));
  }
}
