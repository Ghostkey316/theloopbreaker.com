/**
 * Disclaimer Banner Component — Mobile
 * Scrollable disclaimer with always-visible accept button.
 */
import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useColors } from '@/hooks/use-colors';
import { type DisclaimerKey, DISCLAIMERS, isDisclaimerAcknowledged, acknowledgeDisclaimer } from '@/lib/disclaimers';

interface DisclaimerBannerProps {
  disclaimerKey: DisclaimerKey;
  onAcknowledge?: () => void;
}

export function DisclaimerBanner({ disclaimerKey, onAcknowledge }: DisclaimerBannerProps) {
  const colors = useColors();
  const [acknowledged, setAcknowledged] = useState(true);
  const disclaimer = DISCLAIMERS[disclaimerKey];

  useEffect(() => {
    isDisclaimerAcknowledged(disclaimerKey).then(ack => setAcknowledged(ack));
  }, [disclaimerKey]);

  if (acknowledged) return null;

  const handleAccept = async () => {
    await acknowledgeDisclaimer(disclaimerKey);
    setAcknowledged(true);
    onAcknowledge?.();
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
      <View style={[styles.container, { backgroundColor: `${colors.warning}10`, borderColor: `${colors.warning}30` }]}>
        <Text style={[styles.title, { color: colors.warning }]}>{disclaimer.title}</Text>
        <ScrollView style={styles.bodyScroll} nestedScrollEnabled showsVerticalScrollIndicator>
          <Text style={[styles.body, { color: colors.muted }]}>{disclaimer.body}</Text>
        </ScrollView>
        <Pressable
          onPress={handleAccept}
          style={({ pressed }) => [
            styles.acceptBtn,
            { backgroundColor: pressed ? `${colors.primary}CC` : colors.primary },
          ]}
        >
          <Text style={styles.acceptText}>I Understand</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function AlphaBanner() {
  const colors = useColors();
  return (
    <View style={[styles.alphaBanner, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}>
      <Text style={[styles.alphaText, { color: colors.primary }]}>
        Alpha — Experimental software. Not financial advice. Use at your own risk.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  bodyScroll: {
    maxHeight: 120,
    marginBottom: 12,
  },
  body: {
    fontSize: 12,
    lineHeight: 18,
  },
  acceptBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  alphaBanner: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  alphaText: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
});
