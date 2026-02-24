/**
 * Agent API Screen — Mobile
 * API/SDK Reference for developers integrating with Embris by Vaultfire.
 */
import { useState } from 'react';
import {
  ScrollView, Text, View, Pressable, StyleSheet, Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DisclaimerBanner, AlphaBanner } from '@/components/disclaimer-banner';
import { ALL_CONTRACTS, CHAINS } from '@/constants/contracts';

interface Endpoint {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  category: string;
}

const ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/health', description: 'Health check — returns protocol status', category: 'System' },
  { method: 'GET', path: '/api/contracts', description: 'Returns all deployed contract addresses', category: 'Contracts' },
  { method: 'GET', path: '/api/contracts/:chain', description: 'Returns contracts for a specific chain', category: 'Contracts' },
  { method: 'GET', path: '/api/identity/:address', description: 'Lookup ERC-8004 identity registration', category: 'Identity' },
  { method: 'POST', path: '/api/identity/register', description: 'Register a new identity on-chain', category: 'Identity' },
  { method: 'GET', path: '/api/trust/:address', description: 'Get trust score and bond status', category: 'Trust' },
  { method: 'GET', path: '/api/bonds/:address', description: 'Get accountability bonds for an address', category: 'Bonds' },
  { method: 'POST', path: '/api/bonds/create', description: 'Create a new accountability bond', category: 'Bonds' },
  { method: 'GET', path: '/api/vns/:name', description: 'Resolve a VNS name to an address', category: 'VNS' },
  { method: 'POST', path: '/api/vns/register', description: 'Register a new VNS name', category: 'VNS' },
  { method: 'POST', path: '/api/zk/generate', description: 'Generate a zero-knowledge proof', category: 'ZK Proofs' },
  { method: 'POST', path: '/api/zk/verify', description: 'Verify a zero-knowledge proof', category: 'ZK Proofs' },
  { method: 'POST', path: '/api/x402/sign', description: 'Sign an x402 USDC payment', category: 'Payments' },
  { method: 'GET', path: '/api/x402/history', description: 'Get x402 payment history', category: 'Payments' },
];

const CODE_EXAMPLES = [
  {
    title: 'Python — Check Trust Score',
    language: 'python',
    code: `import requests

resp = requests.get(
    "https://embris.vaultfire.io/api/trust/0x...",
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
print(resp.json())`,
  },
  {
    title: 'JavaScript — Register Identity',
    language: 'javascript',
    code: `const res = await fetch("https://embris.vaultfire.io/api/identity/register", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    address: "0x...",
    identityType: "agent",
    chain: "base"
  })
});
const data = await res.json();`,
  },
  {
    title: 'cURL — Resolve VNS Name',
    language: 'bash',
    code: `curl -X GET "https://embris.vaultfire.io/api/vns/sentinel" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
  },
];

function CodeBlock({ code, language }: { code: string; language: string }) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={[styles.codeBlock, { backgroundColor: '#0D0D0D', borderColor: `${colors.border}40` }]}>
      <View style={[styles.codeHeader, { borderBottomColor: `${colors.border}20` }]}>
        <Text style={styles.codeLang}>{language}</Text>
        <Pressable onPress={handleCopy} style={[styles.copyBtn, { backgroundColor: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)' }]}>
          <Text style={{ color: copied ? '#22C55E' : '#71717A', fontSize: 10, fontWeight: '600' }}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={styles.codeText}>{code}</Text>
      </ScrollView>
    </View>
  );
}

type ViewMode = 'endpoints' | 'examples' | 'contracts';

export default function AgentAPIScreen() {
  const colors = useColors();
  const [viewMode, setViewMode] = useState<ViewMode>('endpoints');

  const methodColors: Record<string, string> = { GET: '#22C55E', POST: '#3B82F6' };

  const categories = [...new Set(ENDPOINTS.map(e => e.category))];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.header}>
          <View style={[styles.iconBg, { backgroundColor: `${colors.primary}15` }]}>
            <IconSymbol name="terminal.fill" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Embris API</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Developer SDK & API Reference</Text>
        </Animated.View>

        <AlphaBanner />
        <DisclaimerBanner disclaimerKey="agent_api" />

        {/* Tabs */}
        <View style={styles.tabRow}>
          {(['endpoints', 'examples', 'contracts'] as ViewMode[]).map(tab => (
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

        {viewMode === 'endpoints' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            {categories.map(category => (
              <View key={category} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{category}</Text>
                {ENDPOINTS.filter(e => e.category === category).map((endpoint, i) => (
                  <View key={i} style={[styles.endpointRow, { borderBottomColor: `${colors.border}30` }]}>
                    <View style={[styles.methodBadge, { backgroundColor: `${methodColors[endpoint.method]}20` }]}>
                      <Text style={{ color: methodColors[endpoint.method], fontSize: 9, fontWeight: '800' }}>{endpoint.method}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.endpointPath, { color: colors.foreground }]}>{endpoint.path}</Text>
                      <Text style={[styles.endpointDesc, { color: colors.muted }]}>{endpoint.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </Animated.View>
        ) : viewMode === 'examples' ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            {CODE_EXAMPLES.map((example, i) => (
              <View key={i} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{example.title}</Text>
                <CodeBlock code={example.code} language={example.language} />
              </View>
            ))}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            {(['ethereum', 'base', 'avalanche'] as const).map(chainKey => {
              const chain = CHAINS[chainKey];
              const contracts = ALL_CONTRACTS.filter(c => c.chain === chainKey);
              return (
                <View key={chainKey} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.chainHeader}>
                    <View style={[styles.chainDot, { backgroundColor: chain.color }]} />
                    <Text style={[styles.cardTitle, { color: chain.color, marginBottom: 0 }]}>{chain.name}</Text>
                    <Text style={[styles.chainId, { color: colors.muted }]}>Chain ID: {chain.chainId}</Text>
                  </View>
                  {contracts.map((contract, i) => (
                    <Pressable
                      key={i}
                      onPress={() => Clipboard.setStringAsync(contract.address)}
                      style={[styles.contractRow, { borderBottomColor: `${colors.border}30` }]}
                    >
                      <Text style={[styles.contractName, { color: colors.foreground }]}>{contract.name}</Text>
                      <Text style={[styles.contractAddr, { color: colors.muted }]}>
                        {contract.address.slice(0, 10)}...{contract.address.slice(-8)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              );
            })}
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
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  endpointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5 },
  methodBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, marginTop: 2 },
  endpointPath: { fontSize: 12, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  endpointDesc: { fontSize: 11, marginTop: 2 },
  codeBlock: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  codeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 0.5 },
  codeLang: { fontSize: 9, color: '#52525B', fontWeight: '700', textTransform: 'uppercase' },
  copyBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  codeText: { padding: 12, fontSize: 11, lineHeight: 18, color: '#A1A1AA', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  chainHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  chainDot: { width: 10, height: 10, borderRadius: 5 },
  chainId: { fontSize: 11, marginLeft: 'auto' },
  contractRow: { paddingVertical: 8, borderBottomWidth: 0.5 },
  contractName: { fontSize: 12, fontWeight: '600' },
  contractAddr: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 },
});
