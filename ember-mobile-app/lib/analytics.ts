/**
 * Embris Analytics System (Mobile)
 * Tracks usage metrics and provides insights.
 * Uses AsyncStorage for persistence.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const ANALYTICS_KEY = "@embris_analytics_v1";

export interface AnalyticsData {
  totalMessages: number;
  totalSessions: number;
  totalMemories: number;
  averageSessionLength: number;
  topTopics: Array<{ topic: string; count: number }>;
  dailyActivity: Array<{ date: string; messages: number }>;
  firstUsed: number;
  lastUsed: number;
  streakDays: number;
}

const DEFAULT_ANALYTICS: AnalyticsData = {
  totalMessages: 0,
  totalSessions: 0,
  totalMemories: 0,
  averageSessionLength: 0,
  topTopics: [],
  dailyActivity: [],
  firstUsed: 0,
  lastUsed: 0,
  streakDays: 0,
};

export async function getAnalytics(): Promise<AnalyticsData> {
  try {
    const data = await AsyncStorage.getItem(ANALYTICS_KEY);
    return data ? { ...DEFAULT_ANALYTICS, ...JSON.parse(data) } : DEFAULT_ANALYTICS;
  } catch {
    return DEFAULT_ANALYTICS;
  }
}

export async function trackMessage(topic?: string): Promise<void> {
  const analytics = await getAnalytics();
  const now = Date.now();
  const today = new Date().toISOString().split("T")[0];

  analytics.totalMessages++;
  analytics.lastUsed = now;
  if (!analytics.firstUsed) analytics.firstUsed = now;

  // Update daily activity
  const todayEntry = analytics.dailyActivity.find((d) => d.date === today);
  if (todayEntry) {
    todayEntry.messages++;
  } else {
    analytics.dailyActivity.push({ date: today, messages: 1 });
    analytics.dailyActivity = analytics.dailyActivity.slice(-30);
  }

  // Update topics
  if (topic) {
    const existing = analytics.topTopics.find((t) => t.topic === topic);
    if (existing) {
      existing.count++;
    } else {
      analytics.topTopics.push({ topic, count: 1 });
    }
    analytics.topTopics.sort((a, b) => b.count - a.count);
    analytics.topTopics = analytics.topTopics.slice(0, 10);
  }

  // Calculate streak
  const dates = analytics.dailyActivity.map((d) => d.date).sort().reverse();
  let streak = 0;
  const checkDate = new Date();
  for (const date of dates) {
    const expected = checkDate.toISOString().split("T")[0];
    if (date === expected) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  analytics.streakDays = streak;

  await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
}

export async function trackSession(): Promise<void> {
  const analytics = await getAnalytics();
  analytics.totalSessions++;
  await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
}

export async function trackMemoryCreated(): Promise<void> {
  const analytics = await getAnalytics();
  analytics.totalMemories++;
  await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
}
