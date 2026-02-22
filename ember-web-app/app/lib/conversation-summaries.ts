/**
 * Embris Conversation Summaries System
 *
 * Auto-generates brief summaries of chat sessions including
 * topics discussed and decisions made. Stores in localStorage
 * with timestamps. Embris can reference past sessions.
 */

const SUMMARIES_KEY = 'embris_session_summaries_v1';
const CURRENT_SESSION_KEY = 'embris_current_session_v1';

/* ── Types ── */

export interface SessionSummary {
  id: string;
  summary: string;
  topics: string[];
  decisions: string[];
  timestamp: number;
  messageCount: number;
  duration: number; // in minutes
}

export interface CurrentSession {
  startTime: number;
  messageCount: number;
  lastMessageTime: number;
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

/* ── Session Tracking ── */

export function getCurrentSession(): CurrentSession {
  const raw = storageGet(CURRENT_SESSION_KEY);
  if (!raw) {
    const session: CurrentSession = {
      startTime: Date.now(),
      messageCount: 0,
      lastMessageTime: Date.now(),
    };
    storageSet(CURRENT_SESSION_KEY, JSON.stringify(session));
    return session;
  }
  try { return JSON.parse(raw) as CurrentSession; } catch {
    return { startTime: Date.now(), messageCount: 0, lastMessageTime: Date.now() };
  }
}

export function updateCurrentSession(): void {
  const session = getCurrentSession();
  session.messageCount += 1;
  session.lastMessageTime = Date.now();
  storageSet(CURRENT_SESSION_KEY, JSON.stringify(session));
}

export function resetCurrentSession(): void {
  const session: CurrentSession = {
    startTime: Date.now(),
    messageCount: 0,
    lastMessageTime: Date.now(),
  };
  storageSet(CURRENT_SESSION_KEY, JSON.stringify(session));
}

/* ── Summary Persistence ── */

export function getSessionSummaries(): SessionSummary[] {
  const raw = storageGet(SUMMARIES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as SessionSummary[]; } catch { return []; }
}

function saveSummaries(summaries: SessionSummary[]): void {
  // Keep max 50 summaries
  const trimmed = summaries.slice(-50);
  storageSet(SUMMARIES_KEY, JSON.stringify(trimmed));
}

/* ── Generate Summary via LLM ── */

const API_URL = 'https://api.manus.im/api/llm-proxy/v1/chat/completions';

export async function generateSessionSummary(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
): Promise<SessionSummary | null> {
  if (messages.length < 2) return null;

  const session = getCurrentSession();
  const duration = Math.round((Date.now() - session.startTime) / (1000 * 60));

  // Build conversation excerpt (last 20 messages max to keep token count reasonable)
  const recentMessages = messages.slice(-20);
  const conversationText = recentMessages
    .map(m => `${m.role === 'user' ? 'User' : 'Embris'}: ${m.content.slice(0, 200)}`)
    .join('\n');

  const prompt = `Summarize this conversation session between a user and Embris (an AI companion for the Vaultfire Protocol). Extract:
1. A brief 1-2 sentence summary of what was discussed
2. Key topics covered (as a list of short phrases)
3. Any decisions made or action items identified

CONVERSATION:
${conversationText}

Respond with JSON only (no markdown):
{"summary": "...", "topics": ["topic1", "topic2"], "decisions": ["decision1"]}

If no clear decisions were made, use an empty array for decisions. Keep the summary concise but informative.`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: [
          { role: 'system', content: 'You summarize conversations concisely. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 512,
        temperature: 0.3,
        stream: false,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;

    let cleaned = raw;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned) as { summary: string; topics: string[]; decisions: string[] };

    const summary: SessionSummary = {
      id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      summary: parsed.summary || 'General conversation',
      topics: parsed.topics || [],
      decisions: parsed.decisions || [],
      timestamp: Date.now(),
      messageCount: session.messageCount,
      duration,
    };

    // Save
    const existing = getSessionSummaries();
    saveSummaries([...existing, summary]);

    // Reset current session
    resetCurrentSession();

    return summary;
  } catch {
    return null;
  }
}

/* ── Format for System Prompt ── */

export function formatSessionSummariesForPrompt(): string {
  const summaries = getSessionSummaries();
  if (summaries.length === 0) return '';

  // Only include the last 5 sessions to keep prompt manageable
  const recent = summaries.slice(-5);

  const items = recent.map(s => {
    const date = new Date(s.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const decisionsStr = s.decisions.length > 0 ? ` Decisions: ${s.decisions.join('; ')}` : '';
    return `  - [${dateStr}] ${s.summary}${decisionsStr}`;
  }).join('\n');

  return `
═══ PREVIOUS SESSION SUMMARIES ═══
You can reference these to maintain continuity across sessions:
${items}
Use these naturally: "Last time we talked about...", "You mentioned wanting to...", "We decided to..."`;
}

/* ── Format for User Recall ── */

export function formatSessionsForRecall(): string {
  const summaries = getSessionSummaries();
  if (summaries.length === 0) {
    return "We haven't had any previous sessions yet. This is our first conversation!";
  }

  const items = summaries.map(s => {
    const date = new Date(s.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const topicsStr = s.topics.length > 0 ? `\n  Topics: ${s.topics.join(', ')}` : '';
    const decisionsStr = s.decisions.length > 0 ? `\n  Decisions: ${s.decisions.join('; ')}` : '';
    return `**${dateStr}** (${s.messageCount} messages, ${s.duration}min)\n  ${s.summary}${topicsStr}${decisionsStr}`;
  });

  return `Here's a summary of our previous sessions:\n\n${items.join('\n\n')}`;
}

/* ── Export / Import ── */

export function exportSessionData(): SessionSummary[] {
  return getSessionSummaries();
}

export function importSessionData(summaries: SessionSummary[]): void {
  if (summaries && Array.isArray(summaries)) {
    saveSummaries(summaries);
  }
}

export function clearSessionData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SUMMARIES_KEY);
    localStorage.removeItem(CURRENT_SESSION_KEY);
  } catch { /* ignore */ }
}
