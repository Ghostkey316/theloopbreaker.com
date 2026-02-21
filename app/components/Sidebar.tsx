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
  { id: "chat", label: "Ember Chat", iconKey: "chat" },
  { id: "wallet", label: "Wallet", iconKey: "wallet" },
  { id: "verify", label: "Verification", iconKey: "verify" },
  { id: "bridge", label: "Bridge", iconKey: "bridge" },
  { id: "dashboard", label: "Dashboard", iconKey: "dashboard" },
  { id: "sync", label: "Sync", iconKey: "sync" },
];

function VaultfireLogo({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))',
      border: '1px solid rgba(249,115,22,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      boxShadow: '0 2px 12px rgba(249,115,22,0.08)',
    }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none" stroke="#F97316" strokeWidth="1.5" />
        <path d="M12 6c-1.5 2-3 4-3 6 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4-3-6z" fill="#F97316" opacity="0.8" />
        <path d="M12 8c-.8 1.2-1.5 2.4-1.5 3.5 0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5c0-1.1-.7-2.3-1.5-3.5z" fill="#FB923C" />
      </svg>
    </div>
  );
}

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

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

  const NavButton = ({ item, mobile = false }: { item: typeof NAV_ITEMS[0]; mobile?: boolean }) => {
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
          display: "flex", alignItems: "center", gap: 10,
          padding: mobile ? "10px 14px" : "9px 12px",
          borderRadius: 8, border: "none", cursor: "pointer",
          textAlign: "left", width: "100%",
          backgroundColor: isActive ? "rgba(249,115,22,0.08)" : isHovered ? "rgba(255,255,255,0.03)" : "transparent",
          color: isActive ? "#F97316" : isHovered ? "#FAFAFA" : "#71717A",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          position: "relative",
        }}
      >
        {isActive && (
          <div style={{
            position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
            width: 3, height: 16, borderRadius: 2, backgroundColor: "#F97316",
          }} />
        )}
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <IconComponent size={mobile ? 18 : 17} color={isActive ? "#F97316" : isHovered ? "#FAFAFA" : "#71717A"} />
        </span>
        <span style={{
          fontSize: 13, fontWeight: isActive ? 500 : 400,
          whiteSpace: "nowrap", letterSpacing: "-0.01em",
          lineHeight: 1.5,
        }}>
          {item.label}
        </span>
      </button>
    );
  };

  // Mobile: hamburger button + overlay sidebar
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            position: "fixed", top: 12, left: 12, zIndex: 1000,
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(15,15,18,0.9)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#F97316", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
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
              backgroundColor: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
              zIndex: 1001, transition: "opacity 0.3s",
            }}
          />
        )}

        <aside
          style={{
            position: "fixed", top: 0, left: mobileOpen ? 0 : -280,
            width: 268, height: "100vh",
            background: "#0F0F12",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            zIndex: 1002, display: "flex", flexDirection: "column",
            transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: mobileOpen ? "12px 0 40px rgba(0,0,0,0.5)" : "none",
          }}
        >
          <div style={{
            padding: "16px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <VaultfireLogo size={32} />
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA", margin: 0, letterSpacing: "-0.02em" }}>Vaultfire</h1>
                <p style={{ fontSize: 11, color: "#52525B", margin: 0, fontWeight: 400, letterSpacing: "0.02em" }}>Protocol</p>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                background: "none", border: "none", color: "#52525B",
                cursor: "pointer", padding: 6, borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Icons.close size={17} color="#52525B" />
            </button>
          </div>

          <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
            {NAV_ITEMS.map((item) => (
              <NavButton key={item.id} item={item} mobile />
            ))}
          </nav>

          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <p style={{ fontSize: 11, color: "#52525B", textAlign: "center", fontWeight: 400 }}>Vaultfire Protocol v1.0</p>
          </div>
        </aside>
      </>
    );
  }

  // Desktop: permanent sidebar
  return (
    <aside
      style={{
        width: 232, minWidth: 232,
        background: "#0F0F12",
        borderRight: "1px solid rgba(255,255,255,0.04)",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{
        padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <VaultfireLogo size={32} />
        <div style={{ overflow: "hidden" }}>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA", whiteSpace: "nowrap", margin: 0, letterSpacing: "-0.02em" }}>Vaultfire</h1>
          <p style={{ fontSize: 11, color: "#52525B", whiteSpace: "nowrap", margin: 0, fontWeight: 400, letterSpacing: "0.02em" }}>Protocol</p>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}
      </nav>

      <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <p style={{ fontSize: 11, color: "#3F3F46", fontWeight: 400 }}>v1.0 · theloopbreaker.com</p>
      </div>
    </aside>
  );
}
