"use client";
import { useState, useEffect } from "react";

type Section = "home" | "chat" | "wallet" | "verify" | "bridge" | "dashboard" | "sync";

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "chat", label: "Ember Chat", icon: "🔥" },
  { id: "wallet", label: "Wallet", icon: "💼" },
  { id: "verify", label: "Trust Verification", icon: "✓" },
  { id: "bridge", label: "Cross-Chain Bridge", icon: "🌉" },
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "sync", label: "Sync", icon: "🔄" },
];

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

  // Mobile: hamburger button + overlay sidebar
  if (isMobile) {
    return (
      <>
        {/* Hamburger button */}
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            position: "fixed",
            top: 12,
            left: 12,
            zIndex: 1000,
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: "#1A1A1E",
            border: "1px solid #2A2A2E",
            color: "#FF6B35",
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          aria-label="Open menu"
        >
          ☰
        </button>

        {/* Overlay backdrop */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              zIndex: 1001,
              transition: "opacity 0.2s",
            }}
          />
        )}

        {/* Slide-in sidebar */}
        <aside
          style={{
            position: "fixed",
            top: 0,
            left: mobileOpen ? 0 : -280,
            width: 270,
            height: "100vh",
            backgroundColor: "#1A1A1E",
            borderRight: "1px solid #2A2A2E",
            zIndex: 1002,
            display: "flex",
            flexDirection: "column",
            transition: "left 0.25s ease",
            boxShadow: mobileOpen ? "4px 0 20px rgba(0,0,0,0.5)" : "none",
          }}
        >
          {/* Header */}
          <div style={{ padding: "16px", borderBottom: "1px solid #2A2A2E", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#FF6B3520", border: "1px solid #FF6B35", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                🔥
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 700, color: "#ECEDEE", margin: 0 }}>Vaultfire</h1>
                <p style={{ fontSize: 11, color: "#FF6B35", margin: 0 }}>Powered by Ember</p>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              style={{ background: "none", border: "none", color: "#9BA1A6", fontSize: 22, cursor: "pointer", padding: 4 }}
            >
              ✕
            </button>
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    backgroundColor: isActive ? "#FF6B3520" : "transparent",
                    color: isActive ? "#FF6B35" : "#9BA1A6",
                    transition: "all 0.15s",
                    fontSize: 15,
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
                  {isActive && <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", backgroundColor: "#FF6B35" }} />}
                </button>
              );
            })}
          </nav>
        </aside>
      </>
    );
  }

  // Desktop: permanent sidebar
  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        backgroundColor: "#1A1A1E",
        borderRight: "1px solid #2A2A2E",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "16px 12px", borderBottom: "1px solid #2A2A2E", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#FF6B3520", border: "1px solid #FF6B35", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          🔥
        </div>
        <div style={{ overflow: "hidden" }}>
          <h1 style={{ fontSize: 14, fontWeight: 700, color: "#ECEDEE", whiteSpace: "nowrap", margin: 0 }}>Vaultfire</h1>
          <p style={{ fontSize: 11, color: "#FF6B35", whiteSpace: "nowrap", margin: 0 }}>Powered by Ember</p>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                backgroundColor: isActive ? "#FF6B3520" : "transparent",
                color: isActive ? "#FF6B35" : "#9BA1A6",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap" }}>{item.label}</span>
              {isActive && <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", backgroundColor: "#FF6B35" }} />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
