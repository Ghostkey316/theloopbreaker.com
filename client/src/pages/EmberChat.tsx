import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  Flame,
  Plus,
  Trash2,
  Send,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  User,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Streamdown } from "streamdown";

type ChatMsg = {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string | Date | null;
};

function formatTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function EmberChat() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Responsive check
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // tRPC queries
  const convListQuery = trpc.ember.listConversations.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const messagesQuery = trpc.ember.getMessages.useQuery(
    { conversationId: activeConvId! },
    {
      enabled: !!activeConvId,
      refetchOnWindowFocus: false,
    }
  );

  const createConvMutation = trpc.ember.createConversation.useMutation({
    onSuccess: (data) => {
      setActiveConvId(data.id);
      setLocalMessages([]);
      convListQuery.refetch();
      if (isMobile) setSidebarOpen(false);
    },
  });

  const deleteConvMutation = trpc.ember.deleteConversation.useMutation({
    onSuccess: () => {
      if (activeConvId) {
        setActiveConvId(null);
        setLocalMessages([]);
      }
      convListQuery.refetch();
    },
  });

  const sendMutation = trpc.ember.sendMessage.useMutation();

  // Sync messages from query
  useEffect(() => {
    if (messagesQuery.data) {
      setLocalMessages(
        messagesQuery.data.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          createdAt: m.createdAt,
        }))
      );
    }
  }, [messagesQuery.data]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !activeConvId) return;
    const content = input.trim();
    setInput("");
    setIsLoading(true);

    // Optimistic update
    const userMsg: ChatMsg = {
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);

    try {
      const result = await sendMutation.mutateAsync({
        conversationId: activeConvId,
        content,
      });
      const assistantMsg: ChatMsg = {
        role: "assistant",
        content: result.content,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, assistantMsg]);
      convListQuery.refetch();
    } catch {
      setLocalMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeConvId, sendMutation, convListQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    createConvMutation.mutate();
  };

  const handleDeleteConversation = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConvMutation.mutate({ id });
    if (activeConvId === id) {
      setActiveConvId(null);
      setLocalMessages([]);
    }
  };

  const handleSelectConversation = (id: number) => {
    setActiveConvId(id);
    if (isMobile) setSidebarOpen(false);
  };

  const conversations = convListQuery.data ?? [];
  const displayMessages = localMessages.filter((m) => m.role !== "system");

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "flex flex-col border-r border-white/10 bg-[#0f0f0f] transition-all duration-300 z-50",
          isMobile
            ? "fixed inset-y-0 left-0 w-72"
            : "relative w-72 shrink-0",
          isMobile && !sidebarOpen && "-translate-x-full"
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="font-semibold text-white">Ember</span>
          </div>
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* New conversation button */}
        <div className="p-3">
          <Button
            onClick={handleNewConversation}
            disabled={createConvMutation.isPending}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2"
          >
            {createConvMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            New Conversation
          </Button>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          <div className="px-2 pb-2 space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors group",
                  activeConvId === conv.id
                    ? "bg-orange-500/15 text-orange-400"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1">{conv.title}</span>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </button>
            ))}
            {conversations.length === 0 && !convListQuery.isLoading && (
              <p className="text-center text-gray-600 text-xs py-8 px-4">
                No conversations yet. Start one above.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-white/10 bg-[#0a0a0a] shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Flame className="h-5 w-5 text-orange-500" />
          <h1 className="font-semibold text-white truncate">
            {activeConvId
              ? conversations.find((c) => c.id === activeConvId)?.title ??
                "Ember AI"
              : "Ember AI"}
          </h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!activeConvId ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                  <Flame className="h-8 w-8 text-orange-500" />
                </div>
                <h2 className="text-xl font-semibold text-white">
                  Welcome to Ember
                </h2>
                <p className="text-gray-500 text-center max-w-md text-sm">
                  Your AI guide to the Vaultfire Protocol ecosystem. Start a new
                  conversation to ask about trust verification, cross-chain
                  bridges, governance, and more.
                </p>
              </div>
              <Button
                onClick={handleNewConversation}
                disabled={createConvMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
              >
                <Plus className="h-4 w-4" />
                Start a Conversation
              </Button>
            </div>
          ) : displayMessages.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
              <Sparkles className="h-10 w-10 text-orange-500/40" />
              <p className="text-gray-500 text-sm">
                Ask Ember anything about Vaultfire Protocol
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {[
                  "What is ERC-8004?",
                  "How does trust verification work?",
                  "Explain the cross-chain bridge",
                  "What are AI Partnership Bonds?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInput(prompt);
                      setTimeout(() => {
                        textareaRef.current?.focus();
                      }, 50);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-orange-400 hover:border-orange-500/30 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {displayMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0 mt-1">
                      <Flame className="h-4 w-4 text-orange-500" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl px-4 py-3",
                      msg.role === "user"
                        ? "bg-orange-600 text-white"
                        : "bg-white/5 text-gray-200"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:text-orange-400 prose-code:text-orange-300 prose-strong:text-white">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                    <p
                      className={cn(
                        "text-[10px] mt-1.5",
                        msg.role === "user"
                          ? "text-orange-200/60"
                          : "text-gray-600"
                      )}
                    >
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-1">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0">
                    <Flame className="h-4 w-4 text-orange-500" />
                  </div>
                  <div className="bg-white/5 rounded-xl px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        {activeConvId && (
          <div className="border-t border-white/10 bg-[#0a0a0a] p-4">
            <div className="max-w-3xl mx-auto flex gap-3 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Ember..."
                className="flex-1 min-h-[42px] max-h-[160px] resize-none bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-orange-500/50"
                rows={1}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-[42px] w-[42px] bg-orange-600 hover:bg-orange-700 text-white shrink-0 disabled:opacity-30"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
