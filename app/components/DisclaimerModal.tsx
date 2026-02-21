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

/* ── Disclaimer item icons as SVG ── */
function AlertTriangleIcon({ size = 13 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>);
}
function DollarIcon({ size = 13 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>);
}
function KeyIcon({ size = 13 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>);
}
function FileTextIcon({ size = 13 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>);
}
function ScaleIcon({ size = 13 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="3" x2="12" y2="21" /><polyline points="1 14 12 3 23 14" /></svg>);
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

  const disclaimerItems = [
    {
      icon: <AlertTriangleIcon />,
      title: "Alpha Software",
      text: "Vaultfire Protocol is currently in alpha. Features may be incomplete, unstable, or change without notice. Use at your own risk.",
    },
    {
      icon: <DollarIcon />,
      title: "Not Financial Advice",
      text: "Nothing on this platform constitutes financial, investment, or legal advice. Do not invest more than you can afford to lose.",
    },
    {
      icon: <KeyIcon />,
      title: "Self-Custody Responsibility",
      text: "You are solely responsible for securing your seed phrase and private keys. Vaultfire Protocol cannot recover lost or stolen funds.",
    },
    {
      icon: <FileTextIcon />,
      title: "Unaudited Contracts",
      text: "Smart contracts deployed by this protocol have not been formally audited. Interact with them at your own risk.",
    },
    {
      icon: <ScaleIcon />,
      title: "No Liability",
      text: "Vaultfire Protocol and its contributors are not liable for any losses, damages, or harms arising from use of this software.",
    },
  ];

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
        <div className="fade-in" style={{
          width: "100%", maxWidth: 480,
          background: "#0F0F12",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 18,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(249,115,22,0.06)",
          overflow: "hidden",
        }}>
          {/* Header stripe */}
          <div style={{
            height: 3,
            background: "linear-gradient(90deg, #F97316, #EA580C, transparent)",
          }} />

          {/* Content */}
          <div style={{ padding: "24px 24px 20px" }}>
            {/* Icon + Title */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 13,
                background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))",
                border: "1px solid rgba(249,115,22,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 16px rgba(249,115,22,0.06)",
              }}>
                <ShieldIcon />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#FAFAFA", letterSpacing: "-0.03em", marginBottom: 2 }}>
                  Important Disclaimers
                </h2>
                <p style={{ fontSize: 12, color: "#52525B", letterSpacing: "-0.01em" }}>
                  Please read before continuing
                </p>
              </div>
            </div>

            {/* Disclaimer items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
              {disclaimerItems.map((item, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  borderRadius: 10,
                }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#FAFAFA", marginBottom: 2, letterSpacing: "-0.01em" }}>
                      {item.title}
                    </p>
                    <p style={{ fontSize: 12, color: "#A1A1AA", lineHeight: 1.6, letterSpacing: "-0.01em" }}>
                      {item.text}
                    </p>
                  </div>
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
                  border: `1.5px solid ${checked ? "#F97316" : "rgba(255,255,255,0.12)"}`,
                  backgroundColor: checked ? "rgba(249,115,22,0.12)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s ease",
                  color: "#F97316",
                }}
              >
                {checked && <CheckIcon />}
              </div>
              <span style={{ fontSize: 12, color: "#A1A1AA", lineHeight: 1.6, letterSpacing: "-0.01em" }}>
                I have read and understood the disclaimers above. I accept full responsibility for my use of Vaultfire Protocol.
              </span>
            </label>

            {/* Accept button */}
            <button
              onClick={handleAccept}
              disabled={!checked}
              style={{
                width: "100%", padding: "12px",
                background: checked
                  ? "linear-gradient(135deg, #F97316, #EA580C)"
                  : "rgba(255,255,255,0.04)",
                border: "none", borderRadius: 10,
                color: checked ? "#09090B" : "#52525B",
                fontSize: 14, fontWeight: 600,
                cursor: checked ? "pointer" : "default",
                transition: "all 0.2s ease", letterSpacing: "-0.01em",
                boxShadow: checked ? "0 4px 16px rgba(249,115,22,0.25)" : "none",
              }}
            >
              I Understand the Risks \u2014 Continue
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
