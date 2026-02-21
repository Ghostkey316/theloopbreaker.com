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
      backgroundColor: "#09090B",
      padding: isMobile ? "8px 16px" : "8px 24px",
      flexShrink: 0,
    }}>
      <p style={{
        fontSize: 9,
        color: "#27272A",
        textAlign: "center",
        lineHeight: 1.6,
        letterSpacing: "0.01em",
        maxWidth: 720,
        margin: "0 auto",
      }}>
        Alpha software — use at your own risk. Not financial advice. Smart contracts unaudited. No liability for losses.
        {" "}&middot;{" "}
        &copy; {new Date().getFullYear()} Embris, powered by Vaultfire Protocol. All rights reserved.
      </p>
    </footer>
  );
}
