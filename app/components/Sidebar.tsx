"use client";
import { useState, useEffect, useCallback } from "react";
import { getThemePreference, toggleTheme, type ThemeMode } from "../lib/theme";
import { getUnreadCount } from "../lib/notifications";

type Section = "home" | "chat" | "wallet" | "verify" | "bridge" | "dashboard" | "sync" | "trust" | "analytics" | "vns" | "agent-hub" | "marketplace" | "ns3";

const Icons: Record<string, (props: { size?: number; color?: string }) => React.ReactElement> = {
  home: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  chat: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  wallet: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
    </svg>
  ),
  verify: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  bridge: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /><line x1="7" y1="12" x2="17" y2="12" /><polyline points="14 9 17 12 14 15" />
    </svg>
  ),
  dashboard: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  sync: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  ),
  trust: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  analytics: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  vns: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  agentHub: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /><path d="M9 1v3" /><path d="M15 1v3" /><path d="M9 20v3" /><path d="M15 20v3" /><path d="M20 9h3" /><path d="M20 14h3" /><path d="M1 9h3" /><path d="M1 14h3" />
    </svg>
  ),
  marketplace: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-3-5z" /><line x1="3" y1="7" x2="21" y2="7" /><path d="M16 11a4 4 0 0 1-8 0" />
    </svg>
  ),
  ns3: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M12 8v4" /><path d="M12 16h.01" />
    </svg>
  ),
  sun: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  moon: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  bell: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
};

const NAV_ITEMS: { id: Section; label: string; iconKey: string; group?: string }[] = [
  { id: "home", label: "Home", iconKey: "home" },
  { id: "chat", label: "Embris", iconKey: "chat" },
  { id: "wallet", label: "Wallet", iconKey: "wallet" },
  { id: "vns", label: "VNS Identity", iconKey: "vns", group: "Identity" },
  { id: "agent-hub", label: "Agent Hub", iconKey: "agentHub", group: "Agents" },
  { id: "marketplace", label: "Marketplace", iconKey: "marketplace" },
  { id: "ns3", label: "ZK Proofs", iconKey: "ns3" },
  { id: "verify", label: "Contracts", iconKey: "verify", group: "Protocol" },
  { id: "bridge", label: "Bridge", iconKey: "bridge" },
  { id: "dashboard", label: "Dashboard", iconKey: "dashboard" },
  { id: "trust", label: "Trust Score", iconKey: "trust" },
  { id: "analytics", label: "Analytics", iconKey: "analytics" },
  { id: "sync", label: "Data", iconKey: "sync" },
];

function EmbrisLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
      <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
      <path d="M16 14c-.7 1-1.4 2.2-1.4 3.2 0 .77.63 1.4 1.4 1.4s1.4-.63 1.4-1.4c0-1-.7-2.2-1.4-3.2z" fill="#FDE68A" opacity="0.6" />
    </svg>
  );
}

// Animated hamburger icon
function HamburgerIcon({ isOpen, size = 17 }: { isOpen: boolean; size?: number }) {
  const lineStyle: React.CSSProperties = {
    display: 'block',
    width: size,
    height: 1.5,
    backgroundColor: '#A1A1AA',
    borderRadius: 2,
    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
    transformOrigin: 'center',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4.5, width: size, alignItems: 'center' }}>
      <span style={{
        ...lineStyle,
        transform: isOpen ? `translateY(6px) rotate(45deg)` : 'none',
      }} />
      <span style={{
        ...lineStyle,
        opacity: isOpen ? 0 : 1,
        transform: isOpen ? 'scaleX(0)' : 'none',
      }} />
      <span style={{
        ...lineStyle,
        transform: isOpen ? `translateY(-6px) rotate(-45deg)` : 'none',
      }} />
    </div>
  );
}

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
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setTheme(getThemePreference());
    setUnreadCount(getUnreadCount());
    const interval = setInterval(() => setUnreadCount(getUnreadCount()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Respond to swipe-to-open from parent
  useEffect(() => {
    if (mobileForceOpen) {
      setMobileOpen(true);
    }
  }, [mobileForceOpen]);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    onMobileClose?.();
  }, [onMobileClose]);

  const handleNav = useCallback((id: string) => {
    onSectionChange(id);
    if (isMobile) closeMobile();
  }, [onSectionChange, isMobile, closeMobile]);

  const handleThemeToggle = useCallback(() => {
    const next = toggleTheme(theme);
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  }, [theme]);

  const NavButton = ({ item }: { item: typeof NAV_ITEMS[0] }) => {
    const isActive = activeSection === item.id;
    const isHovered = hoveredItem === item.id;
    const IconComponent = Icons[item.iconKey];

    return (
      <button
        key={item.id}
        onClick={() => handleNav(item.id)}
        onMouseEnter={() => setHoveredItem(item.id)}
        onMouseLeave={() => setHoveredItem(null)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "9px 14px",
          borderRadius: 8, border: "none", cursor: "pointer",
          textAlign: "left", width: "100%",
          backgroundColor: isActive
            ? "rgba(255,255,255,0.05)"
            : isHovered
              ? "rgba(255,255,255,0.025)"
              : "transparent",
          color: isActive ? "#F4F4F5" : "#71717A",
          transition: "background-color 0.12s ease, color 0.12s ease",
          position: "relative",
          // Minimum touch target
          minHeight: 40,
        }}
        aria-current={isActive ? 'page' : undefined}
      >
        {/* Active indicator bar */}
        {isActive && (
          <span style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 2,
            height: 16,
            backgroundColor: '#F97316',
            borderRadius: '0 2px 2px 0',
            opacity: 0.85,
            transition: 'all 0.15s ease',
          }} />
        )}

        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', transition: 'transform 0.12s ease' }}>
          <IconComponent
            size={16}
            color={isActive ? "#F97316" : isHovered ? "#A1A1AA" : "#52525B"}
          />
        </span>
        <span style={{
          fontSize: 13.5, fontWeight: isActive ? 500 : 400,
          whiteSpace: "nowrap", letterSpacing: "-0.01em",
          transition: 'color 0.12s ease',
        }}>
          {item.label}
        </span>
      </button>
    );
  };

  const SidebarContent = () => {
    let lastGroup: string | undefined = undefined;
    return (
      <>
        {/* Embris brand header */}
        <div style={{
          padding: "24px 18px 20px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <EmbrisLogo size={22} />
          <div>
            <h1 style={{
              fontSize: 15, fontWeight: 600, color: "#F4F4F5",
              margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2,
            }}>Embris</h1>
            <p style={{
              fontSize: 10, color: "#3F3F46", margin: 0,
              fontWeight: 400, letterSpacing: "0.02em",
            }}>Powered by Vaultfire</p>
          </div>
        </div>

        {/* Nav */}
        <nav style={{
          flex: 1, padding: "4px 10px",
          display: "flex", flexDirection: "column", gap: 2,
          overflowY: "auto",
        }}>
          {NAV_ITEMS.map((item) => {
            const showGroup = item.group && item.group !== lastGroup;
            if (item.group) lastGroup = item.group;
            return (
              <div key={item.id}>
                {showGroup && (
                  <div style={{
                    fontSize: 10, fontWeight: 500, color: "#3F3F46",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    padding: "12px 14px 4px",
                  }}>
                    {item.group}
                  </div>
                )}
                <NavButton item={item} />
              </div>
            );
          })}
        </nav>

        {/* Footer controls */}
        <div style={{ padding: "12px 14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {unreadCount > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", borderRadius: 6,
              backgroundColor: "rgba(249,115,22,0.06)",
            }}>
              <Icons.bell size={13} color="#F97316" />
              <span style={{ fontSize: 11, color: "#F97316", fontWeight: 500 }}>
                {unreadCount} notification{unreadCount > 1 ? 's' : ''}
              </span>
            </div>
          )}

          <button
            onClick={handleThemeToggle}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", borderRadius: 6,
              backgroundColor: "transparent",
              border: "none", cursor: "pointer",
              color: "#52525B", width: "100%", textAlign: "left",
              transition: "color 0.15s ease",
              minHeight: 32,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#A1A1AA'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#52525B'; }}
          >
            {theme === 'dark' ? <Icons.sun size={13} color="currentColor" /> : <Icons.moon size={13} color="currentColor" />}
            <span style={{ fontSize: 11, fontWeight: 400 }}>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>

          <p style={{ fontSize: 10, color: "#27272A", fontWeight: 400, letterSpacing: "0.01em", padding: "0 4px" }}>
            v2.0 · theloopbreaker.com
          </p>
        </div>
      </>
    );
  };

  if (isMobile) {
    return (
      <>
        {/* Hamburger button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            position: "fixed", top: 12, left: 12, zIndex: 1000,
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(9,9,11,0.92)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.04)",
            color: "#A1A1AA", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "background-color 0.15s ease, border-color 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(24,24,27,0.95)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(9,9,11,0.92)'; }}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <HamburgerIcon isOpen={mobileOpen} size={17} />
        </button>

        {/* Overlay */}
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

        {/* Sidebar panel */}
        <aside
          style={{
            position: "fixed", top: 0, left: 0,
            width: 248, height: "100vh",
            background: "#0C0C0E",
            zIndex: 1002, display: "flex", flexDirection: "column",
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-260px)',
            transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
            willChange: 'transform',
          }}
        >
          {/* Close button inside sidebar */}
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

  // Desktop: permanent sidebar
  return (
    <aside
      style={{
        width: 220, minWidth: 220,
        background: "#0C0C0E",
        display: "flex", flexDirection: "column",
      }}
    >
      <SidebarContent />
    </aside>
  );
}
