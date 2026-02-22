"use client";
import { useEffect, useState } from "react";
import { GENERAL_DISCLAIMER_SHORT } from "../lib/disclaimers";

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
      backgroundColor: "#09090B",
      borderTop: "1px solid rgba(255,255,255,0.03)",
      padding: isMobile ? "10px 16px" : "10px 24px",
      flexShrink: 0,
    }}>
      <p style={{
        fontSize: 10,
        color: "#3F3F46",
        textAlign: "center",
        lineHeight: 1.6,
        letterSpacing: "0.01em",
        maxWidth: 760,
        margin: "0 auto",
      }}>
        {GENERAL_DISCLAIMER_SHORT}
        {" "}&middot;{" "}
        Smart contracts deployed on Base &amp; Avalanche. Non-custodial — you control your keys.
        {" "}&middot;{" "}
        <span style={{ color: "#52525B" }}>
          &copy; {new Date().getFullYear()} Vaultfire Protocol. All rights reserved.
        </span>
      </p>
    </footer>
  );
}
