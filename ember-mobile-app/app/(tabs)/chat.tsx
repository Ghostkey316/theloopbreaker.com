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
} from "@/lib/memory";
import { getWalletAddress, saveWalletAddress, getWalletData, validateAddress } from "@/lib/wallet";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

interface ChatMessageWithStatus extends ChatMessage {
  isTyping?: boolean;
}

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
  const flatListRef = useRef<FlatList>(null);
  const chatMutation = trpc.chat.send.useMutation();

  // Load chat history, memories, and wallet on mount
  useEffect(() => {
    const loadData = async () => {
      const [history, mems, addr] = await Promise.all([
        getChatHistory(),
        getMemories(),
        getWalletAddress(),
      ]);
      if (history.length > 0) {
        setMessages(history);
      }
      setMemoriesState(mems);
      if (addr) {
        setWalletAddress(addr);
      }
    };
    loadData();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const connectWallet = useCallback(async () => {
    const trimmed = walletInput.trim();
    if (!trimmed) return;

    setWalletLoading(true);
    try {
      const isValid = await validateAddress(trimmed);
      if (!isValid) {
        alert("Invalid Ethereum address format");
        setWalletLoading(false);
        return;
      }

      await saveWalletAddress(trimmed);
      setWalletAddress(trimmed);
      setWalletInput("");
      setWalletModalVisible(false);

      // Add system message about wallet connection
      const systemMsg: ChatMessageWithStatus = {
        id: `msg_${Date.now()}_system`,
        role: "assistant",
        content: `Wallet connected: ${trimmed.slice(0, 6)}...${trimmed.slice(-4)}. You can now ask me about your on-chain data!`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, systemMsg]);
      await saveChatHistory([...messages, systemMsg]);
    } catch (error) {
      alert("Failed to connect wallet");
    } finally {
      setWalletLoading(false);
    }
  }, [walletInput, messages]);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    Keyboard.dismiss();

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      content: text,
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
      // Send recent messages for context (last 20)
      const recentMessages = updatedMessages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Include memory context and wallet info
      const memoryStrings = memories.map((m) => m.content);
      if (walletAddress) {
        memoryStrings.push(`User wallet: ${walletAddress}`);
      }

      const result = await chatMutation.mutateAsync({
        messages: recentMessages,
        memories: memoryStrings,
      });

      // Remove typing indicator
      setMessages((prev) => prev.filter((m) => !m.isTyping));

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: "assistant",
        content: result.response,
        timestamp: Date.now(),
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // Extract and save memories
      const newMemories = extractMemories(text, result.response);
      if (newMemories.length > 0) {
        await saveMemories(newMemories);
        setMemoriesState((prev) => [...prev, ...newMemories]);
      }

      // Save chat history
      await saveChatHistory(finalMessages);
    } catch (error) {
      // Remove typing indicator on error
      setMessages((prev) => prev.filter((m) => !m.isTyping));
      console.error("Chat error:", error);

      const errorMsg: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages, memories, walletAddress, chatMutation]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessageWithStatus }) => {
      const isUser = item.role === "user";

      return (
        <Animated.View
          entering={FadeInDown}
          style={{
            marginVertical: 4,
            marginHorizontal: 12,
            flexDirection: isUser ? "row-reverse" : "row",
            justifyContent: isUser ? "flex-end" : "flex-start",
          }}
        >
          <View
            style={[
              styles.messageBubble,
              {
                backgroundColor: isUser ? colors.primary : colors.surface,
                maxWidth: "85%",
                borderColor: colors.border,
              },
            ]}
          >
            {item.isTyping ? (
              <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.muted,
                  }}
                />
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.muted,
                  }}
                />
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.muted,
                  }}
                />
              </View>
            ) : (
              <Text
                style={{
                  color: isUser ? colors.background : colors.foreground,
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                {item.content}
              </Text>
            )}
          </View>
        </Animated.View>
      );
    },
    [colors]
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScreenContainer className="p-0">
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-2xl font-bold text-foreground">Ember AI</Text>
              <Text className="text-xs text-muted mt-1">Vaultfire Protocol Assistant</Text>
            </View>
            <Pressable
              onPress={() => setWalletModalVisible(true)}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 6,
                  backgroundColor: walletAddress ? colors.success : colors.surface,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: walletAddress ? colors.background : colors.foreground,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {walletAddress ? `${walletAddress.slice(0, 6)}...` : "Connect"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingVertical: 12, flexGrow: 1 }}
          scrollEnabled={true}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input Area */}
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask Ember about Vaultfire..."
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            <Pressable
              onPress={sendMessage}
              disabled={isLoading || !inputText.trim()}
              style={({ pressed }) => [
                {
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: isLoading || !inputText.trim() ? colors.muted : colors.primary,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={{ fontSize: 18 }}>➤</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Wallet Connection Modal */}
        <Modal
          visible={walletModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setWalletModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 20,
                width: "85%",
                borderColor: colors.border,
                borderWidth: 1,
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "bold", marginBottom: 12 }}>
                {walletAddress ? "Connected Wallet" : "Connect Wallet"}
              </Text>

              {walletAddress ? (
                <View>
                  <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>Current Address:</Text>
                  <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "monospace", marginBottom: 16 }}>
                    {walletAddress}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setWalletAddress(null);
                      setWalletModalVisible(false);
                    }}
                    style={({ pressed }) => [
                      {
                        paddingVertical: 10,
                        borderRadius: 6,
                        backgroundColor: colors.error,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.background, textAlign: "center", fontWeight: "600" }}>
                      Disconnect
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View>
                  <TextInput
                    value={walletInput}
                    onChangeText={setWalletInput}
                    placeholder="0x..."
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.walletInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.foreground,
                        borderColor: colors.border,
                      },
                    ]}
                    editable={!walletLoading}
                  />
                  <Pressable
                    onPress={connectWallet}
                    disabled={walletLoading || !walletInput.trim()}
                    style={({ pressed }) => [
                      {
                        paddingVertical: 10,
                        borderRadius: 6,
                        backgroundColor: walletLoading || !walletInput.trim() ? colors.muted : colors.primary,
                        marginTop: 12,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    {walletLoading ? (
                      <ActivityIndicator size="small" color={colors.background} />
                    ) : (
                      <Text style={{ color: colors.background, textAlign: "center", fontWeight: "600" }}>
                        Connect
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}

              <Pressable
                onPress={() => setWalletModalVisible(false)}
                style={({ pressed }) => [
                  {
                    paddingVertical: 10,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginTop: 12,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.foreground, textAlign: "center", fontWeight: "600" }}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 100,
    fontSize: 14,
  },
  walletInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 13,
    fontFamily: "monospace",
  },
});
