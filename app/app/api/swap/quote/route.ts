/**
 * /api/swap/quote — Fetches real swap quotes from ParaSwap API.
 *
 * ParaSwap is free, no API key required, supports Base, Avalanche, Ethereum.
 * Falls back to CoinGecko price feed for display prices.
 */
import { NextRequest, NextResponse } from 'next/server';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  avalanche: 43114,
};

// Well-known token addresses per chain
const TOKENS: Record<string, Record<string, { address: string; decimals: number; symbol: string }>> = {
  ethereum: {
    ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18, symbol: 'ETH' },
    WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, symbol: 'WETH' },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, symbol: 'USDC' },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, symbol: 'USDT' },
  },
  base: {
    ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18, symbol: 'ETH' },
    WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18, symbol: 'WETH' },
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, symbol: 'USDC' },
    USDbC: { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6, symbol: 'USDbC' },
  },
  avalanche: {
    AVAX: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18, symbol: 'AVAX' },
    WAVAX: { address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', decimals: 18, symbol: 'WAVAX' },
    USDC: { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, symbol: 'USDC' },
    'USDC.e': { address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', decimals: 6, symbol: 'USDC.e' },
  },
};

async function getParaSwapQuote(
  chainId: number,
  srcToken: string,
  destToken: string,
  srcDecimals: number,
  destDecimals: number,
  amount: string,
  userAddress: string,
) {
  const url = new URL('https://apiv5.paraswap.io/prices');
  url.searchParams.set('srcToken', srcToken);
  url.searchParams.set('destToken', destToken);
  url.searchParams.set('amount', amount);
  url.searchParams.set('srcDecimals', srcDecimals.toString());
  url.searchParams.set('destDecimals', destDecimals.toString());
  url.searchParams.set('side', 'SELL');
  url.searchParams.set('network', chainId.toString());
  url.searchParams.set('userAddress', userAddress);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `ParaSwap API error: ${res.status} ${text}` };
    }
    return await res.json();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to fetch quote' };
  } finally {
    clearTimeout(timeout);
  }
}

async function getParaSwapTxData(
  chainId: number,
  priceRoute: Record<string, unknown>,
  srcToken: string,
  destToken: string,
  srcAmount: string,
  destAmount: string,
  userAddress: string,
  slippage: number,
) {
  const url = `https://apiv5.paraswap.io/transactions/${chainId}`;
  const body = {
    srcToken,
    destToken,
    srcAmount,
    destAmount,
    priceRoute,
    userAddress,
    partner: 'vaultfire',
    slippage: slippage * 100, // basis points
    deadline: Math.floor(Date.now() / 1000) + 600, // 10 min
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `ParaSwap tx build error: ${res.status} ${text}` };
    }
    return await res.json();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to build transaction' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get('chain') || 'base';
  const fromSymbol = searchParams.get('from') || 'ETH';
  const toSymbol = searchParams.get('to') || 'USDC';
  const amount = searchParams.get('amount') || '1';
  const userAddress = searchParams.get('userAddress') || '0x0000000000000000000000000000000000000000';
  const slippage = parseFloat(searchParams.get('slippage') || '0.5');

  const chainId = CHAIN_IDS[chain];
  if (!chainId) {
    return NextResponse.json({ error: `Unsupported chain: ${chain}` }, { status: 400 });
  }

  const chainTokens = TOKENS[chain];
  if (!chainTokens) {
    return NextResponse.json({ error: `No tokens configured for ${chain}` }, { status: 400 });
  }

  const fromToken = chainTokens[fromSymbol];
  const toToken = chainTokens[toSymbol];
  if (!fromToken) {
    return NextResponse.json({ error: `Unknown token: ${fromSymbol} on ${chain}` }, { status: 400 });
  }
  if (!toToken) {
    return NextResponse.json({ error: `Unknown token: ${toSymbol} on ${chain}` }, { status: 400 });
  }

  // Convert amount to smallest unit
  const amountInSmallest = BigInt(Math.floor(parseFloat(amount) * (10 ** fromToken.decimals))).toString();

  const quote = await getParaSwapQuote(
    chainId,
    fromToken.address,
    toToken.address,
    fromToken.decimals,
    toToken.decimals,
    amountInSmallest,
    userAddress,
  );

  if (quote.error) {
    return NextResponse.json({
      error: quote.error,
      fromToken,
      toToken,
      chain,
      chainId,
      amount,
    }, { status: 502 });
  }

  // Extract useful data from ParaSwap response
  const priceRoute = quote.priceRoute;
  const destAmount = priceRoute?.destAmount || '0';
  const destAmountFormatted = (Number(destAmount) / (10 ** toToken.decimals)).toFixed(toToken.decimals === 6 ? 2 : 6);
  const srcAmountFormatted = amount;

  // Calculate effective rate
  const rate = parseFloat(destAmountFormatted) / parseFloat(srcAmountFormatted);

  return NextResponse.json({
    success: true,
    chain,
    chainId,
    from: {
      symbol: fromToken.symbol,
      address: fromToken.address,
      decimals: fromToken.decimals,
      amount: srcAmountFormatted,
      amountRaw: amountInSmallest,
    },
    to: {
      symbol: toToken.symbol,
      address: toToken.address,
      decimals: toToken.decimals,
      amount: destAmountFormatted,
      amountRaw: destAmount,
    },
    rate: rate.toFixed(6),
    slippage,
    priceRoute,
    // Include gas estimate if available
    gasCost: priceRoute?.gasCost || null,
    gasCostUSD: priceRoute?.gasCostUSD || null,
    source: 'ParaSwap',
  });
}

export async function POST(req: NextRequest) {
  // Build transaction data for execution
  const body = await req.json();
  const { chain, from, to, amount, userAddress, slippage, priceRoute } = body;

  if (!chain || !from || !to || !amount || !userAddress || !priceRoute) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const chainId = CHAIN_IDS[chain];
  const chainTokens = TOKENS[chain];
  const fromToken = chainTokens?.[from];
  const toToken = chainTokens?.[to];

  if (!chainId || !fromToken || !toToken) {
    return NextResponse.json({ error: 'Invalid chain or token' }, { status: 400 });
  }

  const srcAmount = BigInt(Math.floor(parseFloat(amount) * (10 ** fromToken.decimals))).toString();
  const destAmount = priceRoute.destAmount;

  const txData = await getParaSwapTxData(
    chainId,
    priceRoute,
    fromToken.address,
    toToken.address,
    srcAmount,
    destAmount,
    userAddress,
    slippage || 0.5,
  );

  if (txData.error) {
    return NextResponse.json({ error: txData.error }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    tx: {
      to: txData.to,
      data: txData.data,
      value: txData.value || '0',
      gasLimit: txData.gas || '300000',
      chainId,
    },
    source: 'ParaSwap',
  });
}
