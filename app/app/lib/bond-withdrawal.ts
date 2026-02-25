/**
 * Vaultfire Bond Withdrawal Module
 *
 * Wires the "Withdraw All" button to real AIAccountabilityBondsV2 contract
 * functions: requestDistribution(bondId) and distributeBond(bondId).
 *
 * Flow:
 *   1. Find user's bond IDs via getBondsByParticipant(address)
 *   2. Check bond status via getBond(bondId)
 *   3. Call requestDistribution(bondId) — starts the timelock
 *   4. After DISTRIBUTION_TIMELOCK, call distributeBond(bondId) — releases funds
 *
 * Contract addresses:
 *   Base:      0xf92baef9523BC264144F80F9c31D5c5C017c6Da8
 *   Avalanche: 0xaeFEa985E0C52f92F73606657B9dA60db2798af3
 *   Ethereum:  0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24
 *
 * SECURITY: Private keys are NEVER written to disk.
 */

import { RPC_URLS, ACCOUNTABILITY_BONDS, EXPLORER_URLS, type SupportedChain } from './contracts';
import { getSessionPrivateKey, getWalletAddress, isWalletUnlocked } from './wallet';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserBond {
  bondId: number;
  stakeAmount: string;
  stakeFormatted: string;
  active: boolean;
  chain: SupportedChain;
  contractAddress: string;
  distributionRequested: boolean;
  canDistribute: boolean;
}

export interface WithdrawalStep {
  step: number;
  totalSteps: number;
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

export interface WithdrawalResult {
  success: boolean;
  steps: WithdrawalStep[];
  totalWithdrawn: string;
  error?: string;
}

// ─── Selectors ────────────────────────────────────────────────────────────────

const SELECTORS = {
  getBondsByParticipantCount: '0x67ff6265',
  getBondsByParticipant: '0xde4c4e4c',
  getBond: '0xd8fe7642',
  requestDistribution: '0x', // Will use ethers ABI encoding
  distributeBond: '0x',
};

// ─── JSON-RPC ─────────────────────────────────────────────────────────────────

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: Date.now(),
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result ?? '0x';
  } finally {
    clearTimeout(timeout);
  }
}

function formatWei(wei: string): string {
  const n = BigInt(wei);
  if (n === 0n) return '0';
  const whole = n / 10n ** 18n;
  const frac = n % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, '0').slice(0, 6);
  return `${whole}.${fracStr.replace(/0+$/, '') || '0'}`;
}

// ─── Bond Discovery ───────────────────────────────────────────────────────────

/**
 * Find all bonds for the current user across all chains.
 */
export async function getUserBonds(): Promise<UserBond[]> {
  const address = getWalletAddress();
  if (!address) return [];

  const chains: SupportedChain[] = ['base', 'avalanche', 'ethereum'];
  const allBonds: UserBond[] = [];

  for (const chain of chains) {
    const contractAddress = ACCOUNTABILITY_BONDS[chain];
    const rpc = RPC_URLS[chain];
    const paddedAddr = address.replace('0x', '').toLowerCase().padStart(64, '0');

    try {
      // Step 1: Get bond count
      const countResult = await ethCall(rpc, contractAddress,
        SELECTORS.getBondsByParticipantCount + paddedAddr);
      const bondCount = countResult && countResult !== '0x' && countResult.length > 2
        ? Number(BigInt(countResult))
        : 0;

      if (bondCount === 0) continue;

      // Step 2: Get bond IDs
      const bondsResult = await ethCall(rpc, contractAddress,
        SELECTORS.getBondsByParticipant + paddedAddr);
      if (!bondsResult || bondsResult === '0x' || bondsResult.length < 130) continue;

      const raw = bondsResult.slice(2);
      const arrayLength = Number(BigInt('0x' + raw.slice(64, 128)));

      for (let i = 0; i < Math.min(arrayLength, 10); i++) {
        const bondIdBig = BigInt('0x' + raw.slice(128 + i * 64, 192 + i * 64));
        const bondId = Number(bondIdBig);

        // Step 3: Get bond details
        const bondIdPadded = bondIdBig.toString(16).padStart(64, '0');
        const bondResult = await ethCall(rpc, contractAddress,
          SELECTORS.getBond + bondIdPadded);

        if (!bondResult || bondResult === '0x' || bondResult.length < 642) continue;

        const bondRaw = bondResult.slice(2);
        const stakeHex = bondRaw.slice(5 * 64, 6 * 64);
        const activeHex = bondRaw.slice(9 * 64, 10 * 64);

        const stakeAmount = stakeHex.length === 64 ? BigInt('0x' + stakeHex).toString() : '0';
        const active = activeHex.length === 64 ? BigInt('0x' + activeHex) === 1n : false;

        if (BigInt(stakeAmount) > 0n) {
          allBonds.push({
            bondId,
            stakeAmount,
            stakeFormatted: formatWei(stakeAmount),
            active,
            chain,
            contractAddress,
            distributionRequested: false, // Will be checked during withdrawal
            canDistribute: false,
          });
        }
      }
    } catch {
      // Chain query failed — skip
    }
  }

  return allBonds;
}

// ─── Withdrawal Execution ─────────────────────────────────────────────────────

/**
 * Execute the full withdrawal flow for a specific bond.
 *
 * Steps:
 *   1. Verify bond exists and is active
 *   2. Call requestDistribution(bondId) — starts timelock
 *   3. Wait for timelock (or check if already elapsed)
 *   4. Call distributeBond(bondId) — releases funds
 */
export async function withdrawBond(
  bond: UserBond,
  onStep?: (step: WithdrawalStep) => void,
): Promise<WithdrawalResult> {
  const steps: WithdrawalStep[] = [];

  if (!isWalletUnlocked()) {
    return {
      success: false,
      steps: [],
      totalWithdrawn: '0',
      error: 'Wallet is locked. Please unlock with your password first.',
    };
  }

  const pk = getSessionPrivateKey();
  if (!pk) {
    return { success: false, steps: [], totalWithdrawn: '0', error: 'No session key available.' };
  }

  const address = getWalletAddress();
  if (!address) {
    return { success: false, steps: [], totalWithdrawn: '0', error: 'No wallet address found.' };
  }

  try {
    const { ethers } = await import('ethers');
    const rpc = RPC_URLS[bond.chain];
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(pk, provider);
    const explorerBase = EXPLORER_URLS[bond.chain];

    // AIAccountabilityBondsV2 ABI
    const iface = new ethers.Interface([
      'function requestDistribution(uint256 bondId)',
      'function distributeBond(uint256 bondId)',
      'function getDistributionRequest(uint256 bondId) view returns (uint256 requestTime, bool executed)',
      'function DISTRIBUTION_TIMELOCK() view returns (uint256)',
    ]);

    // Step 1: Check distribution request status
    const step1: WithdrawalStep = {
      step: 1, totalSteps: 3,
      description: `Checking bond #${bond.bondId} distribution status on ${bond.chain}...`,
      status: 'executing',
    };
    steps.push(step1);
    onStep?.(step1);

    let distributionRequested = false;
    let canDistribute = false;
    let timelockSeconds = 86400; // Default 24h

    try {
      // Check timelock duration
      const timelockData = iface.encodeFunctionData('DISTRIBUTION_TIMELOCK');
      const timelockResult = await ethCall(rpc, bond.contractAddress, timelockData);
      if (timelockResult && timelockResult !== '0x') {
        timelockSeconds = Number(BigInt(timelockResult));
      }
    } catch { /* use default */ }

    try {
      // Check if distribution already requested
      const distReqData = iface.encodeFunctionData('getDistributionRequest', [bond.bondId]);
      const distReqResult = await ethCall(rpc, bond.contractAddress, distReqData);
      if (distReqResult && distReqResult !== '0x' && distReqResult.length >= 130) {
        const raw = distReqResult.slice(2);
        const requestTime = BigInt('0x' + raw.slice(0, 64));
        const executed = BigInt('0x' + raw.slice(64, 128)) === 1n;

        if (requestTime > 0n && !executed) {
          distributionRequested = true;
          const elapsed = Math.floor(Date.now() / 1000) - Number(requestTime);
          canDistribute = elapsed >= timelockSeconds;
        }
      }
    } catch { /* distribution request check not available */ }

    step1.status = 'completed';
    step1.description = distributionRequested
      ? `Distribution already requested for bond #${bond.bondId}. ${canDistribute ? 'Timelock elapsed — ready to distribute.' : `Timelock active (${timelockSeconds}s).`}`
      : `Bond #${bond.bondId} ready for distribution request.`;
    onStep?.(step1);

    // Step 2: Request distribution (if not already requested)
    if (!distributionRequested) {
      const step2: WithdrawalStep = {
        step: 2, totalSteps: 3,
        description: `Requesting distribution for bond #${bond.bondId} (${bond.stakeFormatted} ETH)...`,
        status: 'executing',
      };
      steps.push(step2);
      onStep?.(step2);

      try {
        const txData = iface.encodeFunctionData('requestDistribution', [bond.bondId]);
        const txResponse = await wallet.sendTransaction({
          to: bond.contractAddress,
          data: txData,
          gasLimit: 150000n,
        });

        step2.txHash = txResponse.hash;
        step2.explorerUrl = `${explorerBase}/tx/${txResponse.hash}`;
        step2.description = `Distribution requested! Tx: ${txResponse.hash.slice(0, 12)}...`;
        onStep?.(step2);

        await txResponse.wait(1);
        step2.status = 'completed';
        step2.description = `Distribution request confirmed for bond #${bond.bondId}. Timelock: ${timelockSeconds}s.`;
        onStep?.(step2);

        // After requesting, timelock starts — cannot distribute immediately
        return {
          success: true,
          steps,
          totalWithdrawn: '0',
          error: `Distribution requested successfully. Funds will be available after the ${timelockSeconds}-second timelock period. Come back to call "Distribute" after the timelock.`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        step2.status = 'failed';
        step2.error = msg;
        onStep?.(step2);
        return { success: false, steps, totalWithdrawn: '0', error: msg };
      }
    }

    // Step 3: Distribute bond (if timelock elapsed)
    if (canDistribute) {
      const step3: WithdrawalStep = {
        step: 3, totalSteps: 3,
        description: `Distributing bond #${bond.bondId} (${bond.stakeFormatted} ETH)...`,
        status: 'executing',
      };
      steps.push(step3);
      onStep?.(step3);

      try {
        const txData = iface.encodeFunctionData('distributeBond', [bond.bondId]);
        const txResponse = await wallet.sendTransaction({
          to: bond.contractAddress,
          data: txData,
          gasLimit: 200000n,
        });

        step3.txHash = txResponse.hash;
        step3.explorerUrl = `${explorerBase}/tx/${txResponse.hash}`;
        step3.description = `Distribution tx sent: ${txResponse.hash.slice(0, 12)}...`;
        onStep?.(step3);

        await txResponse.wait(1);
        step3.status = 'completed';
        step3.description = `Bond #${bond.bondId} distributed! ${bond.stakeFormatted} ETH released.`;
        onStep?.(step3);

        return {
          success: true,
          steps,
          totalWithdrawn: bond.stakeFormatted,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Distribution failed';
        step3.status = 'failed';
        step3.error = msg;
        onStep?.(step3);
        return { success: false, steps, totalWithdrawn: '0', error: msg };
      }
    } else {
      // Timelock not elapsed yet
      return {
        success: true,
        steps,
        totalWithdrawn: '0',
        error: `Distribution requested but timelock has not elapsed yet. Please wait for the ${timelockSeconds}-second timelock period to complete, then click "Withdraw All" again to distribute.`,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Withdrawal failed';
    return { success: false, steps, totalWithdrawn: '0', error: msg };
  }
}

/**
 * Withdraw all bonds across all chains.
 */
export async function withdrawAllBonds(
  onStep?: (step: WithdrawalStep) => void,
): Promise<WithdrawalResult> {
  const bonds = await getUserBonds();
  const activeBonds = bonds.filter(b => b.active);

  if (activeBonds.length === 0) {
    return {
      success: false,
      steps: [],
      totalWithdrawn: '0',
      error: 'No active bonds found to withdraw. Bond earnings accumulate via x402 payments and bond distributions from AIAccountabilityBondsV2.',
    };
  }

  const allSteps: WithdrawalStep[] = [];
  let totalWithdrawnWei = 0n;

  for (const bond of activeBonds) {
    const result = await withdrawBond(bond, (step) => {
      onStep?.(step);
    });
    allSteps.push(...result.steps);
    if (result.totalWithdrawn !== '0') {
      try {
        const parts = result.totalWithdrawn.split('.');
        const whole = BigInt(parts[0]) * 10n ** 18n;
        const frac = parts[1] ? BigInt(parts[1].padEnd(18, '0').slice(0, 18)) : 0n;
        totalWithdrawnWei += whole + frac;
      } catch { /* ignore parse error */ }
    }
  }

  return {
    success: allSteps.some(s => s.status === 'completed'),
    steps: allSteps,
    totalWithdrawn: formatWei(totalWithdrawnWei.toString()),
  };
}
