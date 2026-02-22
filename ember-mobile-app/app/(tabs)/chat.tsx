import {
  Text,
  View,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Keyboard,
  Alert,
  ScrollView,
} from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import {
  type ChatMessage,
  type Memory,
  extractMemories,
  saveMemories,
  getMemories,
  saveChatHistory,
  getChatHistory,
  clearChatHistory,
  clearMemories,
} from "@/lib/memory";
import {
  getWalletAddress as getLegacyWalletAddress,
  saveWalletAddress,
  clearWalletAddress,
  validateAddress,
  getWalletData,
  type WalletData,
} from "@/lib/wallet";
import {
  getWalletAddress as getNativeWalletAddress,
  getWalletContextForEmbris,
} from "@/lib/wallet-core";
import { enhancedStreamChat } from "@/lib/enhanced-stream-chat";
import { streamChat } from "@/lib/stream-chat";
import {
  syncAuth,
  createSyncConversation,
  updateSyncConversation,
  pushMemories,
  fetchMemories as fetchSyncMemories,
} from "@/lib/sync-service";
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInRight,
  SlideInLeft,
} from "react-native-reanimated";
import { TypingIndicator } from "@/components/typing-indicator";
import { MarkdownText } from "@/components/markdown-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Intelligence modules
import { generateReflection, updatePatterns, recordConversation } from "@/lib/self-learning";
import { detectEmotion, recordEmotion } from "@/lib/emotional-intelligence";
import { trackMessage, trackSession } from "@/lib/analytics";
import { addNotification, checkMilestones } from "@/lib/notifications";
import { detectContractQuery, executeContractQuery } from "@/lib/contract-interaction";
import { speakText, stopSpeaking, isTTSSupported, isSTTSupported, getVoiceModeEnabled, setVoiceModeEnabled, getVoiceRate, setVoiceRate as saveVoiceRate, getVoicePitch, setVoicePitch as saveVoicePitch, createWebSpeechRecognition } from "@/lib/voice-mode";
import {
  type ConversationMeta,
  getConversationIndex,
  ensureActiveConversation,
  createConversation,
  deleteConversation,
  getConversationMessages,
  saveConversationMessages,
  setActiveConversationId,
  updateConversationTitle,
} from "@/lib/conversations";

interface ChatMessageWithStatus extends ChatMessage {
  isTyping?: boolean;
  isStreaming?: boolean;
}

const SUGGESTED_PROMPTS = [
  "What is ERC-8004?",
  "Show me the Base contracts",
  "Explain the core values",
  "How does the bridge work?",
  "Check chain status",
  "How many agents are registered?",
];

export default function ChatScreen() {
  const colors = useColors();
  const [messages, setMessages] = useState<ChatMessageWithStatus[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [memories, setMemoriesState] = useState<Memory[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletData, setWalletDataState] = useState<WalletData | null>(null);
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [walletInput, setWalletInput] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncConvoId, setSyncConvoId] = useState<number | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeakingNow, setIsSpeakingNow] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceRate, setVoiceRateState] = useState(1.0);
  const [voicePitch, setVoicePitchState] = useState(1.0);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  // Multi-conversation state
  const [conversationList, setConversationList] = useState<ConversationMeta[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const [confirmDeleteConvId, setConfirmDeleteConvId] = useState<string | null>(null);
  const [companionDisplayName, setCompanionDisplayName] = useState('Embris');
  const titleSetRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);
  const chatMutation = trpc.chat.send.useMutation();
  const inputRef = useRef<TextInput>(null);
  const streamingRef = useRef<string>("");
  const messageCountRef = useRef(0);
  // Voice auto-send refs (avoid stale closures)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendMessageRef = useRef<((text: string) => void) | null>(null);
  const voiceEnabledRef = useRef(false);

  // Load data on mount
  // Refresh conversation list
  const refreshConversationList = useCallback(async () => {
    const index = await getConversationIndex();
    setConversationList(index);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      // Initialize multi-conversation system
      const convId = await ensureActiveConversation();
      setActiveConvId(convId);
      titleSetRef.current = false;
      const convMessages = await getConversationMessages(convId);
      await refreshConversationList();

      // Load companion name
      const storedCompanionName = await AsyncStorage.getItem('vaultfire_companion_name');
      if (storedCompanionName) setCompanionDisplayName(storedCompanionName);

      const [mems, legacyAddr, nativeAddr, voiceMode, rate, pitch] = await Promise.all([
        getMemories(),
        getLegacyWalletAddress(),
        getNativeWalletAddress(),
        getVoiceModeEnabled(),
        getVoiceRate(),
        getVoicePitch(),
      ]);
      if (convMessages.length > 0) setMessages(convMessages);
      setMemoriesState(mems);
      setVoiceEnabled(voiceMode);
      voiceEnabledRef.current = voiceMode;
      setVoiceRateState(rate);
      setVoicePitchState(pitch);
      messageCountRef.current = convMessages.length;

      const addr = nativeAddr || legacyAddr;
      if (addr) {
        setWalletAddress(addr);
        getWalletData(addr).then(setWalletDataState).catch(() => {});
        syncAuth(addr)
          .then((profile) => {
            if (profile?.dbAvailable) {
              setSyncEnabled(true);
              fetchSyncMemories(addr).then((serverMems) => {
                if (serverMems.length > 0) {
                  const merged = [...mems];
                  serverMems.forEach((sm) => {
                    if (!merged.some((m) => m.content === sm.content)) {
                      merged.push({
                        id: `sync_${sm.id}`,
                        type: "fact" as const,
                        content: sm.content,
                        timestamp: new Date(sm.createdAt).getTime(),
                      });
                    }
                  });
                  setMemoriesState(merged);
                }
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }

      // Track session
      trackSession().catch(() => {});
    };
    loadData();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const toggleVoiceMode = useCallback(async () => {
    const newValue = !voiceEnabled;
    setVoiceEnabled(newValue);
    voiceEnabledRef.current = newValue;
    await setVoiceModeEnabled(newValue);
    if (!newValue) {
      await stopSpeaking();
      setIsSpeakingNow(false);
      setIsListening(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
      setShowVoiceSettings(false);
    }
  }, [voiceEnabled]);

  const handleSpeak = useCallback(async (text: string) => {
    if (isSpeakingNow) {
      await stopSpeaking();
      setIsSpeakingNow(false);
    } else {
      setIsSpeakingNow(true);
      await speakText(text, {
        onStart: () => setIsSpeakingNow(true),
        onEnd: () => setIsSpeakingNow(false),
        rate: voiceRate,
        pitch: voicePitch,
      });
    }
  }, [isSpeakingNow, voiceRate, voicePitch]);

  // Push-to-talk: start/stop STT and auto-send on speech end
  const toggleListening = useCallback(() => {
    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      setIsListening(false);
      return;
    }

    const recognition = createWebSpeechRecognition();
    if (!recognition) {
      // STT not available on this platform — show alert
      Alert.alert('Voice Input', 'Speech recognition is not available on this device. Please type your message.');
      return;
    }

    recognitionRef.current = recognition;
    transcriptRef.current = '';
    setIsListening(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recognition as any).onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      transcriptRef.current = transcript;
      setInputText(transcript);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recognition as any).onend = () => {
      setIsListening(false);
      const transcript = transcriptRef.current.trim();
      if (voiceEnabledRef.current && transcript && sendMessageRef.current) {
        setTimeout(() => {
          if (transcript && sendMessageRef.current) {
            setInputText('');
            transcriptRef.current = '';
            sendMessageRef.current(transcript);
          }
        }, 200);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recognition as any).onerror = () => {
      setIsListening(false);
      transcriptRef.current = '';
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recognition as any).start();
  }, [isListening]);

  const handleRateChange = useCallback(async (newRate: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, newRate));
    setVoiceRateState(clamped);
    await saveVoiceRate(clamped);
  }, []);

  const handlePitchChange = useCallback(async (newPitch: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, newPitch));
    setVoicePitchState(clamped);
    await saveVoicePitch(clamped);
  }, []);

  const connectWallet = useCallback(async () => {
    const trimmed = walletInput.trim();
    if (!trimmed) return;
    setWalletLoading(true);
    try {
      const isValid = await validateAddress(trimmed);
      if (!isValid) {
        Alert.alert("Invalid Address", "Please enter a valid Ethereum address (0x...)");
        setWalletLoading(false);
        return;
      }
      await saveWalletAddress(trimmed);
      setWalletAddress(trimmed);
      setWalletInput("");
      const data = await getWalletData(trimmed);
      setWalletDataState(data);
      setWalletModalVisible(false);
    } catch {
      Alert.alert("Error", "Failed to connect wallet. Please try again.");
    } finally {
      setWalletLoading(false);
    }
  }, [walletInput]);

  const disconnectWallet = useCallback(async () => {
    await clearWalletAddress();
    setWalletAddress(null);
    setWalletDataState(null);
    setWalletModalVisible(false);
  }, []);

  const handleClearChat = useCallback(async () => {
    Alert.alert(
      "Clear Conversation",
      "This will delete all messages and memories. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setMessages([]);
            setMemoriesState([]);
            await clearChatHistory();
            await clearMemories();
            // Start a fresh conversation
            if (activeConvId) {
              await saveConversationMessages(activeConvId, []);
            }
            const meta = await createConversation();
            setActiveConvId(meta.id);
            titleSetRef.current = false;
            messageCountRef.current = 0;
            await refreshConversationList();
            setMenuVisible(false);
          },
        },
      ]
    );
  }, [activeConvId, refreshConversationList]);

  // Multi-conversation handlers
  const handleNewConversation = useCallback(async () => {
    const meta = await createConversation();
    setActiveConvId(meta.id);
    setMessages([]);
    titleSetRef.current = false;
    messageCountRef.current = 0;
    await refreshConversationList();
    setShowConversations(false);
  }, [refreshConversationList]);

  const handleSwitchConversation = useCallback(async (id: string) => {
    if (id === activeConvId) { setShowConversations(false); return; }
    await setActiveConversationId(id);
    setActiveConvId(id);
    titleSetRef.current = false;
    const msgs = await getConversationMessages(id);
    setMessages(msgs);
    messageCountRef.current = msgs.length;
    setShowConversations(false);
  }, [activeConvId]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    await deleteConversation(id);
    const index = await getConversationIndex();
    setConversationList(index);
    if (id === activeConvId) {
      if (index.length > 0) {
        await setActiveConversationId(index[0].id);
        setActiveConvId(index[0].id);
        const msgs = await getConversationMessages(index[0].id);
        setMessages(msgs);
      } else {
        const meta = await createConversation();
        setActiveConvId(meta.id);
        setMessages([]);
        await refreshConversationList();
      }
    }
    setConfirmDeleteConvId(null);
  }, [activeConvId, refreshConversationList]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const msgText = (text || inputText).trim();
      if (!msgText || isLoading) return;
      Keyboard.dismiss();

      const userMsg: ChatMessageWithStatus = {
        id: `msg_${Date.now()}_user`,
        role: "user",
        content: msgText,
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInputText("");
      setIsLoading(true);
      streamingRef.current = "";

      // Track analytics
      const emotion = detectEmotion(msgText);
      recordEmotion(emotion).catch(() => {});
      trackMessage(emotion.mood).catch(() => {});
      updatePatterns(msgText).catch(() => {});
      recordConversation().catch(() => {});
      generateReflection(msgText, "").catch(() => {});

      // Check for contract queries
      const contractQuery = detectContractQuery(msgText);

      const streamMsgId = `msg_${Date.now()}_stream`;
      const streamingMsg: ChatMessageWithStatus = {
        id: streamMsgId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isTyping: true,
        isStreaming: true,
      };
      setMessages((prev) => [...prev, streamingMsg]);

      const recentMessages = updatedMessages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const memoryStrings = memories.map((m) => m.content);
      const walletCtx = await getWalletContextForEmbris();
      if (walletCtx) {
        memoryStrings.push(walletCtx);
      } else if (walletAddress) {
        memoryStrings.push(`User wallet: ${walletAddress}`);
      }

      // If contract query detected, execute it and prepend to context
      let contractContext = "";
      if (contractQuery) {
        try {
          const result = await executeContractQuery(contractQuery, walletAddress);
          if (result.success) {
            contractContext = `\n\n[ON-CHAIN DATA - Include this in your response]\n${result.data}`;
          }
        } catch { /* ignore */ }
      }

      if (contractContext) {
        const lastMsg = recentMessages[recentMessages.length - 1];
        if (lastMsg) {
          lastMsg.content += contractContext;
        }
      }

      try {
        await enhancedStreamChat({
          messages: recentMessages,
          memories: memoryStrings,
          userMessage: msgText,
          onToken: (token) => {
            streamingRef.current += token;
            const currentText = streamingRef.current;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamMsgId
                  ? { ...m, content: currentText, isTyping: false, isStreaming: true }
                  : m
              )
            );
          },
          onDone: async (fullText) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamMsgId
                  ? { ...m, content: fullText, isStreaming: false, isTyping: false }
                  : m
              )
            );

            // Extract and save memories
            const newMemories = extractMemories(msgText, fullText);
            if (newMemories.length > 0) {
              await saveMemories(newMemories);
              setMemoriesState((prev) => [...prev, ...newMemories]);
            }

            // Save chat history
            const finalMessages = [
              ...updatedMessages,
              {
                id: streamMsgId,
                role: "assistant" as const,
                content: fullText,
                timestamp: Date.now(),
              },
            ];
            if (activeConvId) {
              await saveConversationMessages(activeConvId, finalMessages);
              if (!titleSetRef.current) {
                await updateConversationTitle(activeConvId, msgText);
                titleSetRef.current = true;
                refreshConversationList();
              }
            } else {
              await saveChatHistory(finalMessages);
            }

            // Update message count and check milestones
            messageCountRef.current += 2;
            checkMilestones(messageCountRef.current).catch(() => {});

            // Auto-speak if voice mode enabled
            if (voiceEnabled && isTTSSupported()) {
              setIsSpeakingNow(true);
              speakText(fullText, {
                onStart: () => setIsSpeakingNow(true),
                onEnd: () => setIsSpeakingNow(false),
                rate: voiceRate,
                pitch: voicePitch,
              }).catch(() => setIsSpeakingNow(false));
            }

            // Sync to server
            if (walletAddress && syncEnabled) {
              const syncMsgs = finalMessages.map((m) => ({
                role: m.role,
                content: m.content,
                timestamp: m.timestamp,
              }));
              if (syncConvoId) {
                updateSyncConversation(walletAddress, syncConvoId, syncMsgs).catch(() => {});
              } else {
                createSyncConversation(walletAddress, msgText.slice(0, 50), syncMsgs)
                  .then((result) => { if (result) setSyncConvoId(result.id); })
                  .catch(() => {});
              }
              if (newMemories.length > 0) {
                pushMemories(walletAddress, newMemories.map((m) => ({ content: m.content }))).catch(() => {});
              }
            }

            setIsLoading(false);
          },
          onError: async (error) => {
            console.error("Enhanced stream error:", error);
            // Fall back to basic stream chat
            try {
              await streamChat({
                messages: recentMessages,
                memories: memoryStrings,
                onToken: (token) => {
                  streamingRef.current += token;
                  const currentText = streamingRef.current;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === streamMsgId
                        ? { ...m, content: currentText, isTyping: false, isStreaming: true }
                        : m
                    )
                  );
                },
                onDone: async (fullText) => {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === streamMsgId
                        ? { ...m, content: fullText, isStreaming: false, isTyping: false }
                        : m
                    )
                  );
                  const newMemories = extractMemories(msgText, fullText);
                  if (newMemories.length > 0) {
                    await saveMemories(newMemories);
                    setMemoriesState((prev) => [...prev, ...newMemories]);
                  }
                  const finalMessages = [
                    ...updatedMessages,
                    { id: streamMsgId, role: "assistant" as const, content: fullText, timestamp: Date.now() },
                  ];
                  if (activeConvId) {
              await saveConversationMessages(activeConvId, finalMessages);
              if (!titleSetRef.current) {
                await updateConversationTitle(activeConvId, msgText);
                titleSetRef.current = true;
                refreshConversationList();
              }
            } else {
              await saveChatHistory(finalMessages);
            }
                  setIsLoading(false);
                },
                onError: async () => {
                  // Final fallback to tRPC
                  try {
                    const result = await chatMutation.mutateAsync({
                      messages: recentMessages,
                      memories: memoryStrings,
                    });
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === streamMsgId
                          ? { ...m, content: result.response, isStreaming: false, isTyping: false }
                          : m
                      )
                    );
                    const finalMessages = [
                      ...updatedMessages,
                      { id: streamMsgId, role: "assistant" as const, content: result.response, timestamp: Date.now() },
                    ];
                    if (activeConvId) {
              await saveConversationMessages(activeConvId, finalMessages);
              if (!titleSetRef.current) {
                await updateConversationTitle(activeConvId, msgText);
                titleSetRef.current = true;
                refreshConversationList();
              }
            } else {
              await saveChatHistory(finalMessages);
            }
                  } catch {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === streamMsgId
                          ? { ...m, content: "I'm having trouble connecting right now. Please check your connection and try again.", isStreaming: false, isTyping: false }
                          : m
                      )
                    );
                  }
                  setIsLoading(false);
                },
              });
            } catch {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamMsgId
                    ? { ...m, content: "I'm having trouble connecting right now. Please check your connection and try again.", isStreaming: false, isTyping: false }
                    : m
                )
              );
              setIsLoading(false);
            }
          },
        });
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId
              ? { ...m, content: "I'm having trouble connecting right now. Please check your connection and try again.", isStreaming: false, isTyping: false }
              : m
          )
        );
        setIsLoading(false);
      }
    },
    [inputText, isLoading, messages, memories, walletAddress, chatMutation, voiceEnabled, voiceRate, voicePitch, syncEnabled, syncConvoId, activeConvId, refreshConversationList]
  );

  // Keep sendMessageRef always pointing to the latest sendMessage
  // sendMessage accepts an optional text param, so we can call it directly
  useEffect(() => {
    sendMessageRef.current = (text: string) => {
      sendMessage(text);
    };
  }, [sendMessage]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessageWithStatus }) => {
      const isUser = item.role === "user";

      if (item.isTyping && !item.content) {
        return (
          <Animated.View entering={FadeIn.duration(200)} style={styles.assistantRow}>
            <View style={[styles.avatarSmall, { backgroundColor: colors.primary }]}>
              <Text style={{ fontSize: 12 }}>🔥</Text>
            </View>
            <TypingIndicator
              dotColor={colors.muted}
              backgroundColor={colors.surface}
            />
          </Animated.View>
        );
      }

      if (isUser) {
        return (
          <Animated.View entering={SlideInRight.duration(250).delay(50)} style={styles.userRow}>
            <View style={[styles.userBubble, { backgroundColor: colors.primary }]}>
              <Text style={{ color: "#FAFAFA", fontSize: 15, lineHeight: 22 }}>
                {item.content}
              </Text>
            </View>
          </Animated.View>
        );
      }

      // Assistant message
      return (
        <Animated.View entering={SlideInLeft.duration(250).delay(50)} style={styles.assistantRow}>
          <View style={[styles.avatarSmall, { backgroundColor: colors.primary }]}>
            <Text style={{ fontSize: 12 }}>🔥</Text>
          </View>
          <View style={[styles.assistantBubble, { backgroundColor: colors.surface }]}>
            <MarkdownText
              text={item.content}
              baseColor={colors.foreground}
              codeBackground={colors.background}
              codeBorderColor={colors.border}
              accentColor={colors.primary}
            />
            {item.isStreaming && (
              <Animated.View entering={FadeIn.duration(100)} style={styles.streamCursor}>
                <View style={[styles.cursorDot, { backgroundColor: colors.primary }]} />
              </Animated.View>
            )}
            {/* TTS Speaker Button */}
            {!item.isStreaming && item.content && voiceEnabled && isTTSSupported() && (
              <Pressable
                onPress={() => handleSpeak(item.content)}
                style={({ pressed }) => [
                  styles.speakerBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <IconSymbol
                  name={isSpeakingNow ? "stop.fill" : "speaker.wave.2.fill"}
                  size={14}
                  color={colors.muted}
                />
              </Pressable>
            )}
          </View>
        </Animated.View>
      );
    },
    [colors, voiceEnabled, isSpeakingNow, handleSpeak]
  );

  const hasText = inputText.trim().length > 0;
  const showWelcome = messages.length === 0;

  const truncateAddr = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatBalance = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "0";
    if (num === 0) return "0";
    if (num < 0.0001) return "<0.0001";
    return num.toFixed(4);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScreenContainer className="p-0">
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerAvatar, { backgroundColor: colors.primary }]}>
              <Text style={{ fontSize: 18 }}>🔥</Text>
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>{companionDisplayName}</Text>
              <Text style={[styles.headerSubtitle, { color: isSpeakingNow ? colors.primary : colors.muted }]}>
                {isSpeakingNow ? "Speaking..." : isLoading ? "Thinking..." : voiceEnabled ? "Voice Mode ✓" : syncEnabled ? "Synced ✓" : "Vaultfire Protocol"}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {/* Stop Speaking Button */}
            {isSpeakingNow && (
              <Pressable
                onPress={async () => { await stopSpeaking(); setIsSpeakingNow(false); }}
                style={({ pressed }) => [
                  styles.headerBtn,
                  {
                    backgroundColor: `${colors.error}20`,
                    borderColor: colors.error,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <IconSymbol name="stop.fill" size={14} color={colors.error} />
              </Pressable>
            )}
            {/* Voice Mode Toggle */}
            <Pressable
              onPress={toggleVoiceMode}
              onLongPress={() => voiceEnabled && setShowVoiceSettings(true)}
              style={({ pressed }) => [
                styles.headerBtn,
                {
                  backgroundColor: voiceEnabled ? `${colors.primary}20` : colors.surface,
                  borderColor: voiceEnabled ? colors.primary : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <IconSymbol
                name={voiceEnabled ? (isSpeakingNow ? "speaker.wave.2.fill" : "mic.fill") : "mic.fill"}
                size={14}
                color={voiceEnabled ? colors.primary : colors.muted}
              />
            </Pressable>
            <Pressable
              onPress={() => setWalletModalVisible(true)}
              style={({ pressed }) => [
                styles.headerBtn,
                {
                  backgroundColor: walletAddress ? `${colors.success}20` : colors.surface,
                  borderColor: walletAddress ? colors.success : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <IconSymbol
                name="person.fill"
                size={14}
                color={walletAddress ? colors.success : colors.muted}
              />
            </Pressable>
            {/* Conversations Button */}
            <Pressable
              onPress={() => setShowConversations(true)}
              style={({ pressed }) => [
                styles.headerBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <IconSymbol name="doc.on.doc.fill" size={14} color={colors.muted} />
            </Pressable>
            <Pressable
              onPress={() => setMenuVisible(true)}
              style={({ pressed }) => [
                styles.headerBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <IconSymbol name="ellipsis" size={16} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        {/* Welcome or Messages */}
        {showWelcome ? (
          <View style={styles.welcomeContainer}>
            <Animated.View entering={FadeInDown.duration(400)} style={styles.welcomeContent}>
              <View style={[styles.welcomeIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Text style={{ fontSize: 40 }}>🔥</Text>
              </View>
              <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
                Welcome to {companionDisplayName}
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.muted }]}>
                Your AI companion for the Vaultfire Protocol. Ask about contracts, ERC-8004,
                governance, or anything about ethical AI.
              </Text>
              {voiceEnabled && (
                <View style={[styles.voiceBadge, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
                  <IconSymbol name="mic.fill" size={14} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
                    Voice Mode Active
                  </Text>
                </View>
              )}
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.promptsContainer}>
              <Text style={[styles.promptsLabel, { color: colors.muted }]}>Try asking</Text>
              <View style={styles.promptsGrid}>
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <Pressable
                    key={i}
                    onPress={() => sendMessage(prompt)}
                    style={({ pressed }) => [
                      styles.promptChip,
                      {
                        backgroundColor: colors.surface,
                        borderColor: pressed ? colors.primary : colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>
                      {prompt}
                    </Text>
                    <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        {/* Input Bar */}
        <View style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: colors.surface,
                borderColor: hasText ? colors.primary : colors.border,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              value={inputText}
              onChangeText={setInputText}
              placeholder={voiceEnabled ? "Speak or type..." : `Message ${companionDisplayName}...`}
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.foreground }]}
              multiline
              maxLength={4000}
              editable={!isLoading}
              returnKeyType="default"
              blurOnSubmit={false}
            />
            {/* Mic push-to-talk button (visible when voice mode is on and no text) */}
            {voiceEnabled && !hasText && !isLoading && (
              <Pressable
                onPress={toggleListening}
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center' as const,
                  justifyContent: 'center' as const,
                  marginRight: 4,
                  backgroundColor: isListening ? colors.primary : `${colors.primary}20`,
                  borderWidth: 1,
                  borderColor: isListening ? colors.primary : `${colors.primary}40`,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <IconSymbol
                  name={isListening ? "stop.fill" : "mic.fill"}
                  size={16}
                  color={isListening ? "#FAFAFA" : colors.primary}
                />
              </Pressable>
            )}
            <Pressable
              onPress={() => sendMessage()}
              disabled={!hasText || isLoading}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: hasText && !isLoading ? colors.primary : "transparent",
                  opacity: pressed ? 0.7 : hasText && !isLoading ? 1 : 0.3,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <IconSymbol
                  name="paperplane.fill"
                  size={16}
                  color={hasText ? "#FAFAFA" : colors.muted}
                />
              )}
            </Pressable>
          </View>
          <Text style={[styles.inputDisclaimer, { color: colors.muted }]}>
            {companionDisplayName} can make mistakes. Verify important information.
          </Text>
        </View>

        {/* Menu Modal */}
        <Modal visible={menuVisible} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
            <Animated.View
              entering={FadeIn.duration(150)}
              style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {/* Voice Mode Toggle */}
              <Pressable
                onPress={() => { toggleVoiceMode(); setMenuVisible(false); }}
                style={({ pressed }) => [
                  styles.menuItem,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <IconSymbol name="mic.fill" size={18} color={voiceEnabled ? colors.primary : colors.muted} />
                <Text style={{ color: voiceEnabled ? colors.primary : colors.foreground, fontSize: 15, fontWeight: "500" }}>
                  {voiceEnabled ? "Disable Voice Mode" : "Enable Voice Mode"}
                </Text>
              </Pressable>
              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              {/* Voice Settings */}
              {voiceEnabled && (
                <>
                  <Pressable
                    onPress={() => { setMenuVisible(false); setShowVoiceSettings(true); }}
                    style={({ pressed }) => [
                      styles.menuItem,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <IconSymbol name="gearshape.fill" size={18} color={colors.muted} />
                    <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "500" }}>
                      Voice Settings
                    </Text>
                  </Pressable>
                  <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                </>
              )}
              <Pressable
                onPress={handleClearChat}
                style={({ pressed }) => [
                  styles.menuItem,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <IconSymbol name="trash.fill" size={18} color={colors.error} />
                <Text style={{ color: colors.error, fontSize: 15, fontWeight: "500" }}>
                  Clear Conversation
                </Text>
              </Pressable>
              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              <Pressable
                onPress={() => setMenuVisible(false)}
                style={({ pressed }) => [
                  styles.menuItem,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <IconSymbol name="xmark" size={18} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 15 }}>Cancel</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* Voice Settings Modal */}
        <Modal visible={showVoiceSettings} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowVoiceSettings(false)}>
            <Pressable onPress={() => {}}>
              <Animated.View
                entering={FadeInDown.duration(250)}
                style={[styles.walletCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.walletHeader}>
                  <IconSymbol name="gearshape.fill" size={20} color={colors.primary} />
                  <Text style={[styles.walletTitle, { color: colors.foreground }]}>Voice Settings</Text>
                </View>

                {/* Speech Rate */}
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Speech Rate</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{voiceRate.toFixed(1)}x</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable
                      onPress={() => handleRateChange(voiceRate - 0.1)}
                      style={({ pressed }) => [{ padding: 8, borderRadius: 8, backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>−</Text>
                    </Pressable>
                    <View style={{ flex: 1, height: 4, backgroundColor: colors.background, borderRadius: 2, overflow: "hidden" }}>
                      <View style={{ width: `${((voiceRate - 0.5) / 1.5) * 100}%`, height: "100%", backgroundColor: colors.primary, borderRadius: 2 }} />
                    </View>
                    <Pressable
                      onPress={() => handleRateChange(voiceRate + 0.1)}
                      style={({ pressed }) => [{ padding: 8, borderRadius: 8, backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>+</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Pitch */}
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Pitch</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{voicePitch.toFixed(1)}x</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable
                      onPress={() => handlePitchChange(voicePitch - 0.1)}
                      style={({ pressed }) => [{ padding: 8, borderRadius: 8, backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>−</Text>
                    </Pressable>
                    <View style={{ flex: 1, height: 4, backgroundColor: colors.background, borderRadius: 2, overflow: "hidden" }}>
                      <View style={{ width: `${((voicePitch - 0.5) / 1.5) * 100}%`, height: "100%", backgroundColor: colors.primary, borderRadius: 2 }} />
                    </View>
                    <Pressable
                      onPress={() => handlePitchChange(voicePitch + 0.1)}
                      style={({ pressed }) => [{ padding: 8, borderRadius: 8, backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>+</Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  onPress={() => setShowVoiceSettings(false)}
                  style={({ pressed }) => [{ marginTop: 4, opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={{ color: colors.muted, textAlign: "center", fontSize: 14 }}>Done</Text>
                </Pressable>
              </Animated.View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Conversations Modal */}
        <Modal visible={showConversations} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowConversations(false)}>
            <Pressable onPress={() => {}}>
              <Animated.View
                entering={FadeInDown.duration(250)}
                style={[styles.walletCard, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: 500 }]}
              >
                <View style={styles.walletHeader}>
                  <IconSymbol name="doc.on.doc.fill" size={20} color={colors.primary} />
                  <Text style={[styles.walletTitle, { color: colors.foreground, flex: 1 }]}>Conversations</Text>
                  <Pressable
                    onPress={handleNewConversation}
                    style={({ pressed }) => [{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                      backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1,
                    }]}
                  >
                    <Text style={{ color: '#FAFAFA', fontSize: 12, fontWeight: '700' }}>+ New</Text>
                  </Pressable>
                </View>
                <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                  {conversationList.length === 0 ? (
                    <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>No conversations yet</Text>
                  ) : (
                    conversationList.map((conv) => (
                      <Pressable
                        key={conv.id}
                        onPress={() => handleSwitchConversation(conv.id)}
                        style={({ pressed }) => [{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                          paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, marginBottom: 4,
                          backgroundColor: conv.id === activeConvId ? `${colors.primary}15` : pressed ? colors.background : 'transparent',
                          borderWidth: conv.id === activeConvId ? 1 : 0,
                          borderColor: conv.id === activeConvId ? `${colors.primary}30` : 'transparent',
                        }]}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text numberOfLines={1} style={{ color: conv.id === activeConvId ? colors.primary : colors.foreground, fontSize: 14, fontWeight: conv.id === activeConvId ? '600' : '400' }}>
                            {conv.title}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                            {new Date(conv.updatedAt).toLocaleDateString()}
                          </Text>
                        </View>
                        {confirmDeleteConvId === conv.id ? (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable onPress={() => handleDeleteConversation(conv.id)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                              <Text style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>Delete</Text>
                            </Pressable>
                            <Pressable onPress={() => setConfirmDeleteConvId(null)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                              <Text style={{ color: colors.muted, fontSize: 12 }}>Cancel</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable onPress={() => setConfirmDeleteConvId(conv.id)} style={({ pressed }) => [{ padding: 4, opacity: pressed ? 0.6 : 1 }]}>
                            <IconSymbol name="trash.fill" size={14} color={colors.muted} />
                          </Pressable>
                        )}
                      </Pressable>
                    ))
                  )}
                </ScrollView>
                <Pressable
                  onPress={() => setShowConversations(false)}
                  style={({ pressed }) => [{ marginTop: 4, opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 14 }}>Close</Text>
                </Pressable>
              </Animated.View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Wallet Modal */}
        <Modal visible={walletModalVisible} transparent animationType="fade">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setWalletModalVisible(false)}
          >
            <Pressable onPress={() => {}}>
              <Animated.View
                entering={FadeInDown.duration(250)}
                style={[
                  styles.walletCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.walletHeader}>
                  <IconSymbol name="person.fill" size={20} color={colors.primary} />
                  <Text style={[styles.walletTitle, { color: colors.foreground }]}>
                    {walletAddress ? "Wallet Connected" : "Connect Wallet"}
                  </Text>
                </View>

                {walletAddress ? (
                  <View style={{ gap: 12 }}>
                    <View style={[styles.addressBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>
                        ADDRESS
                      </Text>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 13,
                          fontFamily: "monospace",
                        }}
                      >
                        {truncateAddr(walletAddress)}
                      </Text>
                    </View>

                    {walletData && (
                      <View style={{ gap: 8 }}>
                        <View
                          style={[
                            styles.balanceRow,
                            { backgroundColor: colors.background, borderColor: colors.border },
                          ]}
                        >
                          <View>
                            <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 2 }}>
                              BASE (ETH)
                            </Text>
                            <Text
                              style={{
                                color: colors.foreground,
                                fontSize: 16,
                                fontWeight: "700",
                              }}
                            >
                              {formatBalance(walletData.balanceBase)}
                            </Text>
                          </View>
                          <View style={[styles.chainBadge, { backgroundColor: `${colors.primary}20` }]}>
                            <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "600" }}>
                              Base
                            </Text>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.balanceRow,
                            { backgroundColor: colors.background, borderColor: colors.border },
                          ]}
                        >
                          <View>
                            <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 2 }}>
                              AVALANCHE (AVAX)
                            </Text>
                            <Text
                              style={{
                                color: colors.foreground,
                                fontSize: 16,
                                fontWeight: "700",
                              }}
                            >
                              {formatBalance(walletData.balanceAvalanche)}
                            </Text>
                          </View>
                          <View style={[styles.chainBadge, { backgroundColor: `${colors.error}20` }]}>
                            <Text style={{ color: colors.error, fontSize: 10, fontWeight: "600" }}>
                              Avax
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    <Pressable
                      onPress={disconnectWallet}
                      style={({ pressed }) => [
                        styles.walletBtn,
                        {
                          backgroundColor: `${colors.error}15`,
                          borderColor: colors.error,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: colors.error, fontWeight: "600", fontSize: 14 }}>
                        Disconnect
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                      Enter your Ethereum address to view balances on Ethereum, Base, and Avalanche.
                    </Text>
                    <TextInput
                      value={walletInput}
                      onChangeText={setWalletInput}
                      placeholder="0x..."
                      placeholderTextColor={colors.muted}
                      style={[
                        styles.walletInputField,
                        {
                          backgroundColor: colors.background,
                          color: colors.foreground,
                          borderColor: walletInput ? colors.primary : colors.border,
                        },
                      ]}
                      editable={!walletLoading}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable
                      onPress={connectWallet}
                      disabled={walletLoading || !walletInput.trim()}
                      style={({ pressed }) => [
                        styles.walletBtn,
                        {
                          backgroundColor: walletInput.trim()
                            ? colors.primary
                            : colors.surface,
                          borderColor: walletInput.trim()
                            ? colors.primary
                            : colors.border,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      {walletLoading ? (
                        <ActivityIndicator size="small" color="#FAFAFA" />
                      ) : (
                        <Text
                          style={{
                            color: walletInput.trim() ? "#FAFAFA" : colors.muted,
                            fontWeight: "600",
                            fontSize: 14,
                          }}
                        >
                          Connect
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}

                <Pressable
                  onPress={() => setWalletModalVisible(false)}
                  style={({ pressed }) => [{ marginTop: 4, opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={{ color: colors.muted, textAlign: "center", fontSize: 14 }}>
                    Cancel
                  </Text>
                </Pressable>
              </Animated.View>
            </Pressable>
          </Pressable>
        </Modal>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  headerRight: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  welcomeContainer: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  welcomeContent: { alignItems: "center", gap: 12, marginBottom: 32 },
  welcomeIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  welcomeTitle: { fontSize: 24, fontWeight: "700" },
  welcomeSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 16,
  },
  voiceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  promptsContainer: { gap: 12 },
  promptsLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  promptsGrid: { gap: 8 },
  promptChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  messagesList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
    paddingLeft: 48,
  },
  assistantRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingRight: 32,
    gap: 8,
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  userBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    maxWidth: "100%",
  },
  assistantBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderTopLeftRadius: 6,
    maxWidth: "100%",
    flex: 1,
  },
  streamCursor: {
    marginTop: 4,
  },
  cursorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.6,
  },
  speakerBtn: {
    marginTop: 6,
    padding: 4,
    alignSelf: "flex-start",
  },
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderTopWidth: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    paddingVertical: 8,
    lineHeight: 20,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 1,
  },
  inputDisclaimer: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuCard: {
    width: 280,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuDivider: { height: 0.5 },
  walletCard: {
    width: "85%",
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    gap: 16,
  },
  walletHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  walletTitle: { fontSize: 17, fontWeight: "700" },
  addressBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  chainBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  walletInputField: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: "monospace",
  },
  walletBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
