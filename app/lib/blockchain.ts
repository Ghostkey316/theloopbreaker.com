/**
 * Blockchain connectivity and contract reading for the web app.
 * Uses raw JSON-RPC calls — no ethers.js needed for reads.
 */
import { CHAINS } from './contracts';

export interface RPCResult {
  success: boolean;
  blockNumber?: number;
  chainId?: number;
  error?: string;
  latency?: number;
}

// ─── Known function selectors ─────────────────────────────────────────────────
const KNOWN_SELECTORS: Record<string, string> = {
  'proposalCount()': '0xda35c664',
  'getProposalCount()': '0x4b0bddd2',
  'nonce()': '0xaffed0e0',
  'messageNonce()': '0xecc70428',
  'owner()': '0x8da5cb5b',
  'paused()': '0x5c975abb',
  'totalSupply()': '0x18160ddd',
  'name()': '0x06fdde03',
  'getAgentCount()': '0x0f755a56',
  'getEntryCount()': '0x6f3c25fb',
  'getRegistryCount()': '0x4a6c9db6',
  'getValidatorCount()': '0x79e5a123',
  'version()': '0x54fd4d50',
  'threshold()': '0x42cde4e8',
  'getThreshold()': '0xe75235b8',
  'ownerCount()': '0xb0f57ee9',
  'required()': '0xdc8452cd',
  'transactionCount()': '0xb77bf600',
};

function getSelector(sig: string): string {
  return KNOWN_SELECTORS[sig] || '';
}

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────
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

async function safeEthCall(rpcUrl: string, address: string, selector: string): Promise<string | null> {
  if (!selector) return null;
  try {
    const result = (await jsonRpc(rpcUrl, 'eth_call', [{ to: address, data: selector }, 'latest'])) as string;
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

function decodeBool(hex: string): boolean {
  try {
    return BigInt(hex) !== BigInt(0);
  } catch {
    return false;
  }
}

// ─── Chain connectivity ───────────────────────────────────────────────────────
export async function checkChainConnectivity(chain: 'base' | 'avalanche' | 'ethereum'): Promise<RPCResult> {
  const cfg = CHAINS[chain];
  const start = Date.now();
  try {
    const [blockHex, chainHex] = await Promise.all([
      jsonRpc(cfg.rpc, 'eth_blockNumber') as Promise<string>,
      jsonRpc(cfg.rpc, 'eth_chainId') as Promise<string>,
    ]);
    return {
      success: true,
      blockNumber: parseInt(blockHex, 16),
      chainId: parseInt(chainHex, 16),
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - start,
    };
  }
}

export async function checkAllChains(): Promise<Record<string, RPCResult>> {
  const [base, avalanche] = await Promise.all([
    checkChainConnectivity('base'),
    checkChainConnectivity('avalanche'),
  ]);
  return { base, avalanche };
}

// ─── Contract existence check ─────────────────────────────────────────────────
export async function checkContractAlive(chain: 'base' | 'avalanche' | 'ethereum', address: string): Promise<boolean> {
  const rpc = CHAINS[chain].rpc;
  try {
    const code = (await jsonRpc(rpc, 'eth_getCode', [address, 'latest'])) as string;
    return code !== '0x' && code !== '0x0' && code.length > 2;
  } catch {
    return false;
  }
}

export async function getMultipleContractStatus(
  chain: 'base' | 'avalanche' | 'ethereum',
  addresses: string[]
): Promise<Record<string, boolean>> {
  const results = await Promise.all(
    addresses.map(async (addr) => {
      const alive = await checkContractAlive(chain, addr);
      return [addr, alive] as [string, boolean];
    })
  );
  return Object.fromEntries(results);
}

// ─── Contract data reads ──────────────────────────────────────────────────────
export interface GovernanceData {
  isAlive: boolean;
  proposalCount: number | null;
  threshold: number | null;
  ownerCount: number | null;
}

export async function getGovernanceData(chain: 'base' | 'avalanche' | 'ethereum', address: string): Promise<GovernanceData> {
  const rpc = CHAINS[chain].rpc;
  const isAlive = await checkContractAlive(chain, address);
  if (!isAlive) return { isAlive: false, proposalCount: null, threshold: null, ownerCount: null };

  const [propResult, threshResult, ownerResult] = await Promise.all([
    safeEthCall(rpc, address, getSelector('proposalCount()')) ||
      safeEthCall(rpc, address, getSelector('getProposalCount()')),
    safeEthCall(rpc, address, getSelector('threshold()')) ||
      safeEthCall(rpc, address, getSelector('getThreshold()')),
    safeEthCall(rpc, address, getSelector('ownerCount()')),
  ]);

  return {
    isAlive: true,
    proposalCount: propResult ? decodeUint256(propResult) : null,
    threshold: threshResult ? decodeUint256(threshResult) : null,
    ownerCount: ownerResult ? decodeUint256(ownerResult) : null,
  };
}

export interface BridgeStats {
  isAlive: boolean;
  messageCount: number | null;
  nonce: number | null;
  paused: boolean | null;
}

export async function getTeleporterBridgeStats(chain: 'base' | 'avalanche' | 'ethereum', address: string): Promise<BridgeStats> {
  const rpc = CHAINS[chain].rpc;
  const isAlive = await checkContractAlive(chain, address);
  if (!isAlive) return { isAlive: false, messageCount: null, nonce: null, paused: null };

  const [nonceResult, pausedResult] = await Promise.all([
    safeEthCall(rpc, address, getSelector('messageNonce()')) ||
      safeEthCall(rpc, address, getSelector('nonce()')),
    safeEthCall(rpc, address, getSelector('paused()')),
  ]);

  return {
    isAlive: true,
    messageCount: nonceResult ? decodeUint256(nonceResult) : null,
    nonce: nonceResult ? decodeUint256(nonceResult) : null,
    paused: pausedResult ? decodeBool(pausedResult) : null,
  };
}

export interface RegistryData {
  isAlive: boolean;
  entryCount: number | null;
}

export async function getRegistryData(chain: 'base' | 'avalanche' | 'ethereum', address: string): Promise<RegistryData> {
  const rpc = CHAINS[chain].rpc;
  const isAlive = await checkContractAlive(chain, address);
  if (!isAlive) return { isAlive: false, entryCount: null };

  const countResult = await (
    safeEthCall(rpc, address, getSelector('getAgentCount()')) ||
    safeEthCall(rpc, address, getSelector('getEntryCount()')) ||
    safeEthCall(rpc, address, getSelector('totalSupply()'))
  );

  return {
    isAlive: true,
    entryCount: countResult ? decodeUint256(countResult) : null,
  };
}

// ─── ETH balance reads ────────────────────────────────────────────────────────
export interface ChainBalance {
  chain: string;
  chainId: number;
  symbol: string;
  balance: string;
  balanceFormatted: string;
  color: string;
  error?: string;
}

export async function getEthBalance(rpcUrl: string, address: string): Promise<string> {
  try {
    const result = (await jsonRpc(rpcUrl, 'eth_getBalance', [address, 'latest'])) as string;
    return result;
  } catch {
    return '0x0';
  }
}

export function formatWei(hexWei: string): string {
  try {
    const wei = BigInt(hexWei);
    const eth = Number(wei) / 1e18;
    if (eth === 0) return '0.0000';
    if (eth < 0.0001) return '< 0.0001';
    return eth.toFixed(4);
  } catch {
    return '0.0000';
  }
}

export async function getAllBalances(address: string): Promise<ChainBalance[]> {
  const chains = [
    { key: 'eth', name: 'Ethereum', chainId: 1, rpc: 'https://eth.llamarpc.com', symbol: 'ETH', color: '#627EEA' },
    { key: 'base', name: 'Base', chainId: 8453, rpc: 'https://mainnet.base.org', symbol: 'ETH', color: '#00D9FF' },
    { key: 'avax', name: 'Avalanche', chainId: 43114, rpc: 'https://api.avax.network/ext/bc/C/rpc', symbol: 'AVAX', color: '#E84142' },
  ];

  const results = await Promise.all(
    chains.map(async (c) => {
      try {
        const hexBalance = await getEthBalance(c.rpc, address);
        return {
          chain: c.name,
          chainId: c.chainId,
          symbol: c.symbol,
          balance: hexBalance,
          balanceFormatted: formatWei(hexBalance),
          color: c.color,
        };
      } catch (error) {
        return {
          chain: c.name,
          chainId: c.chainId,
          symbol: c.symbol,
          balance: '0x0',
          balanceFormatted: '0.0000',
          color: c.color,
          error: error instanceof Error ? error.message : 'Failed',
        };
      }
    })
  );
  return results;
}
