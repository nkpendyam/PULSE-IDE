// Kyro IDE - Theme System
// Comprehensive theme management with light/dark themes, custom themes,
// VS Code theme compatibility, and syntax highlighting support

// ============================================================================
// COLOR TYPES
// ============================================================================

export interface ThemeColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  alpha?: number;
}

export interface ThemeColors {
  // Base colors
  foreground: string;
  background: string;
  
  // UI Colors
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  muted: string;
  mutedForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  
  // Editor colors
  editorBackground: string;
  editorForeground: string;
  editorLineNumber: string;
  editorLineNumberActive: string;
  editorSelection: string;
  editorSelectionBackground: string;
  editorCursor: string;
  editorIndentGuide: string;
  editorIndentGuideActive: string;
  editorWhitespace: string;
  editorCurrentLine: string;
  editorFindMatch: string;
  editorFindMatchHighlight: string;
  editorBracketMatch: string;
  editorBracketMatchBackground: string;
  
  // Sidebar colors
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarBorder: string;
  sidebarActiveBackground: string;
  sidebarActiveForeground: string;
  sidebarHoverBackground: string;
  
  // Status bar colors
  statusBarBackground: string;
  statusBarForeground: string;
  statusBarBorder: string;
  statusBarHoverBackground: string;
  
  // Tab colors
  tabActiveBackground: string;
  tabActiveForeground: string;
  tabInactiveBackground: string;
  tabInactiveForeground: string;
  tabBorder: string;
  tabActiveBorder: string;
  
  // Panel colors
  panelBackground: string;
  panelForeground: string;
  panelBorder: string;
  
  // Terminal colors
  terminalBackground: string;
  terminalForeground: string;
  terminalCursor: string;
  terminalSelection: string;
  
  // Scrollbar colors
  scrollbarShadow: string;
  scrollbarSliderBackground: string;
  scrollbarSliderHoverBackground: string;
  scrollbarSliderActiveBackground: string;
}

export interface SyntaxColors {
  // Comments
  comment: string;
  commentLine: string;
  commentBlock: string;
  commentDoc: string;
  commentDocTag: string;
  
  // Strings
  string: string;
  stringLiteral: string;
  stringEscape: string;
  stringRegex: string;
  
  // Numbers
  number: string;
  numberFloat: string;
  numberHex: string;
  numberBinary: string;
  
  // Keywords
  keyword: string;
  keywordControl: string;
  keywordOperator: string;
  keywordDeclaration: string;
  
  // Types and Classes
  type: string;
  typeBuiltin: string;
  class: string;
  interface: string;
  struct: string;
  enum: string;
  
  // Functions and Methods
  function: string;
  functionBuiltin: string;
  functionCall: string;
  method: string;
  constructor: string;
  
  // Variables
  variable: string;
  variableBuiltin: string;
  variableParameter: string;
  variableThis: string;
  variableConstant: string;
  
  // Punctuation
  punctuation: string;
  punctuationBracket: string;
  punctuationDelimiter: string;
  punctuationSpecial: string;
  
  // Operators
  operator: string;
  operatorSymbol: string;
  
  // Tags (HTML/JSX)
  tag: string;
  tagName: string;
  tagAttribute: string;
  tagDelimiter: string;
  
  // Property
  property: string;
  propertyClass: string;
  
  // Label
  label: string;
  
  // Special
  constant: string;
  constantBuiltin: string;
  constantCharacter: string;
  constantEscape: string;
  
  // Diff colors
  diffAdded: string;
  diffAddedBackground: string;
  diffRemoved: string;
  diffRemovedBackground: string;
  diffModified: string;
  diffModifiedBackground: string;
  
  // Markup
  markupHeading: string;
  markupBold: string;
  markupItalic: string;
  markupUnderline: string;
  markupStrike: string;
  markupCode: string;
  markupLink: string;
  markupList: string;
  
  // Error and Warning
  error: string;
  errorBackground: string;
  warning: string;
  warningBackground: string;
  info: string;
  infoBackground: string;
  hint: string;
  hintBackground: string;
}

// ============================================================================
// THEME INTERFACE
// ============================================================================

export interface Theme {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  author?: string;
  version?: string;
  type: 'light' | 'dark';
  colors: ThemeColors;
  syntax: SyntaxColors;
  tokenColors?: TokenColorRule[];
  semanticTokenColors?: Record<string, string>;
  uiTheme?: 'vs-dark' | 'vs-light' | 'hc-black';
  custom?: boolean;
  tags?: string[];
}

export interface TokenColorRule {
  name?: string;
  scope: string | string[];
  settings: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

// ============================================================================
// VS CODE THEME COMPATIBILITY
// ============================================================================

export interface VSCodeTheme {
  name: string;
  type: 'light' | 'dark' | 'hc';
  colors?: Record<string, string>;
  tokenColors?: TokenColorRule[];
  semanticTokenColors?: Record<string, string | { foreground?: string; fontStyle?: string }>;
}

// ============================================================================
// THEME SETTINGS
// ============================================================================

export interface ThemeSettings {
  activeThemeId: string;
  preferredTheme: 'light' | 'dark' | 'system';
  customThemes: Theme[];
  syntaxTheme: string;
  uiScale: number;
  fontFamily: string;
  fontSize: number;
  accentColor: string;
  enableTransparency: boolean;
  transparencyLevel: number;
}

// ============================================================================
// THEME EXPORT/IMPORT
// ============================================================================

export interface ThemeExport {
  version: string;
  exportedAt: string;
  theme: Theme;
}

export interface ThemeImportResult {
  success: boolean;
  theme?: Theme;
  errors?: string[];
}

// ============================================================================
// PREDEFINED THEME IDS
// ============================================================================

export const PREDEFINED_THEMES = {
  DARK_DEFAULT: 'kyro-dark',
  LIGHT_DEFAULT: 'kyro-light',
  DARK_HIGH_CONTRAST: 'kyro-dark-hc',
  LIGHT_HIGH_CONTRAST: 'kyro-light-hc',
  MONOKAI: 'monokai',
  DRACULA: 'dracula',
  GITHUB_DARK: 'github-dark',
  GITHUB_LIGHT: 'github-light',
  ONE_DARK: 'one-dark',
  SOLARIZED_DARK: 'solarized-dark',
  SOLARIZED_LIGHT: 'solarized-light',
  NORD: 'nord',
  GRUVBOX_DARK: 'gruvbox-dark',
  GRUVBOX_LIGHT: 'gruvbox-light',
} as const;

// ============================================================================
// THEME MANAGER INTERFACE
// ============================================================================

export interface ThemeManager {
  // Theme operations
  getTheme(id: string): Theme | undefined;
  getActiveTheme(): Theme;
  setActiveTheme(id: string): void;
  getAllThemes(): Theme[];
  getBuiltInThemes(): Theme[];
  getCustomThemes(): Theme[];
  
  // Theme management
  createCustomTheme(theme: Partial<Theme>): Theme;
  updateCustomTheme(id: string, updates: Partial<Theme>): Theme | undefined;
  deleteCustomTheme(id: string): boolean;
  duplicateTheme(id: string): Theme | undefined;
  
  // Import/Export
  exportTheme(id: string): ThemeExport | undefined;
  importTheme(data: unknown): ThemeImportResult;
  importFromVSCode(vsCodeTheme: VSCodeTheme): Theme;
  
  // System theme
  getSystemTheme(): 'light' | 'dark';
  onSystemThemeChange(callback: (theme: 'light' | 'dark') => void): () => void;
  
  // CSS generation
  generateCSSVariables(theme: Theme): string;
  applyTheme(theme: Theme): void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Convert hex color to HSL
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Adjust color lightness
 */
export function adjustLightness(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  
  hsl.l = Math.max(0, Math.min(100, hsl.l + amount));
  
  // Convert HSL back to hex
  const { h, s, l } = { h: hsl.h / 360, s: hsl.s / 100, l: hsl.l / 100 };
  
  let r: number, g: number, b: number;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}

/**
 * Mix two colors
 */
export function mixColors(color1: string, color2: string, ratio: number = 0.5): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return color1;
  
  const r = Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio);
  const g = Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio);
  const b = Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio);
  
  return rgbToHex(r, g, b);
}

/**
 * Get contrast color (black or white) for a background
 */
export function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  
  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Validate hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Generate a theme ID from name
 */
export function generateThemeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Re-export everything from themes.ts
export * from './themes';
