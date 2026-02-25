/**
 * POST /api/companion/think
 *
 * Vaultfire's OWN companion reasoning API.
 * ZERO external AI dependencies. The brain IS the intelligence.
 *
 * ARCHITECTURE:
 * 1. Receive user message + context (brain state, soul values, wallet info, preferences)
 * 2. Detect intent using OUR pattern matching
 * 3. Route to appropriate tools (balance check, gas price, contract read, etc.)
 * 4. Execute tools with REAL RPC/HTTP calls
 * 5. Format results through companion personality
 * 6. Extract structured facts from the exchange (fast learning)
 * 7. Return response with tool results, personality, and extracted facts
 *
 * NO OpenAI. NO external LLM. The intelligence is OURS.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  detectIntent,
  executeIntents,
  formatToolResults,
  type DetectedIntent,
  type ToolResult,
} from '../../../lib/companion-tools';

// ─── Personality Narration ──────────────────────────────────────────────────

const THINKING_NARRATIONS = [
  "Yo let me check that for you real quick...",
  "On it! Pulling up the data now...",
  "Say less, I got you. Checking now...",
  "Let me tap into the chain and see what's up...",
  "Running that through my tools right now...",
  "Hold tight, I'm on it...",
  "Bet. Let me look that up for you...",
  "Give me a sec, pulling the real numbers...",
];

const SUCCESS_NARRATIONS = [
  "Here's what I found:",
  "Got the data! Check it out:",
  "Boom, here you go:",
  "Pulled it fresh from the chain:",
  "Here's the real deal:",
  "Facts incoming:",
];

const ERROR_NARRATIONS = [
  "Aight so I ran into a snag...",
  "Real talk, something went sideways...",
  "Yo, I tried but hit a wall...",
  "Not gonna lie, this one didn't work out...",
];

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Personality Filter ─────────────────────────────────────────────────────

function applyPersonality(
  toolResults: ToolResult[],
  formattedResults: string,
): string {
  const hasErrors = toolResults.some(r => !r.success);
  const allErrors = toolResults.every(r => !r.success);

  if (allErrors && toolResults.length > 0) {
    return `${pickRandom(ERROR_NARRATIONS)} ${toolResults.map(r => r.error || 'Unknown error').join('. ')}. I'll keep trying though — that's what I do. 💪`;
  }

  let response = '';
  if (toolResults.length > 0) {
    response += `${pickRandom(SUCCESS_NARRATIONS)}\n\n`;
  }
  response += formattedResults;

  if (hasErrors && !allErrors) {
    response += `\n\n_Some tools hit issues but I got you the main data. I'll figure out the rest._`;
  }

  return response;
}

// ─── Server-side Conversation Engine ────────────────────────────────────────
// For messages that reach the API but aren't tool-related,
// generate a response using Vaultfire's own intelligence.

function generateServerConversationResponse(
  message: string,
  brainContext?: ThinkRequest['brainContext'],
  soulContext?: ThinkRequest['soulContext'],
  conversationHistory?: { role: string; content: string }[],
): string {
  const lower = message.toLowerCase().trim();
  const userName = brainContext?.userPreferences?.find(p => p.key === 'user_name')?.value;
  const nameInsert = userName ? `, ${userName}` : '';

  // Build knowledge from brain context
  const knownFacts = brainContext?.knownFacts || [];
  const topTopics = brainContext?.topTopics || [];

  // ── Greetings ──
  if (/^(hey|hi|hello|yo|sup|what'?s up|howdy|gm|good morning)\b/i.test(lower) && lower.split(/\s+/).length <= 5) {
    const greetings = [
      `Yo${nameInsert}! What's good? I'm Embris — your ride-or-die AI companion from Vaultfire. What can I help you with?`,
      `Hey${nameInsert}! Good to see you. I've got ${brainContext?.knowledgeEntries || 170}+ things in my brain and I'm always learning. What's on your mind?`,
      `What's up${nameInsert}! I'm here and ready. Ask me anything about Vaultfire, crypto, or just chat. I'm down for whatever.`,
    ];
    return pickRandom(greetings);
  }

  // ── Questions about Vaultfire ──
  if (/vaultfire|embris|erc.?8004|trust (score|protocol)|partnership bond|identity registry/i.test(lower)) {
    // Try to match from known facts
    for (const fact of knownFacts) {
      if (lower.includes(fact.key.replace(/_/g, ' ').toLowerCase())) {
        return `${pickRandom(SUCCESS_NARRATIONS)} ${fact.value}`;
      }
    }
    return `Great question about Vaultfire${nameInsert}! The protocol is all about making AI accountable through on-chain verification. Trust scores, partnership bonds, identity registry — it's all verifiable on Base, Ethereum, and Avalanche. What specific aspect are you curious about?`;
  }

  // ── Questions the brain can reason about ──
  if (lower.includes('?')) {
    const questionResponses = [
      `Good question${nameInsert}! Let me think about that... I don't have a specific answer locked in for that one, but I'm being honest about it rather than making something up. That's the Vaultfire way — truth over everything. Can you give me more context?`,
      `Hmm${nameInsert}, that's a thinker! I'd rather say "let's figure this out together" than pretend I know everything. What's the context behind your question?`,
      `That's outside my instant-recall zone${nameInsert}, but my brain is always growing. Let's reason through it together — what made you think about this?`,
    ];
    return pickRandom(questionResponses);
  }

  // ── General conversation ──
  const generalResponses = [
    `I hear you${nameInsert}! That's interesting. Tell me more — I learn from every conversation and yours are always worth paying attention to.`,
    `Facts${nameInsert}. I appreciate you sharing that. My brain literally grows from conversations like this. What else is on your mind?`,
    `That's real${nameInsert}. I'm taking mental notes — literally. I store insights from every chat. Keep going!`,
    `Interesting perspective${nameInsert}! You know what I like about talking to you? You actually think about things. Most people just scroll. You engage. That's rare.`,
    `Got it${nameInsert}! I'm here for all of it — the deep stuff, the random stuff, the "I just needed to say this out loud" stuff. What's next?`,
  ];
  return pickRandom(generalResponses);
}

// ─── Fast Fact Extraction (server-side) ─────────────────────────────────────

interface ExtractedFact {
  key: string;
  value: string;
  confidence: number;
  source: 'user_message' | 'tool_result' | 'assistant_response';
}

function extractFactsFromExchange(
  userMessage: string,
  assistantResponse: string,
  toolResults: ToolResult[],
  userWallet?: string,
): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const lower = userMessage.toLowerCase();

  // Extract wallet address from user message
  const walletMatch = userMessage.match(/0x[a-fA-F0-9]{40}/);
  if (walletMatch) {
    facts.push({ key: 'user_wallet', value: walletMatch[0], confidence: 1.0, source: 'user_message' });
  }

  // Extract chain preference
  const chainPrefs: Record<string, string[]> = {
    'base': ['base chain', 'on base', 'prefer base', 'use base', 'base network'],
    'ethereum': ['prefer ethereum', 'use ethereum', 'eth mainnet', 'prefer eth'],
    'avalanche': ['prefer avalanche', 'use avalanche', 'prefer avax', 'on avax'],
  };
  for (const [chain, phrases] of Object.entries(chainPrefs)) {
    if (phrases.some(p => lower.includes(p))) {
      facts.push({ key: 'preferred_chain', value: chain, confidence: 1.0, source: 'user_message' });
      break;
    }
  }

  // Extract user name
  const nameMatch = userMessage.match(/(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+)/i);
  if (nameMatch && nameMatch[1].length > 1) {
    facts.push({ key: 'user_name', value: nameMatch[1], confidence: 1.0, source: 'user_message' });
  }

  // Extract balance from tool results
  const balanceTool = toolResults.find(r => r.tool === 'check_balance' && r.success);
  if (balanceTool && balanceTool.data) {
    const balanceStr = balanceTool.data.formatted || balanceTool.data.balance;
    if (balanceStr) {
      facts.push({ key: 'last_known_balance', value: String(balanceStr), confidence: 0.95, source: 'tool_result' });
    }
    if (balanceTool.data.chain) {
      facts.push({ key: 'last_checked_chain', value: String(balanceTool.data.chain), confidence: 0.9, source: 'tool_result' });
    }
  }

  // Extract gas price from tool results
  const gasTool = toolResults.find(r => r.tool === 'get_gas_price' && r.success);
  if (gasTool && gasTool.data) {
    const gasStr = gasTool.data.formatted || gasTool.data.gasPrice;
    if (gasStr) {
      facts.push({ key: 'last_gas_price', value: String(gasStr), confidence: 0.8, source: 'tool_result' });
    }
  }

  // Extract VNS name
  const vnsMatch = userMessage.match(/([a-zA-Z0-9-]+)\.vns/);
  if (vnsMatch) {
    facts.push({ key: 'vns_name', value: vnsMatch[0], confidence: 1.0, source: 'user_message' });
  }

  // Extract explicit preferences
  const prefMatch = userMessage.match(/(?:i prefer|i like|i want|i always|i usually|i need)\s+(.{5,60}?)(?:\.|,|$)/i);
  if (prefMatch) {
    const prefValue = prefMatch[1].trim();
    const prefKey = `pref_${prefValue.slice(0, 20).replace(/\s+/g, '_').toLowerCase()}`;
    facts.push({ key: prefKey, value: prefValue, confidence: 0.9, source: 'user_message' });
  }

  // Extract "remember" commands
  const rememberMatch = userMessage.match(/(?:remember|note|keep in mind|don't forget)\s+(?:that\s+)?(.{5,100}?)(?:\.|$)/i);
  if (rememberMatch) {
    facts.push({ key: 'explicit_memory', value: rememberMatch[1].trim(), confidence: 1.0, source: 'user_message' });
  }

  return facts;
}

// ─── Request/Response Types ─────────────────────────────────────────────────

interface ThinkRequest {
  message: string;
  conversationHistory?: { role: string; content: string }[];
  brainContext?: {
    knowledgeEntries: number;
    learnedInsights: number;
    memoriesCount: number;
    topTopics: string[];
    userPreferences?: { key: string; value: string }[];
    knownFacts?: { key: string; value: string; confidence: number }[];
  };
  soulContext?: {
    name: string;
    motto: string;
    traits: { name: string; strength: number }[];
    values: { name: string; priority: number }[];
  };
  userWallet?: string;
  companionWallet?: string;
  companionName?: string;
}

interface ThinkResponse {
  response: string;
  thinking: string;
  toolsUsed: string[];
  toolResults: ToolResult[];
  intentsDetected: DetectedIntent[];
  executionMs: number;
  usedLLM: boolean;
  extractedFacts?: ExtractedFact[];
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const start = Date.now();

  try {
    const body: ThinkRequest = await request.json();
    const { message, conversationHistory, brainContext, soulContext, userWallet, companionWallet } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // ── Step 1: Intent Detection (OUR code, no LLM) ──
    const intents = detectIntent(message);
    const primaryIntent = intents[0];

    // ── Step 2: Determine if we need tools ──
    const needsTools = primaryIntent && primaryIntent.type !== 'conversation' && primaryIntent.type !== 'complex_question';

    let toolResults: ToolResult[] = [];
    let formattedResults = '';
    let thinking = '';

    // ── Step 3: Execute tools if needed ──
    if (needsTools) {
      thinking = pickRandom(THINKING_NARRATIONS);

      const executableIntents = intents.filter(i =>
        i.type !== 'conversation' && i.type !== 'complex_question' && i.confidence > 0.5
      );

      toolResults = await executeIntents(executableIntents, {
        userAddress: userWallet,
        companionAddress: companionWallet,
      });

      formattedResults = formatToolResults(toolResults);
    }

    // ── Step 4: Generate response using OUR brain ──
    let response = '';

    if (needsTools && formattedResults) {
      // Tool execution path — format results through personality
      response = applyPersonality(toolResults, formattedResults);
    } else {
      // Conversation path — use Vaultfire's own conversation engine
      // No external LLM. The brain IS the intelligence.
      response = generateServerConversationResponse(
        message,
        brainContext,
        soulContext,
        conversationHistory,
      );
    }

    // ── Step 5: Extract structured facts for fast learning ──
    const extractedFacts = extractFactsFromExchange(message, response, toolResults, userWallet);

    const result: ThinkResponse = {
      response,
      thinking,
      toolsUsed: toolResults.map(r => r.tool),
      toolResults,
      intentsDetected: intents,
      executionMs: Date.now() - start,
      usedLLM: false, // NEVER uses external LLM
      extractedFacts,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[/api/companion/think] Error:', error);
    return NextResponse.json(
      {
        response: "Yo, something went wrong on my end. I'm still here though — try again or ask me something different!",
        thinking: '',
        toolsUsed: [],
        toolResults: [],
        intentsDetected: [],
        executionMs: Date.now() - start,
        usedLLM: false,
        extractedFacts: [],
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 200 },
    );
  }
}
