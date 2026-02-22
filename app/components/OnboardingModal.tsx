"use client";
import { useState, useEffect } from "react";
import { hasCompletedOnboarding, completeOnboarding, ONBOARDING_STEPS } from "../lib/onboarding";

interface OnboardingModalProps {
  onComplete?: () => void;
}

function FlameIcon() {
  return (
    <svg width={40} height={40} viewBox="0 0 32 32" fill="none">
      <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9" />
      <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C" />
      <path d="M16 14c-.7 1-1.4 2.2-1.4 3.2 0 .77.63 1.4 1.4 1.4s1.4-.63 1.4-1.4c0-1-.7-2.2-1.4-3.2z" fill="#FDE68A" opacity="0.6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </svg>
  );
}

function ChainIcon() {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  flame: <FlameIcon />,
  shield: <ShieldIcon />,
  wallet: <WalletIcon />,
  brain: <BrainIcon />,
  chain: <ChainIcon />,
};

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!hasCompletedOnboarding()) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const currentStep = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      completeOnboarding();
      setShow(false);
      onComplete?.();
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    setShow(false);
    onComplete?.();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
    }}>
      <div className="modal-in" style={{
        width: "90%", maxWidth: 440,
        backgroundColor: "#111113",
        borderRadius: 20,
        padding: "40px 32px 32px",
        position: "relative",
      }}>
        {/* Step indicator */}
        <div style={{
          display: "flex", gap: 4, justifyContent: "center", marginBottom: 32,
        }}>
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 6, height: 6,
              borderRadius: 3,
              backgroundColor: i === step ? "#F97316" : i < step ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          display: "flex", justifyContent: "center", marginBottom: 24,
          opacity: 0.9,
        }}>
          {ICONS[currentStep.icon]}
        </div>

        {/* Content */}
        <h2 style={{
          fontSize: 20, fontWeight: 600, color: "#F4F4F5",
          textAlign: "center", marginBottom: 12,
          letterSpacing: "-0.02em",
        }}>
          {currentStep.title}
        </h2>
        <p style={{
          fontSize: 14, color: "#A1A1AA", textAlign: "center",
          lineHeight: 1.7, marginBottom: 32,
        }}>
          {currentStep.description}
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={handleSkip} style={{
            flex: 1, padding: "12px 16px",
            backgroundColor: "transparent",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12, color: "#71717A",
            fontSize: 14, fontWeight: 500, cursor: "pointer",
          }}>
            Skip
          </button>
          <button onClick={handleNext} style={{
            flex: 1, padding: "12px 16px",
            backgroundColor: "#F97316",
            border: "none", borderRadius: 12,
            color: "#09090B", fontSize: 14, fontWeight: 600,
            cursor: "pointer",
          }}>
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>

        {/* Step counter */}
        <p style={{
          fontSize: 11, color: "#3F3F46", textAlign: "center", marginTop: 16,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {step + 1} / {ONBOARDING_STEPS.length}
        </p>
      </div>
    </div>
  );
}
