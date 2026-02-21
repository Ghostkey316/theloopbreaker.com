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
  getWalletAddress,
  saveWalletAddress,
  clearWalletAddress,
  validateAddress,
  getWalletData,
  type WalletData,
} from "@/lib/wallet";
import { streamChat } from "@/lib/stream-chat";
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInRight,
  SlideInLeft,
} from "react-native-reanimated";
import { TypingIndicator } from "@/components/typing-indicator";
import { MarkdownText } from "@/components/markdown-text";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface ChatMessageWithStatus extends ChatMessage {
  isTyping?: boolean;
  isStreaming?: boolean;
}

const SUGGESTED_PROMPTS = [
  "What is ERC-8004?",
  "Show me the Base contracts",
  "Explain the core values",
  "How does the bridge work?",
  "Tell me about AI governance",
  "What contracts are on Avalanche?",
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
  const flatListRef = useRef<FlatList>(null);
  const chatMutation = trpc.chat.send.useMutation();
  const inputRef = useRef<TextInput>(null);
  const streamingRef = useRef<string>("");

  // Load chat history, memories, and wallet on mount
  useEffect(() => {
    const loadData = async () => {
      const [history, mems, addr] = await Promise.all([
        getChatHistory(),
        getMemories(),
        getWalletAddress(),
      ]);
      if (history.length > 0) setMessages(history);
      setMemoriesState(mems);
      if (addr) {
        setWalletAddress(addr);
        // Load wallet data in background
        getWalletData(addr)
          .then(setWalletDataState)
          .catch(() => {});
      }
    };
    loadData();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

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
      // Fetch wallet data
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
            setMenuVisible(false);
          },
        },
      ]
    );
  }, []);

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

      // Add streaming placeholder
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
      if (walletAddress) memoryStrings.push(`User wallet: ${walletAddress}`);

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
            // Finalize the message
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
            await saveChatHistory(finalMessages);
            setIsLoading(false);
          },
          onError: async (error) => {
            console.error("Stream error:", error);
            // Fall back to non-streaming tRPC call
            try {
              const result = await chatMutation.mutateAsync({
                messages: recentMessages,
                memories: memoryStrings,
              });

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamMsgId
                    ? {
                        ...m,
                        content: result.response,
                        isStreaming: false,
                        isTyping: false,
                      }
                    : m
                )
              );

              const newMemories = extractMemories(msgText, result.response);
              if (newMemories.length > 0) {
                await saveMemories(newMemories);
                setMemoriesState((prev) => [...prev, ...newMemories]);
              }

              const finalMessages = [
                ...updatedMessages,
                {
                  id: streamMsgId,
                  role: "assistant" as const,
                  content: result.response,
                  timestamp: Date.now(),
                },
              ];
              await saveChatHistory(finalMessages);
            } catch {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamMsgId
                    ? {
                        ...m,
                        content:
                          "I'm having trouble connecting right now. Please check your connection and try again.",
                        isStreaming: false,
                        isTyping: false,
                      }
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
              ? {
                  ...m,
                  content:
                    "I'm having trouble connecting right now. Please check your connection and try again.",
                  isStreaming: false,
                  isTyping: false,
                }
              : m
          )
        );
        setIsLoading(false);
      }
    },
    [inputText, isLoading, messages, memories, walletAddress, chatMutation]
  );

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
              <Text style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 22 }}>
                {item.content}
              </Text>
            </View>
          </Animated.View>
        );
      }

      // Assistant message (streaming or complete)
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
          </View>
        </Animated.View>
      );
    },
    [colors]
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
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>Ember</Text>
              <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
                {isLoading ? "Thinking..." : "Vaultfire Protocol"}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
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
                Welcome to Ember
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.muted }]}>
                Your AI companion for the Vaultfire Protocol. Ask about contracts, ERC-8004,
                governance, or anything about ethical AI.
              </Text>
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
              placeholder="Message Ember..."
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.foreground }]}
              multiline
              maxLength={4000}
              editable={!isLoading}
              returnKeyType="default"
              blurOnSubmit={false}
            />
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
                  color={hasText ? "#FFFFFF" : colors.muted}
                />
              )}
            </Pressable>
          </View>
          <Text style={[styles.inputDisclaimer, { color: colors.muted }]}>
            Ember can make mistakes. Verify important information.
          </Text>
        </View>

        {/* Menu Modal */}
        <Modal visible={menuVisible} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
            <Animated.View
              entering={FadeIn.duration(150)}
              style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
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

                    {/* Balance display */}
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
                      Enter your Ethereum address to view balances on Base and Avalanche.
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
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text
                          style={{
                            color: walletInput.trim() ? "#FFFFFF" : colors.muted,
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
