/**
 * Accessibility Provider for Kyro IDE
 * 
 * Implements WCAG 2.1 AA compliance with:
 * - Screen reader support
 * - Keyboard navigation
 * - High contrast themes
 * - Focus management
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useKyroStore } from '@/store/kyroStore';

// Accessibility settings
interface AccessibilitySettings {
  screenReaderMode: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  focusIndicators: 'default' | 'enhanced' | 'none';
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  keyboardNav: boolean;
  announcements: boolean;
}

const defaultSettings: AccessibilitySettings = {
  screenReaderMode: false,
  highContrast: false,
  reducedMotion: false,
  focusIndicators: 'default',
  fontSize: 14,
  lineHeight: 1.5,
  letterSpacing: 0,
  keyboardNav: true,
  announcements: true,
};

// Announcement priority
type AnnouncementPriority = 'polite' | 'assertive' | 'off';

interface Announcement {
  id: string;
  message: string;
  priority: AnnouncementPriority;
  timestamp: number;
}

// Accessibility context
interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (updates: Partial<AccessibilitySettings>) => void;
  announce: (message: string, priority?: AnnouncementPriority) => void;
  announcements: Announcement[];
  clearAnnouncements: () => void;
  focusElement: (elementId: string) => void;
  getAriaProps: (id: string, label: string, description?: string) => Record<string, string>;
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

// Screen reader announcements hook
export function useAnnouncements() {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error('useAnnouncements must be used within AccessibilityProvider');
  return context;
}

// Main accessibility provider
export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const announcementIdRef = useRef(0);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('kyro-accessibility-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (e) {
        console.error('Failed to load accessibility settings:', e);
      }
    }

    // Detect system preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: more)').matches;
    
    setSettings(prev => ({
      ...prev,
      reducedMotion: prev.reducedMotion || prefersReducedMotion,
      highContrast: prev.highContrast || prefersHighContrast,
    }));
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('kyro-accessibility-settings', JSON.stringify(settings));
    
    // Apply CSS custom properties for accessibility
    const root = document.documentElement;
    root.style.setProperty('--kyro-font-size', `${settings.fontSize}px`);
    root.style.setProperty('--kyro-line-height', settings.lineHeight.toString());
    root.style.setProperty('--kyro-letter-spacing', `${settings.letterSpacing}px`);
    
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
  }, [settings]);

  // Update settings
  const updateSettings = useCallback((updates: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Announce message to screen readers
  const announce = useCallback((message: string, priority: AnnouncementPriority = 'polite') => {
    if (!settings.announcements) return;
    
    const id = `announcement-${++announcementIdRef.current}`;
    setAnnouncements(prev => [...prev, { id, message, priority, timestamp: Date.now() }]);
    
    // Auto-clear after announcement
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }, 5000);
  }, [settings.announcements]);

  // Clear all announcements
  const clearAnnouncements = useCallback(() => {
    setAnnouncements([]);
  }, []);

  // Focus element by ID
  const focusElement = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
      announce(`Focused on ${element.getAttribute('aria-label') || elementId}`);
    }
  }, [announce]);

  // Generate ARIA props
  const getAriaProps = useCallback((id: string, label: string, description?: string): Record<string, string> => {
    const props: Record<string, string> = {
      id,
      'aria-label': label,
      role: 'button',
      tabIndex: '0',
    };
    
    if (description) {
      props['aria-describedby'] = `${id}-description`;
    }
    
    return props;
  }, []);

  return (
    <AccessibilityContext.Provider value={{
      settings,
      updateSettings,
      announce,
      announcements,
      clearAnnouncements,
      focusElement,
      getAriaProps,
    }}>
      {/* Live region for screen reader announcements */}
      <div
        id="kyro-live-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        {announcements.map(a => (
          <span key={a.id}>{a.message}</span>
        ))}
      </div>
      
      {children}
    </AccessibilityContext.Provider>
  );
}

// Keyboard navigation hook
export function useKeyboardNavigation(
  items: { id: string; label: string; action: () => void }[],
  orientation: 'horizontal' | 'vertical' = 'vertical'
) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const { announce } = useAnnouncements();

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

    switch (event.key) {
      case nextKey:
        event.preventDefault();
        const nextIndex = (focusedIndex + 1) % items.length;
        setFocusedIndex(nextIndex);
        announce(items[nextIndex].label);
        break;
      case prevKey:
        event.preventDefault();
        const prevIndex = (focusedIndex - 1 + items.length) % items.length;
        setFocusedIndex(prevIndex);
        announce(items[prevIndex].label);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        items[focusedIndex]?.action();
        break;
      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        announce(items[0]?.label || '');
        break;
      case 'End':
        event.preventDefault();
        setFocusedIndex(items.length - 1);
        announce(items[items.length - 1]?.label || '');
        break;
    }
  }, [focusedIndex, items, orientation, announce]);

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    getAriaProps: (index: number) => ({
      role: 'menuitem',
      tabIndex: index === focusedIndex ? 0 : -1,
      'aria-selected': index === focusedIndex,
    }),
  };
}

// Focus trap hook
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>) {
  const { announce } = useAnnouncements();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, announce]);
}

// Skip link component
export function SkipLink({ targetId, label }: { targetId: string; label: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#1f4e79] focus:text-white focus:rounded"
      onClick={(e) => {
        e.preventDefault();
        const target = document.getElementById(targetId);
        if (target) {
          target.focus();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }}
    >
      {label}
    </a>
  );
}

// High contrast theme styles
export const highContrastStyles = `
  .high-contrast {
    --editor-background: #000000 !important;
    --editor-foreground: #ffffff !important;
    --editor-selection: #ffffff !important;
    --editor-selection-foreground: #000000 !important;
    --editor-cursor: #ffffff !important;
    --editor-line-highlight: #333333 !important;
    --editor-whitespace: #666666 !important;
    --editor-indent-guide: #333333 !important;
  }
  
  .high-contrast .focus-indicator {
    outline: 3px solid #ffffff !important;
    outline-offset: 2px !important;
  }
  
  .high-contrast button:focus,
  .high-contrast input:focus,
  .high-contrast select:focus,
  .high-contrast textarea:focus {
    outline: 3px solid #ffffff !important;
    outline-offset: 2px !important;
  }
`;

// Reduced motion styles
export const reducedMotionStyles = `
  .reduced-motion * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
`;

// Accessible button component
export function AccessibleButton({
  id,
  label,
  description,
  onPress,
  disabled = false,
  children,
  className = '',
}: {
  id: string;
  label: string;
  description?: string;
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const { settings, announce } = useAnnouncements();

  const handleClick = () => {
    if (!disabled) {
      onPress();
      announce(`Activated: ${label}`);
    }
  };

  return (
    <button
      id={id}
      role="button"
      aria-label={label}
      aria-describedby={description ? `${id}-description` : undefined}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      className={`focus:outline-none focus:ring-2 focus:ring-[#58a6ff] focus:ring-offset-2 focus:ring-offset-[#0d1117] ${
        settings.focusIndicators === 'enhanced' ? 'focus:ring-4' : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
      {description && (
        <span id={`${id}-description`} className="sr-only">
          {description}
        </span>
      )}
    </button>
  );
}

// Accessible panel component
export function AccessiblePanel({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      role="region"
      aria-labelledby={`${id}-title`}
      className="outline-none"
      tabIndex={-1}
    >
      <h2 id={`${id}-title`} className="sr-only">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default AccessibilityProvider;
