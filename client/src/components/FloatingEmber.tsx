import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Flame, X, Send, Loader2, Sparkles, User, Maximize2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Streamdown } from "streamdown";

type QuickMsg = { role: "user" | "assistant"; content: string };

export default function FloatingEmber() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<QuickMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const quickSend = trpc.ember.quickSend.useMutation();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);
  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 100) + "px"; }, [input]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const content = input.trim();
    setInput("");
    setIsLoading(true);
    const userMsg: QuickMsg = { role: "user", content };
    setMessages(prev => [...prev, userMsg]);
    try {
      const allMsgs = [...messages, userMsg].map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content }));
      const result = await quickSend.mutateAsync({ messages: allMsgs });
      setMessages(prev => [...prev, { role: "assistant", content: result.content }]);
    } catch { setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]); }
    finally { setIsLoading(false); }
  }, [input, isLoading, messages, quickSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  return (
    <>
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/25 flex items-center justify-center transition-all hover:scale-105">
          <Flame className="h-6 w-6" />
        </button>
      )}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-4rem)] rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 h-12 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" /><span className="text-sm font-semibold text-white">Ember</span></div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-white" onClick={() => { setIsOpen(false); setLocation("/ember"); }}><Maximize2 className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-white" onClick={() => setIsOpen(false)}><X className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Sparkles className="h-8 w-8 text-orange-500/30" />
                  <p className="text-gray-600 text-xs text-center">Quick chat with Ember. <button onClick={() => { setIsOpen(false); setLocation("/ember"); }} className="text-orange-500 hover:underline">Open full page</button> for saved conversations.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && <div className="w-6 h-6 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0 mt-0.5"><Flame className="h-3 w-3 text-orange-500" /></div>}
                  <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-xs", msg.role === "user" ? "bg-orange-600 text-white" : "bg-white/5 text-gray-300")}>
                    {msg.role === "assistant" ? <div className="prose prose-xs prose-invert max-w-none"><Streamdown>{msg.content}</Streamdown></div> : <p className="whitespace-pre-wrap">{msg.content}</p>}
                  </div>
                  {msg.role === "user" && <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5"><User className="h-3 w-3 text-gray-400" /></div>}
                </div>
              ))}
              {isLoading && <div className="flex gap-2"><div className="w-6 h-6 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0"><Flame className="h-3 w-3 text-orange-500" /></div><div className="bg-white/5 rounded-lg px-3 py-2"><Loader2 className="h-3 w-3 animate-spin text-orange-500" /></div></div>}
              <div ref={endRef} />
            </div>
          </ScrollArea>
          <div className="border-t border-white/10 p-2 flex gap-2 items-end">
            <Textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask Ember..." className="flex-1 min-h-[34px] max-h-[100px] resize-none text-xs bg-white/5 border-white/10 text-white placeholder:text-gray-600" rows={1} />
            <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="icon" className="h-[34px] w-[34px] bg-orange-600 hover:bg-orange-700 text-white shrink-0 disabled:opacity-30"><Send className="h-3 w-3" /></Button>
          </div>
        </div>
      )}
    </>
  );
}
