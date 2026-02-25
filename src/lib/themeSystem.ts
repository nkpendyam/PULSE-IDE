// Theme System for KRO IDE
// Supports TextMate themes (.tmTheme), VS Code themes, and custom JSON themes

export interface ThemeColor {
  id: string;
  description?: string;
  defaults: {
    light: string;
    dark: string;
    highContrast?: string;
  };
}

export interface ThemeTokenRule {
  scope: string | string[];
  settings: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

export interface Theme {
  id: string;
  name: string;
  type: 'light' | 'dark' | 'highContrast';
  colors: Record<string, string>;
  tokenColors: ThemeTokenRule[];
  semanticTokenColors?: Record<string, { foreground?: string; fontStyle?: string }>;
}

// KRO Dark Theme (default)
export const kroDarkTheme: Theme = {
  id: 'kro-dark',
  name: 'KRO Dark',
  type: 'dark',
  colors: {
    // Editor
    'editor.background': '#0d1117',
    'editor.foreground': '#c9d1d9',
    'editor.lineHighlightBackground': '#161b22',
    'editor.selectionBackground': '#264f78',
    'editor.selectionHighlightBackground': '#3a3d4166',
    'editor.inactiveSelectionBackground': '#264f7855',
    'editorLineNumber.foreground': '#484f58',
    'editorLineNumber.activeForeground': '#c9d1d9',
    'editorCursor.foreground': '#58a6ff',
    'editorWhitespace.foreground': '#484f5844',
    'editorIndentGuide.background': '#21262d',
    'editorIndentGuide.activeBackground': '#30363d',
    'editorBracketMatch.background': '#3fb95040',
    'editorBracketMatch.border': '#3fb950',
    
    // Editor widgets
    'editorWidget.background': '#161b22',
    'editorWidget.border': '#30363d',
    'editorSuggestWidget.background': '#161b22',
    'editorSuggestWidget.border': '#30363d',
    'editorSuggestWidget.selectedBackground': '#21262d',
    'editorHoverWidget.background': '#161b22',
    'editorHoverWidget.border': '#30363d',
    
    // Minimap
    'minimap.background': '#0d111780',
    'minimap.selectionHighlight': '#264f78',
    'minimapSlider.background': '#58a6ff20',
    
    // Scrollbar
    'scrollbarSlider.background': '#484f5820',
    'scrollbarSlider.hoverBackground': '#484f5840',
    'scrollbarSlider.activeBackground': '#484f5880',
    
    // Activity bar
    'activityBar.background': '#161b22',
    'activityBar.foreground': '#8b949e',
    'activityBar.activeBorder': '#58a6ff',
    'activityBarBadge.background': '#58a6ff',
    'activityBarBadge.foreground': '#0d1117',
    
    // Sidebar
    'sideBar.background': '#0d1117',
    'sideBar.foreground': '#c9d1d9',
    'sideBar.border': '#30363d',
    'sideBarTitle.foreground': '#8b949e',
    'sideBarSectionHeader.background': '#161b22',
    'sideBarSectionHeader.border': '#30363d',
    
    // List
    'list.background': '#0d1117',
    'list.foreground': '#c9d1d9',
    'list.hoverBackground': '#161b22',
    'list.activeSelectionBackground': '#21262d',
    'list.activeSelectionForeground': '#c9d1d9',
    'list.inactiveSelectionBackground': '#161b22',
    
    // Tabs
    'tab.activeBackground': '#0d1117',
    'tab.inactiveBackground': '#161b22',
    'tab.activeForeground': '#c9d1d9',
    'tab.inactiveForeground': '#8b949e',
    'tab.border': '#30363d',
    'tab.activeBorderTop': '#58a6ff',
    
    // Status bar
    'statusBar.background': '#161b22',
    'statusBar.foreground': '#8b949e',
    'statusBar.border': '#30363d',
    'statusBarItem.hoverBackground': '#21262d',
    
    // Title bar
    'titleBar.activeBackground': '#161b22',
    'titleBar.activeForeground': '#c9d1d9',
    'titleBar.inactiveBackground': '#0d1117',
    'titleBar.inactiveForeground': '#8b949e',
    'titleBar.border': '#30363d',
    
    // Input
    'input.background': '#0d1117',
    'input.foreground': '#c9d1d9',
    'input.border': '#30363d',
    'input.placeholderForeground': '#8b949e',
    
    // Dropdown
    'dropdown.background': '#161b22',
    'dropdown.foreground': '#c9d1d9',
    'dropdown.border': '#30363d',
    
    // Button
    'button.background': '#238636',
    'button.foreground': '#ffffff',
    'button.hoverBackground': '#2ea043',
    'button.secondaryBackground': '#21262d',
    'button.secondaryForeground': '#c9d1d9',
    
    // Badge
    'badge.background': '#58a6ff',
    'badge.foreground': '#0d1117',
    
    // Progress
    'progressBar.background': '#58a6ff',
    
    // Notifications
    'notifications.background': '#161b22',
    'notifications.foreground': '#c9d1d9',
    'notifications.border': '#30363d',
    
    // Error/warning/info
    'errorForeground': '#f85149',
    'errorBackground': '#f8514920',
    'warningForeground': '#d29922',
    'warningBackground': '#d2992220',
    'infoForeground': '#58a6ff',
    'infoBackground': '#58a6ff20',
    
    // Git
    'gitDecoration.addedResourceForeground': '#3fb950',
    'gitDecoration.modifiedResourceForeground': '#d29922',
    'gitDecoration.deletedResourceForeground': '#f85149',
    'gitDecoration.untrackedResourceForeground': '#8b949e',
    'gitDecoration.ignoredResourceForeground': '#484f58',
    'gitDecoration.conflictingResourceForeground': '#f85149',
    
    // Diff
    'diffEditor.insertedTextBackground': '#2ea04326',
    'diffEditor.removedTextBackground': '#f8514926',
    'diffEditor.insertedLineBackground': '#2ea04315',
    'diffEditor.removedLineBackground': '#f8514915',
    
    // Terminal
    'terminal.background': '#0d1117',
    'terminal.foreground': '#c9d1d9',
    'terminal.ansiBlack': '#484f58',
    'terminal.ansiRed': '#f85149',
    'terminal.ansiGreen': '#3fb950',
    'terminal.ansiYellow': '#d29922',
    'terminal.ansiBlue': '#58a6ff',
    'terminal.ansiMagenta': '#bc8cff',
    'terminal.ansiCyan': '#39c5cf',
    'terminal.ansiWhite': '#b1bac4',
    'terminal.ansiBrightBlack': '#6e7681',
    'terminal.ansiBrightRed': '#ff7b72',
    'terminal.ansiBrightGreen': '#7ee787',
    'terminal.ansiBrightYellow': '#f2cc60',
    'terminal.ansiBrightBlue': '#79c0ff',
    'terminal.ansiBrightMagenta': '#d2a8ff',
    'terminal.ansiBrightCyan': '#56d4dd',
    'terminal.ansiBrightWhite': '#f0f6fc',
  },
  tokenColors: [
    // Comments
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: '#6a9955', fontStyle: 'italic' }
    },
    // Keywords
    {
      scope: ['keyword', 'keyword.control', 'keyword.other'],
      settings: { foreground: '#ff7b72' }
    },
    {
      scope: 'keyword.control.import',
      settings: { foreground: '#c586c0' }
    },
    // Strings
    {
      scope: ['string', 'string.quoted'],
      settings: { foreground: '#a5d6ff' }
    },
    {
      scope: 'string.escape',
      settings: { foreground: '#79c0ff' }
    },
    // Numbers
    {
      scope: ['constant.numeric', 'number'],
      settings: { foreground: '#79c0ff' }
    },
    // Types
    {
      scope: ['entity.name.type', 'support.type', 'support.class'],
      settings: { foreground: '#ffa657' }
    },
    // Classes, structs, interfaces
    {
      scope: ['entity.name.class', 'entity.name.struct', 'entity.name.interface'],
      settings: { foreground: '#7ee787' }
    },
    // Functions and methods
    {
      scope: ['entity.name.function', 'support.function', 'entity.name.method'],
      settings: { foreground: '#d2a8ff' }
    },
    // Variables
    {
      scope: ['variable', 'variable.other'],
      settings: { foreground: '#ffa657' }
    },
    {
      scope: 'variable.parameter',
      settings: { foreground: '#ffa657' }
    },
    {
      scope: 'variable.property',
      settings: { foreground: '#79c0ff' }
    },
    // Constants
    {
      scope: ['constant', 'variable.other.constant'],
      settings: { foreground: '#79c0ff' }
    },
    // Operators
    {
      scope: 'keyword.operator',
      settings: { foreground: '#ff7b72' }
    },
    // Punctuation
    {
      scope: 'punctuation',
      settings: { foreground: '#c9d1d9' }
    },
    {
      scope: 'punctuation.bracket',
      settings: { foreground: '#ffa657' }
    },
    // Tags (HTML/JSX)
    {
      scope: ['entity.name.tag', 'tag.name'],
      settings: { foreground: '#7ee787' }
    },
    {
      scope: 'entity.other.attribute-name',
      settings: { foreground: '#79c0ff' }
    },
    // Storage (var, let, const, etc.)
    {
      scope: 'storage.type',
      settings: { foreground: '#ff7b72' }
    },
    {
      scope: 'storage.modifier',
      settings: { foreground: '#c586c0' }
    },
  ]
};

// KRO Light Theme
export const kroLightTheme: Theme = {
  id: 'kro-light',
  name: 'KRO Light',
  type: 'light',
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#24292f',
    'editor.lineHighlightBackground': '#f6f8fa',
    'editor.selectionBackground': '#b6e3ff',
    'editorLineNumber.foreground': '#8c959f',
    'editorLineNumber.activeForeground': '#24292f',
    'editorCursor.foreground': '#0969da',
    'activityBar.background': '#f6f8fa',
    'sideBar.background': '#f6f8fa',
    'tab.activeBackground': '#ffffff',
    'tab.inactiveBackground': '#f6f8fa',
    'statusBar.background': '#f6f8fa',
  },
  tokenColors: [
    { scope: 'comment', settings: { foreground: '#6e7781' } },
    { scope: 'keyword', settings: { foreground: '#cf222e' } },
    { scope: 'string', settings: { foreground: '#0a3069' } },
    { scope: 'constant.numeric', settings: { foreground: '#0550ae' } },
    { scope: 'entity.name.function', settings: { foreground: '#8250df' } },
    { scope: 'entity.name.type', settings: { foreground: '#953800' } },
    { scope: 'variable', settings: { foreground: '#953800' } },
  ]
};

// High Contrast Theme
export const kroHighContrastTheme: Theme = {
  id: 'kro-high-contrast',
  name: 'KRO High Contrast',
  type: 'highContrast',
  colors: {
    'editor.background': '#000000',
    'editor.foreground': '#ffffff',
    'editor.lineHighlightBackground': '#1a1a1a',
    'editor.selectionBackground': '#ffffff40',
    'editorLineNumber.foreground': '#ffffff80',
    'editorLineNumber.activeForeground': '#ffffff',
    'editorCursor.foreground': '#ffff00',
    'activityBar.background': '#000000',
    'sideBar.background': '#000000',
    'statusBar.background': '#000000',
  },
  tokenColors: [
    { scope: 'comment', settings: { foreground: '#00ff00' } },
    { scope: 'keyword', settings: { foreground: '#ff00ff' } },
    { scope: 'string', settings: { foreground: '#00ffff' } },
    { scope: 'constant.numeric', settings: { foreground: '#ffff00' } },
    { scope: 'entity.name.function', settings: { foreground: '#ff8000' } },
    { scope: 'entity.name.type', settings: { foreground: '#ff0080' } },
  ]
};

// Parse TextMate theme (.tmTheme)
export function parseTmTheme(content: string): Partial<Theme> {
  const theme: Partial<Theme> = {
    tokenColors: []
  };

  // Basic plist parsing for .tmTheme files
  const nameMatch = content.match(/<key>name<\/key>\s*<string>([^<]+)<\/string>/);
  if (nameMatch) {
    theme.name = nameMatch[1];
    theme.id = nameMatch[1].toLowerCase().replace(/\s+/g, '-');
  }

  // Parse settings
  const settingsRegex = /<dict>([\s\S]*?)<\/dict>/g;
  let match;
  while ((match = settingsRegex.exec(content)) !== null) {
    const dictContent = match[1];
    
    const scopeMatch = dictContent.match(/<key>scope<\/key>\s*<string>([^<]+)<\/string>/);
    const settingsMatch = dictContent.match(/<key>settings<\/key>\s*<dict>([\s\S]*?)<\/dict>/);
    
    if (scopeMatch && settingsMatch) {
      const scope = scopeMatch[1];
      const settingsContent = settingsMatch[1];
      
      const foregroundMatch = settingsContent.match(/<key>foreground<\/key>\s*<string>([^<]+)<\/string>/);
      const backgroundMatch = settingsContent.match(/<key>background<\/key>\s*<string>([^<]+)<\/string>/);
      const fontStyleMatch = settingsContent.match(/<key>fontStyle<\/key>\s*<string>([^<]+)<\/string>/);
      
      theme.tokenColors!.push({
        scope: scope.includes(',') ? scope.split(',').map(s => s.trim()) : scope,
        settings: {
          foreground: foregroundMatch?.[1],
          background: backgroundMatch?.[1],
          fontStyle: fontStyleMatch?.[1],
        }
      });
    }
  }

  return theme;
}

// Convert theme to Monaco editor format
export function toMonacoTheme(theme: Theme): monaco.editor.IStandaloneThemeData {
  const rules: monaco.editor.ITokenThemeRule[] = [];
  
  for (const tokenColor of theme.tokenColors) {
    const scopes = Array.isArray(tokenColor.scope) ? tokenColor.scope : [tokenColor.scope];
    for (const scope of scopes) {
      rules.push({
        token: scope,
        foreground: tokenColor.settings.foreground?.replace('#', ''),
        background: tokenColor.settings.background?.replace('#', ''),
        fontStyle: tokenColor.settings.fontStyle,
      });
    }
  }

  return {
    base: theme.type === 'light' ? 'vs' : theme.type === 'highContrast' ? 'hc-black' : 'vs-dark',
    inherit: true,
    rules,
    colors: theme.colors,
  };
}

// Available themes
export const availableThemes: Theme[] = [
  kroDarkTheme,
  kroLightTheme,
  kroHighContrastTheme,
];

// Theme manager
export class ThemeManager {
  private activeTheme: Theme;
  private customThemes: Map<string, Theme> = new Map();

  constructor() {
    this.activeTheme = kroDarkTheme;
  }

  setTheme(themeId: string): boolean {
    const theme = availableThemes.find(t => t.id === themeId) || 
                  this.customThemes.get(themeId);
    if (theme) {
      this.activeTheme = theme;
      this.applyTheme(theme);
      return true;
    }
    return false;
  }

  getTheme(): Theme {
    return this.activeTheme;
  }

  addCustomTheme(theme: Theme) {
    this.customThemes.set(theme.id, theme);
  }

  removeCustomTheme(themeId: string) {
    this.customThemes.delete(themeId);
  }

  getAllThemes(): Theme[] {
    return [...availableThemes, ...Array.from(this.customThemes.values())];
  }

  applyTheme(theme: Theme) {
    // Apply CSS variables
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.colors)) {
      root.style.setProperty(`--${key.replace(/\./g, '-')}`, value);
    }
  }

  importTmTheme(content: string): Theme {
    const parsed = parseTmTheme(content);
    const theme: Theme = {
      id: parsed.id || `custom-${Date.now()}`,
      name: parsed.name || 'Custom Theme',
      type: 'dark', // Default to dark
      colors: {},
      tokenColors: parsed.tokenColors || [],
    };
    this.addCustomTheme(theme);
    return theme;
  }
}

export const themeManager = new ThemeManager();

// Type for monaco (will be available at runtime)
declare const monaco: {
  editor: {
    IStandaloneThemeData: interface IStandaloneThemeData {
      base: 'vs' | 'vs-dark' | 'hc-black';
      inherit: boolean;
      rules: Array<{
        token: string;
        foreground?: string;
        background?: string;
        fontStyle?: string;
      }>;
      colors: Record<string, string>;
    };
    ITokenThemeRule: interface ITokenThemeRule {
      token: string;
      foreground?: string;
      background?: string;
      fontStyle?: string;
    };
  };
};
