/**
 * Embris Conversation Summaries System (Mobile)
 * Maintains session summaries for continuity across conversations.
 * Uses AsyncStorage for persistence.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const SUMMARIES_KEY = "@embris_session_summaries_v1";

export interface SessionSummary {
  id: string;
  summary: string;
  topics: string[];
  messageCount: number;
  timestamp: number;
}

export async function getSessionSummaries(): Promise<SessionSummary[]> {
  try {
    const data = await AsyncStorage.getItem(SUMMARIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveSessionSummary(
  messages: Array<{ role: string; content: string }>,
  topics: string[] = []
): Promise<SessionSummary> {
  const summary: SessionSummary = {
    id: `session_${Date.now()}`,
    summary: generateSummary(messages),
    topics,
    messageCount: messages.length,
    timestamp: Date.now(),
  };

  const summaries = await getSessionSummaries();
  summaries.push(summary);
  await AsyncStorage.setItem(SUMMARIES_KEY, JSON.stringify(summaries.slice(-20)));
  return summary;
}

function generateSummary(messages: Array<{ role: string; content: string }>): string {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.slice(0, 100));

  if (userMessages.length === 0) return "Empty session";
  if (userMessages.length <= 3) return `Discussed: ${userMessages.join(", ")}`;
  return `${userMessages.length} messages covering: ${userMessages.slice(0, 3).join(", ")}...`;
}

export function formatSessionSummariesForPrompt(): string {
  return "";
}

export async function formatSessionSummariesForPromptAsync(): Promise<string> {
  const summaries = await getSessionSummaries();
  if (summaries.length === 0) return "";

  let block = `\n\n═══ PREVIOUS SESSIONS ═══\n`;
  summaries.slice(-5).forEach((s) => {
    const date = new Date(s.timestamp).toLocaleDateString();
    block += `- [${date}] ${s.summary} (${s.messageCount} messages)\n`;
  });

  return block;
}
