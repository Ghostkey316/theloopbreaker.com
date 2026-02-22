"use client";
/**
 * DisclaimerBanner — Reusable legal disclaimer component.
 *
 * Two modes:
 * - "banner": Compact dismissible banner at top of a section
 * - "modal": Full-screen modal requiring explicit acknowledgment
 *
 * Acknowledgment is persisted in localStorage — once dismissed,
 * it won't show again unless the disclaimer version changes.
 */

import { useState, useEffect } from "react";
import {
  type DisclaimerKey,
  DISCLAIMERS,
  isDisclaimerAcknowledged,
  acknowledgeDisclaimer,
} from "../lib/disclaimers";

/* ── Icons ── */
const InfoIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const XIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const ShieldIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

/* ── Banner Mode ── */
interface DisclaimerBannerProps {
  disclaimerKey: DisclaimerKey;
  mode?: 'banner' | 'inline';
  onAcknowledge?: () => void;
}

export default function DisclaimerBanner({
  disclaimerKey,
  mode = 'banner',
  onAcknowledge,
}: DisclaimerBannerProps) {
  const [visible, setVisible] = useState(false);
  const disclaimer = DISCLAIMERS[disclaimerKey];

  useEffect(() => {
    if (!isDisclaimerAcknowledged(disclaimerKey)) {
      setVisible(true);
    }
  }, [disclaimerKey]);

  if (!visible) return null;

  const handleDismiss = () => {
    acknowledgeDisclaimer(disclaimerKey);
    setVisible(false);
    onAcknowledge?.();
  };

  if (mode === 'inline') {
    return (
      <div style={{
        padding: "12px 16px", borderRadius: 10,
        background: "rgba(249,115,22,0.06)",
        border: "1px solid rgba(249,115,22,0.15)",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ color: "#F97316", flexShrink: 0, marginTop: 1 }}>
            <InfoIcon size={14} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#F97316", marginBottom: 3 }}>
              {disclaimer.title}
            </div>
            <p style={{ fontSize: 11, color: "#A1A1AA", margin: 0, lineHeight: 1.5 }}>
              {disclaimer.body}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            style={{
              background: "none", border: "none", color: "#52525B",
              cursor: "pointer", padding: 2, flexShrink: 0, display: "flex",
            }}
            aria-label="Dismiss"
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Banner mode
  return (
    <div style={{
      padding: "10px 16px",
      background: "rgba(249,115,22,0.05)",
      borderBottom: "1px solid rgba(249,115,22,0.1)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ color: "#F97316", flexShrink: 0 }}>
          <InfoIcon size={13} />
        </div>
        <p style={{ flex: 1, fontSize: 11, color: "#A1A1AA", margin: 0, lineHeight: 1.5 }}>
          <span style={{ fontWeight: 600, color: "#D4D4D8" }}>{disclaimer.title}: </span>
          {disclaimer.body}
        </p>
        <button
          onClick={handleDismiss}
          style={{
            background: "none", border: "none", color: "#52525B",
            cursor: "pointer", padding: 4, flexShrink: 0, display: "flex",
            borderRadius: 6, transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#A1A1AA')}
          onMouseLeave={e => (e.currentTarget.style.color = '#52525B')}
          aria-label="Dismiss disclaimer"
        >
          <XIcon size={13} />
        </button>
      </div>
    </div>
  );
}

/* ── Modal Mode — for wallet creation (requires explicit ack) ── */
interface DisclaimerModalProps {
  disclaimerKey: DisclaimerKey;
  onAcknowledge: () => void;
  onDecline?: () => void;
}

export function DisclaimerModal({
  disclaimerKey,
  onAcknowledge,
  onDecline,
}: DisclaimerModalProps) {
  const [checked, setChecked] = useState(false);
  const disclaimer = DISCLAIMERS[disclaimerKey];

  const handleAccept = () => {
    if (!checked) return;
    acknowledgeDisclaimer(disclaimerKey);
    onAcknowledge();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 440,
        background: "#111113", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, padding: 28, boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "rgba(249,115,22,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#F97316",
          }}>
            <ShieldIcon size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#F4F4F5", margin: 0 }}>
              {disclaimer.title}
            </h2>
            <p style={{ fontSize: 11, color: "#52525B", margin: 0 }}>
              Please read before continuing
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{
          padding: "14px 16px", borderRadius: 12,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          marginBottom: 20,
        }}>
          <p style={{ fontSize: 13, color: "#A1A1AA", margin: 0, lineHeight: 1.7 }}>
            {disclaimer.body}
          </p>
        </div>

        {/* Checkbox */}
        <label style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          cursor: "pointer", marginBottom: 20,
        }}>
          <div
            onClick={() => setChecked(!checked)}
            style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
              border: `1.5px solid ${checked ? '#F97316' : 'rgba(255,255,255,0.15)'}`,
              background: checked ? 'rgba(249,115,22,0.15)' : 'transparent',
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", cursor: "pointer",
            }}
          >
            {checked && (
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="3" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </div>
          <span style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.5 }}>
            I understand and accept these terms. I acknowledge that on-chain transactions are irreversible and I am solely responsible for my actions.
          </span>
        </label>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          {onDecline && (
            <button
              onClick={onDecline}
              style={{
                flex: 1, padding: "12px", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "transparent", color: "#71717A",
                fontSize: 14, fontWeight: 500, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleAccept}
            disabled={!checked}
            style={{
              flex: 2, padding: "12px", borderRadius: 12, border: "none",
              background: checked
                ? "linear-gradient(135deg, #F97316, #EA580C)"
                : "rgba(255,255,255,0.05)",
              color: checked ? "#fff" : "#52525B",
              fontSize: 14, fontWeight: 600, cursor: checked ? "pointer" : "not-allowed",
              fontFamily: "inherit", transition: "all 0.2s",
            }}
          >
            I Understand — Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Compact Footer Disclaimer ── */
export function FooterDisclaimer() {
  return (
    <div style={{
      padding: "16px 24px",
      borderTop: "1px solid rgba(255,255,255,0.04)",
      textAlign: "center",
    }}>
      <p style={{ fontSize: 10, color: "#3F3F46", margin: 0, lineHeight: 1.6, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
        Vaultfire Protocol is experimental software. Not financial advice. On-chain transactions are irreversible.
        Smart contracts deployed on Base and Avalanche. Use at your own risk.{" "}
        <span style={{ color: "#52525B" }}>© {new Date().getFullYear()} Vaultfire Protocol.</span>
      </p>
    </div>
  );
}

/* ── Section Header Disclaimer (non-dismissible, always visible) ── */
export function SectionDisclaimer({
  text,
  type = 'info',
}: {
  text: string;
  type?: 'info' | 'warning';
}) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      padding: "10px 14px", borderRadius: 10,
      background: type === 'warning' ? "rgba(249,115,22,0.06)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${type === 'warning' ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.06)'}`,
      marginBottom: 16,
    }}>
      <div style={{ color: type === 'warning' ? "#F97316" : "#71717A", flexShrink: 0, marginTop: 1 }}>
        <InfoIcon size={12} />
      </div>
      <p style={{ fontSize: 11, color: "#71717A", margin: 0, lineHeight: 1.5 }}>
        {text}
      </p>
    </div>
  );
}
