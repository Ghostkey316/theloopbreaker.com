/**
 * Embris Voice Mode (Mobile)
 * Text-to-speech using expo-speech (cross-platform).
 * Speech-to-text placeholder — requires expo-speech-recognition or native module.
 * For now, TTS is fully functional; STT shows a "coming soon" message on native.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const VOICE_MODE_KEY = "@embris_voice_mode_v1";

export async function getVoiceModeEnabled(): Promise<boolean> {
  try {
    const data = await AsyncStorage.getItem(VOICE_MODE_KEY);
    return data === "true";
  } catch {
    return false;
  }
}

export async function setVoiceModeEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(VOICE_MODE_KEY, enabled ? "true" : "false");
}

/**
 * Check if TTS is available.
 * On web, uses SpeechSynthesis API.
 * On native, uses expo-speech (must be installed).
 */
export function isTTSSupported(): boolean {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" && !!window.speechSynthesis;
  }
  // On native, expo-speech is always available if installed
  return true;
}

/**
 * Check if STT is available.
 * On web, uses SpeechRecognition API.
 * On native, not yet implemented (requires native module).
 */
export function isSTTSupported(): boolean {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" && !!(
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    );
  }
  return false; // Native STT requires additional setup
}

/**
 * Clean markdown from text for natural speech.
 */
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "code block")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/---/g, "")
    .replace(/>/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .trim();
}

/**
 * Speak text using platform TTS.
 * Web: SpeechSynthesis API
 * Native: expo-speech (dynamic import)
 */
export async function speakText(text: string, onEnd?: () => void): Promise<void> {
  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) return;

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) => v.name.includes("Google") && v.lang.startsWith("en")
      ) || voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;
      if (onEnd) utterance.onend = onEnd;
      window.speechSynthesis.speak(utterance);
    }
  } else {
    // Native: use expo-speech
    try {
      const Speech = await import("expo-speech");
      await Speech.default.speak(cleanText, {
        language: "en-US",
        rate: 1.0,
        pitch: 1.0,
        onDone: onEnd,
      });
    } catch {
      console.warn("expo-speech not available");
    }
  }
}

export async function stopSpeaking(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } else {
    try {
      const Speech = await import("expo-speech");
      await Speech.default.stop();
    } catch { /* ignore */ }
  }
}

export async function isSpeaking(): Promise<boolean> {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" && window.speechSynthesis?.speaking;
  }
  try {
    const Speech = await import("expo-speech");
    return await Speech.default.isSpeakingAsync();
  } catch {
    return false;
  }
}

/**
 * Web-only: Create SpeechRecognition instance for STT.
 */
export function createWebSpeechRecognition(): unknown | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const SpeechRecognitionClass =
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  if (!SpeechRecognitionClass) return null;

  const recognition = new (SpeechRecognitionClass as new () => Record<string, unknown>)();
  (recognition as Record<string, unknown>).continuous = false;
  (recognition as Record<string, unknown>).interimResults = true;
  (recognition as Record<string, unknown>).lang = "en-US";
  (recognition as Record<string, unknown>).maxAlternatives = 1;
  return recognition;
}
