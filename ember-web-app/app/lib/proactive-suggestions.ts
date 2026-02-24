/**
 * Embris Proactive Suggestions System
 *
 * After responding, Embris sometimes proactively suggests next steps
 * or brings up relevant topics based on self-learning insights,
 * patterns, goals, and conversation context.
 *
 * Uses a smart relevance check to avoid being annoying.
 */

import { getInsights, getPatterns } from './self-learning';
import { getGoals } from './goal-tracking';
import { getSessionSummaries } from './conversation-summaries';

/* ── Types ── */

export interface ProactiveSuggestion {
  content: string;
  source: 'insight' | 'pattern' | 'goal' | 'session' | 'general';
  sourceId?: string;
  relevance: number; // 0-1
}

/* ── Suggestion Frequency Control ── */

const SUGGESTION_COOLDOWN_KEY = 'embris_last_suggestion_time';
const MIN_MESSAGES_BETWEEN_SUGGESTIONS = 3;
const MIN_TIME_BETWEEN_SUGGESTIONS_MS = 2 * 60 * 1000; // 2 minutes

let messagesSinceLastSuggestion = 0;

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function incrementMessageCount(): void {
  messagesSinceLastSuggestion++;
}

function shouldSuggest(): boolean {
  // Don't suggest too frequently
  if (messagesSinceLastSuggestion < MIN_MESSAGES_BETWEEN_SUGGESTIONS) return false;

  const lastTime = storageGet(SUGGESTION_COOLDOWN_KEY);
  if (lastTime) {
    const elapsed = Date.now() - parseInt(lastTime, 10);
    if (elapsed < MIN_TIME_BETWEEN_SUGGESTIONS_MS) return false;
  }

  // 40% chance even when eligible — keeps it natural
  return Math.random() < 0.4;
}

function markSuggestionMade(): void {
  messagesSinceLastSuggestion = 0;
  storageSet(SUGGESTION_COOLDOWN_KEY, Date.now().toString());
}

/* ── Generate Suggestions Based on Context ── */

export function generateSuggestions(
  userMessage: string,
  assistantResponse: string,
): ProactiveSuggestion[] {
  if (!shouldSuggest()) return [];

  const suggestions: ProactiveSuggestion[] = [];
  const lowerUser = userMessage.toLowerCase();
  const lowerAssistant = assistantResponse.toLowerCase();
  const combinedContext = `${lowerUser} ${lowerAssistant}`;

  // 1. Check actionable insights
  const insights = getInsights();
  const unusedActionable = insights.filter(i => i.actionable && !i.used);
  for (const insight of unusedActionable.slice(0, 3)) {
    // Check if the insight is relevant to the current conversation
    const insightWords = insight.content.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const relevanceScore = insightWords.filter(w => combinedContext.includes(w)).length / Math.max(insightWords.length, 1);
    if (relevanceScore > 0.15) {
      suggestions.push({
        content: insight.content,
        source: 'insight',
        sourceId: insight.id,
        relevance: relevanceScore,
      });
    }
  }

  // 2. Check goals that need attention
  const goals = getGoals();
  const activeGoals = goals.filter(g => g.status === 'active');
  for (const goal of activeGoals.slice(0, 3)) {
    const goalWords = goal.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const relevanceScore = goalWords.filter(w => combinedContext.includes(w)).length / Math.max(goalWords.length, 1);

    // Also check if it's been a while since the goal was discussed
    const daysSinceUpdate = (Date.now() - goal.updatedAt) / (1000 * 60 * 60 * 24);
    const timeBoost = daysSinceUpdate > 3 ? 0.2 : 0;

    if (relevanceScore > 0.1 || timeBoost > 0) {
      suggestions.push({
        content: `You mentioned your goal: "${goal.title}". ${daysSinceUpdate > 3 ? "It's been a few days — how's that going?" : "Want to talk about next steps?"}`,
        source: 'goal',
        sourceId: goal.id,
        relevance: relevanceScore + timeBoost,
      });
    }
  }

  // 3. Check patterns for workflow suggestions
  const patterns = getPatterns();
  const workflowPatterns = patterns.filter(p => p.category === 'workflow' || p.category === 'priorities');
  for (const pattern of workflowPatterns.slice(0, 2)) {
    const patternWords = pattern.content.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const relevanceScore = patternWords.filter(w => combinedContext.includes(w)).length / Math.max(patternWords.length, 1);
    if (relevanceScore > 0.2) {
      suggestions.push({
        content: pattern.content,
        source: 'pattern',
        sourceId: pattern.id,
        relevance: relevanceScore,
      });
    }
  }

  // 4. Check recent session summaries for continuity
  const summaries = getSessionSummaries();
  if (summaries.length > 0) {
    const lastSummary = summaries[summaries.length - 1];
    const summaryWords = lastSummary.summary.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const relevanceScore = summaryWords.filter(w => combinedContext.includes(w)).length / Math.max(summaryWords.length, 1);
    if (relevanceScore > 0.15 && lastSummary.decisions.length > 0) {
      suggestions.push({
        content: `Last session we discussed: ${lastSummary.decisions[0]}. Want to follow up on that?`,
        source: 'session',
        sourceId: lastSummary.id,
        relevance: relevanceScore,
      });
    }
  }

  if (suggestions.length === 0) return [];

  // Sort by relevance, pick the best one
  suggestions.sort((a, b) => b.relevance - a.relevance);
  const best = suggestions[0];

  // Only return if relevance is meaningful
  if (best.relevance < 0.1) return [];

  markSuggestionMade();
  return [best];
}

/* ── Format Suggestions for System Prompt ── */

export function formatSuggestionsContext(): string {
  const insights = getInsights();
  const goals = getGoals();
  const summaries = getSessionSummaries();

  const parts: string[] = [];

  // Include unused actionable insights
  const actionableInsights = insights.filter(i => i.actionable && !i.used).slice(0, 3);
  if (actionableInsights.length > 0) {
    parts.push('Actionable insights you can proactively share when relevant:\n' +
      actionableInsights.map(i => `  - ${i.content}`).join('\n'));
  }

  // Include active goals for proactive check-ins
  const activeGoals = goals.filter(g => g.status === 'active');
  if (activeGoals.length > 0) {
    const staleGoals = activeGoals.filter(g => (Date.now() - g.updatedAt) > 3 * 24 * 60 * 60 * 1000);
    if (staleGoals.length > 0) {
      parts.push('Goals that haven\'t been discussed recently (consider checking in):\n' +
        staleGoals.map(g => `  - "${g.title}" (last updated ${Math.floor((Date.now() - g.updatedAt) / (1000 * 60 * 60 * 24))} days ago)`).join('\n'));
    }
  }

  // Include last session summary for continuity
  if (summaries.length > 0) {
    const last = summaries[summaries.length - 1];
    const daysSince = Math.floor((Date.now() - last.timestamp) / (1000 * 60 * 60 * 24));
    if (daysSince <= 7) {
      parts.push(`Last session (${daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`}): ${last.summary}`);
    }
  }

  if (parts.length === 0) return '';

  return `
═══ PROACTIVE CONTEXT ═══
When it feels natural (NOT every message), you can proactively bring up relevant topics:
${parts.join('\n\n')}

RULES FOR PROACTIVE SUGGESTIONS:
- Only suggest when genuinely relevant to the current conversation
- Don't force it — if nothing connects, just respond normally
- Frame suggestions naturally: "By the way...", "This reminds me...", "Since we're on this topic..."
- Don't repeat suggestions the user has already acknowledged or dismissed`;
}

/* ── Mark insight as used ── */

export function markInsightUsed(insightId: string): void {
  const insights = getInsights();
  const updated = insights.map(i =>
    i.id === insightId ? { ...i, used: true } : i
  );
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('embris_insights_v1', JSON.stringify(updated));
    } catch { /* ignore */ }
  }
}
