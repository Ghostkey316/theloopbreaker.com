/**
 * Embris Enhanced Export / Import System
 *
 * Extends the existing sync system to include ALL new data types:
 * - Memories (existing)
 * - Chat history (existing)
 * - Self-learning data (existing)
 * - Emotional intelligence data (new)
 * - Conversation summaries (new)
 * - Goals (new)
 * - Personality settings (new)
 *
 * Users can export their entire Embris profile as JSON and import on another device.
 */

import { getChatHistory, getMemories, saveChatHistory, saveMemories, type ChatMessage, type Memory } from './memory';
import { exportSelfLearningData, importSelfLearningData, type Reflection, type Pattern, type Insight, type GrowthStats } from './self-learning';
import { exportEmotionalData, importEmotionalData, type EmotionalState, type EmotionalHistoryEntry } from './emotional-intelligence';
import { exportSessionData, importSessionData, type SessionSummary } from './conversation-summaries';
import { exportGoalData, importGoalData, type Goal } from './goal-tracking';
import { exportPersonalityData, importPersonalityData, type PersonalitySettings } from './personality-tuning';

/* ── Types ── */

export interface EnhancedSyncData {
  version: number;
  exportedAt: string;
  exportSource: string;

  // Core data (existing)
  chatHistory?: ChatMessage[];
  memories?: Memory[];
  walletAddress?: string;

  // Self-learning (existing)
  selfLearning?: {
    reflections?: Reflection[];
    patterns?: Pattern[];
    insights?: Insight[];
    growth?: GrowthStats;
  };

  // New enhancement data
  emotional?: {
    currentState?: EmotionalState | null;
    history?: EmotionalHistoryEntry[];
  };
  sessionSummaries?: SessionSummary[];
  goals?: Goal[];
  personality?: PersonalitySettings;
}

/* ── Enhanced Export ── */

export function exportAllData(): EnhancedSyncData {
  return {
    version: 4, // Bumped from 3 to 4 for enhanced data
    exportedAt: new Date().toISOString(),
    exportSource: 'embris-enhanced-v4',

    // Core
    chatHistory: getChatHistory(),
    memories: getMemories(),
    walletAddress: typeof window !== 'undefined'
      ? (localStorage.getItem('vaultfire_wallet_address') ?? undefined)
      : undefined,

    // Self-learning
    selfLearning: exportSelfLearningData(),

    // New enhancements
    emotional: exportEmotionalData(),
    sessionSummaries: exportSessionData(),
    goals: exportGoalData(),
    personality: exportPersonalityData(),
  };
}

/* ── Enhanced Import ── */

export function importAllData(data: EnhancedSyncData): {
  imported: string[];
  skipped: string[];
  errors: string[];
} {
  const imported: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // Core data
  try {
    if (data.chatHistory && Array.isArray(data.chatHistory)) {
      saveChatHistory(data.chatHistory);
      imported.push(`Chat history (${data.chatHistory.length} messages)`);
    } else {
      skipped.push('Chat history (not found in backup)');
    }
  } catch (e) {
    errors.push(`Chat history: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  try {
    if (data.memories && Array.isArray(data.memories)) {
      saveMemories(data.memories);
      imported.push(`Memories (${data.memories.length})`);
    } else {
      skipped.push('Memories (not found in backup)');
    }
  } catch (e) {
    errors.push(`Memories: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  try {
    if (data.walletAddress && typeof window !== 'undefined') {
      localStorage.setItem('vaultfire_wallet_address', data.walletAddress);
      imported.push('Wallet address');
    }
  } catch (e) {
    errors.push(`Wallet: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  // Self-learning
  try {
    if (data.selfLearning) {
      importSelfLearningData(data.selfLearning);
      const parts: string[] = [];
      if (data.selfLearning.reflections) parts.push(`${data.selfLearning.reflections.length} reflections`);
      if (data.selfLearning.patterns) parts.push(`${data.selfLearning.patterns.length} patterns`);
      if (data.selfLearning.insights) parts.push(`${data.selfLearning.insights.length} insights`);
      imported.push(`Self-learning (${parts.join(', ')})`);
    } else {
      skipped.push('Self-learning data (not found in backup)');
    }
  } catch (e) {
    errors.push(`Self-learning: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  // Emotional data
  try {
    if (data.emotional) {
      importEmotionalData(data.emotional);
      imported.push(`Emotional data (${data.emotional.history?.length || 0} entries)`);
    } else {
      skipped.push('Emotional data (not found in backup)');
    }
  } catch (e) {
    errors.push(`Emotional data: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  // Session summaries
  try {
    if (data.sessionSummaries && Array.isArray(data.sessionSummaries)) {
      importSessionData(data.sessionSummaries);
      imported.push(`Session summaries (${data.sessionSummaries.length})`);
    } else {
      skipped.push('Session summaries (not found in backup)');
    }
  } catch (e) {
    errors.push(`Session summaries: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  // Goals
  try {
    if (data.goals && Array.isArray(data.goals)) {
      importGoalData(data.goals);
      imported.push(`Goals (${data.goals.length})`);
    } else {
      skipped.push('Goals (not found in backup)');
    }
  } catch (e) {
    errors.push(`Goals: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  // Personality
  try {
    if (data.personality) {
      importPersonalityData(data.personality);
      imported.push('Personality settings');
    } else {
      skipped.push('Personality settings (not found in backup)');
    }
  } catch (e) {
    errors.push(`Personality: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  return { imported, skipped, errors };
}

/* ── Get Data Stats ── */

export function getEnhancedDataStats(): {
  chatMessages: number;
  memories: number;
  reflections: number;
  patterns: number;
  insights: number;
  emotionalEntries: number;
  sessionSummaries: number;
  goals: number;
  hasPersonality: boolean;
  totalDataSize: string;
} {
  const selfLearning = exportSelfLearningData();
  const emotional = exportEmotionalData();

  let totalBytes = 0;
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('vaultfire_') || key.startsWith('embris_') || key.startsWith('ember_'))) {
        totalBytes += (localStorage.getItem(key) || '').length * 2;
      }
    }
  }

  const dataSize = totalBytes < 1024
    ? `${totalBytes} B`
    : totalBytes < 1024 * 1024
      ? `${(totalBytes / 1024).toFixed(1)} KB`
      : `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;

  const personality = exportPersonalityData();
  const hasPersonality = personality.adjustmentCount > 0 || personality.customInstructions.length > 0;

  return {
    chatMessages: getChatHistory().length,
    memories: getMemories().length,
    reflections: selfLearning.reflections.length,
    patterns: selfLearning.patterns.length,
    insights: selfLearning.insights.length,
    emotionalEntries: emotional.history.length,
    sessionSummaries: exportSessionData().length,
    goals: exportGoalData().length,
    hasPersonality,
    totalDataSize: dataSize,
  };
}

/* ── Clear All Enhanced Data ── */

export { clearEmotionalData } from './emotional-intelligence';
export { clearSessionData } from './conversation-summaries';
export { clearGoalData } from './goal-tracking';
export { clearPersonalityData } from './personality-tuning';
