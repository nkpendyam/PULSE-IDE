import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as monaco from 'monaco-editor';

vi.mock('@/store/kyroStore', () => ({
  useKyroStore: {
    getState: () => ({
      setDiagnosticCounts: vi.fn(),
    }),
  },
}));

import { __testing, registerLspProviders } from '@/lib/lspBridge';

describe('lspBridge helpers', () => {
  it('maps Monaco languages to LSP server ids', () => {
    expect(__testing.mapLanguageForLspServer('tsx')).toBe('typescript');
    expect(__testing.mapLanguageForLspServer('javascript')).toBe('typescript');
    expect(__testing.mapLanguageForLspServer('rust')).toBe('rust');
    expect(__testing.mapLanguageForLspServer('python')).toBe('python');
  });

  it('normalizes file URI and root URI', () => {
    const monacoStub = {
      Uri: {
        file: (path: string) => ({
          toString: () => `file://${path.replace(/\\/g, '/')}`,
        }),
      },
    } as unknown as typeof monaco;

    const uri = __testing.toFileUri(monacoStub, 'C:\\repo\\src\\main.ts');
    expect(uri).toContain('file://C:/repo/src/main.ts');

    const root = __testing.getRootUri(monacoStub, 'C:\\repo\\src\\main.ts');
    expect(root).toContain('file://C:/repo/src');
  });
});

describe('lspBridge provider wiring', () => {
  const invoke = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as unknown as { window: unknown }).window = {
      __TAURI__: {
        core: { invoke },
      },
    };

    invoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'lsp_start_server':
          return { language: 'typescript', running: true };
        case 'lsp_get_completions':
          return [
            {
              label: 'myFn',
              kind: 'function',
              detail: 'test completion',
              documentation: null,
              insert_text: 'myFn()',
            },
          ];
        case 'lsp_hover':
          return { contents: 'hover docs' };
        case 'lsp_goto_definition':
          return {
            uri: 'file:///tmp/test.ts',
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 5 },
            },
          };
        case 'lsp_get_diagnostics':
          return [
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 3 },
              },
              severity: 'warning',
              message: 'test warning',
              code: null,
              source: 'kyro-lsp',
            },
          ];
        default:
          return null;
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    invoke.mockReset();
  });

  it('registers providers and calls lsp_* backend commands', async () => {
    const completionProviders: Array<{
      provideCompletionItems: (
        model: { getValue: () => string; getWordUntilPosition: () => { word: string; startColumn: number; endColumn: number } },
        position: { lineNumber: number; column: number }
      ) => Promise<unknown>;
    }> = [];

    const definitionProviders: Array<{ provideDefinition: (model: unknown, position: { lineNumber: number; column: number }) => Promise<unknown> }> = [];
    const hoverProviders: Array<{ provideHover: (model: unknown, position: { lineNumber: number; column: number }) => Promise<unknown> }> = [];
    let contentChangeCb: (() => void) | null = null;

    const monacoStub = {
      languages: {
        registerCompletionItemProvider: (_selector: unknown, provider: unknown) => {
          completionProviders.push(provider as never);
          return { dispose: vi.fn() };
        },
        registerDefinitionProvider: (_selector: unknown, provider: unknown) => {
          definitionProviders.push(provider as never);
          return { dispose: vi.fn() };
        },
        registerHoverProvider: (_selector: unknown, provider: unknown) => {
          hoverProviders.push(provider as never);
          return { dispose: vi.fn() };
        },
      },
      editor: {
        setModelMarkers: vi.fn(),
      },
      MarkerSeverity: {
        Error: 8,
        Warning: 4,
        Info: 2,
        Hint: 1,
      },
      KeyMod: {
        Alt: 1,
        Shift: 2,
      },
      KeyCode: {
        KeyF: 33,
        KeyS: 49,
      },
      Range: class {
        constructor(
          public startLineNumber: number,
          public startColumn: number,
          public endLineNumber: number,
          public endColumn: number
        ) {}
      },
      Uri: {
        parse: (input: string) => ({ toString: () => input }),
        file: (path: string) => ({ toString: () => `file://${path.replace(/\\/g, '/')}` }),
      },
    } as unknown as typeof monaco;

    const model = {
      getValue: () => 'const x = 1;',
      getWordUntilPosition: () => ({ word: 'x', startColumn: 7, endColumn: 8 }),
      pushEditOperations: vi.fn(),
    };

    const editor = {
      getModel: () => model,
      onDidChangeModelContent: (cb: () => void) => {
        contentChangeCb = cb;
        return { dispose: vi.fn() };
      },
      addAction: () => ({ dispose: vi.fn() }),
      addCommand: vi.fn(),
    } as unknown as monaco.editor.IStandaloneCodeEditor;

    const cleanup = registerLspProviders(
      monacoStub,
      editor,
      () => 'C:\\repo\\src\\main.ts',
      () => 'typescript'
    );

    expect(completionProviders.length).toBe(1);
    expect(definitionProviders.length).toBe(1);
    expect(hoverProviders.length).toBe(1);

    await completionProviders[0].provideCompletionItems(model, { lineNumber: 1, column: 8 });
    await definitionProviders[0].provideDefinition({}, { lineNumber: 1, column: 8 });
    await hoverProviders[0].provideHover({}, { lineNumber: 1, column: 8 });

    contentChangeCb?.();
    vi.advanceTimersByTime(600);
    await Promise.resolve();

    expect(invoke).toHaveBeenCalledWith('lsp_start_server', expect.any(Object));
    expect(invoke).toHaveBeenCalledWith('lsp_get_completions', expect.any(Object));
    expect(invoke).toHaveBeenCalledWith('lsp_goto_definition', expect.any(Object));
    expect(invoke).toHaveBeenCalledWith('lsp_hover', expect.any(Object));
    expect(invoke).toHaveBeenCalledWith('lsp_get_diagnostics', expect.any(Object));

    cleanup();
  });
});
