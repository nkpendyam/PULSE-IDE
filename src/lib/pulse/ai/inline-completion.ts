'use client';

import type * as Monaco from 'monaco-editor';

export interface InlineCompletionConfig {
  enabled: boolean;
  debounceMs: number;
  maxTokens: number;
  model: string;
  triggerCharacters: string[];
}

export interface InlineCompletionItem {
  text: string;
  range: Monaco.IRange;
  displayText?: string;
}

const defaultConfig: InlineCompletionConfig = {
  enabled: true,
  debounceMs: 300,
  maxTokens: 100,
  model: 'llama3.2',
  triggerCharacters: ['.', '(', '{', '[', '\n', ' '],
};

// Mock completion generator for demo
function generateMockCompletion(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  context: Monaco.languages.InlineCompletionContext
): InlineCompletionItem | null {
  const lineContent = model.getLineContent(position.lineNumber);
  const textBeforeCursor = lineContent.substring(0, position.column - 1);
  const textAfterCursor = lineContent.substring(position.column - 1);

  // Simple pattern-based completions for demo
  const completions: Array<{ pattern: RegExp; text: string }> = [
    // Console log
    { pattern: /console\.lo?g?$/, text: 'g($1)' },
    // Function definition
    { pattern: /function\s+\w*$/, text: 'name() {\n  $1\n}' },
    // Arrow function
    { pattern: /=>\s*$/, text: '{\n  $1\n}' },
    // Import statement
    { pattern: /import\s+$/, text: '{ } from \'$1\'' },
    // Export statement
    { pattern: /export\s+$/, text: 'default $1' },
    // If statement
    { pattern: /if\s*\($/, text: '$1) {\n  \n}' },
    // Try-catch
    { pattern: /try\s*$/, text: ' {\n  $1\n} catch (error) {\n  \n}' },
    // Async function
    { pattern: /async\s+$/, text: 'function $1() {\n  \n}' },
    // Interface
    { pattern: /interface\s+\w*$/, text: 'Name {\n  $1\n}' },
    // Type definition
    { pattern: /type\s+\w*$/, text: 'Name = $1' },
    // JSX element
    { pattern: /<\w*$/, text: '>$1</$1>' },
    // React useEffect
    { pattern: /useEffect\($/, text: '() => {\n  $1\n}, [])' },
    // React useState
    { pattern: /useState<\w*$/, text: '>($1)' },
    // Return statement
    { pattern: /return\s*$/, text: '$1' },
    // Map function
    { pattern: /\.map\($/, text: '(item => {\n  return $1\n})' },
    // Filter function
    { pattern: /\.filter\($/, text: '(item => $1)' },
    // Class definition
    { pattern: /class\s+\w*$/, text: 'Name {\n  constructor() {\n    $1\n  }\n}' },
  ];

  for (const { pattern, text } of completions) {
    if (pattern.test(textBeforeCursor)) {
      return {
        text,
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
      };
    }
  }

  // Context-based suggestions
  const lineCount = model.getLineCount();
  const prevLine = position.lineNumber > 1 ? model.getLineContent(position.lineNumber - 1) : '';
  const nextLine = position.lineNumber < lineCount ? model.getLineContent(position.lineNumber + 1) : '';

  // Continue comment
  if (prevLine.trim().startsWith('//') || prevLine.trim().startsWith('*')) {
    const indent = prevLine.match(/^\s*/)?.[0] || '';
    if (prevLine.includes('*')) {
      return {
        text: ` * $1`,
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
      };
    }
  }

  // JSX attribute completion
  if (textBeforeCursor.trim().endsWith('=') && /<\w+[^>]*$/.test(textBeforeCursor)) {
    return {
      text: '"$1"',
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
    };
  }

  // Object property completion
  if (/\{\s*$/.test(textBeforeCursor)) {
    return {
      text: '\n  $1\n',
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
    };
  }

  // Array item completion
  if (/\[\s*$/.test(textBeforeCursor)) {
    return {
      text: '\n  $1\n',
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
    };
  }

  return null;
}

export function createInlineCompletionProvider(
  monaco: typeof Monaco,
  config: InlineCompletionConfig = defaultConfig
): Monaco.languages.InlineCompletionsProvider {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastCompletion: InlineCompletionItem | null = null;

  return {
    displayName: 'Kyro AI Completions',
    provideInlineCompletions: async (model, position, context, token) => {
      if (!config.enabled) {
        return { items: [] };
      }

      // Check if we should trigger
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      // Only trigger if last character is a trigger character or after a delay
      const lastChar = textBeforeCursor.slice(-1);
      const shouldTrigger = config.triggerCharacters.includes(lastChar) || context.triggerKind === monaco.languages.InlineCompletionTriggerKind.Explicit;

      if (!shouldTrigger && context.triggerKind !== monaco.languages.InlineCompletionTriggerKind.Automatic) {
        return { items: [] };
      }

      // Debounce
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      return new Promise((resolve) => {
        debounceTimer = setTimeout(() => {
          if (token.isCancellationRequested) {
            resolve({ items: [] });
            return;
          }

          const completion = generateMockCompletion(model, position, context);

          if (completion) {
            lastCompletion = completion;
            resolve({
              items: [
                {
                  insertText: completion.text,
                  range: completion.range,
                },
              ],
            });
          } else {
            resolve({ items: [] });
          }
        }, config.debounceMs);
      });
    },

    freeInlineCompletions: () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    },

    handleItemDidShow: (completions, item) => {
      // Track usage for analytics
      console.log('Inline completion shown:', item.insertText);
    },
  };
}

export function registerInlineCompletion(
  monaco: typeof Monaco,
  language: string = 'typescript',
  config?: InlineCompletionConfig
): Monaco.IDisposable {
  return monaco.languages.registerInlineCompletionsProvider(
    language,
    createInlineCompletionProvider(monaco, config)
  );
}

export { defaultConfig };
