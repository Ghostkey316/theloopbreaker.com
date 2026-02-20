/**
 * Ember Permission Levels
 *
 * Controls how much access Ember has to the user's wallet data
 * and how proactively she can suggest or flag transactions.
 *
 * - View Only: Ember can see balances and trust profile, cannot suggest transactions
 * - Advisory: Ember can see everything AND suggest transactions (default)
 * - Guardian: Ember proactively flags suspicious activity and recommends blocking
 *
 * User signs every transaction regardless of permission level.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PERMISSION_KEY = "vaultfire_ember_permission";

export type EmberPermission = "view_only" | "advisory" | "guardian";

export interface EmberPermissionConfig {
  level: EmberPermission;
  label: string;
  description: string;
  icon: string;
  color: string;
  canSuggestTransactions: boolean;
  canSeeBalances: boolean;
  canProactivelyFlag: boolean;
}

export const PERMISSION_CONFIGS: Record<EmberPermission, EmberPermissionConfig> = {
  view_only: {
    level: "view_only",
    label: "View Only",
    description: "Ember can see your balances and trust profile. Cannot suggest transactions.",
    icon: "visibility",
    color: "#9CA3AF",
    canSuggestTransactions: false,
    canSeeBalances: true,
    canProactivelyFlag: false,
  },
  advisory: {
    level: "advisory",
    label: "Advisory",
    description: "Ember can see everything and suggest transactions. You approve every one manually.",
    icon: "tips-and-updates",
    color: "#F97316",
    canSuggestTransactions: true,
    canSeeBalances: true,
    canProactivelyFlag: false,
  },
  guardian: {
    level: "guardian",
    label: "Guardian",
    description: "Ember proactively flags suspicious activity and recommends blocking untrusted addresses. You still sign everything.",
    icon: "shield",
    color: "#8B5CF6",
    canSuggestTransactions: true,
    canSeeBalances: true,
    canProactivelyFlag: true,
  },
};

export interface EmberPermissionContextType {
  permission: EmberPermission;
  config: EmberPermissionConfig;
  setPermission: (level: EmberPermission) => Promise<void>;
  isLoading: boolean;
}

const EmberPermissionContext = createContext<EmberPermissionContextType | undefined>(undefined);

export function EmberPermissionProvider({ children }: { children: ReactNode }) {
  const [permission, setPermissionState] = useState<EmberPermission>("advisory");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPermission();
  }, []);

  const loadPermission = async () => {
    try {
      const stored = await AsyncStorage.getItem(PERMISSION_KEY);
      if (stored && (stored === "view_only" || stored === "advisory" || stored === "guardian")) {
        setPermissionState(stored as EmberPermission);
      }
    } catch (error) {
      console.error("Failed to load Ember permission:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setPermission = async (level: EmberPermission) => {
    setPermissionState(level);
    try {
      await AsyncStorage.setItem(PERMISSION_KEY, level);
    } catch (error) {
      console.error("Failed to save Ember permission:", error);
    }
  };

  return (
    <EmberPermissionContext.Provider
      value={{
        permission,
        config: PERMISSION_CONFIGS[permission],
        setPermission,
        isLoading,
      }}
    >
      {children}
    </EmberPermissionContext.Provider>
  );
}

export function useEmberPermission(): EmberPermissionContextType {
  const context = useContext(EmberPermissionContext);
  if (!context) {
    throw new Error("useEmberPermission must be used within EmberPermissionProvider");
  }
  return context;
}

/**
 * Get Ember's advisory comment based on trust profile and permission level
 */
export function getEmberTrustComment(
  permission: EmberPermission,
  trustScore: number | null,
  hasBonds: boolean,
  isRegistered: boolean,
  recipientAddress: string
): string {
  if (permission === "view_only") {
    return "";
  }

  if (!isRegistered) {
    if (permission === "guardian") {
      return `⚠️ Warning: ${recipientAddress.slice(0, 8)}... has no Vaultfire trust profile. This address is unknown to the protocol. I'd recommend extra caution before proceeding.`;
    }
    return `This address has no Vaultfire trust profile. Proceed with caution.`;
  }

  if (trustScore !== null && trustScore >= 80) {
    const bondsNote = hasBonds ? " with active bonds" : "";
    return `This address has a Vaultfire trust score of ${trustScore}${bondsNote}. Looks solid.`;
  }

  if (trustScore !== null && trustScore >= 50) {
    return `This address has a moderate trust score of ${trustScore}. They're registered but haven't built much reputation yet.`;
  }

  if (trustScore !== null && trustScore < 50) {
    if (permission === "guardian") {
      return `🚨 This address has a low trust score of ${trustScore}. I'd strongly recommend against this interaction.`;
    }
    return `This address has a low trust score of ${trustScore}. Be careful.`;
  }

  return `This address is registered with Vaultfire but has no reputation data yet.`;
}
