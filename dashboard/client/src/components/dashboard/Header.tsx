/**
 * Dashboard Header — Sticky navigation with section links
 * Design: "Obsidian Forge" — frosted glass nav bar
 */

import { RefreshCw, ExternalLink, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NavItem {
  id: string;
  label: string;
}

interface HeaderProps {
  navItems: NavItem[];
  activeSection: string;
  onNavClick: (id: string) => void;
  onRefresh: () => void;
  lastRefresh: Date;
}

export default function Header({ navItems, activeSection, onNavClick, onRefresh, lastRefresh }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ember to-violet flex items-center justify-center">
              <span className="font-display font-bold text-sm text-white">V</span>
            </div>
            <span className="font-display font-bold text-lg hidden sm:block">
              <span className="vf-gradient-text">Vaultfire</span>
            </span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavClick(item.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeSection === item.id
                    ? "text-ember bg-ember-glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden md:block">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-md hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <a
              href="https://basescan.org"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground hidden sm:block"
              title="BaseScan"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-md hover:bg-surface-hover transition-colors text-muted-foreground hover:text-foreground lg:hidden"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl"
          >
            <nav className="container py-3 flex flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { onNavClick(item.id); setMobileOpen(false); }}
                  className={`px-4 py-2.5 text-sm font-medium rounded-md text-left transition-all ${
                    activeSection === item.id
                      ? "text-ember bg-ember-glow"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
