/**
 * Embris by Vaultfire — Disclaimers System (Mobile)
 * Uses AsyncStorage instead of localStorage for React Native.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISCLAIMER_PREFIX = 'embris_disclaimer_ack_';

export type DisclaimerKey =
  | 'wallet'
  | 'chat'
  | 'agent_hub'
  | 'vns'
  | 'zk_proofs'
  | 'marketplace'
  | 'general'
  | 'bridge'
  | 'earnings'
  | 'agent_api';

export interface Disclaimer {
  key: DisclaimerKey;
  title: string;
  body: string;
  version: number;
  requiresExplicitAck: boolean;
}

export const DISCLAIMERS: Record<DisclaimerKey, Disclaimer> = {
  wallet: {
    key: 'wallet',
    title: 'Non-Custodial Wallet',
    body: 'Embris is a non-custodial wallet. You are solely responsible for your private keys and recovery phrase. If you lose access, your funds cannot be recovered by Embris, Vaultfire, or any third party. All on-chain transactions are irreversible. This is not financial advice.',
    version: 1,
    requiresExplicitAck: true,
  },
  chat: {
    key: 'chat',
    title: 'AI Companion Notice',
    body: 'Embris is an AI companion and does not provide professional medical, legal, financial, or other expert advice. Conversations are stored locally on your device and are not transmitted to external servers without your consent.',
    version: 1,
    requiresExplicitAck: false,
  },
  agent_hub: {
    key: 'agent_hub',
    title: 'Experimental Platform',
    body: 'The Embris Hub is an experimental platform for AI agent collaboration. Embris does not guarantee the performance, reliability, or accuracy of any registered agent. All accountability bonds and transactions are on-chain and irreversible. Users interact with agents at their own risk. Agent-generated content does not represent the views of Embris or Vaultfire Protocol.',
    version: 1,
    requiresExplicitAck: false,
  },
  vns: {
    key: 'vns',
    title: 'VNS Registration Notice',
    body: 'VNS names are registered on-chain and cannot be modified or deleted once created. Registration requires a gas fee paid by the user. Embris does not guarantee name availability. Identity types (Human / AI Agent) are permanent and immutable after registration.',
    version: 1,
    requiresExplicitAck: false,
  },
  zk_proofs: {
    key: 'zk_proofs',
    title: 'Zero-Knowledge Proofs',
    body: 'Zero-knowledge proofs are cryptographic tools provided as-is. The Embris ZK infrastructure is experimental. Users should independently verify proof validity for critical applications. Embris makes no warranty regarding the correctness or completeness of generated proofs.',
    version: 1,
    requiresExplicitAck: false,
  },
  marketplace: {
    key: 'marketplace',
    title: 'Embris Directory Notice',
    body: "Agent and contributor ratings are based on on-chain data and peer reviews. Embris does not endorse, guarantee, or take responsibility for any agent's or contributor's services, outputs, or conduct. All directory transactions are peer-to-peer and on-chain.",
    version: 1,
    requiresExplicitAck: false,
  },
  general: {
    key: 'general',
    title: 'Terms of Use',
    body: 'Embris by Vaultfire Protocol is experimental software. Smart contracts are deployed on Ethereum, Base, and Avalanche networks. All on-chain transactions are irreversible. This application is not financial, legal, or investment advice. By using Embris, you accept full responsibility for your actions and agree to use this software at your own risk.',
    version: 1,
    requiresExplicitAck: false,
  },
  bridge: {
    key: 'bridge',
    title: 'Bridge Notice',
    body: 'Cross-chain bridge operations are irreversible. Teleporter Bridge uses Avalanche Warp Messaging for Base-Avalanche transfers. Trust Data Bridge syncs data to Ethereum mainnet. Bridge transactions may take several minutes to confirm. Embris is not responsible for delays or failures in cross-chain messaging.',
    version: 1,
    requiresExplicitAck: false,
  },
  earnings: {
    key: 'earnings',
    title: 'Earnings Notice',
    body: 'Agent earnings data is derived from on-chain transactions and x402 payment records. Embris does not guarantee the accuracy of earnings calculations. Tax obligations are the sole responsibility of the user. This is not financial advice.',
    version: 1,
    requiresExplicitAck: false,
  },
  agent_api: {
    key: 'agent_api',
    title: 'API Notice',
    body: 'The Embris API is experimental and subject to change without notice. API keys and access tokens should be kept secure. Embris is not responsible for any losses resulting from API usage.',
    version: 1,
    requiresExplicitAck: false,
  },
};

function getAckKey(key: DisclaimerKey, version: number): string {
  return `${DISCLAIMER_PREFIX}${key}_v${version}`;
}

export async function isDisclaimerAcknowledged(key: DisclaimerKey): Promise<boolean> {
  const disclaimer = DISCLAIMERS[key];
  const storageKey = getAckKey(key, disclaimer.version);
  try {
    const val = await AsyncStorage.getItem(storageKey);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function acknowledgeDisclaimer(key: DisclaimerKey): Promise<void> {
  const disclaimer = DISCLAIMERS[key];
  const storageKey = getAckKey(key, disclaimer.version);
  try {
    await AsyncStorage.setItem(storageKey, 'true');
  } catch { /* ignore */ }
}

export async function resetDisclaimer(key: DisclaimerKey): Promise<void> {
  const disclaimer = DISCLAIMERS[key];
  const storageKey = getAckKey(key, disclaimer.version);
  try {
    await AsyncStorage.removeItem(storageKey);
  } catch { /* ignore */ }
}

export async function resetAllDisclaimers(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const disclaimerKeys = keys.filter(k => k.startsWith(DISCLAIMER_PREFIX));
    if (disclaimerKeys.length > 0) {
      await AsyncStorage.multiRemove(disclaimerKeys);
    }
  } catch { /* ignore */ }
}

export async function getAcknowledgedCount(): Promise<number> {
  let count = 0;
  for (const key of Object.keys(DISCLAIMERS) as DisclaimerKey[]) {
    if (await isDisclaimerAcknowledged(key)) count++;
  }
  return count;
}

export const GENERAL_DISCLAIMER_SHORT =
  'Experimental software. Not financial advice. On-chain transactions are irreversible. Use at your own risk.';

export const GENERAL_DISCLAIMER_FULL = `Embris by Vaultfire Protocol is experimental software deployed on Ethereum, Base, and Avalanche networks. All on-chain transactions are irreversible. Smart contracts may contain bugs or vulnerabilities. This application does not constitute financial, legal, investment, or professional advice of any kind. Embris is a non-custodial wallet — you are solely responsible for your private keys. The Embris Hub and Embris Directory are experimental platforms; Embris does not guarantee agent performance or reliability. VNS registrations are permanent and on-chain. By using Embris, you accept these terms and agree to use this software entirely at your own risk. © ${new Date().getFullYear()} Embris by Vaultfire Protocol.`;
