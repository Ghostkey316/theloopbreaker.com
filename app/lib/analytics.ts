/**
 * Embris Analytics — User Data Visualization
 *
 * Aggregates user data from all Embris systems for dashboard display.
 */

import { getMemories } from './memory';
import { getGrowthStats, getReflections, getPatterns, getInsights } from './self-learning';
import { getGoals } from './goal-tracking';
import { getSessionSummaries } from './conversation-summaries';
import { getEmotionalHistory, type EmotionalHistoryEntry } from './emotional-intelligence';
import { isRegistered } from './registration';

/* ── Types ── */

export interface AnalyticsData {
  totalConversations: number;
  totalMemories: number;
  reflectionsCount: number;
  patternsCount: number;
  insightsCount: number;
  goalsTracked: number;
  goalsCompleted: number;
  goalsActive: number;
  sessionsCount: number;
  memoryCategories: Record<string, number>;
  emotionalTimeline: EmotionalHistoryEntry[];
  patternCategories: Record<string, number>;
  isRegistered: boolean;
  growthRate: number; // memories per conversation
  topMoods: Array<{ mood: string; count: number }>;
}

export function getAnalyticsData(): AnalyticsData {
  const registered = isRegistered();
  if (!registered) {
    return {
      totalConversations: 0,
      totalMemories: 0,
      reflectionsCount: 0,
      patternsCount: 0,
      insightsCount: 0,
      goalsTracked: 0,
      goalsCompleted: 0,
      goalsActive: 0,
      sessionsCount: 0,
      memoryCategories: {},
      emotionalTimeline: [],
      patternCategories: {},
      isRegistered: false,
      growthRate: 0,
      topMoods: [],
    };
  }

  const memories = getMemories();
  const stats = getGrowthStats();
  const reflections = getReflections();
  const patterns = getPatterns();
  const insights = getInsights();
  const goals = getGoals();
  const sessions = getSessionSummaries();
  const emotionalHistory = getEmotionalHistory();

  // Memory categories breakdown
  const memoryCategories: Record<string, number> = {};
  memories.forEach(m => {
    const cat = m.category || 'general';
    memoryCategories[cat] = (memoryCategories[cat] || 0) + 1;
  });

  // Pattern categories breakdown
  const patternCategories: Record<string, number> = {};
  patterns.forEach(p => {
    patternCategories[p.category] = (patternCategories[p.category] || 0) + 1;
  });

  // Top moods
  const moodCounts: Record<string, number> = {};
  emotionalHistory.forEach(e => {
    moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
  });
  const topMoods = Object.entries(moodCounts)
    .map(([mood, count]) => ({ mood, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const growthRate = stats.totalConversations > 0
    ? Math.round((memories.length / stats.totalConversations) * 10) / 10
    : 0;

  return {
    totalConversations: stats.totalConversations,
    totalMemories: memories.length,
    reflectionsCount: reflections.length,
    patternsCount: patterns.length,
    insightsCount: insights.length,
    goalsTracked: goals.length,
    goalsCompleted: goals.filter(g => g.status === 'completed').length,
    goalsActive: goals.filter(g => g.status === 'active').length,
    sessionsCount: sessions.length,
    memoryCategories,
    emotionalTimeline: emotionalHistory.slice(-30),
    patternCategories,
    isRegistered: true,
    growthRate,
    topMoods,
  };
}
