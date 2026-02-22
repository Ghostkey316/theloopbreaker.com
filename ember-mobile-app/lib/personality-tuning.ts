/**
 * Embris Personality Tuning System (Mobile)
 * Adjusts Embris communication style based on user preferences.
 * Uses AsyncStorage for persistence.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const PERSONALITY_KEY = "@embris_personality_v1";

export interface PersonalitySettings {
  verbosity: "concise" | "balanced" | "detailed";
  formality: "casual" | "balanced" | "formal";
  technicality: "simple" | "balanced" | "technical";
  warmth: "professional" | "balanced" | "warm";
}

const DEFAULT_PERSONALITY: PersonalitySettings = {
  verbosity: "balanced",
  formality: "balanced",
  technicality: "balanced",
  warmth: "warm",
};

export async function getPersonality(): Promise<PersonalitySettings> {
  try {
    const data = await AsyncStorage.getItem(PERSONALITY_KEY);
    return data ? { ...DEFAULT_PERSONALITY, ...JSON.parse(data) } : DEFAULT_PERSONALITY;
  } catch {
    return DEFAULT_PERSONALITY;
  }
}

export async function updatePersonality(
  updates: Partial<PersonalitySettings>
): Promise<PersonalitySettings> {
  const current = await getPersonality();
  const updated = { ...current, ...updates };
  await AsyncStorage.setItem(PERSONALITY_KEY, JSON.stringify(updated));
  return updated;
}

export function formatPersonalityForPrompt(): string {
  return "";
}

export async function formatPersonalityForPromptAsync(): Promise<string> {
  const personality = await getPersonality();

  const isDefault =
    personality.verbosity === "balanced" &&
    personality.formality === "balanced" &&
    personality.technicality === "balanced" &&
    personality.warmth === "warm";

  if (isDefault) return "";

  let block = `\n\n═══ PERSONALITY PREFERENCES ═══\n`;
  block += `Verbosity: ${personality.verbosity}\n`;
  block += `Formality: ${personality.formality}\n`;
  block += `Technicality: ${personality.technicality}\n`;
  block += `Warmth: ${personality.warmth}\n`;

  const instructions: string[] = [];
  if (personality.verbosity === "concise") instructions.push("Keep responses brief and to the point.");
  if (personality.verbosity === "detailed") instructions.push("Provide thorough, detailed explanations.");
  if (personality.formality === "casual") instructions.push("Use a casual, friendly tone.");
  if (personality.formality === "formal") instructions.push("Use a professional, formal tone.");
  if (personality.technicality === "simple") instructions.push("Avoid jargon, explain simply.");
  if (personality.technicality === "technical") instructions.push("Use technical terminology freely.");

  if (instructions.length > 0) {
    block += `Instructions: ${instructions.join(" ")}\n`;
  }

  return block;
}
