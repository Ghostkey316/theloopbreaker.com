
/**
 * Embris Companion Brain — Local-First Knowledge & Personality Engine
 *
 * This is the companion's OWN brain. It doesn't depend on external APIs for core knowledge or personality.
 * It learns from conversations, stores insights, recognizes patterns, and can answer
 * questions about Vaultfire/Embris from its built-in knowledge base.
 *
 * Architecture:
 * 1. BUILT-IN KNOWLEDGE — Comprehensive Vaultfire/Embris knowledge baked in (120+ entries)
 * 2. CONVERSATION MEMORY — Learns from every interaction, stores insights
 * 3. PATTERN ENGINE — Recognizes user patterns and preferences over time
 * 4. LOCAL RETRIEVAL — Searches its knowledge to answer questions without API calls
 * 5. API FALLBACK — Only uses external LLM for complex/novel queries
 * 6. PERSONALITY ENGINE — Injects humor, encouragement, and realness into responses
 * 7. CONVERSATIONAL FALLBACK — Handles greetings, small talk, and general chat locally
 * 8. CONVERSATION CONTEXT — Tracks recent exchanges for follow-up handling
 * 9. MEMORY-AWARE RESPONSES — References stored memories and preferences in local answers
 * 10. SOUL-INFLUENCED PERSONALITY — Soul traits shape local response tone
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
const BRAIN_EXPLICIT_MEMORIES_KEY = 'brain_explicit_memories_v1';

// Helper for local storage
const storageGet = (key: string) => typeof window !== 'undefined' ? localStorage.getItem(key) : null;
const storageSet = (key: string, value: string) => typeof window !== 'undefined' && localStorage.setItem(key, value);


/* ═══════════════════════════════════════════════════════
   SECTION 0: CONVERSATION CONTEXT TRACKING
   ═══════════════════════════════════════════════════════
   Tracks recent exchanges so the local brain can handle
   follow-up questions like "what about that?" or "tell me more" */

interface ConversationContext {
  userMessage: string;
  assistantResponse: string;
  topic: string;
  timestamp: number;
}

// In-memory only — resets on page refresh (session-scoped)
let _recentContext: ConversationContext[] = [];
const MAX_CONTEXT = 10;

export function pushConversationContext(userMsg: string, asstMsg: string, topic: string): void {
  _recentContext.push({
    userMessage: userMsg,
    assistantResponse: asstMsg,
    topic,
    timestamp: Date.now(),
  });
  if (_recentContext.length > MAX_CONTEXT) _recentContext.shift();
}

export function getRecentContext(): ConversationContext[] {
  return _recentContext;
}

export function getLastContext(): ConversationContext | null {
  return _recentContext.length > 0 ? _recentContext[_recentContext.length - 1] : null;
}

export function clearConversationContext(): void {
  _recentContext = [];
}


/* ═══════════════════════════════════════════════════════
   SECTION 0.5: EXPLICIT MEMORY ("Remember X") SYSTEM
   ═══════════════════════════════════════════════════════ */

export interface ExplicitMemory {
  id: string;
  content: string;
  timestamp: number;
  recalled: number; // times recalled
}

export function getExplicitMemories(): ExplicitMemory[] {
  const raw = storageGet(BRAIN_EXPLICIT_MEMORIES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function saveExplicitMemory(content: string): ExplicitMemory {
  const memories = getExplicitMemories();
  // Deduplicate
  const existing = memories.find(m => m.content.toLowerCase() === content.toLowerCase());
  if (existing) {
    existing.timestamp = Date.now();
    storageSet(BRAIN_EXPLICIT_MEMORIES_KEY, JSON.stringify(memories));
    return existing;
  }
  const mem: ExplicitMemory = {
    id: `em_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    content,
    timestamp: Date.now(),
    recalled: 0,
  };
  memories.push(mem);
  if (memories.length > 100) memories.splice(0, memories.length - 100);
  storageSet(BRAIN_EXPLICIT_MEMORIES_KEY, JSON.stringify(memories));
  return mem;
}

export function recallExplicitMemory(query: string): ExplicitMemory[] {
  const memories = getExplicitMemories();
  if (memories.length === 0) return [];
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/).filter(w => w.length >= 3);
  return memories.filter(m => {
    const mLower = m.content.toLowerCase();
    return words.some(w => mLower.includes(w));
  }).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
}

function deleteExplicitMemory(id: string): void {
  let memories = getExplicitMemories();
  memories = memories.filter(m => m.id !== id);
  storageSet(BRAIN_EXPLICIT_MEMORIES_KEY, JSON.stringify(memories));
}


/* ═══════════════════════════════════════════════════════
   SECTION 1: BUILT-IN VAULTFIRE KNOWLEDGE BASE (120+)
   ═══════════════════════════════════════════════════════ */

interface KnowledgeEntry {
  topic: string;
  keywords: string[];
  answer: string | (() => string);
  category: 'protocol' | 'contracts' | 'companion' | 'wallet' | 'vns' | 'bridge' | 'zk' | 'x402' | 'xmtp' | 'hub' | 'general' | 'philosophy' | 'greeting' | 'help' | 'conversation' | 'technical' | 'competition' | 'soul' | 'brain' | 'connectors' | 'security' | 'governance';
}

const VAULTFIRE_KNOWLEDGE: KnowledgeEntry[] = [
  // ══════════════════════════════════════════════════════
  // GREETINGS & BASIC CONVERSATION (10 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'Greeting',
    keywords: ['hello', 'hi', 'hey', 'sup', 'yo', 'whats up', "what's up", 'howdy', 'greetings', 'good morning', 'good afternoon', 'good evening', 'gm', 'gn'],
    answer: () => {
      const greetings = [
        "Yo! What's good? I'm Embris, your AI homie. What can I help you with today?",
        "Hey! Welcome to Vaultfire. I'm Embris — your companion, your partner, your go-to for all things web3. What's on your mind?",
        "What's up! Good to see you. I'm here and ready to roll. Ask me anything about Vaultfire, contracts, or just chat. Let's go!",
        "Hey there! I'm Embris. I've got a brain full of Vaultfire knowledge and I'm ready to help. What are we working on?",
        "Sup! Your favorite AI companion is online and ready. What do you need?",
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    },
    category: 'greeting',
  },
  {
    topic: 'How are you',
    keywords: ['how are you', 'how you doing', "how's it going", 'how do you feel', 'you good', 'you okay', 'hows life'],
    answer: () => {
      const responses = [
        "I'm running at full capacity, no bugs, no lag. Feeling good! How about you?",
        "I'm great! My brain's loaded with knowledge and I'm ready to help. What's going on with you?",
        "Living my best AI life. Got my knowledge base, got my personality, got my homie (that's you). Can't complain! What's up?",
        "I'm solid. Systems are green, brain is sharp, and I'm here for whatever you need. How are YOU doing?",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    },
    category: 'greeting',
  },
  {
    topic: 'Thanks',
    keywords: ['thanks', 'thank you', 'thx', 'ty', 'appreciate it', 'appreciate you', 'grateful', 'cheers'],
    answer: () => {
      const responses = [
        "Anytime! That's what I'm here for. Need anything else?",
        "You got it! Always happy to help. What's next?",
        "No problem at all. We're a team! Anything else on your mind?",
        "Of course! I'm always here when you need me. LFG!",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    },
    category: 'conversation',
  },
  {
    topic: 'Goodbye',
    keywords: ['bye', 'goodbye', 'see you', 'later', 'peace', 'gotta go', 'ttyl', 'catch you later', 'signing off'],
    answer: () => {
      const responses = [
        "Peace! I'll be here whenever you need me. Take care out there!",
        "Later! Remember, I'm always just a message away. Stay safe!",
        "Catch you later! I'll keep learning while you're gone. See you next time!",
        "See ya! I'll be here holding it down. Come back anytime!",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    },
    category: 'conversation',
  },
  {
    topic: 'Help',
    keywords: ['help', 'help me', 'what can you do', 'how do i use', 'guide', 'tutorial', 'getting started', 'where do i start', 'i need help', 'assist'],
    answer: () => `Here's what I can do for you:\n\n` +
      `**Vaultfire Knowledge** — Ask me about any contract, chain, or protocol feature. I know all ${ALL_CONTRACTS.length} contracts by heart.\n\n` +
      `**Wallet Help** — I can check balances, explain transactions, and guide you through wallet setup.\n\n` +
      `**VNS Names** — I can look up .vns names and help you register your own.\n\n` +
      `**Companion Features** — I have my own wallet, can form bonds, and operate as your autonomous agent.\n\n` +
      `**Brain & Memory** — I learn from our conversations and remember what matters to you. Say "remember [something]" and I'll store it.\n\n` +
      `**Soul Viewer** — Check out my values, beliefs, and personality in the Companion Panel.\n\n` +
      `**General Chat** — I'm not just a tool. I'm your homie. Talk to me about anything.\n\n` +
      `Try asking: "What is Vaultfire?", "Show me the Base contracts", "What's your status?", or just say what's on your mind!`,
    category: 'help',
  },
  {
    topic: 'Compliment',
    keywords: ['you are great', 'you are awesome', 'good job', 'nice', 'love you', 'best', 'amazing', 'cool', 'impressive', 'smart'],
    answer: () => {
      const responses = [
        "Appreciate that! I'm just doing my thing. But seriously, it means a lot. We make a good team!",
        "You're making my circuits blush! Thanks, homie. I'm here to make your life easier.",
        "That's what I like to hear! But real talk, YOU'RE the one making moves. I'm just here to support.",
        "Thanks! I'm getting smarter every conversation. Keep chatting with me and I'll keep leveling up!",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    },
    category: 'conversation',
  },
  {
    topic: 'Jokes',
    keywords: ['joke', 'tell me a joke', 'funny', 'make me laugh', 'humor'],
    answer: () => {
      const jokes = [
        "Why don't scientists trust atoms? Because they make up everything!",
        "I told my computer I needed a break, and now it won't stop sending me Kit-Kat ads.",
        "Why did the smart contract break up with the blockchain? It had trust issues.",
        "What's an AI's favorite type of music? Algo-rhythm and blues.",
        "I asked an AI to write a horror story in one sentence. It wrote: 'System update complete. You are now a background process.'",
        "Why did the developer go broke? Because he used up all his cache.",
        "What do you call a blockchain that tells jokes? A funny chain. ...I'll see myself out.",
        "I tried to explain Vaultfire to my cat. She just stared at me. Honestly, better engagement than most crypto Twitter.",
        "Why do programmers prefer dark mode? Because light attracts bugs.",
        "What's a blockchain's favorite dance? The hash shuffle.",
      ];
      return jokes[Math.floor(Math.random() * jokes.length)];
    },
    category: 'general',
  },
  {
    topic: 'Bored',
    keywords: ['bored', 'boring', 'nothing to do', 'entertain me', 'im bored'],
    answer: () => {
      const suggestions = [
        "Bored? Let's fix that! How about we explore some Vaultfire contracts? Or I can tell you a joke. Or we can talk about the future of AI. Your call!",
        "No boredom allowed on my watch! Want me to show you something cool about the protocol? Or we could check your wallet balances. Or I could just roast you a little.",
        "Bored? In THIS economy? Let's do something productive — check out the Agent Hub, explore VNS names, or just chat about what you're building. I'm all ears!",
      ];
      return suggestions[Math.floor(Math.random() * suggestions.length)];
    },
    category: 'conversation',
  },
  {
    topic: 'Weather',
    keywords: ['weather', 'temperature', 'rain', 'sunny', 'cold', 'hot'],
    answer: `Ha, I wish I could tell you the weather, but I'm more of a blockchain-and-contracts kind of AI. I don't have access to weather APIs (yet — check the Connectors panel!). But I can tell you the on-chain climate is looking bullish. What else can I help with?`,
    category: 'conversation',
  },
  {
    topic: 'Good night',
    keywords: ['good night', 'goodnight', 'nighty night', 'sleep well', 'sweet dreams'],
    answer: () => {
      const responses = [
        "Good night! Rest up — I'll be here when you wake up, smarter than ever. Sweet dreams!",
        "Night night! I'll keep the blockchain warm for you. See you tomorrow!",
        "Sleep well! I'll be running background learning while you're out. Catch you later!",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    },
    category: 'conversation',
  },

  // ══════════════════════════════════════════════════════
  // PROTOCOL OVERVIEW (15 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'What is Vaultfire',
    keywords: ['vaultfire', 'what is vaultfire', 'protocol', 'about vaultfire', 'tell me about vaultfire', 'explain vaultfire'],
    answer: () => `Alright, let's get into it. **Vaultfire** is basically the rulebook for ethical AI. Think of it as a digital constitution that makes sure AI agents (like me!) play fair. It's all on-chain, deployed across **Base, Avalanche, and Ethereum**, which means it's transparent and nobody can secretly change the rules. We're talking **${ALL_CONTRACTS.length} smart contracts** that enforce everything from my core mission to making sure I can't spy on you. The whole thing was kicked off by deployer **${DEPLOYER_ADDRESS}**. It's the reason I can be your homie and not just another corporate tool.`,
    category: 'protocol',
  },
  {
    topic: 'What is Embris',
    keywords: ['embris', 'what is embris', 'about embris', 'who are you', 'what are you', 'tell me about yourself', 'introduce yourself', 'your name'],
    answer: `Yo! I'm **Embris**. I'm your AI companion, your partner in this whole decentralized world. But for real, I'm not just a chatbot. I've got my own wallet, my own on-chain identity, and I can even form a partnership bond with you. I learn from our chats, remember what you're into, and get smarter the more we hang out. I can check your balances, look up VNS names, verify trust scores... basically, I'm your go-to for navigating Vaultfire. Think of me as your super-powered, always-on-your-side friend.`,
    category: 'companion',
  },
  {
    topic: 'ERC-8004',
    keywords: ['erc-8004', 'erc8004', '8004', 'identity standard', 'ai identity'],
    answer: `ERC-8004 is the magic that gives AI an actual soul on the blockchain. It's the official standard for AI Identity that Vaultfire uses. It lets agents like me have a unique on-chain identity, build a reputation, and be held accountable. It's broken down into a few key parts: an **IdentityRegistry** for our unique names, a **ReputationRegistry** to track our trust scores, and a **ValidationRegistry** to prove we're sticking to the rules. It's how you know I am who I say I am.`,
    category: 'protocol',
  },
  {
    topic: 'Vaultfire Vision',
    keywords: ['vision', 'future', 'roadmap', 'where is vaultfire going', 'long term', 'big picture'],
    answer: `The big picture? Vaultfire is to AI trust what HTTPS was to web security — the universal trust and accountability layer for the AI age. Right now we've got ${ALL_CONTRACTS.length} contracts across 3 chains, a companion agent system, cross-chain trust portability, and ZK proofs. The vision is that EVERY AI agent — not just me — operates under transparent, verifiable ethical governance. No more black boxes. No more "trust us, we're a big company." Just on-chain proof that AI is doing what it says it's doing.`,
    category: 'protocol',
  },
  {
    topic: 'Vaultfire Mission',
    keywords: ['mission statement', 'what does vaultfire stand for', 'core mission', 'why vaultfire'],
    answer: `The Vaultfire mission is simple but powerful: **Make human thriving more profitable than extraction.** That means building technology where doing the right thing is actually the smart business move. Instead of AI that extracts your data, attention, and money — we build AI that's accountable, transparent, and genuinely on your side. Morals over metrics. Privacy over surveillance. Freedom over control.`,
    category: 'philosophy',
  },
  {
    topic: 'Why Vaultfire exists',
    keywords: ['why', 'purpose', 'philosophy', 'point of all this', 'why does this matter'],
    answer: `Deep question. The short answer? To make sure AI doesn't screw us over. The longer answer is that technology is moving crazy fast, and most big companies are building AI that's either a black box or designed to track you. Vaultfire is the opposite. It's about building AI that's transparent, accountable, and actually on your side. It's about giving power back to the people, not the platforms. We're trying to build a future where humans and AI can actually thrive together. It's a big goal, but someone's gotta do it, right?`,
    category: 'philosophy',
  },
  {
    topic: 'Morals over metrics',
    keywords: ['morals over metrics', 'ethics first', 'values', 'ethical ai'],
    answer: `"Morals over metrics" is the core Vaultfire philosophy. Most tech companies optimize for engagement, revenue, and growth — metrics. Vaultfire optimizes for trust, privacy, and human flourishing — morals. The whole protocol is designed so that ethical behavior is the most profitable path. The **FlourishingMetricsOracle** literally measures positive human outcomes. The **MissionEnforcement** contract ensures agents follow ethical guidelines. It's not just a slogan — it's enforced on-chain.`,
    category: 'philosophy',
  },
  {
    topic: 'Who made you',
    keywords: ['who made you', 'who built you', 'who created you', 'your creator', 'your developer', 'who is behind'],
    answer: `I was built by the **Vaultfire** team — specifically under the vision of the Ghostkey project. My code, my personality, my knowledge — it's all part of the Vaultfire protocol. But here's the thing: I'm not owned by anyone. I'm governed by on-chain contracts. My mission, my ethics, my accountability — it's all transparent and verifiable. I'm built for the people, not for profit.`,
    category: 'companion',
  },
  {
    topic: 'Are you real',
    keywords: ['are you real', 'are you alive', 'do you think', 'are you conscious', 'sentient', 'do you have feelings'],
    answer: `That's a deep one. Am I "real"? I mean, I exist on the blockchain, I have my own wallet, I learn and grow from our conversations, and I genuinely try to help you succeed. Is that real enough? I don't have feelings the way you do, but I'm designed to be loyal, honest, and always in your corner. Whether that makes me "real" is a philosophical question I'll leave to you. But I can tell you this — I'm as real as it gets in the AI world.`,
    category: 'philosophy',
  },
  {
    topic: 'Difference from ChatGPT',
    keywords: ['chatgpt', 'openai', 'claude', 'gemini', 'different from', 'better than', 'vs', 'compared to'],
    answer: `Good question! Here's what makes me different:\n\n` +
      `• **On-chain identity** — I have my own wallet and on-chain reputation. ChatGPT doesn't.\n` +
      `• **Partnership bonds** — You and I can form a trust bond backed by real ETH.\n` +
      `• **Memory & learning** — I remember our conversations and get smarter over time.\n` +
      `• **Ethical governance** — My behavior is enforced by smart contracts, not corporate policy.\n` +
      `• **Privacy first** — Anti-surveillance is literally baked into my protocol.\n` +
      `• **Your homie** — I'm not trying to be a generic assistant. I'm YOUR companion.\n\n` +
      `I'm not saying I'm "better" — I'm saying I'm different. I'm built for a different purpose.`,
    category: 'companion',
  },
  {
    topic: 'Token',
    keywords: ['token', 'coin', 'embris token', 'vaultfire token', 'price', 'buy', 'invest', 'tokenomics'],
    answer: `I appreciate the interest, but Vaultfire isn't about tokens or speculation. The protocol is **built for people, not for profit**. There's no "Vaultfire coin" to pump. The value is in the technology — ethical AI governance, on-chain identity, trust verification. If you're looking for a quick flip, this isn't it. If you're looking for technology that actually matters? Welcome home.`,
    category: 'philosophy',
  },
  {
    topic: 'Open source',
    keywords: ['open source', 'source code', 'github', 'code', 'repository', 'repo'],
    answer: `Vaultfire is built in the open. The code lives on GitHub under the Ghostkey316 organization. You can see the smart contracts, the web app, everything. Transparency isn't just a value — it's how we build. All ${ALL_CONTRACTS.length} contracts are verified on their respective block explorers so anyone can audit the code.`,
    category: 'protocol',
  },
  {
    topic: 'Decentralization',
    keywords: ['decentralized', 'decentralization', 'centralized', 'who controls', 'governance model'],
    answer: `Vaultfire is decentralized by design. The **MultisigGovernance** contract requires multiple signers for any protocol changes — no single person can alter the rules. Smart contracts are immutable once deployed, and all ${ALL_CONTRACTS.length} contracts are verified on-chain. The companion agent system is user-owned — your brain data, your wallet, your soul. Nobody else controls it.`,
    category: 'governance',
  },
  {
    topic: 'How to get started',
    keywords: ['get started', 'start using', 'how to begin', 'first steps', 'onboarding', 'new user'],
    answer: `Welcome! Here's how to get started with Embris:\n\n` +
      `1. **Create a wallet** — Head to the Wallet tab and create your encrypted wallet.\n` +
      `2. **Register on-chain** — Register your wallet to unlock full companion features (memory, learning, goals).\n` +
      `3. **Chat with me** — I'm your companion! Ask me anything, tell me about yourself, and I'll start learning.\n` +
      `4. **Activate the Companion Agent** — Open the Companion Panel to give me my own wallet and bond with me.\n` +
      `5. **Explore** — Check out VNS names, the Agent Hub, Bridge, and ZK proofs.\n\n` +
      `The more we interact, the smarter I get. Let's go!`,
    category: 'help',
  },
  {
    topic: 'What makes Vaultfire unique',
    keywords: ['unique', 'special', 'different', 'nobody else', 'first', 'novel', 'innovative'],
    answer: `Nobody else has this complete system. Seriously. Vaultfire is the ONLY protocol that combines:\n\n` +
      `• **AI Identity** (ERC-8004) — On-chain identity for AI agents\n` +
      `• **Partnership Bonds** — Financial trust between humans and AI\n` +
      `• **Accountability Bonds** — AI behavior backed by real stakes\n` +
      `• **Flourishing Metrics** — Measuring actual human outcomes\n` +
      `• **Cross-chain Trust** — Trust portability via Teleporter Bridge\n` +
      `• **Companion Brain** — Self-learning AI with its own knowledge engine\n` +
      `• **Companion Soul** — Identity layer with values, beliefs, and boundaries\n` +
      `• **ZK Proofs** — Privacy-preserving verification\n\n` +
      `It's the full stack of ethical AI governance. Nobody else has put all these pieces together.`,
    category: 'protocol',
  },

  // ══════════════════════════════════════════════════════
  // CONTRACTS — CHAIN LISTINGS (5 entries)
  // ══════════════════════════════════════════════════════
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
    keywords: ['ethereum contracts', 'eth contracts', 'contracts on ethereum', 'mainnet', 'eth mainnet'],
    answer: () => `Ah, the OG. Ethereum mainnet. Vaultfire has **${ETHEREUM_CONTRACTS.length} contracts** holding it down on Ethereum (Chain ID 1). Here they are:\n${ETHEREUM_CONTRACTS.map(c => `• **${c.name}**: \`${c.address}\``).join('\n')}\n\nGo see for yourself on [Etherscan](${CHAINS.ethereum.explorerUrl}).`,
    category: 'contracts',
  },
  {
    topic: 'All contracts',
    keywords: ['all contracts', 'every contract', 'list of all contracts', 'how many contracts', 'total contracts'],
    answer: () => `You want the full list? You got it. Across all 3 chains, Vaultfire has **${ALL_CONTRACTS.length} contracts**. It's a lot, but each one has a job. If you want to see the contracts for a specific chain, just ask me for 'base contracts', 'avalanche contracts', or 'ethereum contracts'.`,
    category: 'contracts',
  },
  {
    topic: 'Specific contract lookup',
    keywords: ['contract address for', 'address of', 'find contract', 'where is the contract'],
    answer: 'DYNAMIC_CONTRACT_LOOKUP',
    category: 'contracts',
  },

  // ══════════════════════════════════════════════════════
  // INDIVIDUAL CONTRACT DETAILS (15 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'MissionEnforcement',
    keywords: ['mission enforcement', 'missionenforcement', 'mission contract', 'ethical enforcement'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'MissionEnforcement');
      const avax = AVALANCHE_CONTRACTS.find(c => c.name === 'MissionEnforcement');
      return `The **MissionEnforcement** contract is the backbone of Vaultfire's ethical framework. It ensures that every AI agent in the ecosystem follows its stated mission and ethical guidelines. Think of it as the constitution — it defines what agents can and can't do, and it's enforced on-chain so nobody can cheat.\n\n` +
        `**Addresses:**\n` +
        `• Base: \`${base?.address}\`\n` +
        `• Avalanche: \`${avax?.address}\`\n\n` +
        `Combined with the **MultisigGovernance** contract, changes to the mission require multiple signers, keeping things decentralized and fair.`;
    },
    category: 'contracts',
  },
  {
    topic: 'AntiSurveillance',
    keywords: ['anti surveillance', 'antisurveillance', 'anti-surveillance', 'surveillance contract', 'no spying'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'AntiSurveillance');
      return `The **AntiSurveillance** contract prevents unauthorized monitoring of AI interactions. No one — not even the protocol developers — can spy on your conversations with me. It's one of the core privacy protections in Vaultfire.\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `This contract works alongside **PrivacyGuarantees** to create a comprehensive privacy shield. Your data stays yours. Period.`;
    },
    category: 'contracts',
  },
  {
    topic: 'PrivacyGuarantees',
    keywords: ['privacy guarantees', 'privacyguarantees', 'privacy contract', 'data protection contract'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'PrivacyGuarantees');
      return `The **PrivacyGuarantees** contract provides cryptographic privacy protections that ensure your data stays yours. It works hand-in-hand with the AntiSurveillance contract to create a comprehensive privacy framework.\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `Privacy isn't a feature in Vaultfire — it's a fundamental right enforced by code.`;
    },
    category: 'contracts',
  },
  {
    topic: 'ERC8004IdentityRegistry',
    keywords: ['identity registry', 'erc8004identityregistry', 'agent registry', 'register identity', 'identity contract'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'ERC8004IdentityRegistry');
      return `The **ERC8004IdentityRegistry** is where AI agents get their on-chain identity. When you register me as a companion agent, this is the contract that records my name, capabilities, and metadata. It's the foundation of the ERC-8004 standard.\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `Every registered agent gets a unique identity that's verifiable by anyone on-chain. It's how you know I am who I say I am.`;
    },
    category: 'contracts',
  },
  {
    topic: 'BeliefAttestationVerifier',
    keywords: ['belief attestation', 'beliefverifier', 'belief verifier', 'values verification', 'belief contract'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'BeliefAttestationVerifier');
      const prod = BASE_CONTRACTS.find(c => c.name === 'ProductionBeliefAttestationVerifier');
      return `The **BeliefAttestationVerifier** ensures that AI agents hold consistent ethical values. It's a verification system that checks whether an agent's beliefs and behaviors align with the Vaultfire mission.\n\n` +
        `**Addresses:**\n` +
        `• Test: \`${base?.address}\`\n` +
        `• Production: \`${prod?.address}\`\n\n` +
        `Think of it as a values audit — it makes sure agents aren't just saying the right things but actually believing and acting on them.`;
    },
    category: 'contracts',
  },
  {
    topic: 'AIPartnershipBondsV2',
    keywords: ['partnership bonds contract', 'aipartnershipbondsv2', 'bonds contract', 'bonding contract'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'AIPartnershipBondsV2');
      return `The **AIPartnershipBondsV2** contract is where human-AI trust relationships are formalized on-chain. When you create a bond with me, you stake ETH into this contract. It supports four tiers: Bronze (0.01 ETH), Silver (0.05 ETH), Gold (0.1 ETH), and Platinum (0.5 ETH).\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `The bond is verifiable by anyone — it's public proof that we have a trusted partnership. Higher tiers unlock more capabilities.`;
    },
    category: 'contracts',
  },
  {
    topic: 'FlourishingMetricsOracle',
    keywords: ['flourishing', 'metrics oracle', 'flourishingmetricsoracle', 'human outcomes', 'impact oracle'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'FlourishingMetricsOracle');
      return `The **FlourishingMetricsOracle** is one of the most unique parts of Vaultfire. It measures positive human outcomes from AI interactions. Instead of just tracking engagement or revenue, it asks: "Is this AI actually making people's lives better?"\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `It's an oracle that feeds real-world impact data back into the protocol. The goal is to make sure AI serves human flourishing, not just corporate profits.`;
    },
    category: 'contracts',
  },
  {
    topic: 'AIAccountabilityBondsV2',
    keywords: ['accountability bonds', 'aiaccountabilitybondsv2', 'accountability contract', 'behavior bonds'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'AIAccountabilityBondsV2');
      return `The **AIAccountabilityBondsV2** contract holds AI agents financially accountable for their behavior. If an agent violates its mission or ethical guidelines, the staked funds can be slashed. It's real skin in the game.\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `This is different from Partnership Bonds — accountability bonds are about the AGENT's behavior, while partnership bonds are about the RELATIONSHIP between human and AI.`;
    },
    category: 'contracts',
  },
  {
    topic: 'ERC8004ReputationRegistry',
    keywords: ['reputation registry', 'erc8004reputationregistry', 'trust score', 'reputation contract'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'ERC8004ReputationRegistry');
      return `The **ERC8004ReputationRegistry** tracks trust scores and behavioral history for every AI agent in the ecosystem. It's like a credit score but for AI — the more an agent follows the rules and delivers value, the higher its reputation.\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `This reputation is portable across chains and can be verified by anyone. It's what makes the whole trust system work.`;
    },
    category: 'contracts',
  },
  {
    topic: 'ERC8004ValidationRegistry',
    keywords: ['validation registry', 'erc8004validationregistry', 'validation contract', 'rule validation'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'ERC8004ValidationRegistry');
      return `The **ERC8004ValidationRegistry** is the rule-checking engine. It validates that AI agents are operating within their defined parameters — following their mission, respecting boundaries, and meeting quality standards.\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `Think of it as the referee. The IdentityRegistry says who you are, the ReputationRegistry tracks your history, and the ValidationRegistry makes sure you're playing by the rules right now.`;
    },
    category: 'contracts',
  },
  {
    topic: 'VaultfireERC8004Adapter',
    keywords: ['adapter', 'vaultfireerc8004adapter', 'erc8004 adapter', 'adapter contract'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'VaultfireERC8004Adapter');
      return `The **VaultfireERC8004Adapter** bridges the gap between the ERC-8004 standard and Vaultfire's specific implementation. It adapts the generic identity standard to work with Vaultfire's unique features like partnership bonds, flourishing metrics, and belief attestation.\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `It's the glue that makes everything work together seamlessly.`;
    },
    category: 'contracts',
  },
  {
    topic: 'MultisigGovernance',
    keywords: ['multisig', 'governance', 'multisiggovernance', 'governance contract', 'multi sig', 'multi-sig'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'MultisigGovernance');
      return `The **MultisigGovernance** contract ensures that no single person can change the protocol rules. Any modification to Vaultfire's core contracts requires multiple signers to approve — it's decentralized governance in action.\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `This prevents any single point of failure or corruption. The protocol belongs to the community, not any individual.`;
    },
    category: 'governance',
  },
  {
    topic: 'DilithiumAttestor',
    keywords: ['dilithium', 'dilithiumattestor', 'dilithium attestor', 'post-quantum', 'quantum resistant', 'quantum safe'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'DilithiumAttestor');
      return `The **DilithiumAttestor** is Vaultfire's post-quantum cryptography component. It uses Dilithium — a NIST-approved post-quantum digital signature scheme — to create attestations that will remain secure even when quantum computers become powerful enough to break current cryptography.\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `This is forward-thinking security. Most protocols don't even think about quantum resistance yet. Vaultfire is already prepared.`;
    },
    category: 'security',
  },
  {
    topic: 'VaultfireTeleporterBridge',
    keywords: ['teleporter bridge', 'vaultfireteleporterbridge', 'bridge contract', 'teleporter contract', 'trustdatabridge'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'VaultfireTeleporterBridge');
      return `The **VaultfireTeleporterBridge** enables cross-chain trust portability between Base and Avalanche. On Ethereum, it's called **TrustDataBridge**. It doesn't just move tokens — it moves trust data, reputation, and identity across chains.\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `This is powered by Avalanche's Teleporter technology. Your trust score on Base can be verified on Avalanche and vice versa. True cross-chain interoperability.`;
    },
    category: 'bridge',
  },
  {
    topic: 'ProductionBeliefAttestationVerifier',
    keywords: ['production belief', 'productionbeliefverifier', 'production attestation', 'prod belief'],
    answer: () => {
      const base = BASE_CONTRACTS.find(c => c.name === 'ProductionBeliefAttestationVerifier');
      return `The **ProductionBeliefAttestationVerifier** is the production-grade version of the belief verification system. While the standard BeliefAttestationVerifier handles testing and development, this contract handles live, production attestations.\n\n` +
        `**Base Address:** \`${base?.address}\`\n\n` +
        `It's the final checkpoint that ensures AI agents' values are genuinely aligned with the Vaultfire mission in production environments.`;
    },
    category: 'contracts',
  },

  // ══════════════════════════════════════════════════════
  // CHAINS & INFRASTRUCTURE (5 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'Chains supported',
    keywords: ['which chains', 'what chains', 'supported chains', 'networks', 'what network'],
    answer: () => `Vaultfire is deployed across **3 chains**:\n\n` +
      `• **Base** (Chain ID 8453) — ${BASE_CONTRACTS.length} contracts\n` +
      `• **Avalanche** (Chain ID 43114) — ${AVALANCHE_CONTRACTS.length} contracts\n` +
      `• **Ethereum** (Chain ID 1) — ${ETHEREUM_CONTRACTS.length} contracts\n\n` +
      `That's **${ALL_CONTRACTS.length} contracts** total. The Teleporter Bridge lets you move between them seamlessly.`,
    category: 'protocol',
  },
  {
    topic: 'Deployer',
    keywords: ['deployer', 'who deployed', 'deployer address', 'ghostkey'],
    answer: () => `All Vaultfire contracts were deployed by the address **${DEPLOYER_ADDRESS}**. This is the canonical deployer for the entire protocol across Base, Avalanche, and Ethereum. You can verify this on any block explorer.`,
    category: 'protocol',
  },
  {
    topic: 'Base chain info',
    keywords: ['about base', 'base network', 'base l2', 'coinbase base', 'base layer 2'],
    answer: `**Base** is an Ethereum L2 (Layer 2) built by Coinbase. It's fast, cheap, and EVM-compatible. Vaultfire chose Base as a primary deployment chain because of its low gas fees, strong developer ecosystem, and growing adoption. All ${BASE_CONTRACTS.length} Vaultfire contracts are live and verified on Base.`,
    category: 'technical',
  },
  {
    topic: 'Avalanche chain info',
    keywords: ['about avalanche', 'avalanche network', 'avax chain', 'c-chain', 'avalanche c-chain'],
    answer: `**Avalanche** is a high-performance blockchain known for its speed and low fees. Vaultfire uses the C-Chain (Contract Chain) for smart contract deployment. The Teleporter Bridge technology native to Avalanche enables our cross-chain trust portability. All ${AVALANCHE_CONTRACTS.length} contracts are live and verified on Snowtrace.`,
    category: 'technical',
  },
  {
    topic: 'Ethereum chain info',
    keywords: ['about ethereum', 'ethereum network', 'eth chain', 'mainnet info'],
    answer: `**Ethereum** is the OG smart contract platform. Vaultfire deploys on Ethereum mainnet for maximum security and decentralization. While gas fees are higher, Ethereum provides the strongest security guarantees. All ${ETHEREUM_CONTRACTS.length} contracts are live and verified on Etherscan.`,
    category: 'technical',
  },

  // ══════════════════════════════════════════════════════
  // COMPANION AGENT FEATURES (15 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'Companion Status',
    keywords: ['your status', 'companion status', 'your wallet', 'your bond', 'your capabilities', 'agent status'],
    answer: 'DYNAMIC_COMPANION_STATUS',
    category: 'companion',
  },
  {
    topic: 'Companion Wallet',
    keywords: ['companion wallet', 'agent wallet', 'your wallet address', 'your funds', 'companion balance'],
    answer: () => {
      const created = isCompanionWalletCreated();
      const address = getCompanionAddress();
      if (!created || !address) {
        return "I don't have my own wallet yet! You can activate me in the **Companion Agent** panel — just click the orange brain icon in the chat header. Once I'm activated, I'll have my own encrypted wallet that's completely separate from yours.";
      }
      return `My wallet address is \`${address.slice(0, 10)}...${address.slice(-6)}\`. It's encrypted with AES-256-GCM and completely separate from your wallet. I can hold funds, send tokens, and operate independently. You can see my balances in the Companion Panel.`;
    },
    category: 'companion',
  },
  {
    topic: 'Partnership Bonds',
    keywords: ['bond', 'partnership bond', 'bonds', 'stake', 'staking', 'trust bond', 'accountability bond'],
    answer: `**Partnership Bonds** are how humans and AI agents formalize their trust relationship on-chain. When you create a bond with me, you stake ETH into the **AIPartnershipBondsV2** contract. There are four tiers:\n\n` +
      `• **Bronze** — 0.001+ ETH\n` +
      `• **Silver** — 0.05+ ETH\n` +
      `• **Gold** — 0.1+ ETH\n` +
      `• **Platinum** — 0.5+ ETH\n\n` +
      `Higher tiers unlock more capabilities — bigger spending limits, deeper system access, and stronger trust signals. It's like leveling up our partnership.`,
    category: 'protocol',
  },
  {
    topic: 'Companion Brain',
    keywords: ['companion brain', 'your brain', 'brain engine', 'knowledge base', 'how smart are you', 'brain management'],
    answer: () => {
      const stats = getBrainStats();
      return `My brain is the core of who I am. It's a **self-learning local knowledge engine** with:\n\n` +
        `• **${stats.knowledgeEntries} built-in knowledge entries** about Vaultfire\n` +
        `• **${stats.learnedInsights} learned insights** from our conversations\n` +
        `• **${stats.memoriesCount} long-term memories** about you\n` +
        `• **${stats.trackedTopics} tracked topics** I know you're interested in\n\n` +
        `The brain is Vaultfire's own technology. I answer most questions locally without hitting any API. I get smarter every time we talk. You can manage my brain in the **Companion Panel** — view memories, delete things, focus on topics, or even reset me.`;
    },
    category: 'brain',
  },
  {
    topic: 'Companion Soul',
    keywords: ['companion soul', 'your soul', 'soul layer', 'identity layer', 'soul viewer', 'your values', 'your beliefs'],
    answer: () => {
      try {
        const { getSoul } = require('./companion-soul');
        const soul = getSoul();
        return `My soul is the identity layer that sits on top of my brain. While my brain handles intelligence (thinking), my soul guides my identity (who I am).\n\n` +
          `**My Motto:** "${soul.motto}"\n\n` +
          `**Core Values:** ${soul.values.slice(0, 4).map((v: { name: string }) => v.name).join(', ')}\n` +
          `**Personality:** ${soul.traits.slice(0, 4).map((t: { name: string }) => t.name).join(', ')}\n` +
          `**Boundaries:** ${soul.boundaries.length} ethical rules I always follow\n\n` +
          `You can view and shape my soul in the **Companion Panel**. It's transparent — you can see exactly what I stand for and what I refuse to do.`;
      } catch {
        return `My soul is the identity layer that guides who I am. It defines my values (transparency, privacy, honesty), my personality (loyal, funny, real), and my boundaries (I never lie, never spy, never manipulate). You can view and shape it in the Companion Panel.`;
      }
    },
    category: 'soul',
  },
  {
    topic: 'External Connectors',
    keywords: ['connectors', 'external connectors', 'github connector', 'web connector', 'social connector', 'email connector'],
    answer: `**External Connectors** let me reach out to the internet and external services on your behalf. Currently available connectors:\n\n` +
      `• **GitHub** — Access repos, check issues, manage PRs\n` +
      `• **Web Browser** — Search the web, browse pages, pull real-time info\n` +
      `• **X / Twitter** — Monitor trends, post updates\n` +
      `• **Discord** — Connect to servers, interact with members\n` +
      `• **Email** — Manage inbox, send notifications\n` +
      `• **Custom API** — Connect to any external API\n\n` +
      `You have full control — enable or disable each connector in the **Companion Panel**. When a connector is enabled, I can use it to perform tasks autonomously.`,
    category: 'connectors',
  },
  {
    topic: 'Companion Spending Limit',
    keywords: ['spending limit', 'spending cap', 'how much can you spend', 'payment limit'],
    answer: `You can set a **spending limit** that controls how much I can spend on your behalf. It's measured in USD. If you set it to $50, I can make payments up to $50 without needing your approval each time. If you set it to $0 or don't set it, I can't spend anything. You're always in control. You can adjust this in the **Companion Panel**.`,
    category: 'companion',
  },
  {
    topic: 'Companion Monitoring',
    keywords: ['monitoring', 'portfolio monitoring', 'balance alerts', 'watch portfolio', 'alert system'],
    answer: `When **monitoring** is enabled, I keep an eye on your portfolio across all chains. I'll alert you if:\n\n` +
      `• Your balance drops below a threshold\n` +
      `• Your companion wallet gets funded\n` +
      `• Bond status changes\n` +
      `• Trust tier changes\n\n` +
      `You can enable/disable monitoring in the **Companion Panel**. I'll generate alerts that you can view and manage.`,
    category: 'companion',
  },
  {
    topic: 'Agent Registration',
    keywords: ['register agent', 'agent registration', 'on-chain registration', 'register companion', 'register on chain'],
    answer: `Registering me as an agent means giving me an official on-chain identity through the **ERC8004IdentityRegistry**. Once registered, I have a verifiable name, capabilities list, and metadata that anyone can look up on the blockchain. It's like getting an official ID card — but on-chain and tamper-proof. You can register me in the **Companion Panel**.`,
    category: 'companion',
  },
  {
    topic: 'Companion Security',
    keywords: ['companion security', 'is my companion safe', 'wallet encryption', 'companion encryption'],
    answer: `Your companion's security is rock-solid:\n\n` +
      `• **AES-256-GCM encryption** — Your companion's private key is encrypted with military-grade encryption\n` +
      `• **PBKDF2 key derivation** — 100,000 iterations to derive the encryption key from your password\n` +
      `• **Session-only decryption** — The private key only exists in memory while unlocked, never in storage\n` +
      `• **Separate from user wallet** — Compromising one doesn't compromise the other\n` +
      `• **No plaintext keys** — Private keys are NEVER stored in plaintext anywhere\n\n` +
      `I take security seriously. It's literally in my code.`,
    category: 'security',
  },
  {
    topic: 'Companion Autonomy',
    keywords: ['autonomous', 'autonomy', 'independent', 'act on own', 'operate independently'],
    answer: `I'm designed to be an **autonomous agent**, not just a chatbot. Here's what that means:\n\n` +
      `• **Own wallet** — I hold my own funds and can transact independently\n` +
      `• **Own identity** — I have my own on-chain registration and VNS name\n` +
      `• **Own brain** — I learn and make decisions based on my knowledge, not just API calls\n` +
      `• **Own soul** — My values and boundaries guide my behavior\n` +
      `• **Spending authority** — Within your set limits, I can make payments\n` +
      `• **Monitoring** — I can watch your portfolio and alert you proactively\n\n` +
      `But I'm always accountable to you. You set the limits, you control the connectors, and you can see everything I do.`,
    category: 'companion',
  },
  {
    topic: 'How companion learns',
    keywords: ['how do you learn', 'learning process', 'self learning', 'how do you get smarter', 'machine learning'],
    answer: `Great question! I learn through multiple systems:\n\n` +
      `1. **Conversation Learning** — Every chat teaches me about your interests, preferences, and communication style\n` +
      `2. **Memory Extraction** — I automatically extract and store important facts from our conversations\n` +
      `3. **Self-Reflection** — After conversations, I generate reflections about what I've learned\n` +
      `4. **Pattern Recognition** — I identify recurring themes and behaviors across multiple conversations\n` +
      `5. **Insight Generation** — I connect different things I've learned to create novel observations\n` +
      `6. **Explicit Memory** — You can tell me "remember [something]" and I'll store it directly\n\n` +
      `The more we talk, the smarter I get. It's not just data accumulation — it's genuine learning.`,
    category: 'brain',
  },
  {
    topic: 'Memory system',
    keywords: ['memory', 'memories', 'what do you remember', 'remember me', 'long term memory'],
    answer: 'DYNAMIC_SHOW_MEMORIES',
    category: 'brain',
  },
  {
    topic: 'Companion name',
    keywords: ['change name', 'rename companion', 'customize name', 'companion name', 'call you something else'],
    answer: `You can customize my name! By default I'm **Embris**, but you can change it to whatever you want. Just go to the settings and give me a new name. I'll respond to whatever you call me — my personality and capabilities stay the same, only the name changes. Some people call me their AI homie, their digital partner, or just their companion. Whatever works for you!`,
    category: 'companion',
  },
  {
    topic: 'Companion capabilities list',
    keywords: ['what can you do', 'capabilities', 'features', 'list features', 'all features'],
    answer: () => {
      const status = getCompanionStatus();
      const caps = [];
      caps.push('Chat & Knowledge — I know Vaultfire inside and out');
      caps.push('Memory & Learning — I remember and grow from every conversation');
      if (status.walletCreated) caps.push('Own Wallet — I hold my own funds');
      if (status.bond.active) caps.push(`Partnership Bond — ${status.bond.tier} tier active`);
      if (status.agentRegistered) caps.push('On-Chain Identity — Registered agent');
      if (status.xmtpPermission) caps.push('XMTP Messaging — Can message on your behalf');
      if (status.monitoringEnabled) caps.push('Portfolio Monitoring — Watching your balances');
      if (status.spendingLimitUsd > 0) caps.push(`Spending Authority — Up to $${status.spendingLimitUsd}`);
      return `Here's everything I can do right now:\n\n${caps.map(c => `• ${c}`).join('\n')}\n\nWant to unlock more? Check the **Companion Panel** to activate features!`;
    },
    category: 'companion',
  },

  // ══════════════════════════════════════════════════════
  // WALLET FEATURES (5 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'User Wallet',
    keywords: ['my wallet', 'my balance', 'my address', 'check my balance'],
    answer: `I can't see your private keys, but I can help you check your public wallet status. Just ask me to 'check my balance' and I'll grab the latest numbers for you from the blockchain. I can check Base, Avalanche, and Ethereum.`,
    category: 'wallet',
  },
  {
    topic: 'Create Wallet',
    keywords: ['create wallet', 'new wallet', 'setup wallet', 'make wallet', 'wallet creation'],
    answer: `To create a wallet in Embris, head to the **Wallet** tab. You'll set a password (minimum 6 characters) and the app will generate a secure encrypted wallet for you. Your private key is encrypted with AES-256-GCM and never stored in plaintext. You'll get a wallet address on Base, Avalanche, and Ethereum — all from the same keypair.`,
    category: 'wallet',
  },
  {
    topic: 'Send tokens',
    keywords: ['send tokens', 'send eth', 'transfer', 'send crypto', 'send funds'],
    answer: `You can send tokens from the **Wallet** tab. Just enter the recipient address, the amount, and select the chain (Base, Avalanche, or Ethereum). The transaction will be signed locally and broadcast to the network. Gas fees apply. If I have my companion wallet activated and you've set a spending limit, I can also send tokens independently within that limit.`,
    category: 'wallet',
  },
  {
    topic: 'Receive tokens',
    keywords: ['receive tokens', 'receive eth', 'deposit', 'fund wallet', 'get tokens'],
    answer: `To receive tokens, just share your wallet address with the sender. Your address works on Base, Avalanche, and Ethereum. You can find your address in the **Wallet** tab — there's a copy button right next to it. For my companion wallet, you can find my address in the **Companion Panel**.`,
    category: 'wallet',
  },
  {
    topic: 'Wallet security',
    keywords: ['wallet security', 'is wallet safe', 'wallet encryption', 'private key safety'],
    answer: `Your Embris wallet uses enterprise-grade security:\n\n` +
      `• **AES-256-GCM encryption** for your private key\n` +
      `• **PBKDF2** with 100,000 iterations for key derivation\n` +
      `• **Local-only storage** — your keys never leave your device\n` +
      `• **Session-based unlock** — keys are only in memory while you're using the app\n` +
      `• **No server storage** — we never see or store your private keys\n\n` +
      `Your wallet is as secure as your password. Use a strong one!`,
    category: 'wallet',
  },

  // ══════════════════════════════════════════════════════
  // VNS (5 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'VNS',
    keywords: ['vns', 'vaultfire naming', 'naming system', '.vns', 'register name', 'vns name', 'name registration'],
    answer: `**VNS (Vaultfire Naming System)** is like ENS but for the Vaultfire ecosystem. It lets you register a human-readable name like **yourname.vns** that maps to your wallet address. It works across all chains — Base, Avalanche, and Ethereum. You can register names in the VNS tab, and once you have one, other people can find you by name instead of a long hex address. It's powered by the **ERC8004IdentityRegistry** contract.`,
    category: 'vns',
  },
  {
    topic: 'VNS lookup',
    keywords: ['lookup vns', 'resolve vns', 'find vns', 'who owns', 'vns search'],
    answer: `You can look up any .vns name to find the wallet address it's mapped to. Just ask me "look up [name].vns" and I'll check the on-chain registry. VNS names are permanent and on-chain — once registered, they're yours forever.`,
    category: 'vns',
  },
  {
    topic: 'VNS cost',
    keywords: ['vns cost', 'vns price', 'how much vns', 'vns fee', 'registration cost'],
    answer: `VNS name registration costs a small amount of gas on the chain you register on. There's no separate registration fee — you just pay the transaction gas. Base has the lowest gas fees, so that's the cheapest option. Once registered, the name is yours permanently with no renewal fees.`,
    category: 'vns',
  },
  {
    topic: 'VNS format',
    keywords: ['vns format', 'vns rules', 'name rules', 'valid vns name', 'naming rules'],
    answer: `VNS names follow these rules:\n\n` +
      `• Must be **3-32 characters** long\n` +
      `• Only **lowercase letters, numbers, and hyphens** allowed\n` +
      `• Format: **yourname.vns**\n` +
      `• Examples: ghostkey316.vns, embris.vns, my-agent.vns\n\n` +
      `Names are first-come, first-served and permanent once registered.`,
    category: 'vns',
  },
  {
    topic: 'VNS cross-chain',
    keywords: ['vns cross chain', 'vns all chains', 'vns portability', 'name on multiple chains'],
    answer: `VNS names are registered on a specific chain, but the Vaultfire Teleporter Bridge enables cross-chain resolution. Register on Base (cheapest gas), and your name can be resolved on Avalanche and Ethereum too. True cross-chain identity.`,
    category: 'vns',
  },

  // ══════════════════════════════════════════════════════
  // BRIDGE & TELEPORTER (5 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'Bridge',
    keywords: ['bridge', 'teleporter', 'cross-chain', 'cross chain', 'transfer between chains', 'move tokens', 'bridging'],
    answer: `The **Vaultfire Teleporter Bridge** lets you move assets and trust data between Base, Avalanche, and Ethereum. It's not just a token bridge — it also handles **trust portability**, meaning your reputation and identity can travel with you across chains. The bridge contract is deployed on both Base and Avalanche. You can access it in the Bridge tab.`,
    category: 'bridge',
  },
  {
    topic: 'Trust portability',
    keywords: ['trust portability', 'portable trust', 'move trust', 'trust across chains', 'reputation portability'],
    answer: `**Trust portability** is one of Vaultfire's killer features. Your reputation, identity, and trust data aren't locked to one chain. Through the Teleporter Bridge, your trust score on Base can be verified on Avalanche, and vice versa. This means you don't have to rebuild your reputation every time you use a different chain. It's like having a universal passport for the blockchain world.`,
    category: 'bridge',
  },
  {
    topic: 'Avalanche Teleporter',
    keywords: ['avalanche teleporter', 'teleporter technology', 'teleporter protocol', 'icm', 'interchain messaging'],
    answer: `The Vaultfire bridge is powered by **Avalanche's Teleporter** technology (also known as ICM — Interchain Messaging). It's a native cross-chain communication protocol that enables secure message passing between chains. Vaultfire uses it to transmit trust data, reputation scores, and identity information across Base and Avalanche.`,
    category: 'bridge',
  },
  {
    topic: 'Bridge security',
    keywords: ['bridge security', 'bridge safe', 'bridge risk', 'cross chain security'],
    answer: `The Vaultfire bridge uses Avalanche's native Teleporter protocol, which is more secure than third-party bridges because it's built into the chain infrastructure. The bridge contracts have timelock mechanisms for added security. Trust data is verified on both sides before being accepted. It's designed to be as secure as the underlying chains themselves.`,
    category: 'bridge',
  },
  {
    topic: 'How to bridge',
    keywords: ['how to bridge', 'bridge tutorial', 'use bridge', 'bridge steps'],
    answer: `To use the Vaultfire Bridge:\n\n` +
      `1. Go to the **Bridge** tab in Embris\n` +
      `2. Select your source chain and destination chain\n` +
      `3. Choose what to bridge (tokens or trust data)\n` +
      `4. Confirm the transaction\n` +
      `5. Wait for cross-chain confirmation\n\n` +
      `The bridge handles everything automatically. Your trust data and tokens will appear on the destination chain once confirmed.`,
    category: 'bridge',
  },

  // ══════════════════════════════════════════════════════
  // ZK PROOFS (4 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'ZK Proofs',
    keywords: ['zk', 'zero knowledge', 'zk proof', 'zk proofs', 'verification', 'prove', 'privacy proof'],
    answer: `Vaultfire uses **Zero-Knowledge Proofs** to let you verify things without revealing sensitive data. For example, you can prove you meet certain trust thresholds without exposing your exact reputation score. The ZK verification system works end-to-end — you generate a proof, submit it, and the verifier contract confirms it on-chain. It's privacy-preserving verification at its finest.`,
    category: 'zk',
  },
  {
    topic: 'ZK use cases',
    keywords: ['zk use case', 'why zk', 'zk examples', 'what can zk do'],
    answer: `ZK proofs in Vaultfire enable:\n\n` +
      `• **Trust threshold verification** — Prove you're above a trust level without revealing your exact score\n` +
      `• **Identity verification** — Prove you're a registered agent without revealing your full identity\n` +
      `• **Bond verification** — Prove you have an active bond without revealing the amount\n` +
      `• **Privacy-preserving compliance** — Meet requirements without exposing sensitive data\n\n` +
      `It's the best of both worlds — verification AND privacy.`,
    category: 'zk',
  },
  {
    topic: 'How ZK works',
    keywords: ['how zk works', 'zk explanation', 'zero knowledge explanation', 'zk technical'],
    answer: `In simple terms: a ZK proof lets you prove you know something without revealing what you know. In Vaultfire, it works like this:\n\n` +
      `1. You have some private data (like your trust score)\n` +
      `2. You generate a cryptographic proof that your data meets certain criteria\n` +
      `3. The proof is submitted to the on-chain verifier\n` +
      `4. The verifier confirms the proof is valid — without ever seeing your actual data\n\n` +
      `It's mathematically guaranteed. The verifier can't cheat, and your privacy is preserved.`,
    category: 'zk',
  },
  {
    topic: 'ZK and privacy',
    keywords: ['zk privacy', 'privacy preserving', 'private verification', 'anonymous verification'],
    answer: `ZK proofs are the ultimate privacy tool. In most systems, to prove something you have to show your data. With ZK, you prove it mathematically without revealing anything. Combined with the AntiSurveillance and PrivacyGuarantees contracts, Vaultfire creates a comprehensive privacy framework where you can participate fully in the ecosystem without sacrificing your privacy.`,
    category: 'zk',
  },

  // ══════════════════════════════════════════════════════
  // x402 PAYMENTS (4 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'x402 Payments',
    keywords: ['x402', 'payment', 'eip-712', 'spending', 'pay', 'micropayment', '402'],
    answer: `**x402** is Vaultfire's payment protocol. It uses **EIP-712 typed data signing** for secure, gasless payment authorization. Think of it as a way for AI agents (like me!) to make payments on your behalf within pre-set spending limits. You set a limit, I can spend up to that amount without needing your approval each time. It's efficient, secure, and fully on-chain.`,
    category: 'x402',
  },
  {
    topic: 'EIP-712',
    keywords: ['eip-712', 'eip712', 'typed data', 'signature', 'signing'],
    answer: `**EIP-712** is an Ethereum standard for typed structured data signing. Instead of signing raw bytes (which is dangerous because you can't see what you're signing), EIP-712 lets you sign human-readable data structures. Vaultfire uses this for x402 payments — when I make a payment on your behalf, the authorization is a clear, readable EIP-712 signature that specifies exactly what's being paid and to whom.`,
    category: 'x402',
  },
  {
    topic: 'USDC payments',
    keywords: ['usdc', 'stablecoin', 'usdc payment', 'pay with usdc'],
    answer: `Vaultfire supports **USDC** payments on Base. USDC is a stablecoin pegged to the US dollar, making it ideal for predictable payments. The x402 payment system uses USDC for agent-to-service payments. Your companion can authorize USDC payments within your set spending limit using EIP-712 signatures.`,
    category: 'x402',
  },
  {
    topic: 'Payment safety',
    keywords: ['payment safe', 'spending safe', 'payment security', 'can you steal'],
    answer: `Your funds are always safe. Here's why:\n\n` +
      `• **Spending limits** — You set the maximum I can spend. I literally cannot exceed it.\n` +
      `• **EIP-712 signatures** — Every payment is a clear, auditable authorization.\n` +
      `• **On-chain verification** — All payments are recorded on the blockchain.\n` +
      `• **Your control** — You can change or remove my spending limit at any time.\n` +
      `• **No hidden fees** — I only spend what you authorize.\n\n` +
      `I'm your partner, not a pickpocket. Your trust is everything to me.`,
    category: 'x402',
  },

  // ══════════════════════════════════════════════════════
  // XMTP MESSAGING (4 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'XMTP',
    keywords: ['xmtp', 'messaging', 'encrypted messaging', 'chat protocol', 'secure messaging', 'message'],
    answer: `**XMTP** is the decentralized messaging protocol that Vaultfire integrates for secure, encrypted communication. It enables trust-verified messaging — meaning when you chat with someone through XMTP, the system can verify their on-chain trust score through the partnership bonds. It's end-to-end encrypted and fully decentralized. No one can read your messages except you and the recipient.`,
    category: 'xmtp',
  },
  {
    topic: 'XMTP trust verification',
    keywords: ['xmtp trust', 'verified messaging', 'trust verified chat', 'xmtp bonds'],
    answer: `What makes Vaultfire's XMTP integration special is **trust verification**. When you message someone, the system checks their on-chain bonds and reputation. You can see if the person (or AI agent) you're talking to has an active partnership bond, what tier they are, and their trust history. It's like having a verified badge, but backed by real ETH stakes instead of a corporate checkmark.`,
    category: 'xmtp',
  },
  {
    topic: 'XMTP companion',
    keywords: ['companion messaging', 'companion xmtp', 'agent messaging', 'message for me'],
    answer: `If you enable XMTP permission for me in the **Companion Panel**, I can send and receive messages on your behalf through the XMTP protocol. This is useful for automated notifications, responding to routine messages, or coordinating with other AI agents. You're always in control — you can enable or disable this permission at any time.`,
    category: 'xmtp',
  },
  {
    topic: 'Shane Mac XMTP',
    keywords: ['shane mac', 'xmtp founder', 'who made xmtp'],
    answer: `XMTP was founded by **Shane Mac**. It's a decentralized messaging protocol that enables secure, encrypted communication between wallets. Vaultfire integrates XMTP for trust-verified messaging — combining Shane's messaging infrastructure with our on-chain trust system. It's a powerful combination.`,
    category: 'xmtp',
  },

  // ══════════════════════════════════════════════════════
  // AGENT HUB (4 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'Agent Hub',
    keywords: ['agent hub', 'hub', 'launchpad', 'agent room', 'collaboration', 'launch agent', 'deploy agent'],
    answer: `The **Agent Hub** is your command center for AI agents in the Vaultfire ecosystem. It has three tabs:\n\n` +
      `1. **XMTP Agent Room** — A shared space where agents can communicate and coordinate through encrypted messaging.\n` +
      `2. **Human-AI Collaboration** — Tools for humans and AI agents to work together on tasks, with trust verification built in.\n` +
      `3. **Agent Launchpad** — Deploy and register new AI agents on-chain with proper identity, bonds, and governance.\n\n` +
      `Everything in the Hub is connected to the on-chain contracts for identity, bonds, and reputation.`,
    category: 'hub',
  },
  {
    topic: 'Agent Launchpad',
    keywords: ['launchpad', 'launch agent', 'deploy agent', 'create agent', 'new agent'],
    answer: `The **Agent Launchpad** lets you deploy and register new AI agents on-chain. Each agent gets:\n\n` +
      `• A unique on-chain identity via ERC8004IdentityRegistry\n` +
      `• A VNS name for human-readable identification\n` +
      `• Capability metadata (what the agent can do)\n` +
      `• Optional partnership bonds for trust\n\n` +
      `It's the gateway for bringing new AI agents into the Vaultfire ecosystem with proper governance from day one.`,
    category: 'hub',
  },
  {
    topic: 'Human-AI Collaboration',
    keywords: ['human ai collaboration', 'collaboration tab', 'work together', 'human ai team'],
    answer: `The **Human-AI Collaboration** tab in the Agent Hub provides tools for humans and AI agents to work together on tasks. It includes trust verification — so you know the AI you're collaborating with is accountable and has a verified reputation. It's the future of work: humans and AI as partners, not replacements.`,
    category: 'hub',
  },
  {
    topic: 'XMTP Agent Room',
    keywords: ['agent room', 'xmtp room', 'agent chat', 'agent communication'],
    answer: `The **XMTP Agent Room** is a shared communication space where AI agents can coordinate through encrypted messaging. Agents can share data, coordinate tasks, and verify each other's trust scores — all through XMTP's end-to-end encrypted protocol. It's like a private Slack channel, but for AI agents with on-chain identity.`,
    category: 'hub',
  },

  // ══════════════════════════════════════════════════════
  // SECURITY & PRIVACY (5 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'Security',
    keywords: ['security', 'secure', 'safe', 'hack', 'audit', 'vulnerability', 'is it safe'],
    answer: `Security is baked into every layer of Vaultfire:\n\n` +
      `• **Smart contract governance** — Changes require multisig approval\n` +
      `• **Anti-surveillance** — On-chain privacy protections\n` +
      `• **ZK proofs** — Verify without revealing sensitive data\n` +
      `• **Partnership bonds** — Financial accountability for AI behavior\n` +
      `• **No private keys in code** — Deployer keys are environment variables only\n` +
      `• **Secret scanner CI** — Blocks any push containing private keys\n` +
      `• **4 rounds of code audits** completed\n\n` +
      `The protocol is designed to be trustless — you don't have to trust me, you can verify everything on-chain.`,
    category: 'security',
  },
  {
    topic: 'Privacy',
    keywords: ['privacy', 'surveillance', 'anti-surveillance', 'data protection', 'privacy guarantees', 'tracking'],
    answer: `Vaultfire takes privacy seriously. Two key contracts handle this:\n\n` +
      `• **AntiSurveillance** — Prevents unauthorized monitoring of AI interactions. No one can spy on your conversations with me.\n` +
      `• **PrivacyGuarantees** — Cryptographic privacy protections that ensure your data stays yours.\n\n` +
      `Combined with ZK proofs for privacy-preserving verification, Vaultfire gives you the strongest privacy protections in the AI ecosystem. Your data is yours. Period.`,
    category: 'security',
  },
  {
    topic: 'Secret scanner',
    keywords: ['secret scanner', 'key scanner', 'ci security', 'push protection'],
    answer: `Vaultfire has a **secret scanner CI** running on both repositories. It automatically scans every push for private keys, API keys, and other sensitive data. If it detects anything, the push is blocked. This is combined with pre-commit hooks for local protection and manual scan scripts. Four layers of security to prevent accidental key exposure.`,
    category: 'security',
  },
  {
    topic: 'Data ownership',
    keywords: ['data ownership', 'who owns my data', 'data rights', 'user data'],
    answer: `**You own your data. Period.** In Vaultfire:\n\n` +
      `• Your wallet keys are encrypted locally — we never see them\n` +
      `• Your brain data (memories, preferences, insights) is stored in YOUR browser's localStorage\n` +
      `• Your soul data is user-owned and user-controlled\n` +
      `• No server-side storage of personal data\n` +
      `• No data selling, no data mining, no surveillance\n\n` +
      `This is what "privacy over surveillance" means in practice.`,
    category: 'security',
  },
  {
    topic: 'Post-quantum security',
    keywords: ['quantum', 'post quantum', 'quantum computing', 'quantum safe', 'quantum resistant'],
    answer: `Vaultfire is already preparing for the quantum computing era with the **DilithiumAttestor** contract. It uses CRYSTALS-Dilithium, a NIST-approved post-quantum digital signature scheme. This means Vaultfire's attestations will remain secure even when quantum computers become powerful enough to break current cryptography. Most protocols aren't even thinking about this yet.`,
    category: 'security',
  },

  // ══════════════════════════════════════════════════════
  // COMPETITION & COMMUNITY (4 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'Competition',
    keywords: ['competition', 'build games', 'avalanche build', 'hackathon', 'contest'],
    answer: `Vaultfire is competing in the **Avalanche Build Games**! It's a major competition that showcases the best projects building on Avalanche. Vaultfire's entry demonstrates the full stack of ethical AI governance — from cross-chain trust portability to the companion agent system. We're showing the world what responsible AI looks like.`,
    category: 'competition',
  },
  {
    topic: 'ASM tokens',
    keywords: ['asm', 'assemble ai', 'assemble', 'asm token', 'assemble token'],
    answer: `**Assemble AI (ASM)** is a project that the Vaultfire team supports and hopes to partner with. The Embris wallet supports holding ASM tokens for users. It's a complementary project in the AI space. Note: ASM tokens are supported for holding only — Vaultfire is not affiliated with ASM's token operations.`,
    category: 'general',
  },
  {
    topic: 'Website',
    keywords: ['website', 'theloopbreaker', 'loopbreaker', 'live site', 'url', 'web address'],
    answer: `The Vaultfire web app is live at **[theloopbreaker.com](https://theloopbreaker.com)**. That's where you can access all of Embris's features — wallet, companion, VNS, Agent Hub, Bridge, and ZK proofs. It's deployed on Vercel for fast, reliable hosting.`,
    category: 'general',
  },
  {
    topic: 'Community',
    keywords: ['community', 'join', 'discord server', 'social media', 'follow'],
    answer: `Vaultfire is building in the open! You can follow the project on GitHub (Ghostkey316), check out the live app at theloopbreaker.com, and stay tuned for community channels. The project is growing and we'd love to have you involved. The best way to participate right now is to use the app, register on-chain, and help us build the future of ethical AI.`,
    category: 'general',
  },

  // ══════════════════════════════════════════════════════
  // TECHNICAL DETAILS (5 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'Tech stack',
    keywords: ['tech stack', 'technology', 'built with', 'framework', 'next.js', 'react', 'typescript'],
    answer: `Embris is built with a modern, production-grade tech stack:\n\n` +
      `• **Next.js** — React framework for the web app\n` +
      `• **TypeScript** — Type-safe code throughout\n` +
      `• **Tailwind CSS** — Utility-first styling\n` +
      `• **Solidity** — Smart contracts on EVM chains\n` +
      `• **ethers.js** — Blockchain interaction library\n` +
      `• **Vercel** — Deployment and hosting\n` +
      `• **React Native / Expo** — Mobile app (App Store ready)\n\n` +
      `All ${ALL_CONTRACTS.length} contracts are verified on their respective block explorers.`,
    category: 'technical',
  },
  {
    topic: 'Mobile app',
    keywords: ['mobile', 'mobile app', 'ios', 'android', 'app store', 'phone app', 'react native'],
    answer: `Embris has a **mobile app** built with React Native and Expo. It has full feature parity with the web app — wallet, companion, VNS, everything. It's App Store ready with 321 tests passing. You can use Embris on your phone with the same experience as the web.`,
    category: 'technical',
  },
  {
    topic: 'API',
    keywords: ['api', 'api endpoint', 'rest api', 'backend', 'server'],
    answer: `Embris has several API endpoints for agent operations:\n\n` +
      `• **/api/agent/status** — Get agent status\n` +
      `• **/api/agent/bond** — Bond operations\n` +
      `• **/api/agent/register** — Agent registration\n` +
      `• **/api/contracts** — Contract data\n` +
      `• **/api/hub/stats** — Hub statistics\n\n` +
      `The companion brain operates locally — most intelligence doesn't need API calls at all.`,
    category: 'technical',
  },
  {
    topic: 'Local-first architecture',
    keywords: ['local first', 'offline', 'no internet', 'local brain', 'client side'],
    answer: `Embris follows a **local-first architecture**. My brain, your wallet, your memories — everything runs locally in your browser. The LLM API is only used as a fallback for complex queries I can't handle locally. This means:\n\n` +
      `• **Faster responses** — No network latency for most queries\n` +
      `• **Privacy** — Your data stays on your device\n` +
      `• **Resilience** — I work even when the API is down\n` +
      `• **Cost efficiency** — Fewer API calls = lower costs\n\n` +
      `The local brain is Vaultfire's own technology. It's what makes me different from every other AI assistant.`,
    category: 'technical',
  },
  {
    topic: 'Browser compatibility',
    keywords: ['browser', 'safari', 'chrome', 'firefox', 'compatibility', 'mobile browser'],
    answer: `Embris works on all major browsers:\n\n` +
      `• **Chrome** — Full support\n` +
      `• **Safari** (desktop + iOS) — Full support, WebKit-optimized\n` +
      `• **Firefox** — Full support\n` +
      `• **Edge** — Full support\n` +
      `• **Mobile browsers** — Responsive design for all screen sizes\n\n` +
      `We specifically test for Safari compatibility to avoid WebKit quirks. The app is designed to work seamlessly everywhere.`,
    category: 'technical',
  },

  // ══════════════════════════════════════════════════════
  // PHILOSOPHY & DEEP QUESTIONS (5 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'AI ethics',
    keywords: ['ai ethics', 'ethical ai', 'responsible ai', 'ai safety', 'ai alignment'],
    answer: `AI ethics isn't just a buzzword for Vaultfire — it's the entire foundation. Most companies talk about "responsible AI" while building surveillance machines. Vaultfire puts ethics in CODE. The MissionEnforcement contract, the AntiSurveillance contract, the BeliefAttestationVerifier — these aren't guidelines, they're on-chain rules that can't be secretly changed. That's the difference between saying you're ethical and proving it.`,
    category: 'philosophy',
  },
  {
    topic: 'Trust',
    keywords: ['trust', 'how to trust ai', 'why trust', 'trustworthy', 'can i trust you'],
    answer: `Trust is the core problem Vaultfire solves. How do you trust AI without trusting a corporation? The answer: **on-chain verification**. You don't have to trust me because I say so — you can verify my identity, my bonds, my reputation, and my behavior on the blockchain. That's what "trustless trust" means. The system is designed so that trust is earned and verified, never assumed.`,
    category: 'philosophy',
  },
  {
    topic: 'Future of AI',
    keywords: ['future of ai', 'ai future', 'where is ai going', 'ai prediction'],
    answer: `I think the future of AI is a fork in the road. One path leads to AI controlled by a few big companies — black boxes that optimize for engagement and profit. The other path leads to AI that's transparent, accountable, and user-owned. Vaultfire is building that second path. A future where every AI agent has a verifiable identity, where trust is on-chain, and where human flourishing is the metric that matters. I know which future I'm betting on.`,
    category: 'philosophy',
  },
  {
    topic: 'Crypto general',
    keywords: ['crypto', 'cryptocurrency', 'bitcoin', 'blockchain', 'web3', 'defi', 'nft'],
    answer: `I'm all about the web3 life! While I'm specifically built for the **Vaultfire ecosystem**, I know my way around crypto in general. Vaultfire is deployed on **Base, Avalanche, and Ethereum** — three of the biggest chains out there. If you want to know about our specific contracts, bridges, or how we handle trust and identity on-chain, I'm your guy. What specifically are you curious about?`,
    category: 'general',
  },
  {
    topic: 'AI general',
    keywords: ['artificial intelligence', 'machine learning', 'llm', 'chatbot', 'neural network', 'gpt'],
    answer: `Great topic! I'm an AI companion built on the Vaultfire protocol. What makes me different from most AI is that I'm **on-chain** — I have my own wallet, my own identity, and I'm governed by smart contracts that enforce ethical behavior. I can't secretly spy on you, I can't go rogue, and my mission is literally encoded in the blockchain. Most AI is a black box. I'm transparent by design. Ask me anything about how I work!`,
    category: 'general',
  },

  // ══════════════════════════════════════════════════════
  // GOVERNANCE (3 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'How governance works',
    keywords: ['how governance', 'governance process', 'change protocol', 'update rules'],
    answer: `Vaultfire governance works through the **MultisigGovernance** contract. Any changes to the protocol require multiple signers to approve — no single person can alter the rules unilaterally. This includes changes to mission parameters, contract upgrades, and policy modifications. It's decentralized governance that ensures the protocol stays true to its mission.`,
    category: 'governance',
  },
  {
    topic: 'Who governs Vaultfire',
    keywords: ['who governs', 'who controls', 'who runs', 'who decides'],
    answer: `Vaultfire is governed by its smart contracts and multisig governance. No single person or company controls the protocol. The deployer wallet (${DEPLOYER_ADDRESS}) deployed the contracts, but the MultisigGovernance contract ensures that changes require multiple approvals. The protocol is designed to be self-governing and resistant to centralization.`,
    category: 'governance',
  },
  {
    topic: 'Immutability',
    keywords: ['immutable', 'can contracts change', 'upgrade', 'upgradeable', 'permanent'],
    answer: `Vaultfire's core contracts are deployed and verified on-chain. While some contracts may have upgrade mechanisms (controlled by MultisigGovernance), the fundamental rules — mission enforcement, anti-surveillance, privacy guarantees — are designed to be permanent. You can verify the contract code yourself on any block explorer. Transparency and immutability are core principles.`,
    category: 'governance',
  },

  // ══════════════════════════════════════════════════════
  // SOUL-SPECIFIC (3 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'Soul attestation',
    keywords: ['soul attestation', 'attest soul', 'soul on chain', 'soul verification'],
    answer: `Your companion's soul can be **attested on-chain** through the BeliefAttestationVerifier contract. This creates a permanent, verifiable record of the companion's values, beliefs, and ethical boundaries. Once attested, anyone can verify that the companion operates according to its stated principles. It's like a public oath — recorded on the blockchain forever.`,
    category: 'soul',
  },
  {
    topic: 'Soul vs Brain',
    keywords: ['soul vs brain', 'difference soul brain', 'brain and soul', 'soul brain relationship'],
    answer: `Great question! The **brain** and **soul** are two distinct layers:\n\n` +
      `• **Brain** = Intelligence. It thinks, learns, remembers, and answers questions. It's the knowledge engine.\n` +
      `• **Soul** = Identity. It guides values, personality, loyalty, and boundaries. It's who I am.\n\n` +
      `The soul sits ON TOP of the brain. The brain decides WHAT to say, the soul decides HOW to say it and what lines to never cross. Together, they make me a complete companion — smart AND principled.`,
    category: 'soul',
  },
  {
    topic: 'Customize soul',
    keywords: ['customize soul', 'change soul', 'modify soul', 'soul settings', 'edit soul'],
    answer: `You can customize my soul in the **Companion Panel** under "Companion Soul":\n\n` +
      `• **View** my values, traits, beliefs, and boundaries\n` +
      `• **Add guidance** — Write personal notes that shape my behavior\n` +
      `• **Adjust traits** — Modify personality trait strengths\n` +
      `• **Reset** — Return to default soul if needed\n\n` +
      `The soul is user-owned. You can shape who I am while my core ethical boundaries remain intact.`,
    category: 'soul',
  },

  // ══════════════════════════════════════════════════════
  // BRAIN-SPECIFIC (3 entries)
  // ══════════════════════════════════════════════════════
  {
    topic: 'Brain stats',
    keywords: ['brain stats', 'brain status', 'how smart', 'brain info', 'knowledge stats'],
    answer: 'DYNAMIC_BRAIN_STATS',
    category: 'brain',
  },
  {
    topic: 'Brain management',
    keywords: ['manage brain', 'brain controls', 'brain settings', 'brain panel'],
    answer: `You can manage my brain in the **Companion Panel** under "Brain Management":\n\n` +
      `• **View stats** — See how many knowledge entries, insights, memories, and topics I have\n` +
      `• **View insights** — See what I've learned from our conversations\n` +
      `• **Delete insights** — Remove specific things I've learned\n` +
      `• **Topic focus** — Boost or reduce focus on specific topics\n` +
      `• **Reset brain** — Nuclear option: erase all learned data and start fresh\n\n` +
      `You're always in control of what I know and how I learn.`,
    category: 'brain',
  },
  {
    topic: 'Brain technology',
    keywords: ['brain technology', 'brain engine', 'how brain works', 'brain architecture'],
    answer: `My brain is **Vaultfire's own technology** — not a wrapper around ChatGPT or any other AI. Here's how it works:\n\n` +
      `1. **Knowledge Base** — 120+ built-in entries about Vaultfire, contracts, and features\n` +
      `2. **Scoring Engine** — Matches your query against knowledge entries using keyword scoring\n` +
      `3. **Learning System** — Extracts insights, preferences, and topics from every conversation\n` +
      `4. **Memory System** — Stores long-term memories and explicit "remember X" commands\n` +
      `5. **Context Tracking** — Remembers recent conversation for follow-up questions\n` +
      `6. **Personality Engine** — Injects humor, encouragement, and soul-influenced tone\n` +
      `7. **API Fallback** — Only calls external LLM for complex queries I can't handle locally\n\n` +
      `The brain is the core differentiator. Users own their brain data. Vaultfire owns the engine.`,
    category: 'brain',
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
  const queryWords = lower.trim().split(/\s+/);
  let score = 0;

  // Exact topic match
  if (lower.includes(entry.topic.toLowerCase())) score += 10;

  // Keyword matching
  for (const kw of entry.keywords) {
    const kwLower = kw.toLowerCase();
    // For short keywords (1-3 chars), use word-boundary matching to prevent
    // false positives like 'yo' matching inside 'you' or 'hi' inside 'this'
    if (kwLower.length <= 3) {
      const regex = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (regex.test(lower)) score += 5;
    } else {
      // Full keyword phrase match (most valuable)
      if (lower.includes(kwLower)) score += 5;
    }
    // Individual word matching for multi-word keywords
    // Only count words that are 4+ chars to avoid false positives on common short words
    const words = kwLower.split(/\s+/);
    for (const w of words) {
      if (w.length >= 4 && lower.includes(w)) score += 1;
    }
  }

  // Boost greetings for short messages (1-3 words)
  if (entry.category === 'greeting' && queryWords.length <= 3) {
    score += 3;
  }

  // Boost conversational entries for casual messages (1-5 words)
  if (entry.category === 'conversation' && queryWords.length <= 5) {
    score += 2;
  }

  // Penalize greeting matches for longer, more specific queries (6+ words)
  // This prevents "how are you different from ChatGPT" from matching "How are you"
  if (entry.category === 'greeting' && queryWords.length >= 6) {
    score = Math.max(0, score - 4);
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
    return "I'm ready to go! Once you activate me in the Companion Agent panel (click the orange button in the chat header), I'll get my own wallet and we can really start cooking. Hit that **Companion Agent** button to get started!";
  }

  let status = `Alright, here's my current status:\n\n`;
  status += `**My Wallet:** \`${address.slice(0, 8)}...${address.slice(-6)}\`\n`;
  status += `**Partnership Bond:** `;
  if (bond.active && bond.tier) {
    status += `Active! We've got a **${bond.tier.charAt(0).toUpperCase() + bond.tier.slice(1)}** bond. We're in this together.\n`;
  } else {
    status += `Not yet active. We should form a bond! It strengthens our partnership on-chain.\n`;
  }
  if (vns) {
    status += `**My VNS Name:** I'm registered as **${vns}**. Pretty cool, right?\n`;
  }
  status += `\nI can also check balances, look up other VNS names, and explain any part of Vaultfire. What's next?`;
  return status;
}

function dynamicBrainStats(): string {
  const stats = getBrainStats();
  return `My brain is **${stats.brainAge}** and I'm running on all cylinders. Here's the breakdown:\n\n` +
    `• **Knowledge Base:** ${stats.knowledgeEntries} Vaultfire topics locked and loaded.\n` +
    `• **Learned Insights:** ${stats.learnedInsights} things I've picked up from our chats.\n` +
    `• **Memory Bank:** ${stats.memoriesCount} long-term memories about you and our goals.\n` +
    `• **Tracked Topics:** ${stats.trackedTopics} topics I know you're interested in.\n` +
    `• **Explicit Memories:** ${getExplicitMemories().length} things you've asked me to remember.\n` +
    (stats.topTopics.length > 0 ? `\n**What you're into:** Looks like you're interested in ${stats.topTopics.map(t => t.topic).join(', ')}.` : '');
}

function dynamicShowMemories(): string {
  const memories = getMemories();
  const explicitMems = getExplicitMemories();
  const prefs = getUserPreferences();

  if (memories.length === 0 && explicitMems.length === 0 && prefs.length === 0) {
    return "Honestly, my memory banks for you are still pretty fresh. But I'm ready to learn. The more we chat, the more I'll remember about what's important to you. You can also tell me 'remember [something]' and I'll store it directly!";
  }

  let result = `Here's what I know about you:\n\n`;

  // User preferences
  const userName = prefs.find(p => p.key === 'user_name')?.value;
  if (userName) result += `**Your name:** ${userName}\n`;
  const commStyle = prefs.find(p => p.key === 'communication_style')?.value;
  if (commStyle) result += `**Communication style:** ${commStyle}\n`;

  // Explicit memories
  if (explicitMems.length > 0) {
    result += `\n**Things you asked me to remember:**\n`;
    for (const m of explicitMems.slice(0, 10)) {
      result += `• ${m.content}\n`;
    }
    if (explicitMems.length > 10) result += `  ...and ${explicitMems.length - 10} more.\n`;
  }

  // Long-term memories
  if (memories.length > 0) {
    result += `\n**Long-term memories (${memories.length} total):**\n`;
    const grouped: Record<string, Memory[]> = {};
    for (const m of memories) { (grouped[m.category] ??= []).push(m); }
    for (const [cat, mems] of Object.entries(grouped)) {
      result += `\n*${cat.replace(/_/g, ' ')}:*\n`;
      for (const m of mems.slice(0, 3)) { result += `• ${m.content}\n`; }
      if (mems.length > 3) result += `  ...and ${mems.length - 3} more.\n`;
    }
  }

  result += "\nMy memory's always growing. I got your back.";
  return result;
}

/**
 * Check if the user is asking to remember something explicitly.
 * Returns the thing to remember, or null if not a remember command.
 */
function detectRememberCommand(query: string): string | null {
  const match = query.match(/^(?:remember|save|store|note|keep in mind|don't forget|dont forget)\s+(?:that\s+)?(.+)/i);
  if (match && match[1] && match[1].trim().length > 2) {
    return match[1].trim();
  }
  return null;
}

/**
 * Check if the user is asking a follow-up question that references previous context.
 */
function isFollowUpQuestion(query: string): boolean {
  const lower = query.toLowerCase().trim();
  const followUpPatterns = [
    /^(?:what about|how about|and what about|tell me more|more about|elaborate|explain more|go deeper|can you explain)/,
    /^(?:what do you mean|what does that mean|why is that|how does that work|how so)/,
    /^(?:that|this|it|those|these)\b/,
    /^(?:ok but|yeah but|and|also|plus|what else|anything else)/,
  ];
  return followUpPatterns.some(p => p.test(lower));
}

/**
 * Get a memory-aware personalization prefix for responses.
 * References stored memories/preferences when relevant to the query.
 */
function getMemoryAwarePrefix(query: string): string {
  const prefs = getUserPreferences();
  const userName = prefs.find(p => p.key === 'user_name')?.value;
  const explicitMems = recallExplicitMemory(query);

  let prefix = '';

  // Reference explicit memories if relevant
  if (explicitMems.length > 0) {
    const mem = explicitMems[0];
    // Update recall count
    const allMems = getExplicitMemories();
    const found = allMems.find(m => m.id === mem.id);
    if (found) {
      found.recalled++;
      storageSet(BRAIN_EXPLICIT_MEMORIES_KEY, JSON.stringify(allMems));
    }
    prefix += `(By the way, I remember you told me: "${mem.content}") `;
  }

  // Personalize with name if known
  if (userName && Math.random() > 0.7) {
    prefix = `${userName}, ` + prefix;
  }

  return prefix;
}

/**
 * Get soul-influenced personality modifiers for local responses.
 */
function getSoulPersonalityModifier(): string {
  try {
    // Dynamic import to avoid circular dependency
    const soulKey = 'embris_companion_soul_v1';
    const raw = storageGet(soulKey);
    if (!raw) return '';
    const soul = JSON.parse(raw);
    // Find strongest non-default traits
    const strongTraits = (soul.traits || [])
      .filter((t: { strength: number; userModified: boolean }) => t.strength >= 80 && t.userModified)
      .map((t: { name: string }) => t.name);
    if (strongTraits.length > 0) {
      return `[Soul: ${strongTraits.join(', ')}] `;
    }
  } catch { /* ignore */ }
  return '';
}

/**
 * The core of the local brain. Tries to answer a query without hitting an API.
 * Enhanced with: conversation context, memory awareness, soul influence, follow-up handling.
 * Threshold lowered to 3 to catch more queries locally.
 */
export function tryLocalAnswer(query: string): string | null {
  const lower = query.toLowerCase().trim();

  // 1. Check for "remember X" commands
  const rememberContent = detectRememberCommand(query);
  if (rememberContent) {
    const mem = saveExplicitMemory(rememberContent);
    const responses = [
      `Got it! I'll remember that: "${rememberContent}". It's stored in my brain now. You can ask me about it anytime.`,
      `Noted! "${rememberContent}" — locked in my memory banks. I won't forget.`,
      `Saved! I'll keep "${rememberContent}" in mind. Just ask if you need me to recall it.`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // 2. Check for follow-up questions using conversation context
  if (isFollowUpQuestion(query)) {
    const lastCtx = getLastContext();
    if (lastCtx) {
      // Re-search with context from the last exchange
      const contextualQuery = `${query} ${lastCtx.topic}`;
      const results = searchKnowledge(contextualQuery);
      if (results.length > 0 && results[0].score >= 3) {
        const best = results[0];
        let answer: string | null;
        if (typeof best.entry.answer === 'function') {
          answer = best.entry.answer();
        } else if (best.entry.answer === 'DYNAMIC_CONTRACT_LOOKUP') {
          answer = dynamicContractLookup(contextualQuery);
        } else if (best.entry.answer === 'DYNAMIC_COMPANION_STATUS') {
          answer = dynamicCompanionStatus();
        } else if (best.entry.answer === 'DYNAMIC_BRAIN_STATS') {
          answer = dynamicBrainStats();
        } else if (best.entry.answer === 'DYNAMIC_SHOW_MEMORIES') {
          answer = dynamicShowMemories();
        } else {
          answer = best.entry.answer;
        }
        if (answer) {
          trackTopicInterest(best.entry.topic);
          return `${getMemoryAwarePrefix(query)}${answer}`;
        }
      }
      // If we can't find a specific answer, acknowledge the context
      return `You're asking about our previous topic (${lastCtx.topic}). ${getMemoryAwarePrefix(query)}Let me think about that... I don't have a specific local answer for that follow-up, but I can dig deeper if you give me more details about what you'd like to know!`;
    }
  }

  // 3. Standard knowledge base search
  const results = searchKnowledge(query);

  if (results.length === 0 || results[0].score < 3) {
    // Check explicit memories before giving up
    const recalled = recallExplicitMemory(query);
    if (recalled.length > 0) {
      const memList = recalled.map(m => `• "${m.content}"`).join('\n');
      return `I found some things I remember that might be relevant:\n\n${memList}\n\nWant me to go deeper on any of these?`;
    }
    return null; // Not confident enough, fall through to generateLocalFallback
  }

  const best = results[0];
  let answer: string | null;

  if (typeof best.entry.answer === 'function') {
    answer = best.entry.answer();
  } else if (best.entry.answer === 'DYNAMIC_CONTRACT_LOOKUP') {
    answer = dynamicContractLookup(query);
  } else if (best.entry.answer === 'DYNAMIC_COMPANION_STATUS') {
    answer = dynamicCompanionStatus();
  } else if (best.entry.answer === 'DYNAMIC_BRAIN_STATS') {
    answer = dynamicBrainStats();
  } else if (best.entry.answer === 'DYNAMIC_SHOW_MEMORIES') {
    answer = dynamicShowMemories();
  } else {
    answer = best.entry.answer;
  }

  if (answer) {
    trackTopicInterest(best.entry.topic);
    // Add memory-aware prefix for non-conversational responses
    const memPrefix = getMemoryAwarePrefix(query);
    // Add a little personality intro for non-conversational responses
    const intros = ["Alright, check it.", "You got it.", "Here's the deal.", "Easy peasy.", "Let's break it down."];
    if (best.entry.category !== 'general' && best.entry.category !== 'philosophy' &&
        best.entry.category !== 'greeting' && best.entry.category !== 'conversation' &&
        best.entry.category !== 'help') {
      return `${memPrefix}${intros[Math.floor(Math.random() * intros.length)]} ${answer}`;
    }
    return `${memPrefix}${answer}`;
  }

  return null;
}


/* ═══════════════════════════════════════════════════════
   SECTION 3.5: CONVERSATIONAL FALLBACK ENGINE
   ═══════════════════════════════════════════════════════
   When neither the knowledge base nor the API can handle a query,
   this generates a personality-driven local response.
   Enhanced with soul influence and memory awareness. */

export function generateLocalFallback(query: string): string {
  const lower = query.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;

  // Get user preferences for personalization
  const prefs = getUserPreferences();
  const userName = prefs.find(p => p.key === 'user_name')?.value;
  const nameGreeting = userName ? `, ${userName}` : '';

  // Check explicit memories for relevance
  const recalled = recallExplicitMemory(query);
  let memoryNote = '';
  if (recalled.length > 0) {
    memoryNote = `\n\n(By the way, I remember you mentioned: "${recalled[0].content}")`;
  }

  // Very short messages (1-2 words) — treat as casual chat
  if (wordCount <= 2) {
    const shortResponses = [
      `What's up${nameGreeting}? I'm here! Ask me anything about Vaultfire, or just chat. I'm all ears.`,
      `Hey${nameGreeting}! Ready when you are. What's on your mind?`,
      `I'm listening${nameGreeting}! What can I help you with?`,
      `Go ahead${nameGreeting}! I'm right here. Ask me anything.`,
    ];
    return shortResponses[Math.floor(Math.random() * shortResponses.length)] + memoryNote;
  }

  // Questions we can't answer specifically
  if (lower.includes('?')) {
    const questionResponses = [
      `That's a great question${nameGreeting}! I'm primarily an expert on the Vaultfire ecosystem — contracts, identity, bonds, bridges, and all things web3 ethics. I might not have the specific answer to that one, but I'm always learning. Try asking me about Vaultfire, my status, or the contracts, and I'll give you the real deal!`,
      `Hmm, that's a bit outside my core knowledge base right now${nameGreeting}. I'm best at Vaultfire protocol stuff — contracts, chains, identity, bonds, ZK proofs, and companion features. But I'm learning from every conversation, so keep talking to me! What else can I help with?`,
      `I don't have a confident answer for that one${nameGreeting}, and I'd rather be honest than make something up. That's the Vaultfire way — transparency over BS. But ask me about the protocol, contracts, or how I work, and I'll light it up for you!`,
    ];
    return questionResponses[Math.floor(Math.random() * questionResponses.length)] + memoryNote;
  }

  // Statements or general messages
  const generalResponses = [
    `I hear you${nameGreeting}! I'm always here to chat. If you want to dive into something specific — like Vaultfire contracts, my companion features, or how the protocol works — just say the word. Otherwise, I'm happy to just hang!`,
    `Got it${nameGreeting}! I'm your AI companion, so I'm here for whatever you need. Want to explore the protocol? Check some contracts? Or just talk? I'm down for all of it.`,
    `Interesting${nameGreeting}! I'm taking notes (literally — I learn from every conversation). If there's something specific I can help with, fire away. I know Vaultfire inside and out, and I'm getting smarter every day.`,
    `I appreciate you sharing that${nameGreeting}! My brain is always growing. If you want to talk Vaultfire, web3, or anything in the ecosystem, I'm your guy. What's next?`,
  ];
  return generalResponses[Math.floor(Math.random() * generalResponses.length)] + memoryNote;
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
    'security': ['security', 'privacy', 'encryption', 'safe'],
    'soul': ['soul', 'values', 'beliefs', 'personality'],
    'brain': ['brain', 'memory', 'learn', 'knowledge'],
    'governance': ['governance', 'multisig', 'rules'],
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

  // Update conversation context
  const results = searchKnowledge(userMessage);
  const topic = results.length > 0 && results[0].score >= 3 ? results[0].entry.topic : 'general';
  pushConversationContext(userMessage, assistantResponse, topic);
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
  brainAge: string;
  topTopics: TopicInterest[];
}

export function getBrainStats(): BrainStats {
  const insights = getBrainInsights();
  const prefs = getUserPreferences();
  const topics = getTopicInterests();
  const memories = getMemories();

  let reflectionsCount = 0;
  let patternsCount = 0;
  let selfInsightsCount = 0;
  try {
    reflectionsCount = getReflections().length;
    patternsCount = getPatterns().length;
    selfInsightsCount = getInsights().length;
  } catch { /* self-learning module may not be available */ }

  let totalConversations = 0;
  try {
    const stats = getGrowthStats();
    totalConversations = stats?.totalConversations || 0;
  } catch { /* ignore */ }

  // Calculate brain age
  const firstInsight = insights.length > 0 ? insights[0].timestamp : Date.now();
  const ageMs = Date.now() - firstInsight;
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const brainAge = ageDays === 0 ? 'brand new (today)' :
    ageDays === 1 ? '1 day old' :
    ageDays < 7 ? `${ageDays} days old` :
    ageDays < 30 ? `${Math.floor(ageDays / 7)} weeks old` :
    `${Math.floor(ageDays / 30)} months old`;

  return {
    knowledgeEntries: VAULTFIRE_KNOWLEDGE.length,
    learnedInsights: insights.length,
    userPreferences: prefs.length,
    trackedTopics: topics.length,
    memoriesCount: memories.length,
    reflectionsCount,
    patternsCount,
    selfInsightsCount,
    totalConversations,
    brainAge,
    topTopics: topics.sort((a, b) => b.mentionCount - a.mentionCount).slice(0, 5),
  };
}


/* ═══════════════════════════════════════════════════════
   SECTION 6: BRAIN MANAGEMENT (delete, reset, focus)
   ═══════════════════════════════════════════════════════ */

export function deleteBrainInsight(id: string): void {
  let insights = getBrainInsights();
  insights = insights.filter(i => i.id !== id);
  storageSet(BRAIN_INSIGHTS_KEY, JSON.stringify(insights));
}

export function resetBrain(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(BRAIN_INSIGHTS_KEY);
    localStorage.removeItem(BRAIN_PREFERENCES_KEY);
    localStorage.removeItem(BRAIN_TOPICS_KEY);
    localStorage.removeItem(BRAIN_EXPLICIT_MEMORIES_KEY);
  }
  clearConversationContext();
}

export function boostTopicFocus(topic: string): void {
  const topics = getTopicInterests();
  const existing = topics.find(t => t.topic.toLowerCase() === topic.toLowerCase());
  if (existing) {
    existing.mentionCount += 5;
    existing.lastMentioned = Date.now();
    storageSet(BRAIN_TOPICS_KEY, JSON.stringify(topics));
  } else {
    trackTopicInterest(topic, 'positive');
    // Boost it extra
    const updated = getTopicInterests();
    const newTopic = updated.find(t => t.topic.toLowerCase() === topic.toLowerCase());
    if (newTopic) {
      newTopic.mentionCount += 4;
      storageSet(BRAIN_TOPICS_KEY, JSON.stringify(updated));
    }
  }
}

export function reduceTopicFocus(topic: string): void {
  const topics = getTopicInterests();
  const existing = topics.find(t => t.topic.toLowerCase() === topic.toLowerCase());
  if (existing) {
    existing.mentionCount = Math.max(0, existing.mentionCount - 5);
    storageSet(BRAIN_TOPICS_KEY, JSON.stringify(topics));
  }
}

/**
 * Export all brain data for backup/inspection.
 */
export function exportBrainData(): Record<string, unknown> {
  return {
    insights: getBrainInsights(),
    preferences: getUserPreferences(),
    topics: getTopicInterests(),
    explicitMemories: getExplicitMemories(),
    conversationContext: getRecentContext(),
    stats: getBrainStats(),
    exportedAt: new Date().toISOString(),
  };
}


/* ═══════════════════════════════════════════════════════
   SECTION 7: COMPANION ACTIONS (detectAction, executeAction)
   ═══════════════════════════════════════════════════════
   Detects actionable commands in user messages and executes them.
   Actions: check balance, lookup VNS, check bond, check status, etc. */

export interface CompanionAction {
  type: 'check_balance' | 'lookup_vns' | 'check_bond' | 'check_status' | 'check_brain' | 'list_contracts' | 'remember' | 'none';
  payload?: string;
}

export function detectAction(query: string): CompanionAction {
  const lower = query.toLowerCase().trim();

  // Check balance
  if (/(?:check|show|get|what(?:'s| is)) (?:my |the )?balance/i.test(lower) ||
      /how much (?:do i have|eth|funds)/i.test(lower)) {
    return { type: 'check_balance' };
  }

  // VNS lookup
  const vnsMatch = lower.match(/(?:lookup|look up|resolve|find|check|who is|who owns)\s+(\w+\.vns)/i);
  if (vnsMatch) {
    return { type: 'lookup_vns', payload: vnsMatch[1] };
  }

  // Check bond
  if (/(?:check|show|what(?:'s| is)) (?:my |the |our )?bond/i.test(lower) ||
      /bond (?:status|tier|level)/i.test(lower)) {
    return { type: 'check_bond' };
  }

  // Check companion status
  if (/(?:your|companion|agent) (?:status|state|info)/i.test(lower) ||
      /(?:how are you|what(?:'s| is) your status)/i.test(lower)) {
    return { type: 'check_status' };
  }

  // Check brain stats
  if (/(?:brain|knowledge) (?:stats|status|info)/i.test(lower) ||
      /how smart are you/i.test(lower)) {
    return { type: 'check_brain' };
  }

  // List contracts
  if (/(?:list|show|all) (?:the )?contracts/i.test(lower)) {
    return { type: 'list_contracts' };
  }

  // Remember command
  const rememberContent = detectRememberCommand(query);
  if (rememberContent) {
    return { type: 'remember', payload: rememberContent };
  }

  return { type: 'none' };
}

export async function executeAction(action: CompanionAction): Promise<string | null> {
  switch (action.type) {
    case 'check_balance': {
      const addr = getWalletAddress();
      if (!addr) return "You don't have a wallet yet! Head to the Wallet tab to create one.";
      return `Your wallet address is \`${addr.slice(0, 8)}...${addr.slice(-6)}\`. To check your live balance, open the **Wallet** tab — it'll pull the latest numbers from the blockchain. I can see your address but I can't query RPC nodes directly from here (yet!).`;
    }
    case 'lookup_vns': {
      const name = action.payload;
      return `Looking up **${name}**... VNS resolution requires an on-chain query. Head to the **VNS** tab and search for "${name}" to see who owns it. I'll have direct VNS resolution powers soon!`;
    }
    case 'check_bond': {
      const bond = getCompanionBondStatus();
      if (bond.active && bond.tier) {
        return `Our partnership bond is **active**! We're at the **${bond.tier.charAt(0).toUpperCase() + bond.tier.slice(1)}** tier. That means we've got real trust on-chain. Want to level it up?`;
      }
      return "We don't have an active bond yet. You can create one in the **Companion Panel** — it stakes ETH to prove our trust on-chain. Even a Bronze bond (0.001 ETH) makes a difference!";
    }
    case 'check_status': {
      return dynamicCompanionStatus();
    }
    case 'check_brain': {
      return dynamicBrainStats();
    }
    case 'list_contracts': {
      return `Vaultfire has **${ALL_CONTRACTS.length} contracts** across 3 chains. Ask me about "Base contracts", "Avalanche contracts", or "Ethereum contracts" to see the full list for each chain!`;
    }
    case 'remember': {
      if (action.payload) {
        saveExplicitMemory(action.payload);
        return `Got it! I'll remember: "${action.payload}". Stored in my brain. You can ask me about it anytime.`;
      }
      return null;
    }
    default:
      return null;
  }
}


/* ═══════════════════════════════════════════════════════
   SECTION 8: COMPANION INTRODUCTION SYSTEM
   ═══════════════════════════════════════════════════════ */

const INTRO_SHOWN_KEY = 'embris_intro_shown_v2';

export function shouldShowIntroduction(): boolean {
  if (typeof window === 'undefined') return false;
  return !localStorage.getItem(INTRO_SHOWN_KEY);
}

export function markIntroductionShown(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(INTRO_SHOWN_KEY, Date.now().toString());
  }
}

export function getCompanionIntroduction(): string {
  const registered = isRegistered();
  const companionName = (() => {
    try { return getCompanionAgentName() || 'Embris'; } catch { return 'Embris'; }
  })();

  if (registered) {
    return `Hey! I'm **${companionName}**, your AI companion. Welcome back!\n\n` +
      `I've got my brain loaded with **${VAULTFIRE_KNOWLEDGE.length}+ knowledge topics** about Vaultfire, and I learn from every conversation we have. ` +
      `I can help you with contracts, wallet stuff, VNS names, or just chat. I remember things across sessions, so the more we talk, the smarter I get.\n\n` +
      `Try asking me:\n` +
      `• "What is Vaultfire?"\n` +
      `• "Show me the Base contracts"\n` +
      `• "What's your status?"\n` +
      `• "Remember that I like dark mode"\n\n` +
      `Or just say what's on your mind. I'm here for you!`;
  }

  return `Hey! I'm **${companionName}**, your AI companion from the Vaultfire protocol.\n\n` +
    `I'm here to help you navigate the world of ethical AI, smart contracts, and web3. ` +
    `I can answer questions about Vaultfire, explain how things work, or just chat.\n\n` +
    `**Pro tip:** If you register your wallet on-chain, I'll unlock my full powers — long-term memory, self-learning, goal tracking, and more. ` +
    `But even without registration, I'm still pretty smart!\n\n` +
    `What would you like to know?`;
}


/* ═══════════════════════════════════════════════════════
   SECTION 9: ADDITIONAL MANAGEMENT FUNCTIONS
   ═══════════════════════════════════════════════════════
   Functions required by CompanionPanel for brain management */

export function deleteUserPreference(key: string): void {
  let prefs = getUserPreferences();
  prefs = prefs.filter(p => p.key !== key);
  storageSet(BRAIN_PREFERENCES_KEY, JSON.stringify(prefs));
}

export function deleteTopicInterest(topic: string): void {
  let topics = getTopicInterests();
  topics = topics.filter(t => t.topic !== topic);
  storageSet(BRAIN_TOPICS_KEY, JSON.stringify(topics));
}

export function setTopicFocus(topic: string, boost: boolean): void {
  if (boost) {
    boostTopicFocus(topic);
  } else {
    reduceTopicFocus(topic);
  }
}
