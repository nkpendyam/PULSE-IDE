/**
 * Kyro IDE - TypeScript Language Service
 * Provides real code intelligence using Monaco's built-in TypeScript support
 * enhanced with additional features
 */

import * as monaco from 'monaco-editor';

// ============================================================================
// TYPES
// ============================================================================

export interface Definition {
  uri: string;
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

export interface Completion {
  label: string;
  kind: monaco.languages.CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText: string;
  sortText?: string;
}

export interface Diagnostic {
  uri: string;
  range: monaco.IRange;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source?: string;
  code?: string | number;
}

export interface Symbol {
  name: string;
  kind: monaco.languages.SymbolKind;
  range: monaco.IRange;
  selectionRange: monaco.IRange;
  uri: string;
  children?: Symbol[];
}

export interface HoverInfo {
  contents: monaco.IMarkdownString[];
  range?: monaco.IRange;
}

// ============================================================================
// TYPESCRIPT LANGUAGE SERVICE
// ============================================================================

class TypeScriptLanguageService {
  private initialized = false;
  private models: Map<string, monaco.editor.ITextModel> = new Map();
  private diagnostics: Map<string, Diagnostic[]> = new Map();
  private onDiagnosticsChanged: ((uri: string, diagnostics: Diagnostic[]) => void) | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Configure TypeScript defaults
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowNonTsExtensions: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      strict: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      jsxImportSource: 'react',
      lib: ['esnext', 'dom', 'dom.iterable'],
      noEmit: true,
      skipLibCheck: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      isolatedModules: true,
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowNonTsExtensions: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      jsxImportSource: 'react',
      lib: ['esnext', 'dom', 'dom.iterable'],
      noEmit: true,
      skipLibCheck: true,
    });

    // Add React typings
    const reactDeclarations = `
      declare module 'react' {
        export function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
        export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
        export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
        export function useMemo<T>(factory: () => T, deps: any[]): T;
        export function useRef<T>(initial: T): { current: T };
        export function useContext<T>(context: React.Context<T>): T;
        export function useReducer<S, A>(reducer: (state: S, action: A) => S, initial: S): [S, (action: A) => void];
        export function memo<P>(component: React.FunctionComponent<P>, propsAreEqual?: (prevProps: P, nextProps: P) => boolean): React.FunctionComponent<P>;
        export function createContext<T>(defaultValue: T): React.Context<T>;
        export function forwardRef<T, P = {}>(render: (props: P, ref: React.Ref<T>) => React.ReactNode): React.ForwardRefExoticComponent<P & React.RefAttributes<T>>;
        export interface Context<T> {
          Provider: React.Provider<T>;
          Consumer: React.Consumer<T>;
        }
        export interface FunctionComponent<P = {}> {
          (props: P & { children?: React.ReactNode }): React.ReactNode;
        }
        export type ReactNode = string | number | boolean | null | undefined | ReactElement | ReactFragment | ReactPortal;
        export interface ReactElement { type: any; props: any; key: any; }
        export type ReactFragment = Iterable<ReactNode>;
        export interface ReactPortal extends ReactElement {}
        export type Provider<T> = React.FunctionComponent<{ value: T; children?: ReactNode }>;
        export type Consumer<T> = React.FunctionComponent<{ children: (value: T) => ReactNode }>;
        export type Ref<T> = { current: T } | ((instance: T) => void) | null;
        export interface RefAttributes<T> { ref?: Ref<T>; }
        export interface Attributes { key?: string | number; }
        export interface HTMLAttributes<T> extends Attributes {
          children?: ReactNode;
          className?: string;
          id?: string;
          style?: React.CSSProperties;
          onClick?: (event: React.MouseEvent<T>) => void;
          onChange?: (event: React.ChangeEvent<T>) => void;
          onSubmit?: (event: React.FormEvent<T>) => void;
          onMouseEnter?: (event: React.MouseEvent<T>) => void;
          onMouseLeave?: (event: React.MouseEvent<T>) => void;
          onFocus?: (event: React.FocusEvent<T>) => void;
          onBlur?: (event: React.FocusEvent<T>) => void;
          onKeyDown?: (event: React.KeyboardEvent<T>) => void;
          onKeyUp?: (event: React.KeyboardEvent<T>) => void;
          disabled?: boolean;
          placeholder?: string;
          value?: string | number | readonly string[];
          type?: string;
          name?: string;
          href?: string;
          target?: string;
          rel?: string;
          src?: string;
          alt?: string;
          width?: number | string;
          height?: number | string;
        }
        export interface CSSProperties { [key: string]: string | number | undefined; }
        export interface MouseEvent<T = Element> extends SyntheticEvent<T> { clientX: number; clientY: number; button: number; }
        export interface ChangeEvent<T = Element> extends SyntheticEvent<T> { target: EventTarget & T; }
        export interface FormEvent<T = Element> extends SyntheticEvent<T> {}
        export interface FocusEvent<T = Element> extends SyntheticEvent<T> {}
        export interface KeyboardEvent<T = Element> extends SyntheticEvent<T> { key: string; code: string; keyCode: number; }
        export interface SyntheticEvent<T = Element> { bubbles: boolean; cancelable: boolean; preventDefault(): void; stopPropagation(): void; }
      }
      declare module 'react-dom/client' {
        export function createRoot(container: Element | DocumentFragment): { render: (node: React.ReactNode) => void; unmount: () => void; };
      }
    `;

    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      reactDeclarations,
      'file:///node_modules/@types/react/index.d.ts'
    );

    // Add Next.js typings
    const nextDeclarations = `
      declare module 'next' {
        export default function next(options: { dev?: boolean; dir?: string }): Promise<{ prepare(): Promise<void>; getRequestHandler(): any }>;
      }
      declare module 'next/router' {
        export function useRouter(): { pathname: string; query: Record<string, string>; push(url: string): void; replace(url: string): void; back(): void; };
      }
      declare module 'next/link' {
        import { FunctionComponent, AnchorHTMLAttributes } from 'react';
        const Link: FunctionComponent<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; replace?: boolean }>;
        export default Link;
      }
      declare module 'next/image' {
        import { FunctionComponent, ImgHTMLAttributes } from 'react';
        const Image: FunctionComponent<ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string; width?: number; height?: number; fill?: boolean; priority?: boolean }>;
        export default Image;
      }
    `;

    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      nextDeclarations,
      'file:///node_modules/@types/next/index.d.ts'
    );

    // Enable validation
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    this.initialized = true;
  }

  // Register a model
  registerModel(model: monaco.editor.ITextModel, language: string): void {
    const uri = model.uri.toString();
    this.models.set(uri, model);

    // Set up diagnostics listener
    model.onDidChangeContent(() => {
      this.validateModel(uri);
    });

    // Initial validation
    this.validateModel(uri);
  }

  // Remove a model
  removeModel(uri: string): void {
    this.models.delete(uri);
    this.diagnostics.delete(uri);
  }

  // Get completions
  async getCompletions(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<Completion[]> {
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn
    };

    // Use Monaco's built-in completion provider
    const providers = monaco.languages.getCompletionItems(model, position);
    
    // Return formatted completions
    return providers.suggestions.map(item => ({
      label: typeof item.label === 'string' ? item.label : item.label.label,
      kind: item.kind,
      detail: item.detail,
      documentation: item.documentation?.toString(),
      insertText: typeof item.insertText === 'string' ? item.insertText : item.insertText.value,
      sortText: item.sortText
    }));
  }

  // Get definition (go to definition)
  async getDefinition(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<Definition[]> {
    // Use Monaco's built-in definition provider
    const definitions = await monaco.languages.getDefinition(model, position);
    
    return definitions.map(def => ({
      uri: def.uri.toString(),
      range: {
        startLineNumber: def.range.startLineNumber,
        startColumn: def.range.startColumn,
        endLineNumber: def.range.endLineNumber,
        endColumn: def.range.endColumn
      }
    }));
  }

  // Get hover information
  async getHover(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<HoverInfo | null> {
    const hover = await monaco.languages.getHover(model, position);
    
    if (!hover) return null;

    return {
      contents: Array.isArray(hover.contents) 
        ? hover.contents.map(c => typeof c === 'string' ? { value: c } : c as monaco.IMarkdownString)
        : [{ value: hover.contents.toString() }],
      range: hover.range
    };
  }

  // Get references
  async getReferences(
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<Definition[]> {
    const references = await monaco.languages.getReferences(model, position);
    
    return (references || []).map(ref => ({
      uri: ref.uri.toString(),
      range: {
        startLineNumber: ref.range.startLineNumber,
        startColumn: ref.range.startColumn,
        endLineNumber: ref.range.endLineNumber,
        endColumn: ref.range.endColumn
      }
    }));
  }

  // Get document symbols
  async getSymbols(model: monaco.editor.ITextModel): Promise<Symbol[]> {
    const symbols = await monaco.languages.getOutlineSymbols(model);
    
    return (symbols || []).map(sym => ({
      name: sym.name,
      kind: sym.kind,
      range: sym.range,
      selectionRange: sym.selectionRange,
      uri: model.uri.toString(),
      children: sym.children ? this.mapSymbols(sym.children, model.uri.toString()) : undefined
    }));
  }

  // Get diagnostics
  getDiagnostics(uri: string): Diagnostic[] {
    return this.diagnostics.get(uri) || [];
  }

  // Set diagnostics callback
  setDiagnosticsCallback(callback: (uri: string, diagnostics: Diagnostic[]) => void): void {
    this.onDiagnosticsChanged = callback;
  }

  // Format document
  async formatDocument(
    model: monaco.editor.ITextModel,
    options: { tabSize: number; insertSpaces: boolean } = { tabSize: 2, insertSpaces: true }
  ): Promise<monaco.editor.IIdentifiedSingleEditOperation[]> {
    const edits = await monaco.languages.getFormatEdits(model, {
      tabSize: options.tabSize,
      insertSpaces: options.insertSpaces
    });
    
    return edits || [];
  }

  // Rename symbol
  async renameSymbol(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    newName: string
  ): Promise<{ uri: string; edits: monaco.editor.IIdentifiedSingleEditOperation[] }[]> {
    const rename = await monaco.languages.getRenameEdits(model, position, newName);
    
    if (!rename) return [];
    
    return Object.entries(rename.edits).map(([uri, edits]) => ({
      uri,
      edits
    }));
  }

  // Private: Validate model
  private validateModel(uri: string): void {
    const model = this.models.get(uri);
    if (!model) return;

    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    
    const diagnostics: Diagnostic[] = markers.map(marker => ({
      uri,
      range: {
        startLineNumber: marker.startLineNumber,
        startColumn: marker.startColumn,
        endLineNumber: marker.endLineNumber,
        endColumn: marker.endColumn
      },
      message: marker.message,
      severity: this.mapSeverity(marker.severity),
      source: marker.source,
      code: marker.code
    }));

    this.diagnostics.set(uri, diagnostics);
    this.onDiagnosticsChanged?.(uri, diagnostics);
  }

  // Private: Map severity
  private mapSeverity(severity: monaco.MarkerSeverity): Diagnostic['severity'] {
    switch (severity) {
      case monaco.MarkerSeverity.Error: return 'error';
      case monaco.MarkerSeverity.Warning: return 'warning';
      case monaco.MarkerSeverity.Info: return 'info';
      default: return 'hint';
    }
  }

  // Private: Map symbols recursively
  private mapSymbols(symbols: monaco.languages.DocumentSymbol[], uri: string): Symbol[] {
    return symbols.map(sym => ({
      name: sym.name,
      kind: sym.kind,
      range: sym.range,
      selectionRange: sym.selectionRange,
      uri,
      children: sym.children ? this.mapSymbols(sym.children, uri) : undefined
    }));
  }
}

// Export singleton
export const tsLanguageService = new TypeScriptLanguageService();
