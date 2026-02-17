/**
 * Shared dashboard UI components
 * Design: "Obsidian Forge" — consistent card, section, and status styling
 */

import { motion } from "framer-motion";
import { ExternalLink, AlertCircle } from "lucide-react";
import { basescanAddress, shortenAddress } from "@/lib/contracts";
import type { ReactNode } from "react";

// ============ Section Header ============
export function SectionHeader({
  title,
  subtitle,
  icon,
  badge,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-6">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-ember/20 to-violet/20 border border-border/50 flex items-center justify-center text-ember">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {badge && <div className="sm:ml-auto">{badge}</div>}
    </div>
  );
}

// ============ Dashboard Card ============
export function DashCard({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`vf-card rounded-xl p-5 md:p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ============ KPI Stat Card ============
export function StatCard({
  label,
  value,
  icon,
  loading,
  delay = 0,
  accent = "ember",
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  loading?: boolean;
  delay?: number;
  accent?: "ember" | "violet" | "emerald";
}) {
  const accentColors = {
    ember: "from-ember/10 to-ember/5 border-ember/20",
    violet: "from-violet/10 to-violet/5 border-violet/20",
    emerald: "from-emerald/10 to-emerald/5 border-emerald/20",
  };
  const textColors = {
    ember: "text-ember",
    violet: "text-violet",
    emerald: "text-emerald",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`rounded-xl p-5 bg-gradient-to-br ${accentColors[accent]} border`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon && <span className={`${textColors[accent]} opacity-70`}>{icon}</span>}
      </div>
      {loading ? (
        <div className="h-8 w-24 vf-shimmer rounded" />
      ) : (
        <div className={`text-2xl md:text-3xl font-display font-bold ${textColors[accent]}`}>
          {value}
        </div>
      )}
    </motion.div>
  );
}

// ============ Empty State ============
export function EmptyState({ message = "No data yet" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <AlertCircle className="w-8 h-8 mb-3 opacity-40" />
      <p className="text-sm font-medium">{message}</p>
      <p className="text-xs mt-1 opacity-60">Data will appear here once on-chain activity occurs</p>
    </div>
  );
}

// ============ Loading Skeleton ============
export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-5 w-24 vf-shimmer rounded" />
          <div className="h-5 flex-1 vf-shimmer rounded" />
          <div className="h-5 w-16 vf-shimmer rounded" />
        </div>
      ))}
    </div>
  );
}

// ============ Address Link ============
export function AddressLink({
  address,
  label,
  className = "",
}: {
  address: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={basescanAddress(address)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 font-mono-data text-sm hover:text-ember transition-colors ${className}`}
      title={address}
    >
      {label || shortenAddress(address)}
      <ExternalLink className="w-3 h-3 opacity-50" />
    </a>
  );
}

// ============ Status Badge ============
export function StatusBadge({
  status,
  label,
}: {
  status: "active" | "inactive" | "pending" | "executed" | "healthy" | "paused";
  label?: string;
}) {
  const styles = {
    active: "bg-emerald/15 text-emerald border-emerald/30",
    inactive: "bg-muted text-muted-foreground border-border",
    pending: "bg-ember/15 text-ember border-ember/30",
    executed: "bg-violet/15 text-violet border-violet/30",
    healthy: "bg-emerald/15 text-emerald border-emerald/30",
    paused: "bg-destructive/15 text-destructive border-destructive/30",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === "active" || status === "healthy" ? "bg-emerald vf-pulse" :
        status === "pending" ? "bg-ember vf-pulse" :
        status === "executed" ? "bg-violet" :
        status === "paused" ? "bg-destructive" :
        "bg-muted-foreground"
      }`} />
      {label || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ============ Data Table ============
export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto -mx-5 md:-mx-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            {headers.map((h) => (
              <th
                key={h}
                className="px-5 md:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">{children}</tbody>
      </table>
    </div>
  );
}
