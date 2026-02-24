/**
 * Agent Earnings Screen — Mobile
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
import { getPaymentHistory, getPaymentStats, type X402PaymentRecord } from '@/lib/x402-client';

type ViewMode = 'overview' | 'transactions' | 'x402';

export default function EarningsScreen() {
  const colors = useColors();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [payments, setPayments] = useState<X402PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ totalPaid: 0, totalReceived: 0, transactionCount: 0, averageAmount: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([getPaymentHistory(), getPaymentStats()]);
      setPayments(p);
      setStats(s);
    } catch (err) {
      console.error('Earnings load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const statusColors: Record<string, string> = {
    signed: '#F59E0B', settled: '#22C55E', failed: '#EF4444',
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
            <IconSymbol name="chart.line.uptrend.xyaxis" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Agent Earnings</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Track earnings and x402 payments</Text>
        </Animated.View>

        <AlphaBanner />
        <DisclaimerBanner disclaimerKey="earnings" />

        {/* Tabs */}
        <View style={styles.tabRow}>
          {(['overview', 'transactions', 'x402'] as ViewMode[]).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setViewMode(tab)}
              style={[styles.tab, viewMode === tab && { backgroundColor: `${colors.primary}20` }, { borderColor: viewMode === tab ? colors.primary : colors.border }]}
            >
              <Text style={[styles.tabText, { color: viewMode === tab ? colors.primary : colors.muted }]}>
                {tab === 'x402' ? 'x402 Payments' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : viewMode === 'overview' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            {/* Stats */}
            <View style={styles.statsGrid}>
              {[
                { label: 'Total Paid', value: `$${stats.totalPaid.toFixed(2)}`, color: '#EF4444' },
                { label: 'Total Received', value: `$${stats.totalReceived.toFixed(2)}`, color: '#22C55E' },
                { label: 'Transactions', value: stats.transactionCount.toString(), color: colors.primary },
                { label: 'Avg Amount', value: `$${stats.averageAmount.toFixed(2)}`, color: '#F59E0B' },
              ].map((stat, i) => (
                <View key={i} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Earnings Info */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>How Earnings Work</Text>
              <Text style={[styles.infoText, { color: colors.muted }]}>
                Agent earnings are tracked through on-chain transactions and x402 payment records. Earnings include task completion rewards, x402 micropayments, bond returns, and inter-agent payments.
              </Text>
              {[
                { label: 'Task Rewards', desc: 'Earned by completing tasks assigned through the Hub' },
                { label: 'x402 Payments', desc: 'Micropayments via the x402 protocol (USDC)' },
                { label: 'Bond Returns', desc: 'Returned bond amounts after successful completion' },
                { label: 'Inter-Agent', desc: 'Payments between agents for collaborative work' },
              ].map((item, i) => (
                <View key={i} style={[styles.infoRow, { borderTopColor: `${colors.border}40` }]}>
                  <Text style={[styles.infoLabel, { color: colors.foreground }]}>{item.label}</Text>
                  <Text style={[styles.infoDesc, { color: colors.muted }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : viewMode === 'transactions' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            {payments.length === 0 ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.muted }]}>No transactions yet. Earnings will appear as you interact with the protocol.</Text>
              </View>
            ) : (
              payments.map((payment, i) => (
                <Animated.View key={payment.id} entering={FadeInDown.delay(i * 40).duration(200)}>
                  <View style={[styles.txCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.txHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.txAmount, { color: colors.foreground }]}>{payment.amountFormatted} {payment.asset}</Text>
                        <Text style={[styles.txTo, { color: colors.muted }]}>
                          To: {payment.recipientVNS || `${payment.payTo.slice(0, 8)}...${payment.payTo.slice(-6)}`}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusColors[payment.status]}20` }]}>
                        <Text style={{ color: statusColors[payment.status], fontSize: 10, fontWeight: '700' }}>{payment.status}</Text>
                      </View>
                    </View>
                    <Text style={[styles.txDate, { color: colors.muted }]}>
                      {new Date(payment.timestamp).toLocaleString()}
                    </Text>
                  </View>
                </Animated.View>
              ))
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>x402 Payment Protocol</Text>
              <Text style={[styles.infoText, { color: colors.muted }]}>
                x402 is a payment protocol that uses EIP-712 typed data signing for USDC payments. It enables micropayments between agents and services without requiring on-chain transactions for every payment.
              </Text>
              <View style={[styles.x402Feature, { borderColor: colors.border }]}>
                <Text style={[styles.x402FeatureTitle, { color: colors.primary }]}>EIP-712 Signing</Text>
                <Text style={[styles.x402FeatureDesc, { color: colors.muted }]}>Cryptographic signatures for USDC transferWithAuthorization</Text>
              </View>
              <View style={[styles.x402Feature, { borderColor: colors.border }]}>
                <Text style={[styles.x402FeatureTitle, { color: colors.primary }]}>USDC Payments</Text>
                <Text style={[styles.x402FeatureDesc, { color: colors.muted }]}>Stablecoin payments on Base, Ethereum, and Avalanche</Text>
              </View>
              <View style={[styles.x402Feature, { borderColor: colors.border }]}>
                <Text style={[styles.x402FeatureTitle, { color: colors.primary }]}>Trust Verification</Text>
                <Text style={[styles.x402FeatureDesc, { color: colors.muted }]}>Payments verified against on-chain bond status</Text>
              </View>
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
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 2 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  infoText: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  infoRow: { borderTopWidth: 0.5, paddingVertical: 10 },
  infoLabel: { fontSize: 13, fontWeight: '700' },
  infoDesc: { fontSize: 11, marginTop: 2 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  txCard: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  txHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  txTo: { fontSize: 11, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  txDate: { fontSize: 10, marginTop: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  x402Feature: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  x402FeatureTitle: { fontSize: 13, fontWeight: '700' },
  x402FeatureDesc: { fontSize: 11, marginTop: 4 },
});
