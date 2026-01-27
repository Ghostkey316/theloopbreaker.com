import { ConversationWithVerification } from '@/lib/xmtp';
import { VerificationBadge } from './VerificationBadge';
import { formatDistanceToNow } from '@/lib/utils';
import { Mail, ShieldX } from 'lucide-react';

interface ConversationListProps {
  conversations: ConversationWithVerification[];
  selectedConversation?: ConversationWithVerification;
  onSelectConversation: (conversation: ConversationWithVerification) => void;
  showSpam?: boolean;
}

export function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  showSpam = false,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        {showSpam ? (
          <>
            <ShieldX size={48} className="text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-300 mb-2">No Spam Messages</h3>
            <p className="text-sm text-gray-500">
              Vaultfire is protecting your inbox from unverified senders
            </p>
          </>
        ) : (
          <>
            <Mail size={48} className="text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-300 mb-2">No Conversations</h3>
            <p className="text-sm text-gray-500">
              Start a new conversation to get started
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {conversations.map((conv) => {
        const isSelected = selectedConversation?.conversation.peerAddress === conv.conversation.peerAddress;

        return (
          <button
            key={conv.conversation.peerAddress}
            onClick={() => onSelectConversation(conv)}
            className={`w-full p-4 text-left hover:bg-gray-800/50 transition-colors ${
              isSelected ? 'bg-gray-800/80' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">
                  {conv.conversation.peerAddress.slice(0, 6)}...
                  {conv.conversation.peerAddress.slice(-4)}
                </p>
              </div>
              {conv.peerAttestation && (
                <VerificationBadge
                  attestation={conv.peerAttestation}
                  size="sm"
                  showLabel={false}
                />
              )}
            </div>
            {conv.peerAttestation && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Score: {conv.peerAttestation.score}</span>
                <span>•</span>
                <span>Rep: {conv.peerAttestation.reputation}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
