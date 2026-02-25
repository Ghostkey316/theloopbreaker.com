/**
 * Embris Companion Tools — Server-Side Tool Execution
 * 
 * These are the REAL tools the companion agent can use.
 * Each tool makes actual HTTP/RPC calls and returns real data.
 * This runs server-side in the /api/companion/think route.
 * 
 * ARCHITECTURE:
 * - The LOCAL BRAIN (companion-brain.ts) is the primary intelligence
 * - These tools are invoked by the brain when it detects a task
 * - The OpenAI API is just ONE tool here — used for NLU, not as the brain
 * - Every result gets filtered through the companion's personality
 * 
 * TOOLS:
 * 1. check_balance — Multi-chain wallet balance via public RPCs
 * 2. get_gas_price — Current gas prices on any chain
 * 3. get_block_number — Latest block number
 * 4. get_token_price — Token prices from CoinGecko
 * 5. read_contract — Read Vaultfire contract state
 * 6. get_tx_history — Transaction history from block explorers
 * 7. check_chain_status — Chain connectivity and health
 * 8. web_search — Web search via DuckDuckGo instant answers
 * 9. llm_reasoning — Use LLM for complex NLU (tool, not brain)
 */

// ─── RPC Configuration ──────────────────────────────────────────────────────

const RPC_URLS: Record<string, string> = {
  base: 'https://mainnet.base.org',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  ethereum: 'https://eth.llamarpc.com',
};

const CHAIN_SYMBOLS: Record<string, string> = {
  base: 'ETH',
  avalanche: 'AVAX',
  ethereum: 'ETH',
};

const CHAIN_IDS: Record<string, number> = {
  base: 8453,
  avalanche: 43114,
  ethereum: 1,
};

const EXPLORER_APIS: Record<string, string> = {
  base: 'https://api.basescan.org/api',
  ethereum: 'https://api.etherscan.io/api',
  avalanche: 'https://api.snowtrace.io/api',
};

const EXPLORER_URLS: Record<string, string> = {
  base: 'https://basescan.org',
  avalanche: 'https://snowtrace.io',
  ethereum: 'https://etherscan.io',
};

// Vaultfire contract addresses for quick reference
const VAULTFIRE_CONTRACTS: Record<string, Record<string, string>> = {
  base: {
    MissionEnforcement: '0x8568F4020FCD55915dB3695558dD6D2532599e56',
    AntiSurveillance: '0x722E37A7D6f27896C688336AaaFb0dDA80D25E57',
    PrivacyGuarantees: '0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045',
    ERC8004IdentityRegistry: '0x35978DB675576598F0781dA2133E94cdCf4858bC',
    AIPartnershipBondsV2: '0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4',
    FlourishingMetricsOracle: '0x83dd216449B3F0574E39043ECFE275946fa492e9',
    AIAccountabilityBondsV2: '0xf92baef9523BC264144F80F9c31D5c5C017c6Da8',
    MultisigGovernance: '0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92',
    VaultfireTeleporterBridge: '0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2',
  },
  avalanche: {
    MissionEnforcement: '0xcf64D815F5424B7937aB226bC733Ed35ab6CaDcB',
    AIPartnershipBondsV2: '0xea6B504827a746d781f867441364C7A732AA4b07',
    VaultfireTeleporterBridge: '0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31',
  },
  ethereum: {
    MissionEnforcement: '0x0E777878C5b5248E1b52b09Ab5cdEb2eD6e7Da58',
    AIPartnershipBondsV2: '0x247F31bB2b5a0d28E68bf24865AA242965FF99cd',
    TrustDataBridge: '0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F',
  },
};

// Known function selectors for contract reads
const SELECTORS: Record<string, string> = {
  'owner()': '0x8da5cb5b',
  'paused()': '0x5c975abb',
  'totalSupply()': '0x18160ddd',
  'name()': '0x06fdde03',
  'version()': '0x54fd4d50',
  'threshold()': '0x42cde4e8',
  'getThreshold()': '0xe75235b8',
};

// ─── Tool Result Type ───────────────────────────────────────────────────────

export interface ToolResult {
  tool: string;
  success: boolean;
  data: any;
  executionMs: number;
  error?: string;
}

// ─── JSON-RPC Helper ────────────────────────────────────────────────────────

async function rpcCall(rpcUrl: string, method: string, params: unknown[] = []): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'RPC error');
    return data.result;
  } finally {
    clearTimeout(timeout);
  }
}

function formatWei(hexWei: string): string {
  try {
    const wei = BigInt(hexWei);
    if (wei === 0n) return '0.0000';
    // Use BigInt arithmetic to avoid precision loss for large balances
    const ethWhole = wei / BigInt(1e18);
    const remainder = wei % BigInt(1e18);
    // Get 4 decimal places without floating point precision loss
    const decimals = String(remainder * 10000n / BigInt(1e18)).padStart(4, '0').slice(0, 4);
    const result = `${ethWhole}.${decimals}`;
    if (result === '0.0000' && wei > 0n) return '< 0.0001';
    return result;
  } catch {
    return '0.0000';
  }
}

function formatGwei(hexWei: string): string {
  try {
    const wei = BigInt(hexWei);
    const gwei = Number(wei) / 1e9;
    return gwei.toFixed(2);
  } catch {
    return '0.00';
  }
}

// ─── TOOL 1: CHECK BALANCE ──────────────────────────────────────────────────

export async function toolCheckBalance(address: string, chain?: string): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!address || !address.startsWith('0x')) {
      return { tool: 'check_balance', success: false, data: null, executionMs: Date.now() - start, error: 'Invalid address' };
    }

    const chains = chain ? [chain] : ['ethereum', 'base', 'avalanche'];
    const results: { chain: string; symbol: string; balance: string; balanceRaw: string }[] = [];

    await Promise.all(chains.map(async (c) => {
      try {
        const rpc = RPC_URLS[c];
        if (!rpc) return;
        const hexBalance = await rpcCall(rpc, 'eth_getBalance', [address, 'latest']);
        results.push({
          chain: c,
          symbol: CHAIN_SYMBOLS[c] || 'ETH',
          balance: formatWei(hexBalance),
          balanceRaw: hexBalance,
        });
      } catch (e) {
        results.push({
          chain: c,
          symbol: CHAIN_SYMBOLS[c] || 'ETH',
          balance: 'error',
          balanceRaw: '0x0',
        });
      }
    }));

    return {
      tool: 'check_balance',
      success: true,
      data: { address, balances: results },
      executionMs: Date.now() - start,
    };
  } catch (e) {
    return { tool: 'check_balance', success: false, data: null, executionMs: Date.now() - start, error: String(e) };
  }
}

// ─── TOOL 2: GET GAS PRICE ─────────────────────────────────────────────────

export async function toolGetGasPrice(chain: string = 'base'): Promise<ToolResult> {
  const start = Date.now();
  try {
    const rpc = RPC_URLS[chain];
    if (!rpc) return { tool: 'get_gas_price', success: false, data: null, executionMs: Date.now() - start, error: `Unknown chain: ${chain}` };

    const hexGas = await rpcCall(rpc, 'eth_gasPrice', []);
    const gwei = formatGwei(hexGas);

    return {
      tool: 'get_gas_price',
      success: true,
      data: { chain, gasPriceGwei: gwei, gasPriceRaw: hexGas },
      executionMs: Date.now() - start,
    };
  } catch (e) {
    return { tool: 'get_gas_price', success: false, data: null, executionMs: Date.now() - start, error: String(e) };
  }
}

// ─── TOOL 3: GET BLOCK NUMBER ───────────────────────────────────────────────

export async function toolGetBlockNumber(chain: string = 'base'): Promise<ToolResult> {
  const start = Date.now();
  try {
    const rpc = RPC_URLS[chain];
    if (!rpc) return { tool: 'get_block_number', success: false, data: null, executionMs: Date.now() - start, error: `Unknown chain: ${chain}` };

    const hexBlock = await rpcCall(rpc, 'eth_blockNumber', []);
    const blockNumber = parseInt(hexBlock, 16);

    return {
      tool: 'get_block_number',
      success: true,
      data: { chain, blockNumber, blockHex: hexBlock },
      executionMs: Date.now() - start,
    };
  } catch (e) {
    return { tool: 'get_block_number', success: false, data: null, executionMs: Date.now() - start, error: String(e) };
  }
}

// ─── TOOL 4: GET TOKEN PRICE ────────────────────────────────────────────────

export async function toolGetTokenPrice(tokenId: string = 'ethereum'): Promise<ToolResult> {
  const start = Date.now();
  try {
    // Map common names to CoinGecko IDs
    const idMap: Record<string, string> = {
      eth: 'ethereum', ethereum: 'ethereum', ether: 'ethereum',
      btc: 'bitcoin', bitcoin: 'bitcoin',
      avax: 'avalanche-2', avalanche: 'avalanche-2',
      sol: 'solana', solana: 'solana',
      matic: 'matic-network', polygon: 'matic-network',
      link: 'chainlink', chainlink: 'chainlink',
      uni: 'uniswap', uniswap: 'uniswap',
      aave: 'aave',
      op: 'optimism', optimism: 'optimism',
      arb: 'arbitrum', arbitrum: 'arbitrum',
      base: 'ethereum', // Base uses ETH
    };

    const geckoId = idMap[tokenId.toLowerCase()] || tokenId.toLowerCase();
    
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) throw new Error(`CoinGecko API returned ${res.status}`);
    const data = await res.json();
    const priceData = data[geckoId];

    if (!priceData) {
      return { tool: 'get_token_price', success: false, data: null, executionMs: Date.now() - start, error: `Token "${tokenId}" not found on CoinGecko` };
    }

    return {
      tool: 'get_token_price',
      success: true,
      data: {
        token: geckoId,
        priceUsd: priceData.usd,
        change24h: priceData.usd_24h_change,
        marketCap: priceData.usd_market_cap,
      },
      executionMs: Date.now() - start,
    };
  } catch (e) {
    return { tool: 'get_token_price', success: false, data: null, executionMs: Date.now() - start, error: String(e) };
  }
}

// ─── TOOL 5: READ CONTRACT ─────────────────────────────────────────────────

export async function toolReadContract(chain: string, address: string, functionSig?: string): Promise<ToolResult> {
  const start = Date.now();
  try {
    const rpc = RPC_URLS[chain];
    if (!rpc) return { tool: 'read_contract', success: false, data: null, executionMs: Date.now() - start, error: `Unknown chain: ${chain}` };

    // Check if contract exists
    const code = await rpcCall(rpc, 'eth_getCode', [address, 'latest']);
    const isAlive = code && code !== '0x' && code !== '0x0' && code.length > 2;

    if (!isAlive) {
      return { tool: 'read_contract', success: true, data: { address, chain, isAlive: false, message: 'No contract code at this address' }, executionMs: Date.now() - start };
    }

    // Try to read common functions
    const reads: Record<string, string | null> = {};
    
    if (functionSig && SELECTORS[functionSig]) {
      try {
        const result = await rpcCall(rpc, 'eth_call', [{ to: address, data: SELECTORS[functionSig] }, 'latest']);
        reads[functionSig] = result;
      } catch { reads[functionSig] = null; }
    } else {
      // Read common functions
      for (const [sig, selector] of Object.entries(SELECTORS)) {
        try {
          const result = await rpcCall(rpc, 'eth_call', [{ to: address, data: selector }, 'latest']);
          if (result && result !== '0x') reads[sig] = result;
        } catch { /* skip */ }
      }
    }

    return {
      tool: 'read_contract',
      success: true,
      data: { address, chain, isAlive: true, reads, codeSize: code.length },
      executionMs: Date.now() - start,
    };
  } catch (e) {
    return { tool: 'read_contract', success: false, data: null, executionMs: Date.now() - start, error: String(e) };
  }
}

// ─── TOOL 6: GET TX HISTORY ─────────────────────────────────────────────────

export async function toolGetTxHistory(address: string, chain: string = 'base'): Promise<ToolResult> {
  const start = Date.now();
  try {
    const apiBase = EXPLORER_APIS[chain];
    const explorerUrl = EXPLORER_URLS[chain];
    const apiKey = process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || '';

    if (!apiBase) {
      return { tool: 'get_tx_history', success: false, data: null, executionMs: Date.now() - start, error: `No explorer API for chain: ${chain}` };
    }

    const url = `${apiBase}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc${apiKey ? `&apikey=${apiKey}` : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();

    if (data.status !== '1' || !data.result) {
      return {
        tool: 'get_tx_history',
        success: true,
        data: { address, chain, transactions: [], message: data.message || 'No transactions found', explorerLink: `${explorerUrl}/address/${address}` },
        executionMs: Date.now() - start,
      };
    }

    const txs = data.result.slice(0, 10).map((tx: any) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: formatWei('0x' + BigInt(tx.value).toString(16)),
      timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
      isError: tx.isError === '1',
      functionName: tx.functionName || '',
    }));

    return {
      tool: 'get_tx_history',
      success: true,
      data: { address, chain, transactions: txs, explorerLink: `${explorerUrl}/address/${address}` },
      executionMs: Date.now() - start,
    };
  } catch (e) {
    return { tool: 'get_tx_history', success: false, data: null, executionMs: Date.now() - start, error: String(e) };
  }
}

// ─── TOOL 7: CHECK CHAIN STATUS ─────────────────────────────────────────────

export async function toolCheckChainStatus(chain: string = 'base'): Promise<ToolResult> {
  const start = Date.now();
  try {
    const rpc = RPC_URLS[chain];
    if (!rpc) return { tool: 'check_chain_status', success: false, data: null, executionMs: Date.now() - start, error: `Unknown chain: ${chain}` };

    const [blockHex, chainHex, gasHex] = await Promise.all([
      rpcCall(rpc, 'eth_blockNumber', []),
      rpcCall(rpc, 'eth_chainId', []),
      rpcCall(rpc, 'eth_gasPrice', []),
    ]);

    return {
      tool: 'check_chain_status',
      success: true,
      data: {
        chain,
        blockNumber: parseInt(blockHex, 16),
        chainId: parseInt(chainHex, 16),
        gasPriceGwei: formatGwei(gasHex),
        latencyMs: Date.now() - start,
        status: 'online',
      },
      executionMs: Date.now() - start,
    };
  } catch (e) {
    return {
      tool: 'check_chain_status',
      success: true,
      data: { chain, status: 'offline', error: String(e) },
      executionMs: Date.now() - start,
    };
  }
}

// ─── TOOL 8: WEB SEARCH ────────────────────────────────────────────────────

export async function toolWebSearch(query: string): Promise<ToolResult> {
  const start = Date.now();
  try {
    // Use DuckDuckGo Instant Answer API (no API key needed)
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json();

    const results: { title: string; text: string; url: string }[] = [];

    // Abstract (main answer)
    if (data.Abstract) {
      results.push({
        title: data.Heading || 'Answer',
        text: data.Abstract,
        url: data.AbstractURL || '',
      });
    }

    // Related topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text) {
          results.push({
            title: topic.FirstURL?.split('/').pop()?.replace(/_/g, ' ') || 'Related',
            text: topic.Text,
            url: topic.FirstURL || '',
          });
        }
      }
    }

    // Answer (instant answer)
    if (data.Answer) {
      results.unshift({
        title: 'Instant Answer',
        text: data.Answer,
        url: '',
      });
    }

    return {
      tool: 'web_search',
      success: true,
      data: { query, results, resultCount: results.length },
      executionMs: Date.now() - start,
    };
  } catch (e) {
    return { tool: 'web_search', success: false, data: null, executionMs: Date.now() - start, error: String(e) };
  }
}

// ─── TOOL 9: LLM REASONING (tool, not brain) ───────────────────────────────

export async function toolLLMReasoning(prompt: string, context: string): Promise<ToolResult> {
  const start = Date.now();
  try {
    // Only use server-side env var — never expose NEXT_PUBLIC_ API keys in server routes
    const apiKey = process.env.OPENAI_API_KEY || '';
    const apiUrl = process.env.LLM_API_URL || process.env.NEXT_PUBLIC_LLM_API_URL || 'https://api.openai.com/v1/chat/completions';

    if (!apiKey) {
      return { tool: 'llm_reasoning', success: false, data: null, executionMs: Date.now() - start, error: 'No API key configured' };
    }

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: context },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2048,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return { tool: 'llm_reasoning', success: false, data: null, executionMs: Date.now() - start, error: `LLM API returned ${res.status}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;

    return {
      tool: 'llm_reasoning',
      success: !!content,
      data: { response: content || '' },
      executionMs: Date.now() - start,
    };
  } catch (e) {
    return { tool: 'llm_reasoning', success: false, data: null, executionMs: Date.now() - start, error: String(e) };
  }
}

// ─── INTENT DETECTION ───────────────────────────────────────────────────────

export type IntentType = 
  | 'check_balance'
  | 'gas_price'
  | 'token_price'
  | 'block_number'
  | 'chain_status'
  | 'read_contract'
  | 'tx_history'
  | 'web_search'
  | 'complex_question'
  | 'trust_score'
  | 'agent_info'
  | 'total_agents'
  | 'conversation';

export interface DetectedIntent {
  type: IntentType;
  confidence: number;
  params: Record<string, string>;
}

export function detectIntent(message: string): DetectedIntent[] {
  const lower = message.toLowerCase().trim();
  const intents: DetectedIntent[] = [];

  // Balance check
  if (/(?:check|show|get|what(?:'s| is)|my) (?:.*)?balance/i.test(lower) ||
      /how much (?:do i have|eth|avax|funds|money|crypto)/i.test(lower) ||
      /(?:wallet|account) (?:balance|funds)/i.test(lower)) {
    const addrMatch = lower.match(/0x[a-fA-F0-9]{40}/);
    const chainMatch = lower.match(/(base|ethereum|avalanche|eth|avax)/i);
    intents.push({
      type: 'check_balance',
      confidence: 0.95,
      params: {
        ...(addrMatch ? { address: addrMatch[0] } : {}),
        ...(chainMatch ? { chain: chainMatch[1].toLowerCase().replace('eth', 'ethereum').replace('avax', 'avalanche') } : {}),
      },
    });
  }

  // Gas price
  if (/(?:gas|gwei|gas price|gas fee|gas cost)/i.test(lower)) {
    const chainMatch = lower.match(/(base|ethereum|avalanche|eth|avax)/i);
    intents.push({
      type: 'gas_price',
      confidence: 0.9,
      params: {
        chain: chainMatch ? chainMatch[1].toLowerCase().replace('eth', 'ethereum').replace('avax', 'avalanche') : 'base',
      },
    });
  }

  // Token price
  if (/(?:price|worth|cost|value) (?:of |for )?(?:eth|btc|avax|sol|matic|link|uni|aave|op|arb|bitcoin|ethereum|solana|avalanche)/i.test(lower) ||
      /(?:eth|btc|avax|sol|matic|link|uni|aave|op|arb|bitcoin|ethereum|solana|avalanche) (?:price|worth|cost|value)/i.test(lower) ||
      /how much is (?:eth|btc|avax|sol|matic|link|uni|aave|op|arb|bitcoin|ethereum|solana|avalanche)/i.test(lower)) {
    const tokenMatch = lower.match(/(eth|btc|avax|sol|matic|link|uni|aave|op|arb|bitcoin|ethereum|solana|avalanche)/i);
    intents.push({
      type: 'token_price',
      confidence: 0.9,
      params: { token: tokenMatch ? tokenMatch[1].toLowerCase() : 'ethereum' },
    });
  }

  // Block number
  if (/(?:block|block number|latest block|current block)/i.test(lower) && !/blockchain/i.test(lower)) {
    const chainMatch = lower.match(/(base|ethereum|avalanche|eth|avax)/i);
    intents.push({
      type: 'block_number',
      confidence: 0.85,
      params: {
        chain: chainMatch ? chainMatch[1].toLowerCase().replace('eth', 'ethereum').replace('avax', 'avalanche') : 'base',
      },
    });
  }

  // Chain status
  if (/(?:chain|network|rpc) (?:status|health|alive|online|down|up)/i.test(lower) ||
      /is (?:base|ethereum|avalanche|eth|avax) (?:up|down|online|alive|working)/i.test(lower)) {
    const chainMatch = lower.match(/(base|ethereum|avalanche|eth|avax)/i);
    intents.push({
      type: 'chain_status',
      confidence: 0.9,
      params: {
        chain: chainMatch ? chainMatch[1].toLowerCase().replace('eth', 'ethereum').replace('avax', 'avalanche') : 'base',
      },
    });
  }

  // Contract read
  if (/(?:read|check|inspect|look at|show me) (?:.*)?contract/i.test(lower) ||
      /contract (?:state|data|status|info)/i.test(lower)) {
    const addrMatch = lower.match(/0x[a-fA-F0-9]{40}/);
    const chainMatch = lower.match(/(base|ethereum|avalanche)/i);
    const nameMatch = lower.match(/(mission|surveillance|privacy|identity|partnership|flourishing|accountability|reputation|validation|governance|bridge|attestation|dilithium|teleporter|adapter)/i);
    intents.push({
      type: 'read_contract',
      confidence: 0.85,
      params: {
        chain: chainMatch ? chainMatch[1].toLowerCase() : 'base',
        ...(addrMatch ? { address: addrMatch[0] } : {}),
        ...(nameMatch ? { name: nameMatch[1].toLowerCase() } : {}),
      },
    });
  }

  // Transaction history
  if (/(?:transaction|tx|txn) (?:history|list|recent|last)/i.test(lower) ||
      /(?:recent|last|latest) (?:transaction|tx|txn)/i.test(lower) ||
      /(?:show|get|check) (?:my )?(?:transaction|tx|txn)/i.test(lower)) {
    const addrMatch = lower.match(/0x[a-fA-F0-9]{40}/);
    const chainMatch = lower.match(/(base|ethereum|avalanche)/i);
    intents.push({
      type: 'tx_history',
      confidence: 0.85,
      params: {
        chain: chainMatch ? chainMatch[1].toLowerCase() : 'base',
        ...(addrMatch ? { address: addrMatch[0] } : {}),
      },
    });
  }

  // Web search
  if (/(?:search|look up|google|find|research) (?:for |about )?(.+)/i.test(lower) && intents.length === 0) {
    const queryMatch = lower.match(/(?:search|look up|google|find|research) (?:for |about )?(.+)/i);
    intents.push({
      type: 'web_search',
      confidence: 0.7,
      params: { query: queryMatch ? queryMatch[1] : message },
    });
  }
  // Vaultfire: Trust score lookup
  if (/(?:trust|score|grade|reputation|flourish|vaultfire|verify|check trust)/i.test(lower)) {
    const addrMatch = lower.match(/0x[a-fA-F0-9]{40}/);
    intents.push({
      type: 'trust_score',
      confidence: 0.9,
      params: { address: addrMatch ? addrMatch[0] : '' },
    });
  }
  // Vaultfire: Agent info lookup
  if (/(?:agent info|is (?:this |it )?registered|lookup agent|agent details|who is this agent)/i.test(lower)) {
    const addrMatch = lower.match(/0x[a-fA-F0-9]{40}/);
    intents.push({
      type: 'agent_info',
      confidence: 0.88,
      params: { address: addrMatch ? addrMatch[0] : '' },
    });
  }
  // Vaultfire: Total agents count
  if (/(?:how many agents|total agents|agent count|agents registered|how many (?:ai )?agents)/i.test(lower)) {
    intents.push({
      type: 'total_agents',
      confidence: 0.92,
      params: {},
    });
  }

  // If no specific intent detected, it's either a complex question or conversation
  if (intents.length === 0) {
    // Check if it's a question that needs reasoning
    if (/\?$/.test(lower) || /(?:what|how|why|when|where|who|explain|tell me|can you|could you)/i.test(lower)) {
      intents.push({
        type: 'complex_question',
        confidence: 0.6,
        params: { question: message },
      });
    } else {
      intents.push({
        type: 'conversation',
        confidence: 0.5,
        params: {},
      });
    }
  }

  return intents.sort((a, b) => b.confidence - a.confidence);
}

// ─── EXECUTE INTENTS ────────────────────────────────────────────────────────

export async function executeIntents(
  intents: DetectedIntent[],
  context: { userAddress?: string; companionAddress?: string }
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const intent of intents) {
    switch (intent.type) {
      case 'check_balance': {
        const addr = intent.params.address || context.userAddress;
        if (addr) {
          results.push(await toolCheckBalance(addr, intent.params.chain));
        } else {
          results.push({ tool: 'check_balance', success: false, data: null, executionMs: 0, error: 'No wallet address available. Connect your wallet first!' });
        }
        break;
      }
      case 'gas_price':
        results.push(await toolGetGasPrice(intent.params.chain));
        break;
      case 'token_price':
        results.push(await toolGetTokenPrice(intent.params.token));
        break;
      case 'block_number':
        results.push(await toolGetBlockNumber(intent.params.chain));
        break;
      case 'chain_status':
        results.push(await toolCheckChainStatus(intent.params.chain));
        break;
      case 'read_contract': {
        let addr = intent.params.address;
        if (!addr && intent.params.name) {
          // Try to find the contract by name
          const chain = intent.params.chain || 'base';
          const contracts = VAULTFIRE_CONTRACTS[chain] || {};
          for (const [name, address] of Object.entries(contracts)) {
            if (name.toLowerCase().includes(intent.params.name)) {
              addr = address;
              break;
            }
          }
        }
        if (addr) {
          results.push(await toolReadContract(intent.params.chain || 'base', addr, intent.params.function));
        } else {
          results.push({ tool: 'read_contract', success: false, data: null, executionMs: 0, error: 'No contract address specified' });
        }
        break;
      }
      case 'tx_history': {
        const addr = intent.params.address || context.userAddress;
        if (addr) {
          results.push(await toolGetTxHistory(addr, intent.params.chain));
        } else {
          results.push({ tool: 'get_tx_history', success: false, data: null, executionMs: 0, error: 'No address available' });
        }
        break;
      }
      case 'web_search':
        results.push(await toolWebSearch(intent.params.query));
        break;
      case 'trust_score': {
        const addr = intent.params.address || context.userAddress || '';
        if (addr) {
          results.push(await toolGetTrustScore(addr));
        } else {
          results.push({ tool: 'get_trust_score', success: false, data: null, executionMs: 0, error: 'No address provided. Please include an address like 0x...' });
        }
        break;
      }
      case 'agent_info': {
        const addr = intent.params.address || context.userAddress || '';
        if (addr) {
          results.push(await toolGetAgentInfo(addr));
        } else {
          results.push({ tool: 'get_agent_info', success: false, data: null, executionMs: 0, error: 'No address provided. Please include an address like 0x...' });
        }
        break;
      }
      case 'total_agents':
        results.push(await toolGetTotalAgents());
        break;
      default:
        break;
    }
  }
  return results;
}

// ─── FORMAT TOOL RESULTS FOR PERSONALITY LAYER ──────────────────────────────

export function formatToolResults(results: ToolResult[]): string {
  if (results.length === 0) return '';

  let formatted = '';

  for (const result of results) {
    if (!result.success) {
      formatted += `\n[Tool: ${result.tool}] Error: ${result.error || 'Unknown error'}`;
      continue;
    }

    switch (result.tool) {
      case 'check_balance': {
        const d = result.data;
        formatted += `\n**Wallet Balances** for \`${d.address.slice(0, 10)}...${d.address.slice(-6)}\`:\n`;
        for (const b of d.balances) {
          formatted += `- **${b.chain}**: ${b.balance} ${b.symbol}\n`;
        }
        formatted += `_Fetched in ${result.executionMs}ms via public RPCs_\n`;
        break;
      }
      case 'get_gas_price': {
        const d = result.data;
        formatted += `\n**Gas Price** on ${d.chain}: **${d.gasPriceGwei} Gwei**\n`;
        formatted += `_Fetched in ${result.executionMs}ms_\n`;
        break;
      }
      case 'get_token_price': {
        const d = result.data;
        const change = d.change24h ? (d.change24h > 0 ? `+${d.change24h.toFixed(2)}%` : `${d.change24h.toFixed(2)}%`) : 'N/A';
        formatted += `\n**${d.token.charAt(0).toUpperCase() + d.token.slice(1)}** Price: **$${d.priceUsd?.toLocaleString() || 'N/A'}**\n`;
        formatted += `24h Change: ${change}\n`;
        if (d.marketCap) formatted += `Market Cap: $${(d.marketCap / 1e9).toFixed(2)}B\n`;
        formatted += `_Fetched in ${result.executionMs}ms from CoinGecko_\n`;
        break;
      }
      case 'get_block_number': {
        const d = result.data;
        formatted += `\n**Latest Block** on ${d.chain}: **#${d.blockNumber.toLocaleString()}**\n`;
        formatted += `_Fetched in ${result.executionMs}ms_\n`;
        break;
      }
      case 'check_chain_status': {
        const d = result.data;
        if (d.status === 'online') {
          formatted += `\n**${d.chain}** is **online**!\n`;
          formatted += `- Block: #${d.blockNumber?.toLocaleString()}\n`;
          formatted += `- Chain ID: ${d.chainId}\n`;
          formatted += `- Gas: ${d.gasPriceGwei} Gwei\n`;
          formatted += `- Latency: ${d.latencyMs}ms\n`;
        } else {
          formatted += `\n**${d.chain}** appears to be **offline** or unreachable.\n`;
        }
        break;
      }
      case 'read_contract': {
        const d = result.data;
        formatted += `\n**Contract** \`${d.address.slice(0, 10)}...${d.address.slice(-6)}\` on ${d.chain}:\n`;
        formatted += `- Status: ${d.isAlive ? '**Live**' : '**Not found**'}\n`;
        if (d.reads && Object.keys(d.reads).length > 0) {
          for (const [fn, val] of Object.entries(d.reads)) {
            formatted += `- ${fn}: ${val}\n`;
          }
        }
        formatted += `_Fetched in ${result.executionMs}ms_\n`;
        break;
      }
      case 'get_tx_history': {
        const d = result.data;
        formatted += `\n**Recent Transactions** for \`${d.address.slice(0, 10)}...${d.address.slice(-6)}\` on ${d.chain}:\n`;
        if (d.transactions.length === 0) {
          formatted += `No recent transactions found.\n`;
        } else {
          for (const tx of d.transactions.slice(0, 5)) {
            const dir = tx.from.toLowerCase() === d.address.toLowerCase() ? 'OUT' : 'IN';
            formatted += `- [${dir}] ${tx.value} ETH · ${tx.timestamp.split('T')[0]} · \`${tx.hash.slice(0, 10)}...\`\n`;
          }
        }
        formatted += `[View on Explorer](${d.explorerLink})\n`;
        formatted += `_Fetched in ${result.executionMs}ms_\n`;
        break;
      }
      case 'web_search': {
        const d = result.data;
        formatted += `\n**Search Results** for "${d.query}":\n`;
        if (d.results.length === 0) {
          formatted += `No results found.\n`;
        } else {
          for (const r of d.results.slice(0, 3)) {
            formatted += `- **${r.title}**: ${r.text.slice(0, 200)}${r.text.length > 200 ? '...' : ''}\n`;
            if (r.url) formatted += `  [Source](${r.url})\n`;
          }
        }
        formatted += `_Fetched in ${result.executionMs}ms_\n`;
        break;
      }
      case 'get_trust_score': {
        formatted += formatVaultfireToolResult(result);
        break;
      }
      case 'get_agent_info': {
        formatted += formatVaultfireToolResult(result);
        break;
      }
      case 'get_total_agents': {
        formatted += formatVaultfireToolResult(result);
        break;
      }
      default:
        formatted += `\n[${result.tool}]: ${JSON.stringify(result.data)}\n`;
    }
  }
  return formatted;
}

// ─── TOOL 10: GET TRUST SCORE (Vaultfire-specific) ──────────────────────────────

const VAULTFIRE_IDENTITY_BASE = '0x35978DB675576598F0781dA2133E94cdCf4858bC';
const VAULTFIRE_REPUTATION_BASE = '0xdB54B8925664816187646174bdBb6Ac658A55a5F';
const VAULTFIRE_FLOURISHING_BASE = '0x83dd216449B3F0574E39043ECFE275946fa492e9';

export async function toolGetTrustScore(address: string): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!address || !address.startsWith('0x')) {
      return { tool: 'get_trust_score', success: false, data: null, executionMs: Date.now() - start, error: 'Invalid address' };
    }

    // Check if registered on ERC8004IdentityRegistry
    const getAgentData = '0xfb3551ff' + address.replace('0x', '').toLowerCase().padStart(64, '0');
    const [agentResult, totalAgents] = await Promise.all([
      rpcCall(RPC_URLS.base, 'eth_call', [{ to: VAULTFIRE_IDENTITY_BASE, data: getAgentData }, 'latest']),
      rpcCall(RPC_URLS.base, 'eth_call', [{ to: VAULTFIRE_IDENTITY_BASE, data: '0x3731a16f' }, 'latest']),
    ]);

    const isRegistered = agentResult && agentResult.length > 66 && agentResult !== '0x' + '0'.repeat(64);
    const totalCount = totalAgents ? parseInt(totalAgents, 16) : 0;

    // Try to get reputation score (0x5e5c06e2 = getReputationScore(address))
    let reputationScore = 0;
    try {
      const repData = '0x5e5c06e2' + address.replace('0x', '').toLowerCase().padStart(64, '0');
      const repResult = await rpcCall(RPC_URLS.base, 'eth_call', [{ to: VAULTFIRE_REPUTATION_BASE, data: repData }, 'latest']);
      if (repResult && repResult !== '0x') {
        reputationScore = Math.min(parseInt(repResult, 16), 100);
      }
    } catch { /* contract may not have data */ }

    // Try to get flourishing metrics (0x7a0ed627 = getMetrics(address))
    let flourishingScore = 0;
    try {
      const metData = '0x7a0ed627' + address.replace('0x', '').toLowerCase().padStart(64, '0');
      const metResult = await rpcCall(RPC_URLS.base, 'eth_call', [{ to: VAULTFIRE_FLOURISHING_BASE, data: metData }, 'latest']);
      if (metResult && metResult.length > 66) {
        const a = parseInt(metResult.slice(2, 66), 16);
        const w = parseInt(metResult.slice(66, 130), 16);
        const f = parseInt(metResult.slice(130, 194), 16);
        const t = parseInt(metResult.slice(194, 258), 16);
        flourishingScore = Math.min(Math.round((a + w + f + t) / 4), 100);
      }
    } catch { /* contract may not have data */ }

    const trustScore = Math.round(reputationScore * 0.4 + flourishingScore * 0.6);
    const grade = trustScore >= 90 ? 'A+' : trustScore >= 80 ? 'A' : trustScore >= 70 ? 'B+' :
      trustScore >= 60 ? 'B' : trustScore >= 50 ? 'C' : trustScore >= 40 ? 'D' : 'F';

    return {
      tool: 'get_trust_score',
      success: true,
      data: {
        address,
        isRegistered,
        trustScore,
        grade,
        reputationScore,
        flourishingScore,
        totalAgentsOnBase: totalCount,
        explorerLink: `https://basescan.org/address/${address}`,
      },
      executionMs: Date.now() - start,
    };
  } catch (e) {
    return { tool: 'get_trust_score', success: false, data: null, executionMs: Date.now() - start, error: String(e) };
  }
}

// ─── TOOL 11: GET AGENT INFO (Vaultfire-specific) ──────────────────────────

export async function toolGetAgentInfo(address: string): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (!address || !address.startsWith('0x')) {
      return { tool: 'get_agent_info', success: false, data: null, executionMs: Date.now() - start, error: 'Invalid address' };
    }

    const getAgentData = '0xfb3551ff' + address.replace('0x', '').toLowerCase().padStart(64, '0');
    const agentResult = await rpcCall(RPC_URLS.base, 'eth_call', [{ to: VAULTFIRE_IDENTITY_BASE, data: getAgentData }, 'latest']);

    const isRegistered = agentResult && agentResult.length > 66 && agentResult !== '0x' + '0'.repeat(64);

    // Try to decode agent name from ABI-encoded result (first string field)
    let agentName = 'Unknown';
    if (isRegistered && agentResult.length > 130) {
      try {
        // ABI-encoded struct: first field is usually a string offset
        const nameOffset = parseInt(agentResult.slice(2, 66), 16) * 2;
        const nameLen = parseInt(agentResult.slice(2 + nameOffset, 66 + nameOffset), 16);
        if (nameLen > 0 && nameLen < 200) {
          const nameHex = agentResult.slice(66 + nameOffset, 66 + nameOffset + nameLen * 2);
          agentName = Buffer.from(nameHex, 'hex').toString('utf8').replace(/\0/g, '').trim() || 'Unknown';
        }
      } catch { /* decoding failed, use Unknown */ }
    }

    return {
      tool: 'get_agent_info',
      success: true,
      data: {
        address,
        isRegistered,
        agentName: isRegistered ? agentName : null,
        registryAddress: VAULTFIRE_IDENTITY_BASE,
        chain: 'base',
        explorerLink: `https://basescan.org/address/${address}`,
        registryLink: `https://basescan.org/address/${VAULTFIRE_IDENTITY_BASE}`,
      },
      executionMs: Date.now() - start,
    };
  } catch (e) {
    return { tool: 'get_agent_info', success: false, data: null, executionMs: Date.now() - start, error: String(e) };
  }
}

// ─── TOOL 12: GET TOTAL AGENTS (Vaultfire-specific) ────────────────────────

export async function toolGetTotalAgents(): Promise<ToolResult> {
  const start = Date.now();
  try {
    const chains = [
      { name: 'base', rpc: RPC_URLS.base, registry: VAULTFIRE_IDENTITY_BASE },
      { name: 'avalanche', rpc: RPC_URLS.avalanche, registry: '0x57741F4116925341d8f7Eb3F381d98e07C73B4a3' },
      { name: 'ethereum', rpc: RPC_URLS.ethereum, registry: '0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C' },
    ];

    const results = await Promise.all(
      chains.map(async (c) => {
        try {
          const result = await rpcCall(c.rpc, 'eth_call', [{ to: c.registry, data: '0x3731a16f' }, 'latest']);
          return { chain: c.name, count: result ? parseInt(result, 16) : 0 };
        } catch {
          return { chain: c.name, count: 0 };
        }
      })
    );

    const total = results.reduce((sum, r) => sum + r.count, 0);

    return {
      tool: 'get_total_agents',
      success: true,
      data: { chains: results, total },
      executionMs: Date.now() - start,
    };
  } catch (e) {
    return { tool: 'get_total_agents', success: false, data: null, executionMs: Date.now() - start, error: String(e) };
  }
}

// ─── FORMAT TOOL RESULTS for Vaultfire-specific tools ──────────────────────────────
export function formatVaultfireToolResult(result: ToolResult): string {
  switch (result.tool) {
    case 'get_trust_score': {
      const d = result.data;
      if (!d.isRegistered) {
        return `\n**Trust Score** for \`${d.address.slice(0, 10)}...${d.address.slice(-6)}\`:\n` +
          `- Status: **Not registered** on Vaultfire Protocol\n` +
          `- Trust Score: N/A (register first via the Identity section)\n` +
          `- Total agents on Base: ${d.totalAgentsOnBase}\n` +
          `[View on BaseScan](${d.explorerLink})\n`;
      }
      return `\n**Trust Score** for \`${d.address.slice(0, 10)}...${d.address.slice(-6)}\`:\n` +
        `- **Score: ${d.trustScore}/100 (Grade: ${d.grade})**\n` +
        `- Reputation: ${d.reputationScore}/100\n` +
        `- Flourishing: ${d.flourishingScore}/100\n` +
        `- Status: ✅ Registered on Vaultfire\n` +
        `[View on BaseScan](${d.explorerLink})\n` +
        `_Fetched in ${result.executionMs}ms_\n`;
    }
    case 'get_agent_info': {
      const d = result.data;
      if (!d.isRegistered) {
        return `\n**Agent Info** for \`${d.address.slice(0, 10)}...${d.address.slice(-6)}\`:\n` +
          `- Status: **Not registered** on Vaultfire\n` +
          `- To register, go to the **Identity** section and click Register.\n`;
      }
      return `\n**Agent Info** for \`${d.address.slice(0, 10)}...${d.address.slice(-6)}\`:\n` +
        `- Status: ✅ **Registered**\n` +
        `- Name: ${d.agentName || 'Unknown'}\n` +
        `- Chain: ${d.chain}\n` +
        `[View on BaseScan](${d.explorerLink})\n` +
        `_Fetched in ${result.executionMs}ms_\n`;
    }
    case 'get_total_agents': {
      const d = result.data;
      let out = `\n**Vaultfire Protocol — Registered Agents:**\n`;
      for (const c of d.chains) {
        out += `- **${c.chain}**: ${c.count} agent${c.count !== 1 ? 's' : ''}\n`;
      }
      out += `- **Total across all chains**: ${d.total}\n`;
      out += `_Fetched in ${result.executionMs}ms_\n`;
      return out;
    }
    default:
      return '';
  }
}
