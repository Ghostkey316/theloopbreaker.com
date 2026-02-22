/**
 * Embris Self-Learning System (Mobile)
 * Generates reflections, patterns, and insights from conversations.
 * Uses AsyncStorage for persistence.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const REFLECTIONS_KEY = "@embris_reflections_v1";
const PATTERNS_KEY = "@embris_patterns_v1";
const INSIGHTS_KEY = "@embris_insights_v1";
const STATS_KEY = "@embris_learning_stats_v1";

export interface Reflection {
  id: string;
  content: string;
  timestamp: number;
  category: "personality" | "values" | "communication" | "interests" | "behavior";
}

export interface Pattern {
  id: string;
  description: string;
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  category: string;
}

export interface Insight {
  id: string;
  content: string;
  timestamp: number;
  basedOn: string[];
}

export interface LearningStats {
  totalConversations: number;
  totalReflections: number;
  totalPatterns: number;
  totalInsights: number;
  lastLearningSession: number;
}

async function storageGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

async function storageSet(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

export async function getReflections(): Promise<Reflection[]> {
  return storageGet<Reflection[]>(REFLECTIONS_KEY, []);
}

export async function getPatterns(): Promise<Pattern[]> {
  return storageGet<Pattern[]>(PATTERNS_KEY, []);
}

export async function getInsights(): Promise<Insight[]> {
  return storageGet<Insight[]>(INSIGHTS_KEY, []);
}

export async function getLearningStats(): Promise<LearningStats> {
  return storageGet<LearningStats>(STATS_KEY, {
    totalConversations: 0,
    totalReflections: 0,
    totalPatterns: 0,
    totalInsights: 0,
    lastLearningSession: 0,
  });
}

export async function generateReflection(
  userMessage: string,
  assistantResponse: string
): Promise<Reflection | null> {
  const categories: Array<{ pattern: RegExp; category: Reflection["category"] }> = [
    { pattern: /(?:i am|i'm|my name|i work|i live)/i, category: "personality" },
    { pattern: /(?:i believe|i think|important to me|i value)/i, category: "values" },
    { pattern: /(?:i prefer|i like|i want|can you|please)/i, category: "communication" },
    { pattern: /(?:interested in|learning about|working on|building)/i, category: "interests" },
    { pattern: /(?:always|usually|every time|i tend to)/i, category: "behavior" },
  ];

  for (const { pattern, category } of categories) {
    if (pattern.test(userMessage)) {
      const reflection: Reflection = {
        id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        content: `User expressed: ${userMessage.slice(0, 200)}`,
        timestamp: Date.now(),
        category,
      };

      const reflections = await getReflections();
      reflections.push(reflection);
      await storageSet(REFLECTIONS_KEY, reflections.slice(-50));

      const stats = await getLearningStats();
      stats.totalReflections++;
      stats.lastLearningSession = Date.now();
      await storageSet(STATS_KEY, stats);

      return reflection;
    }
  }
  return null;
}

export async function updatePatterns(userMessage: string): Promise<void> {
  const patterns = await getPatterns();
  const topicPatterns: Array<{ pattern: RegExp; category: string }> = [
    { pattern: /(?:contract|blockchain|on-chain|web3)/i, category: "blockchain" },
    { pattern: /(?:goal|plan|target|milestone)/i, category: "goal-oriented" },
    { pattern: /(?:help|assist|guide|explain)/i, category: "help-seeking" },
    { pattern: /(?:build|create|develop|code)/i, category: "builder" },
  ];

  for (const { pattern, category } of topicPatterns) {
    if (pattern.test(userMessage)) {
      const existing = patterns.find((p) => p.category === category);
      if (existing) {
        existing.occurrences++;
        existing.lastSeen = Date.now();
      } else {
        patterns.push({
          id: `pat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          description: `User frequently discusses ${category} topics`,
          occurrences: 1,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          category,
        });
      }
    }
  }

  await storageSet(PATTERNS_KEY, patterns.slice(-30));
  const stats = await getLearningStats();
  stats.totalPatterns = patterns.length;
  await storageSet(STATS_KEY, stats);
}

export async function recordConversation(): Promise<void> {
  const stats = await getLearningStats();
  stats.totalConversations++;
  stats.lastLearningSession = Date.now();
  await storageSet(STATS_KEY, stats);
}

export function formatSelfLearningForPrompt(): string {
  // This is a sync version that returns empty - the async version is used in the enhanced stream-chat
  return "";
}

export async function formatSelfLearningForPromptAsync(): Promise<string> {
  const [reflections, patterns, insights, stats] = await Promise.all([
    getReflections(),
    getPatterns(),
    getInsights(),
    getLearningStats(),
  ]);

  if (reflections.length === 0 && patterns.length === 0) return "";

  let block = `\n\n═══ SELF-LEARNING DATA ═══\nConversations: ${stats.totalConversations} | Reflections: ${stats.totalReflections} | Patterns: ${stats.totalPatterns}\n`;

  if (reflections.length > 0) {
    block += "\nREFLECTIONS:\n";
    reflections.slice(-10).forEach((r) => {
      block += `- [${r.category}] ${r.content}\n`;
    });
  }

  if (patterns.length > 0) {
    block += "\nPATTERNS:\n";
    patterns.forEach((p) => {
      block += `- ${p.description} (seen ${p.occurrences}x)\n`;
    });
  }

  if (insights.length > 0) {
    block += "\nINSIGHTS:\n";
    insights.slice(-5).forEach((i) => {
      block += `- ${i.content}\n`;
    });
  }

  return block;
}
