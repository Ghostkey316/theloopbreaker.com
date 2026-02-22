/**
 * Embris Emotional Intelligence System (Mobile)
 * Detects emotional tone and adjusts responses accordingly.
 * Uses AsyncStorage for persistence.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const EMOTIONAL_HISTORY_KEY = "@embris_emotional_history_v1";

export interface EmotionalState {
  mood: "positive" | "negative" | "neutral" | "excited" | "frustrated" | "curious" | "stressed";
  confidence: number;
  timestamp: number;
}

const MOOD_PATTERNS: Array<{ pattern: RegExp; mood: EmotionalState["mood"]; weight: number }> = [
  { pattern: /(?:amazing|awesome|great|love|excited|happy|wonderful|fantastic)/i, mood: "excited", weight: 0.9 },
  { pattern: /(?:good|nice|thanks|helpful|appreciate|cool)/i, mood: "positive", weight: 0.7 },
  { pattern: /(?:frustrated|annoyed|angry|hate|terrible|awful|broken)/i, mood: "frustrated", weight: 0.9 },
  { pattern: /(?:stressed|overwhelmed|worried|anxious|nervous|pressure)/i, mood: "stressed", weight: 0.8 },
  { pattern: /(?:confused|don't understand|what do you mean|unclear|lost)/i, mood: "curious", weight: 0.7 },
  { pattern: /(?:how|why|what|explain|tell me|curious|wondering|interested)/i, mood: "curious", weight: 0.5 },
  { pattern: /(?:sad|disappointed|down|unhappy|miss|lonely)/i, mood: "negative", weight: 0.8 },
];

export function detectEmotion(message: string): EmotionalState {
  let bestMood: EmotionalState["mood"] = "neutral";
  let bestWeight = 0;

  for (const { pattern, mood, weight } of MOOD_PATTERNS) {
    if (pattern.test(message) && weight > bestWeight) {
      bestMood = mood;
      bestWeight = weight;
    }
  }

  return {
    mood: bestMood,
    confidence: bestWeight || 0.5,
    timestamp: Date.now(),
  };
}

export async function recordEmotion(state: EmotionalState): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(EMOTIONAL_HISTORY_KEY);
    const history: EmotionalState[] = data ? JSON.parse(data) : [];
    history.push(state);
    await AsyncStorage.setItem(
      EMOTIONAL_HISTORY_KEY,
      JSON.stringify(history.slice(-50))
    );
  } catch { /* ignore */ }
}

export async function getEmotionalHistory(): Promise<EmotionalState[]> {
  try {
    const data = await AsyncStorage.getItem(EMOTIONAL_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function formatEmotionalContextForPrompt(): string {
  return "";
}

export async function formatEmotionalContextForPromptAsync(): Promise<string> {
  const history = await getEmotionalHistory();
  if (history.length === 0) return "";

  const recent = history.slice(-5);
  const latest = recent[recent.length - 1];

  let block = `\n\n═══ EMOTIONAL CONTEXT ═══\n`;
  block += `Current detected mood: ${latest.mood} (confidence: ${(latest.confidence * 100).toFixed(0)}%)\n`;
  block += `Recent emotional trajectory: ${recent.map((e) => e.mood).join(" → ")}\n`;

  const moodAdvice: Record<string, string> = {
    excited: "Match their energy! Be enthusiastic and supportive.",
    positive: "Keep the positive tone. Be warm and encouraging.",
    frustrated: "Be patient and empathetic. Offer clear, actionable help.",
    stressed: "Be calming and supportive. Break things into manageable steps.",
    curious: "Be thorough and educational. Encourage their curiosity.",
    negative: "Be gentle and supportive. Acknowledge their feelings.",
    neutral: "Be your normal friendly self.",
  };

  block += `Tone guidance: ${moodAdvice[latest.mood] || moodAdvice.neutral}\n`;
  return block;
}
