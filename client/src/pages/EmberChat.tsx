import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Home,
  ArrowLeft,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
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

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return "Today";
  if (diff < 172800000) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function EmberChat() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [, setLocation] = useLocation();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const convListQuery = trpc.ember.listConversations.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const messagesQuery = trpc.ember.getMessages.useQuery(
    { conversationId: activeConvId! },
    { enabled: !!activeConvId, refetchOnWindowFocus: false }
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
    onSuccess: (_data, variables) => {
      if (activeConvId === variables.id) {
        setActiveConvId(null);
        setLocalMessages([]);
      }
      convListQuery.refetch();
    },
  });

  const sendMutation = trpc.ember.sendMessage.useMutation();

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, isLoading]);

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

    const userMsg: ChatMsg = { role: "user", content, createdAt: new Date().toISOString() };
    setLocalMessages((prev) => [...prev, userMsg]);

    try {
      const result = await sendMutation.mutateAsync({ conversationId: activeConvId, content });
      setLocalMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.content, createdAt: new Date().toISOString() },
      ]);
      convListQuery.refetch();
    } catch {
      setLocalMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again.", createdAt: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeConvId, sendMutation, convListQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const conversations = convListQuery.data ?? [];
  const displayMessages = localMessages.filter((m) => m.role !== "system");

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "flex flex-col bg-[#0e0e0e] transition-transform duration-300 ease-in-out z-50",
          isMobile ? "fixed inset-y-0 left-0 w-[280px] shadow-2xl shadow-black/50" : "relative w-[280px] shrink-0 border-r border-white/5",
          isMobile && !sidebarOpen && "-translate-x-full"
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/5">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
              <Flame className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-white text-sm">Ember</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLocation("/")}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
              title="Back to Home"
            >
              <Home className="h-4 w-4" />
            </button>
            {isMobile && (
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* New conversation */}
        <div className="p-3">
          <Button
            onClick={() => createConvMutation.mutate()}
            disabled={createConvMutation.isPending}
            className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/15 gap-2 transition-all"
            variant="outline"
          >
            {createConvMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New conversation
          </Button>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1 px-2">
          <div className="pb-2 space-y-0.5">
            {conversations.length === 0 && !convListQuery.isLoading && (
              <div className="flex flex-col items-center py-12 gap-2">
                <MessageSquare className="h-8 w-8 text-gray-700" />
                <p className="text-gray-600 text-xs text-center px-4">No conversations yet</p>
              </div>
            )}
            {convListQuery.isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
              </div>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => { setActiveConvId(conv.id); if (isMobile) setSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-all group relative",
                  activeConvId === conv.id
                    ? "bg-white/8 text-white"
                    : "text-gray-400 hover:bg-white/4 hover:text-gray-200"
                )}
              >
                {activeConvId === conv.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-orange-500 rounded-r" />
                )}
                <MessageSquare className="h-4 w-4 shrink-0 opacity-50" />
                <div className="flex-1 min-w-0">
                  <span className="truncate block text-[13px]">{conv.title}</span>
                  <span className="text-[10px] text-gray-600">{formatDate(conv.updatedAt)}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConvMutation.mutate({ id: conv.id }); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/15 hover:text-red-400 transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-orange-500/15 flex items-center justify-center">
              <span className="text-xs text-orange-400 font-medium">{(user.name || "U")[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 truncate">{user.name || "User"}</p>
              <p className="text-[10px] text-gray-600">Free Plan</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl shrink-0">
          {(!sidebarOpen || isMobile) && (
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all">
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
              <Flame className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-white text-sm truncate">
                {activeConvId ? conversations.find((c) => c.id === activeConvId)?.title ?? "Ember AI" : "Ember AI"}
              </h1>
              <p className="text-[10px] text-gray-600">Vaultfire Protocol Assistant</p>
            </div>
          </div>
          <button onClick={() => setLocation("/")} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all md:hidden">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {!activeConvId ? (
            /* Welcome screen */
            <div className="flex flex-col items-center justify-center h-full gap-8 px-6">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500/20 to-orange-700/10 flex items-center justify-center border border-orange-500/10">
                  <Flame className="h-10 w-10 text-orange-500" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Welcome to Ember</h2>
                  <p className="text-gray-500 max-w-md text-sm leading-relaxed">
                    Your AI guide to the Vaultfire Protocol ecosystem. Ask about trust verification,
                    cross-chain bridges, governance, and more.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => createConvMutation.mutate()}
                disabled={createConvMutation.isPending}
                className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-lg shadow-orange-500/20 gap-2 px-6 py-5 rounded-xl"
              >
                {createConvMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Start a Conversation
              </Button>

              <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                {[
                  { q: "What is ERC-8004?", icon: "🔐" },
                  { q: "How does the bridge work?", icon: "🌉" },
                  { q: "Explain AI Partnership Bonds", icon: "🤖" },
                  { q: "What is trust verification?", icon: "✅" },
                ].map((item) => (
                  <button
                    key={item.q}
                    onClick={async () => {
                      const result = await createConvMutation.mutateAsync();
                      if (result?.id) {
                        setActiveConvId(result.id);
                        setInput(item.q);
                        setTimeout(() => textareaRef.current?.focus(), 100);
                      }
                    }}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-white/5 bg-white/2 text-left text-xs text-gray-400 hover:text-white hover:border-orange-500/20 hover:bg-orange-500/5 transition-all"
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.q}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : displayMessages.length === 0 && !isLoading ? (
            /* Empty conversation */
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
              <Sparkles className="h-12 w-12 text-orange-500/20" />
              <p className="text-gray-500 text-sm">Ask Ember anything about Vaultfire Protocol</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {["What is ERC-8004?", "How does trust verification work?", "Explain the cross-chain bridge", "What are AI Partnership Bonds?"].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => { setInput(prompt); setTimeout(() => textareaRef.current?.focus(), 50); }}
                    className="px-3.5 py-2 rounded-xl border border-white/5 text-xs text-gray-400 hover:text-orange-400 hover:border-orange-500/20 hover:bg-orange-500/5 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-1">
              {displayMessages.map((msg, i) => (
                <div key={i} className={cn("py-3", msg.role === "user" ? "" : "")}>
                  <div className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-700/10 flex items-center justify-center shrink-0 mt-0.5 border border-orange-500/10">
                        <Flame className="h-4 w-4 text-orange-500" />
                      </div>
                    )}
                    <div className={cn("max-w-[85%] md:max-w-[75%]", msg.role === "user" ? "" : "")}>
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3",
                          msg.role === "user"
                            ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/10"
                            : "bg-white/[0.03] text-gray-200 border border-white/5"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-headings:text-orange-400 prose-headings:font-semibold prose-code:text-orange-300 prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-strong:text-white prose-a:text-orange-400 prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/5">
                            <Streamdown>{msg.content}</Streamdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        )}
                      </div>
                      <p className={cn("text-[10px] mt-1.5 px-1", msg.role === "user" ? "text-right text-gray-600" : "text-gray-600")}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0 mt-0.5 border border-white/5">
                        <User className="h-4 w-4 text-gray-500" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="py-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-700/10 flex items-center justify-center shrink-0 border border-orange-500/10">
                      <Flame className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {activeConvId && (
          <div className="border-t border-white/5 bg-[#0a0a0a] p-3 md:p-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-2 items-end bg-white/[0.03] border border-white/8 rounded-2xl p-2 focus-within:border-orange-500/30 transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Ember..."
                  className="flex-1 min-h-[40px] max-h-[160px] resize-none bg-transparent text-white text-sm placeholder:text-gray-600 focus:outline-none px-3 py-2.5"
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-xl shrink-0 transition-all",
                    input.trim() && !isLoading
                      ? "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                      : "bg-white/5 text-gray-600"
                  )}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-gray-700 text-center mt-2">
                Ember can make mistakes. Verify important information independently.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
