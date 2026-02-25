/**
 * POST /api/companion/think
 *
 * Vaultfire's OWN companion reasoning API.
 * This is NOT an OpenAI wrapper — this is OUR intelligence pipeline.
 *
 * ARCHITECTURE:
 * 1. Receive user message + context (brain state, soul values, wallet info)
 * 2. Detect intent using OUR pattern matching (no LLM needed)
 * 3. Route to appropriate tools (balance check, gas price, contract read, etc.)
 * 4. Execute tools with REAL RPC/HTTP calls
 * 5. Format results through companion personality
 * 6. Optionally use LLM as ONE tool for complex NLU (not as the brain)
 * 7. Return response with tool results and personality
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

// ─── Request/Response Types ─────────────────────────────────────────────────

interface ThinkRequest {
  message: string;
  conversationHistory?: { role: string; content: string }[];
  brainContext?: {
    knowledgeEntries: number;
    learnedInsights: number;
    memoriesCount: number;
    topTopics: string[];
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
      
      // Build context from brain knowledge
      let fullContext = soulCtx;
      if (brainContext) {
        fullContext += `\n\nYour brain has ${brainContext.knowledgeEntries} knowledge entries, ${brainContext.learnedInsights} learned insights, and ${brainContext.memoriesCount} memories.`;
        if (brainContext.topTopics.length > 0) {
          fullContext += ` User's top interests: ${brainContext.topTopics.join(', ')}.`;
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

    const result: ThinkResponse = {
      response,
      thinking,
      toolsUsed: toolResults.map(r => r.tool),
      toolResults,
      intentsDetected: intents,
      executionMs: Date.now() - start,
      usedLLM,
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
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 200 }, // Return 200 so the client gets a friendly message
    );
  }
}
