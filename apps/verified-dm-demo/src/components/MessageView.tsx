import { useState, useEffect, useRef } from 'react';
import { ConversationWithVerification, VerifiedMessage } from '@/lib/xmtp';
import { VerificationBadge } from './VerificationBadge';
import { formatTimestamp, truncateAddress } from '@/lib/utils';
import { Send, Loader2 } from 'lucide-react';
import { xmtpClient } from '@/lib/xmtp';

interface MessageViewProps {
  conversation: ConversationWithVerification;
  currentAddress?: string;
}

export function MessageView({ conversation, currentAddress }: MessageViewProps) {
  const [messages, setMessages] = useState<VerifiedMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [conversation.conversation.peerAddress]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const msgs = await xmtpClient.getMessages(conversation.conversation);
      setMessages(msgs);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await xmtpClient.sendMessage(conversation.conversation.peerAddress, newMessage);
      setNewMessage('');
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-vaultfire-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 glass-effect">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">
              {truncateAddress(conversation.conversation.peerAddress)}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {conversation.conversation.peerAddress}
            </p>
          </div>
          {conversation.peerAttestation && (
            <VerificationBadge attestation={conversation.peerAttestation} />
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isOwn = msg.senderAddress.toLowerCase() === currentAddress?.toLowerCase();
            const showVerification = !isOwn && msg.verification;

            return (
              <div
                key={idx}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isOwn
                      ? 'bg-vaultfire-primary text-white'
                      : 'glass-effect text-gray-100'
                  }`}
                >
                  {showVerification && msg.verification?.attestation && (
                    <div className="mb-2">
                      <VerificationBadge
                        attestation={msg.verification.attestation}
                        size="sm"
                      />
                    </div>
                  )}
                  <p className="text-sm break-words">{msg.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isOwn ? 'text-indigo-200' : 'text-gray-500'
                    }`}
                  >
                    {formatTimestamp(msg.sent)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-800 glass-effect">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-vaultfire-primary"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2 bg-vaultfire-primary text-white rounded-lg hover:bg-vaultfire-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {sending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
