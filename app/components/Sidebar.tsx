"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getThemePreference, toggleTheme, type ThemeMode } from "../lib/theme";
import { getUnreadCount } from "../lib/notifications";
import { useWalletAuth } from "../lib/WalletAuthContext";
import { isWalletCreated } from "../lib/wallet";

/* ═══════════════════════════════════════════════════════
   SECTION TYPE — all navigable sections in the app
   ═══════════════════════════════════════════════════════ */
export type Section =
  | "home" | "chat" | "companion-agent"
  | "account" | "wallet" | "swap"
  | "vns" | "trust" | "zk-proofs" | "trust-badges"
  | "agent-hub" | "marketplace" | "earnings" | "agent-api"
  | "bridge" | "verify" | "sync" | "analytics"
  | "sdk"
  | "settings";

/* ═══════════════════════════════════════════════════════
   ICONS — lightweight inline SVGs
   ═══════════════════════════════════════════════════════ */
const I = {
  home: (s = 16, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  companion: (s = 16, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill={c} opacity="0.9" />
      <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill={c} opacity="0.6" />
    </svg>
  ),
  wallet: (s = 16, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
    </svg>
  ),
  identity: (s = 16, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  agentHub: (s = 16, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /><path d="M9 1v3" /><path d="M15 1v3" /><path d="M9 20v3" /><path d="M15 20v3" /><path d="M20 9h3" /><path d="M20 14h3" /><path d="M1 9h3" /><path d="M1 14h3" />
    </svg>
  ),
  swap: (s = 16, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  bridge: (s = 16, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /><line x1="7" y1="12" x2="17" y2="12" /><polyline points="14 9 17 12 14 15" />
    </svg>
  ),
  settings: (s = 16, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  chevron: (s = 12, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  bell: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  // Sub-item icons
  chat: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  dashboard: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  send: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  user: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  vns: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22 6 12 13 2 6" />
    </svg>
  ),
  trust: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  shield: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
    </svg>
  ),
  badge: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  rooms: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  marketplace: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-3-5z" /><line x1="3" y1="7" x2="21" y2="7" /><path d="M16 11a4 4 0 0 1-8 0" />
    </svg>
  ),
  earnings: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  sdk: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  teleporter: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  contracts: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  analytics: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  data: (s = 14, c = "currentColor") => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════
   NAV STRUCTURE — 7 grouped categories
   ═══════════════════════════════════════════════════════ */
interface SubItem {
  id: Section;
  label: string;
  iconFn: (s?: number, c?: string) => React.ReactElement;
}

interface NavGroup {
  id: string;
  label: string;
  iconFn: (s?: number, c?: string) => React.ReactElement;
  /** If set, clicking the group header navigates here directly (leaf node) */
  directSection?: Section;
  children?: SubItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "home",
    label: "Home",
    iconFn: I.home,
    directSection: "home",
  },
  {
    id: "companion",
    label: "Companion",
    iconFn: I.companion,
    children: [
      { id: "chat", label: "Chat", iconFn: I.chat },
      { id: "companion-agent", label: "Agent Dashboard", iconFn: I.dashboard },
    ],
  },
  {
    id: "wallet",
    label: "Wallet",
    iconFn: I.wallet,
    children: [
      { id: "wallet", label: "Balances", iconFn: I.wallet },
      { id: "swap", label: "Swap", iconFn: I.swap },
      { id: "account", label: "Account / Login", iconFn: I.user },
    ],
  },
  {
    id: "identity",
    label: "Identity",
    iconFn: I.identity,
    children: [
      { id: "vns", label: "VNS Names", iconFn: I.vns },
      { id: "trust", label: "Trust Score", iconFn: I.trust },
      { id: "zk-proofs", label: "ZK Proofs", iconFn: I.shield },
      { id: "trust-badges", label: "Trust Badges", iconFn: I.badge },
    ],
  },
  {
    id: "agents",
    label: "Agent Hub",
    iconFn: I.agentHub,
    children: [
      { id: "agent-hub", label: "XMTP Rooms", iconFn: I.rooms },
      { id: "marketplace", label: "Directory", iconFn: I.marketplace },
      { id: "earnings", label: "Earnings", iconFn: I.earnings },
      { id: "sdk", label: "SDK / Developers", iconFn: I.sdk },
    ],
  },
  {
    id: "bridge",
    label: "Bridge & Protocol",
    iconFn: I.bridge,
    children: [
      { id: "bridge", label: "Teleporter", iconFn: I.teleporter },
      { id: "verify", label: "Contracts", iconFn: I.contracts },
      { id: "analytics", label: "Analytics", iconFn: I.analytics },
      { id: "sync", label: "Data Sync", iconFn: I.data },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    iconFn: I.settings,
    directSection: "settings",
  },
];

/* ═══════════════════════════════════════════════════════
   EMBRIS LOGO
   ═══════════════════════════════════════════════════════ */
function EmbrisLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
      <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
      <path d="M16 14c-.7 1-1.4 2.2-1.4 3.2 0 .77.63 1.4 1.4 1.4s1.4-.63 1.4-1.4c0-1-.7-2.2-1.4-3.2z" fill="#FDE68A" opacity="0.6" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   HAMBURGER ICON
   ═══════════════════════════════════════════════════════ */
function HamburgerIcon({ isOpen, size = 17 }: { isOpen: boolean; size?: number }) {
  const lineStyle: React.CSSProperties = {
    display: 'block', width: size, height: 1.5,
    backgroundColor: '#A1A1AA', borderRadius: 2,
    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
    transformOrigin: 'center',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4.5, width: size, alignItems: 'center' }}>
      <span style={{ ...lineStyle, transform: isOpen ? `translateY(6px) rotate(45deg)` : 'none' }} />
      <span style={{ ...lineStyle, opacity: isOpen ? 0 : 1, transform: isOpen ? 'scaleX(0)' : 'none' }} />
      <span style={{ ...lineStyle, transform: isOpen ? `translateY(-6px) rotate(-45deg)` : 'none' }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   HELPER: find which group a section belongs to
   ═══════════════════════════════════════════════════════ */
function findGroupForSection(section: string): string | null {
  for (const g of NAV_GROUPS) {
    if (g.directSection === section) return g.id;
    if (g.children?.some(c => c.id === section)) return g.id;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════
   SIDEBAR COMPONENT
   ═══════════════════════════════════════════════════════ */
interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  mobileForceOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ activeSection, onSectionChange, mobileForceOpen, onMobileClose }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { isUnlocked, address, logout } = useWalletAuth();

  // Auto-expand the group that contains the active section
  useEffect(() => {
    const group = findGroupForSection(activeSection);
    if (group) {
      setExpandedGroups(prev => {
        const next = new Set(prev);
        next.add(group);
        return next;
      });
    }
  }, [activeSection]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setUnreadCount(getUnreadCount());
    const interval = setInterval(() => setUnreadCount(getUnreadCount()), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mobileForceOpen) setMobileOpen(true);
  }, [mobileForceOpen]);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    onMobileClose?.();
  }, [onMobileClose]);

  const handleNav = useCallback((id: string) => {
    onSectionChange(id);
    if (isMobile) closeMobile();
  }, [onSectionChange, isMobile, closeMobile]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  /* ── Group Header Button ── */
  const GroupHeader = ({ group }: { group: NavGroup }) => {
    const isExpanded = expandedGroups.has(group.id);
    const isDirectActive = group.directSection === activeSection;
    const hasActiveChild = group.children?.some(c => c.id === activeSection) ?? false;
    const isGroupActive = isDirectActive || hasActiveChild;
    const isHovered = hoveredItem === `group-${group.id}`;

    const handleClick = () => {
      if (group.directSection) {
        handleNav(group.directSection);
      } else {
        toggleGroup(group.id);
        // If group has children and none is active, navigate to first child
        if (!isExpanded && group.children && !hasActiveChild) {
          handleNav(group.children[0].id);
        }
      }
    };

    return (
      <button
        onClick={handleClick}
        onMouseEnter={() => setHoveredItem(`group-${group.id}`)}
        onMouseLeave={() => setHoveredItem(null)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px", width: "100%",
          borderRadius: 8, border: "none", cursor: "pointer",
          textAlign: "left",
          backgroundColor: isGroupActive
            ? "rgba(249,115,22,0.06)"
            : isHovered ? "rgba(255,255,255,0.025)" : "transparent",
          color: isGroupActive ? "#F4F4F5" : "#A1A1AA",
          transition: "all 0.15s ease",
          position: "relative",
          minHeight: 38,
        }}
      >
        {/* Active indicator */}
        {isGroupActive && (
          <span style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            width: 2.5, height: 16,
            backgroundColor: '#F97316', borderRadius: '0 2px 2px 0',
            opacity: 0.9,
          }} />
        )}
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {group.iconFn(16, isGroupActive ? "#F97316" : isHovered ? "#D4D4D8" : "#71717A")}
        </span>
        <span style={{
          flex: 1, fontSize: 13, fontWeight: isGroupActive ? 600 : 450,
          letterSpacing: "-0.01em",
        }}>
          {group.label}
        </span>
        {group.children && (
          <span style={{
            display: 'flex', alignItems: 'center',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            opacity: 0.4,
          }}>
            {I.chevron(10, "currentColor")}
          </span>
        )}
      </button>
    );
  };

  /* ── Sub-Item Button ── */
  const SubItemButton = ({ item }: { item: SubItem }) => {
    const isActive = activeSection === item.id;
    const isHovered = hoveredItem === item.id;

    return (
      <button
        onClick={() => handleNav(item.id)}
        onMouseEnter={() => setHoveredItem(item.id)}
        onMouseLeave={() => setHoveredItem(null)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px 6px 38px", width: "100%",
          borderRadius: 6, border: "none", cursor: "pointer",
          textAlign: "left",
          backgroundColor: isActive
            ? "rgba(249,115,22,0.08)"
            : isHovered ? "rgba(255,255,255,0.02)" : "transparent",
          color: isActive ? "#F97316" : isHovered ? "#D4D4D8" : "#71717A",
          transition: "all 0.12s ease",
          minHeight: 32,
        }}
      >
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.7 }}>
          {item.iconFn(13, isActive ? "#F97316" : isHovered ? "#A1A1AA" : "#52525B")}
        </span>
        <span style={{
          fontSize: 12.5, fontWeight: isActive ? 550 : 400,
          letterSpacing: "-0.005em",
        }}>
          {item.label}
        </span>
      </button>
    );
  };

  /* ── Sidebar Content ── */
  const SidebarContent = () => (
    <>
      {/* Brand header */}
      <div style={{
        padding: "22px 16px 16px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div className="glow-pulse" style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <EmbrisLogo size={22} />
        </div>
        <div>
          <h1 style={{
            fontSize: 15, fontWeight: 700, color: "#F4F4F5",
            margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2,
          }}>Embris</h1>
          <p style={{
            fontSize: 10, color: "#3F3F46", margin: 0,
            fontWeight: 400, letterSpacing: "0.02em",
          }}>Powered by Vaultfire</p>
        </div>
      </div>

      {/* Wallet status */}
      <div style={{ padding: "0 10px 10px" }}>
        {isUnlocked && address ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 11px", borderRadius: 10,
            backgroundColor: "rgba(249,115,22,0.05)",
            border: "1px solid rgba(249,115,22,0.1)",
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              backgroundColor: "#22C55E", flexShrink: 0,
              boxShadow: "0 0 6px rgba(34,197,94,0.5)",
            }} />
            <button
              onClick={() => handleNav("wallet")}
              style={{
                flex: 1, background: "none", border: "none", cursor: "pointer",
                textAlign: "left", padding: 0,
              }}
            >
              <div style={{ fontSize: 10, color: "#F97316", fontWeight: 600, lineHeight: 1.2 }}>Connected</div>
              <div style={{ fontSize: 9.5, color: "#71717A", fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>
                {address.slice(0, 6)}...{address.slice(-4)}
              </div>
            </button>
            <button
              onClick={logout}
              title="Lock wallet"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#52525B", padding: 2, borderRadius: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "color 0.15s ease", flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#A1A1AA'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#52525B'; }}
            >
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => handleNav("account")}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 10,
              backgroundColor: "rgba(249,115,22,0.06)",
              border: "1px solid rgba(249,115,22,0.12)",
              color: "#F97316", fontSize: 12, fontWeight: 600,
              cursor: "pointer", textAlign: "center",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.06)'; }}
          >
            Connect Wallet
          </button>
        )}
      </div>

      {/* Navigation groups */}
      <nav style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: "4px 8px",
        scrollbarWidth: "none",
      }}>
        <style>{`nav::-webkit-scrollbar { display: none; }`}</style>
        {NAV_GROUPS.map(group => {
          const isExpanded = expandedGroups.has(group.id);
          return (
            <div key={group.id} style={{ marginBottom: 2 }}>
              <GroupHeader group={group} />
              {/* Animated sub-items */}
              {group.children && (
                <div style={{
                  overflow: 'hidden',
                  maxHeight: isExpanded ? `${group.children.length * 36 + 8}px` : '0px',
                  opacity: isExpanded ? 1 : 0,
                  transition: 'max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
                  paddingTop: isExpanded ? 2 : 0,
                  paddingBottom: isExpanded ? 4 : 0,
                }}>
                  {group.children.map(child => (
                    <SubItemButton key={child.id} item={child} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "6px 10px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ height: 1, backgroundColor: "rgba(63,63,70,0.2)", margin: "0 4px 4px" }} />
        {unreadCount > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 12px", borderRadius: 8, marginBottom: 2,
            backgroundColor: "rgba(249,115,22,0.05)",
            border: "1px solid rgba(249,115,22,0.08)",
          }}>
            {I.bell(12, "#F97316")}
            <span style={{ fontSize: 10, color: "#F97316", fontWeight: 500 }}>
              {unreadCount} notification{unreadCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
        <div style={{ padding: '4px 12px 2px' }}>
          <p style={{ fontSize: 9.5, color: '#27272A', fontWeight: 400, letterSpacing: '0.01em', marginBottom: 3 }}>
            v0.9.1 · Embris by Vaultfire
          </p>
          <p style={{ fontSize: 8, color: '#1A1A1E', fontStyle: 'italic', lineHeight: 1.5 }}>
            Morals over metrics
          </p>
        </div>
      </div>
    </>
  );

  /* ── Mobile Sidebar ── */
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            position: "fixed", top: 12, left: 12, zIndex: 1000,
            width: 44, height: 44, borderRadius: 10,
            background: "rgba(9,9,11,0.92)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.04)",
            color: "#A1A1AA", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "background-color 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(24,24,27,0.95)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(9,9,11,0.92)'; }}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <HamburgerIcon isOpen={mobileOpen} size={17} />
        </button>
        <div
          onClick={closeMobile}
          style={{
            position: "fixed", inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
            zIndex: 1001,
            opacity: mobileOpen ? 1 : 0,
            pointerEvents: mobileOpen ? 'auto' : 'none',
            transition: "opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
        <aside
          style={{
            position: "fixed", top: 0, left: 0,
            width: 260, height: "100dvh",
            background: "#0C0C0E",
            zIndex: 1002, display: "flex", flexDirection: "column",
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-280px)',
            transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
            willChange: 'transform',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
          }}
        >
          <div style={{ position: "absolute", top: 16, right: 14 }}>
            <button
              onClick={closeMobile}
              style={{
                background: "none", border: "none", color: "#52525B",
                cursor: "pointer", padding: 4, borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "color 0.15s ease",
                minHeight: 32, minWidth: 32,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#A1A1AA'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#52525B'; }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <SidebarContent />
        </aside>
      </>
    );
  }

  /* ── Desktop Sidebar ── */
  return (
    <aside
      style={{
        width: 230, minWidth: 230,
        background: "#0C0C0E",
        display: "flex", flexDirection: "column",
        borderRight: "1px solid rgba(255,255,255,0.03)",
      }}
    >
      <SidebarContent />
    </aside>
  );
}
