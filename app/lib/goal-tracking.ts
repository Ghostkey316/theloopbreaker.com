/**
 * Embris Goal Tracking System
 *
 * Users can tell Embris their goals, which are saved with status tracking.
 * Embris proactively checks in on goals and suggests next steps.
 * Goals persist in localStorage.
 */

const GOALS_KEY = 'embris_goals_v1';

/* ── Types ── */

export type GoalStatus = 'active' | 'completed' | 'paused';

export interface GoalMilestone {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  milestones: GoalMilestone[];
  progress: number; // 0-100
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  notes: string[];
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

/* ── CRUD Operations ── */

export function getGoals(): Goal[] {
  const raw = storageGet(GOALS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Goal[]; } catch { return []; }
}

function saveGoals(goals: Goal[]): void {
  storageSet(GOALS_KEY, JSON.stringify(goals));
}

export function addGoal(title: string, description: string = ''): Goal {
  const goal: Goal = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    description,
    status: 'active',
    milestones: [],
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    notes: [],
  };

  const goals = getGoals();
  goals.push(goal);
  saveGoals(goals);
  return goal;
}

export function updateGoalStatus(goalId: string, status: GoalStatus): Goal | null {
  const goals = getGoals();
  const idx = goals.findIndex(g => g.id === goalId);
  if (idx === -1) return null;

  goals[idx].status = status;
  goals[idx].updatedAt = Date.now();
  if (status === 'completed') {
    goals[idx].completedAt = Date.now();
    goals[idx].progress = 100;
  }

  saveGoals(goals);
  return goals[idx];
}

export function updateGoalProgress(goalId: string, progress: number): Goal | null {
  const goals = getGoals();
  const idx = goals.findIndex(g => g.id === goalId);
  if (idx === -1) return null;

  goals[idx].progress = Math.min(100, Math.max(0, progress));
  goals[idx].updatedAt = Date.now();
  if (goals[idx].progress === 100) {
    goals[idx].status = 'completed';
    goals[idx].completedAt = Date.now();
  }

  saveGoals(goals);
  return goals[idx];
}

export function addGoalNote(goalId: string, note: string): Goal | null {
  const goals = getGoals();
  const idx = goals.findIndex(g => g.id === goalId);
  if (idx === -1) return null;

  goals[idx].notes.push(note);
  goals[idx].updatedAt = Date.now();
  saveGoals(goals);
  return goals[idx];
}

export function addGoalMilestone(goalId: string, title: string): Goal | null {
  const goals = getGoals();
  const idx = goals.findIndex(g => g.id === goalId);
  if (idx === -1) return null;

  goals[idx].milestones.push({
    id: `ms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    completed: false,
  });
  goals[idx].updatedAt = Date.now();
  saveGoals(goals);
  return goals[idx];
}

export function completeMilestone(goalId: string, milestoneId: string): Goal | null {
  const goals = getGoals();
  const idx = goals.findIndex(g => g.id === goalId);
  if (idx === -1) return null;

  const msIdx = goals[idx].milestones.findIndex(m => m.id === milestoneId);
  if (msIdx === -1) return null;

  goals[idx].milestones[msIdx].completed = true;
  goals[idx].milestones[msIdx].completedAt = Date.now();

  // Auto-update progress based on milestones
  const totalMs = goals[idx].milestones.length;
  const completedMs = goals[idx].milestones.filter(m => m.completed).length;
  if (totalMs > 0) {
    goals[idx].progress = Math.round((completedMs / totalMs) * 100);
  }

  goals[idx].updatedAt = Date.now();
  saveGoals(goals);
  return goals[idx];
}

export function deleteGoal(goalId: string): boolean {
  const goals = getGoals();
  const filtered = goals.filter(g => g.id !== goalId);
  if (filtered.length === goals.length) return false;
  saveGoals(filtered);
  return true;
}

/* ── AI-Powered Goal Extraction ── */

const API_URL = 'https://api.manus.im/api/llm-proxy/v1/chat/completions';

export async function extractGoalsFromMessage(
  userMessage: string,
  existingGoals: Goal[],
  apiKey: string,
): Promise<{ newGoals: Array<{ title: string; description: string }>; updates: Array<{ goalTitle: string; update: string; newStatus?: GoalStatus; progress?: number }> }> {
  const existingGoalsSummary = existingGoals.map(g =>
    `- "${g.title}" (${g.status}, ${g.progress}% done)`
  ).join('\n');

  const prompt = `You are a goal detection system for an AI companion. Analyze the user's message and detect:
1. NEW goals being stated (e.g., "I want to win the Build Games", "my goal is to deploy on 5 chains")
2. UPDATES to existing goals (e.g., "I finished deploying", "I'm pausing the marketing push")

EXISTING GOALS:
${existingGoalsSummary || '(none)'}

USER MESSAGE: ${userMessage}

Rules:
- Only extract clear, intentional goals — not casual mentions
- A goal should be something the user wants to achieve, not just a topic of discussion
- For updates, match to existing goals by similarity
- If the user says something is "done" or "completed", mark it as completed
- If the user says they're "pausing" or "putting on hold", mark as paused

Respond with JSON (no markdown):
{"newGoals": [{"title": "...", "description": "..."}], "updates": [{"goalTitle": "...", "update": "...", "newStatus": "active|completed|paused", "progress": 50}]}

If nothing goal-related, respond with: {"newGoals": [], "updates": []}`;

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
          { role: 'system', content: 'You detect goals and goal updates from conversation. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 512,
        temperature: 0.3,
        stream: false,
      }),
    });

    if (!response.ok) return { newGoals: [], updates: [] };

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return { newGoals: [], updates: [] };

    let cleaned = raw;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);
    return {
      newGoals: Array.isArray(parsed.newGoals) ? parsed.newGoals : [],
      updates: Array.isArray(parsed.updates) ? parsed.updates : [],
    };
  } catch {
    return { newGoals: [], updates: [] };
  }
}

/* ── Process Goal Extraction Results ── */

export function processGoalExtraction(
  result: { newGoals: Array<{ title: string; description: string }>; updates: Array<{ goalTitle: string; update: string; newStatus?: GoalStatus; progress?: number }> }
): void {
  const goals = getGoals();

  // Add new goals
  for (const newGoal of result.newGoals) {
    // Check for duplicates
    const isDuplicate = goals.some(g =>
      g.title.toLowerCase().includes(newGoal.title.toLowerCase().slice(0, 20)) ||
      newGoal.title.toLowerCase().includes(g.title.toLowerCase().slice(0, 20))
    );
    if (!isDuplicate) {
      addGoal(newGoal.title, newGoal.description);
    }
  }

  // Process updates
  for (const update of result.updates) {
    const matchingGoal = goals.find(g =>
      g.title.toLowerCase().includes(update.goalTitle.toLowerCase().slice(0, 20)) ||
      update.goalTitle.toLowerCase().includes(g.title.toLowerCase().slice(0, 20))
    );
    if (matchingGoal) {
      if (update.newStatus) {
        updateGoalStatus(matchingGoal.id, update.newStatus);
      }
      if (update.progress !== undefined) {
        updateGoalProgress(matchingGoal.id, update.progress);
      }
      if (update.update) {
        addGoalNote(matchingGoal.id, update.update);
      }
    }
  }
}

/* ── Format for System Prompt ── */

export function formatGoalsForPrompt(): string {
  const goals = getGoals();
  if (goals.length === 0) return '';

  const active = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');
  const paused = goals.filter(g => g.status === 'paused');

  const sections: string[] = [];

  if (active.length > 0) {
    const items = active.map(g => {
      const msStr = g.milestones.length > 0
        ? ` (${g.milestones.filter(m => m.completed).length}/${g.milestones.length} milestones)`
        : '';
      const daysSinceUpdate = Math.floor((Date.now() - g.updatedAt) / (1000 * 60 * 60 * 24));
      const staleStr = daysSinceUpdate > 3 ? ` ⚠ not discussed in ${daysSinceUpdate} days` : '';
      return `  - "${g.title}" — ${g.progress}% done${msStr}${staleStr}`;
    }).join('\n');
    sections.push(`Active Goals:\n${items}`);
  }

  if (completed.length > 0) {
    const items = completed.slice(-3).map(g => `  - ✓ "${g.title}"`).join('\n');
    sections.push(`Recently Completed:\n${items}`);
  }

  if (paused.length > 0) {
    const items = paused.map(g => `  - ⏸ "${g.title}"`).join('\n');
    sections.push(`Paused:\n${items}`);
  }

  return `
═══ USER'S GOALS ═══
${sections.join('\n')}

GOAL BEHAVIOR:
- Reference active goals naturally when relevant
- If a goal hasn't been discussed in a while, consider checking in
- Celebrate completed goals and suggest what's next
- When the user mentions progress, acknowledge it warmly
- If asked "what are my goals?" or "how's my progress?", give a detailed status update
- You can suggest breaking goals into milestones for better tracking`;
}

/* ── Format for User Recall ── */

export function formatGoalsForRecall(): string {
  const goals = getGoals();
  if (goals.length === 0) {
    return "You haven't set any goals yet! Tell me what you're working toward and I'll help you track it. For example: \"My goal is to deploy on 5 chains\" or \"I want to win the Build Games.\"";
  }

  const sections: string[] = [];

  const active = goals.filter(g => g.status === 'active');
  if (active.length > 0) {
    const items = active.map(g => {
      let detail = `**${g.title}** — ${g.progress}% complete`;
      if (g.description) detail += `\n  ${g.description}`;
      if (g.milestones.length > 0) {
        const msItems = g.milestones.map(m => `  ${m.completed ? '✅' : '⬜'} ${m.title}`).join('\n');
        detail += `\n${msItems}`;
      }
      if (g.notes.length > 0) {
        detail += `\n  Latest note: ${g.notes[g.notes.length - 1]}`;
      }
      return detail;
    });
    sections.push(`**🎯 Active Goals:**\n${items.join('\n\n')}`);
  }

  const completed = goals.filter(g => g.status === 'completed');
  if (completed.length > 0) {
    const items = completed.map(g => `✅ **${g.title}**`).join('\n');
    sections.push(`**Completed:**\n${items}`);
  }

  const paused = goals.filter(g => g.status === 'paused');
  if (paused.length > 0) {
    const items = paused.map(g => `⏸ **${g.title}**`).join('\n');
    sections.push(`**Paused:**\n${items}`);
  }

  return sections.join('\n\n');
}

/* ── Export / Import ── */

export function exportGoalData(): Goal[] {
  return getGoals();
}

export function importGoalData(goals: Goal[]): void {
  if (goals && Array.isArray(goals)) {
    saveGoals(goals);
  }
}

export function clearGoalData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GOALS_KEY);
  } catch { /* ignore */ }
}
