/**
 * Embris Emotional Intelligence System
 *
 * Analyzes user message tone before responding, detects mood,
 * stores emotional context for system prompt injection,
 * and tracks emotional patterns over time as part of self-learning.
 *
 * All data persists in localStorage.
 */

const EMOTIONAL_STATE_KEY = 'embris_emotional_state_v1';
const EMOTIONAL_HISTORY_KEY = 'embris_emotional_history_v1';

/* ── Types ── */

export type MoodCategory =
  | 'excited'
  | 'happy'
  | 'neutral'
  | 'confused'
  | 'frustrated'
  | 'stressed'
  | 'sad'
  | 'curious'
  | 'determined';

export interface EmotionalState {
  mood: MoodCategory;
  intensity: number; // 0-1
  confidence: number; // 0-1
  signals: string[]; // what triggered this detection
  timestamp: number;
}

export interface EmotionalHistoryEntry {
  mood: MoodCategory;
  intensity: number;
  timestamp: number;
  messageExcerpt: string; // first 60 chars of the message
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

/* ── Persistence ── */

export function getCurrentEmotionalState(): EmotionalState | null {
  const raw = storageGet(EMOTIONAL_STATE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as EmotionalState; } catch { return null; }
}

function saveEmotionalState(state: EmotionalState): void {
  storageSet(EMOTIONAL_STATE_KEY, JSON.stringify(state));
}

export function getEmotionalHistory(): EmotionalHistoryEntry[] {
  const raw = storageGet(EMOTIONAL_HISTORY_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as EmotionalHistoryEntry[]; } catch { return []; }
}

function saveEmotionalHistory(history: EmotionalHistoryEntry[]): void {
  // Keep max 100 entries
  const trimmed = history.slice(-100);
  storageSet(EMOTIONAL_HISTORY_KEY, JSON.stringify(trimmed));
}

/* ── Mood Analysis (fast, local, no LLM needed) ── */

export function analyzeMood(message: string): EmotionalState {
  const signals: string[] = [];
  const lower = message.toLowerCase().trim();
  const words = lower.split(/\s+/);
  const wordCount = words.length;

  // Punctuation analysis
  const exclamationCount = (message.match(/!/g) || []).length;
  const questionCount = (message.match(/\?/g) || []).length;
  const capsRatio = message.replace(/[^a-zA-Z]/g, '').length > 0
    ? (message.replace(/[^A-Z]/g, '').length / message.replace(/[^a-zA-Z]/g, '').length)
    : 0;
  const ellipsisCount = (message.match(/\.{3,}/g) || []).length;
  const periodCount = (message.match(/\.(?!\.)/g) || []).length;

  // Message length analysis
  const isVeryShort = wordCount <= 3;
  const isShort = wordCount <= 8;
  const isLong = wordCount >= 30;
  // Score each mood category
  const scores: Record<MoodCategory, number> = {
    excited: 0,
    happy: 0,
    neutral: 0,
    confused: 0,
    frustrated: 0,
    stressed: 0,
    sad: 0,
    curious: 0,
    determined: 0,
  };

  // === EXCITED indicators ===
  if (exclamationCount >= 2) { scores.excited += 0.3; signals.push('multiple exclamation marks'); }
  if (capsRatio > 0.5 && wordCount > 2) { scores.excited += 0.25; signals.push('heavy caps usage'); }
  if (/\b(amazing|awesome|incredible|insane|lets go|let's go|hell yeah|omg|wow|yesss+|fire|lit|huge|massive|hype|hyped)\b/i.test(lower)) {
    scores.excited += 0.35; signals.push('excitement words');
  }
  if (isLong && exclamationCount >= 1) { scores.excited += 0.15; signals.push('long enthusiastic message'); }
  if (wordCount >= 60 && exclamationCount >= 2) { scores.excited += 0.1; signals.push('very long excited message'); }

  // === HAPPY indicators ===
  if (/\b(thanks|thank you|appreciate|glad|great|good|nice|love it|perfect|sweet|cool|dope)\b/i.test(lower)) {
    scores.happy += 0.3; signals.push('positive words');
  }
  if (/[😊🙂😄😃🎉🔥❤️💪👍✅]/u.test(message)) { scores.happy += 0.2; signals.push('positive emoji'); }
  if (exclamationCount === 1 && !isVeryShort) { scores.happy += 0.1; }

  // === CONFUSED indicators ===
  if (questionCount >= 2) { scores.confused += 0.25; signals.push('multiple questions'); }
  if (/\b(confused|don't understand|what do you mean|huh|what\?|how does|i don't get|explain|unclear|lost|wait what|wdym)\b/i.test(lower)) {
    scores.confused += 0.4; signals.push('confusion words');
  }
  if (ellipsisCount >= 1 && questionCount >= 1) { scores.confused += 0.15; signals.push('uncertain punctuation'); }
  if (/\b(can you|could you|help me|how do i|what is|what are)\b/i.test(lower)) {
    scores.confused += 0.15; signals.push('help-seeking language');
  }

  // === FRUSTRATED indicators ===
  if (isVeryShort && periodCount >= 1 && exclamationCount === 0) { scores.frustrated += 0.2; signals.push('curt response'); }
  if (/\b(ugh|damn|wtf|smh|annoying|annoyed|frustrated|broken|doesn't work|not working|still broken|come on|seriously|ridiculous)\b/i.test(lower)) {
    scores.frustrated += 0.4; signals.push('frustration words');
  }
  if (capsRatio > 0.6 && isShort) { scores.frustrated += 0.2; signals.push('short caps message'); }
  if (/\b(again|still|already told you|i said|for the \w+ time)\b/i.test(lower)) {
    scores.frustrated += 0.2; signals.push('repetition frustration');
  }

  // === STRESSED indicators ===
  if (/\b(deadline|urgent|asap|running out|time|pressure|overwhelmed|too much|behind|crunch|rush|hurry)\b/i.test(lower)) {
    scores.stressed += 0.35; signals.push('stress/urgency words');
  }
  if (/\b(need to|have to|must|gotta|can't afford)\b/i.test(lower) && isLong) {
    scores.stressed += 0.15; signals.push('obligation language');
  }

  // === SAD indicators ===
  if (/\b(sad|disappointed|sucks|bummed|down|failed|lost|miss|wish|unfortunately|regret)\b/i.test(lower)) {
    scores.sad += 0.35; signals.push('sadness words');
  }
  if (ellipsisCount >= 2) { scores.sad += 0.1; signals.push('trailing off'); }

  // === CURIOUS indicators ===
  if (questionCount >= 1 && !isVeryShort && scores.confused < 0.3) {
    scores.curious += 0.25; signals.push('questioning');
  }
  if (/\b(wondering|curious|interesting|tell me|what if|how about|explore|think about|thoughts on)\b/i.test(lower)) {
    scores.curious += 0.3; signals.push('curiosity words');
  }
  if (isLong && questionCount >= 1) { scores.curious += 0.1; signals.push('detailed inquiry'); }

  // === DETERMINED indicators ===
  if (/\b(going to|gonna|will|let's|ready|time to|need to build|ship|launch|deploy|execute|make it happen|grind|push|let's do)\b/i.test(lower)) {
    scores.determined += 0.3; signals.push('determination words');
  }
  if (/\b(plan|strategy|next step|roadmap|milestone|target|goal)\b/i.test(lower)) {
    scores.determined += 0.2; signals.push('planning language');
  }

  // === NEUTRAL baseline ===
  scores.neutral = 0.15; // always a small baseline

  // Find the highest scoring mood
  let topMood: MoodCategory = 'neutral';
  let topScore = 0;
  for (const [mood, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topMood = mood as MoodCategory;
    }
  }

  // Calculate intensity based on score magnitude
  const intensity = Math.min(1, topScore / 0.6);

  // Calculate confidence based on how much the top score exceeds others
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const gap = sortedScores[0] - (sortedScores[1] || 0);
  const confidence = Math.min(1, 0.4 + gap * 2);

  // Deduplicate signals
  const uniqueSignals = [...new Set(signals)];

  const state: EmotionalState = {
    mood: topMood,
    intensity,
    confidence,
    signals: uniqueSignals.slice(0, 5),
    timestamp: Date.now(),
  };

  // Save current state
  saveEmotionalState(state);

  // Add to history
  const history = getEmotionalHistory();
  history.push({
    mood: topMood,
    intensity,
    timestamp: Date.now(),
    messageExcerpt: message.slice(0, 60),
  });
  saveEmotionalHistory(history);

  return state;
}

/* ── Format for System Prompt ── */

const MOOD_INSTRUCTIONS: Record<MoodCategory, string> = {
  excited: 'The user is excited and energetic! Match their energy — be enthusiastic, use exclamation points, celebrate with them. Keep the momentum going.',
  happy: 'The user is in a good mood. Be warm and positive. This is a great time for productive conversation.',
  neutral: 'The user seems neutral. Be your normal warm, helpful self.',
  confused: 'The user seems confused or uncertain. Be extra clear and detailed in your explanations. Break things down step by step. Ask if they need clarification. Be patient.',
  frustrated: 'The user seems frustrated. Be empathetic and solution-focused. Acknowledge their frustration briefly, then focus on helping solve the problem. Be direct and efficient — don\'t add fluff.',
  stressed: 'The user seems stressed or under pressure. Be supportive and calming. Help them prioritize. Be concise and actionable — they don\'t have time for long explanations right now.',
  sad: 'The user seems down. Be extra warm and supportive. Show genuine care. If appropriate, gently encourage them. Don\'t be dismissive of their feelings.',
  curious: 'The user is curious and exploring. Feed their curiosity! Go deeper, share interesting details, suggest related topics. This is a great learning moment.',
  determined: 'The user is in action mode. Be a strategic partner — help them plan, execute, and move forward. Be direct and actionable. Match their drive.',
};

export function formatEmotionalContextForPrompt(): string {
  const state = getCurrentEmotionalState();
  if (!state) return '';

  // Only include if recent (within last 5 minutes) and confident
  const ageMinutes = (Date.now() - state.timestamp) / (1000 * 60);
  if (ageMinutes > 5 || state.confidence < 0.3) return '';

  const instruction = MOOD_INSTRUCTIONS[state.mood] || MOOD_INSTRUCTIONS.neutral;

  return `
═══ CURRENT USER MOOD ═══
Detected mood: ${state.mood} (intensity: ${state.intensity.toFixed(1)}, confidence: ${state.confidence.toFixed(1)})
Signals: ${state.signals.join(', ')}
${instruction}`;
}

/* ── Emotional Pattern Summary (for self-learning integration) ── */

export function getEmotionalPatternSummary(): string {
  const history = getEmotionalHistory();
  if (history.length < 5) return '';

  // Count mood frequencies
  const moodCounts: Record<string, number> = {};
  for (const entry of history) {
    moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
  }

  // Find dominant moods
  const sorted = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
  const total = history.length;
  const dominant = sorted.slice(0, 3).map(([mood, count]) =>
    `${mood} (${Math.round(count / total * 100)}%)`
  );

  // Recent trend (last 10 messages)
  const recent = history.slice(-10);
  const recentMoods = recent.map(e => e.mood);
  const recentDominant = recentMoods.reduce((acc, mood) => {
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const recentTop = Object.entries(recentDominant).sort((a, b) => b[1] - a[1])[0];

  return `Emotional patterns over ${total} messages: ${dominant.join(', ')}. Recent trend: mostly ${recentTop?.[0] || 'neutral'}.`;
}

/* ── Export / Import ── */

export function exportEmotionalData(): {
  currentState: EmotionalState | null;
  history: EmotionalHistoryEntry[];
} {
  return {
    currentState: getCurrentEmotionalState(),
    history: getEmotionalHistory(),
  };
}

export function importEmotionalData(data: {
  currentState?: EmotionalState | null;
  history?: EmotionalHistoryEntry[];
}): void {
  if (data.currentState) saveEmotionalState(data.currentState);
  if (data.history) saveEmotionalHistory(data.history);
}

export function clearEmotionalData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(EMOTIONAL_STATE_KEY);
    localStorage.removeItem(EMOTIONAL_HISTORY_KEY);
  } catch { /* ignore */ }
}
