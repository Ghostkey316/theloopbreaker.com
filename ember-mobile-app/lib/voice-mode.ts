/**
 * Embris Voice Mode (Mobile) — Enhanced Two-Way Voice Conversation
 *
 * TTS: expo-speech on native, SpeechSynthesis on web
 * STT: Web SpeechRecognition API (native STT requires additional module)
 * Auto-speak: Embris automatically speaks responses when voice mode is on
 * Adjustable rate/pitch, best voice selection, interrupt support
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const VOICE_MODE_KEY = "@embris_voice_mode_v1";
const VOICE_RATE_KEY = "@embris_voice_rate_v1";
const VOICE_PITCH_KEY = "@embris_voice_pitch_v1";

/* ── Voice Mode Preference ── */

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

/* ── Voice Settings ── */

export async function getVoiceRate(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(VOICE_RATE_KEY);
    return val ? parseFloat(val) : 1.0;
  } catch {
    return 1.0;
  }
}

export async function setVoiceRate(rate: number): Promise<void> {
  await AsyncStorage.setItem(VOICE_RATE_KEY, String(Math.max(0.5, Math.min(2.0, rate))));
}

export async function getVoicePitch(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(VOICE_PITCH_KEY);
    return val ? parseFloat(val) : 1.0;
  } catch {
    return 1.0;
  }
}

export async function setVoicePitch(pitch: number): Promise<void> {
  await AsyncStorage.setItem(VOICE_PITCH_KEY, String(Math.max(0.5, Math.min(2.0, pitch))));
}

/* ── TTS Support Check ── */

export function isTTSSupported(): boolean {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" && !!window.speechSynthesis;
  }
  // On native, expo-speech is always available if installed
  return true;
}

/* ── STT Support Check ── */

export function isSTTSupported(): boolean {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" && !!(
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    );
  }
  return false; // Native STT requires additional setup
}

/* ── Text Cleaning for Speech ── */

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
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ── Enhanced TTS with callbacks and settings ── */

/**
 * Speak text using platform TTS with enhanced options.
 * Supports onStart/onEnd callbacks for UI animations.
 */
export async function speakText(
  text: string,
  onEndOrOptions?: (() => void) | {
    onStart?: () => void;
    onEnd?: () => void;
    rate?: number;
    pitch?: number;
  },
): Promise<void> {
  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    if (typeof onEndOrOptions === "function") onEndOrOptions();
    else onEndOrOptions?.onEnd?.();
    return;
  }

  // Normalize options
  const options = typeof onEndOrOptions === "function"
    ? { onEnd: onEndOrOptions }
    : onEndOrOptions ?? {};

  const rate = options.rate ?? (await getVoiceRate());
  const pitch = options.pitch ?? (await getVoicePitch());

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1.0;

      // Select best voice
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en") && v.name.includes("US")) ||
        voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en")) ||
        voices.find((v) => (v.name.includes("Microsoft") || v.name.includes("Edge")) && v.lang.startsWith("en")) ||
        voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => options.onStart?.();
      utterance.onend = () => options.onEnd?.();
      utterance.onerror = () => options.onEnd?.();
      window.speechSynthesis.speak(utterance);
    }
  } else {
    // Native: use expo-speech
    try {
      const Speech = await import("expo-speech");
      options.onStart?.();
      await Speech.default.speak(cleanText, {
        language: "en-US",
        rate,
        pitch,
        onDone: () => options.onEnd?.(),
        onError: () => options.onEnd?.(),
      });
    } catch {
      console.warn("expo-speech not available");
      options.onEnd?.();
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

/* ── Web-only: SpeechRecognition for STT ── */

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
