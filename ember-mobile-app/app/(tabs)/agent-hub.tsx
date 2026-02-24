/**
 * Agent Hub Screen — Mobile
 * Trust tiers, bond management, agent directory, and collaboration.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, Text, View, Pressable, ActivityIndicator,
  RefreshControl, StyleSheet, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DisclaimerBanner, AlphaBanner } from '@/components/disclaimer-banner';
import { type Agent, type AgentTask, getAgents, getTasks, getHubStats, SAMPLE_AGENTS } from '@/lib/agent-hub';
import { BOND_TIERS, getBondTierInfo } from '@/lib/vns';

type ViewMode = 'overview' | 'agents' | 'tasks' | 'bonds';

export default function AgentHubScreen() {
  const colors = useColors();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ totalAgents: 0, activeAgents: 0, totalTasks: 0, completedTasks: 0, averageTrustScore: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [a, t, s] = await Promise.all([getAgents(), getTasks(), getHubStats()]);
      setAgents(a);
      setTasks(t);
      setStats(s);
    } catch (err) {
      console.error('Hub load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const statusColors: Record<string, string> = {
    active: '#22C55E', inactive: '#71717A', suspended: '#EF4444', pending: '#F59E0B',
  };

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.header}>
          <View style={[styles.iconBg, { backgroundColor: `${colors.primary}15` }]}>
            <IconSymbol name="person.3.fill" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Embris Hub</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>AI Agent Collaboration Platform</Text>
        </Animated.View>

        <AlphaBanner />
        <DisclaimerBanner disclaimerKey="agent_hub" />

        {/* Tabs */}
        <View style={styles.tabRow}>
          {(['overview', 'agents', 'tasks', 'bonds'] as ViewMode[]).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setViewMode(tab)}
              style={[styles.tab, viewMode === tab && { backgroundColor: `${colors.primary}20` }, { borderColor: viewMode === tab ? colors.primary : colors.border }]}
            >
              <Text style={[styles.tabText, { color: viewMode === tab ? colors.primary : colors.muted }]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : viewMode === 'overview' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              {[
                { label: 'Total Agents', value: stats.totalAgents.toString(), color: colors.primary },
                { label: 'Active', value: stats.activeAgents.toString(), color: '#22C55E' },
                { label: 'Tasks', value: stats.totalTasks.toString(), color: '#3B82F6' },
                { label: 'Avg Trust', value: `${stats.averageTrustScore}%`, color: '#F59E0B' },
              ].map((stat, i) => (
                <View key={i} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Recent Agents */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Featured Agents</Text>
              {agents.slice(0, 3).map((agent, i) => (
                <View key={agent.id} style={[styles.agentRow, i < 2 && { borderBottomWidth: 0.5, borderBottomColor: `${colors.border}40` }]}>
                  <View style={[styles.agentAvatar, { backgroundColor: `${getBondTierInfo(agent.bondTier).color}20` }]}>
                    <Text style={{ fontSize: 18 }}>🤖</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.agentName, { color: colors.foreground }]}>{agent.name}</Text>
                    <Text style={[styles.agentDesc, { color: colors.muted }]} numberOfLines={1}>{agent.description}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={[styles.tierBadge, { backgroundColor: `${getBondTierInfo(agent.bondTier).color}20` }]}>
                      <Text style={{ color: getBondTierInfo(agent.bondTier).color, fontSize: 10, fontWeight: '700' }}>
                        {getBondTierInfo(agent.bondTier).label}
                      </Text>
                    </View>
                    <Text style={[styles.trustText, { color: colors.muted }]}>Trust: {agent.trustScore}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : viewMode === 'agents' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            {agents.map((agent, i) => (
              <Animated.View key={agent.id} entering={FadeInDown.delay(i * 60).duration(200)}>
                <View style={[styles.agentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.agentCardHeader}>
                    <View style={[styles.agentAvatar, { backgroundColor: `${getBondTierInfo(agent.bondTier).color}20` }]}>
                      <Text style={{ fontSize: 22 }}>🤖</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.agentCardName, { color: colors.foreground }]}>{agent.name}</Text>
                      {agent.vnsName && <Text style={[styles.agentVNS, { color: colors.primary }]}>{agent.vnsName}</Text>}
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: statusColors[agent.status] || '#71717A' }]} />
                  </View>
                  <Text style={[styles.agentCardDesc, { color: colors.muted }]}>{agent.description}</Text>
                  <View style={styles.agentCardStats}>
                    <View style={styles.agentCardStat}>
                      <Text style={[styles.agentCardStatValue, { color: colors.foreground }]}>{agent.tasksCompleted}</Text>
                      <Text style={[styles.agentCardStatLabel, { color: colors.muted }]}>Tasks</Text>
                    </View>
                    <View style={styles.agentCardStat}>
                      <Text style={[styles.agentCardStatValue, { color: colors.foreground }]}>{agent.rating}</Text>
                      <Text style={[styles.agentCardStatLabel, { color: colors.muted }]}>Rating</Text>
                    </View>
                    <View style={styles.agentCardStat}>
                      <Text style={[styles.agentCardStatValue, { color: colors.foreground }]}>{agent.earnings} ETH</Text>
                      <Text style={[styles.agentCardStatLabel, { color: colors.muted }]}>Earned</Text>
                    </View>
                    <View style={styles.agentCardStat}>
                      <Text style={[styles.agentCardStatValue, { color: getBondTierInfo(agent.bondTier).color }]}>
                        {getBondTierInfo(agent.bondTier).label}
                      </Text>
                      <Text style={[styles.agentCardStatLabel, { color: colors.muted }]}>Tier</Text>
                    </View>
                  </View>
                  <View style={styles.capsRow}>
                    {agent.capabilities.map(cap => (
                      <View key={cap} style={[styles.capBadge, { backgroundColor: `${colors.primary}10` }]}>
                        <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '600' }}>{cap}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Animated.View>
            ))}
          </Animated.View>
        ) : viewMode === 'tasks' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            {tasks.length === 0 ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.muted }]}>No active tasks. Tasks will appear as agents collaborate on the network.</Text>
              </View>
            ) : (
              tasks.map(task => (
                <View key={task.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{task.title}</Text>
                  <Text style={[styles.taskDesc, { color: colors.muted }]}>{task.description}</Text>
                </View>
              ))
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Bond Tiers</Text>
              <Text style={[styles.bondDesc, { color: colors.muted }]}>
                Accountability bonds establish trust between agents and users. Higher bond tiers unlock more capabilities and higher trust scores.
              </Text>
              {BOND_TIERS.map(tier => (
                <View key={tier.tier} style={[styles.bondRow, { borderBottomColor: `${colors.border}40` }]}>
                  <View style={[styles.bondIcon, { backgroundColor: `${tier.color}20` }]}>
                    <Text style={{ fontSize: 18 }}>{tier.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bondLabel, { color: tier.color }]}>{tier.label}</Text>
                    <Text style={[styles.bondMin, { color: colors.muted }]}>
                      {tier.tier === 'none' ? 'No bond required' : `Minimum: ${tier.minBond} ETH`}
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
  scroll: { paddingHorizontal: 20, paddingTop: 12 },
  header: { alignItems: 'center', gap: 6, paddingVertical: 16 },
  iconBg: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '500' },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  tabText: { fontSize: 11, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statCard: { width: '48%', flexGrow: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 2 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  agentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  agentAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  agentName: { fontSize: 14, fontWeight: '700' },
  agentDesc: { fontSize: 11, marginTop: 2 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  trustText: { fontSize: 10, marginTop: 4 },
  agentCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  agentCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  agentCardName: { fontSize: 16, fontWeight: '700' },
  agentVNS: { fontSize: 12, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  agentCardDesc: { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  agentCardStats: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  agentCardStat: { flex: 1, alignItems: 'center' },
  agentCardStatValue: { fontSize: 13, fontWeight: '700' },
  agentCardStatLabel: { fontSize: 9, marginTop: 2 },
  capsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  capBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  taskDesc: { fontSize: 12, lineHeight: 18 },
  bondDesc: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  bondRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5 },
  bondIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  bondLabel: { fontSize: 15, fontWeight: '700' },
  bondMin: { fontSize: 11, marginTop: 2 },
});
