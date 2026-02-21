// Kyro IDE - LSP Client Integration
// Language Server Protocol support for IntelliSense
// Implements LSP 3.17 specification with JSON-RPC 2.0

import { EventEmitter } from 'events';

// ============================================================================
// LSP PROTOCOL TYPES (LSP 3.17)
// ============================================================================

export interface LSPPosition {
  line: number;
  character: number;
}

export interface LSPRange {
  start: LSPPosition;
  end: LSPPosition;
}

export interface LSPDiagnostic {
  range: LSPRange;
  severity: 'error' | 'warning' | 'information' | 'hint';
  message: string;
  source?: string;
  code?: string | number;
  relatedInformation?: Array<{
    location: { uri: string; range: LSPRange };
    message: string;
  }>;
}

export interface LSPCompletion {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string | { kind: string; value: string };
  insertText?: string;
  insertTextFormat?: InsertTextFormat;
  sortText?: string;
  filterText?: string;
  preselect?: boolean;
  data?: unknown;
}

export interface LSPSymbol {
  name: string;
  kind: SymbolKind;
  range: LSPRange;
  selectionRange: LSPRange;
  children?: LSPSymbol[];
  detail?: string;
}

export interface LSPDefinition {
  uri: string;
  range: LSPRange;
}

export interface LSPHover {
  contents: string | { kind: string; value: string } | Array<string | { language: string; value: string }>;
  range?: LSPRange;
}

export interface LSPReference {
  uri: string;
  range: LSPRange;
}

export interface LSPSignatureHelp {
  signatures: Array<{
    label: string;
    documentation?: string;
    parameters?: Array<{
      label: string | [number, number];
      documentation?: string;
    }>;
  }>;
  activeSignature?: number;
  activeParameter?: number;
}

// LSP Enums
export enum CompletionItemKind {
  Text = 1,
  Method = 2,
  Function = 3,
  Constructor = 4,
  Field = 5,
  Variable = 6,
  Class = 7,
  Interface = 8,
  Module = 9,
  Property = 10,
  Unit = 11,
  Value = 12,
  Enum = 13,
  Keyword = 14,
  Snippet = 15,
  Color = 16,
  File = 17,
  Reference = 18,
  Folder = 19,
  EnumMember = 20,
  Constant = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

export enum SymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  Null = 21,
  EnumMember = 22,
  Struct = 23,
  Event = 24,
  Operator = 25,
  TypeParameter = 26,
}

export enum InsertTextFormat {
  PlainText = 1,
  Snippet = 2,
}

// ============================================================================
// JSON-RPC 2.0 TYPES
// ============================================================================

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// ============================================================================
// LSP CAPABILITIES
// ============================================================================

interface ClientCapabilities {
  textDocument: {
    synchronization: {
      dynamicRegistration?: boolean;
      willSave?: boolean;
      willSaveWaitUntil?: boolean;
      didSave?: boolean;
    };
    completion: {
      dynamicRegistration?: boolean;
      completionItem: {
        snippetSupport?: boolean;
        commitCharactersSupport?: boolean;
        documentationFormat?: string[];
        deprecatedSupport?: boolean;
        preselectSupport?: boolean;
      };
      contextSupport?: boolean;
    };
    hover: {
      dynamicRegistration?: boolean;
      contentFormat?: string[];
    };
    signatureHelp: {
      dynamicRegistration?: boolean;
      signatureInformation: {
        documentationFormat?: string[];
        parameterInformation?: {
          labelOffsetSupport?: boolean;
        };
      };
    };
    declaration?: { dynamicRegistration?: boolean; linkSupport?: boolean };
    definition?: { dynamicRegistration?: boolean; linkSupport?: boolean };
    typeDefinition?: { dynamicRegistration?: boolean; linkSupport?: boolean };
    implementation?: { dynamicRegistration?: boolean; linkSupport?: boolean };
    references?: { dynamicRegistration?: boolean };
    documentHighlight?: { dynamicRegistration?: boolean };
    documentSymbol?: {
      dynamicRegistration?: boolean;
      hierarchicalDocumentSymbolSupport?: boolean;
    };
    formatting?: { dynamicRegistration?: boolean };
    rangeFormatting?: { dynamicRegistration?: boolean };
    onTypeFormatting?: { dynamicRegistration?: boolean };
  };
  workspace: {
    symbol?: { dynamicRegistration?: boolean };
    workspaceFolders?: boolean;
    configuration?: boolean;
  };
}

interface ServerCapabilities {
  textDocumentSync?: number | {
    openClose?: boolean;
    change?: number;
    willSave?: boolean;
    willSaveWaitUntil?: boolean;
    save?: boolean | { includeText?: boolean };
  };
  completionProvider?: {
    triggerCharacters?: string[];
    allCommitCharacters?: string[];
    resolveProvider?: boolean;
  };
  hoverProvider?: boolean | { workDoneProgress?: boolean };
  signatureHelpProvider?: {
    triggerCharacters?: string[];
    retriggerCharacters?: string[];
  };
  declarationProvider?: boolean | { workDoneProgress?: boolean };
  definitionProvider?: boolean | { workDoneProgress?: boolean };
  typeDefinitionProvider?: boolean | { workDoneProgress?: boolean };
  implementationProvider?: boolean | { workDoneProgress?: boolean };
  referencesProvider?: boolean | { workDoneProgress?: boolean };
  documentHighlightProvider?: boolean | { workDoneProgress?: boolean };
  documentSymbolProvider?: boolean | { workDoneProgress?: boolean };
  workspaceSymbolProvider?: boolean | { workDoneProgress?: boolean };
  documentFormattingProvider?: boolean | { workDoneProgress?: boolean };
  documentRangeFormattingProvider?: boolean | { workDoneProgress?: boolean };
  renameProvider?: boolean | { prepareProvider?: boolean };
}

// ============================================================================
// TRANSPORT INTERFACES
// ============================================================================

interface Transport extends EventEmitter {
  connected: boolean;
  connect(): Promise<void>;
  send(message: JSONRPCRequest | JSONRPCNotification): void;
  close(): void;
}

// ============================================================================
// WEBSOCKET TRANSPORT
// ============================================================================

export class WebSocketTransport extends EventEmitter implements Transport {
  private ws: WebSocket | null = null;
  private url: string;
  connected = false;
  private messageQueue: string[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(url: string) {
    super();
    this.url = url;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.emit('message', message);
          } catch (e) {
            console.error('Failed to parse LSP message:', e);
          }
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          if (!this.connected) {
            reject(new Error('WebSocket connection failed'));
          }
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.emit('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect().catch(() => {});
      }, 1000 * this.reconnectAttempts);
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.connected) {
      const message = this.messageQueue.shift();
      if (message && this.ws) {
        this.ws.send(message);
      }
    }
  }

  send(message: JSONRPCRequest | JSONRPCNotification): void {
    const data = JSON.stringify(message);
    if (this.connected && this.ws) {
      this.ws.send(data);
    } else {
      this.messageQueue.push(data);
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }
}

// ============================================================================
// IN-MEMORY TRANSPORT (For Browser/Frontend Use)
// ============================================================================

export class InMemoryTransport extends EventEmitter implements Transport {
  connected = false;
  private serverHandler: ((message: unknown) => void) | null = null;
  private messageBuffer: unknown[] = [];

  setServerHandler(handler: (message: unknown) => void): void {
    this.serverHandler = handler;
    // Process buffered messages
    while (this.messageBuffer.length > 0) {
      const msg = this.messageBuffer.shift();
      if (msg) handler(msg);
    }
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.emit('connected');
  }

  send(message: JSONRPCRequest | JSONRPCNotification): void {
    if (this.serverHandler) {
      this.serverHandler(message);
    } else {
      this.messageBuffer.push(message);
    }
  }

  receive(message: JSONRPCResponse | JSONRPCNotification): void {
    this.emit('message', message);
  }

  close(): void {
    this.connected = false;
    this.emit('disconnected');
  }
}

// ============================================================================
// LSP CLIENT IMPLEMENTATION
// ============================================================================

export class LSPClient extends EventEmitter {
  private languageId: string;
  private transport: Transport;
  private requestId = 0;
  private pendingRequests = new Map<number | string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private serverCapabilities: ServerCapabilities | null = null;
  private initialized = false;
  private rootPath: string = '';
  private openDocuments = new Map<string, { version: number; languageId: string }>();
  private requestTimeout = 30000; // 30 seconds

  constructor(languageId: string, transport?: Transport) {
    super();
    this.languageId = languageId;
    this.transport = transport || new InMemoryTransport();

    // Set up message handler
    this.transport.on('message', (message: JSONRPCResponse | JSONRPCNotification) => {
      this.handleMessage(message);
    });

    this.transport.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.transport.on('disconnected', () => {
      this.emit('disconnected');
    });
  }

  // ==========================================================================
  // CONNECTION MANAGEMENT
  // ==========================================================================

  async connect(): Promise<void> {
    await this.transport.connect();
    this.emit('connected');
  }

  async initialize(rootPath: string): Promise<void> {
    this.rootPath = rootPath;

    if (!this.transport.connected) {
      await this.connect();
    }

    const clientCapabilities: ClientCapabilities = {
      textDocument: {
        synchronization: {
          dynamicRegistration: true,
          willSave: true,
          willSaveWaitUntil: true,
          didSave: true,
        },
        completion: {
          dynamicRegistration: true,
          completionItem: {
            snippetSupport: true,
            commitCharactersSupport: true,
            documentationFormat: ['markdown', 'plaintext'],
            deprecatedSupport: true,
            preselectSupport: true,
          },
          contextSupport: true,
        },
        hover: {
          dynamicRegistration: true,
          contentFormat: ['markdown', 'plaintext'],
        },
        signatureHelp: {
          dynamicRegistration: true,
          signatureInformation: {
            documentationFormat: ['markdown', 'plaintext'],
            parameterInformation: {
              labelOffsetSupport: true,
            },
          },
        },
        declaration: { dynamicRegistration: true, linkSupport: true },
        definition: { dynamicRegistration: true, linkSupport: true },
        typeDefinition: { dynamicRegistration: true, linkSupport: true },
        implementation: { dynamicRegistration: true, linkSupport: true },
        references: { dynamicRegistration: true },
        documentHighlight: { dynamicRegistration: true },
        documentSymbol: {
          dynamicRegistration: true,
          hierarchicalDocumentSymbolSupport: true,
        },
        formatting: { dynamicRegistration: true },
        rangeFormatting: { dynamicRegistration: true },
        onTypeFormatting: { dynamicRegistration: true },
      },
      workspace: {
        symbol: { dynamicRegistration: true },
        workspaceFolders: true,
        configuration: true,
      },
    };

    try {
      const result = await this.sendRequest('initialize', {
        processId: null,
        clientInfo: {
          name: 'Kyro IDE',
          version: '1.0.0',
        },
        rootPath: rootPath,
        rootUri: this.pathToUri(rootPath),
        capabilities: clientCapabilities,
        workspaceFolders: [
          {
            uri: this.pathToUri(rootPath),
            name: rootPath.split('/').pop() || 'workspace',
          },
        ],
      }) as { capabilities: ServerCapabilities };

      this.serverCapabilities = result.capabilities;
      this.initialized = true;

      // Send initialized notification
      this.sendNotification('initialized', {});

      this.emit('initialized', {
        languageId: this.languageId,
        capabilities: this.serverCapabilities
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // ==========================================================================
  // DOCUMENT MANAGEMENT
  // ==========================================================================

  async openDocument(uri: string, languageId: string, content: string): Promise<void> {
    const version = 1;
    this.openDocuments.set(uri, { version, languageId });

    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: this.pathToUri(uri),
        languageId: languageId,
        version: version,
        text: content,
      },
    });

    this.emit('documentOpened', { uri, languageId, content });
  }

  async closeDocument(uri: string): Promise<void> {
    this.openDocuments.delete(uri);

    this.sendNotification('textDocument/didClose', {
      textDocument: {
        uri: this.pathToUri(uri),
      },
    });

    this.emit('documentClosed', { uri });
  }

  async changeDocument(uri: string, content: string, version: number): Promise<void> {
    const docInfo = this.openDocuments.get(uri);
    if (docInfo) {
      docInfo.version = version;
    }

    // Determine sync kind from capabilities
    const syncKind = typeof this.serverCapabilities?.textDocumentSync === 'number'
      ? this.serverCapabilities.textDocumentSync
      : this.serverCapabilities?.textDocumentSync?.change ?? 1;

    this.sendNotification('textDocument/didChange', {
      textDocument: {
        uri: this.pathToUri(uri),
        version: version,
      },
      contentChanges: syncKind === 1
        ? [{ text: content }] // Full text sync
        : [], // Incremental sync would require computing diffs
    });

    this.emit('documentChanged', { uri, content, version });
  }

  async saveDocument(uri: string, text?: string): Promise<void> {
    const includeText = this.serverCapabilities?.textDocumentSync &&
      typeof this.serverCapabilities.textDocumentSync !== 'number' &&
      this.serverCapabilities.textDocumentSync.save &&
      typeof this.serverCapabilities.textDocumentSync.save === 'object' &&
      this.serverCapabilities.textDocumentSync.save.includeText;

    this.sendNotification('textDocument/didSave', {
      textDocument: {
        uri: this.pathToUri(uri),
      },
      ...(includeText && text ? { text } : {}),
    });
  }

  // ==========================================================================
  // COMPLETION
  // ==========================================================================

  async getCompletions(
    uri: string,
    position: LSPPosition,
    context?: { triggerCharacter?: string; triggerKind?: number }
  ): Promise<LSPCompletion[]> {
    if (!this.initialized || !this.serverCapabilities?.completionProvider) {
      return this.getFallbackCompletions(uri, position);
    }

    try {
      const result = await this.sendRequest('textDocument/completion', {
        textDocument: {
          uri: this.pathToUri(uri),
        },
        position: position,
        context: context ? {
          triggerKind: context.triggerKind ?? 1,
          triggerCharacter: context.triggerCharacter,
        } : undefined,
      }) as { items?: LSPCompletion[]; isIncomplete?: boolean } | LSPCompletion[];

      const items = Array.isArray(result) ? result : result.items || [];
      return items;
    } catch (error) {
      console.error('LSP completion error:', error);
      return this.getFallbackCompletions(uri, position);
    }
  }

  async resolveCompletion(item: LSPCompletion): Promise<LSPCompletion> {
    if (!this.serverCapabilities?.completionProvider?.resolveProvider) {
      return item;
    }

    try {
      return await this.sendRequest('completionItem/resolve', item) as LSPCompletion;
    } catch {
      return item;
    }
  }

  // ==========================================================================
  // DEFINITION
  // ==========================================================================

  async getDefinition(uri: string, position: LSPPosition): Promise<LSPDefinition[] | null> {
    if (!this.initialized || !this.serverCapabilities?.definitionProvider) {
      return this.getFallbackDefinition(uri, position);
    }

    try {
      const result = await this.sendRequest('textDocument/definition', {
        textDocument: {
          uri: this.pathToUri(uri),
        },
        position: position,
      });

      if (!result) return null;

      // Result can be a single location, array of locations, or array of location links
      const locations = Array.isArray(result) ? result : [result];

      return locations.map((loc: { uri?: string; targetUri?: string; range?: LSPRange; targetRange?: LSPRange }) => ({
        uri: this.uriToPath(loc.uri || loc.targetUri || ''),
        range: loc.range || loc.targetRange || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      }));
    } catch (error) {
      console.error('LSP definition error:', error);
      return this.getFallbackDefinition(uri, position);
    }
  }

  async getTypeDefinition(uri: string, position: LSPPosition): Promise<LSPDefinition[] | null> {
    if (!this.initialized || !this.serverCapabilities?.typeDefinitionProvider) {
      return null;
    }

    try {
      const result = await this.sendRequest('textDocument/typeDefinition', {
        textDocument: { uri: this.pathToUri(uri) },
        position,
      });

      if (!result) return null;
      const locations = Array.isArray(result) ? result : [result];

      return locations.map((loc: { uri?: string; targetUri?: string; range?: LSPRange; targetRange?: LSPRange }) => ({
        uri: this.uriToPath(loc.uri || loc.targetUri || ''),
        range: loc.range || loc.targetRange || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      }));
    } catch {
      return null;
    }
  }

  async getImplementation(uri: string, position: LSPPosition): Promise<LSPDefinition[] | null> {
    if (!this.initialized || !this.serverCapabilities?.implementationProvider) {
      return null;
    }

    try {
      const result = await this.sendRequest('textDocument/implementation', {
        textDocument: { uri: this.pathToUri(uri) },
        position,
      });

      if (!result) return null;
      const locations = Array.isArray(result) ? result : [result];

      return locations.map((loc: { uri?: string; targetUri?: string; range?: LSPRange; targetRange?: LSPRange }) => ({
        uri: this.uriToPath(loc.uri || loc.targetUri || ''),
        range: loc.range || loc.targetRange || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      }));
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // REFERENCES
  // ==========================================================================

  async getReferences(uri: string, position: LSPPosition, includeDeclaration = true): Promise<LSPReference[]> {
    if (!this.initialized || !this.serverCapabilities?.referencesProvider) {
      return this.getFallbackReferences(uri, position);
    }

    try {
      const result = await this.sendRequest('textDocument/references', {
        textDocument: {
          uri: this.pathToUri(uri),
        },
        position: position,
        context: {
          includeDeclaration: includeDeclaration,
        },
      }) as Array<{ uri: string; range: LSPRange }> | null;

      if (!result) return [];

      return result.map((loc) => ({
        uri: this.uriToPath(loc.uri),
        range: loc.range,
      }));
    } catch (error) {
      console.error('LSP references error:', error);
      return this.getFallbackReferences(uri, position);
    }
  }

  // ==========================================================================
  // HOVER
  // ==========================================================================

  async getHover(uri: string, position: LSPPosition): Promise<LSPHover | null> {
    if (!this.initialized || !this.serverCapabilities?.hoverProvider) {
      return this.getFallbackHover(uri, position);
    }

    try {
      const result = await this.sendRequest('textDocument/hover', {
        textDocument: {
          uri: this.pathToUri(uri),
        },
        position: position,
      }) as LSPHover | null;

      return result;
    } catch (error) {
      console.error('LSP hover error:', error);
      return this.getFallbackHover(uri, position);
    }
  }

  // ==========================================================================
  // SYMBOLS
  // ==========================================================================

  async getSymbols(uri: string): Promise<LSPSymbol[]> {
    if (!this.initialized || !this.serverCapabilities?.documentSymbolProvider) {
      return this.getFallbackSymbols(uri);
    }

    try {
      const result = await this.sendRequest('textDocument/documentSymbol', {
        textDocument: {
          uri: this.pathToUri(uri),
        },
      });

      if (!result) return [];

      // Handle both SymbolInformation[] and DocumentSymbol[] formats
      const symbols = Array.isArray(result) ? result : [];
      return symbols.map((sym: { name?: string; kind?: number; range?: LSPRange; selectionRange?: LSPRange; children?: unknown[]; location?: { range: LSPRange }; detail?: string }) => ({
        name: sym.name || '',
        kind: sym.kind || SymbolKind.Variable,
        range: sym.range || sym.location?.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        selectionRange: sym.selectionRange || sym.range || sym.location?.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        children: sym.children,
        detail: sym.detail,
      }));
    } catch (error) {
      console.error('LSP symbols error:', error);
      return this.getFallbackSymbols(uri);
    }
  }

  async getWorkspaceSymbols(query: string): Promise<LSPSymbol[]> {
    if (!this.initialized || !this.serverCapabilities?.workspaceSymbolProvider) {
      return [];
    }

    try {
      const result = await this.sendRequest('workspace/symbol', { query });

      if (!result) return [];

      const symbols = Array.isArray(result) ? result : [];
      return symbols.map((sym: { name?: string; kind?: number; location?: { uri: string; range: LSPRange }; range?: LSPRange; selectionRange?: LSPRange; detail?: string }) => ({
        name: sym.name || '',
        kind: sym.kind || SymbolKind.Variable,
        range: sym.range || sym.location?.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        selectionRange: sym.selectionRange || sym.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        detail: sym.detail,
      }));
    } catch {
      return [];
    }
  }

  // ==========================================================================
  // SIGNATURE HELP
  // ==========================================================================

  async getSignatureHelp(
    uri: string,
    position: LSPPosition,
    context?: { triggerCharacter?: string; triggerKind?: number }
  ): Promise<LSPSignatureHelp | null> {
    if (!this.initialized || !this.serverCapabilities?.signatureHelpProvider) {
      return null;
    }

    try {
      return await this.sendRequest('textDocument/signatureHelp', {
        textDocument: { uri: this.pathToUri(uri) },
        position,
        context: context ? {
          triggerKind: context.triggerKind ?? 1,
          triggerCharacter: context.triggerCharacter,
          isRetrigger: false,
        } : undefined,
      }) as LSPSignatureHelp | null;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // DIAGNOSTICS
  // ==========================================================================

  async getDiagnostics(uri: string, content: string): Promise<LSPDiagnostic[]> {
    // Try to get diagnostics from server
    if (this.initialized) {
      try {
        const result = await this.sendRequest('textDocument/diagnostic', {
          textDocument: {
            uri: this.pathToUri(uri),
          },
        }) as { items?: LSPDiagnostic[] } | null;

        if (result?.items) {
          return result.items;
        }
      } catch {
        // Server may not support diagnostic pull, fall back to basic validation
      }
    }

    // Fallback to basic syntax validation
    return this.getBasicDiagnostics(content);
  }

  private getBasicDiagnostics(content: string): LSPDiagnostic[] {
    const diagnostics: LSPDiagnostic[] = [];
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      // Check for trailing whitespace
      const trailingSpace = line.match(/\s+$/);
      if (trailingSpace) {
        diagnostics.push({
          range: {
            start: { line: lineIndex, character: line.length - trailingSpace[0].length },
            end: { line: lineIndex, character: line.length },
          },
          severity: 'hint',
          message: 'Trailing whitespace',
          source: 'kyro-lsp',
        });
      }

      // Check for TODO/FIXME comments
      const todoMatch = line.match(/\b(TODO|FIXME|HACK|XXX|BUG)\b/);
      if (todoMatch) {
        diagnostics.push({
          range: {
            start: { line: lineIndex, character: todoMatch.index || 0 },
            end: { line: lineIndex, character: (todoMatch.index || 0) + todoMatch[0].length },
          },
          severity: 'information',
          message: `${todoMatch[0]} comment found`,
          source: 'kyro-lsp',
        });
      }

      // Check for common issues
      const bracketMismatch = this.checkBracketMismatch(line, lineIndex);
      diagnostics.push(...bracketMismatch);
    });

    // Check for unmatched brackets across the document
    const unmatchedBrackets = this.checkUnmatchedBrackets(content);
    diagnostics.push(...unmatchedBrackets);

    return diagnostics;
  }

  private checkBracketMismatch(line: string, lineIndex: number): LSPDiagnostic[] {
    const diagnostics: LSPDiagnostic[] = [];
    const brackets: { char: string; match: string; index: number }[] = [];
    const bracketPairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
    const closingBrackets = new Set([')', ']', '}']);

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (bracketPairs[char]) {
        brackets.push({ char, match: bracketPairs[char], index: i });
      } else if (closingBrackets.has(char)) {
        const last = brackets.pop();
        if (!last || last.match !== char) {
          diagnostics.push({
            range: {
              start: { line: lineIndex, character: i },
              end: { line: lineIndex, character: i + 1 },
            },
            severity: 'error',
            message: `Unexpected closing bracket '${char}'`,
            source: 'kyro-lsp',
          });
        }
      }
    }

    return diagnostics;
  }

  private checkUnmatchedBrackets(content: string): LSPDiagnostic[] {
    const diagnostics: LSPDiagnostic[] = [];
    const stack: { char: string; line: number; char: number }[] = [];
    const bracketPairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
    const closingBrackets = new Set([')', ']', '}']);
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        if (bracketPairs[char]) {
          stack.push({ char, line: lineIndex, char: charIndex });
        } else if (closingBrackets.has(char)) {
          const last = stack.pop();
          if (last && bracketPairs[last.char] !== char) {
            diagnostics.push({
              range: {
                start: { line: lineIndex, character: charIndex },
                end: { line: lineIndex, character: charIndex + 1 },
              },
              severity: 'error',
              message: `Mismatched brackets: expected '${bracketPairs[last.char]}', found '${char}'`,
              source: 'kyro-lsp',
            });
          }
        }
      }
    });

    // Report unclosed brackets
    stack.forEach((item) => {
      diagnostics.push({
        range: {
          start: { line: item.line, character: item.char },
          end: { line: item.line, character: item.char + 1 },
        },
        severity: 'error',
        message: `Unclosed bracket '${item.char}'`,
        source: 'kyro-lsp',
      });
    });

    return diagnostics;
  }

  // ==========================================================================
  // FORMATTING
  // ==========================================================================

  async formatDocument(uri: string, options?: {
    tabSize?: number;
    insertSpaces?: boolean;
  }): Promise<Array<{ range: LSPRange; newText: string }> | null> {
    if (!this.initialized || !this.serverCapabilities?.documentFormattingProvider) {
      return null;
    }

    try {
      return await this.sendRequest('textDocument/formatting', {
        textDocument: { uri: this.pathToUri(uri) },
        options: {
          tabSize: options?.tabSize ?? 2,
          insertSpaces: options?.insertSpaces ?? true,
        },
      }) as Array<{ range: LSPRange; newText: string }> | null;
    } catch {
      return null;
    }
  }

  async formatDocumentRange(
    uri: string,
    range: LSPRange,
    options?: { tabSize?: number; insertSpaces?: boolean }
  ): Promise<Array<{ range: LSPRange; newText: string }> | null> {
    if (!this.initialized || !this.serverCapabilities?.documentRangeFormattingProvider) {
      return null;
    }

    try {
      return await this.sendRequest('textDocument/rangeFormatting', {
        textDocument: { uri: this.pathToUri(uri) },
        range,
        options: {
          tabSize: options?.tabSize ?? 2,
          insertSpaces: options?.insertSpaces ?? true,
        },
      }) as Array<{ range: LSPRange; newText: string }> | null;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // RENAME
  // ==========================================================================

  async rename(uri: string, position: LSPPosition, newName: string): Promise<{
    documentChanges?: Array<{
      textDocument: { uri: string };
      edits: Array<{ range: LSPRange; newText: string }>;
    }>;
    changes?: Record<string, Array<{ range: LSPRange; newText: string }>>;
  } | null> {
    if (!this.initialized || !this.serverCapabilities?.renameProvider) {
      return null;
    }

    try {
      return await this.sendRequest('textDocument/rename', {
        textDocument: { uri: this.pathToUri(uri) },
        position,
        newName,
      }) as typeof returnValue;
    } catch {
      return null;
    }
    const returnValue = null;
    return returnValue;
  }

  // ==========================================================================
  // JSON-RPC COMMUNICATION
  // ==========================================================================

  private sendRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`LSP request timeout: ${method}`));
      }, this.requestTimeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.transport.send(request);
    });
  }

  private sendNotification(method: string, params: unknown): void {
    const notification: JSONRPCNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.transport.send(notification);
  }

  private handleMessage(message: JSONRPCResponse | JSONRPCNotification): void {
    // Handle response
    if ('id' in message && (typeof message.id === 'number' || typeof message.id === 'string')) {
      const pending = this.pendingRequests.get(message.id);

      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    }
    // Handle notification
    else if ('method' in message) {
      this.handleNotification(message as JSONRPCNotification);
    }
  }

  private handleNotification(notification: JSONRPCNotification): void {
    switch (notification.method) {
      case 'textDocument/publishDiagnostics':
        this.emit('diagnostics', notification.params);
        break;
      case 'window/logMessage':
        this.emit('logMessage', notification.params);
        break;
      case 'window/showMessage':
        this.emit('showMessage', notification.params);
        break;
      case '$/progress':
        this.emit('progress', notification.params);
        break;
      default:
        this.emit('notification', notification);
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  private pathToUri(path: string): string {
    if (path.startsWith('file://')) return path;
    // Convert to file URI
    const absolute = path.startsWith('/') ? path : `/${path}`;
    return `file://${absolute}`;
  }

  private uriToPath(uri: string): string {
    if (uri.startsWith('file://')) {
      return uri.slice(7);
    }
    return uri;
  }

  getCapabilities(): ServerCapabilities | null {
    return this.serverCapabilities;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    if (this.initialized) {
      try {
        await this.sendRequest('shutdown', {});
      } catch {
        // Ignore shutdown errors
      }
      this.sendNotification('exit', {});
    }

    // Clear pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('LSP client shutdown'));
    });
    this.pendingRequests.clear();

    this.transport.close();
    this.emit('shutdown');
  }

  // ==========================================================================
  // FALLBACK IMPLEMENTATIONS
  // ==========================================================================

  private getFallbackCompletions(uri: string, _position: LSPPosition): LSPCompletion[] {
    const ext = uri.split('.').pop()?.toLowerCase() || '';

    switch (ext) {
      case 'ts':
      case 'tsx':
        return this.getTypeScriptCompletions();
      case 'js':
      case 'jsx':
        return this.getJavaScriptCompletions();
      case 'py':
        return this.getPythonCompletions();
      case 'rs':
        return this.getRustCompletions();
      case 'go':
        return this.getGoCompletions();
      case 'java':
        return this.getJavaCompletions();
      case 'json':
        return this.getJSONCompletions();
      default:
        return [];
    }
  }

  private getFallbackDefinition(_uri: string, _position: LSPPosition): LSPDefinition[] | null {
    // Without a real LSP server, we can't provide definitions
    return null;
  }

  private getFallbackReferences(_uri: string, _position: LSPPosition): LSPReference[] {
    // Without a real LSP server, we can't find references
    return [];
  }

  private getFallbackHover(_uri: string, _position: LSPPosition): LSPHover | null {
    // Without a real LSP server, we can't provide hover info
    return null;
  }

  private getFallbackSymbols(_uri: string): LSPSymbol[] {
    // Without a real LSP server, we can't extract symbols
    return [];
  }

  private getTypeScriptCompletions(): LSPCompletion[] {
    return [
      { label: 'const', kind: CompletionItemKind.Keyword, insertText: 'const ' },
      { label: 'let', kind: CompletionItemKind.Keyword, insertText: 'let ' },
      { label: 'var', kind: CompletionItemKind.Keyword, insertText: 'var ' },
      { label: 'function', kind: CompletionItemKind.Snippet, insertText: 'function ${1:name}($2) {\n  $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'class', kind: CompletionItemKind.Snippet, insertText: 'class ${1:Name} {\n  $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'interface', kind: CompletionItemKind.Snippet, insertText: 'interface ${1:Name} {\n  $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'type', kind: CompletionItemKind.Snippet, insertText: 'type ${1:Name} = $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'import', kind: CompletionItemKind.Snippet, insertText: "import { $1 } from '$0'", insertTextFormat: InsertTextFormat.Snippet },
      { label: 'export', kind: CompletionItemKind.Keyword, insertText: 'export ' },
      { label: 'async', kind: CompletionItemKind.Keyword, insertText: 'async ' },
      { label: 'await', kind: CompletionItemKind.Keyword, insertText: 'await ' },
      { label: 'return', kind: CompletionItemKind.Keyword, insertText: 'return ' },
      { label: 'if', kind: CompletionItemKind.Snippet, insertText: 'if ($1) {\n  $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'else', kind: CompletionItemKind.Snippet, insertText: 'else {\n  $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'for', kind: CompletionItemKind.Snippet, insertText: 'for (let ${1:i} = 0; $1 < ${2:length}; $1++) {\n  $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'while', kind: CompletionItemKind.Snippet, insertText: 'while ($1) {\n  $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'try', kind: CompletionItemKind.Snippet, insertText: 'try {\n  $1\n} catch (error) {\n  $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'console.log', kind: CompletionItemKind.Function, insertText: 'console.log($0)', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'console.error', kind: CompletionItemKind.Function, insertText: 'console.error($0)', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'console.warn', kind: CompletionItemKind.Function, insertText: 'console.warn($0)', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'Promise', kind: CompletionItemKind.Class, insertText: 'Promise<$1>' },
      { label: 'async function', kind: CompletionItemKind.Snippet, insertText: 'async function ${1:name}($2) {\n  $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'arrow function', kind: CompletionItemKind.Snippet, insertText: 'const ${1:name} = ($2) => {\n  $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'async arrow', kind: CompletionItemKind.Snippet, insertText: 'const ${1:name} = async ($2) => {\n  $0\n}', insertTextFormat: InsertTextFormat.Snippet },
    ];
  }

  private getJavaScriptCompletions(): LSPCompletion[] {
    return [
      ...this.getTypeScriptCompletions(),
      { label: 'require', kind: CompletionItemKind.Function, insertText: "require('$0')", insertTextFormat: InsertTextFormat.Snippet },
      { label: 'module.exports', kind: CompletionItemKind.Snippet, insertText: 'module.exports = $0', insertTextFormat: InsertTextFormat.Snippet },
    ];
  }

  private getPythonCompletions(): LSPCompletion[] {
    return [
      { label: 'def', kind: CompletionItemKind.Snippet, insertText: 'def ${1:name}($2):\n    $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'async def', kind: CompletionItemKind.Snippet, insertText: 'async def ${1:name}($2):\n    $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'class', kind: CompletionItemKind.Snippet, insertText: 'class ${1:Name}:\n    $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'import', kind: CompletionItemKind.Snippet, insertText: 'import $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'from', kind: CompletionItemKind.Snippet, insertText: 'from ${1:module} import $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'if', kind: CompletionItemKind.Snippet, insertText: 'if $1:\n    $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'elif', kind: CompletionItemKind.Snippet, insertText: 'elif $1:\n    $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'else', kind: CompletionItemKind.Snippet, insertText: 'else:\n    $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'for', kind: CompletionItemKind.Snippet, insertText: 'for ${1:item} in ${2:items}:\n    $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'while', kind: CompletionItemKind.Snippet, insertText: 'while $1:\n    $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'try', kind: CompletionItemKind.Snippet, insertText: 'try:\n    $1\nexcept $2:\n    $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'with', kind: CompletionItemKind.Snippet, insertText: 'with ${1:context} as $2:\n    $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'return', kind: CompletionItemKind.Keyword, insertText: 'return ' },
      { label: 'yield', kind: CompletionItemKind.Keyword, insertText: 'yield ' },
      { label: 'lambda', kind: CompletionItemKind.Snippet, insertText: 'lambda $1: $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'print', kind: CompletionItemKind.Function, insertText: 'print($0)', insertTextFormat: InsertTextFormat.Snippet },
      { label: '__init__', kind: CompletionItemKind.Method, insertText: 'def __init__(self, $1):\n    $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: '__str__', kind: CompletionItemKind.Method, insertText: 'def __str__(self):\n    return $0', insertTextFormat: InsertTextFormat.Snippet },
    ];
  }

  private getRustCompletions(): LSPCompletion[] {
    return [
      { label: 'fn', kind: CompletionItemKind.Snippet, insertText: 'fn ${1:name}($2) {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'pub fn', kind: CompletionItemKind.Snippet, insertText: 'pub fn ${1:name}($2) {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'async fn', kind: CompletionItemKind.Snippet, insertText: 'async fn ${1:name}($2) {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'struct', kind: CompletionItemKind.Snippet, insertText: 'struct ${1:Name} {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'enum', kind: CompletionItemKind.Snippet, insertText: 'enum ${1:Name} {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'impl', kind: CompletionItemKind.Snippet, insertText: 'impl ${1:Type} {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'let', kind: CompletionItemKind.Keyword, insertText: 'let ' },
      { label: 'let mut', kind: CompletionItemKind.Keyword, insertText: 'let mut ' },
      { label: 'if', kind: CompletionItemKind.Snippet, insertText: 'if $1 {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'else', kind: CompletionItemKind.Snippet, insertText: 'else {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'for', kind: CompletionItemKind.Snippet, insertText: 'for ${1:item} in ${2:items} {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'match', kind: CompletionItemKind.Snippet, insertText: 'match $1 {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'use', kind: CompletionItemKind.Keyword, insertText: 'use ' },
      { label: 'mod', kind: CompletionItemKind.Snippet, insertText: 'mod ${1:name} {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'println!', kind: CompletionItemKind.Function, insertText: 'println!("$0")', insertTextFormat: InsertTextFormat.Snippet },
    ];
  }

  private getGoCompletions(): LSPCompletion[] {
    return [
      { label: 'func', kind: CompletionItemKind.Snippet, insertText: 'func ${1:name}($2) {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'func (method)', kind: CompletionItemKind.Snippet, insertText: 'func (${1:receiver} ${2:Type}) ${3:name}($4) {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'struct', kind: CompletionItemKind.Snippet, insertText: 'type ${1:Name} struct {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'interface', kind: CompletionItemKind.Snippet, insertText: 'type ${1:Name} interface {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'type', kind: CompletionItemKind.Keyword, insertText: 'type ' },
      { label: 'if', kind: CompletionItemKind.Snippet, insertText: 'if $1 {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'for', kind: CompletionItemKind.Snippet, insertText: 'for ${1:i} := 0; $1 < ${2:n}; $1++ {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'for range', kind: CompletionItemKind.Snippet, insertText: 'for ${1:i}, ${2:v} := range ${3:items} {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'go', kind: CompletionItemKind.Keyword, insertText: 'go ' },
      { label: 'defer', kind: CompletionItemKind.Keyword, insertText: 'defer ' },
      { label: 'return', kind: CompletionItemKind.Keyword, insertText: 'return ' },
      { label: 'import', kind: CompletionItemKind.Snippet, insertText: 'import (\n    "$0"\n)', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'package', kind: CompletionItemKind.Keyword, insertText: 'package ' },
      { label: 'fmt.Println', kind: CompletionItemKind.Function, insertText: 'fmt.Println($0)', insertTextFormat: InsertTextFormat.Snippet },
    ];
  }

  private getJavaCompletions(): LSPCompletion[] {
    return [
      { label: 'class', kind: CompletionItemKind.Snippet, insertText: 'class ${1:Name} {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'interface', kind: CompletionItemKind.Snippet, insertText: 'interface ${1:Name} {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'public', kind: CompletionItemKind.Keyword, insertText: 'public ' },
      { label: 'private', kind: CompletionItemKind.Keyword, insertText: 'private ' },
      { label: 'protected', kind: CompletionItemKind.Keyword, insertText: 'protected ' },
      { label: 'static', kind: CompletionItemKind.Keyword, insertText: 'static ' },
      { label: 'final', kind: CompletionItemKind.Keyword, insertText: 'final ' },
      { label: 'void', kind: CompletionItemKind.Keyword, insertText: 'void ' },
      { label: 'if', kind: CompletionItemKind.Snippet, insertText: 'if ($1) {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'else', kind: CompletionItemKind.Snippet, insertText: 'else {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'for', kind: CompletionItemKind.Snippet, insertText: 'for (int ${1:i} = 0; $1 < ${2:n}; $1++) {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'while', kind: CompletionItemKind.Snippet, insertText: 'while ($1) {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'try', kind: CompletionItemKind.Snippet, insertText: 'try {\n    $1\n} catch (${2:Exception} e) {\n    $0\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'System.out.println', kind: CompletionItemKind.Function, insertText: 'System.out.println($0)', insertTextFormat: InsertTextFormat.Snippet },
    ];
  }

  private getJSONCompletions(): LSPCompletion[] {
    return [
      { label: 'key', kind: CompletionItemKind.Snippet, insertText: '"${1:key}": $0', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'string', kind: CompletionItemKind.Snippet, insertText: '"$0"', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'array', kind: CompletionItemKind.Snippet, insertText: '[\n  $0\n]', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'object', kind: CompletionItemKind.Snippet, insertText: '{\n  "$0"\n}', insertTextFormat: InsertTextFormat.Snippet },
      { label: 'true', kind: CompletionItemKind.Keyword, insertText: 'true' },
      { label: 'false', kind: CompletionItemKind.Keyword, insertText: 'false' },
      { label: 'null', kind: CompletionItemKind.Keyword, insertText: 'null' },
    ];
  }
}

// ============================================================================
// LSP MANAGER - Multi-Language Support
// ============================================================================

export interface LanguageServerConfig {
  languageId: string;
  extensions: string[];
  command?: string;
  args?: string[];
  transport?: Transport;
  initializationOptions?: unknown;
}

export class LSPManager {
  private clients = new Map<string, LSPClient>();
  private configs = new Map<string, LanguageServerConfig>();
  private documentLanguageMap = new Map<string, string>();

  constructor() {
    // Register default language configurations
    this.registerDefaultLanguages();
  }

  private registerDefaultLanguages(): void {
    const defaultConfigs: LanguageServerConfig[] = [
      { languageId: 'typescript', extensions: ['.ts', '.tsx'] },
      { languageId: 'javascript', extensions: ['.js', '.jsx'] },
      { languageId: 'python', extensions: ['.py'] },
      { languageId: 'rust', extensions: ['.rs'] },
      { languageId: 'go', extensions: ['.go'] },
      { languageId: 'java', extensions: ['.java'] },
      { languageId: 'json', extensions: ['.json', '.jsonc'] },
      { languageId: 'html', extensions: ['.html', '.htm'] },
      { languageId: 'css', extensions: ['.css', '.scss', '.less'] },
      { languageId: 'markdown', extensions: ['.md', '.markdown'] },
    ];

    defaultConfigs.forEach((config) => {
      this.configs.set(config.languageId, config);
    });
  }

  registerLanguage(config: LanguageServerConfig): void {
    this.configs.set(config.languageId, config);
    config.extensions.forEach((ext) => {
      this.documentLanguageMap.set(ext, config.languageId);
    });
  }

  getLanguageFromPath(path: string): string {
    const ext = '.' + (path.split('.').pop()?.toLowerCase() || '');
    return this.documentLanguageMap.get(ext) || 'plaintext';
  }

  getClient(languageId: string): LSPClient {
    let client = this.clients.get(languageId);

    if (!client) {
      const config = this.configs.get(languageId);
      client = new LSPClient(languageId, config?.transport);
      this.clients.set(languageId, client);
    }

    return client;
  }

  async initializeAll(rootPath: string): Promise<void> {
    const initPromises = Array.from(this.clients.values()).map((client) =>
      client.initialize(rootPath).catch((error) => {
        console.warn(`Failed to initialize LSP client: ${error.message}`);
      })
    );

    await Promise.all(initPromises);
  }

  async initializeLanguage(rootPath: string, languageId: string): Promise<LSPClient> {
    const client = this.getClient(languageId);

    if (!client.isInitialized()) {
      await client.initialize(rootPath);
    }

    return client;
  }

  getClientForFile(path: string): LSPClient {
    const languageId = this.getLanguageFromPath(path);
    return this.getClient(languageId);
  }

  getSupportedLanguages(): string[] {
    return Array.from(this.configs.keys());
  }

  async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.clients.values()).map((client) =>
      client.shutdown().catch(() => {})
    );

    await Promise.all(shutdownPromises);
    this.clients.clear();
  }

  // Convenience methods
  async openDocument(uri: string, content: string): Promise<LSPClient> {
    const languageId = this.getLanguageFromPath(uri);
    const client = this.getClient(languageId);
    await client.openDocument(uri, languageId, content);
    return client;
  }

  async closeDocument(uri: string): Promise<void> {
    const languageId = this.getLanguageFromPath(uri);
    const client = this.clients.get(languageId);
    if (client) {
      await client.closeDocument(uri);
    }
  }

  async getCompletions(uri: string, position: LSPPosition): Promise<LSPCompletion[]> {
    const client = this.getClientForFile(uri);
    return client.getCompletions(uri, position);
  }

  async getDefinition(uri: string, position: LSPPosition): Promise<LSPDefinition[] | null> {
    const client = this.getClientForFile(uri);
    return client.getDefinition(uri, position);
  }

  async getReferences(uri: string, position: LSPPosition): Promise<LSPReference[]> {
    const client = this.getClientForFile(uri);
    return client.getReferences(uri, position);
  }

  async getHover(uri: string, position: LSPPosition): Promise<LSPHover | null> {
    const client = this.getClientForFile(uri);
    return client.getHover(uri, position);
  }

  async getSymbols(uri: string): Promise<LSPSymbol[]> {
    const client = this.getClientForFile(uri);
    return client.getSymbols(uri);
  }

  async getDiagnostics(uri: string, content: string): Promise<LSPDiagnostic[]> {
    const client = this.getClientForFile(uri);
    return client.getDiagnostics(uri, content);
  }
}

// Singleton instance
let lspManager: LSPManager | null = null;

export function getLSPManager(): LSPManager {
  if (!lspManager) {
    lspManager = new LSPManager();
  }
  return lspManager;
}

// Export types
export type {
  LSPClient as LSPClientType,
  LSPManager as LSPManagerType,
  Transport,
  LanguageServerConfig,
};
