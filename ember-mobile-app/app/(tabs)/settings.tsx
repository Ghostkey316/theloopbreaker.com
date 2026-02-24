/**
 * Settings Screen — Mobile
 */
import { useState, useEffect } from 'react';
import {
  ScrollView, Text, View, Pressable, Switch, Alert,
  StyleSheet, Linking, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AlphaBanner } from '@/components/disclaimer-banner';
import { resetAllDisclaimers, getAcknowledgedCount, DISCLAIMERS, type DisclaimerKey } from '@/lib/disclaimers';
import { getTrustGateConfig, setTrustGateLevel, TRUST_GATE_LEVELS, type TrustGateLevel } from '@/lib/trust-gate';
import { getSpendingLimits, saveSpendingLimits, type SpendingLimit } from '@/lib/spending-limits';
import { CHAINS, VAULTFIRE_WEBSITE, CORE_VALUES } from '@/constants/contracts';

export default function SettingsScreen() {
  const colors = useColors();
  const [disclaimerCount, setDisclaimerCount] = useState(0);
  const [trustGateLevel, setTrustGateLevelState] = useState<TrustGateLevel>('none');
  const [spendingEnabled, setSpendingEnabled] = useState(false);
  const [spendingLimits, setSpendingLimitsState] = useState<SpendingLimit | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const count = await getAcknowledgedCount();
    setDisclaimerCount(count);

    const tg = await getTrustGateConfig();
    setTrustGateLevelState(tg.minimumTier as TrustGateLevel);

    const sl = await getSpendingLimits();
    setSpendingLimitsState(sl);
    setSpendingEnabled(sl.enabled);
  };

  const handleResetDisclaimers = () => {
    Alert.alert('Reset Disclaimers', 'This will show all disclaimers again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => { await resetAllDisclaimers(); setDisclaimerCount(0); } },
    ]);
  };

  const handleTrustGateChange = async (level: TrustGateLevel) => {
    await setTrustGateLevel(level);
    setTrustGateLevelState(level);
  };

  const handleSpendingToggle = async (enabled: boolean) => {
    setSpendingEnabled(enabled);
    if (spendingLimits) {
      await saveSpendingLimits({ ...spendingLimits, enabled });
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.header}>
          <View style={[styles.iconBg, { backgroundColor: `${colors.primary}15` }]}>
            <IconSymbol name="gearshape.fill" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        </Animated.View>

        <AlphaBanner />

        {/* Trust Gate */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Trust Gate</Text>
            <Text style={[styles.cardDesc, { color: colors.muted }]}>
              Set minimum bond tier for outgoing payments
            </Text>
            <View style={styles.trustGateOptions}>
              {TRUST_GATE_LEVELS.map(level => (
                <Pressable
                  key={level.value}
                  onPress={() => handleTrustGateChange(level.value)}
                  style={[
                    styles.trustOption,
                    {
                      backgroundColor: trustGateLevel === level.value ? `${level.color}20` : colors.background,
                      borderColor: trustGateLevel === level.value ? level.color : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: trustGateLevel === level.value ? level.color : colors.muted, fontSize: 12, fontWeight: '700' }}>
                    {level.label}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 9, marginTop: 2 }}>{level.description}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Spending Limits */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 0 }]}>Spending Limits</Text>
              <Switch
                value={spendingEnabled}
                onValueChange={handleSpendingToggle}
                trackColor={{ false: colors.border, true: `${colors.primary}60` }}
                thumbColor={spendingEnabled ? colors.primary : '#f4f3f4'}
              />
            </View>
            {spendingEnabled && spendingLimits && (
              <View style={{ marginTop: 12 }}>
                {[
                  { label: 'Per Transaction', value: `${spendingLimits.perTransaction} ETH` },
                  { label: 'Daily', value: `${spendingLimits.daily} ETH` },
                  { label: 'Weekly', value: `${spendingLimits.weekly} ETH` },
                  { label: 'Monthly', value: `${spendingLimits.monthly} ETH` },
                ].map((limit, i) => (
                  <View key={i} style={[styles.limitRow, { borderBottomColor: `${colors.border}30` }]}>
                    <Text style={[styles.limitLabel, { color: colors.muted }]}>{limit.label}</Text>
                    <Text style={[styles.limitValue, { color: colors.foreground }]}>{limit.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Animated.View>

        {/* Disclaimers */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Disclaimers</Text>
            <Text style={[styles.cardDesc, { color: colors.muted }]}>
              {disclaimerCount} of {Object.keys(DISCLAIMERS).length} disclaimers acknowledged
            </Text>
            <Pressable
              onPress={handleResetDisclaimers}
              style={({ pressed }) => [styles.resetBtn, { backgroundColor: pressed ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)', borderColor: '#EF4444' }]}
            >
              <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>Reset All Disclaimers</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Network Info */}
        <Animated.View entering={FadeInDown.delay(250).duration(300)}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Networks</Text>
            {(['ethereum', 'base', 'avalanche'] as const).map(chainKey => {
              const chain = CHAINS[chainKey];
              return (
                <View key={chainKey} style={[styles.networkRow, { borderBottomColor: `${colors.border}30` }]}>
                  <View style={[styles.networkDot, { backgroundColor: chain.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.networkName, { color: colors.foreground }]}>{chain.name}</Text>
                    <Text style={[styles.networkRpc, { color: colors.muted }]}>Chain ID: {chain.chainId}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>About Embris</Text>
            <Text style={[styles.coreValues, { color: colors.primary }]}>{CORE_VALUES}</Text>
            <Text style={[styles.cardDesc, { color: colors.muted }]}>
              Embris by Vaultfire Protocol — the first ethical AI trust protocol. Deployed across Ethereum, Base, and Avalanche.
            </Text>
            <Pressable
              onPress={() => Linking.openURL(VAULTFIRE_WEBSITE)}
              style={({ pressed }) => [styles.linkBtn, { backgroundColor: pressed ? `${colors.primary}20` : `${colors.primary}10` }]}
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Visit theloopbreaker.com</Text>
            </Pressable>
          </View>
        </Animated.View>

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
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardDesc: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trustGateOptions: { gap: 6 },
  trustOption: { padding: 12, borderRadius: 8, borderWidth: 1 },
  limitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5 },
  limitLabel: { fontSize: 12 },
  limitValue: { fontSize: 12, fontWeight: '700' },
  resetBtn: { borderRadius: 8, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  networkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 0.5 },
  networkDot: { width: 10, height: 10, borderRadius: 5 },
  networkName: { fontSize: 13, fontWeight: '700' },
  networkRpc: { fontSize: 10, marginTop: 2 },
  coreValues: { fontSize: 13, fontWeight: '700', fontStyle: 'italic', marginBottom: 8 },
  linkBtn: { borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
});
