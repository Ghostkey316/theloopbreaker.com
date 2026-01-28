import { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { xmtpClient } from '@/lib/xmtp';
import { ConversationWithVerification } from '@/lib/xmtp';
import { ConversationList } from '@/components/ConversationList';
import { MessageView } from '@/components/MessageView';
import { Shield, Inbox, Trash2, Settings, Loader2 } from 'lucide-react';
import { BrowserProvider } from 'ethers';

export default function InboxPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [selectedTab, setSelectedTab] = useState<'inbox' | 'spam'>('inbox');
  const [verifiedConversations, setVerifiedConversations] = useState<ConversationWithVerification[]>([]);
  const [spamConversations, setSpamConversations] = useState<ConversationWithVerification[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithVerification>();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isConnected && walletClient) {
      initializeXMTP();
    }
  }, [isConnected, walletClient]);

  const initializeXMTP = async () => {
    if (!walletClient || isInitialized) return;

    setIsInitializing(true);
    try {
      const provider = new BrowserProvider(walletClient.transport as any);
      const signer = await provider.getSigner();
      await xmtpClient.initialize(signer);
      setIsInitialized(true);
      await loadConversations();
    } catch (error) {
      console.error('Error initializing XMTP:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const loadConversations = async () => {
    try {
      const verified = await xmtpClient.getVerifiedInbox();
      const spam = await xmtpClient.getSpamInbox();
      setVerifiedConversations(verified);
      setSpamConversations(spam);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield size={64} className="mx-auto mb-6 text-vaultfire-primary" />
          <h1 className="text-3xl font-bold mb-4">Verified DMs</h1>
          <p className="text-gray-400 mb-8">Connect your wallet to access verified messaging</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="mx-auto mb-4 text-vaultfire-primary animate-spin" />
          <p className="text-gray-400">Initializing XMTP...</p>
        </div>
      </div>
    );
  }

  const activeConversations = selectedTab === 'inbox' ? verifiedConversations : spamConversations;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 glass-effect">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="text-vaultfire-primary" size={32} />
            <h1 className="text-2xl font-bold">Vaultfire DMs</h1>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-80 border-r border-gray-800 glass-effect flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setSelectedTab('inbox')}
              className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${
                selectedTab === 'inbox'
                  ? 'bg-vaultfire-primary/10 text-vaultfire-primary border-b-2 border-vaultfire-primary'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Inbox size={20} />
              <span>Verified ({verifiedConversations.length})</span>
            </button>
            <button
              onClick={() => setSelectedTab('spam')}
              className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${
                selectedTab === 'spam'
                  ? 'bg-red-500/10 text-red-400 border-b-2 border-red-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Trash2 size={20} />
              <span>Spam ({spamConversations.length})</span>
            </button>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            <ConversationList
              conversations={activeConversations}
              selectedConversation={selectedConversation}
              onSelectConversation={setSelectedConversation}
              showSpam={selectedTab === 'spam'}
            />
          </div>
        </div>

        {/* Message View */}
        <div className="flex-1">
          {selectedConversation ? (
            <MessageView
              conversation={selectedConversation}
              currentAddress={address}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 p-8">
              <div className="text-center max-w-md">
                <div className="relative inline-block mb-6">
                  <Inbox size={64} className="mx-auto opacity-50" />
                  <div className="absolute -bottom-2 -right-2 bg-vaultfire-primary/20 rounded-full p-2">
                    <Shield size={24} className="text-vaultfire-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-300 mb-2">No Conversation Selected</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Select a conversation from the sidebar to view messages
                </p>
                <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700 text-left">
                  <p className="text-xs text-gray-400">
                    💡 <span className="font-semibold">Tip:</span> Each conversation shows the sender&apos;s verification status, reputation score, and trust level powered by Vaultfire attestations.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
