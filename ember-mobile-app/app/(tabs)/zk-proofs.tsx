/**
 * ZK Proofs Screen — Mobile
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, Text, View, Pressable, ActivityIndicator,
  RefreshControl, Alert, StyleSheet, Share, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DisclaimerBanner, AlphaBanner } from '@/components/disclaimer-banner';
import {
  type ZKProofType, type ZKProof, type ZKChain,
  PROOF_TYPE_INFO, generateProof, verifyProof,
  getStoredProofs, deleteProof, exportProofJSON,
} from '@/lib/zk-proofs';

type ViewMode = 'generate' | 'proofs' | 'verify';

export default function ZKProofsScreen() {
  const colors = useColors();
  const [viewMode, setViewMode] = useState<ViewMode>('generate');
  const [proofs, setProofs] = useState<ZKProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<ZKProofType>('trust_level');
  const [selectedChain, setSelectedChain] = useState<ZKChain>('base');

  const loadProofs = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await getStoredProofs();
      setProofs(stored.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error('Failed to load proofs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadProofs(); }, [loadProofs]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const proof = await generateProof({
        type: selectedType,
        chain: selectedChain,
        params: { threshold: 50, tier: 'bronze' },
      });
      setProofs(prev => [proof, ...prev]);
      setViewMode('proofs');
      Alert.alert('Proof Generated', `${PROOF_TYPE_INFO[selectedType].label} proof created successfully.`);
    } catch (err) {
      Alert.alert('Error', 'Failed to generate proof.');
    } finally {
      setGenerating(false);
    }
  };

  const handleVerify = async (proof: ZKProof) => {
    const result = await verifyProof(proof);
    Alert.alert(
      result.valid ? 'Verified' : 'Invalid',
      result.message,
    );
    loadProofs();
  };

  const handleShare = async (proof: ZKProof) => {
    try {
      await Share.share({ message: exportProofJSON(proof) });
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Proof', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteProof(id); loadProofs(); } },
    ]);
  };

  const onRefresh = useCallback(() => { setRefreshing(true); loadProofs(); }, [loadProofs]);

  const chains: { key: ZKChain; label: string; color: string }[] = [
    { key: 'base', label: 'Base', color: '#00D9FF' },
    { key: 'avalanche', label: 'Avalanche', color: '#E84142' },
    { key: 'ethereum', label: 'Ethereum', color: '#627EEA' },
  ];

  const statusColors: Record<string, string> = {
    ready: '#22C55E', verified: '#3B82F6', generating: '#F59E0B', failed: '#EF4444', expired: '#71717A',
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
            <IconSymbol name="lock.shield.fill" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Zero-Knowledge Proofs</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Prove claims without revealing data</Text>
        </Animated.View>

        <AlphaBanner />
        <DisclaimerBanner disclaimerKey="zk_proofs" />

        {/* Tabs */}
        <View style={[styles.tabRow]}>
          {(['generate', 'proofs', 'verify'] as ViewMode[]).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setViewMode(tab)}
              style={[styles.tab, viewMode === tab && { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }, { borderColor: viewMode === tab ? colors.primary : colors.border }]}
            >
              <Text style={[styles.tabText, { color: viewMode === tab ? colors.primary : colors.muted }]}>
                {tab === 'generate' ? 'Generate' : tab === 'proofs' ? `My Proofs (${proofs.length})` : 'Verify'}
              </Text>
            </Pressable>
          ))}
        </View>

        {viewMode === 'generate' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            {/* Proof Type Selection */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Select Proof Type</Text>
              {(Object.keys(PROOF_TYPE_INFO) as ZKProofType[]).map(type => {
                const info = PROOF_TYPE_INFO[type];
                const selected = selectedType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setSelectedType(type)}
                    style={[styles.proofTypeRow, {
                      backgroundColor: selected ? `${info.color}15` : 'transparent',
                      borderColor: selected ? info.color : `${colors.border}40`,
                    }]}
                  >
                    <Text style={{ fontSize: 24 }}>{info.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.proofTypeLabel, { color: selected ? info.color : colors.foreground }]}>{info.label}</Text>
                      <Text style={[styles.proofTypeDesc, { color: colors.muted }]}>{info.description}</Text>
                    </View>
                    {selected && <IconSymbol name="checkmark.circle.fill" size={20} color={info.color} />}
                  </Pressable>
                );
              })}
            </View>

            {/* Chain Selection */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Target Chain</Text>
              <View style={styles.chainRow}>
                {chains.map(chain => (
                  <Pressable
                    key={chain.key}
                    onPress={() => setSelectedChain(chain.key)}
                    style={[styles.chainBtn, {
                      backgroundColor: selectedChain === chain.key ? `${chain.color}20` : colors.background,
                      borderColor: selectedChain === chain.key ? chain.color : colors.border,
                    }]}
                  >
                    <View style={[styles.chainDot, { backgroundColor: chain.color }]} />
                    <Text style={{ color: selectedChain === chain.key ? chain.color : colors.muted, fontWeight: '600', fontSize: 12 }}>
                      {chain.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Generate Button */}
            <Pressable
              onPress={handleGenerate}
              disabled={generating}
              style={({ pressed }) => [styles.generateBtn, {
                backgroundColor: generating ? `${colors.primary}40` : pressed ? `${colors.primary}CC` : colors.primary,
              }]}
            >
              {generating ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.generateBtnText}>Generate {PROOF_TYPE_INFO[selectedType].label} Proof</Text>
              )}
            </Pressable>
          </Animated.View>
        ) : viewMode === 'proofs' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : proofs.length === 0 ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.muted }]}>No proofs generated yet. Create your first proof above.</Text>
              </View>
            ) : (
              proofs.map((proof, i) => {
                const info = PROOF_TYPE_INFO[proof.type];
                return (
                  <Animated.View key={proof.id} entering={FadeInDown.delay(i * 50).duration(200)}>
                    <View style={[styles.proofCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.proofCardHeader}>
                        <Text style={{ fontSize: 20 }}>{info.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.proofCardTitle, { color: colors.foreground }]}>{info.label}</Text>
                          <Text style={[styles.proofCardClaim, { color: colors.muted }]}>{proof.publicInputs.claim}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: `${statusColors[proof.status]}20` }]}>
                          <Text style={{ color: statusColors[proof.status], fontSize: 10, fontWeight: '700' }}>{proof.status}</Text>
                        </View>
                      </View>
                      <View style={styles.proofCardMeta}>
                        <Text style={[styles.proofCardMetaText, { color: colors.muted }]}>
                          Chain: {proof.publicInputs.chain} | {new Date(proof.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.proofCardActions}>
                        <Pressable onPress={() => handleVerify(proof)} style={[styles.actionBtn, { borderColor: '#22C55E' }]}>
                          <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>Verify</Text>
                        </Pressable>
                        <Pressable onPress={() => handleShare(proof)} style={[styles.actionBtn, { borderColor: colors.primary }]}>
                          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Share</Text>
                        </Pressable>
                        <Pressable onPress={() => handleDelete(proof.id)} style={[styles.actionBtn, { borderColor: '#EF4444' }]}>
                          <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Animated.View>
                );
              })
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Verify a Proof</Text>
              <Text style={[styles.verifyDesc, { color: colors.muted }]}>
                Paste a proof JSON to verify its authenticity. Proofs are verified against the on-chain BeliefAttestationVerifier contract.
              </Text>
              <Text style={[styles.verifyHint, { color: colors.muted }]}>
                Verification checks: commitment integrity, expiration, circuit ID, and chain validity.
              </Text>
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
  tabText: { fontSize: 11, fontWeight: '700' },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  proofTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  proofTypeLabel: { fontSize: 14, fontWeight: '700' },
  proofTypeDesc: { fontSize: 11, marginTop: 2, lineHeight: 16 },
  chainRow: { flexDirection: 'row', gap: 8 },
  chainBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  chainDot: { width: 8, height: 8, borderRadius: 4 },
  generateBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  generateBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  proofCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  proofCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  proofCardTitle: { fontSize: 14, fontWeight: '700' },
  proofCardClaim: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 },
  proofCardMeta: { marginTop: 8 },
  proofCardMetaText: { fontSize: 11 },
  proofCardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  verifyDesc: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  verifyHint: { fontSize: 11, fontStyle: 'italic' },
});
