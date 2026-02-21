"use client";
import { useState, useEffect } from "react";

type Section = "home" | "chat" | "wallet" | "verify" | "bridge" | "dashboard" | "sync";

const Icons: Record<string, (props: { size?: number; color?: string }) => React.ReactElement> = {
  home: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  chat: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  wallet: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
    </svg>
  ),
  verify: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  bridge: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /><line x1="7" y1="12" x2="17" y2="12" /><polyline points="14 9 17 12 14 15" />
    </svg>
  ),
  dashboard: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  sync: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  ),
  menu: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  close: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

const NAV_ITEMS: { id: Section; label: string; iconKey: string }[] = [
  { id: "home", label: "Home", iconKey: "home" },
  { id: "chat", label: "Chat", iconKey: "chat" },
  { id: "wallet", label: "Wallet", iconKey: "wallet" },
  { id: "verify", label: "Verify", iconKey: "verify" },
  { id: "bridge", label: "Bridge", iconKey: "bridge" },
  { id: "dashboard", label: "Dashboard", iconKey: "dashboard" },
  { id: "sync", label: "Data", iconKey: "sync" },
];

function EmbrisLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.85" />
      <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
      <path d="M16 14c-.7 1-1.4 2.2-1.4 3.2 0 .77.63 1.4 1.4 1.4s1.4-.63 1.4-1.4c0-1-.7-2.2-1.4-3.2z" fill="#FDE68A" opacity="0.7" />
    </svg>
  );
}

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleNav = (id: string) => {
    onSectionChange(id);
    if (isMobile) setMobileOpen(false);
  };

  const NavButton = ({ item }: { item: typeof NAV_ITEMS[0] }) => {
    const isActive = activeSection === item.id;
    const IconComponent = Icons[item.iconKey];

    return (
      <button
        key={item.id}
        onClick={() => handleNav(item.id)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px",
          borderRadius: 8, border: "none", cursor: "pointer",
          textAlign: "left", width: "100%",
          backgroundColor: isActive ? "rgba(255,255,255,0.04)" : "transparent",
          color: isActive ? "#F97316" : "#71717A",
          transition: "all 0.15s ease",
        }}
      >
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <IconComponent size={17} color={isActive ? "#F97316" : "#71717A"} />
        </span>
        <span style={{
          fontSize: 13, fontWeight: isActive ? 500 : 400,
          whiteSpace: "nowrap", letterSpacing: "-0.01em",
        }}>
          {item.label}
        </span>
      </button>
    );
  };

  const SidebarContent = () => (
    <>
      {/* Embris brand header */}
      <div style={{
        padding: "20px 16px 16px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <EmbrisLogo size={28} />
        <div>
          <h1 style={{
            fontSize: 17, fontWeight: 700, color: "#F4F4F5",
            margin: 0, letterSpacing: "-0.03em", lineHeight: 1.2,
          }}>Embris</h1>
          <p style={{
            fontSize: 10, color: "#52525B", margin: 0,
            fontWeight: 400, letterSpacing: "0.01em",
          }}>Powered by Vaultfire</p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", margin: "0 16px" }} />

      {/* Nav */}
      <nav style={{
        flex: 1, padding: "12px 8px",
        display: "flex", flexDirection: "column", gap: 1,
        overflowY: "auto",
      }}>
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: "12px 16px" }}>
        <p style={{ fontSize: 10, color: "#3F3F46", fontWeight: 400 }}>v1.0 · theloopbreaker.com</p>
      </div>
    </>
  );

  // Mobile: hamburger + overlay
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            position: "fixed", top: 12, left: 12, zIndex: 1000,
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(17,17,19,0.95)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.05)",
            color: "#F97316", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
          aria-label="Open menu"
        >
          <Icons.menu size={17} color="#F97316" />
        </button>

        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed", inset: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
              zIndex: 1001,
            }}
          />
        )}

        <aside
          style={{
            position: "fixed", top: 0, left: mobileOpen ? 0 : -260,
            width: 248, height: "100vh",
            background: "#111113",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            zIndex: 1002, display: "flex", flexDirection: "column",
            transition: "left 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div style={{
            position: "absolute", top: 14, right: 12,
          }}>
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                background: "none", border: "none", color: "#52525B",
                cursor: "pointer", padding: 4, borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Icons.close size={16} color="#52525B" />
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
        width: 200, minWidth: 200,
        background: "#111113",
        borderRight: "1px solid rgba(255,255,255,0.04)",
        display: "flex", flexDirection: "column",
      }}
    >
      <SidebarContent />
    </aside>
  );
}
