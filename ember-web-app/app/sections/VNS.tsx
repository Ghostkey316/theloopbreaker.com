"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  validateVNSName, checkVNSAvailability, resolveVNSName, getTotalVNSRegistrations,
  registerVNSName, getMyVNSName, setMyVNSName, getMyIdentityType,
  getHumanVNSForAddress, getCompanionVNSForAddress, getAgentVNSNamesForAddress,
  validateRegistrationRules, estimateVNSRegistrationGas, formatVNSName,
  getIdentityTypeLabel, getIdentityTypeColor, getBondTierInfo, getBondTier,
  type VNSProfile, type VNSAvailability, type IdentityType, type VNSGasEstimate,
} from "../lib/vns";
import { getWalletAddress, isWalletCreated, getWalletPrivateKey } from "../lib/wallet";
import DisclaimerBanner from "../components/DisclaimerBanner";

/* ── Icons ── */
const SearchIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const CheckIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const XIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
);
const UserIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const BotIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg>
);
const HeartIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
);
const ShieldIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
const CopyIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
);
const GlobeIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
);
const LinkIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
);

/* ── Styles ── */
const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 16, padding: 24,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "14px 16px", borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)",
  color: "#F4F4F5", fontSize: 15, fontFamily: "inherit", outline: "none",
  transition: "border-color 0.2s", boxSizing: "border-box",
};
const btnPrimary: React.CSSProperties = {
  padding: "14px 28px", borderRadius: 12, border: "none",
  background: "linear-gradient(135deg, #F97316, #EA580C)", color: "#fff",
  fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  transition: "opacity 0.2s", width: "100%",
};
const btnSecondary: React.CSSProperties = {
  padding: "12px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.03)", color: "#A1A1AA",
  fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
  transition: "all 0.2s",
};
const label: React.CSSProperties = {
  fontSize: 13, fontWeight: 500, color: "#A1A1AA", marginBottom: 8, display: "block",
};

/* ── Identity Type Card ── */
function IdentityTypeCard({
  type, selected, disabled, disabledReason, onClick,
}: {
  type: IdentityType; selected: boolean; disabled: boolean;
  disabledReason?: string; onClick: () => void;
}) {
  const icons = { human: UserIcon, companion: HeartIcon, agent: BotIcon };
  const Icon = icons[type];
  const color = getIdentityTypeColor(type);
  const descriptions = {
    human: "Your personal identity on Vaultfire. One per wallet.",
    companion: "Your AI companion. One per human identity.",
    agent: "AI agent with accountability bond. Unlimited per developer.",
  };
  const badges = {
    human: "1 per wallet",
    companion: "1 per human",
    agent: "Bond required",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...card,
        padding: 16,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        borderColor: selected ? color : "rgba(255,255,255,0.06)",
        background: selected ? `${color}08` : "rgba(255,255,255,0.02)",
        transition: "all 0.2s",
        textAlign: "left",
        width: "100%",
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: selected ? color : "#F4F4F5" }}>
            {getIdentityTypeLabel(type)}
          </div>
          <div style={{
            fontSize: 11, color: selected ? color : "#71717A",
            background: selected ? `${color}15` : "rgba(255,255,255,0.04)",
            padding: "2px 8px", borderRadius: 6, display: "inline-block", marginTop: 2,
          }}>
            {badges[type]}
          </div>
        </div>
        {selected && (
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        )}
      </div>
      <p style={{ fontSize: 12, color: "#71717A", margin: 0, lineHeight: 1.5 }}>
        {descriptions[type]}
      </p>
      {disabled && disabledReason && (
        <p style={{ fontSize: 11, color: "#EF4444", margin: "6px 0 0", lineHeight: 1.4 }}>
          {disabledReason}
        </p>
      )}
    </button>
  );
}

/* ── Anti-Gaming Rules Panel ── */
function AntiGamingRules() {
  const rules = [
    { icon: "lock", title: "One Human Per Wallet", desc: "Each wallet can register exactly one human .vns identity." },
    { icon: "handshake", title: "One Companion Per Human", desc: "Each human gets one AI companion, tied to their identity." },
    { icon: "cpu", title: "Unlimited AI Agents", desc: "Developers can register unlimited agents — each requires a bond." },
    { icon: "link", title: "On-Chain Registration", desc: "Every name backed by a real transaction. Gas = anti-bot." },
    { icon: "shield", title: "No Name Squatting", desc: "Names without bonds or activity can be flagged." },
    { icon: "type", title: "Case-Insensitive Uniqueness", desc: "ghostkey316.vns and Ghostkey316.vns are the same name." },
  ];

  return (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <ShieldIcon size={18} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#F4F4F5" }}>Anti-Gaming Protection</span>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {rules.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, color: "#71717A" }}>
              {r.icon === "lock" && <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
              {r.icon === "handshake" && <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
              {r.icon === "cpu" && <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>}
              {r.icon === "link" && <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
              {r.icon === "shield" && <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
              {r.icon === "type" && <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>}
            </span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#D4D4D8" }}>{r.title}</div>
              <div style={{ fontSize: 11, color: "#71717A", lineHeight: 1.4 }}>{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main VNS Component ── */
export default function VNS() {
  const [tab, setTab] = useState<'register' | 'lookup'>('register');
  const [nameInput, setNameInput] = useState('');
  const [lookupInput, setLookupInput] = useState('');
  const [identityType, setIdentityType] = useState<IdentityType>('human');
  const [availability, setAvailability] = useState<VNSAvailability | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; error?: string; normalized?: string } | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [gasEstimate, setGasEstimate] = useState<VNSGasEstimate | null>(null);
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; txHash?: string; explorerUrl?: string } | null>(null);
  const [lookupResult, setLookupResult] = useState<VNSProfile | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [totalRegistrations, setTotalRegistrations] = useState(0);
  const [myVNS, setMyVNS] = useState<string | null>(null);
  const [myType, setMyType] = useState<IdentityType | null>(null);
  const [copied, setCopied] = useState(false);
  const [chain, setChain] = useState<'base' | 'avalanche' | 'ethereum'>('base');
  const [bondAmount, setBondAmount] = useState('0.01');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const walletAddress = typeof window !== 'undefined' ? getWalletAddress() : null;

  // Load initial data
  useEffect(() => {
    setMyVNS(getMyVNSName());
    setMyType(getMyIdentityType());
    getTotalVNSRegistrations().then(setTotalRegistrations).catch(() => {});
  }, []);

  // Check identity type availability
  const humanVNS = walletAddress ? getHumanVNSForAddress(walletAddress) : null;
  const companionVNS = walletAddress ? getCompanionVNSForAddress(walletAddress) : null;
  const agentVNSNames = walletAddress ? getAgentVNSNamesForAddress(walletAddress) : [];

  // Real-time name validation + availability check
  useEffect(() => {
    if (!nameInput.trim()) {
      setValidation(null);
      setAvailability(null);
      setRuleError(null);
      setGasEstimate(null);
      return;
    }

    const v = validateVNSName(nameInput);
    setValidation(v);

    if (!v.valid) {
      setAvailability(null);
      setRuleError(null);
      setGasEstimate(null);
      return;
    }

    // Anti-gaming rule check
    if (walletAddress) {
      const error = validateRegistrationRules(
        walletAddress,
        identityType,
        v.normalized!,
        identityType === 'agent' ? parseFloat(bondAmount) : undefined,
      );
      setRuleError(error);
    }

    // Debounced availability check
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const avail = await checkVNSAvailability(v.normalized!);
      setAvailability(avail);

      // Gas estimate if available
      if (avail.available && walletAddress) {
        try {
          const gas = await estimateVNSRegistrationGas(walletAddress, v.normalized!, identityType, chain);
          setGasEstimate(gas);
        } catch { setGasEstimate(null); }
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [nameInput, identityType, walletAddress, chain, bondAmount]);

  // Register handler
  const handleRegister = useCallback(async () => {
    if (!walletAddress || !validation?.valid || !availability?.available || ruleError) return;
    const pk = getWalletPrivateKey();
    if (!pk) {
      setResult({ success: false, message: 'Wallet is locked. Please unlock your wallet first.' });
      return;
    }

    setRegistering(true);
    setResult(null);

    try {
      const res = await registerVNSName(
        walletAddress, pk, (validation as any)?.normalized || formatVNSName(nameInput), identityType, chain,
        {
          bondAmountEth: identityType === 'agent' ? parseFloat(bondAmount) : undefined,
        }
      );
      setResult({
        success: res.success,
        message: res.message,
        txHash: res.txHash,
        explorerUrl: res.explorerUrl,
      });
      if (res.success) {
        setMyVNS(getMyVNSName());
        setMyType(getMyIdentityType());
        setNameInput('');
        getTotalVNSRegistrations().then(setTotalRegistrations).catch(() => {});
      }
    } catch (e) {
      setResult({ success: false, message: e instanceof Error ? e.message : 'Registration failed' });
    } finally {
      setRegistering(false);
    }
  }, [walletAddress, validation, availability, ruleError, nameInput, identityType, chain, bondAmount]);

  // Lookup handler
  const handleLookup = useCallback(async () => {
    if (!lookupInput.trim()) return;
    setLookupError('');
    setLookupResult(null);
    try {
      const profile = await resolveVNSName(lookupInput);
      if (profile) {
        setLookupResult(profile);
      } else {
        setLookupError(`No registration found for "${formatVNSName(lookupInput)}"`);
      }
    } catch {
      setLookupError('Lookup failed. Please try again.');
    }
  }, [lookupInput]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const canRegister = validation?.valid && availability?.available && !ruleError && walletAddress && !registering;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 80px" }}>
      {/* Header */}
      <div className="pl-12 sm:pl-0" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #F97316, #EA580C)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GlobeIcon size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F4F4F5", margin: 0 }}>
              Vaultfire Name System
            </h1>
            <p style={{ fontSize: 13, color: "#71717A", margin: 0 }}>
              Your on-chain identity — free, permanent, ungameable
            </p>
          </div>
        </div>
      </div>

      {/* VNS Disclaimer */}
      <DisclaimerBanner disclaimerKey="vns" mode="inline" />

      {/* My VNS Badge */}
      {myVNS && (
        <div style={{
          ...card, padding: 16, marginBottom: 20,
          borderColor: getIdentityTypeColor(myType || 'human') + '30',
          background: getIdentityTypeColor(myType || 'human') + '08',
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: getIdentityTypeColor(myType || 'human') + '20',
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {myType === 'agent' ? <BotIcon size={16} /> : myType === 'companion' ? <HeartIcon size={16} /> : <UserIcon size={16} />}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#F4F4F5" }}>{myVNS}.vns</div>
                <div style={{ fontSize: 11, color: getIdentityTypeColor(myType || 'human') }}>
                  {getIdentityTypeLabel(myType || 'human')} · Registered
                </div>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(`${myVNS}.vns`)}
              style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12 }}
            >
              {copied ? "Copied!" : <CopyIcon size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <div style={{ ...card, padding: "12px 16px", flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#F97316" }}>{totalRegistrations}</div>
          <div style={{ fontSize: 11, color: "#71717A" }}>On-Chain Names</div>
        </div>
        <div style={{ ...card, padding: "12px 16px", flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#22C55E" }}>Free</div>
          <div style={{ fontSize: 11, color: "#71717A" }}>Gas Only</div>
        </div>
        <div style={{ ...card, padding: "12px 16px", flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#8B5CF6" }}>2</div>
          <div style={{ fontSize: 11, color: "#71717A" }}>Chains</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 4 }}>
        {(['register', 'lookup'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, border: "none",
              background: tab === t ? "rgba(249,115,22,0.15)" : "transparent",
              color: tab === t ? "#F97316" : "#71717A",
              fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            {t === 'register' ? 'Register' : 'Lookup'}
          </button>
        ))}
      </div>

      {tab === 'register' ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Wallet Check */}
          {!isWalletCreated() && (
            <div style={{
              ...card, padding: 16,
              borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)",
            }}>
              <p style={{ fontSize: 13, color: "#EF4444", margin: 0 }}>
                Create a wallet first to register a .vns name.
              </p>
            </div>
          )}

          {/* Identity Type Selection */}
          <div>
            <label style={label}>Identity Type</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <IdentityTypeCard
                type="human"
                selected={identityType === 'human'}
                disabled={!!humanVNS}
                disabledReason={humanVNS ? `Already registered: ${humanVNS}.vns` : undefined}
                onClick={() => !humanVNS && setIdentityType('human')}
              />
              <IdentityTypeCard
                type="companion"
                selected={identityType === 'companion'}
                disabled={!!companionVNS || !humanVNS}
                disabledReason={
                  companionVNS ? `Already registered: ${companionVNS}.vns` :
                  !humanVNS ? 'Register a human identity first' : undefined
                }
                onClick={() => !companionVNS && humanVNS ? setIdentityType('companion') : undefined}
              />
              <IdentityTypeCard
                type="agent"
                selected={identityType === 'agent'}
                disabled={false}
                onClick={() => setIdentityType('agent')}
              />
            </div>
            {agentVNSNames.length > 0 && identityType === 'agent' && (
              <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(139,92,246,0.06)" }}>
                <div style={{ fontSize: 11, color: "#8B5CF6", marginBottom: 4 }}>Your agents:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {agentVNSNames.map(n => (
                    <span key={n} style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 6,
                      background: "rgba(139,92,246,0.1)", color: "#A78BFA",
                    }}>{n}.vns</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Name Input */}
          <div>
            <label style={label}>Choose your .vns name</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="yourname"
                style={{
                  ...inputStyle,
                  paddingRight: 60,
                  borderColor: validation && !validation.valid ? "rgba(239,68,68,0.5)" :
                    availability?.available ? "rgba(34,197,94,0.5)" :
                    availability && !availability.available ? "rgba(239,68,68,0.5)" :
                    "rgba(255,255,255,0.1)",
                }}
                maxLength={32}
              />
              <span style={{
                position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                fontSize: 14, color: "#52525B", fontWeight: 500,
              }}>.vns</span>
            </div>

            {/* Real-time validation feedback */}
            {nameInput && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {/* Format validation */}
                {validation && !validation.valid && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <XIcon size={14} />
                    <span style={{ fontSize: 12, color: "#EF4444" }}>{validation.error}</span>
                  </div>
                )}
                {/* Availability */}
                {validation?.valid && availability && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {availability.available ? (
                      <>
                        <CheckIcon size={14} />
                        <span style={{ fontSize: 12, color: "#22C55E" }}>
                          {availability.name}.vns is available
                        </span>
                      </>
                    ) : (
                      <>
                        <XIcon size={14} />
                        <span style={{ fontSize: 12, color: "#EF4444" }}>
                          {availability.name}.vns is taken
                        </span>
                      </>
                    )}
                  </div>
                )}
                {/* Anti-gaming rule violation */}
                {ruleError && (
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: 6,
                    padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.06)",
                    marginTop: 4,
                  }}>
                    <ShieldIcon size={14} />
                    <span style={{ fontSize: 12, color: "#EF4444", lineHeight: 1.4 }}>{ruleError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chain Selection */}
          <div>
            <label style={label}>Chain</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(['ethereum', 'base', 'avalanche'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setChain(c)}
                  style={{
                    ...btnSecondary, flex: 1, textAlign: "center",
                    borderColor: chain === c ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.1)",
                    background: chain === c ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.03)",
                    color: chain === c ? "#F97316" : "#A1A1AA",
                  }}
                >
                  {c === 'ethereum' ? 'Ethereum' : c === 'base' ? 'Base' : 'Avalanche'}
                </button>
              ))}
            </div>
          </div>

          {/* Bond Amount (agents only) */}
          {identityType === 'agent' && (
            <div>
              <label style={label}>
                Accountability Bond ({chain === 'avalanche' ? 'AVAX' : 'ETH'})
              </label>
              <input
                type="number"
                value={bondAmount}
                onChange={e => setBondAmount(e.target.value)}
                min="0.01"
                step="0.01"
                style={inputStyle}
              />
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#71717A" }}>Trust tier:</span>
                {(() => {
                  const tier = getBondTier(parseFloat(bondAmount) || 0);
                  const info = getBondTierInfo(tier);
                  return (
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: info.color,
                      padding: "2px 8px", borderRadius: 6,
                      background: `${info.color}15`,
                    }}>
                      {info.label}
                    </span>
                  );
                })()}
                <span style={{ fontSize: 11, color: "#52525B" }}>
                  Min: 0.01 · Silver: 0.05 · Gold: 0.1 · Platinum: 0.5
                </span>
              </div>
            </div>
          )}

          {/* Gas Estimate */}
          {gasEstimate && (
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#71717A" }}>Estimated gas fee</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#D4D4D8" }}>
                  {gasEstimate.totalFeeFormatted} {gasEstimate.gasSymbol}
                </span>
              </div>
            </div>
          )}

          {/* Register Button */}
          <button
            onClick={handleRegister}
            disabled={!canRegister}
            style={{
              ...btnPrimary,
              opacity: canRegister ? 1 : 0.4,
              cursor: canRegister ? "pointer" : "not-allowed",
            }}
          >
            {registering ? "Registering on-chain..." :
             `Register ${nameInput || 'name'}.vns as ${getIdentityTypeLabel(identityType)}`}
          </button>

          {/* Result */}
          {result && (
            <div style={{
              ...card, padding: 16,
              borderColor: result.success ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
              background: result.success ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                {result.success ? <CheckIcon size={16} /> : <XIcon size={16} />}
                <span style={{
                  fontSize: 14, fontWeight: 600,
                  color: result.success ? "#22C55E" : "#EF4444",
                }}>
                  {result.success ? "Registered!" : "Failed"}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "#A1A1AA", margin: 0 }}>{result.message}</p>
              {result.explorerUrl && (
                <a
                  href={result.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 12, color: "#F97316", marginTop: 8, textDecoration: "none",
                  }}
                >
                  <LinkIcon size={12} /> View on Explorer
                </a>
              )}
            </div>
          )}

          {/* Anti-Gaming Rules */}
          <AntiGamingRules />
        </div>
      ) : (
        /* ── Lookup Tab ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={label}>Search by .vns name</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={lookupInput}
                onChange={e => setLookupInput(e.target.value)}
                placeholder="ghostkey316.vns"
                style={{ ...inputStyle, flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
              />
              <button onClick={handleLookup} style={{ ...btnPrimary, width: "auto", padding: "14px 20px" }}>
                <SearchIcon size={18} />
              </button>
            </div>
          </div>

          {lookupError && (
            <div style={{ ...card, padding: 16, borderColor: "rgba(239,68,68,0.2)" }}>
              <p style={{ fontSize: 13, color: "#EF4444", margin: 0 }}>{lookupError}</p>
            </div>
          )}

          {lookupResult && (
            <div style={{ ...card, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: `${getIdentityTypeColor(lookupResult.identityType)}15`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {lookupResult.identityType === 'agent' ? <BotIcon size={22} /> :
                   lookupResult.identityType === 'companion' ? <HeartIcon size={22} /> :
                   <UserIcon size={22} />}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#F4F4F5" }}>
                    {lookupResult.fullName}
                  </div>
                  <div style={{
                    fontSize: 12, color: getIdentityTypeColor(lookupResult.identityType),
                    display: "inline-block", padding: "2px 8px", borderRadius: 6,
                    background: `${getIdentityTypeColor(lookupResult.identityType)}15`,
                  }}>
                    {getIdentityTypeLabel(lookupResult.identityType)}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 13, color: "#71717A" }}>Address</span>
                  <span style={{ fontSize: 13, color: "#D4D4D8", fontFamily: "monospace" }}>
                    {lookupResult.address.slice(0, 10)}...{lookupResult.address.slice(-6)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 13, color: "#71717A" }}>Chain</span>
                  <span style={{ fontSize: 13, color: "#D4D4D8" }}>{lookupResult.chain}</span>
                </div>
                {lookupResult.bondTier && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize: 13, color: "#71717A" }}>Bond Tier</span>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: getBondTierInfo(lookupResult.bondTier).color,
                    }}>
                      {getBondTierInfo(lookupResult.bondTier).label}
                    </span>
                  </div>
                )}
                {lookupResult.explorerUrl && (
                  <a
                    href={lookupResult.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "10px", borderRadius: 10,
                      background: "rgba(249,115,22,0.08)", color: "#F97316",
                      fontSize: 13, fontWeight: 500, textDecoration: "none", marginTop: 8,
                    }}
                  >
                    <LinkIcon size={14} /> View on Explorer
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
