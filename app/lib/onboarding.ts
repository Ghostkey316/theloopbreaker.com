/**
 * Embris Onboarding Tutorial System
 *
 * First-time visitor guided walkthrough.
 * Shows once, stored in localStorage.
 */

const ONBOARDING_KEY = 'embris_onboarding_complete_v1';

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: 'flame' | 'shield' | 'wallet' | 'brain' | 'chain';
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: 'Welcome to Vaultfire Protocol',
    description: 'Vaultfire is the first ethical AI trust protocol — a blockchain-based governance framework deployed across Base and Avalanche. Our mission: making human thriving more profitable than extraction.',
    icon: 'flame',
  },
  {
    id: 2,
    title: 'Meet Embris, Your AI Companion',
    description: 'Embris is your personal AI companion powered by Vaultfire. Unlike typical chatbots, Embris remembers you, learns your preferences, tracks your goals, and grows smarter with every conversation.',
    icon: 'brain',
  },
  {
    id: 3,
    title: 'Register On-Chain',
    description: 'Register your identity on Base or Avalanche to unlock the full Embris experience — persistent memory, self-learning, emotional intelligence, goal tracking, and personality tuning.',
    icon: 'chain',
  },
  {
    id: 4,
    title: 'Your Vaultfire Wallet',
    description: 'Create a Vaultfire wallet to interact with the protocol. Your wallet is generated locally in your browser — your keys, your control. Use it to register and verify on-chain.',
    icon: 'wallet',
  },
  {
    id: 5,
    title: 'Embris Grows With You',
    description: 'The more you chat, the smarter Embris becomes. It generates reflections, recognizes patterns, creates insights, and adapts its personality to match your style. Your companion, your way.',
    icon: 'shield',
  },
];

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  } catch {
    return true;
  }
}

export function completeOnboarding(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ONBOARDING_KEY, 'true');
  } catch { /* ignore */ }
}

export function resetOnboarding(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ONBOARDING_KEY);
  } catch { /* ignore */ }
}
