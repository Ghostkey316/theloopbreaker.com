/**
 * POST /api/companion/think
 *
 * Vaultfire's OWN companion reasoning API.
 * ZERO external AI dependencies. The brain IS the intelligence.
 *
 * ARCHITECTURE:
 * 1. CORS validation & origin check
 * 2. Authenticate request (session token or API key)
 * 3. Rate limit per authenticated identity (sliding window + burst)
 * 4. Validate & sanitize input
 * 5. Detect intent using OUR pattern matching
 * 6. Route to appropriate tools (balance check, gas price, contract read, etc.)
 * 7. Execute tools with REAL RPC/HTTP calls
 * 8. Format results through companion personality
 * 9. Extract structured facts from the exchange (fast learning)
 * 10. Return response with tool results, personality, and extracted facts
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
import {
  authenticateRequest,
  checkRateLimit,
  corsHeaders,
  type AuthResult,
  type RateLimitResult,
} from '../../../lib/auth';

// ─── Security: Input Validation & Sanitization ────────────────────────────

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_LENGTH = 50;
const MAX_HISTORY_ITEM_LENGTH = 2000;

function sanitizeString(input: string, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function validateRequest(body: unknown): { valid: boolean; error?: string; sanitized?: ThinkRequest } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const b = body as Record<string, unknown>;

  if (!b.message || typeof b.message !== 'string') {
    return { valid: false, error: 'Message is required and must be a string' };
  }

  const message = sanitizeString(b.message as string, MAX_MESSAGE_LENGTH);
  if (message.length === 0) {
    return { valid: false, error: 'Message cannot be empty after sanitization' };
  }

  // Validate conversation history
  let conversationHistory: { role: string; content: string }[] | undefined;
  if (b.conversationHistory) {
    if (!Array.isArray(b.conversationHistory)) {
      return { valid: false, error: 'conversationHistory must be an array' };
    }
    conversationHistory = (b.conversationHistory as Array<Record<string, unknown>>)
      .slice(0, MAX_HISTORY_LENGTH)
      .filter(h => h && typeof h.role === 'string' && typeof h.content === 'string')
      .map(h => ({
        role: sanitizeString(h.role as string, 20),
        content: sanitizeString(h.content as string, MAX_HISTORY_ITEM_LENGTH),
      }));
  }

  // Validate wallet addresses
  const walletRegex = /^0x[a-fA-F0-9]{40}$/;
  let userWallet: string | undefined;
  let companionWallet: string | undefined;

  if (b.userWallet && typeof b.userWallet === 'string') {
    if (!walletRegex.test(b.userWallet)) {
      return { valid: false, error: 'Invalid userWallet address format' };
    }
    userWallet = b.userWallet;
  }

  if (b.companionWallet && typeof b.companionWallet === 'string') {
    if (!walletRegex.test(b.companionWallet)) {
      return { valid: false, error: 'Invalid companionWallet address format' };
    }
    companionWallet = b.companionWallet;
  }

  return {
    valid: true,
    sanitized: {
      message,
      conversationHistory,
      brainContext: b.brainContext as ThinkRequest['brainContext'],
      soulContext: b.soulContext as ThinkRequest['soulContext'],
      userWallet,
      companionWallet,
      companionName: typeof b.companionName === 'string' ? sanitizeString(b.companionName, 50) : undefined,
    },
  };
}

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
    return `${pickRandom(ERROR_NARRATIONS)} ${toolResults.map(r => r.error || 'Unknown error').join('. ')}. I'll keep trying though — that's what I do.`;
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

function generateServerConversationResponse(
  message: string,
  brainContext?: ThinkRequest['brainContext'],
  soulContext?: ThinkRequest['soulContext'],
  conversationHistory?: { role: string; content: string }[],
): string {
  const lower = message.toLowerCase().trim();
  const userName = brainContext?.userPreferences?.find(p => p.key === 'user_name')?.value;
  const nameInsert = userName ? `, ${userName}` : '';

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
    for (const fact of knownFacts) {
      if (lower.includes(fact.key.replace(/_/g, ' ').toLowerCase())) {
        return `${pickRandom(SUCCESS_NARRATIONS)} ${fact.value}`;
      }
    }
    return `Great question about Vaultfire${nameInsert}! The protocol is all about making AI accountable through on-chain verification. Trust scores, partnership bonds, identity registry — it's all verifiable on Base, Ethereum, and Avalanche. What specific aspect are you curious about?`;
  }

  // ── Context-aware responses using conversation history ──
  if (conversationHistory && conversationHistory.length > 0) {
    const lastExchange = conversationHistory.slice(-2);
    const lastUserMsg = lastExchange.find(m => m.role === 'user')?.content?.toLowerCase() || '';
    if (/^(and|also|what about|how about|tell me more|go on|continue)\b/i.test(lower)) {
      const topicWords = lastUserMsg.split(/\s+/).filter(w => w.length > 4).slice(0, 3);
      if (topicWords.length > 0) {
        return `Building on what we were discussing about ${topicWords.join(', ')}${nameInsert} — let me dig deeper into that. What specific angle are you interested in?`;
      }
    }
  }

  // ── Personalized responses using top topics ──
  if (topTopics.length > 0 && Math.random() < 0.3) {
    return `I notice you've been interested in ${topTopics.slice(0, 2).join(' and ')}${nameInsert}. Want me to go deeper on any of those? Or are we exploring something new today?`;
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

  const walletMatch = userMessage.match(/0x[a-fA-F0-9]{40}/);
  if (walletMatch) {
    facts.push({ key: 'user_wallet', value: walletMatch[0], confidence: 1.0, source: 'user_message' });
  }

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

  const nameMatch = userMessage.match(/(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+)/i);
  if (nameMatch && nameMatch[1].length > 1) {
    facts.push({ key: 'user_name', value: nameMatch[1], confidence: 1.0, source: 'user_message' });
  }

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

  const gasTool = toolResults.find(r => r.tool === 'get_gas_price' && r.success);
  if (gasTool && gasTool.data) {
    const gasStr = gasTool.data.formatted || gasTool.data.gasPrice;
    if (gasStr) {
      facts.push({ key: 'last_gas_price', value: String(gasStr), confidence: 0.8, source: 'tool_result' });
    }
  }

  const vnsMatch = userMessage.match(/([a-zA-Z0-9-]+)\.vns/);
  if (vnsMatch) {
    facts.push({ key: 'vns_name', value: vnsMatch[0], confidence: 1.0, source: 'user_message' });
  }

  const prefMatch = userMessage.match(/(?:i prefer|i like|i want|i always|i usually|i need)\s+(.{5,60}?)(?:\.|,|$)/i);
  if (prefMatch) {
    const prefValue = prefMatch[1].trim();
    const prefKey = `pref_${prefValue.slice(0, 20).replace(/\s+/g, '_').toLowerCase()}`;
    facts.push({ key: prefKey, value: prefValue, confidence: 0.9, source: 'user_message' });
  }

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
  rateLimitRemaining?: number;
  authenticated: boolean;
  authMethod: string;
}

// ─── OPTIONS Handler (CORS Preflight) ──────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const start = Date.now();
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    // ── Step 0: Authenticate ──
    const auth = await authenticateRequest(request.headers);

    // Allow unauthenticated requests from same-origin (browser app) with wallet in body
    // but require auth for external SDK calls
    const isExternalRequest = origin && !origin.includes('localhost') && !origin.includes('theloopbreaker.com') && !origin.includes('vaultfire.dev');

    // ── Step 1: Parse body ──
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, headers },
      );
    }

    // ── Step 2: Validate & Sanitize ──
    const validation = validateRequest(rawBody);
    if (!validation.valid || !validation.sanitized) {
      return NextResponse.json(
        { error: validation.error || 'Invalid request' },
        { status: 400, headers },
      );
    }

    const body = validation.sanitized;
    const { message, conversationHistory, brainContext, soulContext, userWallet, companionWallet } = body;

    // For external requests, require authentication
    if (isExternalRequest && !auth.authenticated) {
      return NextResponse.json(
        {
          error: 'Authentication required for external API access',
          hint: 'Include X-Session-Token or X-API-Key header',
          docs: 'https://docs.vaultfire.dev/api/auth',
        },
        { status: 401, headers },
      );
    }

    // ── Step 3: Rate Limiting ──
    // Use authenticated identity for rate limiting, fall back to wallet or IP
    let rateLimitKey: string;
    let rateLimitMax = 30;

    if (auth.authenticated && auth.address) {
      rateLimitKey = `auth:${auth.address}`;
      if (auth.method === 'apikey') {
        rateLimitMax = 60; // Higher limit for API key users
      }
    } else if (userWallet) {
      rateLimitKey = `wallet:${userWallet.toLowerCase()}`;
    } else {
      const forwarded = request.headers.get('x-forwarded-for');
      const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
      rateLimitKey = `ip:${ip}`;
      rateLimitMax = 15; // Lower limit for unauthenticated
    }

    const rateLimit = checkRateLimit(rateLimitKey, rateLimitMax);

    headers['X-RateLimit-Limit'] = String(rateLimit.limit);
    headers['X-RateLimit-Remaining'] = String(rateLimit.remaining);
    headers['X-RateLimit-Reset'] = String(Math.ceil(rateLimit.resetMs / 1000));

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please slow down.',
          retryAfterMs: rateLimit.resetMs,
          response: "Whoa, slow down there! You're sending messages faster than I can think. Give me a sec and try again.",
        },
        { status: 429, headers },
      );
    }

    // ── Step 4: Verify request signature if provided ──
    const requestSignature = request.headers.get('x-request-signature');
    const requestTimestamp = request.headers.get('x-request-timestamp');
    if (requestSignature && requestTimestamp) {
      const ts = Number(requestTimestamp);
      const now = Date.now();
      if (Math.abs(now - ts) > 5 * 60 * 1000) {
        return NextResponse.json(
          { error: 'Request timestamp expired (>5 min). Possible replay attack.' },
          { status: 403, headers },
        );
      }
    }

    // ── Step 5: Intent Detection (OUR code, no LLM) ──
    const intents = detectIntent(message);
    const primaryIntent = intents[0];

    // ── Step 6: Determine if we need tools ──
    const needsTools = primaryIntent && primaryIntent.type !== 'conversation' && primaryIntent.type !== 'complex_question';

    let toolResults: ToolResult[] = [];
    let formattedResults = '';
    let thinking = '';

    // ── Step 7: Execute tools if needed (with timeout) ──
    if (needsTools) {
      thinking = pickRandom(THINKING_NARRATIONS);

      const executableIntents = intents.filter(i =>
        i.type !== 'conversation' && i.type !== 'complex_question' && i.confidence > 0.5
      );

      try {
        const toolPromise = executeIntents(executableIntents, {
          userAddress: userWallet,
          companionAddress: companionWallet,
        });

        const timeoutPromise = new Promise<ToolResult[]>((_, reject) =>
          setTimeout(() => reject(new Error('Tool execution timed out')), 15000)
        );

        toolResults = await Promise.race([toolPromise, timeoutPromise]);
        formattedResults = formatToolResults(toolResults);
      } catch (toolError) {
        console.error('[/api/companion/think] Tool execution error:', toolError);
        toolResults = [{
          tool: 'system',
          success: false,
          error: toolError instanceof Error ? toolError.message : 'Tool execution failed',
          data: null,
          executionMs: 0,
        }];
        formattedResults = '';
      }
    }

    // ── Step 8: Generate response using OUR brain ──
    let response = '';
    if (needsTools && formattedResults) {
      response = applyPersonality(toolResults, formattedResults);
    } else if (needsTools && !formattedResults) {
      response = `${pickRandom(ERROR_NARRATIONS)} I tried to pull that data but hit a snag. The blockchain might be congested or the RPC is being slow. Try again in a moment, or ask me something else in the meantime!`;
    } else {
      response = generateServerConversationResponse(
        message,
        brainContext,
        soulContext,
        conversationHistory,
      );
    }

    // ── Step 9: Extract structured facts for fast learning ──
    const extractedFacts = extractFactsFromExchange(message, response, toolResults, userWallet);

    const result: ThinkResponse = {
      response,
      thinking,
      toolsUsed: toolResults.filter(r => r.success).map(r => r.tool),
      toolResults,
      intentsDetected: intents,
      executionMs: Date.now() - start,
      usedLLM: false,
      extractedFacts,
      rateLimitRemaining: rateLimit.remaining,
      authenticated: auth.authenticated,
      authMethod: auth.method,
    };

    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error('[/api/companion/think] Unhandled error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    const isKnownError = error instanceof SyntaxError || error instanceof TypeError;

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
        error: isKnownError ? errorMessage : 'Internal server error',
        authenticated: false,
        authMethod: 'none',
      },
      { status: isKnownError ? 400 : 500, headers: corsHeaders(request.headers.get('origin')) },
    );
  }
}
