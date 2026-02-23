'use client';

import { useState, useEffect } from 'react';
import { getThemePreference, toggleTheme, type ThemeMode } from '../lib/theme';

/* ─────────────────────────────────────────────
   Settings Section
   ───────────────────────────────────────────── */

const VERSION = '0.9.0';
const BUILD_DATE = 'Feb 2026';
const NOTIF_PREFS_KEY = 'embris_notif_prefs';
const DEFAULT_CHAIN_KEY = 'embris_default_chain';

type DefaultChain = 'base' | 'avalanche' | 'ethereum';

interface NotificationPreferences {
  transactions: boolean;
  agentActivity: boolean;
  trustUpdates: boolean;
  systemAlerts: boolean;
}

const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  transactions: true,
  agentActivity: true,
  trustUpdates: false,
  systemAlerts: true,
};

const CHAIN_OPTIONS: { id: DefaultChain; name: string; color: string; desc: string }[] = [
  { id: 'base', name: 'Base', color: '#2151F5', desc: 'Coinbase L2 · Fast & cheap' },
  { id: 'avalanche', name: 'Avalanche', color: '#E84142', desc: 'High throughput · Sub-second finality' },
  { id: 'ethereum', name: 'Ethereum', color: '#627EEA', desc: 'Mainnet · Maximum security' },
];

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '16px 20px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#F4F4F5', letterSpacing: '-0.01em' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: '#52525B', marginTop: 2, lineHeight: 1.4 }}>{description}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 13,
        backgroundColor: value ? '#F97316' : '#27272A',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background-color 0.2s ease',
        flexShrink: 0,
      }}
      aria-checked={value}
      role="switch"
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%',
        backgroundColor: '#FFFFFF',
        transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }} />
    </button>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: 'rgba(24,24,27,0.6)',
      border: '1px solid rgba(63,63,70,0.4)',
      borderRadius: 16, overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px 10px',
        borderBottom: '1px solid rgba(63,63,70,0.3)',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#52525B',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: 'rgba(63,63,70,0.3)', margin: '0 20px' }} />;
}

export default function Settings() {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [defaultChain, setDefaultChain] = useState<DefaultChain>('base');
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIF_PREFS);
  const [isMobile, setIsMobile] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    setTheme(getThemePreference());

    // Load notification prefs
    try {
      const raw = localStorage.getItem(NOTIF_PREFS_KEY);
      if (raw) setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) });
    } catch { /* ignore */ }

    // Load default chain
    const savedChain = localStorage.getItem(DEFAULT_CHAIN_KEY) as DefaultChain | null;
    if (savedChain && CHAIN_OPTIONS.find(c => c.id === savedChain)) setDefaultChain(savedChain);
  }, []);

  const handleThemeToggle = () => {
    const next = toggleTheme(theme);
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    flashSaved();
  };

  const handleNotifChange = (key: keyof NotificationPreferences, value: boolean) => {
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    try { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    flashSaved();
  };

  const handleChainChange = (chain: DefaultChain) => {
    setDefaultChain(chain);
    localStorage.setItem(DEFAULT_CHAIN_KEY, chain);
    flashSaved();
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{
      maxWidth: 560, margin: '0 auto',
      padding: isMobile ? '24px 16px 80px' : '40px 24px 60px',
      display: 'flex', flexDirection: 'column', gap: 24,
    }}>
      {/* Header */}
      <div>
        <h1 style={{
          fontSize: isMobile ? 26 : 30, fontWeight: 700,
          color: '#F4F4F5', letterSpacing: '-0.04em', margin: 0, lineHeight: 1.2,
        }}>Settings</h1>
        <p style={{ fontSize: 14, color: '#52525B', marginTop: 6, lineHeight: 1.5 }}>
          Manage your Embris preferences
        </p>
        {saved && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 10, padding: '5px 12px', borderRadius: 8,
            backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22C55E' }} />
            <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 500 }}>Saved</span>
          </div>
        )}
      </div>

      {/* Appearance */}
      <SectionCard title="Appearance">
        <SettingRow
          label="Dark Mode"
          description="Use dark theme across the app"
        >
          <Toggle value={theme === 'dark'} onChange={handleThemeToggle} />
        </SettingRow>
      </SectionCard>

      {/* Network */}
      <SectionCard title="Network">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: '#71717A', marginBottom: 4, lineHeight: 1.4 }}>
            Choose which chain to default to for new transactions and agent registrations.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CHAIN_OPTIONS.map((chain) => (
              <button
                key={chain.id}
                onClick={() => handleChainChange(chain.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 12,
                  backgroundColor: defaultChain === chain.id ? 'rgba(249,115,22,0.06)' : 'rgba(24,24,27,0.4)',
                  border: `1px solid ${defaultChain === chain.id ? 'rgba(249,115,22,0.2)' : 'rgba(63,63,70,0.4)'}`,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease',
                  minHeight: 44,
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  backgroundColor: chain.color, flexShrink: 0,
                  boxShadow: defaultChain === chain.id ? `0 0 8px ${chain.color}60` : 'none',
                  transition: 'box-shadow 0.2s ease',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: defaultChain === chain.id ? '#F4F4F5' : '#A1A1AA' }}>
                    {chain.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#52525B', marginTop: 1 }}>{chain.desc}</div>
                </div>
                {defaultChain === chain.id && (
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Notifications */}
      <SectionCard title="Notifications">
        <SettingRow
          label="Transactions"
          description="Alerts for sends, receives, and swaps"
        >
          <Toggle value={notifPrefs.transactions} onChange={(v) => handleNotifChange('transactions', v)} />
        </SettingRow>
        <Divider />
        <SettingRow
          label="Agent Activity"
          description="Updates from registered agents"
        >
          <Toggle value={notifPrefs.agentActivity} onChange={(v) => handleNotifChange('agentActivity', v)} />
        </SettingRow>
        <Divider />
        <SettingRow
          label="Trust Updates"
          description="Changes to trust scores and badges"
        >
          <Toggle value={notifPrefs.trustUpdates} onChange={(v) => handleNotifChange('trustUpdates', v)} />
        </SettingRow>
        <Divider />
        <SettingRow
          label="System Alerts"
          description="Protocol updates and maintenance"
        >
          <Toggle value={notifPrefs.systemAlerts} onChange={(v) => handleNotifChange('systemAlerts', v)} />
        </SettingRow>
      </SectionCard>

      {/* About */}
      <SectionCard title="About">
        <div style={{ padding: '20px' }}>
          {/* Brand header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))',
              border: '1px solid rgba(249,115,22,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width={24} height={24} viewBox="0 0 32 32" fill="none">
                <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
                <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
                <path d="M16 14c-.7 1-1.4 2.2-1.4 3.2 0 .77.63 1.4 1.4 1.4s1.4-.63 1.4-1.4c0-1-.7-2.2-1.4-3.2z" fill="#FDE68A" opacity="0.6" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.02em' }}>Embris</div>
              <div style={{ fontSize: 12, color: '#52525B', marginTop: 1 }}>by Vaultfire Protocol</div>
            </div>
          </div>

          {/* Version table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Version', value: `v${VERSION}` },
              { label: 'Build', value: BUILD_DATE },
              { label: 'Protocol', value: 'Vaultfire v0.9.0' },
              { label: 'Messaging', value: 'XMTP v3' },
              { label: 'Payments', value: 'x402 · EIP-3009' },
              { label: 'Identity', value: 'VNS · On-chain' },
              { label: 'Chains', value: 'Base · Avalanche · Ethereum' },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 0',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(63,63,70,0.2)' : 'none',
              }}>
                <span style={{ fontSize: 13, color: '#71717A' }}>{label}</span>
                <span style={{ fontSize: 13, color: '#A1A1AA', fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Privacy note */}
          <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.08)' }}>
            <p style={{ fontSize: 11, color: '#52525B', margin: 0, lineHeight: 1.6 }}>
              Embris is a decentralized protocol for human-agent collaboration. All wallet data is stored locally on your device. No personal data is collected or transmitted to any server.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Data & Privacy */}
      <SectionCard title="Data & Privacy">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#71717A', margin: 0, lineHeight: 1.6 }}>
            All your data — wallet keys, spending limits, trust settings, and preferences — is stored locally on your device. Nothing is sent to any server.
          </p>
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.confirm('Clear all local app data? This will remove your wallet, settings, and preferences. This cannot be undone.')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            style={{
              padding: '10px 16px', borderRadius: 10,
              backgroundColor: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)',
              color: '#EF4444', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s ease',
              minHeight: 44,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.06)'; }}
          >
            Clear All Local Data
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
