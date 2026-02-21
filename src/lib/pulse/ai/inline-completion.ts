/**
 * Kyro IDE - AI Inline Code Completion
 * 
 * Comprehensive inline completion system with:
 * - Ghost text UI rendering
 * - AI-powered suggestions (Ollama integration ready)
 * - Context-aware completions
 * - Keyboard shortcuts (Tab accept, Esc dismiss, Alt+\ trigger)
 * - Multi-line support
 * - Snippet integration
 */

'use client';

import type * as Monaco from 'monaco-editor';
import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface InlineCompletionConfig {
  enabled: boolean;
  debounceMs: number;
  maxTokens: number;
  model: string;
  temperature: number;
  triggerCharacters: string[];
  triggerOnSpace: boolean;
  triggerOnNewline: boolean;
  minPrefixLength: number;
  showLoadingIndicator: boolean;
  multilineThreshold: number;
  respectComments: boolean;
  showSuggestionSource: boolean;
  autoAcceptOnExactMatch: boolean;
  maxSuggestions: number;
  cacheSize: number;
  enableCache: boolean;
}

export interface InlineCompletionSuggestion {
  id: string;
  text: string;
  displayText: string;
  range: Monaco.IRange;
  isMultiLine: boolean;
  source: 'ai' | 'pattern' | 'snippet' | 'context';
  confidence: number;
  model?: string;
  latency?: number;
  context?: CompletionContext;
}

export interface CompletionContext {
  documentLanguage: string;
  fileName: string;
  lineContent: string;
  textBeforeCursor: string;
  textAfterCursor: string;
  previousLines: string[];
  nextLines: string[];
  indentLevel: number;
  inComment: boolean;
  inString: boolean;
  inImport: boolean;
  scopeContext?: ScopeContext;
}

export interface ScopeContext {
  currentFunction?: string;
  currentClass?: string;
  localVariables: string[];
  importedModules: string[];
}

export interface CompletionRequest {
  document: Monaco.editor.ITextModel;
  position: Monaco.Position;
  context: Monaco.languages.InlineCompletionContext;
  config: InlineCompletionConfig;
}

export interface CompletionResponse {
  suggestions: InlineCompletionSuggestion[];
  latency: number;
  fromCache: boolean;
}

export interface GhostTextState {
  visible: boolean;
  text: string;
  range: Monaco.IRange;
  suggestion: InlineCompletionSuggestion | null;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const defaultConfig: InlineCompletionConfig = {
  enabled: true,
  debounceMs: 150,
  maxTokens: 150,
  model: 'llama3.2',
  temperature: 0.2,
  triggerCharacters: ['.', '(', '{', '[', '\n', ' ', '=', ':', '<', '"', "'", '`'],
  triggerOnSpace: true,
  triggerOnNewline: true,
  minPrefixLength: 2,
  showLoadingIndicator: true,
  multilineThreshold: 50,
  respectComments: true,
  showSuggestionSource: true,
  autoAcceptOnExactMatch: false,
  maxSuggestions: 3,
  cacheSize: 100,
  enableCache: true,
};

// ============================================================================
// COMPLETION CACHE
// ============================================================================

class CompletionCache {
  private cache: Map<string, { suggestions: InlineCompletionSuggestion[]; timestamp: number }> = new Map();
  private maxSize: number;
  
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }
  
  private hashKey(document: Monaco.editor.ITextModel, position: Monaco.Position): string {
    const lineContent = document.getLineContent(position.lineNumber);
    const textBefore = lineContent.substring(0, position.column - 1);
    return `${document.uri.toString()}:${position.lineNumber}:${textBefore}`;
  }
  
  get(document: Monaco.editor.ITextModel, position: Monaco.Position): InlineCompletionSuggestion[] | null {
    const key = this.hashKey(document, position);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < 30000) { // 30 second TTL
      return cached.suggestions;
    }
    
    return null;
  }
  
  set(document: Monaco.editor.ITextModel, position: Monaco.Position, suggestions: InlineCompletionSuggestion[]): void {
    const key = this.hashKey(document, position);
    
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries
      const keys = Array.from(this.cache.keys()).slice(0, Math.floor(this.maxSize / 2));
      for (const k of keys) {
        this.cache.delete(k);
      }
    }
    
    this.cache.set(key, { suggestions, timestamp: Date.now() });
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// CONTEXT ANALYZER
// ============================================================================

class ContextAnalyzer {
  analyze(document: Monaco.editor.ITextModel, position: Monaco.Position): CompletionContext {
    const lineContent = document.getLineContent(position.lineNumber);
    const textBeforeCursor = lineContent.substring(0, position.column - 1);
    const textAfterCursor = lineContent.substring(position.column - 1);
    
    // Get surrounding context
    const previousLines: string[] = [];
    const nextLines: string[] = [];
    
    for (let i = Math.max(1, position.lineNumber - 5); i < position.lineNumber; i++) {
      previousLines.push(document.getLineContent(i));
    }
    
    for (let i = position.lineNumber + 1; i <= Math.min(document.getLineCount(), position.lineNumber + 3); i++) {
      nextLines.push(document.getLineContent(i));
    }
    
    // Calculate indent level
    const indentMatch = lineContent.match(/^(\s*)/);
    const indentLevel = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
    
    // Detect context states
    const inComment = this.isInComment(textBeforeCursor, previousLines);
    const inString = this.isInString(textBeforeCursor);
    const inImport = this.isInImport(textBeforeCursor);
    
    // Get document language
    const languageId = document.getLanguageId();
    const fileName = document.uri.toString().split('/').pop() || '';
    
    return {
      documentLanguage: languageId,
      fileName,
      lineContent,
      textBeforeCursor,
      textAfterCursor,
      previousLines,
      nextLines,
      indentLevel,
      inComment,
      inString,
      inImport,
    };
  }
  
  private isInComment(textBefore: string, previousLines: string[]): boolean {
    // Single line comment
    if (textBefore.includes('//') || textBefore.includes('#')) {
      return true;
    }
    
    // Block comment
    if (textBefore.includes('/*') && !textBefore.includes('*/')) {
      return true;
    }
    
    // JSDoc/Docstring
    if (textBefore.trim().startsWith('*') || textBefore.trim().startsWith('///')) {
      return true;
    }
    
    // Python docstring
    if (previousLines.length > 0) {
      const lastLine = previousLines[previousLines.length - 1];
      if (lastLine.includes('"""') || lastLine.includes("'''")) {
        return true;
      }
    }
    
    return false;
  }
  
  private isInString(textBefore: string): boolean {
    // Count quotes to check if we're inside a string
    const doubleQuotes = (textBefore.match(/(?<!\\)"/g) || []).length;
    const singleQuotes = (textBefore.match(/(?<!\\)'/g) || []).length;
    const backticks = (textBefore.match(/(?<!\\)`/g) || []).length;
    
    return doubleQuotes % 2 === 1 || singleQuotes % 2 === 1 || backticks % 2 === 1;
  }
  
  private isInImport(textBefore: string): boolean {
    const trimmed = textBefore.trim();
    return (
      trimmed.startsWith('import ') ||
      trimmed.startsWith('from ') ||
      trimmed.startsWith('require(') ||
      /import\s*\{?\s*$/.test(trimmed) ||
      /from\s+['"]$/.test(trimmed)
    );
  }
}

// ============================================================================
// PATTERN-BASED COMPLETION PROVIDER
// ============================================================================

class PatternCompletionProvider {
  private patterns: Map<string, Array<{ pattern: RegExp; generator: (match: RegExpMatchArray) => string }>> = new Map();
  
  constructor() {
    this.initializePatterns();
  }
  
  private initializePatterns(): void {
    // TypeScript/JavaScript patterns
    this.patterns.set('typescript', [
      // Console methods
      { pattern: /console\.lo?g?$/, generator: () => 'log($1)' },
      { pattern: /console\.wa?r?n?$/, generator: () => 'warn($1)' },
      { pattern: /console\.er?r?o?r?$/, generator: () => 'error($1)' },
      { pattern: /console\.di?r?$/, generator: () => 'dir($1)' },
      { pattern: /console\.tab?l?e?$/, generator: () => 'table($1)' },
      
      // Function definitions
      { pattern: /function\s+\w*$/, generator: (m) => `${m[0].split(/\s+/).pop() || 'name'}($1) {\n  $2\n}` },
      { pattern: /async\s+function\s+\w*$/, generator: (m) => `${m[0].split(/\s+/).pop() || 'name'}($1) {\n  $2\n}` },
      { pattern: /const\s+\w+\s*=\s*\(?async\s*\(?\)?$/, generator: () => ' => {\n  $1\n}' },
      { pattern: /const\s+\w+\s*=\s*\($/, generator: () => '$1) => {\n  $2\n}' },
      { pattern: /=>\s*$/, generator: () => '{\n  $1\n}' },
      
      // Class definitions
      { pattern: /class\s+\w*$/, generator: (m) => `${m[0].split(/\s+/).pop() || 'Name'} {\n  constructor($1) {\n    $2\n  }\n}` },
      { pattern: /class\s+\w+\s+extends\s+\w*$/, generator: (m) => `${m[0].split(/\s+/).pop() || 'Base'} {\n  constructor($1) {\n    super($2);\n    $3\n  }\n}` },
      
      // Interface/Type
      { pattern: /interface\s+\w*$/, generator: (m) => `${m[0].split(/\s+/).pop() || 'Name'} {\n  $1\n}` },
      { pattern: /type\s+\w+\s*=\s*$/, generator: () => '{\n  $1\n}' },
      
      // Control flow
      { pattern: /if\s*\($/, generator: () => '$1) {\n  $2\n}' },
      { pattern: /else\s*$/, generator: () => '{\n  $1\n}' },
      { pattern: /else\s+if\s*\($/, generator: () => '$1) {\n  $2\n}' },
      { pattern: /switch\s*\($/, generator: () => '$1) {\n  case $2:\n    $3\n    break;\n  default:\n    $4\n}' },
      { pattern: /try\s*$/, generator: () => '{\n  $1\n} catch ($2) {\n  $3\n}' },
      
      // Loops
      { pattern: /for\s*\($/, generator: () => 'let $1 = 0; $1 < $2; $1++) {\n  $3\n}' },
      { pattern: /for\s*\(const\s+\w+\s+of\s+$/, generator: () => '$1) {\n  $2\n}' },
      { pattern: /while\s*\($/, generator: () => '$1) {\n  $2\n}' },
      
      // Array methods
      { pattern: /\.map\s*\($/, generator: () => '$1 => {\n  $2\n})' },
      { pattern: /\.filter\s*\($/, generator: () => '$1 => $2)' },
      { pattern: /\.reduce\s*\($/, generator: () => '($1, $2) => {\n  $3\n}, $4)' },
      { pattern: /\.forEach\s*\($/, generator: () => '$1 => {\n  $2\n})' },
      { pattern: /\.find\s*\($/, generator: () => '$1 => $2)' },
      { pattern: /\.some\s*\($/, generator: () => '$1 => $2)' },
      { pattern: /\.every\s*\($/, generator: () => '$1 => $2)' },
      
      // Imports/Exports
      { pattern: /import\s+\{?\s*$/, generator: () => '$1} from \'$2\'' },
      { pattern: /import\s+\*\s+as\s+\w+\s+from\s+['"]$/, generator: () => '$1\';' },
      { pattern: /export\s+default\s+$/, generator: () => '$1;' },
      { pattern: /export\s+const\s+\w+\s*=\s*$/, generator: () => '$1;' },
      
      // Promises
      { pattern: /\.then\s*\($/, generator: () => '($1) => {\n  $2\n})' },
      { pattern: /\.catch\s*\($/, generator: () => '($1) => {\n  $2\n})' },
      { pattern: /new\s+Promise\s*\($/, generator: () => '(resolve, reject) => {\n  $1\n})' },
      { pattern: /async\s+\($/, generator: () => '$1) => {\n  await $2\n}' },
      
      // React hooks
      { pattern: /useState\s*<\w*$/, generator: () => '>($1)' },
      { pattern: /useEffect\s*\($/, generator: () => '() => {\n  $1\n}, [$2])' },
      { pattern: /useCallback\s*\($/, generator: () => '($1) => {\n  $2\n}, [$3])' },
      { pattern: /useMemo\s*\($/, generator: () => '() => {\n  $1\n}, [$2])' },
      
      // JSX
      { pattern: /className="([^"]*)"$/, generator: (m) => '' }, // Already complete
      { pattern: /<(\w+)\s*$/, generator: (m) => `${m[1]}>$1</${m[1]}>` },
      { pattern: /<(\w+)[^>]*on[A-Z]\w*=\s*$/, generator: () => '{$1}' },
      
      // Common patterns
      { pattern: /return\s*$/, generator: () => '$1;' },
      { pattern: /throw\s+new\s+Error\s*\($/, generator: () => '$1)' },
      { pattern: /typeof\s+\w+\s*===?\s*$/, generator: () => '\'$1\'' },
    ]);
    
    // Python patterns
    this.patterns.set('python', [
      // Function definitions
      { pattern: /def\s+\w*\($/, generator: () => '$1):\n    $2' },
      { pattern: /async\s+def\s+\w*\($/, generator: () => '$1):\n    $2' },
      { pattern: /lambda\s*$/, generator: () => ' $1: $2' },
      
      // Class definitions
      { pattern: /class\s+\w*$/, generator: () => '$1:\n    def __init__(self, $2):\n        $3' },
      { pattern: /class\s+\w+\(\w*$/, generator: () => '$1):\n    def __init__(self, $2):\n        super().__init__()\n        $3' },
      
      // Control flow
      { pattern: /if\s+.*:\s*$/, generator: () => '\n    $1' },
      { pattern: /elif\s+.*:\s*$/, generator: () => '\n    $1' },
      { pattern: /else:\s*$/, generator: () => '\n    $1' },
      { pattern: /for\s+\w+\s+in\s+$/, generator: () => '$1:\n    $2' },
      { pattern: /while\s+.*:\s*$/, generator: () => '\n    $1' },
      { pattern: /try:\s*$/, generator: () => '\n    $1\nexcept $2 as e:\n    $3' },
      { pattern: /with\s+$/, generator: () => '$1 as $2:\n    $3' },
      
      // Decorators
      { pattern: /@property$/, generator: () => '\ndef $1(self):\n    return self._$1' },
      { pattern: /@staticmethod$/, generator: () => '\ndef $1($2):\n    $3' },
      { pattern: /@classmethod$/, generator: () => '\ndef $1(cls, $2):\n    $3' },
      
      // Common patterns
      { pattern: /print\s*\($/, generator: () => '$1)' },
      { pattern: /raise\s+$/, generator: () => 'Exception($1)' },
      { pattern: /assert\s+$/, generator: () => '$1, "$2"' },
    ]);
    
    // Copy patterns for JavaScript
    this.patterns.set('javascript', this.patterns.get('typescript') || []);
    
    // JSON patterns
    this.patterns.set('json', [
      { pattern: /"\w+":\s*$/, generator: () => '"$1"' },
      { pattern: /\[\s*$/, generator: () => '\n  $1\n]' },
      { pattern: /\{\s*$/, generator: () => '\n  "$1": $2\n}' },
    ]);
  }
  
  getCompletions(context: CompletionContext): string[] {
    const patterns = this.patterns.get(context.documentLanguage) || [];
    const completions: string[] = [];
    
    for (const { pattern, generator } of patterns) {
      const match = context.textBeforeCursor.match(pattern);
      if (match) {
        completions.push(generator(match));
      }
    }
    
    return completions;
  }
}

// ============================================================================
// AI COMPLETION PROVIDER (Ollama Integration Ready)
// ============================================================================

class AICompletionProvider extends EventEmitter {
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private ollamaHost: string;
  
  constructor(config: Partial<InlineCompletionConfig> = {}) {
    super();
    this.model = config.model || 'llama3.2';
    this.temperature = config.temperature || 0.2;
    this.maxTokens = config.maxTokens || 150;
    this.ollamaHost = 'http://localhost:11434';
  }
  
  async getCompletion(context: CompletionContext): Promise<string | null> {
    // Build prompt for the AI
    const prompt = this.buildPrompt(context);
    
    try {
      // Try to call Ollama if available
      const response = await fetch(`${this.ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: this.temperature,
            num_predict: this.maxTokens,
            stop: ['\n\n', '```', '---'],
          },
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        return this.extractCompletion(data.response, context);
      }
    } catch {
      // Ollama not available, fall back to pattern matching
    }
    
    return null;
  }
  
  private buildPrompt(context: CompletionContext): string {
    const language = context.documentLanguage;
    
    return `Complete the following ${language} code. Only provide the completion, no explanations.

Context:
${context.previousLines.slice(-3).join('\n')}
${context.lineContent}[CURSOR]${context.textAfterCursor}

Completion:`;
  }
  
  private extractCompletion(response: string, context: CompletionContext): string {
    // Clean up the response
    let completion = response.trim();
    
    // Remove any markdown code blocks
    completion = completion.replace(/```\w*\n?/g, '').trim();
    
    // Don't include text that's already after cursor
    if (context.textAfterCursor && completion.endsWith(context.textAfterCursor.trim())) {
      completion = completion.slice(0, -context.textAfterCursor.trim().length);
    }
    
    return completion;
  }
}

// ============================================================================
// INLINE COMPLETION PROVIDER (Monaco Integration)
// ============================================================================

export class MonacoInlineCompletionProvider {
  private config: InlineCompletionConfig;
  private cache: CompletionCache;
  private contextAnalyzer: ContextAnalyzer;
  private patternProvider: PatternCompletionProvider;
  private aiProvider: AICompletionProvider;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSuggestion: InlineCompletionSuggestion | null = null;
  private loading: boolean = false;
  private eventEmitter: EventEmitter;
  
  constructor(config: Partial<InlineCompletionConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.cache = new CompletionCache(this.config.cacheSize);
    this.contextAnalyzer = new ContextAnalyzer();
    this.patternProvider = new PatternCompletionProvider();
    this.aiProvider = new AICompletionProvider(this.config);
    this.eventEmitter = new EventEmitter();
  }
  
  /**
   * Create Monaco InlineCompletionsProvider
   */
  createProvider(monaco: typeof Monaco): Monaco.languages.InlineCompletionsProvider {
    const self = this;
    
    return {
      displayName: 'Kyro AI Inline Completions',
      
      provideInlineCompletions: async (model, position, context, token) => {
        if (!self.config.enabled) {
          return { items: [] };
        }
        
        // Check cancellation
        if (token.isCancellationRequested) {
          return { items: [] };
        }
        
        // Analyze context
        const completionContext = self.contextAnalyzer.analyze(model, position);
        
        // Skip if in comment and respecting comments
        if (self.config.respectComments && completionContext.inComment) {
          return { items: [] };
        }
        
        // Check minimum prefix length
        if (completionContext.textBeforeCursor.trim().length < self.config.minPrefixLength) {
          return { items: [] };
        }
        
        // Check trigger conditions
        const shouldTrigger = self.shouldTrigger(completionContext, context, monaco);
        if (!shouldTrigger && context.triggerKind !== monaco.languages.InlineCompletionTriggerKind.Explicit) {
          return { items: [] };
        }
        
        // Check cache
        if (self.config.enableCache) {
          const cached = self.cache.get(model, position);
          if (cached && cached.length > 0) {
            return self.createInlineCompletionResult(cached);
          }
        }
        
        // Get completions with debounce
        return new Promise((resolve) => {
          if (self.debounceTimer) {
            clearTimeout(self.debounceTimer);
          }
          
          self.debounceTimer = setTimeout(async () => {
            if (token.isCancellationRequested) {
              resolve({ items: [] });
              return;
            }
            
            self.setLoading(true);
            
            try {
              const suggestions = await self.getCompletions(model, position, completionContext);
              
              if (suggestions.length > 0 && self.config.enableCache) {
                self.cache.set(model, position, suggestions);
              }
              
              self.lastSuggestion = suggestions[0] || null;
              resolve(self.createInlineCompletionResult(suggestions));
            } catch (error) {
              console.error('Inline completion error:', error);
              resolve({ items: [] });
            } finally {
              self.setLoading(false);
            }
          }, self.config.debounceMs);
        });
      },
      
      freeInlineCompletions: () => {
        // Cleanup if needed
      },
      
      handleItemDidShow: (completions, itemIndex) => {
        const suggestion = self.lastSuggestion;
        if (suggestion) {
          self.eventEmitter.emit('suggestionShown', suggestion);
        }
      },
    };
  }
  
  /**
   * Determine if we should trigger completion
   */
  private shouldTrigger(
    context: CompletionContext,
    monacoContext: Monaco.languages.InlineCompletionContext,
    monaco: typeof Monaco
  ): boolean {
    // Always trigger on explicit request
    if (monacoContext.triggerKind === monaco.languages.InlineCompletionTriggerKind.Explicit) {
      return true;
    }
    
    const lastChar = context.textBeforeCursor.slice(-1);
    
    // Check trigger characters
    if (this.config.triggerCharacters.includes(lastChar)) {
      // Special handling for space and newline
      if (lastChar === ' ' && !this.config.triggerOnSpace) {
        return false;
      }
      if (lastChar === '\n' && !this.config.triggerOnNewline) {
        return false;
      }
      return true;
    }
    
    return false;
  }
  
  /**
   * Get completions from multiple sources
   */
  private async getCompletions(
    model: Monaco.editor.ITextModel,
    position: Monaco.Position,
    context: CompletionContext
  ): Promise<InlineCompletionSuggestion[]> {
    const suggestions: InlineCompletionSuggestion[] = [];
    const startTime = Date.now();
    
    // Get pattern-based completions
    const patternCompletions = this.patternProvider.getCompletions(context);
    for (const text of patternCompletions) {
      suggestions.push({
        id: `pattern-${Date.now()}-${Math.random()}`,
        text,
        displayText: text.replace(/\$\d+/g, '█'),
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
        isMultiLine: text.includes('\n'),
        source: 'pattern',
        confidence: 0.8,
        latency: Date.now() - startTime,
        context,
      });
    }
    
    // Try AI completions (if available)
    try {
      const aiCompletion = await this.aiProvider.getCompletion(context);
      if (aiCompletion && aiCompletion.trim()) {
        suggestions.push({
          id: `ai-${Date.now()}-${Math.random()}`,
          text: aiCompletion,
          displayText: aiCompletion,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          isMultiLine: aiCompletion.includes('\n'),
          source: 'ai',
          confidence: 0.9,
          model: this.config.model,
          latency: Date.now() - startTime,
          context,
        });
      }
    } catch {
      // AI not available, continue with pattern completions
    }
    
    // Add context-aware completions
    const contextCompletions = this.getContextCompletions(context, position);
    suggestions.push(...contextCompletions);
    
    // Sort by confidence and limit
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxSuggestions);
  }
  
  /**
   * Get context-aware completions
   */
  private getContextCompletions(
    context: CompletionContext,
    position: Monaco.Position
  ): InlineCompletionSuggestion[] {
    const suggestions: InlineCompletionSuggestion[] = [];
    
    // Continue comment blocks
    if (context.inComment) {
      const commentPrefix = context.lineContent.match(/^(\s*(\/\/|\*|#|\s)\s*)/)?.[0] || '';
      if (commentPrefix) {
        suggestions.push({
          id: `context-comment-${Date.now()}`,
          text: commentPrefix.trimStart(),
          displayText: commentPrefix.trimStart(),
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          isMultiLine: false,
          source: 'context',
          confidence: 0.6,
          context,
        });
      }
    }
    
    // Auto-close brackets and quotes
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
    const lastChar = context.textBeforeCursor.slice(-1);
    if (pairs[lastChar] && !context.textBeforeCursor.endsWith(pairs[lastChar])) {
      suggestions.push({
        id: `context-bracket-${Date.now()}`,
        text: pairs[lastChar],
        displayText: pairs[lastChar],
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
        isMultiLine: false,
        source: 'context',
        confidence: 0.95,
        context,
      });
    }
    
    return suggestions;
  }
  
  /**
   * Create Monaco inline completion result
   */
  private createInlineCompletionResult(
    suggestions: InlineCompletionSuggestion[]
  ): Monaco.languages.InlineCompletions {
    return {
      items: suggestions.map(s => ({
        insertText: s.text,
        range: s.range,
      })),
    };
  }
  
  /**
   * Set loading state
   */
  private setLoading(loading: boolean): void {
    this.loading = loading;
    this.eventEmitter.emit('loading', loading);
  }
  
  /**
   * Check if loading
   */
  isLoading(): boolean {
    return this.loading;
  }
  
  /**
   * Get last suggestion
   */
  getLastSuggestion(): InlineCompletionSuggestion | null {
    return this.lastSuggestion;
  }
  
  /**
   * Accept current suggestion
   */
  acceptSuggestion(): void {
    if (this.lastSuggestion) {
      this.eventEmitter.emit('suggestionAccepted', this.lastSuggestion);
    }
  }
  
  /**
   * Dismiss current suggestion
   */
  dismissSuggestion(): void {
    if (this.lastSuggestion) {
      this.eventEmitter.emit('suggestionDismissed', this.lastSuggestion);
      this.lastSuggestion = null;
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<InlineCompletionConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.cacheSize) {
      this.cache = new CompletionCache(config.cacheSize);
    }
  }
  
  /**
   * Get current configuration
   */
  getConfig(): InlineCompletionConfig {
    return { ...this.config };
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Subscribe to events
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }
  
  /**
   * Unsubscribe from events
   */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create and register inline completion provider
 */
export function registerInlineCompletion(
  monaco: typeof Monaco,
  language: string = 'typescript',
  config?: Partial<InlineCompletionConfig>
): Monaco.IDisposable {
  const provider = new MonacoInlineCompletionProvider(config);
  const monacoProvider = provider.createProvider(monaco);
  
  return monaco.languages.registerInlineCompletionsProvider(language, monacoProvider);
}

/**
 * Create inline completion provider instance
 */
export function createInlineCompletionProvider(
  config?: Partial<InlineCompletionConfig>
): MonacoInlineCompletionProvider {
  return new MonacoInlineCompletionProvider(config);
}

// Export utilities
export { ContextAnalyzer, PatternCompletionProvider, AICompletionProvider, CompletionCache };
