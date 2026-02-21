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
import { useEmbrisPermission } from "@/lib/ember-permissions";
import { memoryService, extractMemoriesLocally } from "@/lib/memory-service";
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
  const { permission } = useEmbrisPermission();
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
      Alert.alert("Connected", "Wallet connected. Embris can now reference your on-chain data.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to connect wallet");
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      await disconnectWallet();
      Alert.alert("Disconnected", "Wallet disconnected");
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
      const memoryContext = await memoryService.buildMemoryContext();

      const apiMessages = [
        ...(memoryContext ? [{ role: "system" as const, content: memoryContext }] : []),
        ...updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      const lowerInput = userMessage.content.toLowerCase();
      const isOnChainQuery = /check|look ?up|scan|trust|security|balance|portfolio|contract|address|0x/i.test(lowerInput);
      const isTransactionRequest = /register|bond|feedback|revoke|send|transfer/i.test(lowerInput);

      if (isOnChainQuery) {
        setToolStatus("Checking the chain...");
      } else if (isTransactionRequest) {
        setToolStatus("Preparing transaction...");
      } else {
        setToolStatus("Thinking...");
      }

      const statusMessages = isOnChainQuery
        ? [
            "Checking the chain...",
            "Reading on-chain data...",
            "Analyzing contract state...",
            "Verifying trust profile...",
          ]
        : isTransactionRequest
        ? [
            "Preparing transaction...",
            "Building transaction data...",
            "Preparing preview...",
          ]
        : ["Thinking..."];

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

      if (result.pendingTransaction) {
        setPendingTransaction(result.pendingTransaction);
        setShowTransactionModal(true);
      }

      if (result.toolsUsed) {
        setToolStatus("Data retrieved");
        await new Promise((r) => setTimeout(r, 800));
      }

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: responseText,
        timestamp: Date.now(),
      };

      const extracted = extractMemoriesLocally(userMessage.content, responseText);
      for (const mem of extracted) {
        await memoryService.addMemory(mem.category, mem.key, mem.value, "conversation");
      }
      await memoryService.recordMessage();
      if (extracted.length > 0) {
        await memoryService.recordConversation();
      }

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
        ? "I'm having trouble connecting right now. Please make sure the API key is configured."
        : "Sorry, I ran into an issue. Could you try rephrasing that?";
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
        <View style={s.aiRow}>
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <MaterialIcons name="local-fire-department" size={14} color="#F97316" />
            </View>
          </View>
          <View style={s.aiContent}>
            <TypingDots />
          </View>
        </View>
      );
    }

    if (isToolStatus) {
      return (
        <View style={s.aiRow}>
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <MaterialIcons name="local-fire-department" size={14} color="#F97316" />
            </View>
          </View>
          <View style={s.toolRow}>
            <ActivityIndicator color="#A1A1AA" size="small" />
            <Text style={s.toolText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    if (isUser) {
      return (
        <View style={s.userRow}>
          <View style={s.userBubble}>
            <Text style={s.userText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={s.aiRow}>
        <View style={s.avatarWrap}>
          <View style={s.avatar}>
            <MaterialIcons name="local-fire-department" size={14} color="#F97316" />
          </View>
        </View>
        <View style={s.aiContent}>
          <Text style={s.aiText}>
            {item.content}
            {isStreamingMsg && <Text style={s.cursor}>|</Text>}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <MaterialIcons name="local-fire-department" size={40} color="#F97316" />
      </View>
      <Text style={s.emptyTitle}>Embris</Text>
      <Text style={s.emptySubtitle}>Powered by Vaultfire Protocol</Text>
      <Text style={s.emptyHint}>
        Ask about Vaultfire, web3, AI ethics, or anything on your mind. I can also look up on-chain data and trust profiles.
      </Text>
      {connectedAddress && (
        <View style={s.connectedPill}>
          <MaterialIcons name="check-circle" size={12} color="#22C55E" />
          <Text style={s.connectedPillText}>{shortenAddress(connectedAddress)}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={openSidebar}
          style={({ pressed }) => [s.headerBtn, pressed && { opacity: 0.5 }]}
        >
          <MaterialIcons name="menu" size={22} color="#A1A1AA" />
        </Pressable>
        <View style={s.headerCenter}>
          <MaterialIcons name="local-fire-department" size={18} color="#F97316" />
          <Text style={s.headerTitle}>Embris</Text>
        </View>
        <View style={s.headerRight}>
          {connectedAddress && (
            <View style={s.walletChip}>
              <Text style={s.walletChipText}>{shortenAddress(connectedAddress)}</Text>
            </View>
          )}
          <Pressable
            onPress={() => setShowWalletModal(true)}
            style={({ pressed }) => [s.headerBtn, pressed && { opacity: 0.5 }]}
          >
            <MaterialIcons
              name={connectedAddress ? "account-balance-wallet" : "link"}
              size={20}
              color={connectedAddress ? "#F97316" : "#52525B"}
            />
          </Pressable>
          <Pressable
            onPress={handleNewChat}
            style={({ pressed }) => [s.headerBtn, pressed && { opacity: 0.5 }]}
          >
            <MaterialIcons name="edit" size={20} color="#52525B" />
          </Pressable>
        </View>
      </View>

      {/* Chat Area */}
      <KeyboardAvoidingView
        style={s.chatArea}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            s.messageList,
            displayMessages.length === 0 && s.messageListEmpty,
          ]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
        />

        {/* Input Bar */}
        <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
          <View style={s.inputWrap}>
            <TextInput
              style={s.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message Embris..."
              placeholderTextColor="#52525B"
              multiline
              maxLength={4000}
              returnKeyType="default"
            />
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
              style={({ pressed }) => [
                s.sendBtn,
                inputText.trim() && !isLoading ? s.sendBtnActive : s.sendBtnDisabled,
                pressed && inputText.trim() && { opacity: 0.8 },
              ]}
            >
              <MaterialIcons
                name="arrow-upward"
                size={18}
                color={inputText.trim() && !isLoading ? "#09090B" : "#52525B"}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <Animated.View style={[s.overlay, { opacity: overlayAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSidebar} />
        </Animated.View>
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <Animated.View
          style={[
            s.sidebar,
            {
              width: SIDEBAR_WIDTH,
              transform: [{ translateX: sidebarAnim }],
              paddingTop: insets.top + 8,
            },
          ]}
        >
          <Pressable
            onPress={handleNewChat}
            style={({ pressed }) => [s.newChatBtn, pressed && { opacity: 0.8 }]}
          >
            <MaterialIcons name="add" size={18} color="#09090B" />
            <Text style={s.newChatText}>New Chat</Text>
          </Pressable>

          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelectConversation(item)}
                style={({ pressed }) => [
                  s.convoItem,
                  activeConversation?.id === item.id && s.convoItemActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={s.convoContent}>
                  <Text style={s.convoTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={s.convoMeta} numberOfLines={1}>
                    {item.messages.length > 0
                      ? `${item.messages.length} messages`
                      : "No messages yet"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleDeleteConversation(item.id)}
                  style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.4 }]}
                >
                  <MaterialIcons name="delete-outline" size={16} color="#52525B" />
                </Pressable>
              </Pressable>
            )}
            contentContainerStyle={s.convoList}
            showsVerticalScrollIndicator={false}
          />

          <View style={s.sidebarFooter}>
            <View style={s.sidebarBrand}>
              <MaterialIcons name="shield" size={16} color="#52525B" />
              <Text style={s.sidebarBrandText}>Vaultfire Protocol</Text>
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
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Connect Wallet</Text>
              <Pressable
                onPress={() => setShowWalletModal(false)}
                style={({ pressed }) => [pressed && { opacity: 0.5 }]}
              >
                <MaterialIcons name="close" size={22} color="#52525B" />
              </Pressable>
            </View>

            {connectedAddress ? (
              <View style={s.modalConnected}>
                <MaterialIcons name="check-circle" size={28} color="#22C55E" />
                <Text style={s.modalConnectedTitle}>Connected</Text>
                <Text style={s.modalConnectedAddr}>{shortenAddress(connectedAddress)}</Text>
                <Text style={s.modalConnectedHint}>
                  Embris can reference your on-chain data. Read-only — no transactions or approvals.
                </Text>
                <Pressable
                  onPress={handleDisconnectWallet}
                  style={({ pressed }) => [s.disconnectBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={s.disconnectBtnText}>Disconnect</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.modalForm}>
                <Text style={s.modalLabel}>ETHEREUM ADDRESS</Text>
                <TextInput
                  style={s.modalInput}
                  placeholder="0x..."
                  placeholderTextColor="#52525B"
                  value={walletInput}
                  onChangeText={setWalletInput}
                  autoCapitalize="none"
                />
                <Text style={s.modalHint}>
                  Read-only connection. We never request approvals or initiate transactions.
                </Text>
                <Pressable
                  onPress={handleConnectWallet}
                  disabled={isConnecting || !walletInput.trim()}
                  style={({ pressed }) => [
                    s.connectBtn,
                    (!walletInput.trim() || isConnecting) && s.connectBtnDisabled,
                    pressed && walletInput.trim() && { opacity: 0.8 },
                  ]}
                >
                  {isConnecting ? (
                    <ActivityIndicator color="#09090B" size="small" />
                  ) : (
                    <Text style={s.connectBtnText}>Connect</Text>
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
        <View style={s.txOverlay}>
          <View style={s.txContent}>
            <View style={s.txHeader}>
              <Text style={s.txTitle}>Transaction Preview</Text>
              <Pressable
                onPress={() => setShowTransactionModal(false)}
                style={({ pressed }) => [pressed && { opacity: 0.5 }]}
              >
                <MaterialIcons name="close" size={22} color="#52525B" />
              </Pressable>
            </View>

            {pendingTransaction && (
              <ScrollView style={s.txBody} showsVerticalScrollIndicator={false}>
                <View style={s.txCard}>
                  <Text style={s.txLabel}>CONTRACT</Text>
                  <Text style={s.txValue}>{pendingTransaction.preview?.contractName}</Text>

                  <Text style={[s.txLabel, { marginTop: 16 }]}>FUNCTION</Text>
                  <Text style={s.txValue}>{pendingTransaction.preview?.functionName}</Text>

                  <Text style={[s.txLabel, { marginTop: 16 }]}>PARAMETERS</Text>
                  {pendingTransaction.preview?.params?.map((param: any, idx: number) => (
                    <View key={idx} style={s.paramRow}>
                      <Text style={s.paramName}>{param.name}</Text>
                      <Text style={s.paramValue} numberOfLines={2}>{param.value}</Text>
                    </View>
                  ))}

                  <Text style={[s.txLabel, { marginTop: 16 }]}>VALUE</Text>
                  <Text style={s.txValue}>{pendingTransaction.preview?.value}</Text>

                  <Text style={[s.txLabel, { marginTop: 16 }]}>ESTIMATED GAS</Text>
                  <Text style={s.txValue}>{pendingTransaction.preview?.estimatedGas} wei</Text>
                </View>

                <Text style={s.txWarning}>
                  Review this transaction carefully before signing. You will be prompted to sign with your wallet.
                </Text>

                <Pressable
                  style={({ pressed }) => [s.txCloseBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    Alert.alert("Preview Only", "In production, you would sign this with your connected wallet.");
                    setShowTransactionModal(false);
                  }}
                >
                  <Text style={s.txCloseBtnText}>Close Preview</Text>
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
    <View style={s.dotsWrap}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={[s.dot, { opacity: dot }]} />
      ))}
    </View>
  );
}

// ─── Professional Design System ───────────────────────────────────
// Background: #09090B | Cards: #111113 | Border: rgba(255,255,255,0.03)
// Text: #FAFAFA primary, #A1A1AA secondary, #52525B tertiary
// Accent: #F97316 (orange) — used sparingly
// No gradients, no glows, no decorative effects. Clean and minimal.

const s = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: "#09090B",
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  headerBtn: {
    padding: 6,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  walletChip: {
    backgroundColor: "#111113",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  walletChipText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#A1A1AA",
    fontFamily: "monospace",
    letterSpacing: 0.5,
  },

  // ── Chat ────────────────────────────────────────────────────────
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

  // ── User Messages ───────────────────────────────────────────────
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 24,
  },
  userBubble: {
    maxWidth: "78%",
    backgroundColor: "#111113",
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  userText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#FAFAFA",
    fontWeight: "400",
  },

  // ── AI Messages (ChatGPT-style: no bubble) ─────────────────────
  aiRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
    gap: 10,
  },
  avatarWrap: {
    marginTop: 2,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#111113",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  aiContent: {
    flex: 1,
    paddingTop: 3,
  },
  aiText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#FAFAFA",
    fontWeight: "400",
  },
  cursor: {
    color: "#F97316",
    fontWeight: "600",
  },

  // ── Tool Status ─────────────────────────────────────────────────
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  toolText: {
    fontSize: 13,
    color: "#A1A1AA",
    fontWeight: "400",
  },

  // ── Typing Dots ─────────────────────────────────────────────────
  dotsWrap: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#A1A1AA",
  },

  // ── Input Bar ───────────────────────────────────────────────────
  inputBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: "#09090B",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.03)",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#111113",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: "#FAFAFA",
    maxHeight: 120,
    paddingVertical: 8,
    lineHeight: 20,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  sendBtnActive: {
    backgroundColor: "#F97316",
  },
  sendBtnDisabled: {
    backgroundColor: "transparent",
  },

  // ── Empty State ─────────────────────────────────────────────────
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
    gap: 8,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#111113",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  emptySubtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: "#52525B",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  emptyHint: {
    fontSize: 14,
    color: "#A1A1AA",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
    fontWeight: "400",
  },
  connectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  connectedPillText: {
    fontSize: 11,
    color: "#A1A1AA",
    fontWeight: "500",
    fontFamily: "monospace",
  },

  // ── Sidebar Overlay ─────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    zIndex: 10,
  },

  // ── Sidebar ─────────────────────────────────────────────────────
  sidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "#09090B",
    zIndex: 20,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 16,
  },
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F97316",
    borderRadius: 10,
    paddingVertical: 11,
    marginBottom: 16,
  },
  newChatText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#09090B",
  },
  convoList: {
    paddingBottom: 16,
  },
  convoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  convoItemActive: {
    backgroundColor: "#111113",
  },
  convoContent: {
    flex: 1,
  },
  convoTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FAFAFA",
  },
  convoMeta: {
    fontSize: 11,
    color: "#52525B",
    marginTop: 2,
  },
  deleteBtn: {
    padding: 4,
  },
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.03)",
    paddingVertical: 12,
  },
  sidebarBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sidebarBrandText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#52525B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // ── Wallet Modal ────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#09090B",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 24,
    maxHeight: "80%",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.03)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#52525B",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#FAFAFA",
    fontSize: 14,
    marginBottom: 12,
  },
  modalHint: {
    fontSize: 12,
    color: "#52525B",
    marginBottom: 20,
    lineHeight: 16,
  },
  connectBtn: {
    backgroundColor: "#F97316",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  connectBtnDisabled: {
    backgroundColor: "#111113",
  },
  connectBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#09090B",
  },
  modalForm: {
    marginBottom: 24,
  },
  modalConnected: {
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  modalConnectedTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  modalConnectedAddr: {
    fontSize: 13,
    fontFamily: "monospace",
    color: "#A1A1AA",
  },
  modalConnectedHint: {
    fontSize: 13,
    color: "#52525B",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
  disconnectBtn: {
    backgroundColor: "#111113",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    marginTop: 8,
  },
  disconnectBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#EF4444",
  },

  // ── Transaction Modal ───────────────────────────────────────────
  txOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  txContent: {
    backgroundColor: "#09090B",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 24,
    maxHeight: "90%",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.03)",
  },
  txHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  txTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  txBody: {
    marginBottom: 24,
  },
  txCard: {
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  txLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#52525B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  txValue: {
    fontSize: 14,
    color: "#FAFAFA",
    marginTop: 4,
    fontWeight: "400",
  },
  paramRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  paramName: {
    fontSize: 12,
    color: "#A1A1AA",
    fontWeight: "500",
    flex: 0.3,
  },
  paramValue: {
    fontSize: 12,
    color: "#FAFAFA",
    fontFamily: "monospace",
    flex: 0.7,
    textAlign: "right",
  },
  txWarning: {
    fontSize: 13,
    color: "#A1A1AA",
    backgroundColor: "#111113",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    lineHeight: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  txCloseBtn: {
    backgroundColor: "#111113",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  txCloseBtnText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FAFAFA",
  },
});
