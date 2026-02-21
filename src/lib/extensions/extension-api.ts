/**
 * Kyro IDE - Extension API
 * VS Code-compatible API surface for extensions
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface Disposable {
  dispose(): void;
}

export interface Event<T> {
  (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
}

export interface CancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested: Event<any>;
}

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

export interface TextDocument {
  uri: string;
  fileName: string;
  languageId: string;
  version: number;
  lineCount: number;
  getText(range?: Range): string;
  lineAt(line: number): TextLine;
  positionAt(offset: number): Position;
  offsetAt(position: Position): number;
  getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
  validatePosition(position: Position): Position;
  validateRange(range: Range): Range;
  save(): Promise<boolean>;
}

export interface TextLine {
  lineNumber: number;
  text: string;
  range: Range;
  rangeIncludingLineBreak: Range;
  firstNonWhitespaceCharacterIndex: number;
  isEmptyOrWhitespace: boolean;
}

export interface TextEditor {
  document: TextDocument;
  selection: Selection;
  selections: Selection[];
  visibleRanges: Range[];
  options: TextEditorOptions;
  viewColumn?: number;
  edit(callback: (editBuilder: TextEditorEdit) => void, options?: { undoStopBefore: boolean; undoStopAfter: boolean }): Promise<boolean>;
  insertSnippet(snippet: SnippetString, location?: Position | Range | Position[] | Range[]): Promise<boolean>;
  setDecorations(decorationType: TextEditorDecorationType, rangesOrOptions: Range[] | DecorationOptions[]): void;
  revealRange(range: Range, revealType?: TextEditorRevealType): void;
  show(column?: number): void;
  hide(): void;
}

export interface Selection extends Range {
  anchor: Position;
  active: Position;
  isReversed: boolean;
}

export interface TextEditorOptions {
  tabSize?: number | string;
  insertSpaces?: boolean | string;
  cursorStyle?: 'Line' | 'Block' | 'Underline' | 'LineThin' | 'BlockOutline' | 'UnderlineThin';
  cursorBlinking?: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  lineNumbers?: 'on' | 'off' | 'relative' | 'interval';
  glyphMargin?: boolean;
  minimap?: { enabled?: boolean; scale?: number };
  wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  wordWrapColumn?: number;
  wrappingIndent?: 'none' | 'same' | 'indent' | 'deepIndent';
  renderWhitespace?: 'none' | 'boundary' | 'selection' | 'all';
  renderLineHighlight?: 'none' | 'line' | 'all';
  fontSize?: number;
  fontFamily?: string;
}

export interface TextEditorEdit {
  replace(location: Position | Range | Selection, value: string): void;
  insert(location: Position, value: string): void;
  delete(location: Range | Selection): void;
  setEndOfLine(endOfLine: EndOfLine): void;
}

export enum EndOfLine {
  LF = 1,
  CRLF = 2
}

export interface TextEditorDecorationType {
  key: string;
  dispose(): void;
}

export interface DecorationOptions {
  range: Range;
  hoverMessage?: string | MarkdownString;
  renderOptions?: DecorationInstanceRenderOptions;
}

export interface DecorationInstanceRenderOptions {
  before?: ThemableDecorationAttachmentRenderOptions;
  after?: ThemableDecorationAttachmentRenderOptions;
}

export interface ThemableDecorationAttachmentRenderOptions {
  contentText?: string;
  color?: string;
  backgroundColor?: string;
  border?: string;
}

export interface MarkdownString {
  value: string;
  isTrusted?: boolean;
  supportThemeIcons?: boolean;
  supportHtml?: boolean;
}

export class SnippetString {
  value: string;
  
  constructor(value?: string) {
    this.value = value || '';
  }

  appendText(text: string): SnippetString {
    this.value += text.replace(/\$|}|\\/g, '\\$&');
    return this;
  }

  appendTabstop(tabStop?: number): SnippetString {
    this.value += '$' + (tabStop || '');
    return this;
  }

  appendPlaceholder(value: string | ((snippet: SnippetString) => void), number?: number): SnippetString {
    if (typeof value === 'function') {
      const snippet = new SnippetString();
      value(snippet);
      this.value += '${' + (number || '') + ':' + snippet.value + '}';
    } else {
      this.value += '${' + (number || '') + ':' + value + '}';
    }
    return this;
  }

  appendVariable(name: string, defaultValue?: string | ((snippet: SnippetString) => void)): SnippetString {
    if (typeof defaultValue === 'function') {
      const snippet = new SnippetString();
      defaultValue(snippet);
      this.value += '${' + name + ':' + snippet.value + '}';
    } else if (defaultValue) {
      this.value += '${' + name + ':' + defaultValue + '}';
    } else {
      this.value += '${' + name + '}';
    }
    return this;
  }
}

export enum TextEditorRevealType {
  Default = 0,
  InCenter = 1,
  InCenterIfOutsideViewport = 2,
  AtTop = 3
}

// ============================================================================
// WORKSPACE API
// ============================================================================

export interface WorkspaceFolder {
  uri: string;
  name: string;
  index: number;
}

export interface WorkspaceEdit {
  createFile(uri: string, options?: { overwrite?: boolean; ignoreIfExists?: boolean }): void;
  deleteFile(uri: string, options?: { recursive?: boolean; ignoreIfNotExists?: boolean }): void;
  renameFile(oldUri: string, newUri: string, options?: { overwrite?: boolean; ignoreIfExists?: boolean }): void;
  replace(uri: string, range: Range, value: string): void;
  insert(uri: string, position: Position, value: string): void;
  delete(uri: string, range: Range): void;
}

export interface WorkspaceConfiguration {
  get<T>(section: string, defaultValue?: T): T;
  has(section: string): boolean;
  update(section: string, value: any, configurationTarget?: boolean): Promise<void>;
  inspect<T>(section: string): { key: string; globalValue?: T; workspaceValue?: T; workspaceFolderValue?: T } | undefined;
}

class WorkspaceAPI {
  private workspaceFolders: WorkspaceFolder[] = [];
  private configuration: Map<string, Map<string, any>> = new Map();

  get rootPath(): string | undefined {
    return this.workspaceFolders[0]?.uri;
  }

  get workspaceFolders(): readonly WorkspaceFolder[] {
    return this.workspaceFolders;
  }

  getConfiguration(section?: string, scope?: any): WorkspaceConfiguration {
    const config = this.configuration.get(section || '') || new Map();
    
    return {
      get: <T>(key: string, defaultValue?: T): T => {
        return config.get(key) ?? defaultValue as T;
      },
      has: (key: string): boolean => {
        return config.has(key);
      },
      update: async (key: string, value: any): Promise<void> => {
        config.set(key, value);
      },
      inspect: <T>(key: string) => {
        return { key, globalValue: config.get(key) as T, workspaceValue: config.get(key) as T };
      }
    };
  }

  onDidChangeConfiguration: Event<any> = (listener) => {
    const emitter = new EventEmitter();
    emitter.on('change', listener);
    return { dispose: () => emitter.removeAllListeners() };
  };

  onDidChangeWorkspaceFolders: Event<any> = (listener) => {
    const emitter = new EventEmitter();
    emitter.on('change', listener);
    return { dispose: () => emitter.removeAllListeners() };
  };
}

// ============================================================================
// WINDOW API
// ============================================================================

export interface OutputChannel {
  name: string;
  append(value: string): void;
  appendLine(value: string): void;
  clear(): void;
  show(preserveFocus?: boolean): void;
  hide(): void;
  dispose(): void;
}

export interface Terminal {
  name: string;
  processId: Promise<number | undefined>;
  sendText(text: string, addNewLine?: boolean): void;
  show(preserveFocus?: boolean): void;
  hide(): void;
  dispose(): void;
}

export interface TerminalOptions {
  name?: string;
  shellPath?: string;
  shellArgs?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface InputBoxOptions {
  value?: string;
  valueSelection?: [number, number];
  prompt?: string;
  placeHolder?: string;
  password?: boolean;
  ignoreFocusOut?: boolean;
  validateInput?: (value: string) => string | undefined | Promise<string | undefined>;
}

export interface QuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
  alwaysShow?: boolean;
}

export interface QuickPickOptions {
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
  placeHolder?: string;
  ignoreFocusOut?: boolean;
  canPickMany?: boolean;
  onDidSelectItem?: (item: QuickPickItem | string) => any;
}

class WindowAPI {
  private outputChannels: Map<string, OutputChannel> = new Map();
  private terminals: Terminal[] = [];

  get activeTextEditor(): TextEditor | undefined {
    // Would be implemented by editor integration
    return undefined;
  }

  get visibleTextEditors(): readonly TextEditor[] {
    return [];
  }

  showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
    console.log('[INFO]', message);
    return Promise.resolve(items[0]);
  }

  showWarningMessage(message: string, ...items: string[]): Promise<string | undefined> {
    console.log('[WARN]', message);
    return Promise.resolve(items[0]);
  }

  showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
    console.log('[ERROR]', message);
    return Promise.resolve(items[0]);
  }

  showInputBox(options?: InputBoxOptions): Promise<string | undefined> {
    return Promise.resolve(options?.value);
  }

  showQuickPick(items: readonly QuickPickItem[] | readonly string[], options?: QuickPickOptions): Promise<QuickPickItem | QuickPickItem[] | string | string[] | undefined> {
    const item = Array.isArray(items) ? items[0] : undefined;
    return Promise.resolve(typeof item === 'string' ? item : item as QuickPickItem);
  }

  createOutputChannel(name: string): OutputChannel {
    let channel = this.outputChannels.get(name);
    if (!channel) {
      channel = {
        name,
        append: (value: string) => console.log(`[${name}]`, value),
        appendLine: (value: string) => console.log(`[${name}]`, value),
        clear: () => {},
        show: () => {},
        hide: () => {},
        dispose: () => this.outputChannels.delete(name),
      };
      this.outputChannels.set(name, channel);
    }
    return channel;
  }

  createTerminal(options?: TerminalOptions): Terminal {
    const terminal: Terminal = {
      name: options?.name || 'Terminal',
      processId: Promise.resolve(undefined),
      sendText: (text: string) => console.log('[Terminal]', text),
      show: () => {},
      hide: () => {},
      dispose: () => {},
    };
    this.terminals.push(terminal);
    return terminal;
  }

  withProgress<R>(
    options: { title: string; cancellable?: boolean; location?: number },
    task: (progress: { report: (value: { message?: string; increment?: number }) => void }, token: CancellationToken) => Promise<R>
  ): Promise<R> {
    console.log('[Progress]', options.title);
    const progress = { report: (value: { message?: string; increment?: number }) => console.log(value) };
    const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };
    return task(progress, token);
  }

  onDidChangeActiveTextEditor: Event<TextEditor | undefined> = (listener) => {
    return { dispose: () => {} };
  };

  onDidChangeVisibleTextEditors: Event<readonly TextEditor[]> = (listener) => {
    return { dispose: () => {} };
  };
}

// ============================================================================
// COMMANDS API
// ============================================================================

interface Command {
  id: string;
  title: string;
  handler: (...args: any[]) => any;
}

class CommandsAPI {
  private commands: Map<string, Command> = new Map();

  registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable {
    this.commands.set(command, {
      id: command,
      title: command,
      handler: thisArg ? callback.bind(thisArg) : callback,
    });

    return { dispose: () => this.commands.delete(command) };
  }

  registerTextEditorCommand(command: string, callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void, thisArg?: any): Disposable {
    return this.registerCommand(command, callback, thisArg);
  }

  executeCommand<T>(command: string, ...args: any[]): Promise<T> {
    const cmd = this.commands.get(command);
    if (cmd) {
      return Promise.resolve(cmd.handler(...args));
    }
    return Promise.reject(new Error(`Command not found: ${command}`));
  }

  getCommands(filterInternal?: boolean): Promise<string[]> {
    return Promise.resolve(Array.from(this.commands.keys()));
  }
}

// ============================================================================
// LANGUAGES API
// ============================================================================

export interface CompletionItem {
  label: string | { label: string; description?: string; detail?: string };
  kind?: CompletionItemKind;
  tags?: CompletionItemTag[];
  detail?: string;
  documentation?: string | MarkdownString;
  sortText?: string;
  filterText?: string;
  insertText?: string | SnippetString;
  keepWhitespace?: boolean;
  range?: Range | { inserting: Range; replacing: Range };
  commitCharacters?: string[];
  additionalTextEdits?: TextEdit[];
  command?: Command;
  preselect?: boolean;
}

export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  Reference = 17,
  File = 16,
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
  Struct = 21,
  Event = 22,
  Operator = 23,
  TypeParameter = 24,
}

export enum CompletionItemTag {
  Deprecated = 1
}

export interface TextEdit {
  range: Range;
  newText: string;
}

export interface Command {
  title: string;
  command: string;
  arguments?: any[];
}

export interface Diagnostic {
  range: Range;
  message: string;
  severity?: DiagnosticSeverity;
  code?: string | number;
  source?: string;
  relatedInformation?: DiagnosticRelatedInformation[];
  tags?: DiagnosticTag[];
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3
}

export enum DiagnosticTag {
  Unnecessary = 1,
  Deprecated = 2
}

export interface DiagnosticRelatedInformation {
  location: Location;
  message: string;
}

export interface CodeAction {
  title: string;
  edit?: WorkspaceEdit;
  diagnostics?: Diagnostic[];
  command?: Command;
  kind?: CodeActionKind;
  isPreferred?: boolean;
}

export class CodeActionKind {
  public static readonly Empty = new CodeActionKind('empty');
  public static readonly QuickFix = new CodeActionKind('quickfix');
  public static readonly Refactor = new CodeActionKind('refactor');
  public static readonly RefactorExtract = new CodeActionKind('refactor.extract');
  public static readonly RefactorInline = new CodeActionKind('refactor.inline');
  public static readonly RefactorRewrite = new CodeActionKind('refactor.rewrite');
  public static readonly Source = new CodeActionKind('source');
  public static readonly SourceOrganizeImports = new CodeActionKind('source.organizeImports');
  public static readonly SourceFixAll = new CodeActionKind('source.fixAll');

  constructor(public readonly value: string) {}

  contains(other: CodeActionKind): boolean {
    return other.value.startsWith(this.value);
  }

  intersects(other: CodeActionKind): boolean {
    return this.contains(other) || other.contains(this);
  }
}

class LanguagesAPI {
  private completionProviders: Map<string, Set<any>> = new Map();
  private diagnosticCollections: Map<string, any> = new Map();

  registerCompletionItemProvider(
    selector: string | { language?: string; scheme?: string; pattern?: string },
    provider: {
      provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): CompletionItem[] | Promise<CompletionItem[]>;
      resolveCompletionItem?(item: CompletionItem, token: CancellationToken): CompletionItem | Promise<CompletionItem>;
    },
    ...triggerCharacters: string[]
  ): Disposable {
    const languageId = typeof selector === 'string' ? selector : selector.language || '*';
    
    if (!this.completionProviders.has(languageId)) {
      this.completionProviders.set(languageId, new Set());
    }
    this.completionProviders.get(languageId)!.add(provider);

    return {
      dispose: () => {
        this.completionProviders.get(languageId)?.delete(provider);
      }
    };
  }

  registerHoverProvider(
    selector: string | { language?: string; scheme?: string; pattern?: string },
    provider: {
      provideHover(document: TextDocument, position: Position, token: CancellationToken): { contents: MarkdownString[] } | undefined | Promise<{ contents: MarkdownString[] } | undefined>;
    }
  ): Disposable {
    return { dispose: () => {} };
  }

  registerDefinitionProvider(
    selector: string | { language?: string; scheme?: string; pattern?: string },
    provider: {
      provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Definition | Location[] | undefined | Promise<Definition | Location[] | undefined>;
    }
  ): Disposable {
    return { dispose: () => {} };
  }

  registerReferenceProvider(
    selector: string | { language?: string; scheme?: string; pattern?: string },
    provider: {
      provideReferences(document: TextDocument, position: Position, context: { includeDeclaration: boolean }, token: CancellationToken): Location[] | undefined | Promise<Location[] | undefined>;
    }
  ): Disposable {
    return { dispose: () => {} };
  }

  registerDocumentSymbolProvider(
    selector: string | { language?: string; scheme?: string; pattern?: string },
    provider: {
      provideDocumentSymbols(document: TextDocument, token: CancellationToken): SymbolInformation[] | DocumentSymbol[] | undefined | Promise<SymbolInformation[] | DocumentSymbol[] | undefined>;
    }
  ): Disposable {
    return { dispose: () => {} };
  }

  registerCodeActionsProvider(
    selector: string | { language?: string; scheme?: string; pattern?: string },
    provider: {
      provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext, token: CancellationToken): CodeAction[] | undefined | Promise<CodeAction[] | undefined>;
    },
    metadata?: { providedCodeActionKinds?: CodeActionKind[] }
  ): Disposable {
    return { dispose: () => {} };
  }

  createDiagnosticCollection(name: string): DiagnosticCollection {
    return {
      name,
      set: (uri: string, diagnostics: Diagnostic[]) => {},
      delete: (uri: string) => {},
      clear: () => {},
      dispose: () => this.diagnosticCollections.delete(name),
    };
  }

  getDiagnostics(uri?: string): Diagnostic[] {
    return [];
  }
}

export interface Definition {
  uri: string;
  range: Range;
}

export interface SymbolInformation {
  name: string;
  kind: SymbolKind;
  location: Location;
  containerName?: string;
}

export interface DocumentSymbol {
  name: string;
  detail?: string;
  kind: SymbolKind;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}

export enum SymbolKind {
  File = 0,
  Module = 1,
  Namespace = 2,
  Package = 3,
  Class = 4,
  Method = 5,
  Property = 6,
  Field = 7,
  Constructor = 8,
  Enum = 9,
  Interface = 10,
  Function = 11,
  Variable = 12,
  Constant = 13,
  String = 14,
  Number = 15,
  Boolean = 16,
  Array = 17,
  Object = 18,
  Key = 19,
  Null = 20,
  EnumMember = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

export interface CodeActionContext {
  diagnostics: Diagnostic[];
  only?: CodeActionKind[];
  triggerKind: CodeActionTriggerKind;
}

export enum CodeActionTriggerKind {
  Invoke = 1,
  Automatic = 2,
}

export interface DiagnosticCollection {
  readonly name: string;
  set(uri: string, diagnostics: Diagnostic[]): void;
  delete(uri: string): void;
  clear(): void;
  dispose(): void;
}

// ============================================================================
// EXPORT API OBJECTS
// ============================================================================

export const workspace = new WorkspaceAPI();
export const window = new WindowAPI();
export const commands = new CommandsAPI();
export const languages = new LanguagesAPI();

// Version info
export const version = '2.0.0';

// Environment
export const env = {
  appName: 'Kyro IDE',
  appRoot: '/',
  language: 'en',
  clipboard: {
    readText: () => navigator.clipboard.readText(),
    writeText: (text: string) => navigator.clipboard.writeText(text),
  },
  openExternal: (uri: string) => window.open(uri, '_blank'),
  uiKind: 2, // Web
};

// URI helper
export const Uri = {
  parse: (value: string) => ({ toString: () => value, path: value, fsPath: value }),
  file: (path: string) => ({ toString: () => `file://${path}`, path, fsPath: path }),
  joinPath: (base: { path: string }, ...pathSegments: string[]) => {
    const path = [base.path, ...pathSegments].join('/').replace(/\/+/g, '/');
    return { toString: () => `file://${path}`, path, fsPath: path };
  },
};

// EventEmitter helper
export class EventEmitter<T> {
  private listeners: ((e: T) => any)[] = [];

  event: Event<T> = (listener) => {
    this.listeners.push(listener);
    return { dispose: () => this.listeners = this.listeners.filter(l => l !== listener) };
  };

  fire(data: T): void {
    this.listeners.forEach(l => l(data));
  }

  dispose(): void {
    this.listeners = [];
  }
}
