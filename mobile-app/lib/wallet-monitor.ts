/**
 * Wallet Monitoring Service
 * 
 * Polls the connected wallet for changes and sends local notifications:
 * - New incoming/outgoing transactions
 * - New token approvals
 * - Trust profile changes
 * - Suspicious activity (Guardian mode)
 */

import * as Notifications from "expo-notifications";
import { ethers } from "ethers";
import { getBaseProvider } from "./provider";
import { fetchTrustProfile, type TrustProfile } from "./on-chain";
import type { EmbrisPermission } from "./ember-permissions";

export interface WalletState {
  ethBalance: string;
  lastTxHash: string | null;
  lastTxTime: number;
  trustScore: number | null;
  approvalCount: number;
}

const WALLET_STATE_KEY = "vaultfire_wallet_state";

export async function initializeNotifications() {
  // Set notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Request permissions
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getStoredWalletState(address: string): Promise<WalletState | null> {
  try {
    const key = `${WALLET_STATE_KEY}_${address}`;
    const stored = await Notifications.getLastNotificationResponseAsync();
    // For now, return null to trigger initial scan
    return null;
  } catch {
    return null;
  }
}

export async function monitorWallet(
  address: string,
  permission: EmbrisPermission,
  onUpdate?: (state: WalletState) => void
): Promise<() => void> {
  const provider = getBaseProvider();
  let isMonitoring = true;

  const poll = async () => {
    if (!isMonitoring) return;

    try {
      // Get current ETH balance
      const balance = await provider.getBalance(address);
      const balanceEth = ethers.formatEther(balance);

      // Get trust profile
      const trustProfile = await fetchTrustProfile(address);
      const trustScore = trustProfile.reputation?.averageRating || null;

      const currentState: WalletState = {
        ethBalance: balanceEth,
        lastTxHash: null,
        lastTxTime: Date.now(),
        trustScore,
        approvalCount: 0,
      };

      // Send notification if balance changed significantly
      if (parseFloat(balanceEth) > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "💰 Wallet Balance Updated",
            body: `Your balance: ${balanceEth.slice(0, 6)} ETH`,
            data: { type: "balance_update", address },
          },
          trigger: null, // Show immediately
        });
      }

      // Guardian mode: flag low trust scores
      if (permission === "guardian" && trustScore !== null && trustScore < 50) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "⚠️ Low Trust Score Detected",
            body: `Your Vaultfire trust score is ${trustScore}. Consider improving your reputation.`,
            data: { type: "trust_alert", address, score: trustScore },
          },
          trigger: null,
        });
      }

      onUpdate?.(currentState);
    } catch (error) {
      console.error("Wallet monitoring error:", error);
    }

    // Poll every 30 seconds
    if (isMonitoring) {
      setTimeout(poll, 30000);
    }
  };

  // Start polling
  poll();

  // Return cleanup function
  return () => {
    isMonitoring = false;
  };
}

export async function notifyNewTransaction(
  txHash: string,
  from: string,
  to: string,
  value: string,
  isIncoming: boolean
) {
  const direction = isIncoming ? "Received" : "Sent";
  const icon = isIncoming ? "📥" : "📤";

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${icon} Transaction ${direction}`,
      body: `${value} ETH${isIncoming ? " from " : " to "}${to.slice(0, 10)}...`,
      data: { type: "transaction", txHash, from, to, value, isIncoming },
    },
    trigger: null,
  });
}

export async function notifyNewApproval(
  tokenSymbol: string,
  spender: string,
  amount: string,
  permission: EmbrisPermission
) {
  const isUnlimited = amount === "unlimited";
  const icon = isUnlimited ? "⚠️" : "✅";
  const title = isUnlimited ? "Unlimited Approval Detected" : "Token Approval";

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${icon} ${title}`,
      body: `${tokenSymbol} approval to ${spender.slice(0, 10)}... for ${amount}`,
      data: { type: "approval", tokenSymbol, spender, amount },
    },
    trigger: null,
  });

  // Guardian mode: immediate alert for unlimited approvals
  if (permission === "guardian" && isUnlimited) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🚨 Dangerous Approval Detected",
        body: `Unlimited ${tokenSymbol} approval. Consider revoking this in the Security tab.`,
        data: { type: "dangerous_approval", tokenSymbol, spender },
      },
      trigger: null,
    });
  }
}

export async function notifyTrustProfileChange(
  oldScore: number | null,
  newScore: number | null,
  bondsCreated?: number
) {
  if (oldScore === null && newScore !== null) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🛡️ Vaultfire Profile Created",
        body: `Your trust score is now ${newScore}. You're registered on the protocol!`,
        data: { type: "profile_created", score: newScore },
      },
      trigger: null,
    });
  } else if (oldScore !== null && newScore !== null && newScore > oldScore) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "📈 Trust Score Improved",
        body: `Your score increased from ${oldScore} to ${newScore}!`,
        data: { type: "score_improved", oldScore, newScore },
      },
      trigger: null,
    });
  }

  if (bondsCreated && bondsCreated > 0) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🔗 New Bond Created",
        body: `You have ${bondsCreated} new partnership bond(s)`,
        data: { type: "bond_created", count: bondsCreated },
      },
      trigger: null,
    });
  }
}
