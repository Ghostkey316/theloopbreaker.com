/**
 * Embris Registration System (Mobile)
 * Manages on-chain registration state.
 * Uses AsyncStorage for persistence.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const REGISTRATION_KEY = "@embris_registration_v1";
const NUDGE_KEY = "@embris_nudge_count_v1";

export interface RegistrationData {
  walletAddress: string;
  registeredChains: string[];
  registeredAt: number;
}

export async function isRegistered(): Promise<boolean> {
  try {
    const data = await AsyncStorage.getItem(REGISTRATION_KEY);
    return data !== null;
  } catch {
    return false;
  }
}

export async function getRegistration(): Promise<RegistrationData | null> {
  try {
    const data = await AsyncStorage.getItem(REGISTRATION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function saveRegistration(data: RegistrationData): Promise<void> {
  await AsyncStorage.setItem(REGISTRATION_KEY, JSON.stringify(data));
}

export async function clearRegistration(): Promise<void> {
  await AsyncStorage.removeItem(REGISTRATION_KEY);
}

export async function getRegisteredWalletAddress(): Promise<string | null> {
  const reg = await getRegistration();
  return reg?.walletAddress || null;
}

export async function getRegisteredChains(): Promise<string[]> {
  const reg = await getRegistration();
  return reg?.registeredChains || [];
}

export async function shouldNudgeRegistration(): Promise<boolean> {
  try {
    const count = await AsyncStorage.getItem(NUDGE_KEY);
    const nudgeCount = count ? parseInt(count) : 0;
    // Nudge every 3rd message
    return nudgeCount % 3 === 0;
  } catch {
    return false;
  }
}

export async function incrementNudgeCount(): Promise<void> {
  try {
    const count = await AsyncStorage.getItem(NUDGE_KEY);
    const nudgeCount = count ? parseInt(count) + 1 : 1;
    await AsyncStorage.setItem(NUDGE_KEY, nudgeCount.toString());
  } catch { /* ignore */ }
}
