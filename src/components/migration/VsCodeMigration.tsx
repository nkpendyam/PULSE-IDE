/**
 * VS Code Migration Tool
 * 
 * Imports settings, keybindings, and suggests extension equivalents
 * from VS Code installation
 */

'use client';

import React, { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

// VS Code settings structure
interface VSCodeSettings {
  'editor.fontSize'?: number;
  'editor.fontFamily'?: string;
  'editor.tabSize'?: number;
  'editor.wordWrap'?: string;
  'editor.minimap.enabled'?: boolean;
  'editor.formatOnSave'?: boolean;
  'editor.autoIndent'?: string;
  'editor.bracketPairColorization.enabled'?: boolean;
  'workbench.colorTheme'?: string;
  'workbench.iconTheme'?: string;
  'terminal.integrated.fontSize'?: number;
  'terminal.integrated.shell.osx'?: string;
  'terminal.integrated.shell.linux'?: string;
  'terminal.integrated.shell.windows'?: string;
  'files.autoSave'?: string;
  'files.autoSaveDelay'?: number;
  [key: string]: unknown;
}

// VS Code keybinding
interface VSCodeKeybinding {
  key: string;
  command: string;
  when?: string;
  args?: unknown;
}

// Installed VS Code extension
interface VSCodeExtension {
  id: string;
  name: string;
  publisher: string;
  version: string;
  installed: boolean;
  openVSXEquivalent?: string;
}

// Migration result
interface MigrationResult {
  settingsImported: number;
  keybindingsImported: number;
  extensionsFound: number;
  extensionsMigrated: number;
  errors: string[];
}

// Settings mapping from VS Code to Kyro
const SETTINGS_MAPPING: Record<string, { kyro: string; transform?: (value: unknown) => unknown }> = {
  'editor.fontSize': { kyro: 'editor.fontSize' },
  'editor.fontFamily': { kyro: 'editor.fontFamily' },
  'editor.tabSize': { kyro: 'editor.tabSize' },
  'editor.wordWrap': { kyro: 'editor.wordWrap' },
  'editor.minimap.enabled': { kyro: 'editor.minimap.enabled' },
  'editor.formatOnSave': { kyro: 'editor.formatOnSave' },
  'workbench.colorTheme': { kyro: 'theme.name' },
  'terminal.integrated.fontSize': { kyro: 'terminal.fontSize' },
  'files.autoSave': { kyro: 'files.autoSave' },
  'files.autoSaveDelay': { kyro: 'files.autoSaveDelay' },
};

// Known extension equivalents on Open VSX
const EXTENSION_EQUIVALENTS: Record<string, string> = {
  // Popular extensions with Open VSX equivalents
  'esbenp.prettier-vscode': 'esbenp.prettier-vscode',
  'dbaeumer.vscode-eslint': 'dbaeumer.vscode-eslint',
  'ms-python.python': 'ms-python.python',
  'ms-vscode.vscode-typescript-next': 'ms-vscode.vscode-typescript-next',
  'rust-lang.rust-analyzer': 'rust-lang.rust-analyzer',
  'golang.go': 'golang.go',
  'ms-azuretools.vscode-docker': 'ms-azuretools.vscode-docker',
  'eamodio.gitlens': 'eamodio.gitlens',
  'vscodevim.vim': 'vscodevim.vim',
  'pkief.material-icon-theme': 'pkief.material-icon-theme',
  'zhuangtongfa.material-theme': 'zhuangtongfa.material-theme',
  'dsznajder.es7-react-js-snippets': 'dsznajder.es7-react-js-snippets',
  'formulahendry.auto-rename-tag': 'formulahendry.auto-rename-tag',
  'aaron-bond.better-comments': 'aaron-bond.better-comments',
  'coenraads.bracket-pair-colorizer-2': 'coenraads.bracket-pair-colorizer-2',
  'wallabyjs.quokka-vscode': null, // No Open VSX equivalent
  'wix.vscode-import-cost': 'wix.vscode-import-cost',
  'streetsidesoftware.code-spell-checker': 'streetsidesoftware.code-spell-checker',
};

export function VsCodeMigration() {
  const [isScanning, setIsScanning] = useState(false);
  const [settings, setSettings] = useState<VSCodeSettings | null>(null);
  const [keybindings, setKeybindings] = useState<VSCodeKeybinding[]>([]);
  const [extensions, setExtensions] = useState<VSCodeExtension[]>([]);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Scan for VS Code installation
  const scanVSCode = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    
    try {
      // Try to find VS Code settings
      const vscodePath = await findVSCodePath();
      
      if (!vscodePath) {
        setError('VS Code installation not found. Make sure VS Code is installed.');
        return;
      }

      // Load settings.json
      const settingsPath = `${vscodePath}/User/settings.json`;
      try {
        const settingsContent = await invoke<string>('read_file', { path: settingsPath });
        const parsedSettings = JSON.parse(settingsContent);
        setSettings(parsedSettings);
      } catch {
        console.log('Could not load VS Code settings');
      }

      // Load keybindings.json
      const keybindingsPath = `${vscodePath}/User/keybindings.json`;
      try {
        const keybindingsContent = await invoke<string>('read_file', { path: keybindingsPath });
        const parsedKeybindings = JSON.parse(keybindingsContent);
        setKeybindings(Array.isArray(parsedKeybindings) ? parsedKeybindings : []);
      } catch {
        console.log('Could not load VS Code keybindings');
      }

      // Scan installed extensions
      const extensionsList = await scanVSCodeExtensions(vscodePath);
      setExtensions(extensionsList);

    } catch (e) {
      setError(`Failed to scan VS Code: ${e}`);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Import settings to Kyro
  const importSettings = useCallback(async () => {
    if (!settings) return;

    const result: MigrationResult = {
      settingsImported: 0,
      keybindingsImported: 0,
      extensionsFound: extensions.length,
      extensionsMigrated: 0,
      errors: [],
    };

    try {
      // Map VS Code settings to Kyro settings
      const kyroSettings: Record<string, unknown> = {};
      
      for (const [vsCodeKey, mapping] of Object.entries(SETTINGS_MAPPING)) {
        if (settings[vsCodeKey] !== undefined) {
          const value = mapping.transform 
            ? mapping.transform(settings[vsCodeKey])
            : settings[vsCodeKey];
          kyroSettings[mapping.kyro] = value;
          result.settingsImported++;
        }
      }

      // Save to Kyro settings
      localStorage.setItem('kyro-settings', JSON.stringify(kyroSettings));

      // Import keybindings
      if (keybindings.length > 0) {
        const kyroKeybindings = keybindings.map(kb => ({
          key: kb.key,
          command: mapCommand(kb.command),
          when: kb.when,
        }));
        localStorage.setItem('kyro-keybindings', JSON.stringify(kyroKeybindings));
        result.keybindingsImported = keybindings.length;
      }

      setMigrationResult(result);
    } catch (e) {
      result.errors.push(`Import failed: ${e}`);
      setMigrationResult(result);
    }
  }, [settings, keybindings, extensions]);

  // Install extension equivalents
  const installExtensions = useCallback(async (selectedExtensions: string[]) => {
    let installed = 0;
    
    for (const extId of selectedExtensions) {
      const openVSXId = EXTENSION_EQUIVALENTS[extId];
      if (openVSXId) {
        try {
          await invoke('install_extension_unified', { extensionId: openVSXId });
          installed++;
        } catch (e) {
          console.error(`Failed to install ${extId}:`, e);
        }
      }
    }

    if (migrationResult) {
      setMigrationResult({
        ...migrationResult,
        extensionsMigrated: installed,
      });
    }
  }, [migrationResult]);

  return (
    <div className="p-6 bg-[#0d1117] text-[#c9d1d9] rounded-lg max-w-2xl">
      <h2 className="text-xl font-bold mb-4 text-[#58a6ff]">
        Import from VS Code
      </h2>
      
      <p className="text-sm text-[#8b949e] mb-6">
        Migrate your settings, keybindings, and extensions from VS Code to Kyro IDE.
      </p>

      {/* Scan button */}
      <button
        onClick={scanVSCode}
        disabled={isScanning}
        className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed mb-6"
      >
        {isScanning ? 'Scanning...' : 'Scan for VS Code'}
      </button>

      {/* Error */}
      {error && (
        <div className="p-3 bg-[#f85149] bg-opacity-10 border border-[#f85149] rounded-md text-[#f85149] mb-4">
          {error}
        </div>
      )}

      {/* Settings preview */}
      {settings && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Settings Found</h3>
          <div className="bg-[#161b22] rounded-md p-3 max-h-40 overflow-auto">
            <pre className="text-xs">
              {JSON.stringify(settings, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Extensions */}
      {extensions.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">
            Extensions ({extensions.length} found)
          </h3>
          <div className="space-y-2 max-h-60 overflow-auto">
            {extensions.map(ext => (
              <div
                key={ext.id}
                className="flex items-center justify-between p-2 bg-[#161b22] rounded"
              >
                <div>
                  <span className="font-medium">{ext.name}</span>
                  <span className="text-xs text-[#8b949e] ml-2">
                    {ext.publisher}
                  </span>
                </div>
                {ext.openVSXEquivalent ? (
                  <span className="text-xs text-[#3fb950]">Available</span>
                ) : (
                  <span className="text-xs text-[#f85149]">Not available</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import buttons */}
      {settings && (
        <div className="flex gap-3">
          <button
            onClick={importSettings}
            className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md"
          >
            Import Settings
          </button>
          
          {extensions.filter(e => e.openVSXEquivalent).length > 0 && (
            <button
              onClick={() => installExtensions(
                extensions.filter(e => e.openVSXEquivalent).map(e => e.id)
              )}
              className="px-4 py-2 bg-[#1f6feb] hover:bg-[#388bfd] text-white rounded-md"
            >
              Install Extensions
            </button>
          )}
        </div>
      )}

      {/* Migration result */}
      {migrationResult && (
        <div className="mt-6 p-4 bg-[#161b22] rounded-md">
          <h3 className="font-medium mb-2">Migration Complete</h3>
          <ul className="text-sm space-y-1">
            <li>✓ Settings imported: {migrationResult.settingsImported}</li>
            <li>✓ Keybindings imported: {migrationResult.keybindingsImported}</li>
            <li>✓ Extensions found: {migrationResult.extensionsFound}</li>
            <li>✓ Extensions installed: {migrationResult.extensionsMigrated}</li>
          </ul>
          {migrationResult.errors.length > 0 && (
            <div className="mt-2 text-sm text-[#f85149]">
              {migrationResult.errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper functions

async function findVSCodePath(): Promise<string | null> {
  const platform = navigator.platform.toLowerCase();
  
  let possiblePaths: string[];
  
  if (platform.includes('win')) {
    possiblePaths = [
      `${process.env.APPDATA}/Code`,
      `${process.env.USERPROFILE}/.config/Code`,
    ];
  } else if (platform.includes('mac')) {
    possiblePaths = [
      `${process.env.HOME}/Library/Application Support/Code`,
    ];
  } else {
    possiblePaths = [
      `${process.env.HOME}/.config/Code`,
      `${process.env.HOME}/.vscode`,
    ];
  }

  for (const path of possiblePaths) {
    try {
      const exists = await invoke<boolean>('file_exists', { path });
      if (exists) return path;
    } catch {
      continue;
    }
  }
  
  return null;
}

async function scanVSCodeExtensions(vscodePath: string): Promise<VSCodeExtension[]> {
  const extensions: VSCodeExtension[] = [];
  
  try {
    const extensionsPath = `${vscodePath}/extensions`;
    const entries = await invoke<string[]>('list_directory', { path: extensionsPath });
    
    for (const entry of entries) {
      const match = entry.match(/^(.+)\.(.+)-(\d+\.\d+\.\d+)$/);
      if (match) {
        const [, _, publisher, name, version] = match;
        const id = `${publisher}.${name}`;
        extensions.push({
          id,
          name,
          publisher,
          version,
          installed: false,
          openVSXEquivalent: EXTENSION_EQUIVALENTS[id],
        });
      }
    }
  } catch {
    console.log('Could not scan extensions');
  }
  
  return extensions;
}

function mapCommand(vsCodeCommand: string): string {
  // Map VS Code commands to Kyro equivalents
  const commandMap: Record<string, string> = {
    'workbench.action.files.save': 'file.save',
    'workbench.action.files.saveAll': 'file.saveAll',
    'workbench.action.files.newFile': 'file.newFile',
    'workbench.action.files.openFile': 'file.openFile',
    'workbench.action.files.openFolder': 'file.openFolder',
    'workbench.action.closeActiveEditor': 'editor.close',
    'workbench.action.closeAllEditors': 'editor.closeAll',
    'workbench.action.quickOpen': 'commandPalette.open',
    'workbench.action.showCommands': 'commandPalette.showCommands',
    'editor.action.formatDocument': 'editor.format',
    'editor.action.commentLine': 'editor.toggleComment',
    'editor.action.findReplace': 'editor.findReplace',
    'workbench.action.terminal.new': 'terminal.new',
    'workbench.action.terminal.toggleTerminal': 'terminal.toggle',
    'workbench.action.reloadWindow': 'app.reload',
    'workbench.action.toggleZenMode': 'view.toggleZenMode',
    'workbench.action.toggleSidebarVisibility': 'view.toggleSidebar',
    'workbench.action.toggleMinimap': 'view.toggleMinimap',
  };
  
  return commandMap[vsCodeCommand] || vsCodeCommand;
}

export default VsCodeMigration;
