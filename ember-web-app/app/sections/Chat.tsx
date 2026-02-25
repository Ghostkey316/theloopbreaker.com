'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat, API_KEY } from '../lib/stream-chat';
import {
  extractMemories,
  extractMemoriesWithAI,
  getMemories,
  saveMemories,
  clearChatHistory,
  deduplicateMemories,
  type ChatMessage,
  type Memory,
} from '../lib/memory';
import {
  runSelfLearning,
  getGrowthStats,
} from '../lib/self-learning';
import { getWalletAddress } from '../lib/wallet';

// Enhancement imports
import {
  analyzeMood,
  type EmotionalState,
} from '../lib/emotional-intelligence';
import {
  incrementMessageCount,
} from '../lib/proactive-suggestions';
import {
  updateCurrentSession,
  generateSessionSummary,
} from '../lib/conversation-summaries';
import {
  getGoals,
  extractGoalsFromMessage,
  processGoalExtraction,
} from '../lib/goal-tracking';
import {
  applyPersonalityFeedback,
} from '../lib/personality-tuning';

// Registration imports
import {
  isRegistered,
  getAvailableFeatures,
  resetNudgeCounter,
} from '../lib/registration';
import RegistrationModal from '../components/RegistrationModal';
import RegistrationBanner from '../components/RegistrationBanner';
import DisclaimerBanner, { AlphaBanner } from '../components/DisclaimerBanner';
import CompanionPanel from '../components/CompanionPanel';

// Voice Mode imports
import {
  getVoiceModeEnabled,
  setVoiceModeEnabled,
  isSpeechRecognitionSupported,
  createSpeechRecognition,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
  getVoiceRate,
  setVoiceRate,
  getVoicePitch,
  setVoicePitch,
  preloadVoices,
  type SpeechRecognitionInstance,
} from '../lib/voice-mode';

// Contract Interaction imports
import {
  detectContractQuery,
  executeContractQuery,
} from '../lib/contract-interaction';

// Companion Engine imports (execution layer with real tools)
import {
  detectExecutableTasks,
  executeTask,
  filterResultThroughPersonality,
  detectTask,
  callThinkAPI,
  recordEngineCall,
  recordLocalBrainHandled,
  type ExecutionTask,
  type EngineResult,
} from '../lib/companion-engine';

// Companion Brain imports
import {
  tryLocalAnswer,
  generateLocalFallback,
  detectAction,
  executeAction,
  learnFromExchange,
  getCompanionIntroduction,
  shouldShowIntroduction,
  markIntroductionShown,
  getBrainStats,
  type CompanionAction,
} from '../lib/companion-brain';
import {
  isCompanionWalletCreated,
  getCompanionAddress,
  getCompanionBondStatus,
  getCompanionVNSName,
  getCompanionAgentName,
} from '../lib/companion-agent';

// Multi-conversation imports
import {
  type ConversationMeta,
  getConversationIndex,
  setActiveConversationId,
  createConversation,
  deleteConversation,
  getConversationMessages,
  saveConversationMessages,
  updateConversationTitle,
  ensureActiveConversation,
} from '../lib/conversations';

interface ChatMessageWithStatus extends ChatMessage {
  isStreaming?: boolean;
  imageUrl?: string; // attached image (data URL or external URL)
  gifUrl?: string;   // attached GIF URL
}

const SUGGESTED_PROMPTS_REGISTERED = [
  'What can you do?',
  'Show me the Base contracts',
  'What are my goals?',
  'What do you remember about me?',
  'Show me your brain stats',
  'Check my balance',
];

const SUGGESTED_PROMPTS_UNREGISTERED = [
  'What can you do?',
  'Tell me about Vaultfire',
  'What is ERC-8004?',
  'Show me the contracts',
  'How does the protocol work?',
  'What makes you different from a chatbot?',
];

/* ── SVG Icons ── */
function SendIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function TrashIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ShieldCheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function MicIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SpeakerIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function StopCircleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}

function SettingsIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SidebarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

/* Small Embris flame icon for chat responses */
function EmbrisFlame() {
  return (
    <div className="glow-pulse" style={{ flexShrink: 0, marginTop: 3 }}>
      <svg width={16} height={16} viewBox="0 0 32 32" fill="none">
        <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
        <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
      </svg>
    </div>
  );
}

/* Animated Embris flame for speaking state */
function EmbrisFlameSpeaking() {
  return (
    <div className="embris-speaking-flame" style={{ flexShrink: 0, marginTop: 3, position: 'relative' }}>
      <svg width={16} height={16} viewBox="0 0 32 32" fill="none">
        <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
        <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
      </svg>
      <div style={{
        position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
        borderRadius: '50%',
        border: '1.5px solid rgba(249,115,22,0.4)',
        animation: 'embrisSpeakPulse 1.2s ease-in-out infinite',
      }} />
    </div>
  );
}

/* Voice waveform animation for speaking indicator */
function VoiceWaveform() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 16 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="voice-wave-bar"
          style={{
            width: 2,
            height: 4,
            borderRadius: 1,
            backgroundColor: '#F97316',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

/* Mood indicator dot */
function MoodDot({ mood }: { mood: string }) {
  const moodColors: Record<string, string> = {
    excited: '#F59E0B',
    happy: '#22C55E',
    neutral: '#71717A',
    confused: '#A78BFA',
    frustrated: '#EF4444',
    stressed: '#F97316',
    sad: '#6366F1',
    curious: '#06B6D4',
    determined: '#F97316',
  };
  const color = moodColors[mood] || '#71717A';
  return (
    <span style={{
      display: 'inline-block',
      width: 6, height: 6, borderRadius: '50%',
      backgroundColor: color, marginRight: 4, opacity: 0.8,
    }} title={`Mood: ${mood}`} />
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ color: '#F4F4F5', fontWeight: 600, margin: '0.875rem 0 0.25rem', fontSize: '0.95em', letterSpacing: '-0.015em' }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ color: '#F4F4F5', fontWeight: 600, margin: '1rem 0 0.375rem', fontSize: '1.05em', letterSpacing: '-0.02em' }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ color: '#F4F4F5', fontWeight: 700, margin: '1.25rem 0 0.5rem', fontSize: '1.15em', letterSpacing: '-0.025em' }}>{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} style={{ marginLeft: '1.25rem', margin: '0.25rem 0', lineHeight: 1.7 }}>{renderInline(line.slice(2))}</li>);
    } else if (line.match(/^\d+\. /)) {
      elements.push(<li key={i} style={{ marginLeft: '1.25rem', margin: '0.25rem 0', listStyleType: 'decimal', lineHeight: 1.7 }}>{renderInline(line.replace(/^\d+\. /, ''))}</li>);
    } else if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} style={{ borderLeft: '2px solid rgba(255,255,255,0.06)', paddingLeft: '0.75rem', color: '#A1A1AA', fontStyle: 'italic', margin: '0.5rem 0' }}>{line.slice(2)}</blockquote>);
    } else if (line === '---' || line === '***') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.03)', margin: '1.25rem 0' }} />);
    } else if (line === '') {
      elements.push(<br key={i} />);
    } else {
      elements.push(<p key={i} style={{ margin: '0.375rem 0', lineHeight: 1.75 }}>{renderInline(line)}</p>);
    }
    i++;
  }
  return <div className="prose-embris">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '0.1rem 0.35rem', fontSize: '0.85em', color: '#E4E4E7', fontFamily: "'JetBrains Mono', monospace" }}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#F4F4F5', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ color: '#A1A1AA' }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

/* Premium typing indicator */
function TypingIndicator() {
  return (
    <div
      className="typing-indicator-enter"
      style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '10px 0 6px' }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="typing-dot"
          style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#52525B', animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

/* ── Agent Status Bar (shows companion wallet, bond, VNS, capabilities) ── */
function AgentStatusBar({ isMobile }: { isMobile: boolean }) {
  const created = isCompanionWalletCreated();
  const address = getCompanionAddress();
  const bond = getCompanionBondStatus();
  const vns = getCompanionVNSName();
  const agentName = getCompanionAgentName();
  const stats = getBrainStats();

  const tierColors: Record<string, string> = {
    bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700', platinum: '#E5E4E2',
  };

  // Always show the status bar — show minimal version when companion not initialized
  if (!created) {
    return (
      <div className="fade-in" style={{
        padding: isMobile ? '8px 16px' : '8px 24px',
        backgroundColor: 'rgba(249,115,22,0.03)',
        borderBottom: '1px solid rgba(249,115,22,0.08)',
        display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14,
        flexWrap: 'wrap', flexShrink: 0,
        overflow: 'hidden',
      }}>
        {/* Flame icon */}
        <svg width={14} height={14} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
          <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.5" />
          <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" opacity="0.5" />
        </svg>
        <span style={{ fontSize: 10, color: '#52525B', fontWeight: 500 }}>Embris Agent</span>
        <span style={{ fontSize: 10, color: '#3F3F46' }}>Wallet: Not Activated</span>
        <span style={{ fontSize: 10, color: '#3F3F46' }}>No Bond</span>
        {!isMobile && (
          <span style={{ fontSize: 10, color: '#52525B', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            Brain: {stats.knowledgeEntries} topics
            <span style={{ color: '#F97316', fontWeight: 500, cursor: 'default' }}>
              ← Activate via Companion Agent button
            </span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="fade-in" style={{
      padding: isMobile ? '8px 16px' : '8px 24px',
      backgroundColor: 'rgba(249,115,22,0.03)',
      borderBottom: '1px solid rgba(249,115,22,0.08)',
      display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14,
      flexWrap: 'wrap', flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Flame icon */}
      <svg width={14} height={14} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
        <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
        <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
      </svg>

      {/* Wallet address */}
      {address && (
        <span style={{
          fontSize: 10, color: '#71717A',
          fontFamily: "'JetBrains Mono', monospace",
          backgroundColor: 'rgba(255,255,255,0.03)',
          padding: '2px 6px', borderRadius: 4,
        }}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      )}

      {/* Bond status */}
      {bond.active ? (
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: (bond.tier && tierColors[bond.tier]) || '#CD7F32',
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            backgroundColor: (bond.tier && tierColors[bond.tier]) || '#CD7F32',
          }} />
          {bond.tier ? bond.tier.charAt(0).toUpperCase() + bond.tier.slice(1) : 'Active'} Bond
        </span>
      ) : (
        <span style={{ fontSize: 10, color: '#3F3F46' }}>No Bond</span>
      )}

      {/* VNS name */}
      {vns ? (
        <span style={{
          fontSize: 10, color: '#F97316', fontWeight: 500,
          backgroundColor: 'rgba(249,115,22,0.08)',
          padding: '2px 6px', borderRadius: 4,
        }}>
          {vns}
        </span>
      ) : (
        <span style={{ fontSize: 10, color: '#3F3F46' }}>{agentName}.vns</span>
      )}

      {/* Brain stats */}
      {!isMobile && (
        <span style={{ fontSize: 10, color: '#3F3F46', marginLeft: 'auto' }}>
          Brain: {stats.knowledgeEntries} topics
          {stats.learnedInsights > 0 && ` · ${stats.learnedInsights} learned`}
          {stats.memoriesCount > 0 && ` · ${stats.memoriesCount} memories`}
        </span>
      )}
    </div>
  );
}

/* ── Common Emoji Set ── */
const EMOJI_LIST = [
  '\uD83D\uDE00','\uD83D\uDE02','\uD83D\uDE0D','\uD83E\uDD29','\uD83D\uDE0E','\uD83E\uDD14','\uD83D\uDE31','\uD83D\uDE4F','\uD83D\uDC4D','\uD83D\uDC4E',
  '\uD83D\uDD25','\u2764\uFE0F','\uD83D\uDCAF','\uD83D\uDE80','\u2728','\uD83C\uDF89','\uD83D\uDCA1','\uD83D\uDCAA','\uD83E\uDDE0','\uD83D\uDEE1\uFE0F',
  '\u26A1','\uD83C\uDF1F','\uD83D\uDD17','\uD83D\uDCB0','\uD83C\uDFAF','\uD83D\uDCDD','\u2705','\u274C','\u26A0\uFE0F','\uD83D\uDD12',
  '\uD83D\uDC40','\uD83D\uDE4C','\uD83E\uDD1D','\uD83D\uDCAC','\uD83C\uDF10','\uD83D\uDCCA','\u2699\uFE0F','\uD83D\uDD0D','\uD83C\uDFC6','\uD83C\uDF1E',
];

/* ── Emoji Picker Component ── */
function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  return (
    <div
      className="fade-in"
      style={{
        position: 'absolute', bottom: '100%', left: 0,
        marginBottom: 8, padding: 8,
        backgroundColor: '#18181B', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)',
        gap: 2, width: 280, zIndex: 50,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {EMOJI_LIST.map((emoji, i) => (
        <button
          key={i}
          onClick={() => { onSelect(emoji); onClose(); }}
          style={{
            width: 26, height: 26, fontSize: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background-color 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/* ── GIF Picker Component (uses Tenor API) ── */
function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<Array<{ url: string; preview: string }>>([]);
  const [loading, setLoading] = useState(false);

  const searchGifs = useCallback(async (q: string) => {
    if (!q.trim()) { setGifs([]); return; }
    setLoading(true);
    try {
      // Use Tenor v2 API with a public key for basic search
      const res = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&limit=12&media_filter=gif,tinygif`
      );
      if (res.ok) {
        const data = await res.json();
        const results = (data.results || []).map((r: { media_formats?: { gif?: { url?: string }; tinygif?: { url?: string } } }) => ({
          url: r.media_formats?.gif?.url || '',
          preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
        })).filter((g: { url: string }) => g.url);
        setGifs(results);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchGifs(query), 400);
    return () => clearTimeout(timer);
  }, [query, searchGifs]);

  return (
    <div
      className="fade-in"
      style={{
        position: 'absolute', bottom: '100%', left: 0,
        marginBottom: 8, padding: 10,
        backgroundColor: '#18181B', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        width: 320, maxHeight: 360, zIndex: 50,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search GIFs..."
        autoFocus
        style={{
          width: '100%', padding: '6px 10px', fontSize: 13,
          backgroundColor: '#09090B', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8, color: '#E4E4E7', outline: 'none',
          fontFamily: "'Inter', sans-serif",
        }}
      />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 4, overflowY: 'auto', maxHeight: 280,
      }}>
        {loading && <span style={{ fontSize: 11, color: '#52525B', gridColumn: '1 / -1', textAlign: 'center', padding: 12 }}>Searching...</span>}
        {!loading && gifs.length === 0 && query && (
          <span style={{ fontSize: 11, color: '#3F3F46', gridColumn: '1 / -1', textAlign: 'center', padding: 12 }}>No GIFs found</span>
        )}
        {!loading && gifs.length === 0 && !query && (
          <span style={{ fontSize: 11, color: '#3F3F46', gridColumn: '1 / -1', textAlign: 'center', padding: 12 }}>Type to search for GIFs</span>
        )}
        {gifs.map((gif, i) => (
          <button
            key={i}
            onClick={() => { onSelect(gif.url); onClose(); }}
            style={{
              width: '100%', aspectRatio: '1', borderRadius: 6,
              overflow: 'hidden', border: 'none', cursor: 'pointer',
              padding: 0, background: '#09090B',
            }}
          >
            <img
              src={gif.preview}
              alt="GIF"
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </button>
        ))}
      </div>
      <span style={{ fontSize: 9, color: '#27272A', textAlign: 'center' }}>Powered by Tenor</span>
    </div>
  );
}

/* ── Image Preview (for attached image before sending) ── */
function ImagePreview({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div style={{
      position: 'relative', display: 'inline-block',
      marginBottom: 8, borderRadius: 10, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
      maxWidth: 200, maxHeight: 150,
    }}>
      <img src={src} alt="Attached" style={{ maxWidth: 200, maxHeight: 150, objectFit: 'cover', display: 'block' }} />
      <button
        onClick={onRemove}
        style={{
          position: 'absolute', top: 4, right: 4,
          width: 20, height: 20, borderRadius: '50%',
          backgroundColor: 'rgba(0,0,0,0.7)', border: 'none',
          color: '#EF4444', cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        \u00D7
      </button>
    </div>
  );
}

/* ── SVG Icons for media buttons ── */
function ImageIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function SmileIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function GifIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">GIF</text>
    </svg>
  );
}

/* ── Conversation Sidebar ── */
function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onClose,
  isMobile,
  companionName = 'Embris',
}: {
  conversations: ConversationMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
  companionName?: string;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function formatTime(ts: number): string {
    const now = Date.now();
    const diff = now - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay for mobile */}
      {isMobile && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        />
      )}

      {/* Sidebar panel */}
      <div style={{
        position: isMobile ? 'fixed' : 'relative',
        top: isMobile ? 0 : undefined,
        left: isMobile ? 0 : undefined,
        bottom: isMobile ? 0 : undefined,
        zIndex: isMobile ? 50 : undefined,
        width: 240,
        flexShrink: 0,
        backgroundColor: '#0C0C0E',
        borderRight: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: '14px 12px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={14} height={14} viewBox="0 0 32 32" fill="none">
              <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
              <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#52525B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {companionName}
            </span>
          </div>
          <button
            onClick={onNew}
            title="New Chat"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 600, color: '#F97316',
              padding: '5px 8px', borderRadius: 7,
              border: '1px solid rgba(249,115,22,0.2)',
              backgroundColor: 'rgba(249,115,22,0.08)',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.08)'; }}
          >
            <PlusIcon size={11} />
            New
          </button>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: '20px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#3F3F46', lineHeight: 1.6 }}>
                No conversations yet.<br />Start chatting to begin.
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onMouseEnter={() => setHoveredId(conv.id)}
                onMouseLeave={() => { setHoveredId(null); setConfirmDeleteId(null); }}
                style={{ position: 'relative', marginBottom: 2 }}
              >
                <button
                  onClick={() => { onSelect(conv.id); if (isMobile) onClose(); }}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '9px 10px',
                    borderRadius: 8, border: 'none', cursor: 'pointer',
                    backgroundColor: conv.id === activeId
                      ? 'rgba(249,115,22,0.1)'
                      : hoveredId === conv.id
                        ? 'rgba(255,255,255,0.03)'
                        : 'transparent',
                    transition: 'background-color 0.1s ease',
                    paddingRight: hoveredId === conv.id ? 32 : 10,
                  }}
                >
                  <div style={{
                    fontSize: 13, fontWeight: conv.id === activeId ? 500 : 400,
                    color: conv.id === activeId ? '#F4F4F5' : '#A1A1AA',
                    lineHeight: 1.35,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {conv.title}
                  </div>
                  <div style={{
                    fontSize: 11, color: '#3F3F46', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {formatTime(conv.updatedAt)}
                  </div>
                </button>

                {/* Delete button */}
                {hoveredId === conv.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirmDeleteId === conv.id) {
                        onDelete(conv.id);
                        setConfirmDeleteId(null);
                      } else {
                        setConfirmDeleteId(conv.id);
                        setTimeout(() => setConfirmDeleteId(null), 2500);
                      }
                    }}
                    title={confirmDeleteId === conv.id ? 'Click again to confirm' : 'Delete conversation'}
                    style={{
                      position: 'absolute', right: 6, top: '50%',
                      transform: 'translateY(-50%)',
                      width: 22, height: 22, borderRadius: 5,
                      border: 'none', cursor: 'pointer',
                      backgroundColor: confirmDeleteId === conv.id
                        ? 'rgba(239,68,68,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      color: confirmDeleteId === conv.id ? '#EF4444' : '#52525B',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <TrashIcon size={11} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid rgba(255,255,255,0.03)',
        }}>
          <p style={{ fontSize: 10, color: '#27272A', lineHeight: 1.5, textAlign: 'center' }}>
            Memory is global across all chats
          </p>
        </div>
      </div>
    </>
  );
}

/* ── Main Chat Component ── */
export default function Chat() {
  const [messages, setMessages] = useState<ChatMessageWithStatus[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [memories, setMemoriesState] = useState<Memory[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [growthStats, setGrowthStats] = useState({ conversations: 0, memories: 0 });
  const [currentMood, setCurrentMood] = useState<EmotionalState | null>(null);
  const [activeGoalCount, setActiveGoalCount] = useState(0);
  const [sendAnimating, setSendAnimating] = useState(false);

  // Registration state
  const [registered, setRegistered] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  // Companion name (dynamic from wallet settings)
  const [companionDisplayName, setCompanionDisplayName] = useState('Embris');

  // Voice mode state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [embrisSpeaking, setEmbrisSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voiceRate, setVoiceRateState] = useState(1.0);
  const [voicePitchVal, setVoicePitchState] = useState(1.0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Refs for voice auto-send (avoids stale closure issues)
  const transcriptRef = useRef('');
  const sendMessageRef = useRef<((text: string) => void) | null>(null);
  const voiceEnabledRef = useRef(false);

  // Multi-conversation state
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companionPanelOpen, setCompanionPanelOpen] = useState(false);

  // Media state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef('');
  const isNearBottomRef = useRef(true);
  // Track whether the title has been set for the current conversation
  const titleSetRef = useRef(false);

  // ── Responsive ──
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Voice init ──
  useEffect(() => {
    setSttSupported(isSpeechRecognitionSupported());
    setTtsSupported(isSpeechSynthesisSupported());
    const savedVoice = getVoiceModeEnabled();
    setVoiceEnabled(savedVoice);
    voiceEnabledRef.current = savedVoice;
    setVoiceRateState(getVoiceRate());
    setVoicePitchState(getVoicePitch());
    preloadVoices();
  }, []);

  // ── Load initial data ──
  useEffect(() => {
    const reg = isRegistered();
    setRegistered(reg);
    const addr = getWalletAddress();
    setWalletAddress(addr);

    // Load companion name from localStorage
    const storedName = localStorage.getItem('vaultfire_companion_name') || 'Embris';
    setCompanionDisplayName(storedName);

    if (reg) {
      const mems = getMemories();
      const stats = getGrowthStats();
      const goals = getGoals();
      setMemoriesState(mems);
      setGrowthStats({ conversations: stats.totalConversations, memories: mems.length });
      setActiveGoalCount(goals.filter(g => g.status === 'active').length);
    }

    // Initialize multi-conversation system
    const convId = ensureActiveConversation();
    const convMessages = getConversationMessages(convId);
    const index = getConversationIndex();

    setActiveConvId(convId);
    setConversations(index);
    setMessages(convMessages as ChatMessageWithStatus[]);
    if (convMessages.length > 0) setShowSuggestions(false);
    titleSetRef.current = convMessages.length > 0;

    // Show companion introduction on first ever chat
    if (convMessages.length === 0 && shouldShowIntroduction()) {
      const introText = getCompanionIntroduction();
      const introMsg: ChatMessageWithStatus = {
        id: `intro_${Date.now()}`,
        role: 'assistant',
        content: introText,
        timestamp: Date.now(),
      };
      setMessages([introMsg]);
      setShowSuggestions(false);
      markIntroductionShown();
      // Save to conversation
      saveConversationMessages(convId, [introMsg]);
    }
  }, []);

  // ── Scroll tracking ──
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ── Switch conversation ──
  const switchConversation = useCallback((convId: string) => {
    if (isLoading) return;
    stopSpeaking();
    setEmbrisSpeaking(false);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    setActiveConvId(convId);
    setActiveConversationId(convId);
    const msgs = getConversationMessages(convId);
    setMessages(msgs as ChatMessageWithStatus[]);
    setShowSuggestions(msgs.length === 0);
    setCurrentMood(null);
    titleSetRef.current = msgs.length > 0;
    isNearBottomRef.current = true;
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
  }, [isLoading, isListening]);

  // ── New conversation ──
  const handleNewChat = useCallback(() => {
    if (isLoading) return;
    stopSpeaking();
    setEmbrisSpeaking(false);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    const meta = createConversation();
    const index = getConversationIndex();
    setConversations(index);
    setActiveConvId(meta.id);
    setMessages([]);
    setShowSuggestions(true);
    setCurrentMood(null);
    titleSetRef.current = false;
    if (isMobile) setSidebarOpen(false);
  }, [isLoading, isListening, isMobile]);

  // ── Delete conversation ──
  const handleDeleteConversation = useCallback((convId: string) => {
    deleteConversation(convId);
    const index = getConversationIndex();
    setConversations(index);

    // If deleted the active one, switch to next
    if (convId === activeConvId) {
      if (index.length > 0) {
        switchConversation(index[0].id);
      } else {
        const meta = createConversation();
        const newIndex = getConversationIndex();
        setConversations(newIndex);
        setActiveConvId(meta.id);
        setMessages([]);
        setShowSuggestions(true);
        titleSetRef.current = false;
      }
    }
  }, [activeConvId, switchConversation]);

  const handleRegistered = useCallback(() => {
    setRegistered(true);
    resetNudgeCounter();
    const mems = getMemories();
    const stats = getGrowthStats();
    const goals = getGoals();
    setMemoriesState(mems);
    setGrowthStats({ conversations: stats.totalConversations, memories: mems.length });
    setActiveGoalCount(goals.filter(g => g.status === 'active').length);
  }, []);

  const runBackgroundMemoryExtraction = useCallback(
    async (userText: string, assistantText: string, currentMemories: Memory[]) => {
      if (!isRegistered()) return;
      try {
        const aiMemories = await extractMemoriesWithAI(userText, assistantText, currentMemories, API_KEY);
        if (aiMemories.length > 0) {
          const merged = deduplicateMemories([...currentMemories, ...aiMemories]);
          saveMemories(merged);
          setMemoriesState(merged);
        }
      } catch { /* silent fail */ }
    },
    [],
  );

  const runBackgroundSelfLearning = useCallback(
    async (userText: string, assistantText: string) => {
      if (!isRegistered()) return;
      try {
        const result = await runSelfLearning(userText, assistantText, API_KEY);
        const stats = getGrowthStats();
        const mems = getMemories();
        setGrowthStats({ conversations: stats.totalConversations, memories: mems.length });
        setMemoriesState(mems);
        if (process.env.NODE_ENV === 'development') {
          if (result.reflection) console.log('[Embris Self-Learning] Reflection:', result.reflection.content);
          if (result.corrected) console.log('[Embris Self-Learning] Self-corrections:', result.corrections);
        }
      } catch { /* silent fail */ }
    },
    [],
  );

  const runBackgroundGoalExtraction = useCallback(
    async (userText: string) => {
      if (!isRegistered()) return;
      try {
        const existingGoals = getGoals();
        const result = await extractGoalsFromMessage(userText, existingGoals, API_KEY);
        if (result.newGoals.length > 0 || result.updates.length > 0) {
          processGoalExtraction(result);
          const updatedGoals = getGoals();
          setActiveGoalCount(updatedGoals.filter(g => g.status === 'active').length);
        }
      } catch { /* silent fail */ }
    },
    [],
  );

  // ── Voice handlers ──
  const toggleListening = useCallback(() => {
    if (embrisSpeaking) {
      stopSpeaking();
      setEmbrisSpeaking(false);
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = createSpeechRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    transcriptRef.current = '';
    setIsListening(true);

    recognition.onresult = (event) => {
      // Collect all results (including interim) into transcript
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      // Store in ref synchronously (available in onend closure)
      transcriptRef.current = transcript;
      // Also update input text for visual feedback
      setInputText(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      // AUTO-SEND: when voice mode is active and we have a transcript, send it
      const transcript = transcriptRef.current.trim();
      if (voiceEnabledRef.current && transcript && sendMessageRef.current) {
        // Small delay to ensure state is settled
        setTimeout(() => {
          if (transcript && sendMessageRef.current) {
            setInputText('');
            transcriptRef.current = '';
            sendMessageRef.current(transcript);
          }
        }, 200);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      transcriptRef.current = '';
    };

    recognition.start();
  }, [isListening, embrisSpeaking]);

  const handleToggleVoice = useCallback(() => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    voiceEnabledRef.current = next;
    setVoiceModeEnabled(next);
    if (!next) {
      stopSpeaking();
      setEmbrisSpeaking(false);
      if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
      }
      setShowVoiceSettings(false);
    }
  }, [voiceEnabled, isListening]);

  const handleStopSpeaking = useCallback(() => {
    stopSpeaking();
    setEmbrisSpeaking(false);
  }, []);

  const handleSpeak = useCallback((text: string) => {
    if (!ttsSupported) return;
    if (embrisSpeaking) {
      stopSpeaking();
      setEmbrisSpeaking(false);
      return;
    }
    speakText(text, {
      onStart: () => setEmbrisSpeaking(true),
      onEnd: () => setEmbrisSpeaking(false),
    });
  }, [ttsSupported, embrisSpeaking]);

  const handleRateChange = useCallback((val: number) => {
    setVoiceRateState(val);
    setVoiceRate(val);
  }, []);

  const handlePitchChange = useCallback((val: number) => {
    setVoicePitchState(val);
    setVoicePitch(val);
  }, []);

  // ── Handle image paste ──
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setAttachedImage(ev.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  }, []);

  // ── Handle image file selection ──
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachedImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    if (e.target) e.target.value = '';
  }, []);

  // ── Send GIF as a message ──
  const sendGif = useCallback((gifUrl: string) => {
    if (isLoading || !activeConvId) return;
    const userMsg: ChatMessageWithStatus = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: '',
      timestamp: Date.now(),
      gifUrl,
    };
    setMessages((prev) => [...prev, userMsg]);
    setShowSuggestions(false);
    // Save to conversation
    const history = getConversationMessages(activeConvId);
    saveConversationMessages(activeConvId, [...history, userMsg] as ChatMessage[]);
    setConversations(getConversationIndex());
  }, [isLoading, activeConvId]);

  // ── Send message ──
  const sendMessage = useCallback(async (text: string) => {
    if ((!text.trim() && !attachedImage) || isLoading || !activeConvId) return;
    setShowSuggestions(false);
    setShowEmojiPicker(false);
    setShowGifPicker(false);

    setSendAnimating(true);
    setTimeout(() => setSendAnimating(false), 300);

    if (embrisSpeaking) {
      stopSpeaking();
      setEmbrisSpeaking(false);
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const features = getAvailableFeatures();

    if (features.emotionalIntelligence) {
      const mood = analyzeMood(text.trim());
      setCurrentMood(mood);
    }
    if (features.personality) applyPersonalityFeedback(text.trim());
    if (features.proactiveSuggestions) incrementMessageCount();
    if (features.sessionSummaries) updateCurrentSession();

    const contractQuery = detectContractQuery(text.trim());
    let contractContext = '';
    if (contractQuery) {
      try { contractContext = await executeContractQuery(contractQuery); } catch { /* silent fail */ }
    }

    const currentMemories = features.memory ? getMemories() : [];

    const userMsg: ChatMessageWithStatus = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      imageUrl: attachedImage || undefined,
    };

    // Clear attached image after sending
    setAttachedImage(null);

    const assistantMsg: ChatMessageWithStatus = {
      id: `asst_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputText('');
    setIsLoading(true);
    streamingRef.current = '';
    isNearBottomRef.current = true;

    // Set conversation title from first user message
    if (!titleSetRef.current) {
      titleSetRef.current = true;
      updateConversationTitle(activeConvId, text.trim() || '(image)');
      setConversations(getConversationIndex());
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // ── COMPANION BRAIN: Try local answer first ──
    const trimmedText = text.trim();

    // 1. Check for companion actions (check balance, lookup VNS, etc.)
    const action = detectAction(trimmedText);
    if (action.type !== 'none') {
      try {
        const actionResult = await executeAction(action);
        if (actionResult) {
          // Local action succeeded — no API call needed
          const finalText = actionResult;
          await simulateLocalStreaming(finalText, assistantMsg.id, controller.signal);
          finishMessage(finalText, trimmedText, assistantMsg, userMsg, features, currentMemories);
          return;
        }
      } catch { /* fall through to execution engine */ }
    }

    // 1.5. EXECUTION ENGINE: Check if the brain should invoke real tools
    // The local brain decides what tools to use; the engine executes them
    const executableTasks = detectExecutableTasks(trimmedText);
    if (executableTasks.length > 0) {
      try {
        let executionResponse = '';
        for (const task of executableTasks) {
          // Show narration while executing
          if (task.narration) {
            executionResponse += task.narration + '\n\n';
          }
          // Execute the task
          const toolResult = await executeTask(task);
          // Filter result through personality and soul
          const personalityResponse = filterResultThroughPersonality(toolResult, '');
          executionResponse += personalityResponse + '\n\n';
        }
        // Stream the execution response
        await simulateLocalStreaming(executionResponse.trim(), assistantMsg.id, controller.signal);
        finishMessage(executionResponse.trim(), trimmedText, assistantMsg, userMsg, features, currentMemories);
        return;
      } catch (e) {
        // Execution engine failed — fall through to local brain
        console.warn('[Embris] Execution engine error:', e);
      }
    }

    // 2. Try local brain knowledge base (handles contracts, greetings, protocol questions, etc.)
    const localAnswer = tryLocalAnswer(trimmedText);
    if (localAnswer) {
      // Local brain can answer — no API call needed
      // If there's contract context, append it to enrich the response
      const enrichedAnswer = contractContext ? localAnswer + contractContext : localAnswer;
      await simulateLocalStreaming(enrichedAnswer, assistantMsg.id, controller.signal);
      finishMessage(enrichedAnswer, trimmedText, assistantMsg, userMsg, features, currentMemories);
      return;
    }

    // 3. Try Vaultfire's /api/companion/think for tasks and complex questions
    const taskDetection = detectTask(trimmedText);
    if (taskDetection.isTask && taskDetection.confidence > 0.6) {
      try {
        // Show thinking narration
        const thinkingMsg = '🔥 Let me work on that...';
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsg.id ? { ...m, content: thinkingMsg } : m)
        );

        const walletAddr = getWalletAddress();
        const companionAddr = getCompanionAddress();
        const companionName = getCompanionAgentName();
        const convHistory = getConversationMessages(activeConvId);

        const engineResult = await callThinkAPI(trimmedText, {
          conversationHistory: convHistory.slice(-8).map(m => ({ role: m.role, content: m.content })),
          userWallet: walletAddr || undefined,
          companionWallet: companionAddr || undefined,
          companionName: companionName || undefined,
        });

        recordEngineCall(engineResult);

        if (engineResult.response) {
          const fullResponse = engineResult.thinking
            ? `${engineResult.thinking}\n\n${engineResult.response}`
            : engineResult.response;
          await simulateLocalStreaming(fullResponse, assistantMsg.id, controller.signal);
          finishMessage(fullResponse, trimmedText, assistantMsg, userMsg, features, currentMemories);
          return;
        }
      } catch (e) {
        console.warn('[Embris] Think API error:', e);
        // Fall through to streamChat
      }
    }

    // 4. Fall back to streamChat for complex/novel queries the brain and engine can't handle
    const history = getConversationMessages(activeConvId);
    const userContent = contractContext ? trimmedText + contractContext : trimmedText;
    const llmMessages = [
      ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
    ];

    await streamChat({
      messages: llmMessages,
      memories: currentMemories,
      userMessage: trimmedText,
      signal: controller.signal,
      onToken: (token) => {
        streamingRef.current += token;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: streamingRef.current } : m
          )
        );
      },
      onDone: (fullText) => {
        finishMessage(fullText, trimmedText, assistantMsg, userMsg, features, currentMemories);
      },
      onError: async (error) => {
        // API failed — use local brain fallback instead of showing raw error
        console.warn('[Embris] API fallback triggered:', error);
        const fallbackResponse = generateLocalFallback(trimmedText);
        await simulateLocalStreaming(fallbackResponse, assistantMsg.id, controller.signal);
        finishMessage(fallbackResponse, trimmedText, assistantMsg, userMsg, features, currentMemories);
      },
    });
  }, [isLoading, isListening, voiceEnabled, ttsSupported, embrisSpeaking, activeConvId, attachedImage, runBackgroundMemoryExtraction, runBackgroundSelfLearning, runBackgroundGoalExtraction]);

  // Helper: simulate streaming for local brain answers
  const simulateLocalStreaming = useCallback(async (text: string, msgId: string, signal?: AbortSignal) => {
    const words = text.split(/(\s+)/);
    let accumulated = '';
    for (const word of words) {
      if (signal?.aborted) return;
      accumulated += word;
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, content: accumulated } : m)
      );
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }, []);

  // Helper: finish message processing (shared between local and API paths)
  const finishMessage = useCallback((fullText: string, userText: string, assistantMsg: ChatMessageWithStatus, userMsg: ChatMessageWithStatus, features: ReturnType<typeof getAvailableFeatures>, currentMemories: Memory[]) => {
    if (!activeConvId) return;
    const finalAsst: ChatMessage = { ...assistantMsg, content: fullText, isStreaming: false } as ChatMessage;
    const history = getConversationMessages(activeConvId);
    const updatedHistory = [...history, { ...userMsg, isStreaming: undefined }, finalAsst];
    saveConversationMessages(activeConvId, updatedHistory as ChatMessage[]);
    setConversations(getConversationIndex());

    // Learn from this exchange (companion brain)
    learnFromExchange(userText, fullText);

    if (features.memory) {
      const regexMems = extractMemories(userText, fullText);
      let allMems = currentMemories;
      if (regexMems.length > 0) {
        allMems = deduplicateMemories([...currentMemories, ...regexMems]);
        saveMemories(allMems);
        setMemoriesState(allMems);
      }
      runBackgroundMemoryExtraction(userText, fullText, allMems);
    }
    if (features.selfLearning) {
      setTimeout(() => runBackgroundSelfLearning(userText, fullText), 1500);
    }
    if (features.goals) {
      setTimeout(() => runBackgroundGoalExtraction(userText), 2000);
    }

    if (voiceEnabled && ttsSupported) {
      speakText(fullText, {
        onStart: () => setEmbrisSpeaking(true),
        onEnd: () => setEmbrisSpeaking(false),
      });
    }

    setMessages((prev) =>
      prev.map((m) => m.id === assistantMsg.id ? { ...m, content: fullText, isStreaming: false } : m)
    );
    setIsLoading(false);
  }, [activeConvId, voiceEnabled, ttsSupported, runBackgroundMemoryExtraction, runBackgroundSelfLearning, runBackgroundGoalExtraction]);

  // Keep sendMessageRef always pointing to the latest sendMessage function
  // This allows the voice recognition onend closure to call it without stale refs
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const handleClear = async () => {
    if (!activeConvId) return;
    if (registered && messages.length >= 4) {
      try {
        const chatMessages = messages.map(m => ({ role: m.role, content: m.content }));
        await generateSessionSummary(chatMessages, API_KEY);
      } catch { /* silent fail */ }
    }
    stopSpeaking();
    setEmbrisSpeaking(false);
    // Clear legacy key too for compatibility
    clearChatHistory();
    // Clear this conversation's messages
    const { clearConversationMessages } = await import('../lib/conversations');
    clearConversationMessages(activeConvId);
    setMessages([]);
    setShowSuggestions(true);
    setCurrentMood(null);
    titleSetRef.current = false;
    setConversations(getConversationIndex());
  };

  const hasText = inputText.trim().length > 0;
  const suggestedPrompts = registered ? SUGGESTED_PROMPTS_REGISTERED : SUGGESTED_PROMPTS_UNREGISTERED;

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: '#09090B', overflow: 'hidden', flexDirection: 'column' }}>
      <AlphaBanner />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* ── Conversation Sidebar ── */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={switchConversation}
        onNew={handleNewChat}
        onDelete={handleDeleteConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
        companionName={companionDisplayName}
      />

      {/* ── Main chat area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <DisclaimerBanner disclaimerKey="companion" mode="banner" />
        <AgentStatusBar isMobile={isMobile} />

        {/* ── Header ── */}
        <div style={{
          padding: isMobile ? '10px 16px' : '10px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: '#09090B',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 6,
                border: 'none', cursor: 'pointer',
                backgroundColor: sidebarOpen ? 'rgba(249,115,22,0.1)' : 'transparent',
                color: sidebarOpen ? '#F97316' : '#3F3F46',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!sidebarOpen) e.currentTarget.style.color = '#71717A'; }}
              onMouseLeave={(e) => { if (!sidebarOpen) e.currentTarget.style.color = '#3F3F46'; }}
            >
              <SidebarIcon size={15} />
            </button>

            <span style={{ fontSize: 14, fontWeight: 500, color: '#A1A1AA', letterSpacing: '-0.01em' }}>{companionDisplayName}</span>
            {embrisSpeaking && <VoiceWaveform />}
            {registered && currentMood && currentMood.confidence > 0.3 && !embrisSpeaking && (
              <MoodDot mood={currentMood.mood} />
            )}
            {registered ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, color: '#22C55E', fontWeight: 500,
                padding: '2px 6px',
                backgroundColor: 'rgba(34,197,94,0.08)',
                borderRadius: 6,
              }}>
                <ShieldCheckIcon size={10} />
                {isMobile ? '' : 'Registered'}
              </span>
            ) : (
              <button
                onClick={() => setShowRegistrationModal(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 10, color: '#F97316', fontWeight: 500,
                  padding: '2px 8px',
                  backgroundColor: 'rgba(249,115,22,0.08)',
                  borderRadius: 6, border: 'none', cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.08)'; }}
              >
                <ShieldCheckIcon size={10} />
                {isMobile ? 'Register' : 'Register On-Chain'}
              </button>
            )}
            {registered && growthStats.conversations > 0 && (
              <span style={{
                fontSize: 10, color: '#F97316', fontWeight: 400, opacity: 0.6,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {isMobile ? `×${growthStats.conversations}` : `${growthStats.conversations} conversations`}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* New Chat button — always visible */}
            <button
              onClick={handleNewChat}
              title="New Chat"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600,
                padding: '5px 8px', borderRadius: 7,
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: '#52525B',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#A1A1AA';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#52525B';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              }}
            >
              <PlusIcon size={11} />
              {!isMobile && 'New Chat'}
            </button>

            {/* Voice Mode Toggle */}
            {sttSupported && (
              <button
                onClick={handleToggleVoice}
                title={voiceEnabled ? 'Disable voice mode' : 'Enable voice mode'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 600,
                  padding: '5px 10px', borderRadius: 8,
                  border: voiceEnabled ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  backgroundColor: voiceEnabled ? 'rgba(249,115,22,0.12)' : 'transparent',
                  color: voiceEnabled ? '#F97316' : '#52525B',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!voiceEnabled) {
                    e.currentTarget.style.color = '#A1A1AA';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!voiceEnabled) {
                    e.currentTarget.style.color = '#52525B';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  }
                }}
              >
                <MicIcon size={12} />
                {voiceEnabled ? 'Voice On' : 'Voice'}
              </button>
            )}
            {voiceEnabled && (
              <button
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                title="Voice settings"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 6,
                  border: 'none', cursor: 'pointer',
                  backgroundColor: showVoiceSettings ? 'rgba(249,115,22,0.12)' : 'transparent',
                  color: showVoiceSettings ? '#F97316' : '#3F3F46',
                  transition: 'all 0.15s ease',
                }}
              >
                <SettingsIcon size={12} />
              </button>
            )}
            {embrisSpeaking && (
              <button
                onClick={handleStopSpeaking}
                title={`Stop ${companionDisplayName} speaking`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 500,
                  padding: '4px 8px', borderRadius: 6,
                  border: '1px solid rgba(239,68,68,0.3)',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  color: '#EF4444',
                  transition: 'all 0.15s ease',
                }}
              >
                <StopCircleIcon size={11} />
                {!isMobile && 'Stop'}
              </button>
            )}
            {walletAddress && !isMobile && (
              <span style={{ fontSize: 11, color: '#3F3F46', fontFamily: "'JetBrains Mono', monospace" }}>
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            )}
            {registered && activeGoalCount > 0 && (
              <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 400, fontFamily: "'JetBrains Mono', monospace" }}>
                {activeGoalCount} {isMobile ? 'goal' : activeGoalCount === 1 ? 'goal' : 'goals'}
              </span>
            )}
            {registered && memories.length > 0 && (
              <span style={{ fontSize: 11, color: '#3F3F46', fontWeight: 400 }}>
                {memories.length} {isMobile ? 'mem' : 'memories'}
              </span>
            )}
            <button
              onClick={() => setCompanionPanelOpen(!companionPanelOpen)}
              title={companionPanelOpen ? 'Close Companion Agent' : 'Open Companion Agent'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 700,
                padding: '5px 12px', borderRadius: 8,
                border: '1px solid rgba(249,115,22,0.3)',
                cursor: 'pointer',
                backgroundColor: companionPanelOpen ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.06)',
                color: '#F97316',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.2)';
                e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = companionPanelOpen ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.06)';
                e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)';
              }}
            >
              <svg width={13} height={13} viewBox="0 0 32 32" fill="none">
                <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
                <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
              </svg>
              {companionPanelOpen ? 'Close Agent' : (isMobile ? 'Agent' : 'Companion Agent')}
              {!companionPanelOpen && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: '#22C55E',
                  animation: 'pulse 2s ease-in-out infinite',
                }} />
              )}
            </button>
            <button
              onClick={handleClear}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, color: '#3F3F46', background: 'none',
                border: 'none', cursor: 'pointer', padding: '6px 8px',
                borderRadius: 6, transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#71717A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#3F3F46'; }}
              title="Clear this conversation"
            >
              <TrashIcon size={12} />
              {!isMobile && 'Clear'}
            </button>
          </div>
        </div>

        {/* ── Voice Settings Panel ── */}
        {voiceEnabled && showVoiceSettings && (
          <div className="fade-in" style={{
            padding: isMobile ? '12px 16px' : '12px 24px',
            backgroundColor: '#111113',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 12 : 24, alignItems: isMobile ? 'stretch' : 'center',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <label style={{ fontSize: 11, color: '#71717A', fontWeight: 500, minWidth: 40 }}>Speed</label>
              <input
                type="range" min="0.5" max="2.0" step="0.1" value={voiceRate}
                onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#F97316', height: 4 }}
              />
              <span style={{ fontSize: 11, color: '#52525B', fontFamily: "'JetBrains Mono', monospace", minWidth: 28 }}>
                {voiceRate.toFixed(1)}×
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <label style={{ fontSize: 11, color: '#71717A', fontWeight: 500, minWidth: 40 }}>Pitch</label>
              <input
                type="range" min="0.5" max="2.0" step="0.1" value={voicePitchVal}
                onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#F97316', height: 4 }}
              />
              <span style={{ fontSize: 11, color: '#52525B', fontFamily: "'JetBrains Mono', monospace", minWidth: 28 }}>
                {voicePitchVal.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* ── Registration Banner ── */}
        {!registered && messages.length > 0 && (
          <RegistrationBanner onRegisterClick={() => setShowRegistrationModal(true)} />
        )}

        {/* ── Messages ── */}
        <div
          ref={messagesContainerRef}
          className="scroll-smooth"
          style={{
            flex: 1, overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
            overscrollBehavior: 'contain',
          }}
        >
          {messages.length === 0 && showSuggestions && (
            <div className="fade-in" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', flex: 1, gap: isMobile ? 32 : 40,
              padding: isMobile ? '24px 16px' : '40px 24px',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div className="breathe" style={{
                  width: 56, height: 56, borderRadius: '50%', marginBottom: 20,
                  background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, rgba(249,115,22,0.03) 70%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 30px rgba(249,115,22,0.1)',
                }}>
                  <svg width={28} height={28} viewBox="0 0 32 32" fill="none">
                    <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
                    <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
                  </svg>
                </div>
                <h3 style={{
                  fontSize: isMobile ? 20 : 24, fontWeight: 600, color: '#F4F4F5',
                  marginBottom: 8, letterSpacing: '-0.03em', lineHeight: 1.25,
                }}>Ask {companionDisplayName} anything</h3>
                <p style={{ fontSize: 14, color: '#3F3F46', lineHeight: 1.6 }}>
                  {registered
                    ? 'Your self-learning companion — I remember, reflect, grow, and track your goals'
                    : 'Your AI companion for Embris — register on-chain to unlock my full potential'
                  }
                </p>
                <p style={{ fontSize: 11, color: '#27272A', marginTop: 8, fontStyle: 'italic' }}>
                  Morals over metrics. Privacy over surveillance. Freedom over control.
                </p>
                {voiceEnabled && (
                  <p style={{ fontSize: 12, color: '#F97316', marginTop: 8, opacity: 0.7 }}>
                    Voice mode active — tap the mic to speak, I&apos;ll talk back
                  </p>
                )}
              </div>

              {!registered && (
                <button
                  onClick={() => setShowRegistrationModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 24px',
                    backgroundColor: 'rgba(249,115,22,0.1)',
                    color: '#F97316',
                    border: '1px solid rgba(249,115,22,0.2)',
                    borderRadius: 12,
                    fontSize: 13.5, fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.15)';
                    e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.1)';
                    e.currentTarget.style.borderColor = 'rgba(249,115,22,0.2)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <ShieldCheckIcon size={15} />
                  Register On-Chain to Unlock Full Experience
                </button>
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                gap: 8, maxWidth: 480, width: '100%',
              }}>
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: 12, color: '#52525B',
                      fontSize: 13, cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s ease',
                      fontWeight: 400, lineHeight: 1.4,
                      minHeight: 44,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.color = '#A1A1AA';
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.color = '#52525B';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          <div
            className="chat-messages"
            style={{
              maxWidth: 680, width: '100%', margin: '0 auto',
              padding: isMobile ? '20px 16px' : '28px 24px',
              display: 'flex', flexDirection: 'column', gap: isMobile ? 24 : 28,
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="fade-in"
                style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  gap: 10, alignItems: 'flex-start',
                }}
              >
                {msg.role === 'assistant' && (
                  embrisSpeaking && msg.content && !msg.isStreaming
                    ? <EmbrisFlameSpeaking />
                    : <EmbrisFlame />
                )}

                <div style={{
                  maxWidth: '85%',
                  padding: msg.role === 'user' ? '10px 16px' : '0',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '0',
                  backgroundColor: msg.role === 'user' ? '#1A1A1E' : 'transparent',
                  color: msg.role === 'user' ? '#E4E4E7' : '#D4D4D8',
                  fontSize: 14,
                  lineHeight: 1.75,
                  overflow: 'hidden', wordBreak: 'break-word',
                  letterSpacing: '-0.01em',
                }}>
                  {/* Attached image */}
                  {msg.imageUrl && (
                    <div style={{ marginBottom: msg.content ? 8 : 0 }}>
                      <img
                        src={msg.imageUrl}
                        alt="Attached"
                        style={{
                          maxWidth: '100%', maxHeight: 300,
                          borderRadius: 10, objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                    </div>
                  )}
                  {/* Attached GIF */}
                  {msg.gifUrl && (
                    <div style={{ marginBottom: msg.content ? 8 : 0 }}>
                      <img
                        src={msg.gifUrl}
                        alt="GIF"
                        style={{
                          maxWidth: '100%', maxHeight: 250,
                          borderRadius: 10, objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                    </div>
                  )}
                  {msg.isStreaming && msg.content === '' ? (
                    <TypingIndicator />
                  ) : msg.role === 'assistant' ? (
                    <MarkdownText text={msg.content} />
                  ) : msg.content ? (
                    msg.content
                  ) : null}
                </div>

                {msg.role === 'assistant' && ttsSupported && msg.content && !msg.isStreaming && (
                  <button
                    onClick={() => handleSpeak(msg.content)}
                    title={embrisSpeaking ? 'Stop speaking' : 'Read aloud'}
                    style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: 4,
                      border: 'none', background: 'transparent',
                      color: voiceEnabled ? '#71717A' : '#3F3F46',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: 2, transition: 'color 0.15s ease',
                      opacity: voiceEnabled ? 1 : 0.6,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#F97316'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = voiceEnabled ? '#71717A' : '#3F3F46'; }}
                  >
                    <SpeakerIcon size={12} />
                  </button>
                )}
              </div>
            ))}

            <div ref={messagesEndRef} className="chat-scroll-anchor" />
          </div>
        </div>

        {/* ── Input ── */}
        <div style={{
          padding: isMobile ? '12px 16px 16px' : '16px 24px 24px',
          backgroundColor: '#09090B',
          flexShrink: 0,
        }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            {voiceEnabled && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                marginBottom: 8,
              }}>
                {embrisSpeaking ? (
                  <>
                    <VoiceWaveform />
                    <span style={{ fontSize: 11, color: '#F97316', fontWeight: 500 }}>{companionDisplayName} is speaking...</span>
                    <button
                      onClick={handleStopSpeaking}
                      style={{ fontSize: 10, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: '2px 6px' }}
                    >
                      Stop
                    </button>
                  </>
                ) : isListening ? (
                  <>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#EF4444', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    <span style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 500 }}>Listening...</span>
                  </>
                ) : isLoading ? (
                  <span style={{ fontSize: 11, color: '#52525B' }}>{companionDisplayName} is thinking...</span>
                ) : (
                  <span style={{ fontSize: 11, color: '#3F3F46' }}>Tap mic to speak</span>
                )}
              </div>
            )}

            {/* Image preview */}
            {attachedImage && (
              <ImagePreview src={attachedImage} onRemove={() => setAttachedImage(null)} />
            )}

            {/* Hidden file input for image upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-end',
              backgroundColor: '#111113',
              borderRadius: 16,
              padding: isMobile ? '10px 12px' : '12px 16px',
              boxShadow: inputFocused
                ? '0 0 0 1px rgba(255,255,255,0.07), 0 2px 12px rgba(0,0,0,0.3)'
                : isListening
                  ? '0 0 0 1.5px rgba(249,115,22,0.4), 0 0 12px rgba(249,115,22,0.1)'
                  : '0 0 0 1px rgba(255,255,255,0.04)',
              transition: 'box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative',
            }}>
              {/* Media buttons */}
              <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach image"
                  style={{
                    width: 28, height: 28, borderRadius: 6, border: 'none',
                    cursor: 'pointer', backgroundColor: 'transparent',
                    color: '#3F3F46', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#F97316'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#3F3F46'; }}
                >
                  <ImageIcon size={15} />
                </button>
                <button
                  onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                  title="Emoji"
                  style={{
                    width: 28, height: 28, borderRadius: 6, border: 'none',
                    cursor: 'pointer',
                    backgroundColor: showEmojiPicker ? 'rgba(249,115,22,0.1)' : 'transparent',
                    color: showEmojiPicker ? '#F97316' : '#3F3F46',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#F97316'; }}
                  onMouseLeave={(e) => { if (!showEmojiPicker) e.currentTarget.style.color = '#3F3F46'; }}
                >
                  <SmileIcon size={15} />
                </button>
                <button
                  onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                  title="Send GIF"
                  style={{
                    width: 28, height: 28, borderRadius: 6, border: 'none',
                    cursor: 'pointer',
                    backgroundColor: showGifPicker ? 'rgba(249,115,22,0.1)' : 'transparent',
                    color: showGifPicker ? '#F97316' : '#3F3F46',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#F97316'; }}
                  onMouseLeave={(e) => { if (!showGifPicker) e.currentTarget.style.color = '#3F3F46'; }}
                >
                  <GifIcon size={15} />
                </button>
              </div>

              {/* Emoji picker popup */}
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={(emoji) => setInputText(prev => prev + emoji)}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}

              {/* GIF picker popup */}
              {showGifPicker && (
                <GifPicker
                  onSelect={(url) => { sendGif(url); setShowGifPicker(false); }}
                  onClose={() => setShowGifPicker(false)}
                />
              )}

              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onPaste={handlePaste}
                placeholder={isListening ? 'Listening...' : voiceEnabled ? 'Speak or type...' : `Message ${companionDisplayName}...`}
                disabled={isLoading}
                rows={1}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: '#F4F4F5', fontSize: 15, resize: 'none',
                  maxHeight: 120, overflowY: 'auto', lineHeight: 1.55,
                  fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em',
                  fontWeight: 400,
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                }}
              />

              {voiceEnabled && sttSupported && (
                <button
                  onClick={toggleListening}
                  disabled={isLoading}
                  title={isListening ? 'Stop listening' : embrisSpeaking ? 'Interrupt & speak' : 'Start listening'}
                  className={isListening ? 'voice-mic-active' : ''}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none',
                    cursor: isLoading ? 'default' : 'pointer',
                    backgroundColor: isListening ? '#F97316' : 'rgba(249,115,22,0.1)',
                    color: isListening ? '#09090B' : '#F97316',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease', flexShrink: 0, position: 'relative',
                  }}>
                  <MicIcon size={16} />
                  {isListening && (
                    <span style={{
                      position: 'absolute', top: -2, right: -2,
                      width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: '#EF4444',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                  )}
                </button>
              )}

              <button
                onClick={() => sendMessage(inputText)}
                disabled={isLoading || !hasText}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  cursor: isLoading || !hasText ? 'default' : 'pointer',
                  backgroundColor: hasText ? '#F97316' : 'transparent',
                  color: hasText ? '#09090B' : '#3F3F46',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease', flexShrink: 0,
                  transform: sendAnimating ? 'scale(0.88)' : 'scale(1)',
                }}
                onMouseEnter={(e) => {
                  if (hasText && !isLoading) {
                    e.currentTarget.style.backgroundColor = '#FB923C';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (hasText) e.currentTarget.style.backgroundColor = '#F97316';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isLoading ? (
                  <div style={{
                    width: 14, height: 14,
                    border: '2px solid rgba(255,255,255,0.06)',
                    borderTopColor: '#52525B',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                ) : (
                  <SendIcon size={14} />
                )}
              </button>
            </div>
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                <p style={{ fontSize: 11, color: '#27272A', lineHeight: 1.5 }}>
                  Enter to send · Shift+Enter for new line{voiceEnabled ? ' · Click mic or tap to interrupt' : ''}
                </p>
                <span style={{ fontSize: 9, color: '#1A1A1E', padding: '1px 5px', borderRadius: 3, backgroundColor: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.08)' }}>Vaultfire</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ── Companion Agent Panel (right sidebar inside flex row) ── */}
      {companionPanelOpen && (
        <CompanionPanel
          isOpen={companionPanelOpen}
          onClose={() => setCompanionPanelOpen(false)}
          isMobile={isMobile}
        />
      )}
      </div>
      {/* ── Registration Modal ── */}
      <RegistrationModal
        isOpen={showRegistrationModal}
        onClose={() => setShowRegistrationModal(false)}
        onRegistered={handleRegistered}
      />
    </div>
  );
}
