"use client";
import { useState } from "react";

type Section = "home" | "chat" | "wallet" | "verify" | "bridge" | "dashboard" | "sync";

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "Home" },
  { id: "chat", label: "Ember Chat", icon: "Fire" },
  { id: "wallet", label: "Wallet", icon: "Wallet" },
  { id: "verify", label: "Trust Verification", icon: "Check" },
  { id: "bridge", label: "Cross-Chain Bridge", icon: "Bridge" },
  { id: "dashboard", label: "Dashboard", icon: "Chart" },
  { id: "sync", label: "Sync", icon: "Sync" },
];

const ICON_MAP: Record<string, string> = {
  Home: "🏠",
  Fire: "🔥",
  Wallet: "💼",
  Check: "✓",
  Bridge: "🌉",
  Chart: "📊",
  Sync: "🔄",
};

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      style={{
        width: collapsed ? 64 : 240,
        minWidth: collapsed ? 64 : 240,
        backgroundColor: "#1A1A1E",
        borderRight: "1px solid #2A2A2E",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease, min-width 0.2s ease",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 12px", borderBottom: "1px solid #2A2A2E", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#FF6B3520", border: "1px solid #FF6B35", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          {ICON_MAP["Fire"]}
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <h1 style={{ fontSize: 14, fontWeight: 700, color: "#ECEDEE", whiteSpace: "nowrap" }}>Vaultfire</h1>
            <p style={{ fontSize: 11, color: "#FF6B35", whiteSpace: "nowrap" }}>Powered by Ember</p>
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: collapsed ? "10px 0" : "10px 12px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                justifyContent: collapsed ? "center" : "flex-start",
                backgroundColor: isActive ? "#FF6B3520" : "transparent",
                color: isActive ? "#FF6B35" : "#9BA1A6",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{ICON_MAP[item.icon] || item.icon}</span>
              {!collapsed && (
                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
              )}
              {isActive && !collapsed && (
                <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", backgroundColor: "#FF6B35" }} />
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "12px 8px", borderTop: "1px solid #2A2A2E" }}>
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            padding: "8px",
            backgroundColor: "transparent",
            border: "none",
            color: "#9BA1A6",
            cursor: "pointer",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {collapsed ? ">" : "< Collapse"}
        </button>
      </div>
    </aside>
  );
}
