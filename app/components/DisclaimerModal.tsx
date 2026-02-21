"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "vaultfire_disclaimer_accepted";

function ShieldIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <circle cx="12" cy="16" r="0.5" fill="#F97316" stroke="#F97316" strokeWidth="1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
      // Small delay so the page renders first
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

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9000,
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "fadeIn 0.3s ease-out",
      }} />

      {/* Modal */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9001,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}>
        <div style={{
          width: "100%", maxWidth: 480,
          background: "rgba(17,17,20,0.98)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(249,115,22,0.06)",
          overflow: "hidden",
          animation: "fadeInUp 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        }}>
          {/* Header stripe */}
          <div style={{
            height: 3,
            background: "linear-gradient(90deg, #F97316, #EA6C0A, transparent)",
          }} />

          {/* Content */}
          <div style={{ padding: "24px 24px 20px" }}>
            {/* Icon + Title */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 11,
                background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))",
                border: "1px solid rgba(249,115,22,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <ShieldIcon />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.02em", marginBottom: 2 }}>
                  Important Disclaimers
                </h2>
                <p style={{ fontSize: 11, color: "#666670", letterSpacing: "-0.01em" }}>
                  Please read before continuing
                </p>
              </div>
            </div>

            {/* Disclaimer items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
              {[
                {
                  icon: "⚠️",
                  title: "Alpha Software",
                  text: "Vaultfire Protocol is currently in alpha. Features may be incomplete, unstable, or change without notice. Use at your own risk.",
                },
                {
                  icon: "💸",
                  title: "Not Financial Advice",
                  text: "Nothing on this platform constitutes financial, investment, or legal advice. Do not invest more than you can afford to lose.",
                },
                {
                  icon: "🔐",
                  title: "Self-Custody Responsibility",
                  text: "You are solely responsible for securing your seed phrase and private keys. Vaultfire Protocol cannot recover lost or stolen funds.",
                },
                {
                  icon: "📋",
                  title: "Unaudited Contracts",
                  text: "Smart contracts deployed by this protocol have not been formally audited. Interact with them at your own risk.",
                },
                {
                  icon: "⚖️",
                  title: "No Liability",
                  text: "Vaultfire Protocol and its contributors are not liable for any losses, damages, or harms arising from use of this software.",
                },
              ].map((item, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "9px 11px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#FFFFFF", marginBottom: 2, letterSpacing: "-0.01em" }}>
                      {item.title}
                    </p>
                    <p style={{ fontSize: 11, color: "#A0A0A8", lineHeight: 1.55, letterSpacing: "-0.01em" }}>
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Checkbox */}
            <label style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              cursor: "pointer", marginBottom: 14, userSelect: "none",
            }}>
              <div
                onClick={() => setChecked(!checked)}
                style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                  border: `1.5px solid ${checked ? "#F97316" : "rgba(255,255,255,0.15)"}`,
                  backgroundColor: checked ? "rgba(249,115,22,0.12)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s ease",
                  color: "#F97316",
                }}
              >
                {checked && <CheckIcon />}
              </div>
              <span style={{ fontSize: 12, color: "#A0A0A8", lineHeight: 1.55, letterSpacing: "-0.01em" }}>
                I have read and understood the disclaimers above. I accept full responsibility for my use of Vaultfire Protocol.
              </span>
            </label>

            {/* Accept button */}
            <button
              onClick={handleAccept}
              disabled={!checked}
              style={{
                width: "100%", padding: "11px",
                background: checked
                  ? "linear-gradient(135deg, #F97316, #EA6C0A)"
                  : "rgba(255,255,255,0.04)",
                border: "none", borderRadius: 10,
                color: checked ? "#0A0A0C" : "#666670",
                fontSize: 13, fontWeight: 600,
                cursor: checked ? "pointer" : "default",
                transition: "all 0.2s ease", letterSpacing: "-0.01em",
                boxShadow: checked ? "0 2px 16px rgba(249,115,22,0.25)" : "none",
              }}
            >
              I Understand the Risks — Continue
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
