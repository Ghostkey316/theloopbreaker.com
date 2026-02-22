"use client";
import { useEffect, useState } from "react";

interface SectionLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Optional accent color for the title area */
  accentColor?: string;
  /** If true, uses full-width layout (no maxWidth constraint) */
  fullWidth?: boolean;
  /** If true, uses compact padding (for dense sections like Chat) */
  compact?: boolean;
  /** Optional right-side header content (e.g., chain selector, status badge) */
  headerRight?: React.ReactNode;
}

/**
 * SectionLayout — Consistent layout wrapper for all sections.
 * Handles:
 * - Mobile hamburger menu clearance (pl-14 on mobile)
 * - Consistent padding and max-width
 * - Professional typography hierarchy
 * - Responsive design
 */
export default function SectionLayout({
  title,
  subtitle,
  children,
  accentColor,
  fullWidth = false,
  compact = false,
  headerRight,
}: SectionLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const px = compact ? (isMobile ? 16 : 24) : (isMobile ? 20 : 40);
  const py = compact ? (isMobile ? 16 : 24) : (isMobile ? 24 : 40);

  return (
    <div
      style={{
        padding: `${py}px ${px}px 48px`,
        maxWidth: fullWidth ? undefined : 960,
        margin: fullWidth ? undefined : "0 auto",
        width: "100%",
      }}
    >
      {/* Header with hamburger clearance on mobile */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: subtitle ? 32 : 24,
          // On mobile, add left padding to clear the hamburger button (fixed at left:12, width:40)
          paddingLeft: isMobile ? 48 : 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              fontSize: isMobile ? 24 : 32,
              fontWeight: 800,
              color: "#F4F4F5",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              marginBottom: subtitle ? 8 : 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: isMobile ? 13 : 14,
                color: "#71717A",
                lineHeight: 1.6,
                maxWidth: 560,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {headerRight && (
          <div style={{ flexShrink: 0 }}>{headerRight}</div>
        )}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
