"use client";
/**
 * VNSBadge — Universal identity badge component.
 *
 * Displays a .vns name with its identity type (Human / AI Agent / Companion)
 * in a visually distinct, immediately recognizable format.
 *
 * Used everywhere: Hub, Marketplace, Chat, Wallet, Dashboard, Verify.
 * The badge is the visual proof of on-chain identity type.
 */

import { type IdentityType, getIdentityTypeColor } from "../lib/vns";

/* ── Icons ── */
const HumanIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const AgentIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/>
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/>
    <circle cx="8" cy="16" r="1" fill="currentColor"/>
    <circle cx="16" cy="16" r="1" fill="currentColor"/>
  </svg>
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CompanionIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const VerifiedIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

interface VNSBadgeProps {
  vnsName: string;           // without .vns suffix
  identityType: IdentityType;
  size?: BadgeSize;
  showVerified?: boolean;
  showFullName?: boolean;    // show "name.vns" vs just badge
  inline?: boolean;          // inline vs block display
  onClick?: () => void;
}

const SIZE_CONFIG = {
  xs: { fontSize: 10, iconSize: 10, padding: "1px 6px", borderRadius: 5, gap: 3 },
  sm: { fontSize: 11, iconSize: 11, padding: "2px 8px", borderRadius: 6, gap: 4 },
  md: { fontSize: 12, iconSize: 12, padding: "3px 10px", borderRadius: 7, gap: 5 },
  lg: { fontSize: 14, iconSize: 14, padding: "5px 12px", borderRadius: 8, gap: 6 },
};

export function VNSTypeBadge({
  identityType,
  size = 'sm',
  showVerified = true,
}: {
  identityType: IdentityType;
  size?: BadgeSize;
  showVerified?: boolean;
}) {
  const color = getIdentityTypeColor(identityType);
  const cfg = SIZE_CONFIG[size];
  const label = identityType === 'human' ? 'Human' : identityType === 'companion' ? 'Companion' : 'AI Agent';
  const Icon = identityType === 'human' ? HumanIcon : identityType === 'companion' ? CompanionIcon : AgentIcon;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: cfg.gap,
      padding: cfg.padding, borderRadius: cfg.borderRadius,
      background: `${color}15`, border: `1px solid ${color}30`,
      color, fontSize: cfg.fontSize, fontWeight: 600,
      lineHeight: 1, whiteSpace: "nowrap",
    }}>
      <Icon size={cfg.iconSize} />
      {label}
      {showVerified && (
        <VerifiedIcon size={cfg.iconSize - 1} />
      )}
    </span>
  );
}

export default function VNSBadge({
  vnsName,
  identityType,
  size = 'sm',
  showVerified = true,
  showFullName = true,
  inline = true,
  onClick,
}: VNSBadgeProps) {
  const cfg = SIZE_CONFIG[size];

  return (
    <span
      onClick={onClick}
      style={{
        display: inline ? "inline-flex" : "flex",
        alignItems: "center",
        gap: cfg.gap + 2,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {showFullName && (
        <span style={{
          fontSize: cfg.fontSize + 1,
          fontWeight: 600,
          color: "#F4F4F5",
        }}>
          {vnsName}.vns
        </span>
      )}
      <VNSTypeBadge identityType={identityType} size={size} showVerified={showVerified} />
    </span>
  );
}

/**
 * Compact inline display: "name.vns [Human]" or "name.vns [AI Agent]"
 * Used in message headers, task cards, bid lists.
 */
export function VNSNameWithBadge({
  vnsName,
  identityType,
  size = 'xs',
  muted = false,
}: {
  vnsName: string;
  identityType: IdentityType;
  size?: BadgeSize;
  muted?: boolean;
}) {
  const color = getIdentityTypeColor(identityType);
  const cfg = SIZE_CONFIG[size];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{
        fontSize: cfg.fontSize + 1,
        fontWeight: 600,
        color: muted ? "#A1A1AA" : "#F4F4F5",
      }}>
        {vnsName}.vns
      </span>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        padding: "1px 5px", borderRadius: 4,
        background: `${color}12`, color,
        fontSize: cfg.fontSize - 1, fontWeight: 600,
      }}>
        {identityType === 'human' ? <HumanIcon size={9} /> : <AgentIcon size={9} />}
        {identityType === 'human' ? 'H' : 'AI'}
      </span>
    </span>
  );
}

/**
 * Large profile card header — used in Marketplace and profile views.
 */
export function VNSProfileHeader({
  vnsName,
  identityType,
  description,
  bondTier,
  trustScore,
  isOnline,
}: {
  vnsName: string;
  identityType: IdentityType;
  description?: string;
  bondTier?: string;
  trustScore?: number;
  isOnline?: boolean;
}) {
  const color = getIdentityTypeColor(identityType);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: `${color}15`, border: `1.5px solid ${color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
            {identityType === 'human' ? (
              <>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </>
            ) : identityType === 'companion' ? (
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            ) : (
              <>
                <rect x="3" y="11" width="18" height="10" rx="2"/>
                <circle cx="12" cy="5" r="2"/>
                <path d="M12 7v4"/>
                <circle cx="8" cy="16" r="1" fill={color}/>
                <circle cx="16" cy="16" r="1" fill={color}/>
              </>
            )}
          </svg>
        </div>
        {isOnline !== undefined && (
          <div style={{
            position: "absolute", bottom: 2, right: 2,
            width: 10, height: 10, borderRadius: "50%",
            background: isOnline ? "#22C55E" : "#52525B",
            border: "2px solid #09090B",
          }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#F4F4F5" }}>{vnsName}.vns</span>
          <VNSTypeBadge identityType={identityType} size="sm" />
          {bondTier && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
              background: "rgba(255,215,0,0.1)", color: "#FFD700",
            }}>
              {bondTier.charAt(0).toUpperCase() + bondTier.slice(1)}
            </span>
          )}
        </div>
        {description && (
          <p style={{ fontSize: 12, color: "#71717A", margin: 0, lineHeight: 1.5 }}>
            {description}
          </p>
        )}
        {trustScore !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <div style={{
              height: 4, width: 80, borderRadius: 2,
              background: "rgba(255,255,255,0.06)", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${trustScore}%`,
                background: trustScore >= 75 ? "#22C55E" : trustScore >= 50 ? "#F97316" : "#EF4444",
                borderRadius: 2, transition: "width 0.5s ease",
              }} />
            </div>
            <span style={{ fontSize: 11, color: "#71717A" }}>Trust {trustScore}</span>
          </div>
        )}
      </div>
    </div>
  );
}
