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

/* ── SVG Icons ── */
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
      elements.push(<h3 key={i} style={{ color: '#F4F4F5', fontWeight: 600, margin: '0.75rem 0 0.25rem', fontSize: '0.95em' }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ color: '#F4F4F5', fontWeight: 600, margin: '0.75rem 0 0.25rem', fontSize: '1.05em' }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ color: '#F4F4F5', fontWeight: 700, margin: '0.75rem 0 0.25rem', fontSize: '1.15em' }}>{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} style={{ marginLeft: '1.25rem', margin: '0.2rem 0' }}>{renderInline(line.slice(2))}</li>);
    } else if (line.match(/^\d+\. /)) {
      elements.push(<li key={i} style={{ marginLeft: '1.25rem', margin: '0.2rem 0', listStyleType: 'decimal' }}>{renderInline(line.replace(/^\d+\. /, ''))}</li>);
    } else if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} style={{ borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: '0.75rem', color: '#A1A1AA', fontStyle: 'italic', margin: '0.5rem 0' }}>{line.slice(2)}</blockquote>);
    } else if (line === '---' || line === '***') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '1rem 0' }} />);
    } else if (line === '') {
      elements.push(<br key={i} />);
    } else {
      elements.push(<p key={i} style={{ margin: '0.3rem 0', lineHeight: 1.7 }}>{renderInline(line)}</p>);
    }
    i++;
  }
  return <div className="prose-ember">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '0.1rem 0.35rem', fontSize: '0.85em', color: '#FB923C', fontFamily: "'JetBrains Mono', monospace" }}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#F4F4F5', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ color: '#A1A1AA' }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '8px 0' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="typing-dot" style={{
          width: 5, height: 5, borderRadius: '50%', backgroundColor: '#F97316',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

function EmbrisAvatar({ size = 28 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(249,115,22,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path d="M12 5c-2 2.5-4 5.5-4 8 0 2.21 1.79 4 4 4s4-1.79 4-4c0-2.5-2-5.5-4-8z" fill="#F97316" opacity="0.85" />
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#09090B' }}>

      {/* ── Header — minimal ── */}
      <div style={{
        padding: isMobile ? '10px 16px' : '12px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#09090B',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EmbrisAvatar size={isMobile ? 28 : 30} />
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#F4F4F5', letterSpacing: '-0.02em' }}>Embris</h2>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {walletAddress && !isMobile && (
            <span style={{
              fontSize: 11, color: '#52525B',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          )}
          {memories.length > 0 && (
            <span style={{
              fontSize: 11, color: '#71717A', fontWeight: 500,
            }}>
              {memories.length} {isMobile ? 'mem' : 'memories'}
            </span>
          )}
          <button onClick={handleClear} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, color: '#52525B', background: 'none',
            border: 'none', cursor: 'pointer', padding: '6px 8px',
            borderRadius: 6,
          }}>
            <TrashIcon size={12} />
            {!isMobile && 'Clear'}
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {messages.length === 0 && showSuggestions && (
          <div className="fade-in" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', flex: 1, gap: isMobile ? 28 : 36,
            padding: isMobile ? '40px 20px' : '60px 32px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <svg width={isMobile ? 36 : 40} height={isMobile ? 36 : 40} viewBox="0 0 32 32" fill="none" style={{ marginBottom: 20 }}>
                <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.85" />
                <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
                <path d="M16 14c-.7 1-1.4 2.2-1.4 3.2 0 .77.63 1.4 1.4 1.4s1.4-.63 1.4-1.4c0-1-.7-2.2-1.4-3.2z" fill="#FDE68A" opacity="0.7" />
              </svg>
              <h3 style={{
                fontSize: isMobile ? 22 : 26, fontWeight: 600, color: '#F4F4F5',
                marginBottom: 6, letterSpacing: '-0.03em',
              }}>Ask Embris anything</h3>
              <p style={{ fontSize: 14, color: '#52525B' }}>
                Your guide to the Vaultfire Protocol
              </p>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: 6, maxWidth: 480, width: '100%',
            }}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button key={prompt} onClick={() => sendMessage(prompt)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 10, color: '#71717A',
                    fontSize: 13, cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s ease',
                    fontWeight: 400, lineHeight: 1.4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#A1A1AA'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#71717A'; }}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list — centered with max-width like ChatGPT */}
        <div style={{
          maxWidth: 680, width: '100%', margin: '0 auto',
          padding: isMobile ? '20px 16px' : '28px 24px',
          display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 24,
        }}>
          {messages.map((msg) => (
            <div key={msg.id} className="fade-in" style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              gap: 12, alignItems: 'flex-start',
            }}>
              {msg.role === 'assistant' && <EmbrisAvatar size={28} />}
              <div style={{
                maxWidth: '85%',
                padding: msg.role === 'user' ? '10px 16px' : '0',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '0',
                backgroundColor: msg.role === 'user' ? '#F97316' : 'transparent',
                color: msg.role === 'user' ? '#09090B' : '#E4E4E7',
                fontSize: 14,
                lineHeight: 1.7,
                overflow: 'hidden', wordBreak: 'break-word',
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
      </div>

      {/* ── Input ── */}
      <div style={{
        padding: isMobile ? '12px 16px 16px' : '16px 24px 20px',
        backgroundColor: '#09090B',
      }}>
        <div style={{
          maxWidth: 680, margin: '0 auto',
        }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            backgroundColor: '#111113',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14, padding: isMobile ? '10px 12px' : '12px 16px',
            transition: 'border-color 0.15s ease',
          }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.25)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Embris..."
              disabled={isLoading}
              rows={1}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#F4F4F5', fontSize: 15, resize: 'none',
                maxHeight: 120, overflowY: 'auto', lineHeight: 1.5,
                fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em',
                fontWeight: 400,
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
                width: 36, height: 36, borderRadius: 10, border: 'none',
                cursor: isLoading || !inputText.trim() ? 'default' : 'pointer',
                backgroundColor: isLoading || !inputText.trim() ? 'rgba(255,255,255,0.03)' : '#F97316',
                color: isLoading || !inputText.trim() ? '#52525B' : '#09090B',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease', flexShrink: 0,
              }}>
              {isLoading ? (
                <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#52525B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <SendIcon size={15} />
              )}
            </button>
          </div>
          {!isMobile && (
            <p style={{ fontSize: 11, color: '#3F3F46', marginTop: 8, textAlign: 'center' }}>
              Enter to send · Shift+Enter for new line
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
