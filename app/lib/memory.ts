/**
 * Embris Memory System — Enhanced browser localStorage-based persistence.
 *
 * Features:
 * - Categorized memories (preferences, projects, decisions, facts, style, relationships)
 * - AI-powered memory extraction via LLM after each exchange
 * - Deduplication and relevance scoring
 * - Full memory retrieval formatted for system prompt injection
 * - Memory recall for user queries ("what do you remember about me?")
 */

const MEMORY_KEY = 'embris_memories_v2';
const LEGACY_MEMORY_KEY = 'ember_memories';
const CHAT_HISTORY_KEY = 'ember_chat_history';

export type MemoryCategory =
  | 'user_preferences'
  | 'project_details'
  | 'decisions'
  | 'important_facts'
  | 'communication_style'
  | 'relationships'
  | 'general';

export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  timestamp: number;
  source: 'regex' | 'ai' | 'manual';
  type: 'fact' | 'preference' | 'context';
  confidence: number; // 0-1
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/* ── Storage helpers ── */

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function storageRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/* ── Category labels for display ── */

export const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  user_preferences: 'Preferences & Personality',
  project_details: 'Project Details',
  decisions: 'Decisions & Choices',
  important_facts: 'Important Facts',
  communication_style: 'Communication Style',
  relationships: 'Relationships & People',
  general: 'General',
};

/* ── Migrate legacy memories ── */

function migrateLegacyMemories(): void {
  const legacy = storageGet(LEGACY_MEMORY_KEY);
  if (!legacy) return;
  try {
    const oldMems = JSON.parse(legacy) as Array<{ id: string; content: string; timestamp: number; type: string }>;
    const existing = getMemories();
    if (existing.length === 0 && oldMems.length > 0) {
      const migrated: Memory[] = oldMems.map((m) => ({
        id: m.id,
        content: m.content,
        category: categorizeByContent(m.content),
        timestamp: m.timestamp,
        source: 'regex' as const,
        type: (m.type || 'fact') as 'fact' | 'preference' | 'context',
        confidence: 0.6,
      }));
      saveMemories(migrated);
    }
  } catch { /* ignore migration errors */ }
}

/* ── Content-based categorization ── */

function categorizeByContent(content: string): MemoryCategory {
  const lower = content.toLowerCase();

  if (/\b(prefer|like|love|hate|dislike|enjoy|favorite|want|style)\b/.test(lower)) {
    return 'user_preferences';
  }
  if (/\b(vaultfire|contract|protocol|erc-?8004|blockchain|bridge|deploy|token|smart contract|project|building|working on|developing)\b/.test(lower)) {
    return 'project_details';
  }
  if (/\b(decided|chose|going with|picked|will use|plan to|going to|committed)\b/.test(lower)) {
    return 'decisions';
  }
  if (/\b(my name|i am|i'm|i work|i live|born|age|job|occupation|email|phone|address|family|wife|husband|partner|kids|children)\b/.test(lower)) {
    return 'important_facts';
  }
  if (/\b(talk|communicate|casual|formal|brief|detailed|emoji|tone|humor|serious)\b/.test(lower)) {
    return 'communication_style';
  }
  if (/\b(friend|colleague|boss|team|partner|coworker|mentor)\b/.test(lower)) {
    return 'relationships';
  }
  return 'general';
}

/* ── Regex-based extraction (fast, runs immediately) ── */

export function extractMemories(userMessage: string, _assistantResponse: string): Memory[] {
  const memories: Memory[] = [];
  const timestamp = Date.now();

  const patterns: Array<{ regex: RegExp; type: 'fact' | 'preference' | 'context' }> = [
    // Personal facts
    { regex: /(?:i am|i'm|my name is|i work|i live|i have|i'm from|i was born|my job is|i do)\s+(.+)/i, type: 'fact' },
    // Preferences
    { regex: /(?:i prefer|i like|i love|i enjoy|i want|i need|i hate|i dislike|my favorite)\s+(.+)/i, type: 'preference' },
    // Projects
    { regex: /(?:i'm building|i'm working on|my project|i'm developing|i'm creating)\s+(.+)/i, type: 'context' },
    // Decisions
    { regex: /(?:i decided|i chose|i'm going with|i'll use|i plan to|i'm going to)\s+(.+)/i, type: 'context' },
    // Possessions / details
    { regex: /(?:my (?:wallet|address|email|company|team|app|site|website) is)\s+(.+)/i, type: 'fact' },
  ];

  for (const { regex, type } of patterns) {
    const match = userMessage.match(regex);
    if (match) {
      const content = match[0].trim();
      memories.push({
        id: `mem_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
        content,
        category: categorizeByContent(content),
        timestamp,
        source: 'regex',
        type,
        confidence: 0.7,
      });
    }
  }

  return memories;
}

/* ── AI-powered memory extraction (runs in background after each exchange) ── */

const AI_EXTRACT_API_URL = 'https://api.manus.im/api/llm-proxy/v1/chat/completions';

export async function extractMemoriesWithAI(
  userMessage: string,
  assistantResponse: string,
  existingMemories: Memory[],
  apiKey: string,
): Promise<Memory[]> {
  const existingSummary = existingMemories
    .slice(-30)
    .map((m) => `- ${m.content}`)
    .join('\n');

  const extractionPrompt = `You are a memory extraction system for an AI companion called Embris. Your job is to extract key facts, preferences, and details from the conversation that should be remembered for future interactions.

EXISTING MEMORIES (avoid duplicates):
${existingSummary || '(none yet)'}

LATEST EXCHANGE:
User: ${userMessage}
Embris: ${assistantResponse}

Extract any NEW information worth remembering. For each memory, provide:
1. The fact/preference/detail in a clear, concise sentence
2. A category: user_preferences, project_details, decisions, important_facts, communication_style, relationships, or general
3. A confidence score from 0.5 to 1.0

Rules:
- Only extract genuinely useful information about the USER (not general knowledge)
- Don't duplicate existing memories — if something is already known, skip it
- Prefer specific facts over vague statements
- Note communication style observations (e.g., "User communicates casually", "User likes detailed explanations")
- If the user corrects previous information, note the correction
- If nothing new is worth remembering, return an empty array

Respond ONLY with a JSON array (no markdown, no explanation):
[{"content": "...", "category": "...", "confidence": 0.8}]

If nothing to extract, respond with: []`;

  try {
    const response = await fetch(AI_EXTRACT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: [
          { role: 'system', content: 'You extract structured memories from conversations. Respond only with valid JSON arrays.' },
          { role: 'user', content: extractionPrompt },
        ],
        max_tokens: 1024,
        temperature: 0.3,
        stream: false,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return [];

    // Parse JSON — handle possible markdown wrapping
    let cleaned = raw;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    const timestamp = Date.now();
    return parsed
      .filter((item: { content?: string; category?: string; confidence?: number }) =>
        item.content && typeof item.content === 'string' && item.content.length > 3
      )
      .map((item: { content: string; category: string; confidence: number }) => ({
        id: `mem_ai_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
        content: item.content,
        category: (item.category || 'general') as MemoryCategory,
        timestamp,
        source: 'ai' as const,
        type: 'fact' as const,
        confidence: Math.min(1, Math.max(0.5, item.confidence || 0.7)),
      }));
  } catch {
    return [];
  }
}

/* ── Deduplication ── */

export function deduplicateMemories(memories: Memory[]): Memory[] {
  const seen = new Map<string, Memory>();

  for (const mem of memories) {
    // Normalize for comparison
    const key = mem.content.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    if (seen.has(key)) {
      // Keep the one with higher confidence or more recent timestamp
      const existing = seen.get(key)!;
      if (mem.confidence > existing.confidence || mem.timestamp > existing.timestamp) {
        seen.set(key, mem);
      }
    } else {
      // Check for substring matches
      let isDuplicate = false;
      for (const [existingKey] of seen.entries()) {
        if (key.includes(existingKey) || existingKey.includes(key)) {
          // Keep the longer, more detailed one
          if (key.length > existingKey.length) {
            seen.delete(existingKey);
            seen.set(key, mem);
          }
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        seen.set(key, mem);
      }
    }
  }

  return Array.from(seen.values());
}

/* ── Memory persistence ── */

export function saveMemories(memories: Memory[]): void {
  const deduped = deduplicateMemories(memories);
  // Keep max 200 memories, prioritize high confidence and recent
  const sorted = deduped.sort((a, b) => {
    const scoreA = a.confidence * 0.4 + (a.timestamp / Date.now()) * 0.6;
    const scoreB = b.confidence * 0.4 + (b.timestamp / Date.now()) * 0.6;
    return scoreB - scoreA;
  });
  const trimmed = sorted.slice(0, 200);
  storageSet(MEMORY_KEY, JSON.stringify(trimmed));
}

export function getMemories(): Memory[] {
  // Try new key first, then migrate legacy
  const raw = storageGet(MEMORY_KEY);
  if (!raw) {
    migrateLegacyMemories();
    const migrated = storageGet(MEMORY_KEY);
    if (!migrated) return [];
    try { return JSON.parse(migrated) as Memory[]; } catch { return []; }
  }
  try { return JSON.parse(raw) as Memory[]; } catch { return []; }
}

export function getAllMemories(): Memory[] {
  return getMemories();
}

/* ── Format memories for system prompt injection ── */

export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) return '';

  const grouped: Record<MemoryCategory, Memory[]> = {
    user_preferences: [],
    project_details: [],
    decisions: [],
    important_facts: [],
    communication_style: [],
    relationships: [],
    general: [],
  };

  for (const mem of memories) {
    const cat = mem.category || 'general';
    if (grouped[cat]) {
      grouped[cat].push(mem);
    } else {
      grouped.general.push(mem);
    }
  }

  const sections: string[] = [];

  for (const [category, mems] of Object.entries(grouped)) {
    if (mems.length === 0) continue;
    const label = CATEGORY_LABELS[category as MemoryCategory] || category;
    const items = mems.map((m) => `  - ${m.content}`).join('\n');
    sections.push(`[${label}]\n${items}`);
  }

  return sections.join('\n\n');
}

/* ── Format memories for user recall ("what do you remember?") ── */

export function formatMemoriesForRecall(memories: Memory[]): string {
  if (memories.length === 0) {
    return "I don't have any memories saved yet. As we chat more, I'll start remembering things about you!";
  }

  const grouped: Record<MemoryCategory, Memory[]> = {
    user_preferences: [],
    project_details: [],
    decisions: [],
    important_facts: [],
    communication_style: [],
    relationships: [],
    general: [],
  };

  for (const mem of memories) {
    const cat = mem.category || 'general';
    if (grouped[cat]) grouped[cat].push(mem);
    else grouped.general.push(mem);
  }

  const sections: string[] = [];
  for (const [category, mems] of Object.entries(grouped)) {
    if (mems.length === 0) continue;
    const label = CATEGORY_LABELS[category as MemoryCategory];
    sections.push(`**${label}:**\n${mems.map((m) => `- ${m.content}`).join('\n')}`);
  }

  return `Here's what I remember about you:\n\n${sections.join('\n\n')}\n\nI'm always learning more about you as we talk!`;
}

/* ── Chat history ── */

export function saveChatHistory(messages: ChatMessage[]): void {
  const trimmed = messages.slice(-100);
  storageSet(CHAT_HISTORY_KEY, JSON.stringify(trimmed));
}

export function getChatHistory(): ChatMessage[] {
  const raw = storageGet(CHAT_HISTORY_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as ChatMessage[]; } catch { return []; }
}

export function clearChatHistory(): void {
  storageRemove(CHAT_HISTORY_KEY);
}

export function clearMemories(): void {
  storageRemove(MEMORY_KEY);
  storageRemove(LEGACY_MEMORY_KEY);
}

export function clearAllMemories(): void {
  storageRemove(MEMORY_KEY);
  storageRemove(LEGACY_MEMORY_KEY);
  storageRemove(CHAT_HISTORY_KEY);
}

/* ── Sync / Export / Import ── */

import type { Reflection, Pattern, Insight, GrowthStats } from './self-learning';
import { exportAllData, importAllData, type EnhancedSyncData } from './enhanced-export';

// Legacy SyncData type for backward compatibility
export interface SyncData {
  version: number;
  exportedAt: string;
  chatHistory?: ChatMessage[];
  memories?: Memory[];
  walletAddress?: string;
  selfLearning?: {
    reflections?: Reflection[];
    patterns?: Pattern[];
    insights?: Insight[];
    growth?: GrowthStats;
  };
}

// Enhanced export — includes all new data types
export function exportData(): EnhancedSyncData {
  return exportAllData();
}

// Enhanced import — handles both legacy and new formats
export function importData(data: SyncData | EnhancedSyncData): void {
  // Use enhanced import which handles all data types
  importAllData(data as EnhancedSyncData);
}
