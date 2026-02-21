// Kyro IDE - Complete Feature Analysis vs. Bleeding-Edge IDEs
// This document tracks ALL features needed to compete with VS Code, Cursor, Windsurf

export const FEATURE_COMPARISON = {
  // ========================================================================
  // CORE EDITOR FEATURES
  // ========================================================================
  editor: {
    // Monaco Editor Features
    monacoEditor: {
      status: 'pending',
      priority: 'critical',
      features: [
        'Syntax highlighting for 80+ languages',
        'IntelliSense (auto-completion)',
        'Code folding',
        'Bracket matching',
        'Indentation guides',
        'Minimap',
        'Multi-cursor editing',
        'Column selection',
        'Sticky scroll',
        'Inline hints',
        'Semantic highlighting',
        'Linked editing (rename refactor)',
        'Code lens',
        'Inlay hints',
        'Hover information',
        'Signature help',
        'Document symbols',
        'Go to definition',
        'Go to references',
        'Peek definition',
        'Rename symbol',
        'Format document',
        'Format selection',
        'Code actions (quick fixes)',
        'Refactorings',
      ],
    },
    
    // Editor UI Features
    editorUI: {
      status: 'partial',
      priority: 'high',
      features: [
        'Split editor (horizontal/vertical)',
        'Editor groups',
        'Tab management',
        'Tab preview (single click)',
        'Pinned tabs',
        'Tab decorations (modified, errors)',
        'Breadcrumbs navigation',
        'Breadcrumb dropdown',
        'Editor zoom',
        'Centered layout',
        'Zen mode',
        'Focus mode',
        'Line numbers (relative/absolute)',
        'Line decorations',
        'Glyph margin',
        'Overview ruler',
        'Render whitespace',
        'Rulers (column guides)',
        'Word wrap',
        'Selection highlight',
        'Occurrences highlight',
        'Indent guides',
      ],
    },
  },

  // ========================================================================
  // FILE EXPLORER FEATURES
  // ========================================================================
  explorer: {
    status: 'partial',
    priority: 'high',
    features: [
      'File tree with virtualization',
      'File icons (themes)',
      'Folder icons',
      'File decorations (git status, errors)',
      'Drag and drop',
      'Multi-select',
      'Context menu',
      'File search in tree',
      'Filter files',
      'Collapse folders',
      'Open editors panel',
      'Outline view',
      'Timeline view',
      'File nesting',
      'Compact folders',
      'File watchers',
      'Auto reveal file',
      'Sort by name/type/modified',
    ],
  },

  // ========================================================================
  // SEARCH FEATURES
  // ========================================================================
  search: {
    globalSearch: {
      status: 'pending',
      priority: 'critical',
      features: [
        'Full-text search across files',
        'Regex support',
        'Case sensitivity',
        'Whole word matching',
        'Include/exclude patterns',
        'Search in specific files',
        'Replace all',
        'Replace preview',
        'Search history',
        'Search results grouping',
        'Context lines',
        'Match highlighting',
      ],
    },
    
    symbolSearch: {
      status: 'pending',
      priority: 'high',
      features: [
        'Go to symbol (file)',
        'Go to symbol (workspace)',
        'Go to line',
        'Go to file (fuzzy)',
        'Open recent',
        'Quick open',
      ],
    },
  },

  // ========================================================================
  // TERMINAL FEATURES
  // ========================================================================
  terminal: {
    status: 'pending',
    priority: 'critical',
    features: [
      'xterm.js integration',
      'PTY support (node-pty)',
      'Multiple terminals',
      'Terminal tabs',
      'Terminal profiles',
      'Custom shell',
      'Split terminal',
      'Terminal themes',
      'Copy/paste support',
      'Search in terminal',
      'Terminal buffering',
      'Link detection',
      'Unicode support',
      'True color support',
      'Bracketed paste mode',
      'Terminal relaunch',
    ],
  },

  // ========================================================================
  // GIT FEATURES
  // ========================================================================
  git: {
    status: 'partial',
    priority: 'high',
    features: [
      'Source control panel',
      'Change tracking',
      'File diff viewer',
      'Inline diff',
      'Side by side diff',
      'Staging area',
      'Commit history',
      'Branch management',
      'Merge conflicts',
      'Blame annotations',
      'File history',
      'Line history',
      'Remote management',
      'Git status decorations',
      'Quick commit',
      'Push/pull',
      'Cherry pick',
      'Revert',
      'Stash',
      'Git tags',
      'Submodules',
    ],
  },

  // ========================================================================
  // DEBUGGING FEATURES
  // ========================================================================
  debugging: {
    status: 'pending',
    priority: 'medium',
    features: [
      'Debug Adapter Protocol (DAP)',
      'Launch configurations',
      'Breakpoints',
      'Conditional breakpoints',
      'Logpoints',
      'Watch expressions',
      'Variables view',
      'Call stack view',
      'Debug console',
      'Step over/in/out',
      'Continue/pause',
      'Restart/stop',
      'Multi-session debugging',
      'Attach to process',
      'Debug toolbar',
      'Exception breakpoints',
      'Function breakpoints',
      'Data breakpoints',
      'Hit count conditions',
      'Debug visualizations',
    ],
  },

  // ========================================================================
  // AI FEATURES
  // ========================================================================
  ai: {
    status: 'partial',
    priority: 'critical',
    features: [
      'Multi-agent system',
      'Agent orchestration',
      'Inline AI chat',
      'AI code completion',
      'AI code actions',
      'AI refactoring',
      'AI debugging',
      'AI documentation',
      'AI test generation',
      'Context-aware suggestions',
      'Codebase indexing',
      'Semantic search',
      'AI rules (.pulserules)',
      'Custom AI prompts',
      'Model selection',
      'Local model support',
      'Streaming responses',
      'Multi-file edits',
      'AI diff preview',
      'AI commit messages',
    ],
  },

  // ========================================================================
  // EXTENSION FEATURES
  // ========================================================================
  extensions: {
    status: 'partial',
    priority: 'high',
    features: [
      'Extension marketplace',
      'Extension search',
      'Extension details',
      'Install/uninstall',
      'Enable/disable',
      'Extension dependencies',
      'Extension recommendations',
      'Extension settings',
      'Extension activation events',
      'Extension contributions',
      'Language server extensions',
      'Debugger extensions',
      'Theme extensions',
      'Keymap extensions',
      'Snippet extensions',
      'Command extensions',
      'View extensions',
      'Webview extensions',
    ],
  },

  // ========================================================================
  // SETTINGS FEATURES
  // ========================================================================
  settings: {
    status: 'pending',
    priority: 'high',
    features: [
      'Settings editor (GUI)',
      'Settings search',
      'Settings categories',
      'Workspace settings',
      'User settings',
      'Folder settings',
      'Settings sync',
      'Settings preview',
      'Settings reset',
      'JSON settings editor',
      'Settings validation',
      'Setting groups',
      'Enum settings',
      'Number settings',
      'Boolean settings',
      'String settings',
      'Array settings',
      'Object settings',
      'Setting descriptions',
      'Setting default values',
    ],
  },

  // ========================================================================
  // KEYBINDING FEATURES
  // ========================================================================
  keybindings: {
    status: 'pending',
    priority: 'medium',
    features: [
      'Keybindings editor',
      'Keybinding search',
      'Keybinding conflicts',
      'Keybinding preview',
      'Keyboard shortcuts',
      'When clause context',
      'Multi-chord keybindings',
      'Keybinding profiles',
      'Default keybindings',
      'Platform-specific keybindings',
    ],
  },

  // ========================================================================
  // UI/UX FEATURES
  // ========================================================================
  uiux: {
    status: 'partial',
    priority: 'high',
    features: [
      'Command palette (Ctrl+Shift+P)',
      'Quick open (Ctrl+P)',
      'Panel management',
      'Sidebar management',
      'Status bar customization',
      'Title bar customization',
      'Welcome screen',
      'Getting started',
      'Tips and tricks',
      'Keyboard shortcuts cheat sheet',
      'Zoom level',
      'Theme customization',
      'Icon themes',
      'Product icon themes',
      'Custom CSS',
      'Layout presets',
      'Full screen',
      'Window management',
      'Tab management',
      'Editor layout',
    ],
  },

  // ========================================================================
  // PERFORMANCE FEATURES
  // ========================================================================
  performance: {
    status: 'pending',
    priority: 'high',
    features: [
      'Virtual scrolling',
      'Lazy loading',
      'Tree shaking',
      'Code splitting',
      'Worker threads',
      'Extension host isolation',
      'File watcher optimization',
      'Search indexing',
      'Cache management',
      'Memory management',
      'Startup optimization',
      'Background processes',
      'Process monitoring',
      'Performance profiler',
      'CPU profiling',
      'Memory profiling',
    ],
  },

  // ========================================================================
  // LANGUAGE FEATURES (LSP)
  // ========================================================================
  languageSupport: {
    status: 'pending',
    priority: 'high',
    features: [
      'Language Server Protocol',
      'TypeScript/JavaScript LSP',
      'Python LSP',
      'Rust LSP',
      'Go LSP',
      'Java LSP',
      'C/C++ LSP',
      'HTML/CSS LSP',
      'JSON LSP',
      'YAML LSP',
      'Markdown LSP',
      'SQL LSP',
      'Custom LSP support',
    ],
  },

  // ========================================================================
  // TASKS FEATURES
  // ========================================================================
  tasks: {
    status: 'pending',
    priority: 'medium',
    features: [
      'Task runner',
      'Task definitions',
      'Problem matchers',
      'Task groups',
      'Task templates',
      'npm scripts',
      'Custom tasks',
      'Background tasks',
      'Task history',
      'Task shortcuts',
    ],
  },

  // ========================================================================
  // SNIPPETS FEATURES
  // ========================================================================
  snippets: {
    status: 'pending',
    priority: 'medium',
    features: [
      'User snippets',
      'Extension snippets',
      'Snippet variables',
      'Snippet transforms',
      'Snippet placeholders',
      'Snippet choices',
      'Snippet import/export',
      'Snippet search',
    ],
  },

  // ========================================================================
  // REMOTE FEATURES (Future)
  // ========================================================================
  remote: {
    status: 'planned',
    priority: 'low',
    features: [
      'Remote SSH',
      'Remote WSL',
      'Remote Containers',
      'Remote Tunnels',
      'Web IDE',
      'GitHub Codespaces',
    ],
  },
};

// Priority order for implementation
export const IMPLEMENTATION_ORDER = [
  // Critical - Phase 1
  'editor.monacoEditor',
  'terminal.xterm',
  'search.globalSearch',
  'uiux.commandPalette',
  'problems.panel',
  
  // High - Phase 2
  'settings.settingsEditor',
  'git.diffViewer',
  'explorer.fileTree',
  'ai.features',
  'extensions.marketplace',
  
  // Medium - Phase 3
  'debugging.dap',
  'keybindings.editor',
  'tasks.runner',
  'snippets.manager',
  'languageSupport.lsp',
  
  // Low - Phase 4
  'performance.profiler',
  'remote.features',
];

export default FEATURE_COMPARISON;
