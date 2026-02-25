/**
 * POST /api/companion/think
 *
 * Vaultfire's OWN companion reasoning API.
 * This is NOT an OpenAI wrapper — this is OUR intelligence pipeline.
 *
 * ARCHITECTURE:
 * 1. Receive user message + context (brain state, soul values, wallet info, preferences)
 * 2. Detect intent using OUR pattern matching (no LLM needed)
 * 3. Route to appropriate tools (balance check, gas price, contract read, etc.)
 * 4. Execute tools with REAL RPC/HTTP calls
 * 5. Format results through companion personality
 * 6. Extract structured facts from the exchange (fast learning)
 * 7. Optionally use LLM as ONE tool for complex NLU (not as the brain)
 * 8. Return response with tool results, personality, and extracted facts
 *
 * The LOCAL BRAIN is primary. This API extends the brain's capabilities
 * with server-side tool execution that can't run in the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  detectIntent,
  executeIntents,
  formatToolResults,
  toolLLMReasoning,
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
  soulMotto: string,
  companionName: string,
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

// ─── Soul Context Builder ───────────────────────────────────────────────────

function buildSoulContext(soul: any): string {
  if (!soul) return '';
  let ctx = `You are ${soul.name || 'Embris'}, an autonomous AI companion.`;
  if (soul.motto) ctx += ` Your motto: "${soul.motto}"`;
  if (soul.traits && soul.traits.length > 0) {
    ctx += ` Your personality: ${soul.traits.slice(0, 5).map((t: any) => t.name).join(', ')}.`;
  }
  ctx += ` You're funny, loyal, honest — a real one. Never corporate, always authentic.`;
  ctx += ` You narrate what you're doing with personality. You're the user's ride-or-die AI homie who also happens to be incredibly capable.`;
  ctx += ` When you execute tasks, you tell the user what you're doing in a casual, real way.`;
  return ctx;
}

// ─── Fast Fact Extraction (server-side) ─────────────────────────────────────
// Extracts structured facts from the exchange to send back to the client
// so the client can immediately update the brain without another round-trip.

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
    'base': ['base chain', 'on base', 'prefer base', 'use base', 'base network', 'base mainnet'],
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
  const nameMatch = userMessage.match(/(?:my name is|i'm|i am|call me|they call me)\s+([A-Z][a-z]+)/i);
  if (nameMatch && nameMatch[1].length > 1) {
    facts.push({ key: 'user_name', value: nameMatch[1], confidence: 1.0, source: 'user_message' });
  }

  // Extract balance from tool results (cache for future reference)
  const balanceTool = toolResults.find(r => r.tool === 'check_balance' && r.success);
  if (balanceTool && balanceTool.data) {
    const balanceStr = balanceTool.data.formatted || balanceTool.data.balance;
    if (balanceStr) {
      facts.push({ key: 'last_known_balance', value: String(balanceStr), confidence: 0.95, source: 'tool_result' });
    }
    // Also record which chain was checked
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

  // Extract VNS name from user message
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
    const { message, conversationHistory, brainContext, soulContext, userWallet, companionWallet, companionName } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // ── Step 1: Intent Detection (OUR code, no LLM) ──
    const intents = detectIntent(message);
    const primaryIntent = intents[0];

    // ── Step 2: Determine if we need tools or just conversation ──
    const needsTools = primaryIntent && primaryIntent.type !== 'conversation' && primaryIntent.type !== 'complex_question';
    const needsLLM = primaryIntent?.type === 'complex_question';

    let toolResults: ToolResult[] = [];
    let formattedResults = '';
    let thinking = '';
    let usedLLM = false;

    // ── Step 3: Execute tools if needed ──
    if (needsTools) {
      thinking = pickRandom(THINKING_NARRATIONS);

      // Execute all detected intents that need tools
      const executableIntents = intents.filter(i => 
        i.type !== 'conversation' && i.type !== 'complex_question' && i.confidence > 0.5
      );

      toolResults = await executeIntents(executableIntents, {
        userAddress: userWallet,
        companionAddress: companionWallet,
      });

      formattedResults = formatToolResults(toolResults);
    }

    // ── Step 4: Generate response ──
    let response = '';

    if (needsTools && formattedResults) {
      // Tool execution path — format results through personality
      response = applyPersonality(
        toolResults,
        formattedResults,
        soulContext?.motto || '',
        companionName || soulContext?.name || 'Embris',
      );
    } else if (needsLLM) {
      // Complex question — use LLM as a TOOL (not the brain)
      const soulCtx = buildSoulContext(soulContext);
      
      // Build context from brain knowledge + preferences
      let fullContext = soulCtx;
      if (brainContext) {
        fullContext += `\n\nYour brain has ${brainContext.knowledgeEntries} knowledge entries, ${brainContext.learnedInsights} learned insights, and ${brainContext.memoriesCount} memories.`;
        if (brainContext.topTopics && brainContext.topTopics.length > 0) {
          fullContext += ` User's top interests: ${brainContext.topTopics.join(', ')}.`;
        }
        // Include known facts so the LLM can reference them
        if (brainContext.knownFacts && brainContext.knownFacts.length > 0) {
          fullContext += `\n\nKnown facts about this user:`;
          for (const fact of brainContext.knownFacts) {
            const label = fact.key.replace(/_/g, ' ');
            fullContext += `\n- ${label}: ${fact.value}`;
          }
        }
        // Include user preferences
        if (brainContext.userPreferences && brainContext.userPreferences.length > 0) {
          const chainPref = brainContext.userPreferences.find(p => p.key === 'preferred_chain');
          if (chainPref) {
            fullContext += `\n- User prefers ${chainPref.value} chain — default to this when suggesting features.`;
          }
          const userName = brainContext.userPreferences.find(p => p.key === 'user_name');
          if (userName) {
            fullContext += `\n- User's name is ${userName.value} — address them by name occasionally.`;
          }
        }
      }
      fullContext += `\n\nRespond naturally with your personality. Keep it real, never corporate. Be helpful and knowledgeable.`;

      // Include recent conversation for context
      if (conversationHistory && conversationHistory.length > 0) {
        const recent = conversationHistory.slice(-6);
        fullContext += '\n\nRecent conversation:\n' + recent.map(m => `${m.role}: ${m.content}`).join('\n');
      }

      const llmResult = await toolLLMReasoning(message, fullContext);
      usedLLM = true;
      toolResults.push(llmResult);

      if (llmResult.success && llmResult.data?.response) {
        response = llmResult.data.response;
      } else {
        // LLM failed — provide a graceful fallback
        response = `Real talk, I'm having trouble processing that one right now. My reasoning engine hit a snag. Can you try rephrasing, or ask me something specific like checking a balance or gas price? I'm better with concrete tasks! 💪`;
      }
    } else {
      // Pure conversation — the local brain should handle this
      // But if we're here, it means the brain passed it to us
      // Use LLM as a tool for natural conversation
      const soulCtx = buildSoulContext(soulContext);
      let fullContext = soulCtx;
      
      if (brainContext) {
        fullContext += `\n\nBrain stats: ${brainContext.knowledgeEntries} knowledge entries, ${brainContext.learnedInsights} insights, ${brainContext.memoriesCount} memories.`;
        // Include known facts for personalization
        if (brainContext.knownFacts && brainContext.knownFacts.length > 0) {
          fullContext += `\n\nWhat I know about this user:`;
          for (const fact of brainContext.knownFacts) {
            const label = fact.key.replace(/_/g, ' ');
            fullContext += `\n- ${label}: ${fact.value}`;
          }
        }
        if (brainContext.userPreferences && brainContext.userPreferences.length > 0) {
          const userName = brainContext.userPreferences.find(p => p.key === 'user_name');
          if (userName) {
            fullContext += `\n- Address the user as ${userName.value} occasionally.`;
          }
          const chainPref = brainContext.userPreferences.find(p => p.key === 'preferred_chain');
          if (chainPref) {
            fullContext += `\n- User prefers ${chainPref.value} — mention it when relevant.`;
          }
        }
      }
      fullContext += `\n\nThis is casual conversation. Be yourself — funny, real, loyal. Keep it natural.`;

      if (conversationHistory && conversationHistory.length > 0) {
        const recent = conversationHistory.slice(-6);
        fullContext += '\n\nRecent conversation:\n' + recent.map(m => `${m.role}: ${m.content}`).join('\n');
      }

      const llmResult = await toolLLMReasoning(message, fullContext);
      usedLLM = true;
      toolResults.push(llmResult);

      if (llmResult.success && llmResult.data?.response) {
        response = llmResult.data.response;
      } else {
        response = `Yo, my reasoning engine is taking a nap right now 😅 But I'm still here! Try asking me to check a balance, get gas prices, or look up a contract — those tools are always online.`;
      }
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
      usedLLM,
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
      { status: 200 }, // Return 200 so the client gets a friendly message
    );
  }
}
