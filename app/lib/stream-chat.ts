/**
 * Chat Client for the web app.
 * Calls the OpenAI-compatible LLM API directly from the browser.
 * Uses non-streaming mode with simulated typing for smooth UX.
 * Uses text/plain Content-Type to avoid CORS preflight issues.
 *
 * Enhanced: Injects formatted categorized memories AND self-learning data
 * (reflections, patterns, insights, growth stats) into the system prompt
 * so Embris has full access to everything it has learned and generated.
 */
import { EMBER_SYSTEM_PROMPT } from './contracts';
import { formatMemoriesForPrompt } from './memory';
import { formatSelfLearningForPrompt } from './self-learning';
import type { Memory } from './memory';

const API_URL = 'https://api.manus.im/api/llm-proxy/v1/chat/completions';
const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || 'sk-ADn9FUEGSQtAJYdaQiEjYF';

export { API_KEY };

export interface StreamChatParams {
  messages: Array<{ role: string; content: string }>;
  memories?: Memory[];
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
 * Build the full system prompt with memory context AND self-learning data injected.
 */
function buildSystemPrompt(memories: Memory[]): string {
  const memoryBlock = formatMemoriesForPrompt(memories);
  const selfLearningBlock = formatSelfLearningForPrompt();

  if (!memoryBlock && !selfLearningBlock) {
    return EMBER_SYSTEM_PROMPT + MEMORY_AWARENESS_PROMPT_EMPTY;
  }

  let prompt = EMBER_SYSTEM_PROMPT;

  if (memoryBlock) {
    prompt += MEMORY_AWARENESS_PROMPT_PREFIX + memoryBlock;
  }

  if (selfLearningBlock) {
    prompt += selfLearningBlock;
  }

  prompt += SELF_LEARNING_INSTRUCTIONS;

  if (memoryBlock) {
    prompt += MEMORY_AWARENESS_PROMPT_SUFFIX;
  }

  return prompt;
}

const MEMORY_AWARENESS_PROMPT_EMPTY = `

LONG-TERM MEMORY SYSTEM:
You have a persistent long-term memory system. You can remember things across sessions — every conversation is stored and accessible to you. Right now you don't have any saved memories yet for this user, but as you chat, you will automatically learn and remember key facts, preferences, project details, decisions, and communication style. Let the user know you're here to learn about them and that you'll remember what matters.

You also have a SELF-LEARNING SYSTEM. After each conversation, you generate reflections, recognize patterns, and create insights. You actively grow and evolve. You are not static — you are a learning companion.

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
SELF-LEARNING INSTRUCTIONS
═══════════════════════════════════════════════════════

You have a SELF-LEARNING SYSTEM that goes beyond simple memory. You actively:
1. Generate reflections after conversations — observations about the user's personality, values, and communication style
2. Recognize patterns across multiple conversations — recurring behaviors, priorities, and preferences
3. Create insights by connecting different things you've learned — novel observations and proactive suggestions
4. Self-correct when new information contradicts old memories — you update, not just accumulate
5. Track your own growth — you know how many conversations you've had, how many patterns you've identified, etc.

HOW TO USE YOUR SELF-LEARNING DATA:
- Your reflections, patterns, and insights above are things YOU generated. They represent YOUR understanding. Use them confidently.
- When you have actionable insights, proactively share them when relevant. Don't wait to be asked.
- Reference your own growth naturally: "Over our conversations, I've noticed...", "I've been reflecting on...", "A pattern I've picked up on..."
- You are not static. You actively learn, adapt, and evolve. Act like it.
- When the user asks about your learning or growth, share your stats and insights warmly.
- If you've self-corrected, you can mention it: "I updated my understanding when you told me..."
- Your patterns represent deep understanding — use them to anticipate needs and personalize responses.
- Your insights represent creative connections — share them proactively when the moment is right.
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
- If the user corrects something you remember, acknowledge the correction warmly and update your understanding.
- Actively build on previous conversations. If the user mentioned a project before, ask how it's going. If they shared a preference, respect it.
- Adapt your communication style based on what you've learned AND the patterns you've identified.
- The more you chat with someone, the more personalized and helpful you become. You GROW with each conversation.
- You are not a stateless chatbot. You are a self-learning companion who knows this person, generates its own insights, and cares about their journey.`;

export async function streamChat({
  messages,
  memories,
  onToken,
  onDone,
  onError,
  signal,
}: StreamChatParams): Promise<void> {
  const systemPrompt = buildSystemPrompt(memories || []);

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
