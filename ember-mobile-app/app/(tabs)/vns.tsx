/**
 * VNS (Vaultfire Naming System) Screen — Mobile
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, Text, View, TextInput, Pressable, ActivityIndicator,
  RefreshControl, Alert, StyleSheet, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DisclaimerBanner, AlphaBanner } from '@/components/disclaimer-banner';
import {
  type VNSProfile, type IdentityType, type SupportedChain, type BondTier,
  BOND_TIERS, getBondTierInfo, isValidVNSName, getMyVNSProfile,
  registerVNSName, getKnownAgents, type KnownAgent,
} from '@/lib/vns';
import { getWalletAddress, isWalletCreated } from '@/lib/wallet-core';

type ViewMode = 'register' | 'profile' | 'directory';

export default function VNSScreen() {
  const colors = useColors();
  const [viewMode, setViewMode] = useState<ViewMode>('register');
  const [profile, setProfile] = useState<VNSProfile | null>(null);
  const [agents, setAgents] = useState<KnownAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Registration state
  const [nameInput, setNameInput] = useState('');
  const [identityType, setIdentityType] = useState<IdentityType>('human');
  const [selectedChain, setSelectedChain] = useState<SupportedChain>('base');
  const [registering, setRegistering] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([getMyVNSProfile(), getKnownAgents()]);
      setProfile(p);
      setAgents(a);
      if (p) setViewMode('profile');
    } catch (err) {
      console.error('VNS load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRegister = async () => {
    const validation = isValidVNSName(nameInput);
    if (!validation.valid) {
      setNameError(validation.error || 'Invalid name');
      return;
    }
    setNameError(null);
    setRegistering(true);
    try {
      const walletCreated = await isWalletCreated();
      if (!walletCreated) {
        Alert.alert('Wallet Required', 'Please create a wallet first to register a VNS name.');
        return;
      }
      const address = await getWalletAddress();
      if (!address) {
        Alert.alert('Error', 'Could not get wallet address');
        return;
      }
      const newProfile = await registerVNSName(nameInput, address, identityType, selectedChain);
      setProfile(newProfile);
      setViewMode('profile');
      Alert.alert('Success', `${newProfile.fullName} registered successfully!`);
    } catch (err) {
      Alert.alert('Error', 'Registration failed. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const chains: { key: SupportedChain; label: string; color: string }[] = [
    { key: 'base', label: 'Base', color: '#00D9FF' },
    { key: 'avalanche', label: 'Avalanche', color: '#E84142' },
    { key: 'ethereum', label: 'Ethereum', color: '#627EEA' },
  ];

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
            <IconSymbol name="link" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Vaultfire Naming System</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Register your on-chain identity</Text>
        </Animated.View>

        <AlphaBanner />
        <DisclaimerBanner disclaimerKey="vns" />

        {/* Tab Selector */}
        <View style={[styles.tabRow, { borderColor: colors.border }]}>
          {(['register', 'profile', 'directory'] as ViewMode[]).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setViewMode(tab)}
              style={[
                styles.tab,
                viewMode === tab && { backgroundColor: `${colors.primary}20`, borderColor: colors.primary },
                { borderColor: viewMode === tab ? colors.primary : 'transparent' },
              ]}
            >
              <Text style={[styles.tabText, { color: viewMode === tab ? colors.primary : colors.muted }]}>
                {tab === 'register' ? 'Register' : tab === 'profile' ? 'My Profile' : 'Directory'}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : viewMode === 'register' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            {/* Name Input */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Choose Your Name</Text>
              <View style={[styles.inputRow, { borderColor: nameError ? colors.error : colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  value={nameInput}
                  onChangeText={t => { setNameInput(t.toLowerCase()); setNameError(null); }}
                  placeholder="your-name"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.foreground }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={[styles.suffix, { color: colors.primary }]}>.vns</Text>
              </View>
              {nameError && <Text style={[styles.errorText, { color: colors.error }]}>{nameError}</Text>}

              {/* Identity Type */}
              <Text style={[styles.label, { color: colors.foreground }]}>Identity Type</Text>
              <View style={styles.optionRow}>
                {(['human', 'agent'] as IdentityType[]).map(type => (
                  <Pressable
                    key={type}
                    onPress={() => setIdentityType(type)}
                    style={[
                      styles.optionBtn,
                      {
                        backgroundColor: identityType === type ? `${colors.primary}20` : colors.background,
                        borderColor: identityType === type ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: identityType === type ? colors.primary : colors.muted, fontWeight: '600', fontSize: 13 }}>
                      {type === 'human' ? '👤 Human' : '🤖 AI Agent'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Chain Selection */}
              <Text style={[styles.label, { color: colors.foreground }]}>Registration Chain</Text>
              <View style={styles.optionRow}>
                {chains.map(chain => (
                  <Pressable
                    key={chain.key}
                    onPress={() => setSelectedChain(chain.key)}
                    style={[
                      styles.optionBtn,
                      {
                        backgroundColor: selectedChain === chain.key ? `${chain.color}20` : colors.background,
                        borderColor: selectedChain === chain.key ? chain.color : colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.chainDot, { backgroundColor: chain.color }]} />
                    <Text style={{ color: selectedChain === chain.key ? chain.color : colors.muted, fontWeight: '600', fontSize: 12 }}>
                      {chain.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Register Button */}
              <Pressable
                onPress={handleRegister}
                disabled={registering || !nameInput}
                style={({ pressed }) => [
                  styles.registerBtn,
                  {
                    backgroundColor: registering || !nameInput ? `${colors.primary}40` : pressed ? `${colors.primary}CC` : colors.primary,
                  },
                ]}
              >
                {registering ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.registerBtnText}>Register {nameInput ? `${nameInput}.vns` : 'Name'}</Text>
                )}
              </Pressable>
            </View>

            {/* Bond Tiers Info */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Bond Tiers</Text>
              {BOND_TIERS.map(tier => (
                <View key={tier.tier} style={[styles.tierRow, { borderBottomColor: `${colors.border}40` }]}>
                  <View style={[styles.tierIcon, { backgroundColor: `${tier.color}20` }]}>
                    <Text style={{ fontSize: 16 }}>{tier.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
                    <Text style={[styles.tierMin, { color: colors.muted }]}>
                      {tier.tier === 'none' ? 'No bond required' : `Min: ${tier.minBond} ETH`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : viewMode === 'profile' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            {profile ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.profileHeader}>
                  <View style={[styles.profileAvatar, { backgroundColor: `${colors.primary}20` }]}>
                    <Text style={{ fontSize: 28 }}>{profile.identityType === 'human' ? '👤' : '🤖'}</Text>
                  </View>
                  <Text style={[styles.profileName, { color: colors.primary }]}>{profile.fullName}</Text>
                  <Text style={[styles.profileAddr, { color: colors.muted }]}>
                    {profile.address.slice(0, 8)}...{profile.address.slice(-6)}
                  </Text>
                </View>
                <View style={styles.profileStats}>
                  {[
                    { label: 'Chain', value: profile.chain },
                    { label: 'Bond Tier', value: getBondTierInfo(profile.bondTier).label },
                    { label: 'Trust Score', value: `${profile.trustScore}` },
                    { label: 'Type', value: profile.identityType },
                  ].map((stat, i) => (
                    <View key={i} style={[styles.profileStat, { borderColor: colors.border }]}>
                      <Text style={[styles.profileStatValue, { color: colors.foreground }]}>{stat.value}</Text>
                      <Text style={[styles.profileStatLabel, { color: colors.muted }]}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.muted }]}>No VNS profile found. Register a name first.</Text>
              </View>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Known Agents</Text>
              {agents.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.muted }]}>No agents discovered yet. Agents appear as you interact with the network.</Text>
              ) : (
                agents.map((agent, i) => (
                  <View key={i} style={[styles.agentRow, { borderBottomColor: `${colors.border}40` }]}>
                    <View style={[styles.agentIcon, { backgroundColor: `${getBondTierInfo(agent.bondTier).color}20` }]}>
                      <Text style={{ fontSize: 14 }}>{agent.identityType === 'human' ? '👤' : '🤖'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.agentName, { color: colors.foreground }]}>{agent.name}.vns</Text>
                      <Text style={[styles.agentAddr, { color: colors.muted }]}>{agent.address}</Text>
                    </View>
                    <View style={[styles.trustBadge, { backgroundColor: `${getBondTierInfo(agent.bondTier).color}20` }]}>
                      <Text style={{ color: getBondTierInfo(agent.bondTier).color, fontSize: 10, fontWeight: '700' }}>
                        {getBondTierInfo(agent.bondTier).label}
                      </Text>
                    </View>
                  </View>
                ))
              )}
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
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  tabText: { fontSize: 12, fontWeight: '700' },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 48 },
  input: { flex: 1, fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  suffix: { fontSize: 16, fontWeight: '700', marginLeft: 4 },
  errorText: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  chainDot: { width: 8, height: 8, borderRadius: 4 },
  registerBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  registerBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5 },
  tierIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  tierLabel: { fontSize: 14, fontWeight: '700' },
  tierMin: { fontSize: 11, marginTop: 2 },
  profileHeader: { alignItems: 'center', gap: 6, paddingBottom: 16 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  profileName: { fontSize: 20, fontWeight: '800' },
  profileAddr: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  profileStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  profileStat: { width: '47%', borderRadius: 8, borderWidth: 1, padding: 12, alignItems: 'center' },
  profileStatValue: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  profileStatLabel: { fontSize: 10, marginTop: 2 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  agentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5 },
  agentIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  agentName: { fontSize: 13, fontWeight: '700' },
  agentAddr: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  trustBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
