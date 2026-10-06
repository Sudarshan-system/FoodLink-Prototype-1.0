import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';
export type PaletteId = 'current' | 'forest_gold' | 'ocean_teal' | 'navy_marigold' | 'crimson_terracotta';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  paletteId: PaletteId;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setPaletteId: (paletteId: PaletteId) => void;
}

export interface PaletteTokenConfig {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  secondary: string;
  secondaryHover: string;
  secondaryLight: string;
  darkCanvas: string;
  darkSurface: string;
  darkSurfaceElevated: string;
  darkSubtle: string;
  darkBorder: string;
  darkTextMain: string;
  darkTextSecondary: string;
  darkTextMuted: string;
  lightCanvas: string;
  lightSurface: string;
  lightSurfaceElevated: string;
  lightSubtle: string;
  lightBorder: string;
  lightTextMain: string;
  lightTextSecondary: string;
  lightTextMuted: string;
}

export const PALETTE_CONFIGS: Record<PaletteId, PaletteTokenConfig> = {
  current: {
    primary: '#059669',
    primaryHover: '#047857',
    primaryLight: 'rgba(217, 119, 6, 0.18)',
    secondary: '#0F766E',
    secondaryHover: '#115E59',
    secondaryLight: 'rgba(15, 118, 110, 0.18)',
    darkCanvas: '#071A12',
    darkSurface: '#064E3B',
    darkSurfaceElevated: '#134025',
    darkSubtle: '#332E2B',
    darkBorder: '#1E5C38',
    darkTextMain: '#F0FDF8',
    darkTextSecondary: '#D6D3D1',
    darkTextMuted: '#9CA3AF',
    lightCanvas: '#F0FDF8',
    lightSurface: '#FFFFFF',
    lightSurfaceElevated: '#D1FAE5',
    lightSubtle: '#FDE68A',
    lightBorder: '#E7E5E4',
    lightTextMain: '#064E3B',
    lightTextSecondary: '#6B7280',
    lightTextMuted: '#9CA3AF',
  },
  forest_gold: {
    primary: '#059669',
    primaryHover: '#047857',
    primaryLight: 'rgba(217, 119, 6, 0.18)',
    secondary: '#0F766E',
    secondaryHover: '#115E59',
    secondaryLight: 'rgba(15, 118, 110, 0.18)',
    darkCanvas: '#071A12',
    darkSurface: '#064E3B',
    darkSurfaceElevated: '#134025',
    darkSubtle: '#332E2B',
    darkBorder: '#1E5C38',
    darkTextMain: '#F0FDF8',
    darkTextSecondary: '#D6D3D1',
    darkTextMuted: '#9CA3AF',
    lightCanvas: '#F0FDF8',
    lightSurface: '#FFFFFF',
    lightSurfaceElevated: '#D1FAE5',
    lightSubtle: '#FDE68A',
    lightBorder: '#E7E5E4',
    lightTextMain: '#064E3B',
    lightTextSecondary: '#6B7280',
    lightTextMuted: '#9CA3AF',
  },
  ocean_teal: {
    primary: '#0D9488',
    primaryHover: '#0F766E',
    primaryLight: 'rgba(13, 148, 136, 0.20)',
    secondary: '#F97316',
    secondaryHover: '#EA580C',
    secondaryLight: 'rgba(249, 115, 22, 0.20)',
    darkCanvas: '#0B1329',
    darkSurface: '#131F3B',
    darkSurfaceElevated: '#1E2C4F',
    darkSubtle: '#273863',
    darkBorder: '#293963',
    darkTextMain: '#F8FAFC',
    darkTextSecondary: '#94A3B8',
    darkTextMuted: '#64748B',
    lightCanvas: '#F0F9FF',
    lightSurface: '#FFFFFF',
    lightSurfaceElevated: '#E0F2FE',
    lightSubtle: '#BAE6FD',
    lightBorder: '#BAE6FD',
    lightTextMain: '#0C4A6E',
    lightTextSecondary: '#0369A1',
    lightTextMuted: '#0284C7',
  },
  navy_marigold: {
    primary: '#F59E0B',
    primaryHover: '#059669',
    primaryLight: 'rgba(245, 158, 11, 0.20)',
    secondary: '#3B82F6',
    secondaryHover: '#2563EB',
    secondaryLight: 'rgba(59, 130, 246, 0.20)',
    darkCanvas: '#070D1E',
    darkSurface: '#0E1730',
    darkSurfaceElevated: '#172347',
    darkSubtle: '#1F2F5C',
    darkBorder: '#233463',
    darkTextMain: '#F9FAFB',
    darkTextSecondary: '#9CA3AF',
    darkTextMuted: '#6B7280',
    lightCanvas: '#EFF6FF',
    lightSurface: '#FFFFFF',
    lightSurfaceElevated: '#DBEAFE',
    lightSubtle: '#BFDBFE',
    lightBorder: '#BFDBFE',
    lightTextMain: '#1E3A8A',
    lightTextSecondary: '#1D4ED8',
    lightTextMuted: '#2563EB',
  },
  crimson_terracotta: {
    primary: '#C2410C',
    primaryHover: '#9A3412',
    primaryLight: 'rgba(194, 65, 12, 0.20)',
    secondary: '#16A34A',
    secondaryHover: '#15803D',
    secondaryLight: 'rgba(22, 163, 74, 0.20)',
    darkCanvas: '#181210',
    darkSurface: '#261C19',
    darkSurfaceElevated: '#352723',
    darkSubtle: '#46342F',
    darkBorder: '#48352F',
    darkTextMain: '#FAF7F2',
    darkTextSecondary: '#C4B5A5',
    darkTextMuted: '#8C7E72',
    lightCanvas: '#FFF7ED',
    lightSurface: '#FFFFFF',
    lightSurfaceElevated: '#FFEDD5',
    lightSubtle: '#FED7AA',
    lightBorder: '#FED7AA',
    lightTextMain: '#7C2D12',
    lightTextSecondary: '#9A3412',
    lightTextMuted: '#C2410C',
  },
};

import { getSavedSettings, saveSettings, SETTINGS_CHANGE_EVENT } from '../lib/settingsStorage';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const s = getSavedSettings();
      if (s.theme === 'dark') return 'dark';
      if (s.theme === 'light') return 'light';
      if (s.theme === 'system') {
        return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      }
    } catch {}
    const saved = typeof window !== 'undefined' ? localStorage.getItem('foodlink_theme') : null;
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    return 'light';
  });

  const [paletteId, setPaletteIdState] = useState<PaletteId>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('foodlink_palette') : null;
    if (saved && saved in PALETTE_CONFIGS) {
      return saved as PaletteId;
    }
    return 'forest_gold';
  });

  const isDark = theme === 'dark';

  // Synchronize with settingsStorage events
  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const s = customEvent.detail || getSavedSettings();
      if (s.theme === 'dark') {
        setThemeState('dark');
      } else if (s.theme === 'light') {
        setThemeState('light');
      } else if (s.theme === 'system') {
        const isSysDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
        setThemeState(isSysDark ? 'dark' : 'light');
      }
    };

    window.addEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
    return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const config = PALETTE_CONFIGS[paletteId] || PALETTE_CONFIGS.forest_gold;

    const canvas = isDark ? config.darkCanvas : config.lightCanvas;
    const surface = isDark ? config.darkSurface : config.lightSurface;
    const surfaceElevated = isDark ? config.darkSurfaceElevated : config.lightSurfaceElevated;
    const subtle = isDark ? config.darkSubtle : config.lightSubtle;
    const border = isDark ? config.darkBorder : config.lightBorder;
    const textMain = isDark ? config.darkTextMain : config.lightTextMain;
    const textSec = isDark ? config.darkTextSecondary : config.lightTextSecondary;
    const textMut = isDark ? config.darkTextMuted : config.lightTextMuted;

    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    root.style.backgroundColor = canvas;
    document.body.style.backgroundColor = canvas;
    document.body.style.color = textMain;

    // Apply all CSS variables
    root.style.setProperty('--bg-app', canvas);
    root.style.setProperty('--bg-surface', surface);
    root.style.setProperty('--bg-surface-elevated', surfaceElevated);
    root.style.setProperty('--bg-subtle', subtle);
    root.style.setProperty('--border-color', border);
    root.style.setProperty('--text-main', textMain);
    root.style.setProperty('--text-secondary', textSec);
    root.style.setProperty('--text-muted', textMut);

    root.style.setProperty('--accent-primary', config.primary);
    root.style.setProperty('--accent-primary-hover', config.primaryHover);
    root.style.setProperty('--accent-primary-light', config.primaryLight);
    root.style.setProperty('--accent-secondary', config.secondary);
    root.style.setProperty('--accent-secondary-hover', config.secondaryHover);
    root.style.setProperty('--accent-secondary-light', config.secondaryLight);

    // Aliases
    root.style.setProperty('--accent-saffron', config.primary);
    root.style.setProperty('--accent-saffron-hover', config.primaryHover);
    root.style.setProperty('--accent-saffron-light', config.primaryLight);
    root.style.setProperty('--accent-forest', config.secondary);
    root.style.setProperty('--accent-forest-hover', config.secondaryHover);
    root.style.setProperty('--accent-forest-light', config.secondaryLight);

    try {
      localStorage.setItem('foodlink_theme', theme);
      localStorage.setItem('foodlink_palette', paletteId);
    } catch {}
  }, [theme, isDark, paletteId]);

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      saveSettings({ theme: next });
      return next;
    });
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    saveSettings({ theme: newTheme });
  };


  const setPaletteId = (newPalette: PaletteId) => {
    setPaletteIdState(newPalette);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, paletteId, toggleTheme, setTheme, setPaletteId }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

