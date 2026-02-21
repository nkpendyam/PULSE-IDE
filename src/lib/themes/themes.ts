// Kyro IDE - Theme Definitions and Manager
// Comprehensive theme system with built-in themes, custom theme support,
// and VS Code theme compatibility

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Theme,
  ThemeColors,
  SyntaxColors,
  TokenColorRule,
  VSCodeTheme,
  ThemeExport,
  ThemeImportResult,
  generateThemeId,
  adjustLightness,
  getContrastColor,
  PREDEFINED_THEMES,
} from './index';

// ============================================================================
// KYRO DARK THEME (Default)
// ============================================================================

export const KYRO_DARK_THEME: Theme = {
  id: PREDEFINED_THEMES.DARK_DEFAULT,
  name: 'Kyro Dark',
  displayName: 'Kyro Dark',
  description: 'Default dark theme for Kyro IDE with carefully crafted colors for coding',
  author: 'Kyro IDE',
  version: '1.0.0',
  type: 'dark',
  colors: {
    // Base colors
    foreground: '#e4e4e7',
    background: '#0d0d0f',
    
    // UI Colors
    primary: '#3b82f6',
    primaryForeground: '#ffffff',
    secondary: '#27272a',
    secondaryForeground: '#a1a1aa',
    accent: '#8b5cf6',
    accentForeground: '#ffffff',
    muted: '#27272a',
    mutedForeground: '#71717a',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    border: '#27272a',
    input: '#18181b',
    ring: '#3b82f6',
    
    // Editor colors
    editorBackground: '#0d0d0f',
    editorForeground: '#e4e4e7',
    editorLineNumber: '#52525b',
    editorLineNumberActive: '#a1a1aa',
    editorSelection: '#3b82f6',
    editorSelectionBackground: '#3b82f620',
    editorCursor: '#e4e4e7',
    editorIndentGuide: '#27272a',
    editorIndentGuideActive: '#3f3f46',
    editorWhitespace: '#3f3f46',
    editorCurrentLine: '#18181b',
    editorFindMatch: '#facc15',
    editorFindMatchHighlight: '#facc1520',
    editorBracketMatch: '#3b82f6',
    editorBracketMatchBackground: '#3b82f620',
    
    // Sidebar colors
    sidebarBackground: '#0a0a0b',
    sidebarForeground: '#a1a1aa',
    sidebarBorder: '#1f1f23',
    sidebarActiveBackground: '#3b82f620',
    sidebarActiveForeground: '#e4e4e7',
    sidebarHoverBackground: '#18181b',
    
    // Status bar colors
    statusBarBackground: '#0a0a0b',
    statusBarForeground: '#71717a',
    statusBarBorder: '#1f1f23',
    statusBarHoverBackground: '#18181b',
    
    // Tab colors
    tabActiveBackground: '#0d0d0f',
    tabActiveForeground: '#e4e4e7',
    tabInactiveBackground: '#0a0a0b',
    tabInactiveForeground: '#71717a',
    tabBorder: '#1f1f23',
    tabActiveBorder: '#3b82f6',
    
    // Panel colors
    panelBackground: '#0a0a0b',
    panelForeground: '#a1a1aa',
    panelBorder: '#1f1f23',
    
    // Terminal colors
    terminalBackground: '#0d0d0f',
    terminalForeground: '#e4e4e7',
    terminalCursor: '#e4e4e7',
    terminalSelection: '#3b82f640',
    
    // Scrollbar colors
    scrollbarShadow: '#000000',
    scrollbarSliderBackground: '#27272a80',
    scrollbarSliderHoverBackground: '#3f3f46a0',
    scrollbarSliderActiveBackground: '#52525ba0',
  },
  syntax: {
    // Comments
    comment: '#6b7280',
    commentLine: '#6b7280',
    commentBlock: '#6b7280',
    commentDoc: '#6b7280',
    commentDocTag: '#9ca3af',
    
    // Strings
    string: '#a3e635',
    stringLiteral: '#a3e635',
    stringEscape: '#fbbf24',
    stringRegex: '#f472b6',
    
    // Numbers
    number: '#fb923c',
    numberFloat: '#fb923c',
    numberHex: '#fb923c',
    numberBinary: '#fb923c',
    
    // Keywords
    keyword: '#c084fc',
    keywordControl: '#c084fc',
    keywordOperator: '#c084fc',
    keywordDeclaration: '#c084fc',
    
    // Types and Classes
    type: '#22d3ee',
    typeBuiltin: '#22d3ee',
    class: '#22d3ee',
    interface: '#22d3ee',
    struct: '#22d3ee',
    enum: '#22d3ee',
    
    // Functions and Methods
    function: '#60a5fa',
    functionBuiltin: '#60a5fa',
    functionCall: '#60a5fa',
    method: '#60a5fa',
    constructor: '#22d3ee',
    
    // Variables
    variable: '#e4e4e7',
    variableBuiltin: '#fb923c',
    variableParameter: '#fbbf24',
    variableThis: '#c084fc',
    variableConstant: '#a3e635',
    
    // Punctuation
    punctuation: '#9ca3af',
    punctuationBracket: '#9ca3af',
    punctuationDelimiter: '#9ca3af',
    punctuationSpecial: '#c084fc',
    
    // Operators
    operator: '#c084fc',
    operatorSymbol: '#c084fc',
    
    // Tags (HTML/JSX)
    tag: '#f472b6',
    tagName: '#f472b6',
    tagAttribute: '#fbbf24',
    tagDelimiter: '#9ca3af',
    
    // Property
    property: '#fbbf24',
    propertyClass: '#22d3ee',
    
    // Label
    label: '#60a5fa',
    
    // Special
    constant: '#fb923c',
    constantBuiltin: '#fb923c',
    constantCharacter: '#a3e635',
    constantEscape: '#fbbf24',
    
    // Diff colors
    diffAdded: '#22c55e',
    diffAddedBackground: '#22c55e20',
    diffRemoved: '#ef4444',
    diffRemovedBackground: '#ef444420',
    diffModified: '#3b82f6',
    diffModifiedBackground: '#3b82f620',
    
    // Markup
    markupHeading: '#c084fc',
    markupBold: '#e4e4e7',
    markupItalic: '#e4e4e7',
    markupUnderline: '#60a5fa',
    markupStrike: '#71717a',
    markupCode: '#a3e635',
    markupLink: '#60a5fa',
    markupList: '#fbbf24',
    
    // Error and Warning
    error: '#ef4444',
    errorBackground: '#ef444420',
    warning: '#f59e0b',
    warningBackground: '#f59e0b20',
    info: '#3b82f6',
    infoBackground: '#3b82f620',
    hint: '#22c55e',
    hintBackground: '#22c55e20',
  },
  tags: ['dark', 'default', 'blue-accent'],
};

// ============================================================================
// KYRO LIGHT THEME
// ============================================================================

export const KYRO_LIGHT_THEME: Theme = {
  id: PREDEFINED_THEMES.LIGHT_DEFAULT,
  name: 'Kyro Light',
  displayName: 'Kyro Light',
  description: 'Clean light theme for Kyro IDE with excellent readability',
  author: 'Kyro IDE',
  version: '1.0.0',
  type: 'light',
  colors: {
    // Base colors
    foreground: '#18181b',
    background: '#ffffff',
    
    // UI Colors
    primary: '#3b82f6',
    primaryForeground: '#ffffff',
    secondary: '#f4f4f5',
    secondaryForeground: '#3f3f46',
    accent: '#8b5cf6',
    accentForeground: '#ffffff',
    muted: '#f4f4f5',
    mutedForeground: '#71717a',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    border: '#e4e4e7',
    input: '#ffffff',
    ring: '#3b82f6',
    
    // Editor colors
    editorBackground: '#ffffff',
    editorForeground: '#18181b',
    editorLineNumber: '#a1a1aa',
    editorLineNumberActive: '#3f3f46',
    editorSelection: '#3b82f6',
    editorSelectionBackground: '#3b82f620',
    editorCursor: '#18181b',
    editorIndentGuide: '#e4e4e7',
    editorIndentGuideActive: '#d4d4d8',
    editorWhitespace: '#d4d4d8',
    editorCurrentLine: '#f4f4f5',
    editorFindMatch: '#facc15',
    editorFindMatchHighlight: '#facc1530',
    editorBracketMatch: '#3b82f6',
    editorBracketMatchBackground: '#3b82f620',
    
    // Sidebar colors
    sidebarBackground: '#fafafa',
    sidebarForeground: '#52525b',
    sidebarBorder: '#e4e4e7',
    sidebarActiveBackground: '#3b82f610',
    sidebarActiveForeground: '#18181b',
    sidebarHoverBackground: '#f4f4f5',
    
    // Status bar colors
    statusBarBackground: '#fafafa',
    statusBarForeground: '#71717a',
    statusBarBorder: '#e4e4e7',
    statusBarHoverBackground: '#f4f4f5',
    
    // Tab colors
    tabActiveBackground: '#ffffff',
    tabActiveForeground: '#18181b',
    tabInactiveBackground: '#fafafa',
    tabInactiveForeground: '#71717a',
    tabBorder: '#e4e4e7',
    tabActiveBorder: '#3b82f6',
    
    // Panel colors
    panelBackground: '#fafafa',
    panelForeground: '#52525b',
    panelBorder: '#e4e4e7',
    
    // Terminal colors
    terminalBackground: '#ffffff',
    terminalForeground: '#18181b',
    terminalCursor: '#18181b',
    terminalSelection: '#3b82f630',
    
    // Scrollbar colors
    scrollbarShadow: '#00000010',
    scrollbarSliderBackground: '#d4d4d8a0',
    scrollbarSliderHoverBackground: '#a1a1aac0',
    scrollbarSliderActiveBackground: '#71717ac0',
  },
  syntax: {
    // Comments
    comment: '#6b7280',
    commentLine: '#6b7280',
    commentBlock: '#6b7280',
    commentDoc: '#6b7280',
    commentDocTag: '#9ca3af',
    
    // Strings
    string: '#16a34a',
    stringLiteral: '#16a34a',
    stringEscape: '#d97706',
    stringRegex: '#db2777',
    
    // Numbers
    number: '#ea580c',
    numberFloat: '#ea580c',
    numberHex: '#ea580c',
    numberBinary: '#ea580c',
    
    // Keywords
    keyword: '#9333ea',
    keywordControl: '#9333ea',
    keywordOperator: '#9333ea',
    keywordDeclaration: '#9333ea',
    
    // Types and Classes
    type: '#0891b2',
    typeBuiltin: '#0891b2',
    class: '#0891b2',
    interface: '#0891b2',
    struct: '#0891b2',
    enum: '#0891b2',
    
    // Functions and Methods
    function: '#2563eb',
    functionBuiltin: '#2563eb',
    functionCall: '#2563eb',
    method: '#2563eb',
    constructor: '#0891b2',
    
    // Variables
    variable: '#18181b',
    variableBuiltin: '#ea580c',
    variableParameter: '#d97706',
    variableThis: '#9333ea',
    variableConstant: '#16a34a',
    
    // Punctuation
    punctuation: '#52525b',
    punctuationBracket: '#52525b',
    punctuationDelimiter: '#52525b',
    punctuationSpecial: '#9333ea',
    
    // Operators
    operator: '#9333ea',
    operatorSymbol: '#9333ea',
    
    // Tags (HTML/JSX)
    tag: '#db2777',
    tagName: '#db2777',
    tagAttribute: '#d97706',
    tagDelimiter: '#52525b',
    
    // Property
    property: '#d97706',
    propertyClass: '#0891b2',
    
    // Label
    label: '#2563eb',
    
    // Special
    constant: '#ea580c',
    constantBuiltin: '#ea580c',
    constantCharacter: '#16a34a',
    constantEscape: '#d97706',
    
    // Diff colors
    diffAdded: '#16a34a',
    diffAddedBackground: '#16a34a15',
    diffRemoved: '#dc2626',
    diffRemovedBackground: '#dc262615',
    diffModified: '#2563eb',
    diffModifiedBackground: '#2563eb15',
    
    // Markup
    markupHeading: '#9333ea',
    markupBold: '#18181b',
    markupItalic: '#18181b',
    markupUnderline: '#2563eb',
    markupStrike: '#71717a',
    markupCode: '#16a34a',
    markupLink: '#2563eb',
    markupList: '#d97706',
    
    // Error and Warning
    error: '#dc2626',
    errorBackground: '#dc262615',
    warning: '#d97706',
    warningBackground: '#d9770615',
    info: '#2563eb',
    infoBackground: '#2563eb15',
    hint: '#16a34a',
    hintBackground: '#16a34a15',
  },
  tags: ['light', 'default', 'blue-accent'],
};

// ============================================================================
// MONOKAI THEME
// ============================================================================

export const MONOKAI_THEME: Theme = {
  id: PREDEFINED_THEMES.MONOKAI,
  name: 'Monokai',
  displayName: 'Monokai',
  description: 'Classic Monokai color theme',
  author: 'Wimer Hazenberg',
  version: '1.0.0',
  type: 'dark',
  colors: {
    foreground: '#f8f8f2',
    background: '#272822',
    primary: '#a6e22e',
    primaryForeground: '#272822',
    secondary: '#3e3d32',
    secondaryForeground: '#f8f8f2',
    accent: '#ae81ff',
    accentForeground: '#272822',
    muted: '#3e3d32',
    mutedForeground: '#75715e',
    destructive: '#f92672',
    destructiveForeground: '#272822',
    border: '#3e3d32',
    input: '#1e1f1c',
    ring: '#a6e22e',
    editorBackground: '#272822',
    editorForeground: '#f8f8f2',
    editorLineNumber: '#75715e',
    editorLineNumberActive: '#f8f8f2',
    editorSelection: '#a6e22e',
    editorSelectionBackground: '#a6e22e30',
    editorCursor: '#f8f8f0',
    editorIndentGuide: '#3e3d32',
    editorIndentGuideActive: '#75715e',
    editorWhitespace: '#464741',
    editorCurrentLine: '#3e3d32',
    editorFindMatch: '#e6db74',
    editorFindMatchHighlight: '#e6db7430',
    editorBracketMatch: '#f8f8f2',
    editorBracketMatchBackground: '#a6e22e30',
    sidebarBackground: '#1e1f1c',
    sidebarForeground: '#f8f8f2',
    sidebarBorder: '#3e3d32',
    sidebarActiveBackground: '#a6e22e20',
    sidebarActiveForeground: '#f8f8f2',
    sidebarHoverBackground: '#3e3d32',
    statusBarBackground: '#1e1f1c',
    statusBarForeground: '#75715e',
    statusBarBorder: '#3e3d32',
    statusBarHoverBackground: '#3e3d32',
    tabActiveBackground: '#272822',
    tabActiveForeground: '#f8f8f2',
    tabInactiveBackground: '#1e1f1c',
    tabInactiveForeground: '#75715e',
    tabBorder: '#3e3d32',
    tabActiveBorder: '#a6e22e',
    panelBackground: '#1e1f1c',
    panelForeground: '#f8f8f2',
    panelBorder: '#3e3d32',
    terminalBackground: '#272822',
    terminalForeground: '#f8f8f2',
    terminalCursor: '#f8f8f0',
    terminalSelection: '#a6e22e40',
    scrollbarShadow: '#000000',
    scrollbarSliderBackground: '#3e3d3280',
    scrollbarSliderHoverBackground: '#75715ea0',
    scrollbarSliderActiveBackground: '#a6e22ea0',
  },
  syntax: {
    comment: '#75715e',
    commentLine: '#75715e',
    commentBlock: '#75715e',
    commentDoc: '#75715e',
    commentDocTag: '#75715e',
    string: '#e6db74',
    stringLiteral: '#e6db74',
    stringEscape: '#ae81ff',
    stringRegex: '#e6db74',
    number: '#ae81ff',
    numberFloat: '#ae81ff',
    numberHex: '#ae81ff',
    numberBinary: '#ae81ff',
    keyword: '#f92672',
    keywordControl: '#f92672',
    keywordOperator: '#f92672',
    keywordDeclaration: '#f92672',
    type: '#66d9ef',
    typeBuiltin: '#66d9ef',
    class: '#66d9ef',
    interface: '#66d9ef',
    struct: '#66d9ef',
    enum: '#66d9ef',
    function: '#a6e22e',
    functionBuiltin: '#a6e22e',
    functionCall: '#a6e22e',
    method: '#a6e22e',
    constructor: '#66d9ef',
    variable: '#f8f8f2',
    variableBuiltin: '#fd971f',
    variableParameter: '#fd971f',
    variableThis: '#fd971f',
    variableConstant: '#ae81ff',
    punctuation: '#f8f8f2',
    punctuationBracket: '#f8f8f2',
    punctuationDelimiter: '#f8f8f2',
    punctuationSpecial: '#f92672',
    operator: '#f92672',
    operatorSymbol: '#f92672',
    tag: '#f92672',
    tagName: '#f92672',
    tagAttribute: '#a6e22e',
    tagDelimiter: '#f8f8f2',
    property: '#a6e22e',
    propertyClass: '#66d9ef',
    label: '#a6e22e',
    constant: '#ae81ff',
    constantBuiltin: '#ae81ff',
    constantCharacter: '#e6db74',
    constantEscape: '#ae81ff',
    diffAdded: '#a6e22e',
    diffAddedBackground: '#a6e22e20',
    diffRemoved: '#f92672',
    diffRemovedBackground: '#f9267220',
    diffModified: '#66d9ef',
    diffModifiedBackground: '#66d9ef20',
    markupHeading: '#f92672',
    markupBold: '#f8f8f2',
    markupItalic: '#f8f8f2',
    markupUnderline: '#66d9ef',
    markupStrike: '#75715e',
    markupCode: '#e6db74',
    markupLink: '#a6e22e',
    markupList: '#fd971f',
    error: '#f92672',
    errorBackground: '#f9267220',
    warning: '#e6db74',
    warningBackground: '#e6db7420',
    info: '#66d9ef',
    infoBackground: '#66d9ef20',
    hint: '#a6e22e',
    hintBackground: '#a6e22e20',
  },
  tags: ['dark', 'classic', 'popular'],
};

// ============================================================================
// DRACULA THEME
// ============================================================================

export const DRACULA_THEME: Theme = {
  id: PREDEFINED_THEMES.DRACULA,
  name: 'Dracula',
  displayName: 'Dracula',
  description: 'A dark theme for many editors, shells, and more',
  author: 'Dracula Theme',
  version: '1.0.0',
  type: 'dark',
  colors: {
    foreground: '#f8f8f2',
    background: '#282a36',
    primary: '#bd93f9',
    primaryForeground: '#282a36',
    secondary: '#44475a',
    secondaryForeground: '#f8f8f2',
    accent: '#ff79c6',
    accentForeground: '#282a36',
    muted: '#44475a',
    mutedForeground: '#6272a4',
    destructive: '#ff5555',
    destructiveForeground: '#282a36',
    border: '#44475a',
    input: '#1d1e26',
    ring: '#bd93f9',
    editorBackground: '#282a36',
    editorForeground: '#f8f8f2',
    editorLineNumber: '#6272a4',
    editorLineNumberActive: '#f8f8f2',
    editorSelection: '#bd93f9',
    editorSelectionBackground: '#bd93f930',
    editorCursor: '#f8f8f0',
    editorIndentGuide: '#44475a',
    editorIndentGuideActive: '#6272a4',
    editorWhitespace: '#44475a',
    editorCurrentLine: '#44475a50',
    editorFindMatch: '#f1fa8c',
    editorFindMatchHighlight: '#f1fa8c30',
    editorBracketMatch: '#f8f8f2',
    editorBracketMatchBackground: '#bd93f930',
    sidebarBackground: '#21222c',
    sidebarForeground: '#f8f8f2',
    sidebarBorder: '#44475a',
    sidebarActiveBackground: '#bd93f920',
    sidebarActiveForeground: '#f8f8f2',
    sidebarHoverBackground: '#44475a',
    statusBarBackground: '#21222c',
    statusBarForeground: '#6272a4',
    statusBarBorder: '#44475a',
    statusBarHoverBackground: '#44475a',
    tabActiveBackground: '#282a36',
    tabActiveForeground: '#f8f8f2',
    tabInactiveBackground: '#21222c',
    tabInactiveForeground: '#6272a4',
    tabBorder: '#44475a',
    tabActiveBorder: '#bd93f9',
    panelBackground: '#21222c',
    panelForeground: '#f8f8f2',
    panelBorder: '#44475a',
    terminalBackground: '#282a36',
    terminalForeground: '#f8f8f2',
    terminalCursor: '#f8f8f0',
    terminalSelection: '#bd93f940',
    scrollbarShadow: '#000000',
    scrollbarSliderBackground: '#44475a80',
    scrollbarSliderHoverBackground: '#6272a4a0',
    scrollbarSliderActiveBackground: '#bd93f9a0',
  },
  syntax: {
    comment: '#6272a4',
    commentLine: '#6272a4',
    commentBlock: '#6272a4',
    commentDoc: '#6272a4',
    commentDocTag: '#6272a4',
    string: '#f1fa8c',
    stringLiteral: '#f1fa8c',
    stringEscape: '#ff79c6',
    stringRegex: '#f1fa8c',
    number: '#bd93f9',
    numberFloat: '#bd93f9',
    numberHex: '#bd93f9',
    numberBinary: '#bd93f9',
    keyword: '#ff79c6',
    keywordControl: '#ff79c6',
    keywordOperator: '#ff79c6',
    keywordDeclaration: '#ff79c6',
    type: '#8be9fd',
    typeBuiltin: '#8be9fd',
    class: '#8be9fd',
    interface: '#8be9fd',
    struct: '#8be9fd',
    enum: '#8be9fd',
    function: '#50fa7b',
    functionBuiltin: '#50fa7b',
    functionCall: '#50fa7b',
    method: '#50fa7b',
    constructor: '#8be9fd',
    variable: '#f8f8f2',
    variableBuiltin: '#ffb86c',
    variableParameter: '#ffb86c',
    variableThis: '#ff79c6',
    variableConstant: '#bd93f9',
    punctuation: '#f8f8f2',
    punctuationBracket: '#f8f8f2',
    punctuationDelimiter: '#f8f8f2',
    punctuationSpecial: '#ff79c6',
    operator: '#ff79c6',
    operatorSymbol: '#ff79c6',
    tag: '#ff79c6',
    tagName: '#ff79c6',
    tagAttribute: '#50fa7b',
    tagDelimiter: '#f8f8f2',
    property: '#50fa7b',
    propertyClass: '#8be9fd',
    label: '#50fa7b',
    constant: '#bd93f9',
    constantBuiltin: '#bd93f9',
    constantCharacter: '#f1fa8c',
    constantEscape: '#ff79c6',
    diffAdded: '#50fa7b',
    diffAddedBackground: '#50fa7b20',
    diffRemoved: '#ff5555',
    diffRemovedBackground: '#ff555520',
    diffModified: '#8be9fd',
    diffModifiedBackground: '#8be9fd20',
    markupHeading: '#ff79c6',
    markupBold: '#f8f8f2',
    markupItalic: '#f8f8f2',
    markupUnderline: '#8be9fd',
    markupStrike: '#6272a4',
    markupCode: '#f1fa8c',
    markupLink: '#50fa7b',
    markupList: '#ffb86c',
    error: '#ff5555',
    errorBackground: '#ff555520',
    warning: '#f1fa8c',
    warningBackground: '#f1fa8c20',
    info: '#8be9fd',
    infoBackground: '#8be9fd20',
    hint: '#50fa7b',
    hintBackground: '#50fa7b20',
  },
  tags: ['dark', 'popular', 'purple-accent'],
};

// ============================================================================
// ONE DARK THEME
// ============================================================================

export const ONE_DARK_THEME: Theme = {
  id: PREDEFINED_THEMES.ONE_DARK,
  name: 'One Dark',
  displayName: 'One Dark Pro',
  description: 'Atom One Dark theme for Kyro IDE',
  author: 'binaryify',
  version: '1.0.0',
  type: 'dark',
  colors: {
    foreground: '#abb2bf',
    background: '#282c34',
    primary: '#528bff',
    primaryForeground: '#282c34',
    secondary: '#21252b',
    secondaryForeground: '#abb2bf',
    accent: '#c678dd',
    accentForeground: '#282c34',
    muted: '#21252b',
    mutedForeground: '#5c6370',
    destructive: '#e06c75',
    destructiveForeground: '#282c34',
    border: '#181a1f',
    input: '#21252b',
    ring: '#528bff',
    editorBackground: '#282c34',
    editorForeground: '#abb2bf',
    editorLineNumber: '#495162',
    editorLineNumberActive: '#abb2bf',
    editorSelection: '#528bff',
    editorSelectionBackground: '#528bff30',
    editorCursor: '#528bff',
    editorIndentGuide: '#3b4048',
    editorIndentGuideActive: '#495162',
    editorWhitespace: '#3b4048',
    editorCurrentLine: '#2c313a',
    editorFindMatch: '#e5c07b',
    editorFindMatchHighlight: '#e5c07b30',
    editorBracketMatch: '#abb2bf',
    editorBracketMatchBackground: '#528bff30',
    sidebarBackground: '#21252b',
    sidebarForeground: '#abb2bf',
    sidebarBorder: '#181a1f',
    sidebarActiveBackground: '#528bff20',
    sidebarActiveForeground: '#abb2bf',
    sidebarHoverBackground: '#2c313a',
    statusBarBackground: '#21252b',
    statusBarForeground: '#5c6370',
    statusBarBorder: '#181a1f',
    statusBarHoverBackground: '#2c313a',
    tabActiveBackground: '#282c34',
    tabActiveForeground: '#abb2bf',
    tabInactiveBackground: '#21252b',
    tabInactiveForeground: '#5c6370',
    tabBorder: '#181a1f',
    tabActiveBorder: '#528bff',
    panelBackground: '#21252b',
    panelForeground: '#abb2bf',
    panelBorder: '#181a1f',
    terminalBackground: '#282c34',
    terminalForeground: '#abb2bf',
    terminalCursor: '#528bff',
    terminalSelection: '#528bff40',
    scrollbarShadow: '#000000',
    scrollbarSliderBackground: '#3b404880',
    scrollbarSliderHoverBackground: '#495162a0',
    scrollbarSliderActiveBackground: '#528bffa0',
  },
  syntax: {
    comment: '#5c6370',
    commentLine: '#5c6370',
    commentBlock: '#5c6370',
    commentDoc: '#5c6370',
    commentDocTag: '#5c6370',
    string: '#98c379',
    stringLiteral: '#98c379',
    stringEscape: '#56b6c2',
    stringRegex: '#98c379',
    number: '#d19a66',
    numberFloat: '#d19a66',
    numberHex: '#d19a66',
    numberBinary: '#d19a66',
    keyword: '#c678dd',
    keywordControl: '#c678dd',
    keywordOperator: '#c678dd',
    keywordDeclaration: '#c678dd',
    type: '#e5c07b',
    typeBuiltin: '#e5c07b',
    class: '#e5c07b',
    interface: '#e5c07b',
    struct: '#e5c07b',
    enum: '#e5c07b',
    function: '#61afef',
    functionBuiltin: '#61afef',
    functionCall: '#61afef',
    method: '#61afef',
    constructor: '#e5c07b',
    variable: '#abb2bf',
    variableBuiltin: '#e5c07b',
    variableParameter: '#e06c75',
    variableThis: '#e5c07b',
    variableConstant: '#d19a66',
    punctuation: '#abb2bf',
    punctuationBracket: '#abb2bf',
    punctuationDelimiter: '#abb2bf',
    punctuationSpecial: '#c678dd',
    operator: '#56b6c2',
    operatorSymbol: '#56b6c2',
    tag: '#e06c75',
    tagName: '#e06c75',
    tagAttribute: '#98c379',
    tagDelimiter: '#abb2bf',
    property: '#e06c75',
    propertyClass: '#e5c07b',
    label: '#61afef',
    constant: '#d19a66',
    constantBuiltin: '#d19a66',
    constantCharacter: '#98c379',
    constantEscape: '#56b6c2',
    diffAdded: '#98c379',
    diffAddedBackground: '#98c37920',
    diffRemoved: '#e06c75',
    diffRemovedBackground: '#e06c7520',
    diffModified: '#61afef',
    diffModifiedBackground: '#61afef20',
    markupHeading: '#c678dd',
    markupBold: '#abb2bf',
    markupItalic: '#abb2bf',
    markupUnderline: '#61afef',
    markupStrike: '#5c6370',
    markupCode: '#98c379',
    markupLink: '#61afef',
    markupList: '#d19a66',
    error: '#e06c75',
    errorBackground: '#e06c7520',
    warning: '#e5c07b',
    warningBackground: '#e5c07b20',
    info: '#61afef',
    infoBackground: '#61afef20',
    hint: '#98c379',
    hintBackground: '#98c37920',
  },
  tags: ['dark', 'popular', 'atom'],
};

// ============================================================================
// GITHUB DARK THEME
// ============================================================================

export const GITHUB_DARK_THEME: Theme = {
  id: PREDEFINED_THEMES.GITHUB_DARK,
  name: 'GitHub Dark',
  displayName: 'GitHub Dark',
  description: 'GitHub dark theme for Kyro IDE',
  author: 'GitHub',
  version: '1.0.0',
  type: 'dark',
  colors: {
    foreground: '#c9d1d9',
    background: '#0d1117',
    primary: '#58a6ff',
    primaryForeground: '#0d1117',
    secondary: '#161b22',
    secondaryForeground: '#c9d1d9',
    accent: '#f778ba',
    accentForeground: '#0d1117',
    muted: '#161b22',
    mutedForeground: '#8b949e',
    destructive: '#f85149',
    destructiveForeground: '#0d1117',
    border: '#30363d',
    input: '#0d1117',
    ring: '#58a6ff',
    editorBackground: '#0d1117',
    editorForeground: '#c9d1d9',
    editorLineNumber: '#484f58',
    editorLineNumberActive: '#c9d1d9',
    editorSelection: '#58a6ff',
    editorSelectionBackground: '#58a6ff30',
    editorCursor: '#c9d1d9',
    editorIndentGuide: '#21262d',
    editorIndentGuideActive: '#30363d',
    editorWhitespace: '#30363d',
    editorCurrentLine: '#161b22',
    editorFindMatch: '#e3b341',
    editorFindMatchHighlight: '#e3b34130',
    editorBracketMatch: '#c9d1d9',
    editorBracketMatchBackground: '#58a6ff30',
    sidebarBackground: '#010409',
    sidebarForeground: '#8b949e',
    sidebarBorder: '#21262d',
    sidebarActiveBackground: '#58a6ff20',
    sidebarActiveForeground: '#c9d1d9',
    sidebarHoverBackground: '#161b22',
    statusBarBackground: '#010409',
    statusBarForeground: '#8b949e',
    statusBarBorder: '#21262d',
    statusBarHoverBackground: '#161b22',
    tabActiveBackground: '#0d1117',
    tabActiveForeground: '#c9d1d9',
    tabInactiveBackground: '#010409',
    tabInactiveForeground: '#8b949e',
    tabBorder: '#21262d',
    tabActiveBorder: '#f78166',
    panelBackground: '#010409',
    panelForeground: '#8b949e',
    panelBorder: '#21262d',
    terminalBackground: '#0d1117',
    terminalForeground: '#c9d1d9',
    terminalCursor: '#c9d1d9',
    terminalSelection: '#58a6ff40',
    scrollbarShadow: '#000000',
    scrollbarSliderBackground: '#30363d80',
    scrollbarSliderHoverBackground: '#484f58a0',
    scrollbarSliderActiveBackground: '#58a6ffa0',
  },
  syntax: {
    comment: '#8b949e',
    commentLine: '#8b949e',
    commentBlock: '#8b949e',
    commentDoc: '#8b949e',
    commentDocTag: '#8b949e',
    string: '#a5d6ff',
    stringLiteral: '#a5d6ff',
    stringEscape: '#79c0ff',
    stringRegex: '#a5d6ff',
    number: '#79c0ff',
    numberFloat: '#79c0ff',
    numberHex: '#79c0ff',
    numberBinary: '#79c0ff',
    keyword: '#ff7b72',
    keywordControl: '#ff7b72',
    keywordOperator: '#ff7b72',
    keywordDeclaration: '#ff7b72',
    type: '#ffa657',
    typeBuiltin: '#ffa657',
    class: '#ffa657',
    interface: '#ffa657',
    struct: '#ffa657',
    enum: '#ffa657',
    function: '#d2a8ff',
    functionBuiltin: '#d2a8ff',
    functionCall: '#d2a8ff',
    method: '#d2a8ff',
    constructor: '#ffa657',
    variable: '#c9d1d9',
    variableBuiltin: '#ffa657',
    variableParameter: '#ffa657',
    variableThis: '#ff7b72',
    variableConstant: '#79c0ff',
    punctuation: '#c9d1d9',
    punctuationBracket: '#c9d1d9',
    punctuationDelimiter: '#c9d1d9',
    punctuationSpecial: '#ff7b72',
    operator: '#ff7b72',
    operatorSymbol: '#ff7b72',
    tag: '#7ee787',
    tagName: '#7ee787',
    tagAttribute: '#79c0ff',
    tagDelimiter: '#c9d1d9',
    property: '#79c0ff',
    propertyClass: '#ffa657',
    label: '#d2a8ff',
    constant: '#79c0ff',
    constantBuiltin: '#79c0ff',
    constantCharacter: '#a5d6ff',
    constantEscape: '#79c0ff',
    diffAdded: '#3fb950',
    diffAddedBackground: '#3fb95020',
    diffRemoved: '#f85149',
    diffRemovedBackground: '#f8514920',
    diffModified: '#58a6ff',
    diffModifiedBackground: '#58a6ff20',
    markupHeading: '#ff7b72',
    markupBold: '#c9d1d9',
    markupItalic: '#c9d1d9',
    markupUnderline: '#58a6ff',
    markupStrike: '#8b949e',
    markupCode: '#a5d6ff',
    markupLink: '#58a6ff',
    markupList: '#ffa657',
    error: '#f85149',
    errorBackground: '#f8514920',
    warning: '#e3b341',
    warningBackground: '#e3b34120',
    info: '#58a6ff',
    infoBackground: '#58a6ff20',
    hint: '#3fb950',
    hintBackground: '#3fb95020',
  },
  tags: ['dark', 'popular', 'github'],
};

// ============================================================================
// GITHUB LIGHT THEME
// ============================================================================

export const GITHUB_LIGHT_THEME: Theme = {
  id: PREDEFINED_THEMES.GITHUB_LIGHT,
  name: 'GitHub Light',
  displayName: 'GitHub Light',
  description: 'GitHub light theme for Kyro IDE',
  author: 'GitHub',
  version: '1.0.0',
  type: 'light',
  colors: {
    foreground: '#24292f',
    background: '#ffffff',
    primary: '#0969da',
    primaryForeground: '#ffffff',
    secondary: '#f6f8fa',
    secondaryForeground: '#24292f',
    accent: '#bf3989',
    accentForeground: '#ffffff',
    muted: '#f6f8fa',
    mutedForeground: '#57606a',
    destructive: '#cf222e',
    destructiveForeground: '#ffffff',
    border: '#d0d7de',
    input: '#ffffff',
    ring: '#0969da',
    editorBackground: '#ffffff',
    editorForeground: '#24292f',
    editorLineNumber: '#8c959f',
    editorLineNumberActive: '#24292f',
    editorSelection: '#0969da',
    editorSelectionBackground: '#0969da20',
    editorCursor: '#24292f',
    editorIndentGuide: '#d8dee4',
    editorIndentGuideActive: '#8c959f',
    editorWhitespace: '#d8dee4',
    editorCurrentLine: '#f6f8fa',
    editorFindMatch: '#bf8700',
    editorFindMatchHighlight: '#bf870020',
    editorBracketMatch: '#24292f',
    editorBracketMatchBackground: '#0969da20',
    sidebarBackground: '#f6f8fa',
    sidebarForeground: '#57606a',
    sidebarBorder: '#d0d7de',
    sidebarActiveBackground: '#0969da15',
    sidebarActiveForeground: '#24292f',
    sidebarHoverBackground: '#f3f4f6',
    statusBarBackground: '#f6f8fa',
    statusBarForeground: '#57606a',
    statusBarBorder: '#d0d7de',
    statusBarHoverBackground: '#f3f4f6',
    tabActiveBackground: '#ffffff',
    tabActiveForeground: '#24292f',
    tabInactiveBackground: '#f6f8fa',
    tabInactiveForeground: '#57606a',
    tabBorder: '#d0d7de',
    tabActiveBorder: '#fd8c73',
    panelBackground: '#f6f8fa',
    panelForeground: '#57606a',
    panelBorder: '#d0d7de',
    terminalBackground: '#ffffff',
    terminalForeground: '#24292f',
    terminalCursor: '#24292f',
    terminalSelection: '#0969da30',
    scrollbarShadow: '#00000010',
    scrollbarSliderBackground: '#d0d7dea0',
    scrollbarSliderHoverBackground: '#8c959fc0',
    scrollbarSliderActiveBackground: '#0969dac0',
  },
  syntax: {
    comment: '#6e7781',
    commentLine: '#6e7781',
    commentBlock: '#6e7781',
    commentDoc: '#6e7781',
    commentDocTag: '#6e7781',
    string: '#0a3069',
    stringLiteral: '#0a3069',
    stringEscape: '#0550ae',
    stringRegex: '#0a3069',
    number: '#0550ae',
    numberFloat: '#0550ae',
    numberHex: '#0550ae',
    numberBinary: '#0550ae',
    keyword: '#cf222e',
    keywordControl: '#cf222e',
    keywordOperator: '#cf222e',
    keywordDeclaration: '#cf222e',
    type: '#953800',
    typeBuiltin: '#953800',
    class: '#953800',
    interface: '#953800',
    struct: '#953800',
    enum: '#953800',
    function: '#8250df',
    functionBuiltin: '#8250df',
    functionCall: '#8250df',
    method: '#8250df',
    constructor: '#953800',
    variable: '#24292f',
    variableBuiltin: '#953800',
    variableParameter: '#953800',
    variableThis: '#cf222e',
    variableConstant: '#0550ae',
    punctuation: '#24292f',
    punctuationBracket: '#24292f',
    punctuationDelimiter: '#24292f',
    punctuationSpecial: '#cf222e',
    operator: '#cf222e',
    operatorSymbol: '#cf222e',
    tag: '#116329',
    tagName: '#116329',
    tagAttribute: '#0550ae',
    tagDelimiter: '#24292f',
    property: '#0550ae',
    propertyClass: '#953800',
    label: '#8250df',
    constant: '#0550ae',
    constantBuiltin: '#0550ae',
    constantCharacter: '#0a3069',
    constantEscape: '#0550ae',
    diffAdded: '#1a7f37',
    diffAddedBackground: '#1a7f3715',
    diffRemoved: '#cf222e',
    diffRemovedBackground: '#cf222e15',
    diffModified: '#0969da',
    diffModifiedBackground: '#0969da15',
    markupHeading: '#cf222e',
    markupBold: '#24292f',
    markupItalic: '#24292f',
    markupUnderline: '#0969da',
    markupStrike: '#6e7781',
    markupCode: '#0a3069',
    markupLink: '#0969da',
    markupList: '#953800',
    error: '#cf222e',
    errorBackground: '#cf222e15',
    warning: '#bf8700',
    warningBackground: '#bf870015',
    info: '#0969da',
    infoBackground: '#0969da15',
    hint: '#1a7f37',
    hintBackground: '#1a7f3715',
  },
  tags: ['light', 'popular', 'github'],
};

// ============================================================================
// NORD THEME
// ============================================================================

export const NORD_THEME: Theme = {
  id: PREDEFINED_THEMES.NORD,
  name: 'Nord',
  displayName: 'Nord',
  description: 'An arctic, north-bluish clean and elegant theme',
  author: 'Arctic Ice Studio',
  version: '1.0.0',
  type: 'dark',
  colors: {
    foreground: '#d8dee9',
    background: '#2e3440',
    primary: '#88c0d0',
    primaryForeground: '#2e3440',
    secondary: '#3b4252',
    secondaryForeground: '#d8dee9',
    accent: '#b48ead',
    accentForeground: '#2e3440',
    muted: '#3b4252',
    mutedForeground: '#4c566a',
    destructive: '#bf616a',
    destructiveForeground: '#2e3440',
    border: '#3b4252',
    input: '#242933',
    ring: '#88c0d0',
    editorBackground: '#2e3440',
    editorForeground: '#d8dee9',
    editorLineNumber: '#4c566a',
    editorLineNumberActive: '#d8dee9',
    editorSelection: '#88c0d0',
    editorSelectionBackground: '#88c0d030',
    editorCursor: '#d8dee9',
    editorIndentGuide: '#4c566a',
    editorIndentGuideActive: '#4c566a',
    editorWhitespace: '#4c566a',
    editorCurrentLine: '#3b4252',
    editorFindMatch: '#ebcb8b',
    editorFindMatchHighlight: '#ebcb8b30',
    editorBracketMatch: '#d8dee9',
    editorBracketMatchBackground: '#88c0d030',
    sidebarBackground: '#242933',
    sidebarForeground: '#d8dee9',
    sidebarBorder: '#3b4252',
    sidebarActiveBackground: '#88c0d020',
    sidebarActiveForeground: '#d8dee9',
    sidebarHoverBackground: '#3b4252',
    statusBarBackground: '#242933',
    statusBarForeground: '#4c566a',
    statusBarBorder: '#3b4252',
    statusBarHoverBackground: '#3b4252',
    tabActiveBackground: '#2e3440',
    tabActiveForeground: '#d8dee9',
    tabInactiveBackground: '#242933',
    tabInactiveForeground: '#4c566a',
    tabBorder: '#3b4252',
    tabActiveBorder: '#88c0d0',
    panelBackground: '#242933',
    panelForeground: '#d8dee9',
    panelBorder: '#3b4252',
    terminalBackground: '#2e3440',
    terminalForeground: '#d8dee9',
    terminalCursor: '#d8dee9',
    terminalSelection: '#88c0d040',
    scrollbarShadow: '#000000',
    scrollbarSliderBackground: '#4c566a80',
    scrollbarSliderHoverBackground: '#d8dee9a0',
    scrollbarSliderActiveBackground: '#88c0d0a0',
  },
  syntax: {
    comment: '#616e88',
    commentLine: '#616e88',
    commentBlock: '#616e88',
    commentDoc: '#616e88',
    commentDocTag: '#616e88',
    string: '#a3be8c',
    stringLiteral: '#a3be8c',
    stringEscape: '#ebcb8b',
    stringRegex: '#a3be8c',
    number: '#b48ead',
    numberFloat: '#b48ead',
    numberHex: '#b48ead',
    numberBinary: '#b48ead',
    keyword: '#81a1c1',
    keywordControl: '#81a1c1',
    keywordOperator: '#81a1c1',
    keywordDeclaration: '#81a1c1',
    type: '#8fbcbb',
    typeBuiltin: '#8fbcbb',
    class: '#8fbcbb',
    interface: '#8fbcbb',
    struct: '#8fbcbb',
    enum: '#8fbcbb',
    function: '#88c0d0',
    functionBuiltin: '#88c0d0',
    functionCall: '#88c0d0',
    method: '#88c0d0',
    constructor: '#8fbcbb',
    variable: '#d8dee9',
    variableBuiltin: '#81a1c1',
    variableParameter: '#d8dee9',
    variableThis: '#81a1c1',
    variableConstant: '#b48ead',
    punctuation: '#eceff4',
    punctuationBracket: '#eceff4',
    punctuationDelimiter: '#eceff4',
    punctuationSpecial: '#81a1c1',
    operator: '#81a1c1',
    operatorSymbol: '#81a1c1',
    tag: '#81a1c1',
    tagName: '#81a1c1',
    tagAttribute: '#8fbcbb',
    tagDelimiter: '#eceff4',
    property: '#88c0d0',
    propertyClass: '#8fbcbb',
    label: '#88c0d0',
    constant: '#b48ead',
    constantBuiltin: '#b48ead',
    constantCharacter: '#a3be8c',
    constantEscape: '#ebcb8b',
    diffAdded: '#a3be8c',
    diffAddedBackground: '#a3be8c20',
    diffRemoved: '#bf616a',
    diffRemovedBackground: '#bf616a20',
    diffModified: '#88c0d0',
    diffModifiedBackground: '#88c0d020',
    markupHeading: '#88c0d0',
    markupBold: '#d8dee9',
    markupItalic: '#d8dee9',
    markupUnderline: '#88c0d0',
    markupStrike: '#616e88',
    markupCode: '#a3be8c',
    markupLink: '#88c0d0',
    markupList: '#ebcb8b',
    error: '#bf616a',
    errorBackground: '#bf616a20',
    warning: '#ebcb8b',
    warningBackground: '#ebcb8b20',
    info: '#88c0d0',
    infoBackground: '#88c0d020',
    hint: '#a3be8c',
    hintBackground: '#a3be8c20',
  },
  tags: ['dark', 'popular', 'bluish'],
};

// ============================================================================
// SOLARIZED DARK THEME
// ============================================================================

export const SOLARIZED_DARK_THEME: Theme = {
  id: PREDEFINED_THEMES.SOLARIZED_DARK,
  name: 'Solarized Dark',
  displayName: 'Solarized Dark',
  description: 'Precision color scheme for machines and people',
  author: 'Ethan Schoonover',
  version: '1.0.0',
  type: 'dark',
  colors: {
    foreground: '#839496',
    background: '#002b36',
    primary: '#268bd2',
    primaryForeground: '#002b36',
    secondary: '#073642',
    secondaryForeground: '#839496',
    accent: '#d33682',
    accentForeground: '#002b36',
    muted: '#073642',
    mutedForeground: '#586e75',
    destructive: '#dc322f',
    destructiveForeground: '#002b36',
    border: '#073642',
    input: '#00232c',
    ring: '#268bd2',
    editorBackground: '#002b36',
    editorForeground: '#839496',
    editorLineNumber: '#586e75',
    editorLineNumberActive: '#839496',
    editorSelection: '#268bd2',
    editorSelectionBackground: '#268bd230',
    editorCursor: '#839496',
    editorIndentGuide: '#073642',
    editorIndentGuideActive: '#586e75',
    editorWhitespace: '#073642',
    editorCurrentLine: '#073642',
    editorFindMatch: '#b58900',
    editorFindMatchHighlight: '#b5890030',
    editorBracketMatch: '#839496',
    editorBracketMatchBackground: '#268bd230',
    sidebarBackground: '#00232c',
    sidebarForeground: '#839496',
    sidebarBorder: '#073642',
    sidebarActiveBackground: '#268bd220',
    sidebarActiveForeground: '#839496',
    sidebarHoverBackground: '#073642',
    statusBarBackground: '#00232c',
    statusBarForeground: '#586e75',
    statusBarBorder: '#073642',
    statusBarHoverBackground: '#073642',
    tabActiveBackground: '#002b36',
    tabActiveForeground: '#839496',
    tabInactiveBackground: '#00232c',
    tabInactiveForeground: '#586e75',
    tabBorder: '#073642',
    tabActiveBorder: '#268bd2',
    panelBackground: '#00232c',
    panelForeground: '#839496',
    panelBorder: '#073642',
    terminalBackground: '#002b36',
    terminalForeground: '#839496',
    terminalCursor: '#839496',
    terminalSelection: '#268bd240',
    scrollbarShadow: '#000000',
    scrollbarSliderBackground: '#07364280',
    scrollbarSliderHoverBackground: '#586e75a0',
    scrollbarSliderActiveBackground: '#268bd2a0',
  },
  syntax: {
    comment: '#586e75',
    commentLine: '#586e75',
    commentBlock: '#586e75',
    commentDoc: '#586e75',
    commentDocTag: '#586e75',
    string: '#2aa198',
    stringLiteral: '#2aa198',
    stringEscape: '#cb4b16',
    stringRegex: '#2aa198',
    number: '#d33682',
    numberFloat: '#d33682',
    numberHex: '#d33682',
    numberBinary: '#d33682',
    keyword: '#859900',
    keywordControl: '#859900',
    keywordOperator: '#859900',
    keywordDeclaration: '#859900',
    type: '#b58900',
    typeBuiltin: '#b58900',
    class: '#b58900',
    interface: '#b58900',
    struct: '#b58900',
    enum: '#b58900',
    function: '#268bd2',
    functionBuiltin: '#268bd2',
    functionCall: '#268bd2',
    method: '#268bd2',
    constructor: '#b58900',
    variable: '#839496',
    variableBuiltin: '#268bd2',
    variableParameter: '#839496',
    variableThis: '#859900',
    variableConstant: '#d33682',
    punctuation: '#839496',
    punctuationBracket: '#839496',
    punctuationDelimiter: '#839496',
    punctuationSpecial: '#859900',
    operator: '#859900',
    operatorSymbol: '#859900',
    tag: '#268bd2',
    tagName: '#268bd2',
    tagAttribute: '#b58900',
    tagDelimiter: '#839496',
    property: '#268bd2',
    propertyClass: '#b58900',
    label: '#268bd2',
    constant: '#d33682',
    constantBuiltin: '#d33682',
    constantCharacter: '#2aa198',
    constantEscape: '#cb4b16',
    diffAdded: '#859900',
    diffAddedBackground: '#85990020',
    diffRemoved: '#dc322f',
    diffRemovedBackground: '#dc322f20',
    diffModified: '#268bd2',
    diffModifiedBackground: '#268bd220',
    markupHeading: '#859900',
    markupBold: '#839496',
    markupItalic: '#839496',
    markupUnderline: '#268bd2',
    markupStrike: '#586e75',
    markupCode: '#2aa198',
    markupLink: '#268bd2',
    markupList: '#b58900',
    error: '#dc322f',
    errorBackground: '#dc322f20',
    warning: '#b58900',
    warningBackground: '#b5890020',
    info: '#268bd2',
    infoBackground: '#268bd220',
    hint: '#859900',
    hintBackground: '#85990020',
  },
  tags: ['dark', 'classic', 'popular'],
};

// ============================================================================
// SOLARIZED LIGHT THEME
// ============================================================================

export const SOLARIZED_LIGHT_THEME: Theme = {
  id: PREDEFINED_THEMES.SOLARIZED_LIGHT,
  name: 'Solarized Light',
  displayName: 'Solarized Light',
  description: 'Precision color scheme for machines and people (light variant)',
  author: 'Ethan Schoonover',
  version: '1.0.0',
  type: 'light',
  colors: {
    foreground: '#657b83',
    background: '#fdf6e3',
    primary: '#268bd2',
    primaryForeground: '#fdf6e3',
    secondary: '#eee8d5',
    secondaryForeground: '#657b83',
    accent: '#d33682',
    accentForeground: '#fdf6e3',
    muted: '#eee8d5',
    mutedForeground: '#93a1a1',
    destructive: '#dc322f',
    destructiveForeground: '#fdf6e3',
    border: '#eee8d5',
    input: '#fdf6e3',
    ring: '#268bd2',
    editorBackground: '#fdf6e3',
    editorForeground: '#657b83',
    editorLineNumber: '#93a1a1',
    editorLineNumberActive: '#657b83',
    editorSelection: '#268bd2',
    editorSelectionBackground: '#268bd220',
    editorCursor: '#657b83',
    editorIndentGuide: '#eee8d5',
    editorIndentGuideActive: '#93a1a1',
    editorWhitespace: '#eee8d5',
    editorCurrentLine: '#eee8d5',
    editorFindMatch: '#b58900',
    editorFindMatchHighlight: '#b5890020',
    editorBracketMatch: '#657b83',
    editorBracketMatchBackground: '#268bd220',
    sidebarBackground: '#eee8d5',
    sidebarForeground: '#657b83',
    sidebarBorder: '#e4ddc8',
    sidebarActiveBackground: '#268bd215',
    sidebarActiveForeground: '#657b83',
    sidebarHoverBackground: '#e4ddc8',
    statusBarBackground: '#eee8d5',
    statusBarForeground: '#93a1a1',
    statusBarBorder: '#e4ddc8',
    statusBarHoverBackground: '#e4ddc8',
    tabActiveBackground: '#fdf6e3',
    tabActiveForeground: '#657b83',
    tabInactiveBackground: '#eee8d5',
    tabInactiveForeground: '#93a1a1',
    tabBorder: '#e4ddc8',
    tabActiveBorder: '#268bd2',
    panelBackground: '#eee8d5',
    panelForeground: '#657b83',
    panelBorder: '#e4ddc8',
    terminalBackground: '#fdf6e3',
    terminalForeground: '#657b83',
    terminalCursor: '#657b83',
    terminalSelection: '#268bd230',
    scrollbarShadow: '#00000010',
    scrollbarSliderBackground: '#93a1a1a0',
    scrollbarSliderHoverBackground: '#657b83c0',
    scrollbarSliderActiveBackground: '#268bd2c0',
  },
  syntax: {
    comment: '#93a1a1',
    commentLine: '#93a1a1',
    commentBlock: '#93a1a1',
    commentDoc: '#93a1a1',
    commentDocTag: '#93a1a1',
    string: '#2aa198',
    stringLiteral: '#2aa198',
    stringEscape: '#cb4b16',
    stringRegex: '#2aa198',
    number: '#d33682',
    numberFloat: '#d33682',
    numberHex: '#d33682',
    numberBinary: '#d33682',
    keyword: '#859900',
    keywordControl: '#859900',
    keywordOperator: '#859900',
    keywordDeclaration: '#859900',
    type: '#b58900',
    typeBuiltin: '#b58900',
    class: '#b58900',
    interface: '#b58900',
    struct: '#b58900',
    enum: '#b58900',
    function: '#268bd2',
    functionBuiltin: '#268bd2',
    functionCall: '#268bd2',
    method: '#268bd2',
    constructor: '#b58900',
    variable: '#657b83',
    variableBuiltin: '#268bd2',
    variableParameter: '#657b83',
    variableThis: '#859900',
    variableConstant: '#d33682',
    punctuation: '#657b83',
    punctuationBracket: '#657b83',
    punctuationDelimiter: '#657b83',
    punctuationSpecial: '#859900',
    operator: '#859900',
    operatorSymbol: '#859900',
    tag: '#268bd2',
    tagName: '#268bd2',
    tagAttribute: '#b58900',
    tagDelimiter: '#657b83',
    property: '#268bd2',
    propertyClass: '#b58900',
    label: '#268bd2',
    constant: '#d33682',
    constantBuiltin: '#d33682',
    constantCharacter: '#2aa198',
    constantEscape: '#cb4b16',
    diffAdded: '#859900',
    diffAddedBackground: '#85990015',
    diffRemoved: '#dc322f',
    diffRemovedBackground: '#dc322f15',
    diffModified: '#268bd2',
    diffModifiedBackground: '#268bd215',
    markupHeading: '#859900',
    markupBold: '#657b83',
    markupItalic: '#657b83',
    markupUnderline: '#268bd2',
    markupStrike: '#93a1a1',
    markupCode: '#2aa198',
    markupLink: '#268bd2',
    markupList: '#b58900',
    error: '#dc322f',
    errorBackground: '#dc322f15',
    warning: '#b58900',
    warningBackground: '#b5890015',
    info: '#268bd2',
    infoBackground: '#268bd215',
    hint: '#859900',
    hintBackground: '#85990015',
  },
  tags: ['light', 'classic', 'popular'],
};

// ============================================================================
// GRUVBOX DARK THEME
// ============================================================================

export const GRUVBOX_DARK_THEME: Theme = {
  id: PREDEFINED_THEMES.GRUVBOX_DARK,
  name: 'Gruvbox Dark',
  displayName: 'Gruvbox Dark',
  description: 'Retro groove color scheme',
  author: 'morhetz',
  version: '1.0.0',
  type: 'dark',
  colors: {
    foreground: '#ebdbb2',
    background: '#282828',
    primary: '#fe8019',
    primaryForeground: '#282828',
    secondary: '#3c3836',
    secondaryForeground: '#ebdbb2',
    accent: '#d3869b',
    accentForeground: '#282828',
    muted: '#3c3836',
    mutedForeground: '#928374',
    destructive: '#fb4934',
    destructiveForeground: '#282828',
    border: '#3c3836',
    input: '#1d2021',
    ring: '#fe8019',
    editorBackground: '#282828',
    editorForeground: '#ebdbb2',
    editorLineNumber: '#665c54',
    editorLineNumberActive: '#ebdbb2',
    editorSelection: '#fe8019',
    editorSelectionBackground: '#fe801930',
    editorCursor: '#ebdbb2',
    editorIndentGuide: '#3c3836',
    editorIndentGuideActive: '#665c54',
    editorWhitespace: '#504945',
    editorCurrentLine: '#3c3836',
    editorFindMatch: '#fabd2f',
    editorFindMatchHighlight: '#fabd2f30',
    editorBracketMatch: '#ebdbb2',
    editorBracketMatchBackground: '#fe801930',
    sidebarBackground: '#1d2021',
    sidebarForeground: '#ebdbb2',
    sidebarBorder: '#3c3836',
    sidebarActiveBackground: '#fe801920',
    sidebarActiveForeground: '#ebdbb2',
    sidebarHoverBackground: '#3c3836',
    statusBarBackground: '#1d2021',
    statusBarForeground: '#928374',
    statusBarBorder: '#3c3836',
    statusBarHoverBackground: '#3c3836',
    tabActiveBackground: '#282828',
    tabActiveForeground: '#ebdbb2',
    tabInactiveBackground: '#1d2021',
    tabInactiveForeground: '#928374',
    tabBorder: '#3c3836',
    tabActiveBorder: '#fe8019',
    panelBackground: '#1d2021',
    panelForeground: '#ebdbb2',
    panelBorder: '#3c3836',
    terminalBackground: '#282828',
    terminalForeground: '#ebdbb2',
    terminalCursor: '#ebdbb2',
    terminalSelection: '#fe801940',
    scrollbarShadow: '#000000',
    scrollbarSliderBackground: '#50494580',
    scrollbarSliderHoverBackground: '#665c54a0',
    scrollbarSliderActiveBackground: '#fe8019a0',
  },
  syntax: {
    comment: '#928374',
    commentLine: '#928374',
    commentBlock: '#928374',
    commentDoc: '#928374',
    commentDocTag: '#928374',
    string: '#b8bb26',
    stringLiteral: '#b8bb26',
    stringEscape: '#d65d0e',
    stringRegex: '#b8bb26',
    number: '#d3869b',
    numberFloat: '#d3869b',
    numberHex: '#d3869b',
    numberBinary: '#d3869b',
    keyword: '#fb4934',
    keywordControl: '#fb4934',
    keywordOperator: '#fb4934',
    keywordDeclaration: '#fb4934',
    type: '#fabd2f',
    typeBuiltin: '#fabd2f',
    class: '#fabd2f',
    interface: '#fabd2f',
    struct: '#fabd2f',
    enum: '#fabd2f',
    function: '#83a598',
    functionBuiltin: '#83a598',
    functionCall: '#83a598',
    method: '#83a598',
    constructor: '#fabd2f',
    variable: '#ebdbb2',
    variableBuiltin: '#fe8019',
    variableParameter: '#ebdbb2',
    variableThis: '#fe8019',
    variableConstant: '#d3869b',
    punctuation: '#ebdbb2',
    punctuationBracket: '#ebdbb2',
    punctuationDelimiter: '#ebdbb2',
    punctuationSpecial: '#fb4934',
    operator: '#fb4934',
    operatorSymbol: '#fb4934',
    tag: '#fb4934',
    tagName: '#fb4934',
    tagAttribute: '#b8bb26',
    tagDelimiter: '#ebdbb2',
    property: '#83a598',
    propertyClass: '#fabd2f',
    label: '#83a598',
    constant: '#d3869b',
    constantBuiltin: '#d3869b',
    constantCharacter: '#b8bb26',
    constantEscape: '#d65d0e',
    diffAdded: '#b8bb26',
    diffAddedBackground: '#b8bb2620',
    diffRemoved: '#fb4934',
    diffRemovedBackground: '#fb493420',
    diffModified: '#83a598',
    diffModifiedBackground: '#83a59820',
    markupHeading: '#fb4934',
    markupBold: '#ebdbb2',
    markupItalic: '#ebdbb2',
    markupUnderline: '#83a598',
    markupStrike: '#928374',
    markupCode: '#b8bb26',
    markupLink: '#83a598',
    markupList: '#fe8019',
    error: '#fb4934',
    errorBackground: '#fb493420',
    warning: '#fabd2f',
    warningBackground: '#fabd2f20',
    info: '#83a598',
    infoBackground: '#83a59820',
    hint: '#b8bb26',
    hintBackground: '#b8bb2620',
  },
  tags: ['dark', 'popular', 'retro'],
};

// ============================================================================
// BUILT-IN THEMES ARRAY
// ============================================================================

export const BUILT_IN_THEMES: Theme[] = [
  KYRO_DARK_THEME,
  KYRO_LIGHT_THEME,
  MONOKAI_THEME,
  DRACULA_THEME,
  ONE_DARK_THEME,
  GITHUB_DARK_THEME,
  GITHUB_LIGHT_THEME,
  NORD_THEME,
  SOLARIZED_DARK_THEME,
  SOLARIZED_LIGHT_THEME,
  GRUVBOX_DARK_THEME,
];

// ============================================================================
// THEME STORE (ZUSTAND)
// ============================================================================

interface ThemeStore {
  activeThemeId: string;
  preferredTheme: 'light' | 'dark' | 'system';
  customThemes: Theme[];
  
  // Actions
  setActiveTheme: (id: string) => void;
  setPreferredTheme: (theme: 'light' | 'dark' | 'system') => void;
  addCustomTheme: (theme: Theme) => void;
  updateCustomTheme: (id: string, updates: Partial<Theme>) => void;
  deleteCustomTheme: (id: string) => void;
  getTheme: (id: string) => Theme | undefined;
  getActiveTheme: () => Theme;
  getAllThemes: () => Theme[];
  duplicateTheme: (id: string) => Theme | undefined;
  exportTheme: (id: string) => ThemeExport | undefined;
  importTheme: (data: unknown) => ThemeImportResult;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      activeThemeId: PREDEFINED_THEMES.DARK_DEFAULT,
      preferredTheme: 'dark',
      customThemes: [],
      
      setActiveTheme: (id) => set({ activeThemeId: id }),
      
      setPreferredTheme: (theme) => set({ preferredTheme: theme }),
      
      addCustomTheme: (theme) => set((state) => ({
        customThemes: [...state.customThemes, { ...theme, custom: true }],
      })),
      
      updateCustomTheme: (id, updates) => set((state) => ({
        customThemes: state.customThemes.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      })),
      
      deleteCustomTheme: (id) => set((state) => ({
        customThemes: state.customThemes.filter((t) => t.id !== id),
        activeThemeId: state.activeThemeId === id 
          ? PREDEFINED_THEMES.DARK_DEFAULT 
          : state.activeThemeId,
      })),
      
      getTheme: (id) => {
        const state = get();
        return BUILT_IN_THEMES.find((t) => t.id === id) ||
          state.customThemes.find((t) => t.id === id);
      },
      
      getActiveTheme: () => {
        const state = get();
        return BUILT_IN_THEMES.find((t) => t.id === state.activeThemeId) ||
          state.customThemes.find((t) => t.id === state.activeThemeId) ||
          KYRO_DARK_THEME;
      },
      
      getAllThemes: () => {
        const state = get();
        return [...BUILT_IN_THEMES, ...state.customThemes];
      },
      
      duplicateTheme: (id) => {
        const state = get();
        const theme = BUILT_IN_THEMES.find((t) => t.id === id) ||
          state.customThemes.find((t) => t.id === id);
        
        if (!theme) return undefined;
        
        const newTheme: Theme = {
          ...theme,
          id: generateThemeId(`${theme.name}-copy-${Date.now()}`),
          name: `${theme.name} Copy`,
          displayName: `${theme.displayName} Copy`,
          custom: true,
        };
        
        set((s) => ({ customThemes: [...s.customThemes, newTheme] }));
        return newTheme;
      },
      
      exportTheme: (id) => {
        const state = get();
        const theme = BUILT_IN_THEMES.find((t) => t.id === id) ||
          state.customThemes.find((t) => t.id === id);
        
        if (!theme) return undefined;
        
        return {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          theme,
        };
      },
      
      importTheme: (data) => {
        try {
          const parsed = data as ThemeExport;
          if (!parsed.version || !parsed.theme) {
            return { success: false, errors: ['Invalid theme file format'] };
          }
          
          const theme = parsed.theme as Theme;
          const newTheme: Theme = {
            ...theme,
            id: generateThemeId(`${theme.name}-${Date.now()}`),
            custom: true,
          };
          
          set((s) => ({ customThemes: [...s.customThemes, newTheme] }));
          return { success: true, theme: newTheme };
        } catch (error) {
          return { 
            success: false, 
            errors: [error instanceof Error ? error.message : 'Failed to import theme'] 
          };
        }
      },
    }),
    {
      name: 'kyro-ide-themes',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeThemeId: state.activeThemeId,
        preferredTheme: state.preferredTheme,
        customThemes: state.customThemes,
      }),
    }
  )
);

// ============================================================================
// VS CODE THEME IMPORT
// ============================================================================

const VS_CODE_COLOR_MAP: Record<string, keyof ThemeColors> = {
  'editor.background': 'editorBackground',
  'editor.foreground': 'editorForeground',
  'editorLineNumber.foreground': 'editorLineNumber',
  'editorLineNumber.activeForeground': 'editorLineNumberActive',
  'editor.selectionBackground': 'editorSelectionBackground',
  'editorCursor.foreground': 'editorCursor',
  'editorIndentGuide.background': 'editorIndentGuide',
  'editorIndentGuide.activeBackground': 'editorIndentGuideActive',
  'editorWhitespace.foreground': 'editorWhitespace',
  'editor.findMatchBackground': 'editorFindMatch',
  'editor.findMatchHighlightBackground': 'editorFindMatchHighlight',
  'editorBracketMatch.background': 'editorBracketMatchBackground',
  'sideBar.background': 'sidebarBackground',
  'sideBar.foreground': 'sidebarForeground',
  'sideBar.border': 'sidebarBorder',
  'sideBarSectionHeader.background': 'sidebarActiveBackground',
  'statusBar.background': 'statusBarBackground',
  'statusBar.foreground': 'statusBarForeground',
  'statusBar.border': 'statusBarBorder',
  'tab.activeBackground': 'tabActiveBackground',
  'tab.activeForeground': 'tabActiveForeground',
  'tab.inactiveBackground': 'tabInactiveBackground',
  'tab.inactiveForeground': 'tabInactiveForeground',
  'tab.border': 'tabBorder',
  'panel.background': 'panelBackground',
  'panel.foreground': 'panelForeground',
  'panel.border': 'panelBorder',
  'terminal.background': 'terminalBackground',
  'terminal.foreground': 'terminalForeground',
  'scrollbarSlider.background': 'scrollbarSliderBackground',
  'scrollbarSlider.hoverBackground': 'scrollbarSliderHoverBackground',
  'scrollbarSlider.activeBackground': 'scrollbarSliderActiveBackground',
};

export function importFromVSCode(vsCodeTheme: VSCodeTheme): Theme {
  const baseTheme = vsCodeTheme.type === 'light' ? KYRO_LIGHT_THEME : KYRO_DARK_THEME;
  
  // Map VS Code colors to Kyro colors
  const colors: ThemeColors = { ...baseTheme.colors };
  
  if (vsCodeTheme.colors) {
    for (const [vsKey, value] of Object.entries(vsCodeTheme.colors)) {
      const kyroKey = VS_CODE_COLOR_MAP[vsKey];
      if (kyroKey && value) {
        (colors as Record<string, string>)[kyroKey] = value;
      }
    }
    
    // Set base colors from editor colors if not specified
    colors.background = vsCodeTheme.colors['editor.background'] || colors.background;
    colors.foreground = vsCodeTheme.colors['editor.foreground'] || colors.foreground;
  }
  
  // Convert token colors to syntax colors
  const syntax: SyntaxColors = { ...baseTheme.syntax };
  
  if (vsCodeTheme.tokenColors) {
    for (const token of vsCodeTheme.tokenColors) {
      const scopes = Array.isArray(token.scope) ? token.scope : [token.scope];
      const fg = token.settings.foreground;
      
      for (const scope of scopes) {
        // Map VS Code scopes to Kyro syntax colors
        if (scope.includes('comment')) {
          if (fg) syntax.comment = fg;
        } else if (scope.includes('string')) {
          if (fg) syntax.string = fg;
        } else if (scope.includes('keyword')) {
          if (fg) syntax.keyword = fg;
        } else if (scope.includes('function') || scope.includes('method')) {
          if (fg) syntax.function = fg;
        } else if (scope.includes('class') || scope.includes('type')) {
          if (fg) syntax.type = fg;
        } else if (scope.includes('variable')) {
          if (fg) syntax.variable = fg;
        } else if (scope.includes('number') || scope.includes('constant')) {
          if (fg) syntax.number = fg;
        }
      }
    }
  }
  
  return {
    id: generateThemeId(vsCodeTheme.name),
    name: vsCodeTheme.name,
    displayName: vsCodeTheme.name,
    description: 'Imported from VS Code theme',
    type: vsCodeTheme.type === 'light' ? 'light' : 'dark',
    colors,
    syntax,
    tokenColors: vsCodeTheme.tokenColors,
    semanticTokenColors: vsCodeTheme.semanticTokenColors as Record<string, string>,
    custom: true,
  };
}

// ============================================================================
// CSS VARIABLES GENERATOR
// ============================================================================

export function generateCSSVariables(theme: Theme): string {
  const cssVars: string[] = [];
  
  // Generate color variables
  for (const [key, value] of Object.entries(theme.colors)) {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    cssVars.push(`  --${cssKey}: ${value};`);
  }
  
  // Generate syntax variables
  for (const [key, value] of Object.entries(theme.syntax)) {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    cssVars.push(`  --syntax-${cssKey}: ${value};`);
  }
  
  return `:root {\n${cssVars.join('\n')}\n}`;
}

// ============================================================================
// SYSTEM THEME DETECTION
// ============================================================================

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function onSystemThemeChange(
  callback: (theme: 'light' | 'dark') => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };
  
  mediaQuery.addEventListener('change', handler);
  
  return () => mediaQuery.removeEventListener('change', handler);
}

// ============================================================================
// THEME APPLIER
// ============================================================================

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  // Apply base theme type
  root.classList.remove('light', 'dark');
  root.classList.add(theme.type);
  
  // Apply CSS variables
  const cssVariables: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(theme.colors)) {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    cssVariables[`--${cssKey}`] = value;
  }
  
  for (const [key, value] of Object.entries(theme.syntax)) {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    cssVariables[`--syntax-${cssKey}`] = value;
  }
  
  // Apply to root element
  for (const [key, value] of Object.entries(cssVariables)) {
    root.style.setProperty(key, value);
  }
}

// ============================================================================
// THEME PREVIEW COLORS
// ============================================================================

export function getThemePreviewColors(theme: Theme): { background: string; foreground: string; accent: string; syntax: string[] } {
  return {
    background: theme.colors.background,
    foreground: theme.colors.foreground,
    accent: theme.colors.primary,
    syntax: [
      theme.syntax.keyword,
      theme.syntax.string,
      theme.syntax.function,
      theme.syntax.type,
      theme.syntax.number,
    ],
  };
}
