'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat } from '../lib/stream-chat';
import { extractMemories, getMemories, getChatHistory, saveChatHistory, saveMemories, clearChatHistory, clearMemories, type ChatMessage, type Memory } from '../lib/memory';
import { getWalletAddress } from '../lib/wallet';

interface ChatMessageWithStatus extends ChatMessage {
  isStreaming?: boolean;
}

const SUGGESTED_PROMPTS = [
  'What is ERC-8004?',
  'Show me the Base contracts',
  'Explain the core values',
  'How does the bridge work?',
  'Tell me about AI governance',
  'What contracts are on Avalanche?',
];

// SVG Icons
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

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ color: '#F97316', fontWeight: 600, margin: '0.75rem 0 0.25rem', fontSize: '0.95em' }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ color: '#F97316', fontWeight: 600, margin: '0.75rem 0 0.25rem', fontSize: '1.05em' }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ color: '#F97316', fontWeight: 700, margin: '0.75rem 0 0.25rem', fontSize: '1.15em' }}>{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} style={{ marginLeft: '1.25rem', margin: '0.2rem 0' }}>{renderInline(line.slice(2))}</li>);
    } else if (line.match(/^\d+\. /)) {
      elements.push(<li key={i} style={{ marginLeft: '1.25rem', margin: '0.2rem 0', listStyleType: 'decimal' }}>{renderInline(line.replace(/^\d+\. /, ''))}</li>);
    } else if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} style={{ borderLeft: '2px solid #F97316', paddingLeft: '0.75rem', color: '#A0A0A8', fontStyle: 'italic', margin: '0.5rem 0' }}>{line.slice(2)}</blockquote>);
    } else if (line === '---' || line === '***') {
      elements.push(<hr key={i} style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '1rem 0' }} />);
    } else if (line === '') {
      elements.push(<br key={i} />);
    } else {
      elements.push(<p key={i} style={{ margin: '0.3rem 0', lineHeight: 1.65 }}>{renderInline(line)}</p>);
    }
    i++;
  }
  return <div className="prose-ember">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 5, padding: '0.1rem 0.35rem', fontSize: '0.85em', color: '#FB923C', fontFamily: "'SF Mono', monospace" }}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#FFFFFF', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ color: '#A0A0A8' }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 0' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="typing-dot" style={{
          width: 6, height: 6, borderRadius: '50%', backgroundColor: '#F97316',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

// Ember avatar SVG
function EmberAvatar({ size = 30 }: { size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))',
      border: '1px solid rgba(249,115,22,0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path d="M12 5c-2 2.5-4 5.5-4 8 0 2.21 1.79 4 4 4s4-1.79 4-4c0-2.5-2-5.5-4-8z" fill="#F97316" opacity="0.8" />
        <path d="M12 8c-1 1.5-2 3.2-2 4.5 0 1.1.9 2 2 2s2-.9 2-2c0-1.3-1-3-2-4.5z" fill="#FB923C" />
      </svg>
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

  useEffect(() => {
    const history = getChatHistory();
    const mems = getMemories();
    const addr = getWalletAddress();
    setMessages(history);
    setMemoriesState(mems);
    setWalletAddress(addr);
    if (history.length > 0) setShowSuggestions(false);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    setShowSuggestions(false);

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
    const llmMessages = [
      ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text.trim() },
    ];

    await streamChat({
      messages: llmMessages,
      memories: memories.slice(-10).map((m) => m.content),
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

        const newMems = extractMemories(text, fullText);
        if (newMems.length > 0) {
          const allMems = [...memories, ...newMems].slice(-50);
          saveMemories(allMems);
          setMemoriesState(allMems);
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
  }, [isLoading, memories]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const handleClear = () => {
    clearChatHistory();
    clearMemories();
    setMessages([]);
    setMemoriesState([]);
    setShowSuggestions(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0A0A0C' }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '10px 14px' : '12px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0E0E11',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, minWidth: 0 }}>
          <EmberAvatar size={isMobile ? 30 : 34} />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.02em' }}>Ember AI</h2>
            {!isMobile && <p style={{ fontSize: 11, color: '#666670' }}>Vaultfire Protocol companion</p>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, flexShrink: 0 }}>
          {walletAddress && !isMobile && (
            <span style={{
              fontSize: 10,
              color: '#666670',
              fontFamily: "'SF Mono', monospace",
              backgroundColor: 'rgba(255,255,255,0.04)',
              padding: '3px 8px',
              borderRadius: 20,
            }}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          )}
          {memories.length > 0 && (
            <span style={{
              fontSize: 10,
              color: '#F97316',
              backgroundColor: 'rgba(249,115,22,0.08)',
              padding: '3px 8px',
              borderRadius: 20,
              whiteSpace: 'nowrap',
              fontWeight: 500,
            }}>
              {memories.length} {isMobile ? 'mem' : 'memories'}
            </span>
          )}
          <button onClick={handleClear} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: '#666670',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 6,
            transition: 'color 0.15s ease',
          }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#666670')}>
            <TrashIcon size={12} />
            {!isMobile && 'Clear'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 14px' : '24px', display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
        {messages.length === 0 && showSuggestions && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: isMobile ? 20 : 28 }}>
            <div style={{ textAlign: 'center' }}>
              {/* Ember glow logo */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isMobile ? 56 : 64,
                height: isMobile ? 56 : 64,
                borderRadius: 18,
                background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))',
                border: '1px solid rgba(249,115,22,0.2)',
                marginBottom: 16,
              }}>
                <svg width={isMobile ? 26 : 30} height={isMobile ? 26 : 30} viewBox="0 0 24 24" fill="none">
                  <path d="M12 5c-2 2.5-4 5.5-4 8 0 2.21 1.79 4 4 4s4-1.79 4-4c0-2.5-2-5.5-4-8z" fill="#F97316" opacity="0.7" />
                  <path d="M12 8c-1 1.5-2 3.2-2 4.5 0 1.1.9 2 2 2s2-.9 2-2c0-1.3-1-3-2-4.5z" fill="#FB923C" />
                </svg>
              </div>
              <h3 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 600, color: '#FFFFFF', marginBottom: 6, letterSpacing: '-0.02em' }}>Ask Ember anything</h3>
              <p style={{ fontSize: isMobile ? 13 : 14, color: '#666670' }}>Your guide to the Vaultfire Protocol</p>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: 6,
              maxWidth: 480,
              width: '100%',
              padding: isMobile ? '0 4px' : 0,
            }}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button key={prompt} onClick={() => sendMessage(prompt)}
                  style={{
                    padding: isMobile ? '11px 14px' : '10px 14px',
                    backgroundColor: '#111114',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    color: '#A0A0A8',
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    letterSpacing: '-0.01em',
                    fontWeight: 400,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'; e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#A0A0A8'; e.currentTarget.style.backgroundColor = '#111114'; }}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="fade-in" style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: isMobile ? 8 : 10, alignItems: 'flex-start' }}>
            {msg.role === 'assistant' && <EmberAvatar size={isMobile ? 26 : 30} />}
            <div style={{
              maxWidth: isMobile ? '85%' : '75%',
              padding: isMobile ? '10px 14px' : '12px 16px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              backgroundColor: msg.role === 'user' ? '#F97316' : '#111114',
              color: msg.role === 'user' ? '#0A0A0C' : '#FFFFFF',
              fontSize: isMobile ? 13 : 14,
              lineHeight: 1.65,
              border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.06)' : 'none',
              overflow: 'hidden',
              wordBreak: 'break-word',
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
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: isMobile ? '10px 14px' : '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: '#0E0E11' }}>
        <div style={{
          display: 'flex',
          gap: isMobile ? 8 : 10,
          alignItems: 'flex-end',
          backgroundColor: '#111114',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: isMobile ? '6px 10px' : '8px 12px',
          transition: 'border-color 0.2s ease',
        }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isMobile ? 'Ask Ember...' : 'Ask Ember about the Vaultfire Protocol...'}
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#FFFFFF',
              fontSize: isMobile ? 14 : 14,
              resize: 'none',
              maxHeight: 120,
              overflowY: 'auto',
              lineHeight: 1.5,
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={() => sendMessage(inputText)}
            disabled={isLoading || !inputText.trim()}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: 'none',
              cursor: isLoading || !inputText.trim() ? 'default' : 'pointer',
              backgroundColor: isLoading || !inputText.trim() ? 'rgba(255,255,255,0.04)' : '#F97316',
              color: isLoading || !inputText.trim() ? '#666670' : '#0A0A0C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}>
            {isLoading ? (
              <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#666670', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <SendIcon size={14} />
            )}
          </button>
        </div>
        {!isMobile && (
          <p style={{ fontSize: 11, color: '#666670', marginTop: 6, textAlign: 'center', letterSpacing: '-0.01em' }}>
            Press Enter to send · Shift+Enter for new line
          </p>
        )}
      </div>
    </div>
  );
}
