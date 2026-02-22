import { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getAnalytics, type AnalyticsData } from "@/lib/analytics";
import { getLearningStats, type LearningStats } from "@/lib/self-learning";
import { getGoals } from "@/lib/goal-tracking";
import { getMemories } from "@/lib/memory";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function AnalyticsScreen() {
  const colors = useColors();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [goalCount, setGoalCount] = useState(0);
  const [memoryCount, setMemoryCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [a, ls, goals, memories] = await Promise.all([
      getAnalytics(),
      getLearningStats(),
      getGoals(),
      getMemories(),
    ]);
    setAnalytics(a);
    setLearningStats(ls);
    setGoalCount(goals.filter((g) => g.status === "active").length);
    setMemoryCount(memories.length);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const statCards = [
    {
      label: "Messages",
      value: analytics?.totalMessages?.toString() || "0",
      icon: "bubble.left.fill" as const,
      color: colors.primary,
    },
    {
      label: "Sessions",
      value: analytics?.totalSessions?.toString() || "0",
      icon: "flame.fill" as const,
      color: colors.success,
    },
    {
      label: "Memories",
      value: memoryCount.toString(),
      icon: "person.fill" as const,
      color: "#8B5CF6",
    },
    {
      label: "Active Goals",
      value: goalCount.toString(),
      icon: "chart.bar.fill" as const,
      color: colors.warning,
    },
  ];

  const learningCards = [
    { label: "Conversations", value: learningStats?.totalConversations || 0 },
    { label: "Reflections", value: learningStats?.totalReflections || 0 },
    { label: "Patterns", value: learningStats?.totalPatterns || 0 },
    { label: "Insights", value: learningStats?.totalInsights || 0 },
  ];

  const daysSinceFirst = analytics?.firstUsed
    ? Math.floor((Date.now() - analytics.firstUsed) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Analytics</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Your Embris usage insights
          </Text>
        </Animated.View>

        {/* Streak Banner */}
        {(analytics?.streakDays || 0) > 0 && (
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            style={[styles.streakBanner, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}
          >
            <Text style={{ fontSize: 24 }}>🔥</Text>
            <View>
              <Text style={[styles.streakValue, { color: colors.primary }]}>
                {analytics?.streakDays} day streak
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {daysSinceFirst} days with Embris
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Stats Grid */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Overview
          </Text>
          <View style={styles.statsGrid}>
            {statCards.map((stat, idx) => (
              <View
                key={idx}
                style={[
                  styles.statCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <IconSymbol name={stat.icon} size={20} color={stat.color} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Self-Learning Stats */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Self-Learning
          </Text>
          <View
            style={[
              styles.learningCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {learningCards.map((item, idx) => (
              <View key={idx} style={styles.learningRow}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{item.label}</Text>
                <Text style={[styles.learningValue, { color: colors.primary }]}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Top Topics */}
        {analytics?.topTopics && analytics.topTopics.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Top Topics
            </Text>
            <View
              style={[
                styles.topicsCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {analytics.topTopics.slice(0, 5).map((topic, idx) => (
                <View key={idx} style={styles.topicRow}>
                  <Text style={{ color: colors.foreground, fontSize: 13, flex: 1 }}>
                    {topic.topic}
                  </Text>
                  <View
                    style={[
                      styles.topicBadge,
                      { backgroundColor: `${colors.primary}20` },
                    ]}
                  >
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>
                      {topic.count}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  header: { alignItems: "center", gap: 4, paddingVertical: 16 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 14 },
  streakBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  streakValue: { fontSize: 16, fontWeight: "700" },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12, letterSpacing: -0.2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "47%",
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 11 },
  learningCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  learningRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  learningValue: { fontSize: 16, fontWeight: "700" },
  topicsCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topicBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
});
