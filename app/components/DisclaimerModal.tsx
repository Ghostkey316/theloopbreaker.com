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
    "Embris is currently in alpha. Features may be incomplete or change without notice.",
    "Nothing on this platform constitutes financial, investment, or legal advice.",
    "You are solely responsible for securing your seed phrase and private keys.",
    "Smart contracts deployed by this protocol have not been formally audited.",
    "Vaultfire Protocol and its contributors are not liable for any losses or damages.",
  ];

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9000,
        backgroundColor: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }} />

      {/* Modal */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9001,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}>
        <div className="fade-in" style={{
          width: "100%", maxWidth: 440,
          background: "#111113",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16,
          overflow: "hidden",
        }}>
          {/* Content */}
          <div style={{ padding: "28px 24px 24px" }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{
                fontSize: 20, fontWeight: 700, color: "#F4F4F5",
                letterSpacing: "-0.03em", marginBottom: 4,
              }}>
                Before you continue
              </h2>
              <p style={{ fontSize: 13, color: "#71717A" }}>
                Please review and accept the following
              </p>
            </div>

            {/* Items */}
            <div style={{
              display: "flex", flexDirection: "column", gap: 0,
              marginBottom: 20,
            }}>
              {items.map((text, i) => (
                <div key={i} style={{
                  padding: "10px 0",
                  borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  display: "flex", gap: 10, alignItems: "flex-start",
                }}>
                  <span style={{
                    fontSize: 11, color: "#52525B", fontWeight: 500,
                    minWidth: 16, flexShrink: 0, marginTop: 1,
                  }}>{i + 1}.</span>
                  <p style={{
                    fontSize: 13, color: "#A1A1AA", lineHeight: 1.6,
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
              cursor: "pointer", marginBottom: 16, userSelect: "none",
            }}>
              <div
                onClick={() => setChecked(!checked)}
                style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                  border: `1.5px solid ${checked ? "#F97316" : "rgba(255,255,255,0.1)"}`,
                  backgroundColor: checked ? "rgba(249,115,22,0.1)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s ease",
                  color: "#F97316",
                }}
              >
                {checked && <CheckIcon />}
              </div>
              <span style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6 }}>
                I understand and accept full responsibility for my use of Embris and Vaultfire Protocol.
              </span>
            </label>

            {/* Accept button */}
            <button
              onClick={handleAccept}
              disabled={!checked}
              style={{
                width: "100%", padding: "12px",
                background: checked ? "#F97316" : "rgba(255,255,255,0.04)",
                border: "none", borderRadius: 10,
                color: checked ? "#09090B" : "#52525B",
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
