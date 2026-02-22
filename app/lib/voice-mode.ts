/**
 * Embris Voice Mode — Enhanced Two-Way Voice Conversation
 *
 * Speech-to-text input via SpeechRecognition
 * Text-to-speech output via SpeechSynthesis with auto-speak
 * Adjustable rate/pitch, voice selection, interruption support
 * No external APIs — uses built-in browser APIs.
 */

const VOICE_MODE_KEY = 'embris_voice_mode_v1';
const VOICE_RATE_KEY = 'embris_voice_rate_v1';
const VOICE_PITCH_KEY = 'embris_voice_pitch_v1';
const VOICE_NAME_KEY = 'embris_voice_name_v1';

/* ── Web Speech API type declarations ── */
/* eslint-disable @typescript-eslint/no-empty-interface */
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
export interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/* ── Types ── */

export interface VoiceModeState {
  enabled: boolean;
  ttsEnabled: boolean;
  listening: boolean;
  speaking: boolean;
  rate: number;
  pitch: number;
}

export interface VoiceInfo {
  name: string;
  lang: string;
  isNatural: boolean;
}

/* ── Storage ── */

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/* ── Voice Mode Preference ── */

export function getVoiceModeEnabled(): boolean {
  return storageGet(VOICE_MODE_KEY) === 'true';
}

export function setVoiceModeEnabled(enabled: boolean): void {
  storageSet(VOICE_MODE_KEY, enabled ? 'true' : 'false');
}

/* ── Voice Settings ── */

export function getVoiceRate(): number {
  const val = storageGet(VOICE_RATE_KEY);
  return val ? parseFloat(val) : 1.0;
}

export function setVoiceRate(rate: number): void {
  storageSet(VOICE_RATE_KEY, String(Math.max(0.5, Math.min(2.0, rate))));
}

export function getVoicePitch(): number {
  const val = storageGet(VOICE_PITCH_KEY);
  return val ? parseFloat(val) : 1.0;
}

export function setVoicePitch(pitch: number): void {
  storageSet(VOICE_PITCH_KEY, String(Math.max(0.5, Math.min(2.0, pitch))));
}

export function getPreferredVoiceName(): string | null {
  return storageGet(VOICE_NAME_KEY);
}

export function setPreferredVoiceName(name: string): void {
  storageSet(VOICE_NAME_KEY, name);
}

/* ── Speech Recognition (STT) ── */

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  );
}

export function createSpeechRecognition(): SpeechRecognitionInstance | null {
  if (typeof window === 'undefined') return null;
  const SpeechRecognitionClass =
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  if (!SpeechRecognitionClass) return null;

  const recognition = new (SpeechRecognitionClass as new () => SpeechRecognitionInstance)();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;
  return recognition;
}

/* ── Speech Synthesis (TTS) ── */

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.speechSynthesis;
}

/**
 * Get available voices, sorted by quality preference.
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Pick the best available voice for Embris.
 * Priority: saved preference > Google en voices > Microsoft en voices > other en voices
 */
export function selectBestVoice(): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  if (voices.length === 0) return null;

  // Check for saved preference
  const savedName = getPreferredVoiceName();
  if (savedName) {
    const saved = voices.find(v => v.name === savedName);
    if (saved) return saved;
  }

  // Priority ranking for natural-sounding voices
  const googleEn = voices.find(v =>
    v.name.includes('Google') && v.lang.startsWith('en') && v.name.includes('US')
  ) || voices.find(v =>
    v.name.includes('Google') && v.lang.startsWith('en')
  );
  if (googleEn) return googleEn;

  const microsoftEn = voices.find(v =>
    (v.name.includes('Microsoft') || v.name.includes('Edge')) &&
    v.lang.startsWith('en') &&
    (v.name.includes('Natural') || v.name.includes('Online'))
  ) || voices.find(v =>
    (v.name.includes('Microsoft') || v.name.includes('Edge')) && v.lang.startsWith('en')
  );
  if (microsoftEn) return microsoftEn;

  // Apple voices
  const appleEn = voices.find(v =>
    (v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Daniel') || v.name.includes('Alex'))
  );
  if (appleEn) return appleEn;

  // Any English voice
  return voices.find(v => v.lang.startsWith('en')) || voices[0];
}

/**
 * Clean markdown from text for natural speech.
 */
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'code block')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/---/g, '')
    .replace(/>/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Track current speaking state for callbacks
let currentOnSpeakEnd: (() => void) | null = null;
let currentOnSpeakStart: (() => void) | null = null;

/**
 * Speak text with enhanced voice settings.
 * Supports callbacks for speaking start/end to drive UI animations.
 */
export function speakText(
  text: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    rate?: number;
    pitch?: number;
  }
): void {
  if (!isSpeechSynthesisSupported()) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    options?.onEnd?.();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = options?.rate ?? getVoiceRate();
  utterance.pitch = options?.pitch ?? getVoicePitch();
  utterance.volume = 1.0;

  // Select best voice
  const voice = selectBestVoice();
  if (voice) utterance.voice = voice;

  currentOnSpeakEnd = options?.onEnd ?? null;
  currentOnSpeakStart = options?.onStart ?? null;

  utterance.onstart = () => {
    currentOnSpeakStart?.();
  };

  utterance.onend = () => {
    currentOnSpeakEnd?.();
    currentOnSpeakEnd = null;
    currentOnSpeakStart = null;
  };

  utterance.onerror = () => {
    currentOnSpeakEnd?.();
    currentOnSpeakEnd = null;
    currentOnSpeakStart = null;
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Legacy speakText signature for backward compatibility.
 */
export function speakTextSimple(text: string, onEnd?: () => void): void {
  speakText(text, { onEnd });
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
    currentOnSpeakEnd?.();
    currentOnSpeakEnd = null;
    currentOnSpeakStart = null;
  }
}

export function isSpeaking(): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  return window.speechSynthesis.speaking;
}

/**
 * Preload voices — some browsers need a small delay to populate the voice list.
 */
export function preloadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      resolve([]);
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    // Wait for voiceschanged event
    const handler = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    // Fallback timeout
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
  });
}
