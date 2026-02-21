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

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ color: '#FF6B35', fontWeight: 600, margin: '0.75rem 0 0.25rem' }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ color: '#FF6B35', fontWeight: 600, margin: '0.75rem 0 0.25rem' }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ color: '#FF6B35', fontWeight: 700, margin: '0.75rem 0 0.25rem' }}>{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} style={{ marginLeft: '1.25rem', margin: '0.2rem 0' }}>{renderInline(line.slice(2))}</li>);
    } else if (line.match(/^\d+\. /)) {
      elements.push(<li key={i} style={{ marginLeft: '1.25rem', margin: '0.2rem 0', listStyleType: 'decimal' }}>{renderInline(line.replace(/^\d+\. /, ''))}</li>);
    } else if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} style={{ borderLeft: '3px solid #FF6B35', paddingLeft: '0.75rem', color: '#9BA1A6', fontStyle: 'italic', margin: '0.5rem 0' }}>{line.slice(2)}</blockquote>);
    } else if (line === '---' || line === '***') {
      elements.push(<hr key={i} style={{ borderColor: '#2A2A2E', margin: '1rem 0' }} />);
    } else if (line === '') {
      elements.push(<br key={i} />);
    } else {
      elements.push(<p key={i} style={{ margin: '0.3rem 0', lineHeight: 1.6 }}>{renderInline(line)}</p>);
    }
    i++;
  }
  return <div className="prose-ember">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: '#2A2A2E', border: '1px solid #3A3A3E', borderRadius: 4, padding: '0.1rem 0.35rem', fontSize: '0.85em', color: '#FF8C5A', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#ECEDEE', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ color: '#9BA1A6' }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 0' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="typing-dot" style={{
          width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FF6B35',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
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
        padding: isMobile ? '12px 14px' : '16px 24px',
        borderBottom: '1px solid #2A2A2E',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1A1A1E',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, minWidth: 0 }}>
          <div style={{
            width: isMobile ? 32 : 36,
            height: isMobile ? 32 : 36,
            borderRadius: '50%',
            backgroundColor: '#FF6B3520',
            border: '1px solid #FF6B35',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isMobile ? 15 : 18,
            flexShrink: 0,
          }}>🔥</div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, color: '#ECEDEE' }}>Ember AI</h2>
            {!isMobile && <p style={{ fontSize: 12, color: '#9BA1A6' }}>Vaultfire Protocol companion</p>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 12, flexShrink: 0 }}>
          {walletAddress && !isMobile && (
            <span style={{ fontSize: 11, color: '#9BA1A6', fontFamily: 'monospace', backgroundColor: '#2A2A2E', padding: '3px 8px', borderRadius: 6 }}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          )}
          {memories.length > 0 && (
            <span style={{ fontSize: 11, color: '#FF6B35', backgroundColor: '#FF6B3510', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
              {memories.length} {isMobile ? 'mem' : 'memories'}
            </span>
          )}
          <button onClick={handleClear} style={{ fontSize: 12, color: '#9BA1A6', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ECEDEE')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#9BA1A6')}>
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 14px' : '24px', display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
        {messages.length === 0 && showSuggestions && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: isMobile ? 16 : 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: isMobile ? 36 : 48, marginBottom: 12 }}>🔥</div>
              <h3 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 600, color: '#ECEDEE', marginBottom: 8 }}>Ask Ember anything</h3>
              <p style={{ fontSize: isMobile ? 13 : 14, color: '#9BA1A6' }}>Your guide to the Vaultfire Protocol</p>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: 8,
              maxWidth: 500,
              width: '100%',
              padding: isMobile ? '0 4px' : 0,
            }}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button key={prompt} onClick={() => sendMessage(prompt)}
                  style={{ padding: isMobile ? '12px 14px' : '10px 14px', backgroundColor: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: 10, color: '#ECEDEE', fontSize: 13, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF6B35'; e.currentTarget.style.backgroundColor = '#FF6B3510'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2A2A2E'; e.currentTarget.style.backgroundColor = '#1A1A1E'; }}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="fade-in" style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: isMobile ? 8 : 10, alignItems: 'flex-start' }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: isMobile ? 28 : 32,
                height: isMobile ? 28 : 32,
                borderRadius: '50%',
                backgroundColor: '#FF6B3520',
                border: '1px solid #FF6B35',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? 12 : 14,
                flexShrink: 0,
              }}>🔥</div>
            )}
            <div style={{
              maxWidth: isMobile ? '85%' : '75%',
              padding: isMobile ? '10px 14px' : '12px 16px',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              backgroundColor: msg.role === 'user' ? '#FF6B35' : '#1A1A1E',
              color: msg.role === 'user' ? '#0A0A0C' : '#ECEDEE',
              fontSize: isMobile ? 13 : 14,
              lineHeight: 1.6,
              border: msg.role === 'assistant' ? '1px solid #2A2A2E' : 'none',
              overflow: 'hidden',
              wordBreak: 'break-word',
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
      <div style={{ padding: isMobile ? '12px 14px' : '16px 24px', borderTop: '1px solid #2A2A2E', backgroundColor: '#1A1A1E' }}>
        <div style={{ display: 'flex', gap: isMobile ? 8 : 10, alignItems: 'flex-end', backgroundColor: '#0A0A0C', border: '1px solid #2A2A2E', borderRadius: 14, padding: isMobile ? '6px 10px' : '8px 12px', transition: 'border-color 0.15s' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#FF6B35')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#2A2A2E')}>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isMobile ? 'Ask Ember...' : 'Ask Ember about the Vaultfire Protocol...'}
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none', color: '#ECEDEE', fontSize: isMobile ? 14 : 14,
              resize: 'none', maxHeight: 120, overflowY: 'auto', lineHeight: 1.5,
              fontFamily: 'inherit',
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
              width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: isLoading || !inputText.trim() ? 'default' : 'pointer',
              backgroundColor: isLoading || !inputText.trim() ? '#2A2A2E' : '#FF6B35',
              color: isLoading || !inputText.trim() ? '#9BA1A6' : '#0A0A0C',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              transition: 'all 0.15s', flexShrink: 0,
            }}>
            {isLoading ? '⏳' : '↑'}
          </button>
        </div>
        {!isMobile && (
          <p style={{ fontSize: 11, color: '#9BA1A6', marginTop: 6, textAlign: 'center' }}>
            Press Enter to send · Shift+Enter for new line
          </p>
        )}
      </div>
    </div>
  );
}
