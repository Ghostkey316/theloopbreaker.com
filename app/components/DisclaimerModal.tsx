"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "vaultfire_disclaimer_accepted";

function CheckIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function DisclaimerModal() {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) {
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  const handleAccept = () => {
    if (!checked) return;
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!mounted || !visible) return null;

  const items = [
    "Vaultfire is a non-custodial wallet. You are solely responsible for your private keys and seed phrase. Vaultfire cannot recover lost keys.",
    "Nothing on this platform constitutes financial, investment, legal, or professional advice of any kind.",
    "Smart contracts deployed on Base and Avalanche have not been formally audited. Use at your own risk.",
    "All on-chain transactions are irreversible. Vaultfire Protocol and its contributors are not liable for any losses or damages.",
    "The Agent Hub and Marketplace are experimental platforms. Vaultfire does not guarantee agent performance or reliability.",
    "VNS names are permanent and immutable once registered on-chain.",
    "Embris is an AI companion. Responses may not always be accurate and are not a substitute for professional advice.",
  ];

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9000,
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }} />

      {/* Modal */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9001,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}>
        <div className="fade-in" style={{
          width: "100%", maxWidth: 420,
          background: "#0C0C0E",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
        }}>
          {/* Content */}
          <div style={{ padding: "32px 28px 28px" }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{
                fontSize: 20, fontWeight: 600, color: "#F4F4F5",
                letterSpacing: "-0.03em", marginBottom: 6,
              }}>
                Before you continue
              </h2>
              <p style={{ fontSize: 13, color: "#52525B" }}>
                Please review and accept the following
              </p>
            </div>

            {/* Items */}
            <div style={{
              display: "flex", flexDirection: "column",
              marginBottom: 24,
            }}>
              {items.map((text, i) => (
                <div key={i} style={{
                  padding: "10px 0",
                  borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                  display: "flex", gap: 10, alignItems: "flex-start",
                }}>
                  <span style={{
                    fontSize: 11, color: "#3F3F46", fontWeight: 500,
                    minWidth: 16, flexShrink: 0, marginTop: 1,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>{i + 1}.</span>
                  <p style={{
                    fontSize: 13, color: "#A1A1AA", lineHeight: 1.65,
                    letterSpacing: "-0.01em",
                  }}>
                    {text}
                  </p>
                </div>
              ))}
            </div>

            {/* Checkbox */}
            <label style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              cursor: "pointer", marginBottom: 20, userSelect: "none",
            }}>
              <div
                onClick={() => setChecked(!checked)}
                style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                  border: `1.5px solid ${checked ? "#F97316" : "rgba(255,255,255,0.08)"}`,
                  backgroundColor: checked ? "rgba(249,115,22,0.08)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s ease",
                  color: "#F97316",
                }}
              >
                {checked && <CheckIcon />}
              </div>
              <span style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.65 }}>
                I understand and accept full responsibility for my use of Embris and Vaultfire Protocol.
              </span>
            </label>

            {/* Accept button */}
            <button
              onClick={handleAccept}
              disabled={!checked}
              style={{
                width: "100%", padding: "12px",
                background: checked ? "#F97316" : "rgba(255,255,255,0.03)",
                border: "none", borderRadius: 10,
                color: checked ? "#09090B" : "#3F3F46",
                fontSize: 14, fontWeight: 600,
                cursor: checked ? "pointer" : "default",
                transition: "all 0.15s ease", letterSpacing: "-0.01em",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
