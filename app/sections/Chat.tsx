'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat, API_KEY } from '../lib/stream-chat';
import {
  extractMemories,
  extractMemoriesWithAI,
  getMemories,
  getChatHistory,
  saveChatHistory,
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

// Voice Mode imports
import {
  getVoiceModeEnabled,
  setVoiceModeEnabled,
  isSpeechRecognitionSupported,
  createSpeechRecognition,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
  type SpeechRecognitionInstance,
} from '../lib/voice-mode';

// Contract Interaction imports
import {
  detectContractQuery,
  executeContractQuery,
} from '../lib/contract-interaction';

interface ChatMessageWithStatus extends ChatMessage {
  isStreaming?: boolean;
}

const SUGGESTED_PROMPTS_REGISTERED = [
  'What is ERC-8004?',
  'Show me the Base contracts',
  'What are my goals?',
  'What do you remember about me?',
  'How have you grown?',
  'Am I registered on-chain?',
];

const SUGGESTED_PROMPTS_UNREGISTERED = [
  'What is ERC-8004?',
  'Tell me about Vaultfire',
  'Show me the Base contracts',
  'What can you do?',
  'How does the protocol work?',
  'What is Embris?',
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

/* Small Embris flame icon for chat responses — 16px */
function EmbrisFlame() {
  return (
    <svg width={16} height={16} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0, marginTop: 3 }}>
      <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
      <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
    </svg>
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
      width: 6,
      height: 6,
      borderRadius: '50%',
      backgroundColor: color,
      marginRight: 4,
      opacity: 0.8,
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
      elements.push(<h3 key={i} style={{ color: '#F4F4F5', fontWeight: 600, margin: '0.75rem 0 0.25rem', fontSize: '0.95em' }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ color: '#F4F4F5', fontWeight: 600, margin: '0.75rem 0 0.25rem', fontSize: '1.05em' }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ color: '#F4F4F5', fontWeight: 700, margin: '0.75rem 0 0.25rem', fontSize: '1.15em' }}>{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} style={{ marginLeft: '1.25rem', margin: '0.2rem 0' }}>{renderInline(line.slice(2))}</li>);
    } else if (line.match(/^\d+\. /)) {
      elements.push(<li key={i} style={{ marginLeft: '1.25rem', margin: '0.2rem 0', listStyleType: 'decimal' }}>{renderInline(line.replace(/^\d+\. /, ''))}</li>);
    } else if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} style={{ borderLeft: '2px solid rgba(255,255,255,0.06)', paddingLeft: '0.75rem', color: '#A1A1AA', fontStyle: 'italic', margin: '0.5rem 0' }}>{line.slice(2)}</blockquote>);
    } else if (line === '---' || line === '***') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.03)', margin: '1rem 0' }} />);
    } else if (line === '') {
      elements.push(<br key={i} />);
    } else {
      elements.push(<p key={i} style={{ margin: '0.3rem 0', lineHeight: 1.75 }}>{renderInline(line)}</p>);
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

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 0' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="typing-dot" style={{
          width: 4, height: 4, borderRadius: '50%', backgroundColor: '#71717A',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

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

  // Registration state
  const [registered, setRegistered] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  // Voice mode state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef('');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Initialize voice mode
  useEffect(() => {
    setSttSupported(isSpeechRecognitionSupported());
    setTtsSupported(isSpeechSynthesisSupported());
    setVoiceEnabled(getVoiceModeEnabled());
  }, []);

  // Load chat history, memories, goals, growth stats, and registration status on mount
  useEffect(() => {
    const reg = isRegistered();
    setRegistered(reg);

    const history = getChatHistory();
    const addr = getWalletAddress();
    setWalletAddress(addr);

    if (reg) {
      // Full mode — load everything
      const mems = getMemories();
      const stats = getGrowthStats();
      const goals = getGoals();
      setMessages(history);
      setMemoriesState(mems);
      setGrowthStats({ conversations: stats.totalConversations, memories: mems.length });
      setActiveGoalCount(goals.filter(g => g.status === 'active').length);
    } else {
      // Basic mode — load chat history only (no persistence across sessions for unregistered)
      setMessages(history);
      setMemoriesState([]);
      setGrowthStats({ conversations: 0, memories: 0 });
      setActiveGoalCount(0);
    }

    if (history.length > 0) setShowSuggestions(false);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle registration completion
  const handleRegistered = useCallback(() => {
    setRegistered(true);
    resetNudgeCounter();

    // Load all data now that features are unlocked
    const mems = getMemories();
    const stats = getGrowthStats();
    const goals = getGoals();
    setMemoriesState(mems);
    setGrowthStats({ conversations: stats.totalConversations, memories: mems.length });
    setActiveGoalCount(goals.filter(g => g.status === 'active').length);
  }, []);

  /**
   * Background AI memory extraction — runs after each exchange
   * without blocking the UI or the conversation flow.
   * Only runs for registered users.
   */
  const runBackgroundMemoryExtraction = useCallback(
    async (userText: string, assistantText: string, currentMemories: Memory[]) => {
      if (!isRegistered()) return;
      try {
        const aiMemories = await extractMemoriesWithAI(
          userText,
          assistantText,
          currentMemories,
          API_KEY,
        );
        if (aiMemories.length > 0) {
          const merged = deduplicateMemories([...currentMemories, ...aiMemories]);
          saveMemories(merged);
          setMemoriesState(merged);
        }
      } catch {
        // Silent fail — background extraction should never disrupt UX
      }
    },
    [],
  );

  /**
   * Background self-learning — runs after memory extraction.
   * Only runs for registered users.
   */
  const runBackgroundSelfLearning = useCallback(
    async (userText: string, assistantText: string) => {
      if (!isRegistered()) return;
      try {
        const result = await runSelfLearning(userText, assistantText, API_KEY);

        // Update growth stats display
        const stats = getGrowthStats();
        const mems = getMemories();
        setGrowthStats({ conversations: stats.totalConversations, memories: mems.length });
        setMemoriesState(mems);

        // Log self-learning activity (dev only)
        if (process.env.NODE_ENV === 'development') {
          if (result.reflection) console.log('[Embris Self-Learning] Reflection:', result.reflection.content);
          if (result.corrected) console.log('[Embris Self-Learning] Self-corrections:', result.corrections);
          if (result.patternsSynthesized) console.log('[Embris Self-Learning] Patterns synthesized');
          if (result.insightsGenerated) console.log('[Embris Self-Learning] Insights generated');
        }
      } catch {
        // Silent fail
      }
    },
    [],
  );

  /**
   * Background goal extraction — detects goals and updates from messages.
   * Only runs for registered users.
   */
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
          if (process.env.NODE_ENV === 'development') {
            console.log('[Embris Goals] New:', result.newGoals, 'Updates:', result.updates);
          }
        }
      } catch {
        // Silent fail
      }
    },
    [],
  );

  /* ── Voice Mode: Start/Stop Listening ── */
  const toggleListening = useCallback(() => {
    if (isListening) {
      // Stop listening
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = createSpeechRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    setIsListening(true);

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputText(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [isListening]);

  /* ── Voice Mode: Toggle ── */
  const handleToggleVoice = useCallback(() => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    setVoiceModeEnabled(next);
    if (!next) {
      stopSpeaking();
      if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
      }
    }
  }, [voiceEnabled, isListening]);

  /* ── TTS: Speak a message ── */
  const handleSpeak = useCallback((text: string) => {
    if (!voiceEnabled || !ttsSupported) return;
    speakText(text);
  }, [voiceEnabled, ttsSupported]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    setShowSuggestions(false);

    // Stop listening if voice was active
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const features = getAvailableFeatures();

    // ── PRE-RESPONSE PROCESSING (only for registered users) ──

    if (features.emotionalIntelligence) {
      // 1. Analyze emotional tone (fast, local, no LLM)
      const mood = analyzeMood(text.trim());
      setCurrentMood(mood);
    }

    if (features.personality) {
      // 2. Detect personality feedback (fast, local)
      applyPersonalityFeedback(text.trim());
    }

    if (features.proactiveSuggestions) {
      // 3. Track message for proactive suggestions
      incrementMessageCount();
    }

    if (features.sessionSummaries) {
      // 4. Update current session tracking
      updateCurrentSession();
    }

    // ── CONTRACT INTERACTION: Detect on-chain queries ──
    const contractQuery = detectContractQuery(text.trim());
    let contractContext = '';
    if (contractQuery) {
      try {
        contractContext = await executeContractQuery(contractQuery);
      } catch {
        // Silent fail
      }
    }

    // Reload memories fresh from storage each time (only for registered)
    const currentMemories = features.memory ? getMemories() : [];

    const userMsg: ChatMessageWithStatus = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

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

    const controller = new AbortController();
    abortRef.current = controller;

    const history = getChatHistory();

    // Build messages — inject contract context if available
    const userContent = contractContext
      ? text.trim() + contractContext
      : text.trim();

    const llmMessages = [
      ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
    ];

    await streamChat({
      messages: llmMessages,
      memories: currentMemories,
      userMessage: text.trim(),
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
        const finalAsst: ChatMessage = { ...assistantMsg, content: fullText, isStreaming: false } as ChatMessage;
        const updatedHistory = [...history, { ...userMsg, isStreaming: undefined }, finalAsst];
        saveChatHistory(updatedHistory);

        // ── POST-RESPONSE PROCESSING (only for registered users) ──

        if (features.memory) {
          // Step 1: Fast regex extraction (immediate)
          const regexMems = extractMemories(text, fullText);
          let allMems = currentMemories;
          if (regexMems.length > 0) {
            allMems = deduplicateMemories([...currentMemories, ...regexMems]);
            saveMemories(allMems);
            setMemoriesState(allMems);
          }

          // Step 2: AI-powered extraction (background, non-blocking)
          runBackgroundMemoryExtraction(text, fullText, allMems);
        }

        if (features.selfLearning) {
          // Step 3: Self-learning (background, non-blocking)
          setTimeout(() => {
            runBackgroundSelfLearning(text, fullText);
          }, 1500);
        }

        if (features.goals) {
          // Step 4: Goal extraction (background, non-blocking)
          setTimeout(() => {
            runBackgroundGoalExtraction(text);
          }, 2000);
        }

        // Voice Mode: TTS auto-read response
        if (voiceEnabled && ttsSupported) {
          speakText(fullText);
        }

        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsg.id ? { ...m, content: fullText, isStreaming: false } : m)
        );
        setIsLoading(false);
      },
      onError: (error) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `Error: ${error}`, isStreaming: false }
              : m
          )
        );
        setIsLoading(false);
      },
    });
  }, [isLoading, isListening, voiceEnabled, ttsSupported, runBackgroundMemoryExtraction, runBackgroundSelfLearning, runBackgroundGoalExtraction]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const handleClear = async () => {
    // Generate session summary before clearing (if registered and there are messages)
    if (registered && messages.length >= 4) {
      try {
        const chatMessages = messages.map(m => ({ role: m.role, content: m.content }));
        await generateSessionSummary(chatMessages, API_KEY);
      } catch {
        // Silent fail — don't block clear
      }
    }

    // Stop any TTS
    stopSpeaking();

    // Only clear chat history — preserve the brain (memories, learning, goals, personality)
    clearChatHistory();
    setMessages([]);
    setShowSuggestions(true);

    // Reset current mood since chat is cleared
    setCurrentMood(null);
  };

  const hasText = inputText.trim().length > 0;
  const suggestedPrompts = registered ? SUGGESTED_PROMPTS_REGISTERED : SUGGESTED_PROMPTS_UNREGISTERED;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#09090B' }}>

      {/* ── Header ── */}
      <div style={{
        padding: isMobile ? '10px 16px' : '10px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#09090B',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#A1A1AA', letterSpacing: '-0.01em' }}>Embris</span>
          {registered && currentMood && currentMood.confidence > 0.3 && (
            <MoodDot mood={currentMood.mood} />
          )}
          {/* Registration status badge */}
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
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Voice mode toggle */}
          {sttSupported && (
            <button
              onClick={handleToggleVoice}
              title={voiceEnabled ? 'Disable voice mode' : 'Enable voice mode'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 500,
                padding: '4px 8px', borderRadius: 6,
                border: 'none', cursor: 'pointer',
                backgroundColor: voiceEnabled ? 'rgba(249,115,22,0.12)' : 'transparent',
                color: voiceEnabled ? '#F97316' : '#3F3F46',
                transition: 'all 0.15s',
              }}
            >
              <MicIcon size={11} />
              {!isMobile && (voiceEnabled ? 'Voice On' : 'Voice')}
            </button>
          )}
          {walletAddress && !isMobile && (
            <span style={{
              fontSize: 11, color: '#3F3F46',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          )}
          {registered && activeGoalCount > 0 && (
            <span style={{
              fontSize: 11, color: '#F59E0B', fontWeight: 400,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {activeGoalCount} {isMobile ? 'goal' : activeGoalCount === 1 ? 'goal' : 'goals'}
            </span>
          )}
          {registered && memories.length > 0 && (
            <span style={{
              fontSize: 11, color: '#3F3F46', fontWeight: 400,
            }}>
              {memories.length} {isMobile ? 'mem' : 'memories'}
            </span>
          )}
          <button onClick={handleClear} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, color: '#3F3F46', background: 'none',
            border: 'none', cursor: 'pointer', padding: '6px 8px',
            borderRadius: 6,
          }}>
            <TrashIcon size={12} />
            {!isMobile && 'Clear'}
          </button>
        </div>
      </div>

      {/* ── Registration Banner (shown when unregistered) ── */}
      {!registered && messages.length > 0 && (
        <RegistrationBanner onRegisterClick={() => setShowRegistrationModal(true)} />
      )}

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {messages.length === 0 && showSuggestions && (
          <div className="fade-in" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', flex: 1, gap: isMobile ? 32 : 40,
          }}>
            <div style={{ textAlign: 'center' }}>
              <svg width={28} height={28} viewBox="0 0 32 32" fill="none" style={{ marginBottom: 20, opacity: 0.7 }}>
                <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
                <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
              </svg>
              <h3 style={{
                fontSize: isMobile ? 20 : 24, fontWeight: 600, color: '#F4F4F5',
                marginBottom: 8, letterSpacing: '-0.03em',
              }}>Ask Embris anything</h3>
              <p style={{ fontSize: 14, color: '#3F3F46' }}>
                {registered
                  ? 'Your self-learning companion — I remember, reflect, grow, and track your goals'
                  : 'Your AI companion for the Vaultfire Protocol — register on-chain to unlock my full potential'
                }
              </p>
            </div>

            {/* Registration CTA for unregistered users */}
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
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.15)';
                  e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(249,115,22,0.2)';
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
                <button key={prompt} onClick={() => sendMessage(prompt)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: 12, color: '#52525B',
                    fontSize: 13, cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s ease',
                    fontWeight: 400, lineHeight: 1.4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#A1A1AA'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#52525B'; }}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list — centered with max-width like ChatGPT */}
        <div style={{
          maxWidth: 680, width: '100%', margin: '0 auto',
          padding: isMobile ? '20px 16px' : '28px 24px',
          display: 'flex', flexDirection: 'column', gap: isMobile ? 24 : 28,
        }}>
          {messages.map((msg) => (
            <div key={msg.id} className="fade-in" style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              gap: 10, alignItems: 'flex-start',
            }}>
              {/* Small flame icon for Embris — 16px, like ChatGPT's avatar */}
              {msg.role === 'assistant' && <EmbrisFlame />}

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
                {msg.isStreaming && msg.content === '' ? (
                  <TypingIndicator />
                ) : msg.role === 'assistant' ? (
                  <MarkdownText text={msg.content} />
                ) : (
                  msg.content
                )}
              </div>

              {/* TTS speaker button for assistant messages */}
              {msg.role === 'assistant' && voiceEnabled && ttsSupported && msg.content && !msg.isStreaming && (
                <button
                  onClick={() => handleSpeak(msg.content)}
                  title="Read aloud"
                  style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: 4,
                    border: 'none', background: 'transparent',
                    color: '#3F3F46', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: 2, transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#F97316'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#3F3F46'; }}
                >
                  <SpeakerIcon size={12} />
                </button>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input ── */}
      <div style={{
        padding: isMobile ? '12px 16px 16px' : '16px 24px 24px',
        backgroundColor: '#09090B',
      }}>
        <div style={{
          maxWidth: 680, margin: '0 auto',
        }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            backgroundColor: '#111113',
            borderRadius: 16,
            padding: isMobile ? '10px 12px' : '12px 16px',
            boxShadow: inputFocused
              ? '0 0 0 1px rgba(255,255,255,0.06)'
              : isListening
                ? '0 0 0 1px rgba(249,115,22,0.3)'
                : '0 0 0 1px rgba(255,255,255,0.03)',
            transition: 'box-shadow 0.15s ease',
          }}>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={isListening ? 'Listening...' : 'Message Embris...'}
              disabled={isLoading}
              rows={1}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#F4F4F5', fontSize: 15, resize: 'none',
                maxHeight: 120, overflowY: 'auto', lineHeight: 1.5,
                fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em',
                fontWeight: 400,
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
            />

            {/* Mic button — shown when voice mode is enabled */}
            {voiceEnabled && sttSupported && (
              <button
                onClick={toggleListening}
                disabled={isLoading}
                title={isListening ? 'Stop listening' : 'Start listening'}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  cursor: isLoading ? 'default' : 'pointer',
                  backgroundColor: isListening ? '#F97316' : 'transparent',
                  color: isListening ? '#09090B' : '#52525B',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease', flexShrink: 0,
                  position: 'relative',
                }}>
                <MicIcon size={14} />
                {/* Pulsing indicator when listening */}
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
              }}>
              {isLoading ? (
                <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.06)', borderTopColor: '#52525B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <SendIcon size={14} />
              )}
            </button>
          </div>
          {!isMobile && (
            <p style={{ fontSize: 11, color: '#27272A', marginTop: 8, textAlign: 'center' }}>
              Enter to send · Shift+Enter for new line{voiceEnabled ? ' · Click mic to speak' : ''}
            </p>
          )}
        </div>
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
