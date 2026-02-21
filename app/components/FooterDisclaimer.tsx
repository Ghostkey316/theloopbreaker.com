"use client";
import { useEffect, useState } from "react";

export default function FooterDisclaimer() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <footer style={{
      borderTop: "1px solid rgba(255,255,255,0.04)",
      backgroundColor: "rgba(10,10,12,0.8)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      padding: isMobile ? "10px 16px" : "10px 24px",
      flexShrink: 0,
    }}>
      {/* Disclaimer pills row */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: isMobile ? 4 : 6,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
      }}>
        {[
          { text: "Alpha software — use at your own risk", color: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.15)", textColor: "#F97316" },
          { text: "Not financial advice", color: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.06)", textColor: "#A0A0A8" },
          { text: "Smart contracts unaudited", color: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.06)", textColor: "#A0A0A8" },
          { text: "No liability for losses", color: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.06)", textColor: "#A0A0A8" },
        ].map((pill, i) => (
          <span key={i} style={{
            fontSize: 9,
            fontWeight: 500,
            color: pill.textColor,
            backgroundColor: pill.color,
            border: `1px solid ${pill.border}`,
            borderRadius: 20,
            padding: "2px 8px",
            whiteSpace: "nowrap",
            letterSpacing: "0.01em",
          }}>
            {pill.text}
          </span>
        ))}
      </div>

      {/* Full disclaimer text */}
      <p style={{
        fontSize: 9,
        color: "#3A3A3E",
        textAlign: "center",
        lineHeight: 1.6,
        letterSpacing: "0.01em",
        maxWidth: 800,
        margin: "0 auto",
      }}>
        Vaultfire Protocol is experimental alpha software. This is not financial advice. Do not invest more than you can afford to lose.
        Vaultfire Protocol and its contributors are not liable for any losses incurred through use of this software.
        Smart contracts are unaudited. Interact at your own risk. Users are solely responsible for securing their seed phrases and private keys.
        {" "}·{" "}
        © {new Date().getFullYear()} Vaultfire Protocol. All rights reserved.
      </p>
    </footer>
  );
}
