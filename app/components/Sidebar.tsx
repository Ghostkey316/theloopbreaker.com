'use client';

import { useState } from 'react';

type Section = 'home' | 'chat' | 'wallet' | 'verify' | 'bridge' | 'dashboard';

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'chat', label: 'Ember Chat', icon: '🔥' },
    { id: 'wallet', label: 'Wallet', icon: '💼' },
    { id: 'verify', label: 'Trust Verification', icon: '✓' },
    { id: 'bridge', label: 'Cross-Chain Bridge', icon: '🌉' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  ];

  return (
    <aside
      className={`bg-ember-surface border-r border-ember-surface-light transition-all duration-300 flex flex-col ${
        isCollapsed ? 'w-20' : 'w-sidebar'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-ember-surface-light">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🛡️</div>
          {!isCollapsed && (
            <div className="flex-1">
              <h1 className="text-sm font-bold text-ember-text">Vaultfire</h1>
              <p className="text-xs text-ember-accent">Powered by Ember</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              activeSection === section.id
                ? 'bg-ember-accent text-ember-bg'
                : 'text-ember-text hover:bg-ember-surface-light'
            }`}
            title={section.label}
          >
            <span className="text-lg">{section.icon}</span>
            {!isCollapsed && <span className="text-sm font-medium">{section.label}</span>}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-ember-surface-light">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center py-2 text-ember-text-muted hover:text-ember-text transition-colors"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>
    </aside>
  );
}
