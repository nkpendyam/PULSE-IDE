'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { resolveTheme, themeManager, type KyroThemeMode } from '@/lib/themeSystem';

type Theme = KyroThemeMode;

interface ThemeColors {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentHover: string;
  success: string;
  warning: string;
  error: string;
}

const themes: Record<Theme, ThemeColors> = {
  dark: {
    bg: '#0d1117',
    bgSecondary: '#161b22',
    bgTertiary: '#21262d',
    text: '#c9d1d9',
    textSecondary: '#8b949e',
    border: '#30363d',
    accent: '#58a6ff',
    accentHover: '#79c0ff',
    success: '#3fb950',
    warning: '#f0883e',
    error: '#f85149',
  },
  light: {
    bg: '#ffffff',
    bgSecondary: '#f6f8fa',
    bgTertiary: '#eaeef2',
    text: '#24292f',
    textSecondary: '#57606a',
    border: '#d0d7de',
    accent: '#0969da',
    accentHover: '#0550ae',
    success: '#1a7f37',
    warning: '#bf5615',
    error: '#cf222e',
  },
  system: {
    bg: '#0d1117',
    bgSecondary: '#161b22',
    bgTertiary: '#21262d',
    text: '#c9d1d9',
    textSecondary: '#8b949e',
    border: '#30363d',
    accent: '#58a6ff',
    accentHover: '#79c0ff',
    success: '#3fb950',
    warning: '#f0883e',
    error: '#f85149',
  },
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

// Helper function to get initial theme
function getInitialTheme(): Theme {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('kro-theme') as Theme | null;
    if (saved) return saved;
  }
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    localStorage.setItem('kro-theme', theme);

    const resolved = resolveTheme(theme);
    themeManager.applyTheme(resolved);

    const mode = resolved.type === 'light' ? 'light' : 'dark';
    const root = document.documentElement;
    root.dataset.theme = mode;
    Object.entries(themes[mode]).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  }, [theme]);

  const colors = themes[resolveTheme(theme).type === 'light' ? 'light' : 'dark'];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex gap-2">
      {(['dark', 'light', 'system'] as Theme[]).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          className={`px-3 py-2 text-sm rounded capitalize ${
            theme === t
              ? 'bg-[#238636] text-white'
              : 'bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
