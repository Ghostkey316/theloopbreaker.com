/**
 * Embris Personality Tuning System
 *
 * Allows users to adjust Embris's communication style through:
 * 1. Explicit feedback ("be more concise", "talk more casually")
 * 2. Detected preferences from conversation patterns
 *
 * Personality preferences persist in localStorage and are injected
 * into the system prompt to guide response style.
 */

const PERSONALITY_KEY = 'embris_personality_v1';

/* ── Types ── */

export interface PersonalitySettings {
  // Scale from -1 to 1 where 0 is default/balanced
  formality: number;      // -1 = very casual, 0 = balanced, 1 = very formal
  verbosity: number;      // -1 = very concise, 0 = balanced, 1 = very detailed
  technicality: number;   // -1 = very simple, 0 = balanced, 1 = very technical
  humor: number;          // -1 = serious, 0 = balanced, 1 = very playful
  directness: number;     // -1 = gentle/indirect, 0 = balanced, 1 = very direct

  // Custom instructions from user
  customInstructions: string[];

  // Tracking
  lastUpdated: number;
  adjustmentCount: number;
}

/* ── Storage Helpers ── */

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/* ── Default Settings ── */

function getDefaultSettings(): PersonalitySettings {
  return {
    formality: 0,
    verbosity: 0,
    technicality: 0,
    humor: 0,
    directness: 0,
    customInstructions: [],
    lastUpdated: Date.now(),
    adjustmentCount: 0,
  };
}

/* ── Persistence ── */

export function getPersonalitySettings(): PersonalitySettings {
  const raw = storageGet(PERSONALITY_KEY);
  if (!raw) return getDefaultSettings();
  try { return JSON.parse(raw) as PersonalitySettings; } catch { return getDefaultSettings(); }
}

function savePersonalitySettings(settings: PersonalitySettings): void {
  storageSet(PERSONALITY_KEY, JSON.stringify(settings));
}

/* ── Adjustment Functions ── */

export function adjustPersonality(
  dimension: 'formality' | 'verbosity' | 'technicality' | 'humor' | 'directness',
  delta: number,
): PersonalitySettings {
  const settings = getPersonalitySettings();
  settings[dimension] = Math.max(-1, Math.min(1, settings[dimension] + delta));
  settings.lastUpdated = Date.now();
  settings.adjustmentCount += 1;
  savePersonalitySettings(settings);
  return settings;
}

export function setPersonalityDimension(
  dimension: 'formality' | 'verbosity' | 'technicality' | 'humor' | 'directness',
  value: number,
): PersonalitySettings {
  const settings = getPersonalitySettings();
  settings[dimension] = Math.max(-1, Math.min(1, value));
  settings.lastUpdated = Date.now();
  settings.adjustmentCount += 1;
  savePersonalitySettings(settings);
  return settings;
}

export function addCustomInstruction(instruction: string): PersonalitySettings {
  const settings = getPersonalitySettings();
  // Avoid duplicates
  if (!settings.customInstructions.some(i => i.toLowerCase() === instruction.toLowerCase())) {
    settings.customInstructions.push(instruction);
    // Keep max 10 custom instructions
    if (settings.customInstructions.length > 10) {
      settings.customInstructions = settings.customInstructions.slice(-10);
    }
  }
  settings.lastUpdated = Date.now();
  settings.adjustmentCount += 1;
  savePersonalitySettings(settings);
  return settings;
}

export function removeCustomInstruction(index: number): PersonalitySettings {
  const settings = getPersonalitySettings();
  if (index >= 0 && index < settings.customInstructions.length) {
    settings.customInstructions.splice(index, 1);
    settings.lastUpdated = Date.now();
    savePersonalitySettings(settings);
  }
  return settings;
}

export function resetPersonality(): PersonalitySettings {
  const settings = getDefaultSettings();
  savePersonalitySettings(settings);
  return settings;
}

/* ── Detect Personality Feedback from Messages ── */

export function detectPersonalityFeedback(message: string): {
  detected: boolean;
  adjustments: Array<{ dimension: string; delta: number; reason: string }>;
  customInstruction?: string;
} {
  const lower = message.toLowerCase();
  const adjustments: Array<{ dimension: string; delta: number; reason: string }> = [];
  let customInstruction: string | undefined;

  // Formality adjustments
  if (/\b(be more casual|talk casually|less formal|more chill|more relaxed|loosen up)\b/i.test(lower)) {
    adjustments.push({ dimension: 'formality', delta: -0.3, reason: 'User wants more casual tone' });
  }
  if (/\b(be more formal|more professional|more serious|less casual)\b/i.test(lower)) {
    adjustments.push({ dimension: 'formality', delta: 0.3, reason: 'User wants more formal tone' });
  }

  // Verbosity adjustments
  if (/\b(be more concise|shorter|brief|less wordy|too long|too much text|keep it short|tldr|tl;dr|less verbose)\b/i.test(lower)) {
    adjustments.push({ dimension: 'verbosity', delta: -0.3, reason: 'User wants shorter responses' });
  }
  if (/\b(more detail|more detailed|elaborate|explain more|go deeper|more thorough|more in-depth)\b/i.test(lower)) {
    adjustments.push({ dimension: 'verbosity', delta: 0.3, reason: 'User wants more detailed responses' });
  }

  // Technicality adjustments
  if (/\b(simpler|simplify|dumb it down|explain like|eli5|less technical|plain english|plain language)\b/i.test(lower)) {
    adjustments.push({ dimension: 'technicality', delta: -0.3, reason: 'User wants simpler explanations' });
  }
  if (/\b(more technical|technical details|get technical|nerd out|deep dive|specifics)\b/i.test(lower)) {
    adjustments.push({ dimension: 'technicality', delta: 0.3, reason: 'User wants more technical depth' });
  }

  // Humor adjustments
  if (/\b(be funnier|more humor|more jokes|lighten up|more playful|have fun)\b/i.test(lower)) {
    adjustments.push({ dimension: 'humor', delta: 0.3, reason: 'User wants more humor' });
  }
  if (/\b(less jokes|more serious|stop joking|no humor|be serious|focus)\b/i.test(lower)) {
    adjustments.push({ dimension: 'humor', delta: -0.3, reason: 'User wants less humor' });
  }

  // Directness adjustments
  if (/\b(be more direct|get to the point|straight to|no fluff|cut to the chase|just tell me|bottom line)\b/i.test(lower)) {
    adjustments.push({ dimension: 'directness', delta: 0.3, reason: 'User wants more directness' });
  }
  if (/\b(be gentler|more careful|softer|ease into|more diplomatic)\b/i.test(lower)) {
    adjustments.push({ dimension: 'directness', delta: -0.3, reason: 'User wants gentler approach' });
  }

  // Custom instructions (catch-all for specific requests)
  const customPatterns = [
    /(?:always|from now on|going forward|permanently)\s+(.+)/i,
    /(?:remember to|make sure you|please always)\s+(.+)/i,
    /(?:i (?:prefer|want) you to)\s+(.+)/i,
  ];

  for (const pattern of customPatterns) {
    const match = lower.match(pattern);
    if (match && match[1] && match[1].length > 5 && match[1].length < 200) {
      // Only if it sounds like a personality/style instruction
      if (/\b(respond|answer|talk|speak|write|explain|format|style|tone|voice|language)\b/i.test(match[1])) {
        customInstruction = match[1].trim();
        break;
      }
    }
  }

  return {
    detected: adjustments.length > 0 || !!customInstruction,
    adjustments,
    customInstruction,
  };
}

/* ── Apply Detected Feedback ── */

export function applyPersonalityFeedback(message: string): boolean {
  const feedback = detectPersonalityFeedback(message);
  if (!feedback.detected) return false;

  for (const adj of feedback.adjustments) {
    adjustPersonality(
      adj.dimension as 'formality' | 'verbosity' | 'technicality' | 'humor' | 'directness',
      adj.delta,
    );
  }

  if (feedback.customInstruction) {
    addCustomInstruction(feedback.customInstruction);
  }

  return true;
}

/* ── Format for System Prompt ── */

export function formatPersonalityForPrompt(): string {
  const settings = getPersonalitySettings();

  // Check if any settings are non-default
  const isDefault =
    settings.formality === 0 &&
    settings.verbosity === 0 &&
    settings.technicality === 0 &&
    settings.humor === 0 &&
    settings.directness === 0 &&
    settings.customInstructions.length === 0;

  if (isDefault) return '';

  const instructions: string[] = [];

  // Formality
  if (settings.formality < -0.2) {
    instructions.push('Be casual and relaxed in your language. Use contractions, slang is okay.');
  } else if (settings.formality > 0.2) {
    instructions.push('Use a more formal and professional tone. Avoid slang and overly casual language.');
  }

  // Verbosity
  if (settings.verbosity < -0.2) {
    instructions.push('Keep responses concise and to the point. Avoid unnecessary elaboration.');
  } else if (settings.verbosity > 0.2) {
    instructions.push('Provide detailed, thorough responses. Elaborate and explain concepts fully.');
  }

  // Technicality
  if (settings.technicality < -0.2) {
    instructions.push('Use simple, accessible language. Avoid jargon unless necessary, and explain technical terms.');
  } else if (settings.technicality > 0.2) {
    instructions.push('Feel free to use technical language and go deep into specifics. The user appreciates technical depth.');
  }

  // Humor
  if (settings.humor < -0.2) {
    instructions.push('Keep things focused and serious. Minimize jokes and playfulness.');
  } else if (settings.humor > 0.2) {
    instructions.push('Be playful and use humor when appropriate. The user enjoys a lighter tone.');
  }

  // Directness
  if (settings.directness < -0.2) {
    instructions.push('Be gentle and diplomatic in your responses. Ease into difficult topics.');
  } else if (settings.directness > 0.2) {
    instructions.push('Be direct and get to the point quickly. The user prefers straight answers without preamble.');
  }

  // Custom instructions
  if (settings.customInstructions.length > 0) {
    instructions.push('Custom style preferences from the user:');
    for (const inst of settings.customInstructions) {
      instructions.push(`  - ${inst}`);
    }
  }

  if (instructions.length === 0) return '';

  return `
═══ PERSONALITY TUNING ═══
The user has customized how you communicate. Follow these preferences:
${instructions.join('\n')}
These preferences were explicitly set by the user. Respect them consistently.`;
}

/* ── Get Human-Readable Summary ── */

export function getPersonalitySummary(): string {
  const settings = getPersonalitySettings();

  const dims: string[] = [];

  const describeScale = (value: number, lowLabel: string, highLabel: string): string => {
    if (value < -0.5) return `Very ${lowLabel}`;
    if (value < -0.2) return `Somewhat ${lowLabel}`;
    if (value > 0.5) return `Very ${highLabel}`;
    if (value > 0.2) return `Somewhat ${highLabel}`;
    return 'Balanced';
  };

  dims.push(`Formality: ${describeScale(settings.formality, 'casual', 'formal')}`);
  dims.push(`Detail level: ${describeScale(settings.verbosity, 'concise', 'detailed')}`);
  dims.push(`Technical depth: ${describeScale(settings.technicality, 'simple', 'technical')}`);
  dims.push(`Humor: ${describeScale(settings.humor, 'serious', 'playful')}`);
  dims.push(`Directness: ${describeScale(settings.directness, 'gentle', 'direct')}`);

  let result = dims.join('\n');

  if (settings.customInstructions.length > 0) {
    result += '\n\nCustom instructions:\n' + settings.customInstructions.map(i => `- ${i}`).join('\n');
  }

  return result;
}

/* ── Export / Import ── */

export function exportPersonalityData(): PersonalitySettings {
  return getPersonalitySettings();
}

export function importPersonalityData(settings: PersonalitySettings): void {
  if (settings) {
    savePersonalitySettings(settings);
  }
}

export function clearPersonalityData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PERSONALITY_KEY);
  } catch { /* ignore */ }
}
