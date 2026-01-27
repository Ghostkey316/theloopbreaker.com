/**
 * XMTP Client with Vaultfire Verification Layer
 *
 * Wraps XMTP messaging with Vaultfire's proof/policy layer
 */

import { Client, Conversation, DecodedMessage } from '@xmtp/xmtp-js';
import { Signer } from 'ethers';
import { vaultfire, VerificationPolicy, VaultfireAttestation } from './vaultfire';

export interface VerifiedMessage extends DecodedMessage {
  verification?: {
    verified: boolean;
    attestation?: VaultfireAttestation;
    reason?: string;
  };
}

export interface ConversationWithVerification {
  conversation: Conversation;
  peerAttestation?: VaultfireAttestation;
  isVerified: boolean;
}

export class VerifiedXMTPClient {
  private client: Client | null = null;
  private verificationPolicy: VerificationPolicy = {
    minScore: 40, // Default anti-spam threshold
    requireVerified: false,
  };

  async initialize(signer: Signer): Promise<void> {
    this.client = await Client.create(signer, {
      env: 'production', // Use 'dev' for testing
    });
  }

  async initializeWithKeys(keys: Uint8Array): Promise<void> {
    this.client = await Client.create(null, {
      env: 'production',
      privateKeyOverride: keys,
    });
  }

  isReady(): boolean {
    return this.client !== null;
  }

  getAddress(): string | undefined {
    return this.client?.address;
  }

  // Note: Key export API changed in XMTP v11+
  // async exportKeys(): Promise<Uint8Array | undefined> {
  //   return this.client?.keyBundle;
  // }

  setVerificationPolicy(policy: VerificationPolicy): void {
    this.verificationPolicy = { ...this.verificationPolicy, ...policy };
  }

  /**
   * Get all conversations with verification status
   */
  async getConversations(): Promise<ConversationWithVerification[]> {
    if (!this.client) throw new Error('Client not initialized');

    const conversations = await this.client.conversations.list();
    const verified: ConversationWithVerification[] = [];

    for (const conversation of conversations) {
      const peerAttestation = await vaultfire.getAttestation(conversation.peerAddress);
      const { verified: isVerified } = await vaultfire.verifySender(
        conversation.peerAddress,
        this.verificationPolicy
      );

      verified.push({
        conversation,
        peerAttestation,
        isVerified,
      });
    }

    return verified;
  }

  /**
   * Get messages from a conversation with verification metadata
   */
  async getMessages(
    conversation: Conversation,
    limit?: number
  ): Promise<VerifiedMessage[]> {
    if (!this.client) throw new Error('Client not initialized');

    const messages = await conversation.messages({ limit });
    const verified: VerifiedMessage[] = [];

    for (const message of messages) {
      const verification = await vaultfire.verifySender(
        message.senderAddress,
        this.verificationPolicy
      );

      const verifiedMessage = message as VerifiedMessage;
      verifiedMessage.verification = verification;
      verified.push(verifiedMessage);
    }

    return verified;
  }

  /**
   * Send a message to an address
   */
  async sendMessage(peerAddress: string, content: string): Promise<DecodedMessage> {
    if (!this.client) throw new Error('Client not initialized');

    const conversation = await this.client.conversations.newConversation(peerAddress);
    return await conversation.send(content);
  }

  /**
   * Stream new messages with verification
   */
  async streamMessages(
    onMessage: (message: VerifiedMessage) => void,
    onlyVerified: boolean = false
  ): Promise<() => void> {
    if (!this.client) throw new Error('Client not initialized');

    const stream = await this.client.conversations.streamAllMessages();

    const processMessage = async () => {
      for await (const message of stream) {
        const verification = await vaultfire.verifySender(
          message.senderAddress,
          this.verificationPolicy
        );

        // Filter out unverified if requested
        if (onlyVerified && !verification.verified) {
          continue;
        }

        const verifiedMessage = message as VerifiedMessage;
        verifiedMessage.verification = verification;

        onMessage(verifiedMessage);
      }
    };

    processMessage();

    return () => {
      // Cleanup function
      stream.return?.(undefined);
    };
  }

  /**
   * Get filtered inbox (verified senders only)
   */
  async getVerifiedInbox(): Promise<ConversationWithVerification[]> {
    const allConversations = await this.getConversations();
    return allConversations.filter((c) => c.isVerified);
  }

  /**
   * Get spam inbox (unverified senders)
   */
  async getSpamInbox(): Promise<ConversationWithVerification[]> {
    const allConversations = await this.getConversations();
    return allConversations.filter((c) => !c.isVerified);
  }

  /**
   * Block a sender
   */
  async blockSender(address: string): Promise<void> {
    const currentBlockList = this.verificationPolicy.blockList || [];
    this.verificationPolicy.blockList = [...currentBlockList, address.toLowerCase()];
  }

  /**
   * Allow a sender (whitelist)
   */
  async allowSender(address: string): Promise<void> {
    const currentAllowList = this.verificationPolicy.allowList || [];
    this.verificationPolicy.allowList = [...currentAllowList, address.toLowerCase()];
  }
}

// Singleton instance
export const xmtpClient = new VerifiedXMTPClient();
