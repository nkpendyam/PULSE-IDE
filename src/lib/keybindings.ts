// Keybinding System for KRO IDE
// Supports VS Code, Vim, JetBrains, and custom keybindings

export interface Keybinding {
  key: string;
  command: string;
  when?: string;
  args?: unknown;
}

export interface KeybindingScheme {
  id: string;
  name: string;
  description: string;
  keybindings: Keybinding[];
}

// Parse key string like "Ctrl+Shift+P" into parts
export function parseKeyString(key: string): {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
} {
  const parts = key.toLowerCase().split('+');
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    key: parts[parts.length - 1]
  };
}

// Check if event matches keybinding
export function matchesKeybinding(e: KeyboardEvent, keybinding: Keybinding): boolean {
  const parsed = parseKeyString(keybinding.key);
  
  // Check modifiers
  if (parsed.ctrl !== (e.ctrlKey || e.metaKey)) return false;
  if (parsed.shift !== e.shiftKey) return false;
  if (parsed.alt !== e.altKey) return false;
  if (parsed.meta !== e.metaKey) return false;
  
  // Check key
  const eventKey = e.key.toLowerCase();
  const targetKey = parsed.key.toLowerCase();
  
  // Handle special keys
  const specialKeyMap: Record<string, string[]> = {
    'enter': ['enter', 'return'],
    'escape': ['escape', 'esc'],
    'space': [' ', 'space'],
    'arrowup': ['arrowup', 'up'],
    'arrowdown': ['arrowdown', 'down'],
    'arrowleft': ['arrowleft', 'left'],
    'arrowright': ['arrowright', 'right'],
    'backspace': ['backspace'],
    'delete': ['delete', 'del'],
    'tab': ['tab'],
    'home': ['home'],
    'end': ['end'],
    'pageup': ['pageup'],
    'pagedown': ['pagedown'],
    'insert': ['insert'],
    'f1': ['f1'], 'f2': ['f2'], 'f3': ['f3'], 'f4': ['f4'],
    'f5': ['f5'], 'f6': ['f6'], 'f7': ['f7'], 'f8': ['f8'],
    'f9': ['f9'], 'f10': ['f10'], 'f11': ['f11'], 'f12': ['f12'],
  };

  // Find the actual key to match
  for (const [name, aliases] of Object.entries(specialKeyMap)) {
    if (targetKey === name || aliases.includes(targetKey)) {
      return eventKey === name || aliases.includes(eventKey);
    }
  }

  return eventKey === targetKey;
}

// VS Code Default Keybindings
export const vscodeKeybindings: KeybindingScheme = {
  id: 'vscode',
  name: 'VS Code',
  description: 'Default Visual Studio Code keybindings',
  keybindings: [
    // File
    { key: 'Ctrl+S', command: 'workbench.action.files.save' },
    { key: 'Ctrl+Shift+S', command: 'workbench.action.files.saveAs' },
    { key: 'Ctrl+K Ctrl+O', command: 'workbench.action.files.openFolder' },
    { key: 'Ctrl+K Ctrl+S', command: 'workbench.action.openSettings' },
    { key: 'Ctrl+W', command: 'workbench.action.closeActiveEditor' },
    { key: 'Ctrl+Shift+W', command: 'workbench.action.closeWindow' },
    { key: 'Ctrl+N', command: 'workbench.action.files.newUntitledFile' },
    { key: 'Ctrl+O', command: 'workbench.action.files.openFile' },
    
    // Edit
    { key: 'Ctrl+Z', command: 'undo' },
    { key: 'Ctrl+Y', command: 'redo' },
    { key: 'Ctrl+X', command: 'editor.action.clipboardCutAction' },
    { key: 'Ctrl+C', command: 'editor.action.clipboardCopyAction' },
    { key: 'Ctrl+V', command: 'editor.action.clipboardPasteAction' },
    { key: 'Ctrl+D', command: 'editor.action.copyLinesDownAction' },
    { key: 'Ctrl+Shift+K', command: 'editor.action.deleteLines' },
    { key: 'Ctrl+Enter', command: 'editor.action.insertLineAfter' },
    { key: 'Ctrl+Shift+Enter', command: 'editor.action.insertLineBefore' },
    { key: 'Ctrl+Shift+\\', command: 'editor.action.jumpToBracket' },
    { key: 'Ctrl+]', command: 'editor.action.indentLines' },
    { key: 'Ctrl+[', command: 'editor.action.outdentLines' },
    { key: 'Ctrl+/', command: 'editor.action.commentLine' },
    { key: 'Ctrl+Shift+/', command: 'editor.action.blockComment' },
    { key: 'Alt+Up', command: 'editor.action.moveLinesUpAction' },
    { key: 'Alt+Down', command: 'editor.action.moveLinesDownAction' },
    { key: 'Shift+Alt+Right', command: 'editor.action.smartSelect.expand' },
    { key: 'Shift+Alt+Left', command: 'editor.action.smartSelect.shrink' },
    { key: 'Ctrl+Shift+L', command: 'editor.action.selectHighlights' },
    { key: 'Ctrl+F2', command: 'editor.action.changeAll' },
    
    // Find
    { key: 'Ctrl+F', command: 'actions.find' },
    { key: 'Ctrl+H', command: 'editor.action.startFindReplaceAction' },
    { key: 'Ctrl+Shift+F', command: 'workbench.action.search.toggleQueryDetails' },
    { key: 'F3', command: 'editor.action.findNextMatch' },
    { key: 'Shift+F3', command: 'editor.action.findPreviousMatch' },
    
    // Navigation
    { key: 'Ctrl+P', command: 'workbench.action.quickOpen' },
    { key: 'Ctrl+Shift+P', command: 'workbench.action.showCommands' },
    { key: 'Ctrl+G', command: 'workbench.action.gotoLine' },
    { key: 'Ctrl+T', command: 'workbench.action.showAllSymbols' },
    { key: 'F12', command: 'editor.action.goToDeclaration' },
    { key: 'Alt+F12', command: 'editor.action.peekDefinition' },
    { key: 'Shift+F12', command: 'editor.action.goToReferences' },
    { key: 'Ctrl+Shift+F12', command: 'editor.action.peekReferences' },
    { key: 'F8', command: 'editor.action.marker.next' },
    { key: 'Shift+F8', command: 'editor.action.marker.prev' },
    { key: 'Ctrl+M', command: 'editor.action.toggleTabFocusMode' },
    { key: 'Ctrl+Home', command: 'cursorTop' },
    { key: 'Ctrl+End', command: 'cursorBottom' },
    
    // View
    { key: 'Ctrl+B', command: 'workbench.action.toggleSidebarVisibility' },
    { key: 'Ctrl+`', command: 'workbench.action.terminal.toggleTerminal' },
    { key: 'Ctrl+Shift+E', command: 'workbench.view.explorer' },
    { key: 'Ctrl+Shift+G', command: 'workbench.view.scm' },
    { key: 'Ctrl+Shift+D', command: 'workbench.view.debug' },
    { key: 'Ctrl+Shift+X', command: 'workbench.view.extensions' },
    { key: 'Ctrl+\\', command: 'workbench.action.splitEditor' },
    { key: 'Ctrl+1', command: 'workbench.action.focusFirstEditorGroup' },
    { key: 'Ctrl+2', command: 'workbench.action.focusSecondEditorGroup' },
    { key: 'Ctrl+3', command: 'workbench.action.focusThirdEditorGroup' },
    
    // Debug
    { key: 'F5', command: 'workbench.action.debug.start' },
    { key: 'Shift+F5', command: 'workbench.action.debug.stop' },
    { key: 'Ctrl+Shift+F5', command: 'workbench.action.debug.restart' },
    { key: 'F9', command: 'editor.debug.action.toggleBreakpoint' },
    { key: 'F10', command: 'workbench.action.debug.stepOver' },
    { key: 'F11', command: 'workbench.action.debug.stepInto' },
    { key: 'Shift+F11', command: 'workbench.action.debug.stepOut' },
    
    // Refactor
    { key: 'F2', command: 'editor.action.rename' },
    { key: 'Shift+Alt+F', command: 'editor.action.formatDocument' },
    { key: 'Ctrl+K Ctrl+F', command: 'editor.action.formatSelection' },
    { key: 'Ctrl+.', command: 'editor.action.quickFix' },
    { key: 'Ctrl+Shift+R', command: 'editor.action.refactor' },
    
    // Multi-cursor
    { key: 'Alt+Click', command: 'editor.action.addCursor', args: { position: 'click' } },
    { key: 'Ctrl+Alt+Down', command: 'editor.action.insertCursorBelow' },
    { key: 'Ctrl+Alt+Up', command: 'editor.action.insertCursorAbove' },
    { key: 'Ctrl+Shift+Alt+Down', command: 'editor.action.copyLinesDownAction' },
    { key: 'Ctrl+Shift+Alt+Up', command: 'editor.action.copyLinesUpAction' },
    
    // AI (KRO specific)
    { key: 'Ctrl+I', command: 'workbench.action.chat.open' },
    { key: 'Ctrl+K', command: 'editor.action.inlineChat' },
    { key: 'Ctrl+Shift+E', command: 'ai.explainCode' },
    { key: 'Ctrl+Shift+F', command: 'ai.fixCode' },
  ]
};

// Vim Keybindings
export const vimKeybindings: KeybindingScheme = {
  id: 'vim',
  name: 'Vim',
  description: 'Vim-style keybindings',
  keybindings: [
    // Normal mode commands
    { key: 'Escape', command: 'vim.escape' },
    { key: 'i', command: 'vim.insertMode', when: 'vim.mode == normal' },
    { key: 'a', command: 'vim.appendMode', when: 'vim.mode == normal' },
    { key: 'o', command: 'vim.openLineBelow', when: 'vim.mode == normal' },
    { key: 'O', command: 'vim.openLineAbove', when: 'vim.mode == normal' },
    { key: 'd d', command: 'vim.deleteLine', when: 'vim.mode == normal' },
    { key: 'y y', command: 'vim.yankLine', when: 'vim.mode == normal' },
    { key: 'p', command: 'vim.putBelow', when: 'vim.mode == normal' },
    { key: 'P', command: 'vim.putAbove', when: 'vim.mode == normal' },
    { key: 'u', command: 'undo', when: 'vim.mode == normal' },
    { key: 'Ctrl+R', command: 'redo', when: 'vim.mode == normal' },
    { key: ':', command: 'vim.commandMode', when: 'vim.mode == normal' },
    { key: '/', command: 'vim.searchForward', when: 'vim.mode == normal' },
    { key: '?', command: 'vim.searchBackward', when: 'vim.mode == normal' },
    { key: 'n', command: 'vim.searchNext', when: 'vim.mode == normal' },
    { key: 'N', command: 'vim.searchPrev', when: 'vim.mode == normal' },
    { key: 'w', command: 'vim.wordForward', when: 'vim.mode == normal' },
    { key: 'b', command: 'vim.wordBackward', when: 'vim.mode == normal' },
    { key: '0', command: 'vim.lineStart', when: 'vim.mode == normal' },
    { key: '$', command: 'vim.lineEnd', when: 'vim.mode == normal' },
    { key: 'g g', command: 'vim.fileStart', when: 'vim.mode == normal' },
    { key: 'G', command: 'vim.fileEnd', when: 'vim.mode == normal' },
    { key: 'Ctrl+F', command: 'vim.pageDown', when: 'vim.mode == normal' },
    { key: 'Ctrl+B', command: 'vim.pageUp', when: 'vim.mode == normal' },
    { key: ': w', command: 'workbench.action.files.save', when: 'vim.mode == command' },
    { key: ': q', command: 'workbench.action.closeActiveEditor', when: 'vim.mode == command' },
    { key: ': w q', command: 'workbench.action.files.saveAndClose', when: 'vim.mode == command' },
  ]
};

// JetBrains Keybindings
export const jetbrainsKeybindings: KeybindingScheme = {
  id: 'jetbrains',
  name: 'JetBrains',
  description: 'IntelliJ IDEA / JetBrains IDE keybindings',
  keybindings: [
    // File
    { key: 'Ctrl+S', command: 'SaveAll' },
    { key: 'Ctrl+Alt+S', command: 'ShowSettings' },
    { key: 'Ctrl+Alt+Shift+S', command: 'ShowProjectStructure' },
    { key: 'Ctrl+E', command: 'RecentFiles' },
    { key: 'Ctrl+Shift+E', command: 'RecentLocations' },
    
    // Edit
    { key: 'Ctrl+Z', command: 'Undo' },
    { key: 'Ctrl+Shift+Z', command: 'Redo' },
    { key: 'Ctrl+X', command: 'Cut' },
    { key: 'Ctrl+C', command: 'Copy' },
    { key: 'Ctrl+V', command: 'Paste' },
    { key: 'Ctrl+Shift+V', command: 'PasteFromHistory' },
    { key: 'Ctrl+D', command: 'DuplicateLine' },
    { key: 'Ctrl+Y', command: 'DeleteLine' },
    { key: 'Ctrl+Shift+J', command: 'JoinLines' },
    { key: 'Ctrl+Shift+Enter', command: 'CompleteStatement' },
    { key: 'Ctrl+/', command: 'CommentByLineComment' },
    { key: 'Ctrl+Shift+/', command: 'CommentByBlockComment' },
    
    // Navigation
    { key: 'Ctrl+N', command: 'GotoClass' },
    { key: 'Ctrl+Shift+N', command: 'GotoFile' },
    { key: 'Ctrl+Shift+Alt+N', command: 'GotoSymbol' },
    { key: 'Ctrl+G', command: 'GotoLine' },
    { key: 'Ctrl+B', command: 'GotoDeclaration' },
    { key: 'Ctrl+Alt+B', command: 'GotoImplementation' },
    { key: 'Ctrl+Shift+I', command: 'QuickDefinition' },
    { key: 'Ctrl+Alt+Left', command: 'Back' },
    { key: 'Ctrl+Alt+Right', command: 'Forward' },
    { key: 'Alt+Up', command: 'MethodUp' },
    { key: 'Alt+Down', command: 'MethodDown' },
    { key: 'Ctrl+]', command: 'MoveToCodeBlockEnd' },
    { key: 'Ctrl+[', command: 'MoveToCodeBlockStart' },
    
    // Search
    { key: 'Ctrl+F', command: 'Find' },
    { key: 'F3', command: 'FindNext' },
    { key: 'Shift+F3', command: 'FindPrevious' },
    { key: 'Ctrl+R', command: 'Replace' },
    { key: 'Ctrl+Shift+F', command: 'FindInPath' },
    { key: 'Ctrl+Shift+R', command: 'ReplaceInPath' },
    
    // Refactor
    { key: 'Shift+F6', command: 'RenameElement' },
    { key: 'Ctrl+Alt+Shift+T', command: 'RefactorThis' },
    { key: 'F6', command: 'Move' },
    { key: 'F5', command: 'Copy' },
    { key: 'Ctrl+Alt+N', command: 'Inline' },
    { key: 'Ctrl+Alt+M', command: 'ExtractMethod' },
    { key: 'Ctrl+Alt+V', command: 'ExtractVariable' },
    { key: 'Ctrl+Alt+F', command: 'ExtractField' },
    { key: 'Ctrl+Alt+C', command: 'ExtractConstant' },
    
    // View
    { key: 'Alt+1', command: 'ActivateProjectToolWindow' },
    { key: 'Alt+2', command: 'ActivateFavoritesToolWindow' },
    { key: 'Alt+3', command: 'ActivateFindToolWindow' },
    { key: 'Alt+4', command: 'ActivateRunToolWindow' },
    { key: 'Alt+5', command: 'ActivateDebugToolWindow' },
    { key: 'Alt+6', command: 'ActivateProblemsToolWindow' },
    { key: 'Alt+7', command: 'ActivateStructureToolWindow' },
    { key: 'Ctrl+Alt+Y', command: 'Synchronize' },
    
    // Debug
    { key: 'Shift+F9', command: 'Debug' },
    { key: 'Ctrl+F2', command: 'Stop' },
    { key: 'F8', command: 'StepOver' },
    { key: 'F7', command: 'StepInto' },
    { key: 'Shift+F8', command: 'StepOut' },
    { key: 'Alt+F9', command: 'RunToCursor' },
    { key: 'Ctrl+F8', command: 'ToggleLineBreakpoint' },
    { key: 'Ctrl+Shift+F8', command: 'ViewBreakpoints' },
    
    // Code
    { key: 'Ctrl+Space', command: 'CodeCompletion' },
    { key: 'Ctrl+Shift+Space', command: 'SmartTypeCompletion' },
    { key: 'Ctrl+Alt+Space', command: 'ClassNameCompletion' },
    { key: 'Ctrl+Shift+Enter', command: 'CompleteCurrentStatement' },
    { key: 'Ctrl+P', command: 'ParameterInfo' },
    { key: 'Ctrl+Q', command: 'QuickDocumentation' },
    { key: 'Ctrl+F1', command: 'ErrorDescription' },
    { key: 'Alt+Insert', command: 'Generate' },
    { key: 'Ctrl+O', command: 'OverrideMethods' },
    { key: 'Ctrl+I', command: 'ImplementMethods' },
    { key: 'Ctrl+Alt+T', command: 'SurroundWith' },
    { key: 'Ctrl+Alt+L', command: 'ReformatCode' },
    { key: 'Ctrl+Alt+O', command: 'OptimizeImports' },
  ]
};

// Available schemes
export const availableSchemes: KeybindingScheme[] = [
  vscodeKeybindings,
  vimKeybindings,
  jetbrainsKeybindings,
];

// Keybinding manager class
export class KeybindingManager {
  private activeScheme: KeybindingScheme;
  private customKeybindings: Map<string, Keybinding> = new Map();

  constructor(schemeId: string = 'vscode') {
    this.activeScheme = availableSchemes.find(s => s.id === schemeId) || vscodeKeybindings;
  }

  setScheme(schemeId: string) {
    const scheme = availableSchemes.find(s => s.id === schemeId);
    if (scheme) {
      this.activeScheme = scheme;
    }
  }

  getScheme(): KeybindingScheme {
    return this.activeScheme;
  }

  addCustomKeybinding(keybinding: Keybinding) {
    this.customKeybindings.set(keybinding.key, keybinding);
  }

  removeCustomKeybinding(key: string) {
    this.customKeybindings.delete(key);
  }

  findMatchingCommand(e: KeyboardEvent): string | null {
    // Check custom keybindings first
    for (const [, kb] of this.customKeybindings) {
      if (matchesKeybinding(e, kb)) {
        return kb.command;
      }
    }

    // Then check active scheme
    for (const kb of this.activeScheme.keybindings) {
      if (matchesKeybinding(e, kb)) {
        return kb.command;
      }
    }

    return null;
  }

  getAllKeybindings(): Keybinding[] {
    return [
      ...this.activeScheme.keybindings,
      ...Array.from(this.customKeybindings.values()),
    ];
  }

  getKeybindingForCommand(command: string): Keybinding | undefined {
    return this.activeScheme.keybindings.find(kb => kb.command === command) ||
           Array.from(this.customKeybindings.values()).find(kb => kb.command === command);
  }
}

// Create singleton instance
export const keybindingManager = new KeybindingManager();
