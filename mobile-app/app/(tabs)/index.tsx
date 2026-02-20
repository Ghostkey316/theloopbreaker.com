import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { trpc } from "@/lib/trpc";
import {
  getConversations,
  saveConversation,
  deleteConversation,
  createNewConversation,
  generateTitle,
} from "@/lib/chat-storage";
import type { Conversation, ChatMessage } from "@/lib/ember";
import { useWallet } from "@/lib/wallet-context";
import { useEmberPermission } from "@/lib/ember-permissions";
import { v4 as uuidv4 } from "uuid";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.8;

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface AgentMessage {
  id: string;
  role: "assistant";
  content: string;
  tool_calls?: ToolCall[];
  timestamp: number;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { connectedAddress, shortenAddress, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const { permission } = useEmberPermission();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletInput, setWalletInput] = useState("");
  const [toolStatus, setToolStatus] = useState<string>("");
  const [pendingTransaction, setPendingTransaction] = useState<any>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const chatMutation = trpc.chat.send.useMutation();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const convos = await getConversations();
    setConversations(convos);
    if (convos.length > 0 && !activeConversation) {
      setActiveConversation(convos[0]);
    }
  };

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(sidebarAnim, {
        toValue: -SIDEBAR_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setSidebarOpen(false));
  };

  const handleNewChat = async () => {
    const newConvo = createNewConversation();
    setActiveConversation(newConvo);
    await saveConversation(newConvo);
    await loadConversations();
    closeSidebar();
  };

  const handleSelectConversation = (convo: Conversation) => {
    setActiveConversation(convo);
    closeSidebar();
  };

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id);
    const convos = await getConversations();
    setConversations(convos);
    if (activeConversation?.id === id) {
      if (convos.length > 0) {
        setActiveConversation(convos[0]);
      } else {
        const newConvo = createNewConversation();
        setActiveConversation(newConvo);
        await saveConversation(newConvo);
        await loadConversations();
      }
    }
  };

  const handleConnectWallet = async () => {
    if (!walletInput.trim()) {
      Alert.alert("Error", "Please enter a wallet address");
      return;
    }

    try {
      await connectWallet(walletInput.trim());
      setWalletInput("");
      setShowWalletModal(false);
      Alert.alert("Success", "Wallet connected! Ember can now reference your on-chain data.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to connect wallet");
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      await disconnectWallet();
      Alert.alert("Success", "Wallet disconnected");
      setShowWalletModal(false);
    } catch (error) {
      Alert.alert("Error", "Failed to disconnect wallet");
    }
  };

  const simulateStreaming = useCallback((fullText: string, onComplete: () => void) => {
    setIsStreaming(true);
    setStreamingText("");
    const words = fullText.split(/(\s+)/);
    let currentIndex = 0;
    let accumulated = "";

    const interval = setInterval(() => {
      if (currentIndex < words.length) {
        const chunk = words.slice(currentIndex, currentIndex + 2).join("");
        accumulated += chunk;
        setStreamingText(accumulated);
        currentIndex += 2;
      } else {
        clearInterval(interval);
        setIsStreaming(false);
        setStreamingText("");
        onComplete();
      }
    }, 30);

    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    let convo = activeConversation;
    if (!convo) {
      convo = createNewConversation();
      setActiveConversation(convo);
    }

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    const updatedMessages = [...convo.messages, userMessage];
    const updatedConvo: Conversation = {
      ...convo,
      messages: updatedMessages,
      title: convo.messages.length === 0 ? generateTitle([userMessage]) : convo.title,
      updatedAt: Date.now(),
    };

    setActiveConversation(updatedConvo);
    setInputText("");
    setIsLoading(true);
    setToolStatus("");
    setPendingTransaction(null);

    await saveConversation(updatedConvo);

    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Detect intent from user message to show contextual status
      const lowerInput = userMessage.content.toLowerCase();
      const isOnChainQuery = /check|look ?up|scan|trust|security|balance|portfolio|contract|address|0x/i.test(lowerInput);
      const isTransactionRequest = /register|bond|feedback|revoke|send|transfer/i.test(lowerInput);

      if (isOnChainQuery) {
        setToolStatus("🔗 Ember is checking the chain...");
      } else if (isTransactionRequest) {
        setToolStatus("⚡ Ember is preparing a transaction...");
      } else {
        setToolStatus("Ember is thinking...");
      }

      // Start a status rotation for long-running tool calls
      const statusMessages = isOnChainQuery
        ? [
            "🔗 Ember is checking the chain...",
            "📡 Reading on-chain data...",
            "🔍 Analyzing contract state...",
            "🛡️ Verifying trust profile...",
          ]
        : isTransactionRequest
        ? [
            "⚡ Ember is preparing a transaction...",
            "📋 Building transaction data...",
            "🔐 Preparing preview for your review...",
          ]
        : ["Ember is thinking..."];

      let statusIdx = 0;
      const statusInterval = setInterval(() => {
        statusIdx = (statusIdx + 1) % statusMessages.length;
        setToolStatus(statusMessages[statusIdx]);
      }, 2500);

      const result = await chatMutation.mutateAsync({
        messages: apiMessages,
        walletAddress: connectedAddress || undefined,
        permissionLevel: permission,
      });

      clearInterval(statusInterval);

      const responseText = result.content;

      // Handle pending transaction from tool calls
      if (result.pendingTransaction) {
        setPendingTransaction(result.pendingTransaction);
        setShowTransactionModal(true);
      }

      // Show a brief "tools used" indicator before streaming
      if (result.toolsUsed) {
        setToolStatus("✅ On-chain data retrieved");
        await new Promise((r) => setTimeout(r, 800));
      }

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: responseText,
        timestamp: Date.now(),
      };

      setIsLoading(false);
      setToolStatus("");

      simulateStreaming(responseText, () => {
        const finalConvo: Conversation = {
          ...updatedConvo,
          messages: [...updatedMessages, assistantMessage],
          updatedAt: Date.now(),
        };
        setActiveConversation(finalConvo);
        saveConversation(finalConvo);
        loadConversations();
      });
    } catch (error) {
      setIsLoading(false);
      setToolStatus("");
      console.error("Chat error:", error);
      const errorContent = error instanceof Error && error.message.includes("OPENAI_API_KEY")
        ? "I'm having trouble connecting to my AI backend. Please make sure the API key is configured."
        : "Sorry, I ran into an issue processing that. Let me try again — could you rephrase your question?";
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: errorContent,
        timestamp: Date.now(),
      };
      const errorConvo: Conversation = {
        ...updatedConvo,
        messages: [...updatedMessages, errorMessage],
        updatedAt: Date.now(),
      };
      setActiveConversation(errorConvo);
      await saveConversation(errorConvo);
      await loadConversations();
    }
  };

  const scrollToEnd = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    scrollToEnd();
  }, [activeConversation?.messages, streamingText, isLoading, toolStatus]);

  const messages = activeConversation?.messages || [];
  const displayMessages: (ChatMessage | { id: string; role: "streaming" | "loading" | "tool_status"; content: string; timestamp: number })[] = [
    ...messages,
    ...(toolStatus ? [{ id: "tool_status", role: "tool_status" as const, content: toolStatus, timestamp: Date.now() }] : []),
    ...(isStreaming
      ? [{ id: "streaming", role: "streaming" as const, content: streamingText, timestamp: Date.now() }]
      : []),
    ...(isLoading && !isStreaming && !toolStatus
      ? [{ id: "loading", role: "loading" as const, content: "", timestamp: Date.now() }]
      : []),
  ];

  const renderMessage = ({ item }: { item: typeof displayMessages[0] }) => {
    const isUser = item.role === "user";
    const isLoadingMsg = item.role === "loading";
    const isStreamingMsg = item.role === "streaming";
    const isToolStatus = item.role === "tool_status";

    if (isLoadingMsg) {
      return (
        <View style={styles.aiMessageRow}>
          <View style={styles.avatarContainer}>
            <View style={styles.emberAvatar}>
              <MaterialIcons name="local-fire-department" size={16} color="#F97316" />
            </View>
          </View>
          <View style={styles.aiBubble}>
            <View style={styles.typingDots}>
              <TypingDots />
            </View>
          </View>
        </View>
      );
    }

    if (isToolStatus) {
      return (
        <View style={styles.aiMessageRow}>
          <View style={styles.avatarContainer}>
            <View style={styles.emberAvatar}>
              <MaterialIcons name="local-fire-department" size={16} color="#F97316" />
            </View>
          </View>
          <View style={[styles.aiBubble, styles.toolStatusBubble]}>
            <View style={styles.toolStatusContent}>
              <ActivityIndicator color="#F97316" size="small" />
              <Text style={styles.toolStatusText}>{item.content}</Text>
            </View>
          </View>
        </View>
      );
    }

    if (isUser) {
      return (
        <View style={styles.userMessageRow}>
          <View style={styles.userBubble}>
            <Text style={styles.messageText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.aiMessageRow}>
        <View style={styles.avatarContainer}>
          <View style={styles.emberAvatar}>
            <MaterialIcons name="local-fire-department" size={16} color="#F97316" />
          </View>
        </View>
        <View style={styles.aiBubble}>
          <Text style={styles.messageText}>
            {isStreamingMsg ? item.content : item.content}
            {isStreamingMsg && <Text style={styles.cursor}>|</Text>}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyLogo}>
        <MaterialIcons name="local-fire-department" size={48} color="#F97316" />
      </View>
      <Text style={styles.emptyTitle}>Ember</Text>
      <Text style={styles.emptySubtitle}>The flame inside the Vaultfire shield</Text>
      <Text style={styles.emptyHint}>Ask me about Vaultfire Protocol, web3, AI ethics, crypto, or anything else. I can also help you interact with the protocol and manage your wallet.</Text>
      {connectedAddress && (
        <View style={styles.connectedBadge}>
          <MaterialIcons name="check-circle" size={14} color="#22C55E" />
          <Text style={styles.connectedText}>Connected: {shortenAddress(connectedAddress)}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={openSidebar}
          style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.6 }]}
        >
          <MaterialIcons name="menu" size={24} color="#9CA3AF" />
        </Pressable>
        <View style={styles.headerCenter}>
          <MaterialIcons name="local-fire-department" size={20} color="#F97316" />
          <Text style={styles.headerTitle}>Ember</Text>
        </View>
        <View style={styles.headerRight}>
          {connectedAddress && (
            <View style={styles.walletBadge}>
              <MaterialIcons name="account-balance-wallet" size={14} color="#F97316" />
              <Text style={styles.walletBadgeText}>{shortenAddress(connectedAddress)}</Text>
            </View>
          )}
          <Pressable
            onPress={() => setShowWalletModal(true)}
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.6 }]}
          >
            <MaterialIcons
              name={connectedAddress ? "account-balance-wallet" : "link"}
              size={22}
              color={connectedAddress ? "#F97316" : "#9CA3AF"}
            />
          </Pressable>
          <Pressable
            onPress={handleNewChat}
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.6 }]}
          >
            <MaterialIcons name="edit" size={22} color="#9CA3AF" />
          </Pressable>
        </View>
      </View>

      {/* Chat Area */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messageList,
            displayMessages.length === 0 && styles.messageListEmpty,
          ]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
        />

        {/* Input Bar */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask Ember anything..."
              placeholderTextColor="#6B7280"
              multiline
              maxLength={4000}
              returnKeyType="default"
            />
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
              style={({ pressed }) => [
                styles.sendButton,
                inputText.trim() && !isLoading ? styles.sendButtonActive : styles.sendButtonDisabled,
                pressed && inputText.trim() && { opacity: 0.8, transform: [{ scale: 0.95 }] },
              ]}
            >
              <MaterialIcons
                name="arrow-upward"
                size={20}
                color={inputText.trim() && !isLoading ? "#0A0A0F" : "#4B5563"}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <Animated.View
          style={[styles.overlay, { opacity: overlayAnim }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSidebar} />
        </Animated.View>
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <Animated.View
          style={[
            styles.sidebar,
            {
              width: SIDEBAR_WIDTH,
              transform: [{ translateX: sidebarAnim }],
              paddingTop: insets.top + 8,
            },
          ]}
        >
          <Pressable
            onPress={handleNewChat}
            style={({ pressed }) => [styles.newChatButton, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
          >
            <MaterialIcons name="add" size={20} color="#0A0A0F" />
            <Text style={styles.newChatText}>New Chat</Text>
          </Pressable>

          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelectConversation(item)}
                style={({ pressed }) => [
                  styles.convoItem,
                  activeConversation?.id === item.id && styles.convoItemActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={styles.convoContent}>
                  <Text style={styles.convoTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.convoPreview} numberOfLines={1}>
                    {item.messages.length > 0
                      ? `${item.messages.length} messages`
                      : "No messages yet"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleDeleteConversation(item.id)}
                  style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.5 }]}
                >
                  <MaterialIcons name="delete-outline" size={18} color="#6B7280" />
                </Pressable>
              </Pressable>
            )}
            contentContainerStyle={styles.convoList}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.sidebarFooter}>
            <View style={styles.sidebarBrand}>
              <MaterialIcons name="shield" size={20} color="#F97316" />
              <Text style={styles.sidebarBrandText}>Vaultfire Protocol</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Wallet Connection Modal */}
      <Modal
        visible={showWalletModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWalletModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="account-balance-wallet" size={24} color="#F97316" />
              <Text style={styles.modalTitle}>Connect Wallet</Text>
              <Pressable
                onPress={() => setShowWalletModal(false)}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <MaterialIcons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            {connectedAddress ? (
              <View style={styles.modalConnected}>
                <View style={styles.connectedIcon}>
                  <MaterialIcons name="check-circle" size={32} color="#22C55E" />
                </View>
                <Text style={styles.connectedTitle}>Wallet Connected</Text>
                <Text style={styles.connectedAddress}>{shortenAddress(connectedAddress)}</Text>
                <Text style={styles.connectedSubtext}>
                  Ember can now reference your on-chain data in conversations. Your wallet is read-only — no transactions or approvals needed.
                </Text>
                <Pressable
                  onPress={handleDisconnectWallet}
                  style={({ pressed }) => [styles.disconnectButton, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.disconnectButtonText}>Disconnect</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.modalForm}>
                <Text style={styles.modalLabel}>Enter your Ethereum address:</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0x..."
                  placeholderTextColor="#6B7280"
                  value={walletInput}
                  onChangeText={setWalletInput}
                  autoCapitalize="none"
                />
                <Text style={styles.modalHint}>
                  Read-only connection. We never request approvals or initiate transactions.
                </Text>
                <Pressable
                  onPress={handleConnectWallet}
                  disabled={isConnecting || !walletInput.trim()}
                  style={({ pressed }) => [
                    styles.connectButton,
                    (!walletInput.trim() || isConnecting) && styles.connectButtonDisabled,
                    pressed && walletInput.trim() && { opacity: 0.8 },
                  ]}
                >
                  {isConnecting ? (
                    <ActivityIndicator color="#0A0A0F" size="small" />
                  ) : (
                    <Text style={styles.connectButtonText}>Connect</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Transaction Preview Modal */}
      <Modal
        visible={showTransactionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTransactionModal(false)}
      >
        <View style={styles.txModalOverlay}>
          <View style={styles.txModalContent}>
            <View style={styles.txModalHeader}>
              <Text style={styles.txModalTitle}>Transaction Preview</Text>
              <Pressable
                onPress={() => setShowTransactionModal(false)}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <MaterialIcons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            {pendingTransaction && (
              <ScrollView style={styles.txModalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.txPreviewCard}>
                  <Text style={styles.txPreviewLabel}>Contract</Text>
                  <Text style={styles.txPreviewValue}>{pendingTransaction.preview?.contractName}</Text>

                  <Text style={[styles.txPreviewLabel, { marginTop: 12 }]}>Function</Text>
                  <Text style={styles.txPreviewValue}>{pendingTransaction.preview?.functionName}</Text>

                  <Text style={[styles.txPreviewLabel, { marginTop: 12 }]}>Parameters</Text>
                  {pendingTransaction.preview?.params?.map((param: any, idx: number) => (
                    <View key={idx} style={styles.paramRow}>
                      <Text style={styles.paramName}>{param.name}</Text>
                      <Text style={styles.paramValue} numberOfLines={2}>{param.value}</Text>
                    </View>
                  ))}

                  <Text style={[styles.txPreviewLabel, { marginTop: 12 }]}>Value</Text>
                  <Text style={styles.txPreviewValue}>{pendingTransaction.preview?.value}</Text>

                  <Text style={[styles.txPreviewLabel, { marginTop: 12 }]}>Estimated Gas</Text>
                  <Text style={styles.txPreviewValue}>{pendingTransaction.preview?.estimatedGas} wei</Text>
                </View>

                <Text style={styles.txWarning}>
                  ⚠️ Please review this transaction carefully before signing. You will be prompted to sign with your wallet.
                </Text>

                <Pressable
                  style={({ pressed }) => [styles.txApproveButton, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    Alert.alert("Next Steps", "In a real wallet, you would now sign this transaction with your connected wallet. For now, this is a preview.");
                    setShowTransactionModal(false);
                  }}
                >
                  <Text style={styles.txApproveText}>Understood, Close Preview</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  return (
    <View style={styles.dotsContainer}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { opacity: dot }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0F",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1A1A2E",
  },
  headerButton: {
    padding: 4,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  walletBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1A1A2E",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "#F97316",
  },
  walletBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#F97316",
    fontFamily: "monospace",
  },
  chatArea: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageListEmpty: {
    flex: 1,
    justifyContent: "center",
  },
  userMessageRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
  },
  userBubble: {
    maxWidth: "80%",
    backgroundColor: "#1E1E3A",
    borderRadius: 18,
    borderTopRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#F97316",
  },
  aiMessageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 8,
  },
  avatarContainer: {
    marginTop: 2,
  },
  emberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F97316",
  },
  aiBubble: {
    maxWidth: "80%",
    backgroundColor: "#1A1A2E",
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toolStatusBubble: {
    backgroundColor: "#1A2E2E",
    borderLeftWidth: 2,
    borderLeftColor: "#8B5CF6",
  },
  toolStatusContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolStatusText: {
    fontSize: 14,
    color: "#8B5CF6",
    fontWeight: "500",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#FFFFFF",
  },
  cursor: {
    color: "#F97316",
    fontWeight: "700",
  },
  typingDots: {
    paddingVertical: 4,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F97316",
  },
  inputBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#1A1A2E",
    backgroundColor: "#0A0A0F",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#1A1A2E",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#2A2A3E",
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
    maxHeight: 120,
    paddingVertical: 8,
    lineHeight: 20,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  sendButtonActive: {
    backgroundColor: "#F97316",
  },
  sendButtonDisabled: {
    backgroundColor: "#252540",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F97316",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  emptyHint: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#064E3B",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  connectedText: {
    fontSize: 12,
    color: "#22C55E",
    fontWeight: "600",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 10,
  },
  sidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "#0D0D14",
    zIndex: 20,
    borderRightWidth: 1,
    borderRightColor: "#1A1A2E",
    paddingHorizontal: 16,
  },
  newChatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F97316",
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  newChatText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A0A0F",
  },
  convoList: {
    paddingBottom: 16,
  },
  convoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  convoItemActive: {
    backgroundColor: "#1A1A2E",
  },
  convoContent: {
    flex: 1,
  },
  convoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  convoPreview: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
  },
  sidebarFooter: {
    borderTopWidth: 0.5,
    borderTopColor: "#1A1A2E",
    paddingTop: 12,
  },
  sidebarBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sidebarBrandText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0D0D14",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
    marginLeft: 12,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "#1A1A2E",
    borderWidth: 1,
    borderColor: "#2A2A3E",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 15,
    marginBottom: 12,
  },
  modalHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 16,
  },
  connectButton: {
    backgroundColor: "#F97316",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  connectButtonDisabled: {
    backgroundColor: "#2A2A3E",
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A0A0F",
  },
  modalForm: {
    marginBottom: 20,
  },
  modalConnected: {
    alignItems: "center",
    marginBottom: 20,
  },
  connectedIcon: {
    marginBottom: 12,
  },
  connectedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  connectedAddress: {
    fontSize: 14,
    fontFamily: "monospace",
    color: "#F97316",
    marginBottom: 12,
  },
  connectedSubtext: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  disconnectButton: {
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  disconnectButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  txModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  txModalContent: {
    backgroundColor: "#0D0D14",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "90%",
  },
  txModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  txModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
  },
  txModalBody: {
    marginBottom: 20,
  },
  txPreviewCard: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A3E",
  },
  txPreviewLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
  },
  txPreviewValue: {
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 4,
    fontWeight: "500",
  },
  paramRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#2A2A3E",
  },
  paramName: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
    flex: 0.3,
  },
  paramValue: {
    fontSize: 12,
    color: "#F97316",
    fontFamily: "monospace",
    flex: 0.7,
    textAlign: "right",
  },
  txWarning: {
    fontSize: 13,
    color: "#F59E0B",
    backgroundColor: "#1A1A2E",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  txApproveButton: {
    backgroundColor: "#F97316",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  txApproveText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A0A0F",
  },
});
