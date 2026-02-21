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
import { getWalletAddress, saveWalletAddress, validateAddress } from "@/lib/wallet";
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight, SlideInLeft } from "react-native-reanimated";
import { TypingIndicator } from "@/components/typing-indicator";
import { MarkdownText } from "@/components/markdown-text";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface ChatMessageWithStatus extends ChatMessage {
  isTyping?: boolean;
}

const SUGGESTED_PROMPTS = [
  "What is ERC-8004?",
  "Show me the Base contracts",
  "Explain the Vaultfire Protocol",
  "What are the core values?",
  "How does the bridge work?",
  "Tell me about AI governance",
];

export default function ChatScreen() {
  const colors = useColors();
  const [messages, setMessages] = useState<ChatMessageWithStatus[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [memories, setMemoriesState] = useState<Memory[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [walletInput, setWalletInput] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const chatMutation = trpc.chat.send.useMutation();
  const inputRef = useRef<TextInput>(null);

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
      if (addr) setWalletAddress(addr);
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
      setWalletModalVisible(false);
    } catch {
      Alert.alert("Error", "Failed to connect wallet. Please try again.");
    } finally {
      setWalletLoading(false);
    }
  }, [walletInput]);

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

      // Add typing indicator
      const typingMsg: ChatMessageWithStatus = {
        id: `msg_${Date.now()}_typing`,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isTyping: true,
      };
      setMessages((prev) => [...prev, typingMsg]);

      try {
        const recentMessages = updatedMessages.slice(-20).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const memoryStrings = memories.map((m) => m.content);
        if (walletAddress) memoryStrings.push(`User wallet: ${walletAddress}`);

        const result = await chatMutation.mutateAsync({
          messages: recentMessages,
          memories: memoryStrings,
        });

        // Remove typing indicator
        setMessages((prev) => prev.filter((m) => !m.isTyping));

        const assistantMsg: ChatMessageWithStatus = {
          id: `msg_${Date.now()}_assistant`,
          role: "assistant",
          content: result.response,
          timestamp: Date.now(),
        };

        const finalMessages = [...updatedMessages, assistantMsg];
        setMessages(finalMessages);

        // Extract and save memories
        const newMemories = extractMemories(msgText, result.response);
        if (newMemories.length > 0) {
          await saveMemories(newMemories);
          setMemoriesState((prev) => [...prev, ...newMemories]);
        }
        await saveChatHistory(finalMessages);
      } catch {
        setMessages((prev) => prev.filter((m) => !m.isTyping));
        const errorMsg: ChatMessageWithStatus = {
          id: `msg_${Date.now()}_error`,
          role: "assistant",
          content: "I'm having trouble connecting right now. Please check your connection and try again.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [inputText, isLoading, messages, memories, walletAddress, chatMutation]
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessageWithStatus; index: number }) => {
      const isUser = item.role === "user";

      if (item.isTyping) {
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
            <View
              style={[
                styles.userBubble,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 22 }}>
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
              codeBackground={`${colors.background}`}
              codeBorderColor={colors.border}
              accentColor={colors.primary}
            />
          </View>
        </Animated.View>
      );
    },
    [colors]
  );

  const hasText = inputText.trim().length > 0;
  const showWelcome = messages.length === 0;

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
                  backgroundColor: walletAddress
                    ? `${colors.success}20`
                    : colors.surface,
                  borderColor: walletAddress ? colors.success : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <IconSymbol name="person.fill" size={14} color={walletAddress ? colors.success : colors.muted} />
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
              <Text style={{ color: colors.muted, fontSize: 16, fontWeight: "bold" }}>⋯</Text>
            </Pressable>
          </View>
        </View>

        {/* Welcome Screen or Messages */}
        {showWelcome ? (
          <View style={styles.welcomeContainer}>
            <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.welcomeContent}>
              <View style={[styles.welcomeIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Text style={{ fontSize: 48 }}>🔥</Text>
              </View>
              <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
                Welcome to Ember
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.muted }]}>
                Your AI companion for the Vaultfire Protocol. Ask me anything about contracts, ERC-8004, governance, or the bridge.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.promptsContainer}>
              <Text style={[styles.promptsLabel, { color: colors.muted }]}>Try asking</Text>
              <View style={styles.promptsGrid}>
                {SUGGESTED_PROMPTS.map((prompt, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => sendMessage(prompt)}
                    style={({ pressed }) => [
                      styles.promptChip,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 18 }}>
                      {prompt}
                    </Text>
                    <IconSymbol name="chevron.right" size={12} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() =>
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)
            }
            showsVerticalScrollIndicator={false}
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
              maxLength={1000}
              editable={!isLoading}
              returnKeyType="default"
              onSubmitEditing={() => {
                if (hasText && !isLoading) sendMessage();
              }}
            />
            <Pressable
              onPress={() => sendMessage()}
              disabled={isLoading || !hasText}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: hasText && !isLoading ? colors.primary : "transparent",
                  opacity: pressed && hasText ? 0.8 : 1,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
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
            Ember can make mistakes. Verify contract data on-chain.
          </Text>
        </View>

        {/* Menu Modal */}
        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
            <Animated.View entering={FadeInDown.duration(200)} style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable
                onPress={handleClearChat}
                style={({ pressed }) => [
                  styles.menuItem,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <IconSymbol name="flame.fill" size={18} color={colors.error} />
                <Text style={{ color: colors.error, fontSize: 15, fontWeight: "500" }}>Clear Conversation</Text>
              </Pressable>
              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              <View style={styles.menuItem}>
                <IconSymbol name="person.fill" size={18} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {memories.length} memories stored
                </Text>
              </View>
              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              <Pressable
                onPress={() => setMenuVisible(false)}
                style={({ pressed }) => [
                  styles.menuItem,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "500", textAlign: "center", flex: 1 }}>
                  Cancel
                </Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* Wallet Modal */}
        <Modal visible={walletModalVisible} transparent animationType="fade" onRequestClose={() => setWalletModalVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setWalletModalVisible(false)}>
            <Pressable onPress={() => {}}>
              <Animated.View entering={FadeInDown.duration(250)} style={[styles.walletCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.walletHeader}>
                  <IconSymbol name="person.fill" size={20} color={colors.primary} />
                  <Text style={[styles.walletTitle, { color: colors.foreground }]}>
                    {walletAddress ? "Wallet Connected" : "Connect Wallet"}
                  </Text>
                </View>

                {walletAddress ? (
                  <View style={{ gap: 12 }}>
                    <View style={[styles.addressBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "monospace", lineHeight: 18 }}>
                        {walletAddress}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setWalletAddress(null);
                        setWalletModalVisible(false);
                      }}
                      style={({ pressed }) => [
                        styles.walletBtn,
                        { backgroundColor: `${colors.error}15`, borderColor: colors.error, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Text style={{ color: colors.error, fontWeight: "600", fontSize: 14 }}>Disconnect</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                      Enter your Ethereum address to personalize Ember's responses with your on-chain data.
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
                          backgroundColor: walletInput.trim() ? colors.primary : colors.surface,
                          borderColor: walletInput.trim() ? colors.primary : colors.border,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      {walletLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={{ color: walletInput.trim() ? "#FFFFFF" : colors.muted, fontWeight: "600", fontSize: 14 }}>
                          Connect
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}

                <Pressable
                  onPress={() => setWalletModalVisible(false)}
                  style={({ pressed }) => [{ marginTop: 8, opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={{ color: colors.muted, textAlign: "center", fontSize: 14 }}>Cancel</Text>
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
  // Header
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

  // Welcome
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
  welcomeSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 21, paddingHorizontal: 16 },
  promptsContainer: { gap: 12 },
  promptsLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
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

  // Messages
  messagesList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  userRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 12, paddingLeft: 48 },
  assistantRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, paddingRight: 32, gap: 8 },
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

  // Input
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

  // Modals
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

  // Wallet
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
