/**
 * Embris Proactive Suggestions System (Mobile)
 * Generates contextual suggestions based on user behavior.
 * Uses AsyncStorage for persistence.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const SUGGESTIONS_KEY = "@embris_suggestions_v1";

export interface Suggestion {
  id: string;
  content: string;
  type: "tip" | "reminder" | "insight" | "action";
  priority: "low" | "medium" | "high";
  dismissed: boolean;
  timestamp: number;
}

export async function getSuggestions(): Promise<Suggestion[]> {
  try {
    const data = await AsyncStorage.getItem(SUGGESTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addSuggestion(
  content: string,
  type: Suggestion["type"] = "tip",
  priority: Suggestion["priority"] = "medium"
): Promise<void> {
  const suggestions = await getSuggestions();
  suggestions.push({
    id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    content,
    type,
    priority,
    dismissed: false,
    timestamp: Date.now(),
  });
  await AsyncStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(suggestions.slice(-20)));
}

export async function dismissSuggestion(id: string): Promise<void> {
  const suggestions = await getSuggestions();
  const suggestion = suggestions.find((s) => s.id === id);
  if (suggestion) {
    suggestion.dismissed = true;
    await AsyncStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(suggestions));
  }
}

export function formatSuggestionsContext(): string {
  return "";
}

export async function formatSuggestionsContextAsync(): Promise<string> {
  const suggestions = await getSuggestions();
  const active = suggestions.filter((s) => !s.dismissed);
  if (active.length === 0) return "";

  let block = `\n\n═══ PROACTIVE SUGGESTIONS ═══\n`;
  block += `You have ${active.length} active suggestion(s) to potentially share:\n`;
  active.slice(-5).forEach((s) => {
    block += `- [${s.type}/${s.priority}] ${s.content}\n`;
  });

  return block;
}
