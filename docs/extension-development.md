# KRO IDE Extension Development Guide

## Overview

KRO IDE supports VS Code-compatible extensions through a comprehensive extension runtime. This guide walks you through creating, testing, and publishing extensions for KRO IDE.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Extension Manifest](#extension-manifest)
3. [API Reference](#api-reference)
4. [Debugging Extensions](#debugging-extensions)
5. [Publishing to Marketplace](#publishing-to-marketplace)
6. [Examples](#examples)

---

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- TypeScript 5.0+

### Create Your First Extension

```bash
# Clone the starter template
git clone https://github.com/kro-ide/extension-starter my-extension
cd my-extension

# Install dependencies
npm install

# Start development mode
npm run dev
```

### Project Structure

```
my-extension/
├── src/
│   └── extension.ts      # Main extension entry point
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript configuration
└── README.md             # Extension documentation
```

### Basic Extension

```typescript
// src/extension.ts
import * as kro from 'kro-extension-api';

export function activate(context: kro.ExtensionContext) {
    console.log('Extension activated!');

    // Register a command
    const disposable = kro.commands.registerCommand('myExtension.hello', () => {
        kro.window.showInformationMessage('Hello from KRO IDE!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    console.log('Extension deactivated');
}
```

---

## Extension Manifest

The `package.json` file defines your extension's metadata and capabilities.

### Required Fields

```json
{
    "name": "my-extension",
    "displayName": "My Extension",
    "version": "1.0.0",
    "engines": {
        "kro": "^1.0.0"
    },
    "main": "./out/extension.js",
    "activationEvents": [
        "onCommand:myExtension.hello"
    ],
    "contributes": {
        "commands": [
            {
                "command": "myExtension.hello",
                "title": "Say Hello",
                "category": "My Extension"
            }
        ]
    }
}
```

### Activation Events

| Event | Description |
|-------|-------------|
| `onLanguage:<lang>` | Activate when a file of the specified language is opened |
| `onCommand:<cmd>` | Activate when the specified command is invoked |
| `workspaceContains:<glob>` | Activate when workspace contains matching files |
| `onFileSystem:<scheme>` | Activate when accessing files with the scheme |
| `onView:<viewId>` | Activate when the specified view is visible |
| `onStartupFinished` | Activate after KRO IDE has started |

### Contribution Points

#### Commands

```json
{
    "contributes": {
        "commands": [
            {
                "command": "myExtension.format",
                "title": "Format Document",
                "icon": "$(format)"
            }
        ],
        "menus": {
            "editor/context": [
                {
                    "command": "myExtension.format",
                    "when": "editorTextFocus",
                    "group": "navigation"
                }
            ]
        }
    }
}
```

#### Keybindings

```json
{
    "contributes": {
        "keybindings": [
            {
                "command": "myExtension.format",
                "key": "ctrl+shift+f",
                "mac": "cmd+shift+f",
                "when": "editorTextFocus"
            }
        ]
    }
}
```

#### Configuration

```json
{
    "contributes": {
        "configuration": {
            "title": "My Extension",
            "properties": {
                "myExtension.enableFeature": {
                    "type": "boolean",
                    "default": true,
                    "description": "Enable the fancy feature"
                },
                "myExtension.maxItems": {
                    "type": "number",
                    "default": 100,
                    "description": "Maximum number of items to show"
                }
            }
        }
    }
}
```

---

## API Reference

### Commands

Register and execute commands:

```typescript
// Register a command
kro.commands.registerCommand('myExtension.doSomething', async (arg) => {
    // Command implementation
    return result;
});

// Execute a command
const result = await kro.commands.executeCommand('myExtension.doSomething', arg);

// Get all commands
const commands = await kro.commands.getCommands();
```

### Window

Show messages, inputs, and pickers:

```typescript
// Information message
kro.window.showInformationMessage('Operation completed!');

// Error message with actions
const action = await kro.window.showErrorMessage(
    'Failed to save file',
    'Retry',
    'Cancel'
);

// Input box
const name = await kro.window.showInputBox({
    prompt: 'Enter your name',
    placeHolder: 'John Doe',
    value: 'Default value'
});

// Quick pick
const selected = await kro.window.showQuickPick(
    ['Option 1', 'Option 2', 'Option 3'],
    {
        placeHolder: 'Choose an option'
    }
);

// Open file picker
const files = await kro.window.showOpenDialog({
    canSelectMany: true,
    filters: {
        'TypeScript': ['ts', 'tsx'],
        'JavaScript': ['js', 'jsx']
    }
});
```

### Workspace

Access workspace files and folders:

```typescript
// Get workspace folders
const folders = kro.workspace.workspaceFolders;

// Read file
const content = await kro.workspace.fs.readFile(uri);

// Write file
await kro.workspace.fs.writeFile(uri, content);

// Watch for changes
const watcher = kro.workspace.createFileSystemWatcher('**/*.ts');
watcher.onDidChange(uri => {
    console.log(`File changed: ${uri}`);
});

// Find files
const files = await kro.workspace.findFiles('**/*.rs', '**/target/**');
```

### Editor

Interact with the active editor:

```typescript
// Get active editor
const editor = kro.window.activeTextEditor;
if (editor) {
    // Get document
    const doc = editor.document;
    
    // Get selection
    const selection = editor.selection;
    
    // Edit document
    editor.edit(editBuilder => {
        editBuilder.replace(selection, 'New text');
    });
    
    // Insert snippet
    editor.insertSnippet(new kro.SnippetString('for (${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}'));
}
```

### Languages

Register language features:

```typescript
// Register completion provider
kro.languages.registerCompletionItemProvider(
    { language: 'rust' },
    {
        provideCompletionItems(doc, position) {
            return [
                new kro.CompletionItem('fn', kro.CompletionItemKind.Snippet)
            ];
        },
        resolveCompletionItem(item) {
            item.documentation = 'Function definition';
            return item;
        }
    },
    '.'
);

// Register hover provider
kro.languages.registerHoverProvider(
    { language: 'rust' },
    {
        provideHover(doc, position) {
            return new kro.Hover('Type information here');
        }
    }
);

// Register definition provider
kro.languages.registerDefinitionProvider(
    { language: 'rust' },
    {
        provideDefinition(doc, position) {
            return new kro.Location(uri, range);
        }
    }
);
```

### Terminal

Create and manage terminals:

```typescript
// Create terminal
const terminal = kro.window.createTerminal({
    name: 'My Terminal',
    cwd: '/path/to/project'
});

// Send text
terminal.sendText('cargo build --release');

// Show terminal
terminal.show();

// Handle exit
kro.window.onDidCloseTerminal(closedTerminal => {
    if (closedTerminal === terminal) {
        console.log('Terminal closed');
    }
});
```

---

## Debugging Extensions

### Development Mode

```bash
# Run in development mode with hot reload
npm run dev

# Watch for changes
npm run watch
```

### Extension Host Logging

KRO IDE provides detailed logs for extension debugging:

1. Open Command Palette (Ctrl+Shift+P)
2. Run "Developer: Open Extension Host Log"
3. Check for errors and warnings

### Breakpoints

Set breakpoints in your TypeScript code:
1. Open the source file
2. Click in the left margin to set a breakpoint
3. Run "Developer: Attach to Extension Host"

### Common Issues

| Issue | Solution |
|-------|----------|
| Extension not loading | Check `engines.kro` version in package.json |
| Command not found | Verify command is registered in `activate()` |
| API undefined | Ensure correct import from `kro-extension-api` |
| Performance issues | Use debounce for frequent events |

---

## Publishing to Marketplace

### Package Your Extension

```bash
# Build production version
npm run build

# Package as VSIX
npx vsce package
```

### Publish to Open VSX

```bash
# Install Open VSX CLI
npm install -g ovsx

# Create an access token at open-vsx.org
# Publish the extension
ovsx publish my-extension-1.0.0.vsix -p YOUR_TOKEN
```

### Extension Requirements

Before publishing, ensure your extension:

- [ ] Has a unique name
- [ ] Includes a descriptive README.md
- [ ] Has appropriate LICENSE file
- [ ] Contains icon (128x128 PNG recommended)
- [ ] Lists all dependencies
- [ ] Includes activation events
- [ ] Has been tested on all platforms

---

## Examples

### Example 1: Simple Theme Extension

```typescript
// extension.ts
import * as kro from 'kro-extension-api';

export function activate(context: kro.ExtensionContext) {
    // Theme is automatically loaded from package.json contributes
    console.log('Theme extension activated');
}
```

```json
// package.json
{
    "name": "kyro-dark-theme",
    "displayName": "Kyro Dark Theme",
    "version": "1.0.0",
    "engines": { "kro": "^1.0.0" },
    "contributes": {
        "themes": [
            {
                "label": "Kyro Dark",
                "uiTheme": "vs-dark",
                "path": "./themes/kyro-dark.json"
            }
        ]
    }
}
```

### Example 2: Language Support Extension

```typescript
// extension.ts
import * as kro from 'kro-extension-api';

export function activate(context: kro.ExtensionContext) {
    // Register completion provider
    const disposable = kro.languages.registerCompletionItemProvider(
        { language: 'mylang' },
        {
            provideCompletionItems(doc, position) {
                const line = doc.lineAt(position.line);
                const text = line.text.substring(0, position.character);
                
                // Simple keyword completion
                const keywords = ['if', 'else', 'for', 'while', 'fn'];
                return keywords
                    .filter(kw => kw.startsWith(text.split(/\s+/).pop() || ''))
                    .map(kw => new kro.CompletionItem(kw));
            }
        }
    );
    
    context.subscriptions.push(disposable);
}
```

### Example 3: Tool Integration Extension

```typescript
// extension.ts
import * as kro from 'kro-extension-api';
import { exec } from 'child_process';

export function activate(context: kro.ExtensionContext) {
    // Register a linter command
    const lintCommand = kro.commands.registerCommand(
        'myLinter.lint',
        async () => {
            const editor = kro.window.activeTextEditor;
            if (!editor) return;
            
            const doc = editor.document;
            if (doc.languageId !== 'mylang') return;
            
            try {
                // Run external linter
                const output = await runLinter(doc.uri.fsPath);
                
                // Show diagnostics
                const diagnostics = parseLinterOutput(output);
                kro.languages.getDiagnostics().set(doc.uri, diagnostics);
            } catch (error) {
                kro.window.showErrorMessage(`Linter failed: ${error}`);
            }
        }
    );
    
    context.subscriptions.push(lintCommand);
}

function runLinter(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(`mylinter "${filePath}"`, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout);
        });
    });
}
```

---

## Support

- **Documentation**: https://docs.kro-ide.dev/extensions
- **GitHub**: https://github.com/kro-ide/extension-starter
- **Discord**: https://discord.gg/kro-ide
- **Email**: extensions@kro-ide.dev

---

## License

This guide is licensed under the MIT License.
