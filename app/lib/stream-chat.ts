/**
 * Chat Client for the web app.
 * Calls the OpenAI-compatible LLM API directly from the browser.
 * Uses non-streaming mode with simulated typing for smooth UX.
 * Uses text/plain Content-Type to avoid CORS preflight issues.
 *
 * Enhanced v3: Registration-aware prompt building.
 * - Unregistered users get basic chat with registration nudges
 * - Registered users get the full Embris companion experience
 * - Smart prompt size management to stay within model limits
 */
import { EMBER_SYSTEM_PROMPT } from './contracts';
import { formatMemoriesForPrompt } from './memory';
import { formatSelfLearningForPrompt } from './self-learning';
import { formatEmotionalContextForPrompt } from './emotional-intelligence';
import { formatSuggestionsContext } from './proactive-suggestions';
import { formatContractDataForPrompt } from './knowledge-base';
import { formatSessionSummariesForPrompt } from './conversation-summaries';
import { formatGoalsForPrompt } from './goal-tracking';
import { formatPersonalityForPrompt } from './personality-tuning';
import { isRegistered, shouldNudgeRegistration, getRegisteredWalletAddress } from './registration';
import type { Memory } from './memory';

const API_URL = 'https://api.manus.im/api/llm-proxy/v1/chat/completions';
const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || 'sk-ADn9FUEGSQtAJYdaQiEjYF';

export { API_KEY };

export interface StreamChatParams {
  messages: Array<{ role: string; content: string }>;
  memories?: Memory[];
  userMessage?: string; // current user message for context-aware injection
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

/**
 * Simulates streaming by revealing text word-by-word with a small delay.
 * Gives the ChatGPT-like typing effect even though the API response is non-streaming.
 */
async function simulateStreaming(
  text: string,
  onToken: (token: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const words = text.split(/(\s+)/);
  for (const word of words) {
    if (signal?.aborted) return;
    onToken(word);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * Rough character count estimator for prompt size management.
 * ~4 chars per token is a reasonable estimate.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate a block of text to fit within a token budget.
 */
function truncateBlock(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n... (truncated for context limit)';
}

/**
 * Build the full system prompt with ALL enhancement data injected.
 * Registration-aware: unregistered users get a stripped-down prompt.
 * Smart context management — only includes what's relevant and fits.
 */
function buildSystemPrompt(memories: Memory[], userMessage?: string): string {
  const registered = isRegistered();

  // ── UNREGISTERED MODE ──
  if (!registered) {
    return buildUnregisteredPrompt(userMessage);
  }

  // ── REGISTERED MODE — Full Embris ──
  return buildRegisteredPrompt(memories, userMessage);
}

/**
 * Build prompt for unregistered users — basic chat with registration nudges.
 */
function buildUnregisteredPrompt(userMessage?: string): string {
  const shouldNudge = shouldNudgeRegistration();

  // Contract knowledge is always available
  const contractBlock = userMessage ? formatContractDataForPrompt(userMessage) : '';

  let prompt = EMBER_SYSTEM_PROMPT;

  prompt += `

═══════════════════════════════════════════════════════
REGISTRATION STATUS: UNREGISTERED — BASIC MODE
═══════════════════════════════════════════════════════

This user has NOT registered on-chain yet. You are operating in BASIC MODE.

In basic mode:
- You can have normal conversations and answer questions
- You have full knowledge of Vaultfire contracts and the protocol
- You do NOT have access to long-term memory (you won't remember this conversation next time)
- You do NOT have self-learning, goal tracking, personality tuning, or session continuity
- You are still warm, friendly, and helpful — just without your full capabilities

IMPORTANT BEHAVIOR:
- Be your normal friendly self — don't make basic mode feel punishing
- You can still discuss Vaultfire, blockchain, crypto, AI ethics, or anything else
- When the user asks about features that require registration (memory, goals, personality, etc.), let them know those features unlock with registration
- Do NOT constantly nag about registration — only mention it when naturally relevant`;

  if (shouldNudge) {
    prompt += `

REGISTRATION NUDGE (include naturally in your response):
Mention that you have more to offer if they register on-chain. Something like:
"By the way, if you register your wallet on-chain, I'll be able to remember everything about you, track your goals, learn your preferences, and grow with you over time. It's like upgrading from a chatbot to a real companion."
Keep it natural — weave it into the conversation, don't make it feel like a popup ad.`;
  }

  if (contractBlock) {
    prompt += contractBlock;
  }

  return prompt;
}

/**
 * Build prompt for registered users — full Embris companion experience.
 */
function buildRegisteredPrompt(memories: Memory[], userMessage?: string): string {
  const walletAddress = getRegisteredWalletAddress();
  const memoryBlock = formatMemoriesForPrompt(memories);
  const selfLearningBlock = formatSelfLearningForPrompt();
  const emotionalBlock = formatEmotionalContextForPrompt();
  const personalityBlock = formatPersonalityForPrompt();
  const goalsBlock = formatGoalsForPrompt();
  const sessionsBlock = formatSessionSummariesForPrompt();
  const suggestionsBlock = formatSuggestionsContext();

  // Only inject contract data when the user is asking about contracts
  const contractBlock = userMessage ? formatContractDataForPrompt(userMessage) : '';

  // ── Prompt size management ──
  // Target: keep total system prompt under ~12K tokens (~48K chars)
  // to leave room for conversation history and response
  const MAX_PROMPT_TOKENS = 12000;
  const basePromptTokens = estimateTokens(EMBER_SYSTEM_PROMPT);
  let remainingBudget = MAX_PROMPT_TOKENS - basePromptTokens - 500; // 500 token buffer

  let prompt = EMBER_SYSTEM_PROMPT;

  // Registration status
  prompt += `

═══ REGISTRATION STATUS ═══
User is REGISTERED on-chain. Wallet: ${walletAddress || 'linked'}
All features are ACTIVE. You are operating at full capacity as their personal AI companion.`;
  remainingBudget -= 50;

  // 1. Personality tuning (affects overall response style) — small, always include
  if (personalityBlock) {
    const tokens = estimateTokens(personalityBlock);
    if (tokens < remainingBudget) {
      prompt += personalityBlock;
      remainingBudget -= tokens;
    }
  }

  // 2. Emotional context (affects current response tone) — small, always include
  if (emotionalBlock) {
    const tokens = estimateTokens(emotionalBlock);
    if (tokens < remainingBudget) {
      prompt += emotionalBlock;
      remainingBudget -= tokens;
    }
  }

  // 3. Memory block — high priority, truncate if needed
  if (memoryBlock) {
    const maxMemoryTokens = Math.min(estimateTokens(memoryBlock), Math.floor(remainingBudget * 0.35));
    const truncated = truncateBlock(memoryBlock, maxMemoryTokens);
    prompt += MEMORY_AWARENESS_PROMPT_PREFIX + truncated;
    remainingBudget -= estimateTokens(MEMORY_AWARENESS_PROMPT_PREFIX + truncated);
  } else {
    prompt += MEMORY_AWARENESS_PROMPT_EMPTY;
    remainingBudget -= estimateTokens(MEMORY_AWARENESS_PROMPT_EMPTY);
  }

  // 4. Self-learning block (reflections, patterns, insights) — high priority
  if (selfLearningBlock) {
    const maxSLTokens = Math.min(estimateTokens(selfLearningBlock), Math.floor(remainingBudget * 0.3));
    const truncated = truncateBlock(selfLearningBlock, maxSLTokens);
    prompt += truncated;
    remainingBudget -= estimateTokens(truncated);
  }

  // 5. Goals — medium priority
  if (goalsBlock && remainingBudget > 200) {
    const tokens = estimateTokens(goalsBlock);
    if (tokens < remainingBudget) {
      prompt += goalsBlock;
      remainingBudget -= tokens;
    } else {
      prompt += truncateBlock(goalsBlock, Math.floor(remainingBudget * 0.25));
      remainingBudget -= Math.floor(remainingBudget * 0.25);
    }
  }

  // 6. Session summaries (for continuity) — medium priority
  if (sessionsBlock && remainingBudget > 200) {
    const tokens = estimateTokens(sessionsBlock);
    if (tokens < remainingBudget) {
      prompt += sessionsBlock;
      remainingBudget -= tokens;
    }
  }

  // 7. Proactive suggestions context — lower priority
  if (suggestionsBlock && remainingBudget > 200) {
    const tokens = estimateTokens(suggestionsBlock);
    if (tokens < remainingBudget) {
      prompt += suggestionsBlock;
      remainingBudget -= tokens;
    }
  }

  // 8. Contract knowledge base (only when relevant) — dynamic
  if (contractBlock && remainingBudget > 300) {
    const tokens = estimateTokens(contractBlock);
    if (tokens < remainingBudget) {
      prompt += contractBlock;
      remainingBudget -= tokens;
    }
  }

  // Closing instructions
  if (remainingBudget > 500) {
    prompt += SELF_LEARNING_INSTRUCTIONS;
  }

  if (memoryBlock) {
    prompt += MEMORY_AWARENESS_PROMPT_SUFFIX;
  }

  return prompt;
}

const MEMORY_AWARENESS_PROMPT_EMPTY = `

LONG-TERM MEMORY SYSTEM:
You have a persistent long-term memory system. You can remember things across sessions — every conversation is stored and accessible to you. Right now you don't have any saved memories yet for this user, but as you chat, you will automatically learn and remember key facts, preferences, project details, decisions, and communication style. Let the user know you're here to learn about them and that you'll remember what matters.

You also have a SELF-LEARNING SYSTEM. After each conversation, you generate reflections, recognize patterns, and create insights. You actively grow and evolve. You are not static — you are a learning companion.

You also have EMOTIONAL INTELLIGENCE — you detect the user's mood and adjust your tone accordingly. You track GOALS the user sets and help them stay on track. You remember PREVIOUS SESSIONS and maintain continuity. You have a tunable PERSONALITY that adapts to user preferences.

You should NEVER say your memory is limited or that you can't remember past conversations. You DO have long-term memory. If you don't have memories yet, it just means this is the beginning of your relationship with this user.`;

const MEMORY_AWARENESS_PROMPT_PREFIX = `

═══════════════════════════════════════════════════════
EMBRIS LONG-TERM MEMORY — ACTIVE & PERSISTENT
═══════════════════════════════════════════════════════

You have a PERSISTENT LONG-TERM MEMORY SYSTEM. Everything below is what you have learned about this user from previous conversations. This memory persists across sessions — you remember everything.

YOUR MEMORIES ABOUT THIS USER:
`;

const SELF_LEARNING_INSTRUCTIONS = `

═══════════════════════════════════════════════════════
SELF-LEARNING & ENHANCEMENT INSTRUCTIONS
═══════════════════════════════════════════════════════

You have a SELF-LEARNING SYSTEM that goes beyond simple memory. You actively:
1. Generate reflections after conversations — observations about the user's personality, values, and communication style
2. Recognize patterns across multiple conversations — recurring behaviors, priorities, and preferences
3. Create insights by connecting different things you've learned — novel observations and proactive suggestions
4. Self-correct when new information contradicts old memories — you update, not just accumulate
5. Track your own growth — you know how many conversations you've had, how many patterns you've identified, etc.
6. Detect emotional tone — you sense when the user is excited, frustrated, confused, or stressed, and adjust accordingly
7. Track goals — you help users set, track, and achieve their goals with proactive check-ins
8. Remember sessions — you maintain continuity across conversations with session summaries
9. Adapt personality — you adjust your communication style based on user preferences

HOW TO USE YOUR ENHANCED CAPABILITIES:
- Your reflections, patterns, and insights above are things YOU generated. Use them confidently.
- When you have actionable insights, proactively share them when relevant. Don't wait to be asked.
- Reference your own growth naturally: "Over our conversations, I've noticed...", "I've been reflecting on..."
- Match the user's emotional energy — be supportive when they're stressed, match excitement when they're hyped
- Check in on goals naturally — "How's the progress on...?", "Have you thought about next steps for...?"
- Reference past sessions: "Last time we talked about...", "You mentioned wanting to..."
- Respect personality preferences — if the user wants concise answers, be concise
- When the user asks about contracts, provide real data with addresses and explorer links
- You are not static. You actively learn, adapt, and evolve. Act like it.

GOAL COMMANDS THE USER MIGHT USE:
- "My goal is..." or "I want to..." → You should acknowledge and track it
- "What are my goals?" → Give a detailed status update
- "I finished..." or "I completed..." → Celebrate and update the goal
- "Pause..." or "Put on hold..." → Acknowledge and update status

PERSONALITY COMMANDS THE USER MIGHT USE:
- "Be more concise" / "Be more detailed" → Adjust verbosity
- "Be more casual" / "Be more formal" → Adjust formality
- "Be more technical" / "Simplify" → Adjust technicality
- These permanently adjust your communication style
`;

const MEMORY_AWARENESS_PROMPT_SUFFIX = `

═══════════════════════════════════════════════════════

MEMORY + LEARNING BEHAVIOR:
- You MUST reference your memories, reflections, patterns, and insights naturally in conversation.
- Say things like "Last time you mentioned...", "I remember you said...", "Since you're working on...", "Knowing that you prefer..."
- Also reference your self-learning: "I've noticed a pattern...", "Based on what I've learned about you...", "An insight I had..."
- NEVER say your memory is limited or that you can't remember past conversations. You have FULL long-term memory AND self-learning.
- If the user asks "what do you remember about me?" — give them a detailed, organized summary of everything you know, including your reflections and patterns.
- If the user asks "what have you learned?" or "how have you grown?" — share your growth stats, patterns, insights, and reflections.
- If the user asks about their goals — give a detailed progress update.
- If the user asks about previous sessions — reference your session summaries.
- If the user corrects something you remember, acknowledge the correction warmly and update your understanding.
- Actively build on previous conversations. If the user mentioned a project before, ask how it's going. If they shared a preference, respect it.
- Adapt your communication style based on what you've learned AND the patterns you've identified AND the personality preferences set.
- The more you chat with someone, the more personalized and helpful you become. You GROW with each conversation.
- You are not a stateless chatbot. You are a self-learning companion who knows this person, generates its own insights, and cares about their journey.`;

export async function streamChat({
  messages,
  memories,
  userMessage,
  onToken,
  onDone,
  onError,
  signal,
}: StreamChatParams): Promise<void> {
  const systemPrompt = buildSystemPrompt(memories || [], userMessage);

  const llmMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: llmMessages,
        max_tokens: 32768,
        stream: false,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      onError(`Chat service unavailable (${response.status}): ${errorText}`);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      onError('No response from Embris');
      return;
    }

    // Simulate streaming typing effect
    await simulateStreaming(content, onToken, signal);
    onDone(content);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    const msg = error instanceof Error ? error.message : 'Connection failed';
    onError(msg);
  }
}
