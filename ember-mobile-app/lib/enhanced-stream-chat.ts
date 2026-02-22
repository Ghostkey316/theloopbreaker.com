/**
 * Enhanced Stream Chat Client for Mobile
 * Direct LLM API calls with full Embris intelligence modules.
 * Mirrors the web app's stream-chat.ts with all enhancement data injected.
 */

import { EMBRIS_SYSTEM_PROMPT } from "@/constants/contracts";
import { formatContractDataForPrompt } from "./knowledge-base";
import { formatSelfLearningForPromptAsync } from "./self-learning";
import { formatEmotionalContextForPromptAsync } from "./emotional-intelligence";
import { formatGoalsForPromptAsync } from "./goal-tracking";
import { formatPersonalityForPromptAsync } from "./personality-tuning";
import { formatSessionSummariesForPromptAsync } from "./conversation-summaries";
import { formatSuggestionsContextAsync } from "./proactive-suggestions";
import { isRegistered, getRegisteredWalletAddress, shouldNudgeRegistration } from "./registration";
import AsyncStorage from "@react-native-async-storage/async-storage";

async function getVNSName(): Promise<string> {
  return (await AsyncStorage.getItem('vaultfire_vns_name')) || '';
}

async function getCompanionName(): Promise<string> {
  return (await AsyncStorage.getItem('vaultfire_companion_name')) || 'Embris';
}

const API_URL = "https://api.manus.im/api/llm-proxy/v1/chat/completions";
const API_KEY = "sk-ADn9FUEGSQtAJYdaQiEjYF";

export interface EnhancedStreamChatParams {
  messages: Array<{ role: string; content: string }>;
  memories?: string[];
  userMessage?: string;
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
}

async function simulateStreaming(
  text: string,
  onToken: (token: string) => void
): Promise<void> {
  const words = text.split(/(\s+)/);
  for (const word of words) {
    onToken(word);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function buildSystemPrompt(
  memories: string[],
  userMessage?: string
): Promise<string> {
  const registered = await isRegistered();

  if (!registered) {
    return buildUnregisteredPrompt(memories, userMessage);
  }

  return buildRegisteredPrompt(memories, userMessage);
}

async function buildUnregisteredPrompt(
  memories: string[],
  userMessage?: string
): Promise<string> {
  const nudge = await shouldNudgeRegistration();
  const contractBlock = userMessage ? formatContractDataForPrompt(userMessage) : "";

  let prompt = EMBRIS_SYSTEM_PROMPT;

  prompt += `

═══ REGISTRATION STATUS: UNREGISTERED — BASIC MODE ═══

This user has NOT registered on-chain yet. You are operating in BASIC MODE.

In basic mode:
- You can have normal conversations and answer questions
- You have full knowledge of Vaultfire contracts and the protocol
- You do NOT have access to long-term memory
- You do NOT have self-learning, goal tracking, personality tuning, or session continuity
- You are still warm, friendly, and helpful — just without your full capabilities

IMPORTANT: Be your normal friendly self — don't make basic mode feel punishing.`;

  if (nudge) {
    prompt += `

REGISTRATION NUDGE: Naturally mention that registering on-chain unlocks memory, goals, personality, and a full companion experience.`;
  }

  if (contractBlock) prompt += contractBlock;

  return prompt;
}

async function buildRegisteredPrompt(
  memories: string[],
  userMessage?: string
): Promise<string> {
  const walletAddress = await getRegisteredWalletAddress();
  const vnsName = await getVNSName();
  const companionName = await getCompanionName();

  // Fetch all enhancement data in parallel
  const [selfLearning, emotional, goals, personality, sessions, suggestions] =
    await Promise.all([
      formatSelfLearningForPromptAsync(),
      formatEmotionalContextForPromptAsync(),
      formatGoalsForPromptAsync(),
      formatPersonalityForPromptAsync(),
      formatSessionSummariesForPromptAsync(),
      formatSuggestionsContextAsync(),
    ]);

  const contractBlock = userMessage ? formatContractDataForPrompt(userMessage) : "";

  let prompt = EMBRIS_SYSTEM_PROMPT;

  prompt += `

═══ REGISTRATION STATUS ═══
User is REGISTERED on-chain. Wallet: ${walletAddress || "linked"}${vnsName ? ` · VNS Name: ${vnsName}` : ''}
All features are ACTIVE. You are operating at full capacity as their personal AI companion.
${companionName !== 'Embris' ? `IMPORTANT: The user has named you "${companionName}". Always respond to this name. When they say "Hey ${companionName}" or refer to you as ${companionName}, that's you. You ARE ${companionName}. Your personality and capabilities are unchanged — only your name is different.` : ''}`;

  // Memory block
  if (memories.length > 0) {
    prompt += `

═══ LONG-TERM MEMORY ═══
YOUR MEMORIES ABOUT THIS USER:
${memories.join("\n")}

MEMORY BEHAVIOR: Reference memories naturally. Say "I remember you mentioned...", "Since you're working on..."
NEVER say your memory is limited. You have FULL long-term memory.`;
  } else {
    prompt += `

LONG-TERM MEMORY SYSTEM:
You have persistent long-term memory. No memories saved yet for this user, but you will learn and remember key facts as you chat.`;
  }

  // Inject all enhancement blocks
  if (personality) prompt += personality;
  if (emotional) prompt += emotional;
  if (selfLearning) prompt += selfLearning;
  if (goals) prompt += goals;
  if (sessions) prompt += sessions;
  if (suggestions) prompt += suggestions;
  if (contractBlock) prompt += contractBlock;

  prompt += `

═══ SELF-LEARNING & ENHANCEMENT INSTRUCTIONS ═══
You have a SELF-LEARNING SYSTEM. You actively:
1. Generate reflections about the user
2. Recognize patterns across conversations
3. Create insights by connecting different things you've learned
4. Detect emotional tone and adjust accordingly
5. Track goals and help users stay on track
6. Remember sessions and maintain continuity
7. Adapt personality based on user preferences

Reference your growth naturally. You are not static — you are a learning companion.`;

  return prompt;
}

export async function enhancedStreamChat({
  messages,
  memories = [],
  userMessage,
  onToken,
  onDone,
  onError,
}: EnhancedStreamChatParams): Promise<void> {
  const systemPrompt = await buildSystemPrompt(memories, userMessage);

  const llmMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: llmMessages,
        max_tokens: 32768,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      onError(`Chat service unavailable (${response.status}): ${errorText}`);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      onError("No response from Embris");
      return;
    }

    await simulateStreaming(content, onToken);
    onDone(content);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;
    const msg = error instanceof Error ? error.message : "Connection failed";
    onError(msg);
  }
}
