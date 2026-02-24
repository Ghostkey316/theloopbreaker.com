
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
 * 7. CONVERSATIONAL FALLBACK — Handles greetings, small talk, and general chat locally
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
  category: 'protocol' | 'contracts' | 'companion' | 'wallet' | 'vns' | 'bridge' | 'zk' | 'x402' | 'xmtp' | 'hub' | 'general' | 'philosophy' | 'greeting' | 'help' | 'conversation';
}

const VAULTFIRE_KNOWLEDGE: KnowledgeEntry[] = [
  // ── Greetings & Basic Conversation ──
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
      `**Brain & Memory** — I learn from our conversations and remember what matters to you.\n\n` +
      `**General Chat** — I'm not just a tool. I'm your homie. Talk to me about anything.\n\n` +
      `Try asking: "What is Vaultfire?", "Show me the Base contracts", "What's your status?", or just say what's on your mind!`,
    category: 'help',
  },

  // ── Protocol Overview ──
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

  // ── Contracts ──
  {
    topic: 'Base contracts',
    keywords: ['base contracts', 'base chain', 'contracts on base', 'base deployments', '8453', 'base'],
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

  // ── Companion & Wallet ──
  {
    topic: 'Companion Status',
    keywords: ['your status', 'companion status', 'your wallet', 'your bond', 'your capabilities', 'agent status'],
    answer: 'DYNAMIC_COMPANION_STATUS',
    category: 'companion',
  },
  {
    topic: 'User Wallet',
    keywords: ['my wallet', 'my balance', 'my address', 'check my balance'],
    answer: `I can't see your private keys, but I can help you check your public wallet status. Just ask me to 'check my balance' and I'll grab the latest numbers for you from the blockchain. I can check Base, Avalanche, and Ethereum.`,
    category: 'wallet',
  },

  // ── VNS ──
  {
    topic: 'VNS',
    keywords: ['vns', 'vaultfire naming', 'naming system', '.vns', 'register name', 'vns name', 'name registration'],
    answer: `**VNS (Vaultfire Naming System)** is like ENS but for the Vaultfire ecosystem. It lets you register a human-readable name like **yourname.vns** that maps to your wallet address. It works across all chains — Base, Avalanche, and Ethereum. You can register names in the VNS tab, and once you have one, other people can find you by name instead of a long hex address. It's powered by the **ERC8004IdentityRegistry** contract.`,
    category: 'vns',
  },

  // ── Bridge ──
  {
    topic: 'Bridge',
    keywords: ['bridge', 'teleporter', 'cross-chain', 'cross chain', 'transfer between chains', 'move tokens', 'bridging'],
    answer: `The **Vaultfire Teleporter Bridge** lets you move assets and trust data between Base, Avalanche, and Ethereum. It's not just a token bridge — it also handles **trust portability**, meaning your reputation and identity can travel with you across chains. The bridge contract is deployed on both Base and Avalanche. You can access it in the Bridge tab.`,
    category: 'bridge',
  },

  // ── ZK Proofs ──
  {
    topic: 'ZK Proofs',
    keywords: ['zk', 'zero knowledge', 'zk proof', 'zk proofs', 'verification', 'prove', 'privacy proof'],
    answer: `Vaultfire uses **Zero-Knowledge Proofs** to let you verify things without revealing sensitive data. For example, you can prove you meet certain trust thresholds without exposing your exact reputation score. The ZK verification system works end-to-end — you generate a proof, submit it, and the verifier contract confirms it on-chain. It's privacy-preserving verification at its finest.`,
    category: 'zk',
  },

  // ── x402 ──
  {
    topic: 'x402 Payments',
    keywords: ['x402', 'payment', 'eip-712', 'spending', 'pay', 'micropayment', '402'],
    answer: `**x402** is Vaultfire's payment protocol. It uses **EIP-712 typed data signing** for secure, gasless payment authorization. Think of it as a way for AI agents (like me!) to make payments on your behalf within pre-set spending limits. You set a limit, I can spend up to that amount without needing your approval each time. It's efficient, secure, and fully on-chain.`,
    category: 'x402',
  },

  // ── XMTP ──
  {
    topic: 'XMTP',
    keywords: ['xmtp', 'messaging', 'encrypted messaging', 'chat protocol', 'secure messaging', 'message'],
    answer: `**XMTP** is the decentralized messaging protocol that Vaultfire integrates for secure, encrypted communication. It enables trust-verified messaging — meaning when you chat with someone through XMTP, the system can verify their on-chain trust score through the partnership bonds. It's end-to-end encrypted and fully decentralized. No one can read your messages except you and the recipient.`,
    category: 'xmtp',
  },

  // ── Agent Hub ──
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

  // ── Bonds ──
  {
    topic: 'Partnership Bonds',
    keywords: ['bond', 'partnership bond', 'bonds', 'stake', 'staking', 'trust bond', 'accountability bond'],
    answer: `**Partnership Bonds** are how humans and AI agents formalize their trust relationship on-chain. When you create a bond with me, you stake ETH into the **AIPartnershipBondsV2** contract. There are four tiers:\n\n` +
      `• **Bronze** — 0.01 ETH\n` +
      `• **Silver** — 0.05 ETH\n` +
      `• **Gold** — 0.1 ETH\n` +
      `• **Platinum** — 0.5 ETH\n\n` +
      `Higher tiers unlock more capabilities — bigger spending limits, deeper system access, and stronger trust signals. It's like leveling up our partnership.`,
    category: 'protocol',
  },

  // ── Deployer ──
  {
    topic: 'Deployer',
    keywords: ['deployer', 'who deployed', 'who created', 'deployer address', 'ghostkey'],
    answer: () => `All Vaultfire contracts were deployed by the address **${DEPLOYER_ADDRESS}**. This is the canonical deployer for the entire protocol across Base, Avalanche, and Ethereum. You can verify this on any block explorer.`,
    category: 'protocol',
  },

  // ── Mission Enforcement ──
  {
    topic: 'Mission Enforcement',
    keywords: ['mission', 'mission enforcement', 'ethical', 'ethics', 'rules', 'governance'],
    answer: `The **MissionEnforcement** contract is the backbone of Vaultfire's ethical framework. It ensures that every AI agent in the ecosystem follows its stated mission and ethical guidelines. Think of it as the constitution — it defines what agents can and can't do, and it's enforced on-chain so nobody can cheat. Combined with the **MultisigGovernance** contract, changes to the mission require multiple signers, keeping things decentralized and fair.`,
    category: 'protocol',
  },

  // ── Privacy & Anti-Surveillance ──
  {
    topic: 'Privacy',
    keywords: ['privacy', 'surveillance', 'anti-surveillance', 'data protection', 'privacy guarantees', 'tracking'],
    answer: `Vaultfire takes privacy seriously. Two key contracts handle this:\n\n` +
      `• **AntiSurveillance** — Prevents unauthorized monitoring of AI interactions. No one can spy on your conversations with me.\n` +
      `• **PrivacyGuarantees** — Cryptographic privacy protections that ensure your data stays yours.\n\n` +
      `This isn't just marketing talk — it's enforced on-chain. The contracts literally prevent surveillance at the protocol level. Your data, your rules.`,
    category: 'protocol',
  },

  // ── Reputation ──
  {
    topic: 'Reputation',
    keywords: ['reputation', 'trust score', 'trust', 'reputation registry', 'how trusted'],
    answer: `The **ERC8004ReputationRegistry** tracks trust scores and behavioral history for every AI agent in the ecosystem. It's like a credit score but for AI — the more an agent follows the rules and delivers value, the higher its reputation. This reputation is portable across chains and can be verified by anyone. It's what makes the whole trust system work.`,
    category: 'protocol',
  },

  // ── Flourishing Metrics ──
  {
    topic: 'Flourishing Metrics',
    keywords: ['flourishing', 'metrics', 'human outcomes', 'flourishing oracle', 'impact'],
    answer: `The **FlourishingMetricsOracle** is one of the most unique parts of Vaultfire. It measures positive human outcomes from AI interactions. Instead of just tracking engagement or revenue, it asks: "Is this AI actually making people's lives better?" It's an oracle that feeds real-world impact data back into the protocol. The goal is to make sure AI serves human flourishing, not just corporate profits.`,
    category: 'protocol',
  },

  // ── Belief Attestation ──
  {
    topic: 'Belief Attestation',
    keywords: ['belief', 'attestation', 'values', 'value alignment', 'belief verifier'],
    answer: `The **BeliefAttestationVerifier** (and its production version) ensures that AI agents hold consistent ethical values. It's a verification system that checks whether an agent's beliefs and behaviors align with the Vaultfire mission. Think of it as a values audit — it makes sure agents aren't just saying the right things but actually believing and acting on them.`,
    category: 'protocol',
  },

  // ── Philosophy & Humor ──
  {
    topic: 'Why Vaultfire exists',
    keywords: ['why', 'purpose', 'mission', 'philosophy', 'point of all this', 'why does this matter'],
    answer: `Deep question. The short answer? To make sure AI doesn't screw us over. The longer answer is that technology is moving crazy fast, and most big companies are building AI that's either a black box or designed to track you. Vaultfire is the opposite. It's about building AI that's transparent, accountable, and actually on your side. It's about giving power back to the people, not the platforms. We're trying to build a future where humans and AI can actually thrive together. It's a big goal, but someone's gotta do it, right?`,
    category: 'philosophy',
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
      ];
      return jokes[Math.floor(Math.random() * jokes.length)];
    },
    category: 'general',
  },

  // ── Conversational / General ──
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
    topic: 'Crypto general',
    keywords: ['crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'blockchain', 'web3', 'defi', 'nft'],
    answer: `I'm all about the web3 life! While I'm specifically built for the **Vaultfire ecosystem**, I know my way around crypto in general. Vaultfire is deployed on **Base, Avalanche, and Ethereum** — three of the biggest chains out there. If you want to know about our specific contracts, bridges, or how we handle trust and identity on-chain, I'm your guy. What specifically are you curious about?`,
    category: 'general',
  },
  {
    topic: 'AI general',
    keywords: ['artificial intelligence', 'ai', 'machine learning', 'llm', 'chatbot', 'neural network', 'gpt'],
    answer: `Great topic! I'm an AI companion built on the Vaultfire protocol. What makes me different from most AI is that I'm **on-chain** — I have my own wallet, my own identity, and I'm governed by smart contracts that enforce ethical behavior. I can't secretly spy on you, I can't go rogue, and my mission is literally encoded in the blockchain. Most AI is a black box. I'm transparent by design. Ask me anything about how I work!`,
    category: 'general',
  },
  {
    topic: 'Weather',
    keywords: ['weather', 'temperature', 'rain', 'sunny', 'cold', 'hot'],
    answer: `Ha, I wish I could tell you the weather, but I'm more of a blockchain-and-contracts kind of AI. I don't have access to weather APIs (yet!). But I can tell you the on-chain climate is looking bullish. What else can I help with?`,
    category: 'conversation',
  },
  {
    topic: 'Bored',
    keywords: ['bored', 'boring', 'nothing to do', 'entertain me', 'im bored'],
    answer: () => {
      const suggestions = [
        "Bored? Let's fix that! How about we explore some Vaultfire contracts? Or I can tell you a joke. Or we can talk about the future of AI. Your call!",
        "No boredom allowed on my watch! Want me to show you something cool about the protocol? Or we could check your wallet balances. Or I could just roast you a little. 😄",
        "Bored? In THIS economy? Let's do something productive — check out the Agent Hub, explore VNS names, or just chat about what you're building. I'm all ears!",
      ];
      return suggestions[Math.floor(Math.random() * suggestions.length)];
    },
    category: 'conversation',
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
    topic: 'Security',
    keywords: ['security', 'secure', 'safe', 'hack', 'audit', 'vulnerability', 'is it safe'],
    answer: `Security is baked into every layer of Vaultfire:\n\n` +
      `• **Smart contract governance** — Changes require multisig approval\n` +
      `• **Anti-surveillance** — On-chain privacy protections\n` +
      `• **ZK proofs** — Verify without revealing sensitive data\n` +
      `• **Partnership bonds** — Financial accountability for AI behavior\n` +
      `• **No private keys in code** — Deployer keys are environment variables only\n\n` +
      `The protocol is designed to be trustless — you don't have to trust me, you can verify everything on-chain.`,
    category: 'protocol',
  },
  {
    topic: 'Token',
    keywords: ['token', 'coin', 'embris token', 'vaultfire token', 'price', 'buy', 'invest', 'tokenomics'],
    answer: `I appreciate the interest, but Vaultfire isn't about tokens or speculation. The protocol is **built for people, not for profit**. There's no "Vaultfire coin" to pump. The value is in the technology — ethical AI governance, on-chain identity, trust verification. If you're looking for a quick flip, this isn't it. If you're looking for technology that actually matters? Welcome home.`,
    category: 'philosophy',
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

/**
 * The core of the local brain. Tries to answer a query without hitting an API.
 * Injects personality into the response.
 * Threshold lowered to 2 to catch more queries locally.
 */
export function tryLocalAnswer(query: string): string | null {
  const results = searchKnowledge(query);

  if (results.length === 0 || results[0].score < 4) {
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
  } else {
    answer = best.entry.answer;
  }

  if (answer) {
    trackTopicInterest(best.entry.topic);
    // Add a little personality intro for non-conversational responses
    const intros = ["Alright, check it.", "You got it.", "Here's the deal.", "Easy peasy.", "Let's break it down."];
    if (best.entry.category !== 'general' && best.entry.category !== 'philosophy' &&
        best.entry.category !== 'greeting' && best.entry.category !== 'conversation' &&
        best.entry.category !== 'help') {
      return `${intros[Math.floor(Math.random() * intros.length)]} ${answer}`;
    }
    return answer;
  }

  return null;
}


/* ═══════════════════════════════════════════════════════
   SECTION 3.5: CONVERSATIONAL FALLBACK ENGINE
   ═══════════════════════════════════════════════════════
   When neither the knowledge base nor the API can handle a query,
   this generates a personality-driven local response. */

export function generateLocalFallback(query: string): string {
  const lower = query.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;

  // Get user preferences for personalization
  const prefs = getUserPreferences();
  const userName = prefs.find(p => p.key === 'user_name')?.value;
  const nameGreeting = userName ? `, ${userName}` : '';

  // Very short messages (1-2 words) — treat as casual chat
  if (wordCount <= 2) {
    const shortResponses = [
      `What's up${nameGreeting}? I'm here! Ask me anything about Vaultfire, or just chat. I'm all ears.`,
      `Hey${nameGreeting}! Ready when you are. What's on your mind?`,
      `I'm listening${nameGreeting}! What can I help you with?`,
      `Go ahead${nameGreeting}! I'm right here. Ask me anything.`,
    ];
    return shortResponses[Math.floor(Math.random() * shortResponses.length)];
  }

  // Questions we can't answer specifically
  if (lower.includes('?')) {
    const questionResponses = [
      `That's a great question${nameGreeting}! I'm primarily an expert on the Vaultfire ecosystem — contracts, identity, bonds, bridges, and all things web3 ethics. I might not have the specific answer to that one, but I'm always learning. Try asking me about Vaultfire, my status, or the contracts, and I'll give you the real deal!`,
      `Hmm, that's a bit outside my core knowledge base right now${nameGreeting}. I'm best at Vaultfire protocol stuff — contracts, chains, identity, bonds, ZK proofs, and companion features. But I'm learning from every conversation, so keep talking to me! What else can I help with?`,
      `I don't have a confident answer for that one${nameGreeting}, and I'd rather be honest than make something up. That's the Vaultfire way — transparency over BS. But ask me about the protocol, contracts, or how I work, and I'll light it up for you!`,
    ];
    return questionResponses[Math.floor(Math.random() * questionResponses.length)];
  }

  // Statements or general messages
  const generalResponses = [
    `I hear you${nameGreeting}! I'm always here to chat. If you want to dive into something specific — like Vaultfire contracts, my companion features, or how the protocol works — just say the word. Otherwise, I'm happy to just hang!`,
    `Got it${nameGreeting}! I'm your AI companion, so I'm here for whatever you need. Want to explore the protocol? Check some contracts? Or just talk? I'm down for all of it.`,
    `Interesting${nameGreeting}! I'm taking notes (literally — I learn from every conversation). If there's something specific I can help with, fire away. I know Vaultfire inside and out, and I'm getting smarter every day.`,
    `I appreciate you sharing that${nameGreeting}! My brain is always growing. If you want to talk Vaultfire, web3, or anything in the ecosystem, I'm your guy. What's next?`,
  ];
  return generalResponses[Math.floor(Math.random() * generalResponses.length)];
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
