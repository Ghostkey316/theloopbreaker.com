'use client';

/**
 * AppContext — Shared application state for cohesive cross-section flow.
 *
 * This context provides companion status, bond info, VNS name, brain stats,
 * and section navigation to ALL sections. When something changes in one section
 * (e.g., companion gets a bond in Chat), other sections (e.g., Wallet, VNS)
 * can reflect that change immediately.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  isCompanionWalletCreated,
  getCompanionAddress,
  getCompanionBondStatus,
  getCompanionVNSName,
  getCompanionAgentName,
} from './companion-agent';
import { getBrainStats } from './companion-brain';
import { getSoulSummary } from './companion-soul';
import { getWalletAddress } from './wallet';
import { isRegistered } from './registration';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CompanionStatus {
  walletCreated: boolean;
  walletAddress: string | null;
  bondActive: boolean;
  bondTier: string | null;
  vnsName: string | null;
  agentName: string;
  registered: boolean;
}

export interface BrainStatus {
  knowledgeEntries: number;
  learnedInsights: number;
  memoriesCount: number;
  trackedTopics: number;
}

export interface SoulStatus {
  name: string;
  motto: string;
  valueCount: number;
  traitCount: number;
  boundaryCount: number;
  attestedOnChain: boolean;
  age: string;
}

export interface AppState {
  // User state
  userWalletAddress: string | null;
  userRegistered: boolean;

  // Companion state
  companion: CompanionStatus;
  brain: BrainStatus;
  soul: SoulStatus;

  // Actions
  refreshCompanionState: () => void;
  navigateToSection: (section: string) => void;
}

const defaultState: AppState = {
  userWalletAddress: null,
  userRegistered: false,
  companion: {
    walletCreated: false,
    walletAddress: null,
    bondActive: false,
    bondTier: null,
    vnsName: null,
    agentName: 'embris-companion',
    registered: false,
  },
  brain: {
    knowledgeEntries: 0,
    learnedInsights: 0,
    memoriesCount: 0,
    trackedTopics: 0,
  },
  soul: {
    name: 'Embris',
    motto: '',
    valueCount: 0,
    traitCount: 0,
    boundaryCount: 0,
    attestedOnChain: false,
    age: 'just born',
  },
  refreshCompanionState: () => {},
  navigateToSection: () => {},
};

const AppContext = createContext<AppState>(defaultState);

export function useAppContext() {
  return useContext(AppContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [userWalletAddress, setUserWalletAddress] = useState<string | null>(null);
  const [userRegistered, setUserRegistered] = useState(false);
  const [companion, setCompanion] = useState<CompanionStatus>(defaultState.companion);
  const [brain, setBrain] = useState<BrainStatus>(defaultState.brain);
  const [soul, setSoul] = useState<SoulStatus>(defaultState.soul);

  const refreshCompanionState = useCallback(() => {
    // User state
    setUserWalletAddress(getWalletAddress());
    setUserRegistered(isRegistered());

    // Companion state
    const bondStatus = getCompanionBondStatus();
    setCompanion({
      walletCreated: isCompanionWalletCreated(),
      walletAddress: getCompanionAddress(),
      bondActive: bondStatus.active,
      bondTier: bondStatus.tier || null,
      vnsName: getCompanionVNSName(),
      agentName: getCompanionAgentName(),
      registered: typeof window !== 'undefined'
        ? localStorage.getItem('embris_companion_registered') === 'true'
        : false,
    });

    // Brain state
    const stats = getBrainStats();
    setBrain({
      knowledgeEntries: stats.knowledgeEntries,
      learnedInsights: stats.learnedInsights,
      memoriesCount: stats.memoriesCount,
      trackedTopics: stats.trackedTopics,
    });

    // Soul state
    const soulSummary = getSoulSummary();
    setSoul({
      name: soulSummary.name,
      motto: soulSummary.motto,
      valueCount: soulSummary.valueCount,
      traitCount: soulSummary.traitCount,
      boundaryCount: soulSummary.boundaryCount,
      attestedOnChain: soulSummary.attestedOnChain,
      age: soulSummary.age,
    });
  }, []);

  // Navigate to a section using the global __setSection
  const navigateToSection = useCallback((section: string) => {
    const win = window as unknown as { __setSection?: (s: string) => void };
    if (win.__setSection) {
      win.__setSection(section);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshCompanionState();
  }, [refreshCompanionState]);

  // Listen for storage changes (cross-tab sync)
  useEffect(() => {
    const handleStorage = () => {
      refreshCompanionState();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshCompanionState]);

  // Periodic refresh every 10 seconds to catch in-tab changes
  useEffect(() => {
    const interval = setInterval(refreshCompanionState, 10000);
    return () => clearInterval(interval);
  }, [refreshCompanionState]);

  return (
    <AppContext.Provider value={{
      userWalletAddress,
      userRegistered,
      companion,
      brain,
      soul,
      refreshCompanionState,
      navigateToSection,
    }}>
      {children}
    </AppContext.Provider>
  );
}
