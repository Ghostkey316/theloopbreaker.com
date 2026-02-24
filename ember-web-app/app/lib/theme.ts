/**
 * Embris Theme System — Dark/Light Mode
 *
 * Manages theme preference with localStorage persistence.
 * Provides color tokens for both dark and light modes.
 */

const THEME_KEY = 'embris_theme_v1';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  bgBase: string;
  bgSurface: string;
  bgElevated: string;
  bgHover: string;
  bgActive: string;
  bgSidebar: string;
  bgInput: string;
  bgUserBubble: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentHover: string;
  border: string;
  borderHover: string;
  success: string;
  warning: string;
  error: string;
  shadow: string;
  overlay: string;
  codeBlock: string;
  scrollThumb: string;
}

export const DARK_THEME: ThemeColors = {
  bgBase: '#09090B',
  bgSurface: '#111113',
  bgElevated: '#18181B',
  bgHover: 'rgba(255,255,255,0.03)',
  bgActive: 'rgba(255,255,255,0.05)',
  bgSidebar: '#0C0C0E',
  bgInput: '#111113',
  bgUserBubble: '#1A1A1E',
  textPrimary: '#F4F4F5',
  textSecondary: '#A1A1AA',
  textTertiary: '#71717A',
  textMuted: '#52525B',
  textFaint: '#3F3F46',
  accent: '#F97316',
  accentHover: '#FB923C',
  border: 'rgba(255,255,255,0.03)',
  borderHover: 'rgba(255,255,255,0.06)',
  success: '#22C55E',
  warning: '#EAB308',
  error: '#EF4444',
  shadow: 'rgba(0,0,0,0.3)',
  overlay: 'rgba(0,0,0,0.6)',
  codeBlock: 'rgba(255,255,255,0.04)',
  scrollThumb: 'rgba(255,255,255,0.04)',
};

export const LIGHT_THEME: ThemeColors = {
  bgBase: '#FAFAFA',
  bgSurface: '#FFFFFF',
  bgElevated: '#F4F4F5',
  bgHover: 'rgba(0,0,0,0.03)',
  bgActive: 'rgba(0,0,0,0.05)',
  bgSidebar: '#F4F4F5',
  bgInput: '#FFFFFF',
  bgUserBubble: '#E4E4E7',
  textPrimary: '#18181B',
  textSecondary: '#52525B',
  textTertiary: '#71717A',
  textMuted: '#A1A1AA',
  textFaint: '#D4D4D8',
  accent: '#EA580C',
  accentHover: '#F97316',
  border: 'rgba(0,0,0,0.06)',
  borderHover: 'rgba(0,0,0,0.1)',
  success: '#16A34A',
  warning: '#CA8A04',
  error: '#DC2626',
  shadow: 'rgba(0,0,0,0.08)',
  overlay: 'rgba(0,0,0,0.3)',
  codeBlock: 'rgba(0,0,0,0.04)',
  scrollThumb: 'rgba(0,0,0,0.08)',
};

/* ── Storage ── */

export function getThemePreference(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  return 'dark';
}

export function setThemePreference(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
}

export function getThemeColors(mode: ThemeMode): ThemeColors {
  return mode === 'light' ? LIGHT_THEME : DARK_THEME;
}

export function toggleTheme(current: ThemeMode): ThemeMode {
  const next = current === 'dark' ? 'light' : 'dark';
  setThemePreference(next);
  return next;
}
