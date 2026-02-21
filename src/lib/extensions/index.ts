/**
 * Kyro IDE - Extensions Module
 * Export all extension-related functionality
 */

export { 
  extensionHost,
  type Extension,
  type ExtensionManifest,
  type ExtensionContributions,
  type ExtensionContext,
} from './extension-host';

export {
  workspace,
  window,
  commands,
  languages,
  version,
  env,
  Uri,
  EventEmitter,
  SnippetString,
  CodeActionKind,
  CompletionItemKind,
  CompletionItemTag,
  DiagnosticSeverity,
  DiagnosticTag,
  SymbolKind,
  TextEditorRevealType,
  EndOfLine,
  type Disposable,
  type Event,
  type CancellationToken,
  type Position,
  type Range,
  type Location,
  type TextDocument,
  type TextLine,
  type TextEditor,
  type Selection,
  type TextEditorOptions,
  type TextEditorEdit,
  type TextEditorDecorationType,
  type DecorationOptions,
  type MarkdownString,
  type WorkspaceFolder,
  type WorkspaceEdit,
  type WorkspaceConfiguration,
  type OutputChannel,
  type Terminal,
  type TerminalOptions,
  type InputBoxOptions,
  type QuickPickItem,
  type QuickPickOptions,
  type CompletionItem,
  type TextEdit,
  type Command,
  type Diagnostic,
  type DiagnosticRelatedInformation,
  type CodeAction,
  type Definition,
  type SymbolInformation,
  type DocumentSymbol,
  type CodeActionContext,
  type DiagnosticCollection,
} from './extension-api';

// Convenience function to create the VS Code-compatible extension API
export function createExtensionAPI() {
  return {
    workspace,
    window,
    commands,
    languages,
    version,
    env,
    Uri,
    EventEmitter,
    // Classes
    SnippetString,
    CodeActionKind,
    CompletionItemKind,
    DiagnosticSeverity,
    SymbolKind,
    // Enums
    EndOfLine,
    TextEditorRevealType,
    CompletionItemTag,
    DiagnosticTag,
  };
}
