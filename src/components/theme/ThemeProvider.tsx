'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'system';

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('kro-theme') as Theme | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('kro-theme', theme);
    
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(isDark ? 'dark' : 'light');
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  const applyTheme = (t: 'dark' | 'light') => {
    const root = document.documentElement;
    const colors = themes[t];
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  };

  const colors = themes[theme === 'system' ? 'dark' : theme];

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
