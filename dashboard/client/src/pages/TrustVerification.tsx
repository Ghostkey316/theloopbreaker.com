/**
 * Trust Verification Lookup — Vaultfire Protocol
 * Design: "Obsidian Forge" — Dark luxury fintech with ember-to-purple accents
 *
 * Allows anyone to look up an address and see its full trust profile across
 * the Vaultfire Protocol: identity, reputation, bonds, validation, and
 * cross-chain bridge sync status.
 */

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Shield, ShieldCheck, ShieldAlert, ShieldX,
  User, Bot, Link2, Star, CheckCircle2, XCircle,
  ArrowLeftRight, ExternalLink, ArrowLeft, Loader2,
  Fingerprint, Scale, Eye, Globe2,
} from "lucide-react";
import {
  BASE_RPC_URL, CONTRACTS, AVAX_CONTRACTS,
  ERC8004IdentityRegistryABI,
  AIPartnershipBondsV2ABI,
  AIAccountabilityBondsV2ABI,
  ERC8004ReputationRegistryABI,
  ERC8004ValidationRegistryABI,
  VaultfireTeleporterBridgeABI,
  VaultfireERC8004AdapterABI,
  basescanAddress,
  shortenAddress,
  snowtraceAddress,
} from "@/lib/contracts";

// ── RPC helpers ─────────────────────────────────────────────────────────────────

const BASE_NETWORK = new ethers.Network("base", 8453);
const AVAX_NETWORK = new ethers.Network("avax", 43114);

function getBaseProvider() {
  return new ethers.JsonRpcProvider(BASE_RPC_URL, BASE_NETWORK, { staticNetwork: BASE_NETWORK });
}

function getAvaxProvider() {
  return new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc", AVAX_NETWORK, { staticNetwork: AVAX_NETWORK });
}

async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

// ── Types ───────────────────────────────────────────────────────────────────────

interface TrustProfile {
  address: string;
  // Identity
  isRegistered: boolean;
  isActive: boolean;
  agentType: string;
  agentURI: string;
  registeredAt: number;
  // Reputation
  averageRating: number;
  totalFeedbacks: number;
  verifiedFeedbacks: number;
  lastReputationUpdate: number;
  // Bonds
  partnershipBondIds: number[];
  partnershipBonds: Array<{
    bondId: number;
    human: string;
    aiAgent: string;
    partnershipType: string;
    stakeAmount: string;
    active: boolean;
    createdAt: number;
  }>;
  // Adapter
  isFullyRegistered: { erc8004: boolean; vaultfire: boolean };
  // Bridge (cross-chain)
  isRecognizedOnAvax: boolean;
  baseBridgeSyncedAgents: number;
  avaxBridgeSyncedAgents: number;
  // Validation
  validationRequestCount: number;
  // Trust score (computed)
  trustScore: number;
  trustLevel: "Unverified" | "Registered" | "Trusted" | "Highly Trusted" | "Exemplary";
}

// ── Trust Score Computation ─────────────────────────────────────────────────────

function computeTrustScore(profile: Partial<TrustProfile>): { score: number; level: TrustProfile["trustLevel"] } {
  let score = 0;

  // Identity (max 25)
  if (profile.isRegistered) score += 15;
  if (profile.isActive) score += 10;

  // Reputation (max 30)
  if (profile.totalFeedbacks && profile.totalFeedbacks > 0) {
    score += Math.min(10, profile.totalFeedbacks * 2);
    if (profile.averageRating) {
      score += Math.min(15, Math.floor(profile.averageRating / 10)); // rating is 0-100
    }
    if (profile.verifiedFeedbacks && profile.verifiedFeedbacks > 0) {
      score += 5;
    }
  }

  // Bonds (max 25)
  if (profile.partnershipBonds && profile.partnershipBonds.length > 0) {
    const activeBonds = profile.partnershipBonds.filter(b => b.active);
    score += Math.min(15, activeBonds.length * 5);
    if (activeBonds.some(b => parseFloat(b.stakeAmount) > 0)) {
      score += 10;
    }
  }

  // Cross-chain (max 10)
  if (profile.isRecognizedOnAvax) score += 10;

  // Validation (max 10)
  if (profile.validationRequestCount && profile.validationRequestCount > 0) {
    score += Math.min(10, profile.validationRequestCount * 3);
  }

  score = Math.min(100, score);

  let level: TrustProfile["trustLevel"] = "Unverified";
  if (score >= 80) level = "Exemplary";
  else if (score >= 60) level = "Highly Trusted";
  else if (score >= 40) level = "Trusted";
  else if (score >= 15) level = "Registered";

  return { score, level };
}

// ── Lookup Logic ────────────────────────────────────────────────────────────────

async function lookupTrustProfile(address: string): Promise<TrustProfile> {
  const baseProvider = getBaseProvider();
  const avaxProvider = getAvaxProvider();
  const checksumAddr = ethers.getAddress(address);

  // Identity Registry
  const identityRegistry = new ethers.Contract(CONTRACTS.ERC8004IdentityRegistry, ERC8004IdentityRegistryABI, baseProvider);
  const agentData = await safeCall(
    () => identityRegistry.getAgent(checksumAddr),
    null
  );
  const isActive = await safeCall(() => identityRegistry.isAgentActive(checksumAddr), false);

  // Reputation Registry
  const reputationRegistry = new ethers.Contract(CONTRACTS.ERC8004ReputationRegistry, ERC8004ReputationRegistryABI, baseProvider);
  const reputation = await safeCall(
    () => reputationRegistry.getReputation(checksumAddr),
    null
  );

  // Partnership Bonds
  const partnershipBonds = new ethers.Contract(CONTRACTS.AIPartnershipBondsV2, AIPartnershipBondsV2ABI, baseProvider);
  const nextBondId = await safeCall(() => partnershipBonds.nextBondId(), BigInt(1));
  const bonds: TrustProfile["partnershipBonds"] = [];
  const bondIds: number[] = [];

  for (let i = 1; i < Math.min(Number(nextBondId), 50); i++) {
    const bond = await safeCall(() => partnershipBonds.getBond(i), null);
    if (bond && (
      bond.human.toLowerCase() === checksumAddr.toLowerCase() ||
      bond.aiAgent.toLowerCase() === checksumAddr.toLowerCase()
    )) {
      bondIds.push(i);
      bonds.push({
        bondId: Number(bond.bondId),
        human: bond.human,
        aiAgent: bond.aiAgent,
        partnershipType: bond.partnershipType,
        stakeAmount: ethers.formatEther(bond.stakeAmount),
        active: bond.active,
        createdAt: Number(bond.createdAt),
      });
    }
  }

  // Adapter
  const adapter = new ethers.Contract(CONTRACTS.VaultfireERC8004Adapter, VaultfireERC8004AdapterABI, baseProvider);
  const adapterStatus = await safeCall(
    () => adapter.isAgentFullyRegistered(checksumAddr),
    { registeredERC8004: false, registeredVaultFire: false }
  );

  // Bridge — Base side
  const baseBridge = new ethers.Contract(CONTRACTS.VaultfireTeleporterBridge, VaultfireTeleporterBridgeABI, baseProvider);
  const baseSyncedAgents = await safeCall(() => baseBridge.getSyncedAgentCount(), BigInt(0));

  // Bridge — Avalanche side
  const avaxBridge = new ethers.Contract(AVAX_CONTRACTS.VaultfireTeleporterBridge, VaultfireTeleporterBridgeABI, avaxProvider);
  const isRecognizedOnAvax = await safeCall(() => avaxBridge.isAgentRecognized(checksumAddr), false);
  const avaxSyncedAgents = await safeCall(() => avaxBridge.getSyncedAgentCount(), BigInt(0));

  // Validation
  const validationRegistry = new ethers.Contract(CONTRACTS.ERC8004ValidationRegistry, ERC8004ValidationRegistryABI, baseProvider);
  const validationCount = await safeCall(
    () => validationRegistry.getAgentValidationRequestsCount(checksumAddr),
    BigInt(0)
  );

  const profile: Partial<TrustProfile> = {
    address: checksumAddr,
    isRegistered: agentData ? agentData.agentAddress !== ethers.ZeroAddress : false,
    isActive,
    agentType: agentData?.agentType || "",
    agentURI: agentData?.agentURI || "",
    registeredAt: agentData ? Number(agentData.registeredAt) : 0,
    averageRating: reputation ? Number(reputation.averageRating) : 0,
    totalFeedbacks: reputation ? Number(reputation.totalFeedbacks) : 0,
    verifiedFeedbacks: reputation ? Number(reputation.verifiedFeedbacks) : 0,
    lastReputationUpdate: reputation ? Number(reputation.lastUpdated) : 0,
    partnershipBondIds: bondIds,
    partnershipBonds: bonds,
    isFullyRegistered: {
      erc8004: adapterStatus?.registeredERC8004 ?? false,
      vaultfire: adapterStatus?.registeredVaultFire ?? false,
    },
    isRecognizedOnAvax,
    baseBridgeSyncedAgents: Number(baseSyncedAgents),
    avaxBridgeSyncedAgents: Number(avaxSyncedAgents),
    validationRequestCount: Number(validationCount),
  };

  const { score, level } = computeTrustScore(profile);
  profile.trustScore = score;
  profile.trustLevel = level;

  return profile as TrustProfile;
}

// ── UI Components ───────────────────────────────────────────────────────────────

function TrustShieldIcon({ level }: { level: TrustProfile["trustLevel"] }) {
  const iconMap = {
    Unverified: <ShieldX className="w-12 h-12 text-muted-foreground" />,
    Registered: <Shield className="w-12 h-12 text-ember" />,
    Trusted: <ShieldCheck className="w-12 h-12 text-violet" />,
    "Highly Trusted": <ShieldCheck className="w-12 h-12 text-emerald" />,
    Exemplary: <ShieldCheck className="w-12 h-12 text-ember" />,
  };
  return iconMap[level] || iconMap.Unverified;
}

function TrustScoreRing({ score, level }: { score: number; level: string }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const colorMap: Record<string, string> = {
    Unverified: "oklch(0.6 0.015 260)",
    Registered: "oklch(0.72 0.19 50)",
    Trusted: "oklch(0.55 0.22 290)",
    "Highly Trusted": "oklch(0.7 0.17 162)",
    Exemplary: "oklch(0.72 0.19 50)",
  };
  const color = colorMap[level] || colorMap.Unverified;

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="oklch(0.22 0.01 260)" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r="54" fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-display font-bold text-foreground">{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Trust</span>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: React.ReactNode; href?: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
      <div className="mt-0.5 text-muted-foreground opacity-60">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
        <div className="text-sm text-foreground break-all">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-ember transition-colors">
              {value} <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          ) : value}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children, delay = 0 }: { title: string; icon: React.ReactNode; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="vf-card rounded-xl p-5 md:p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="text-ember">{icon}</div>
        <h3 className="font-display font-bold text-foreground">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function formatDate(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ── Main Page ───────────────────────────────────────────────────────────────────

export default function TrustVerification() {
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<TrustProfile | null>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;

    if (!ethers.isAddress(trimmed)) {
      setError("Invalid Ethereum address. Please enter a valid 0x address.");
      return;
    }

    setLoading(true);
    setError(null);
    setProfile(null);

    try {
      const result = await lookupTrustProfile(trimmed);
      setProfile(result);
    } catch (err: any) {
      setError(`Lookup failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [searchInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="container">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ember to-violet flex items-center justify-center">
                  <span className="font-display font-bold text-sm text-white">V</span>
                </div>
                <span className="font-display font-bold text-lg hidden sm:block">
                  <span className="vf-gradient-text">Vaultfire</span>
                </span>
              </a>
              <span className="text-muted-foreground text-sm hidden md:block">/ Trust Verification</span>
            </div>
            <a
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-24 pb-8">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-ember/20 to-violet/20 border border-border/50 flex items-center justify-center text-ember">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-bold font-display tracking-tight">
                  <span className="vf-gradient-text">Trust</span>{" "}
                  <span className="text-foreground">Verification</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Look up any address across the Vaultfire Protocol
                </p>
              </div>
            </div>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-6"
          >
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter an Ethereum address (0x...)"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface border border-border/50 text-foreground placeholder:text-muted-foreground/50 font-mono-data text-sm focus:outline-none focus:ring-2 focus:ring-ember/40 focus:border-ember/50 transition-all"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-ember to-violet text-white font-display font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Verify
              </button>
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 text-sm text-destructive flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" /> {error}
              </motion.p>
            )}
          </motion.div>
        </div>
      </section>

      <div className="vf-gradient-line" />

      {/* Results */}
      <main className="container pb-20">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="w-16 h-16 rounded-full border-4 border-ember/20 border-t-ember animate-spin mb-4" />
              <p className="text-muted-foreground text-sm">Querying Base mainnet & Avalanche C-Chain...</p>
            </motion.div>
          )}

          {!loading && !profile && !error && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <Shield className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-sm">
                Enter an address above to look up its trust profile across the Vaultfire Protocol.
              </p>
              <p className="text-muted-foreground/60 text-xs mt-2">
                Checks identity, reputation, bonds, validation, and cross-chain bridge status.
              </p>
            </motion.div>
          )}

          {profile && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-8"
            >
              {/* Trust Score Hero */}
              <div className="vf-card rounded-xl p-6 md:p-8 mb-8">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <TrustScoreRing score={profile.trustScore} level={profile.trustLevel} />
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                      <TrustShieldIcon level={profile.trustLevel} />
                      <div>
                        <h2 className="text-xl font-display font-bold text-foreground">{profile.trustLevel}</h2>
                        <a
                          href={basescanAddress(profile.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono-data text-muted-foreground hover:text-ember transition-colors inline-flex items-center gap-1"
                        >
                          {shortenAddress(profile.address)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                      {profile.isRegistered && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-emerald/15 text-emerald border-emerald/30">
                          <CheckCircle2 className="w-3 h-3" /> Registered
                        </span>
                      )}
                      {profile.isActive && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-emerald/15 text-emerald border-emerald/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald vf-pulse" /> Active
                        </span>
                      )}
                      {profile.isRecognizedOnAvax && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-violet/15 text-violet border-violet/30">
                          <Globe2 className="w-3 h-3" /> Cross-Chain
                        </span>
                      )}
                      {profile.partnershipBonds.some(b => b.active) && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-ember/15 text-ember border-ember/30">
                          <Link2 className="w-3 h-3" /> Bonded
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Identity */}
                <SectionCard title="Identity" icon={<Fingerprint className="w-5 h-5" />} delay={0.1}>
                  <InfoRow icon={<Bot className="w-4 h-4" />} label="Agent Type" value={profile.agentType || "Not registered"} />
                  <InfoRow icon={<User className="w-4 h-4" />} label="Agent URI" value={profile.agentURI || "—"} />
                  <InfoRow icon={<CheckCircle2 className="w-4 h-4" />} label="Registered" value={profile.registeredAt ? formatDate(profile.registeredAt) : "No"} />
                  <InfoRow icon={<Shield className="w-4 h-4" />} label="Active" value={profile.isActive ? "Yes" : "No"} />
                  <InfoRow
                    icon={<Fingerprint className="w-4 h-4" />}
                    label="ERC-8004 Registered"
                    value={profile.isFullyRegistered.erc8004 ? "Yes" : "No"}
                  />
                  <InfoRow
                    icon={<Fingerprint className="w-4 h-4" />}
                    label="Vaultfire Registered"
                    value={profile.isFullyRegistered.vaultfire ? "Yes" : "No"}
                  />
                </SectionCard>

                {/* Reputation */}
                <SectionCard title="Reputation" icon={<Star className="w-5 h-5" />} delay={0.2}>
                  <InfoRow icon={<Star className="w-4 h-4" />} label="Average Rating" value={profile.averageRating > 0 ? `${profile.averageRating} / 100` : "No ratings"} />
                  <InfoRow icon={<User className="w-4 h-4" />} label="Total Feedbacks" value={String(profile.totalFeedbacks)} />
                  <InfoRow icon={<CheckCircle2 className="w-4 h-4" />} label="Verified Feedbacks" value={String(profile.verifiedFeedbacks)} />
                  <InfoRow
                    icon={<Scale className="w-4 h-4" />}
                    label="Verified %"
                    value={profile.totalFeedbacks > 0 ? `${Math.round((profile.verifiedFeedbacks / profile.totalFeedbacks) * 100)}%` : "—"}
                  />
                  <InfoRow icon={<Eye className="w-4 h-4" />} label="Last Updated" value={profile.lastReputationUpdate ? formatDate(profile.lastReputationUpdate) : "—"} />
                </SectionCard>

                {/* Partnership Bonds */}
                <SectionCard title="Partnership Bonds" icon={<Link2 className="w-5 h-5" />} delay={0.3}>
                  {profile.partnershipBonds.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No partnership bonds found</p>
                  ) : (
                    profile.partnershipBonds.map((bond) => (
                      <div key={bond.bondId} className="py-3 border-b border-border/30 last:border-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-display font-bold text-foreground">Bond #{bond.bondId}</span>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border ${
                            bond.active
                              ? "bg-emerald/15 text-emerald border-emerald/30"
                              : "bg-muted text-muted-foreground border-border"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${bond.active ? "bg-emerald vf-pulse" : "bg-muted-foreground"}`} />
                            {bond.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Type: <span className="text-foreground">{bond.partnershipType}</span></div>
                          <div>Human: <a href={basescanAddress(bond.human)} target="_blank" rel="noopener noreferrer" className="font-mono-data text-foreground hover:text-ember">{shortenAddress(bond.human)}</a></div>
                          <div>AI Agent: <a href={basescanAddress(bond.aiAgent)} target="_blank" rel="noopener noreferrer" className="font-mono-data text-foreground hover:text-ember">{shortenAddress(bond.aiAgent)}</a></div>
                          <div>Stake: <span className="text-foreground">{bond.stakeAmount} ETH</span></div>
                          <div>Created: <span className="text-foreground">{formatDate(bond.createdAt)}</span></div>
                        </div>
                      </div>
                    ))
                  )}
                </SectionCard>

                {/* Cross-Chain Bridge */}
                <SectionCard title="Cross-Chain Status" icon={<ArrowLeftRight className="w-5 h-5" />} delay={0.4}>
                  <InfoRow
                    icon={<Globe2 className="w-4 h-4" />}
                    label="Recognized on Avalanche"
                    value={profile.isRecognizedOnAvax ? "Yes" : "No"}
                  />
                  <InfoRow
                    icon={<ArrowLeftRight className="w-4 h-4" />}
                    label="Base Bridge Synced Agents"
                    value={String(profile.baseBridgeSyncedAgents)}
                  />
                  <InfoRow
                    icon={<ArrowLeftRight className="w-4 h-4" />}
                    label="Avalanche Bridge Synced Agents"
                    value={String(profile.avaxBridgeSyncedAgents)}
                  />
                  <InfoRow
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    label="Validation Requests"
                    value={String(profile.validationRequestCount)}
                  />
                  <div className="mt-3 pt-3 border-t border-border/30 flex gap-3">
                    <a
                      href={basescanAddress(profile.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-ember transition-colors inline-flex items-center gap-1"
                    >
                      View on BaseScan <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={snowtraceAddress(profile.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-violet transition-colors inline-flex items-center gap-1"
                    >
                      View on SnowScan <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </SectionCard>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-lg vf-gradient-text">Vaultfire</span>
              <span className="text-muted-foreground text-sm">Trust Verification</span>
            </div>
            <div className="text-xs text-muted-foreground text-center md:text-right">
              Morals over metrics. Privacy over surveillance. Freedom over control.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
