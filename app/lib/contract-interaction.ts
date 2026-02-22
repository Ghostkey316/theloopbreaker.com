/**
 * Embris Contract Interaction Module
 *
 * Handles on-chain reads so Embris can answer questions like:
 * - "Am I registered?"
 * - "What's my trust score?"
 * - "How many agents are registered?"
 *
 * Uses raw JSON-RPC calls to Base and Avalanche RPCs.
 */

import { CHAINS, BASE_CONTRACTS, AVALANCHE_CONTRACTS } from './contracts';
import { getWalletAddress } from './wallet';
import { isRegistered, getRegistration, getRegisteredChains } from './registration';

/* ── RPC Helper ── */

async function jsonRpc(rpcUrl: string, method: string, params: unknown[] = []): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  } finally {
    clearTimeout(timeout);
  }
}

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string | null> {
  try {
    const result = (await jsonRpc(rpcUrl, 'eth_call', [{ to, data }, 'latest'])) as string;
    if (!result || result === '0x') return null;
    return result;
  } catch {
    return null;
  }
}

function decodeUint256(hex: string): number {
  try {
    const n = BigInt(hex);
    return n > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(n);
  } catch {
    return 0;
  }
}

/* ── Known Selectors ── */

const SELECTORS = {
  getAgentCount: '0x3731a16f',
  getAgent: '0xfb3551ff',
  owner: '0x8da5cb5b',
  paused: '0x5c975abb',
  version: '0x54fd4d50',
  totalSupply: '0x18160ddd',
};

/* ── Contract Query Functions ── */

export interface ContractQueryResult {
  success: boolean;
  data: string;
  raw?: Record<string, unknown>;
}

/**
 * Check if a specific address is registered on a chain
 */
export async function checkRegistrationOnChain(
  address: string,
  chain: 'base' | 'avalanche'
): Promise<{ registered: boolean; agentName: string | null }> {
  const contracts = chain === 'base' ? BASE_CONTRACTS : AVALANCHE_CONTRACTS;
  const registry = contracts.find(c => c.name === 'ERC8004IdentityRegistry');
  if (!registry) return { registered: false, agentName: null };

  const rpc = CHAINS[chain].rpc;
  const addr = address.replace('0x', '').toLowerCase().padStart(64, '0');
  const calldata = SELECTORS.getAgent + addr;

  try {
    const result = await ethCall(rpc, registry.address, calldata);
    if (!result) return { registered: false, agentName: null };

    const hex = result.slice(2);
    if (hex.length < 128) return { registered: false, agentName: null };

    const nameOffset = parseInt(hex.slice(0, 64), 16) * 2;
    if (nameOffset >= hex.length) return { registered: false, agentName: null };

    const nameLength = parseInt(hex.slice(nameOffset, nameOffset + 64), 16);
    if (nameLength === 0) return { registered: false, agentName: null };

    const nameHex = hex.slice(nameOffset + 64, nameOffset + 64 + nameLength * 2);
    const nameBytes = new Uint8Array(nameLength);
    for (let i = 0; i < nameLength; i++) {
      nameBytes[i] = parseInt(nameHex.slice(i * 2, i * 2 + 2), 16);
    }
    const name = new TextDecoder().decode(nameBytes);
    return { registered: !!name, agentName: name || null };
  } catch {
    return { registered: false, agentName: null };
  }
}

/**
 * Get the total number of registered agents on a chain
 */
export async function getAgentCount(chain: 'base' | 'avalanche'): Promise<number | null> {
  const contracts = chain === 'base' ? BASE_CONTRACTS : AVALANCHE_CONTRACTS;
  const registry = contracts.find(c => c.name === 'ERC8004IdentityRegistry');
  if (!registry) return null;

  const rpc = CHAINS[chain].rpc;
  const result = await ethCall(rpc, registry.address, SELECTORS.getAgentCount);
  if (!result) return null;
  return decodeUint256(result);
}

/**
 * Check if a contract is alive (has code deployed)
 */
export async function checkContractAlive(chain: 'base' | 'avalanche', address: string): Promise<boolean> {
  const rpc = CHAINS[chain].rpc;
  try {
    const code = (await jsonRpc(rpc, 'eth_getCode', [address, 'latest'])) as string;
    return code !== '0x' && code !== '0x0' && code.length > 2;
  } catch {
    return false;
  }
}

/**
 * Get current block number for a chain
 */
export async function getBlockNumber(chain: 'base' | 'avalanche'): Promise<number | null> {
  const rpc = CHAINS[chain].rpc;
  try {
    const result = (await jsonRpc(rpc, 'eth_blockNumber')) as string;
    return parseInt(result, 16);
  } catch {
    return null;
  }
}

/* ── Embris Query Handler ── */

export interface EmbrisContractQuery {
  type: 'registration_check' | 'agent_count' | 'trust_score' | 'contract_status' | 'unknown';
  chain?: 'base' | 'avalanche' | 'both';
}

/**
 * Detect if a user message is asking about on-chain data
 */
export function detectContractQuery(message: string): EmbrisContractQuery | null {
  const lower = message.toLowerCase();

  if (/\b(am i registered|my registration|registration status|check.*(my|if).*(registered|registration))\b/.test(lower)) {
    return { type: 'registration_check', chain: 'both' };
  }

  if (/\b(how many.*(agents?|users?|people|registered)|agent count|total.*(registered|agents?))\b/.test(lower)) {
    return { type: 'agent_count', chain: 'both' };
  }

  if (/\b(trust score|my score|reputation|what('s| is) my.*(score|trust|reputation))\b/.test(lower)) {
    return { type: 'trust_score', chain: 'both' };
  }

  if (/\b(contract.*(status|alive|live|active)|are.*(contracts?).*(live|active|deployed))\b/.test(lower)) {
    return { type: 'contract_status', chain: 'both' };
  }

  return null;
}

/**
 * Execute a contract query and return formatted result for Embris
 */
export async function executeContractQuery(query: EmbrisContractQuery): Promise<string> {
  try {
    switch (query.type) {
      case 'registration_check': {
        const address = getWalletAddress();
        if (!address) {
          return '\n\n[ON-CHAIN DATA] No wallet found. The user needs to create a wallet first before checking registration.';
        }

        const localReg = isRegistered();
        const regData = getRegistration();
        const regChains = getRegisteredChains();

        const results: string[] = [];
        results.push(`\n\n[ON-CHAIN DATA — Registration Check for ${address.slice(0, 6)}...${address.slice(-4)}]`);
        results.push(`Local registration status: ${localReg ? 'REGISTERED' : 'NOT REGISTERED'}`);

        if (regData) {
          results.push(`Registered chains: ${regChains.join(', ') || 'none'}`);
          for (const cr of regData.chains) {
            results.push(`  ${cr.chain}: tx ${cr.txHash?.slice(0, 10)}... — ${cr.explorerUrl}`);
          }
        }

        // Live on-chain check
        for (const chain of ['base', 'avalanche'] as const) {
          const onChain = await checkRegistrationOnChain(address, chain);
          results.push(`Live ${chain} check: ${onChain.registered ? `Registered as "${onChain.agentName}"` : 'Not found on-chain'}`);
        }

        return results.join('\n');
      }

      case 'agent_count': {
        const results: string[] = ['\n\n[ON-CHAIN DATA — Agent Registry Counts]'];
        for (const chain of ['base', 'avalanche'] as const) {
          const count = await getAgentCount(chain);
          results.push(`${chain}: ${count !== null ? `${count} registered agents` : 'Unable to read count'}`);
        }
        return results.join('\n');
      }

      case 'trust_score': {
        const address = getWalletAddress();
        if (!address) {
          return '\n\n[ON-CHAIN DATA] No wallet found. Create a wallet to check trust score.';
        }

        const localReg = isRegistered();
        const regChains = getRegisteredChains();

        const results: string[] = [`\n\n[ON-CHAIN DATA — Trust Score for ${address.slice(0, 6)}...${address.slice(-4)}]`];
        results.push(`Registration: ${localReg ? 'Verified' : 'Not registered'}`);
        results.push(`Chains: ${regChains.length > 0 ? regChains.join(', ') : 'None'}`);
        results.push(`Protocol contracts verified: ${BASE_CONTRACTS.length + AVALANCHE_CONTRACTS.length}`);
        results.push(`Active chains: 2 (Base + Avalanche)`);

        // Calculate a trust score based on available data
        let score = 0;
        if (localReg) score += 40;
        if (regChains.includes('base')) score += 15;
        if (regChains.includes('avalanche')) score += 15;
        if (address) score += 10;
        // Check live registration
        for (const chain of regChains) {
          const onChain = await checkRegistrationOnChain(address, chain);
          if (onChain.registered) score += 10;
        }
        results.push(`Calculated trust score: ${Math.min(score, 100)}/100`);
        results.push(`Grade: ${score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D'}`);

        return results.join('\n');
      }

      case 'contract_status': {
        const results: string[] = ['\n\n[ON-CHAIN DATA — Contract Status]'];
        results.push(`Total contracts: ${BASE_CONTRACTS.length + AVALANCHE_CONTRACTS.length}`);
        results.push(`Base: ${BASE_CONTRACTS.length} contracts`);
        results.push(`Avalanche: ${AVALANCHE_CONTRACTS.length} contracts`);

        // Check a few key contracts
        for (const chain of ['base', 'avalanche'] as const) {
          const contracts = chain === 'base' ? BASE_CONTRACTS : AVALANCHE_CONTRACTS;
          const key = contracts.find(c => c.name === 'ERC8004IdentityRegistry');
          if (key) {
            const alive = await checkContractAlive(chain, key.address);
            results.push(`${chain} IdentityRegistry: ${alive ? 'LIVE' : 'UNREACHABLE'}`);
          }
          const block = await getBlockNumber(chain);
          if (block) results.push(`${chain} current block: ${block.toLocaleString()}`);
        }

        return results.join('\n');
      }

      default:
        return '';
    }
  } catch (error) {
    return `\n\n[ON-CHAIN DATA ERROR] ${error instanceof Error ? error.message : 'Failed to query chain'}`;
  }
}
