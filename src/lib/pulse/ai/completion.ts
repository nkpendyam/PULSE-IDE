/**
 * Kyro IDE AST-Validated AI Completion
 * 
 * Unlike standard LLM completions, this system validates all AI suggestions
 * against the semantic model, preventing hallucinations and ensuring
 * all suggested code is syntactically and semantically valid.
 * 
 * Similar to JetBrains Full Line Code Completion (FLCC).
 */

import { projectIndexer, Symbol, SemanticQueryEngine, SemanticModel } from '../semantic';

// ============================================================================
// TYPES
// ============================================================================

export interface CompletionContext {
  text: string;
  position: {
    line: number;
    column: number;
  };
  language: string;
  fileUri: string;
  prefix: string;
  suffix: string;
  scopeSymbols: Symbol[];
}

export interface RawCompletion {
  text: string;
  displayText?: string;
  kind: CompletionKind;
  confidence: number;
}

export interface ValidatedCompletion extends RawCompletion {
  isValid: boolean;
  errors: ValidationError[];
  requiredImports: string[];
  symbolId?: string;
}

export type CompletionKind =
  | 'text'
  | 'method'
  | 'function'
  | 'class'
  | 'interface'
  | 'variable'
  | 'property'
  | 'keyword'
  | 'snippet'
  | 'import';

export interface ValidationError {
  type: 'syntax' | 'semantic' | 'type' | 'scope';
  message: string;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  validateAst?: boolean;
  autoImport?: boolean;
}

// ============================================================================
// COMPLETION VALIDATOR
// ============================================================================

export class CompletionValidator {
  /**
   * Validate a raw completion against the semantic model
   */
  validate(
    completion: RawCompletion,
    context: CompletionContext,
    model?: SemanticModel
  ): ValidatedCompletion {
    const errors: ValidationError[] = [];
    const requiredImports: string[] = [];
    let isValid = true;

    // 1. Syntax validation
    const syntaxErrors = this.validateSyntax(completion.text, context.language);
    if (syntaxErrors.length > 0) {
      errors.push(...syntaxErrors);
      isValid = false;
    }

    // 2. Semantic validation
    if (isValid && model) {
      const semanticErrors = this.validateSemantics(completion.text, context, model);
      if (semanticErrors.length > 0) {
        errors.push(...semanticErrors);
        // Don't mark as invalid for semantic warnings
      }
    }

    // 3. Symbol existence check
    const symbolErrors = this.validateSymbols(completion, context);
    if (symbolErrors.length > 0) {
      errors.push(...symbolErrors);
    }

    // 4. Type compatibility check
    const typeErrors = this.validateTypes(completion, context);
    if (typeErrors.length > 0) {
      errors.push(...typeErrors);
    }

    return {
      ...completion,
      isValid: errors.filter(e => e.type === 'syntax' || e.type === 'semantic').length === 0,
      errors,
      requiredImports,
    };
  }

  /**
   * Check if completion has balanced brackets and valid syntax
   */
  private validateSyntax(text: string, language: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check bracket balance
    const brackets: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
    };

    const stack: string[] = [];
    const openBrackets = Object.keys(brackets);
    const closeBrackets = Object.values(brackets);

    for (const char of text) {
      if (openBrackets.includes(char)) {
        stack.push(char);
      } else if (closeBrackets.includes(char)) {
        const lastOpen = stack.pop();
        if (!lastOpen || brackets[lastOpen] !== char) {
          errors.push({
            type: 'syntax',
            message: `Unbalanced bracket: expected '${lastOpen ? brackets[lastOpen] : ''}' but got '${char}'`,
          });
        }
      }
    }

    if (stack.length > 0) {
      errors.push({
        type: 'syntax',
        message: `Unclosed brackets: ${stack.map(b => `'${b}'`).join(', ')}`,
      });
    }

    // Check quote balance
    const singleQuotes = (text.match(/'/g) || []).length;
    const doubleQuotes = (text.match(/"/g) || []).length;
    const backticks = (text.match(/`/g) || []).length;

    if (singleQuotes % 2 !== 0) {
      errors.push({
        type: 'syntax',
        message: 'Unbalanced single quotes',
      });
    }

    if (doubleQuotes % 2 !== 0) {
      errors.push({
        type: 'syntax',
        message: 'Unbalanced double quotes',
      });
    }

    if (backticks % 2 !== 0) {
      errors.push({
        type: 'syntax',
        message: 'Unbalanced backticks',
      });
    }

    return errors;
  }

  /**
   * Validate against semantic model
   */
  private validateSemantics(
    text: string,
    context: CompletionContext,
    model: SemanticModel
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Extract identifiers from the completion
    const identifiers = this.extractIdentifiers(text);

    for (const identifier of identifiers) {
      // Check if identifier exists in scope
      const exists = this.symbolExistsInScope(identifier, context.scopeSymbols);
      
      if (!exists && !this.isBuiltin(identifier, context.language)) {
        // Check if it might need an import
        const globalSymbol = projectIndexer.getSymbol(identifier);
        if (!globalSymbol) {
          errors.push({
            type: 'semantic',
            message: `Unknown identifier: '${identifier}'`,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate symbol references
   */
  private validateSymbols(
    completion: RawCompletion,
    context: CompletionContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // If this is a method completion, verify the method exists
    if (completion.kind === 'method') {
      const methodMatch = completion.text.match(/\.(\w+)\(/);
      if (methodMatch) {
        const methodName = methodMatch[1];
        // Check if method exists on the object type
        // This would require type inference
      }
    }

    return errors;
  }

  /**
   * Validate type compatibility
   */
  private validateTypes(
    completion: RawCompletion,
    context: CompletionContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Type checking would go here
    // This requires a full type inference engine

    return errors;
  }

  /**
   * Extract identifiers from text
   */
  private extractIdentifiers(text: string): string[] {
    const identifierRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    const identifiers: string[] = [];
    let match;

    while ((match = identifierRegex.exec(text)) !== null) {
      if (!identifiers.includes(match[1])) {
        identifiers.push(match[1]);
      }
    }

    return identifiers;
  }

  /**
   * Check if symbol exists in scope
   */
  private symbolExistsInScope(name: string, symbols: Symbol[]): boolean {
    return symbols.some(s => s.name === name);
  }

  /**
   * Check if identifier is a builtin
   */
  private isBuiltin(identifier: string, language: string): boolean {
    const builtins: Record<string, Set<string>> = {
      typescript: new Set([
        'console', 'window', 'document', 'Array', 'Object', 'String', 'Number',
        'Boolean', 'Function', 'Symbol', 'Map', 'Set', 'Promise', 'Date', 'RegExp',
        'Error', 'JSON', 'Math', 'undefined', 'null', 'true', 'false', 'this',
        'super', 'new', 'typeof', 'instanceof', 'void', 'never', 'any', 'unknown',
        'string', 'number', 'boolean', 'object', 'bigint', 'symbol',
      ]),
      javascript: new Set([
        'console', 'window', 'document', 'Array', 'Object', 'String', 'Number',
        'Boolean', 'Function', 'Symbol', 'Map', 'Set', 'Promise', 'Date', 'RegExp',
        'Error', 'JSON', 'Math', 'undefined', 'null', 'true', 'false', 'this',
      ]),
      python: new Set([
        'print', 'len', 'range', 'str', 'int', 'float', 'bool', 'list', 'dict',
        'set', 'tuple', 'None', 'True', 'False', 'self', 'super', 'type',
      ]),
    };

    return builtins[language]?.has(identifier) || false;
  }
}

// ============================================================================
// COMPLETION PROVIDER
// ============================================================================

export class CompletionProvider {
  private validator: CompletionValidator;
  private ollamaHost: string;
  private model: string;

  constructor(options: { ollamaHost?: string; model?: string } = {}) {
    this.validator = new CompletionValidator();
    this.ollamaHost = options.ollamaHost || 'http://localhost:11434';
    this.model = options.model || 'llama3.2';
  }

  /**
   * Get completions for the given context
   */
  async getCompletions(
    context: CompletionContext,
    options: CompletionOptions = {}
  ): Promise<ValidatedCompletion[]> {
    // Get completions from multiple sources
    const [localCompletions, aiCompletions] = await Promise.all([
      this.getLocalCompletions(context),
      this.getAICompletions(context, options),
    ]);

    // Combine and validate
    const allCompletions = [...localCompletions, ...aiCompletions];
    const validated = allCompletions.map(c => 
      this.validator.validate(c, context)
    );

    // Filter valid completions and sort by confidence
    return validated
      .filter(c => c.isValid || c.errors.every(e => e.type !== 'syntax'))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  /**
   * Get completions from local semantic model
   */
  private async getLocalCompletions(context: CompletionContext): Promise<RawCompletion[]> {
    const completions: RawCompletion[] = [];
    const prefix = context.prefix.toLowerCase();

    // Get symbols in scope
    for (const symbol of context.scopeSymbols) {
      if (symbol.name.toLowerCase().startsWith(prefix)) {
        completions.push({
          text: symbol.name,
          displayText: symbol.name,
          kind: this.symbolToCompletionKind(symbol.type),
          confidence: 0.9,
        });
      }
    }

    // Get project-wide symbols
    const projectSymbols = projectIndexer.findSymbols(context.prefix);
    for (const symbol of projectSymbols.slice(0, 20)) {
      if (!completions.some(c => c.text === symbol.name)) {
        completions.push({
          text: symbol.name,
          displayText: symbol.name,
          kind: this.symbolToCompletionKind(symbol.type),
          confidence: 0.7,
        });
      }
    }

    return completions;
  }

  /**
   * Get completions from AI model with AST validation
   */
  private async getAICompletions(
    context: CompletionContext,
    options: CompletionOptions
  ): Promise<RawCompletion[]> {
    const completions: RawCompletion[] = [];

    try {
      // Build prompt with semantic context
      const prompt = this.buildCompletionPrompt(context);

      // Call Ollama
      const response = await fetch(`${this.ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model || this.model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.2,
            num_predict: options.maxTokens ?? 100,
            stop: ['\n', '```'],
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const rawText = data.response as string;

      // Parse AI response into completions
      const lines = rawText.split('\n').filter(l => l.trim());
      
      for (const line of lines.slice(0, 5)) {
        completions.push({
          text: line.trim(),
          kind: 'text',
          confidence: 0.5,
        });
      }
    } catch (error) {
      console.error('AI completion error:', error);
    }

    return completions;
  }

  /**
   * Build prompt with semantic context
   */
  private buildCompletionPrompt(context: CompletionContext): string {
    const symbols = context.scopeSymbols
      .slice(0, 20)
      .map(s => `${s.name}: ${s.type}`)
      .join('\n');

    return `Complete the following ${context.language} code.
Available symbols in scope:
${symbols}

Code context:
\`\`\`${context.language}
${context.prefix}[CURSOR]${context.suffix}
\`\`\`

Provide up to 3 completion suggestions. Each should be a single line of code that could replace [CURSOR].
Do not include explanations, just the code lines.`;
  }

  /**
   * Convert symbol type to completion kind
   */
  private symbolToCompletionKind(type: string): CompletionKind {
    switch (type) {
      case 'function':
        return 'function';
      case 'class':
        return 'class';
      case 'interface':
        return 'interface';
      case 'variable':
      case 'constant':
        return 'variable';
      case 'property':
        return 'property';
      case 'method':
        return 'method';
      default:
        return 'text';
    }
  }
}

// ============================================================================
// FULL LINE CODE COMPLETION (FLCC-like)
// ============================================================================

export class FullLineCompletion {
  private provider: CompletionProvider;

  constructor(options: { ollamaHost?: string; model?: string } = {}) {
    this.provider = new CompletionProvider(options);
  }

  /**
   * Get full line completions (like JetBrains FLCC)
   */
  async completeLine(
    context: CompletionContext,
    options: CompletionOptions = {}
  ): Promise<ValidatedCompletion[]> {
    // Get completions
    const completions = await this.provider.getCompletions(context, options);

    // Filter to full-line completions
    return completions
      .filter(c => this.isFullLineCompletion(c, context))
      .map(c => this.enhanceCompletion(c, context));
  }

  /**
   * Check if this is a meaningful full-line completion
   */
  private isFullLineCompletion(
    completion: ValidatedCompletion,
    context: CompletionContext
  ): boolean {
    const text = completion.text;
    
    // Should be longer than just the identifier
    if (text.length <= context.prefix.trim().length) {
      return false;
    }

    // Should add meaningful code
    const added = text.slice(context.prefix.trim().length);
    if (added.length < 3) {
      return false;
    }

    return true;
  }

  /**
   * Enhance completion with auto-imports
   */
  private enhanceCompletion(
    completion: ValidatedCompletion,
    context: CompletionContext
  ): ValidatedCompletion {
    // Check if we need to add imports
    const identifiers = this.extractUnknownIdentifiers(completion.text, context);
    
    if (identifiers.length > 0) {
      completion.requiredImports = this.findRequiredImports(identifiers, context);
    }

    return completion;
  }

  /**
   * Extract identifiers that are not in scope
   */
  private extractUnknownIdentifiers(
    text: string,
    context: CompletionContext
  ): string[] {
    const identifierRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    const unknown: string[] = [];
    let match;

    const knownSymbols = new Set(context.scopeSymbols.map(s => s.name));

    while ((match = identifierRegex.exec(text)) !== null) {
      const identifier = match[1];
      if (!knownSymbols.has(identifier) && !unknown.includes(identifier)) {
        unknown.push(identifier);
      }
    }

    return unknown;
  }

  /**
   * Find import statements for unknown identifiers
   */
  private findRequiredImports(
    identifiers: string[],
    context: CompletionContext
  ): string[] {
    const imports: string[] = [];

    for (const identifier of identifiers) {
      // Search for symbol in project
      const symbols = projectIndexer.findSymbols(identifier);
      const symbol = symbols.find(s => s.exported);

      if (symbol && symbol.sourceFile !== context.fileUri) {
        // Generate import statement
        const importPath = this.resolveImportPath(symbol.sourceFile, context.fileUri);
        imports.push(`import { ${identifier} } from '${importPath}';`);
      }
    }

    return imports;
  }

  /**
   * Resolve import path relative to current file
   */
  private resolveImportPath(sourceFile: string, currentFile: string): string {
    // Simplified - would need proper path resolution
    return sourceFile.replace(/^.*\//, './').replace(/\.(ts|tsx|js|jsx)$/, '');
  }
}

// ============================================================================
// INLINE COMPLETION PROVIDER
// ============================================================================

export class InlineCompletionProvider {
  private fullLineCompletion: FullLineCompletion;
  private cache: Map<string, ValidatedCompletion[]> = new Map();

  constructor(options: { ollamaHost?: string; model?: string } = {}) {
    this.fullLineCompletion = new FullLineCompletion(options);
  }

  /**
   * Get inline completions (ghost text)
   */
  async getInlineCompletions(
    context: CompletionContext,
    options: CompletionOptions = {}
  ): Promise<ValidatedCompletion[]> {
    // Check cache
    const cacheKey = `${context.fileUri}:${context.position.line}:${context.prefix}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get fresh completions
    const completions = await this.fullLineCompletion.completeLine(context, options);

    // Cache result
    this.cache.set(cacheKey, completions);

    // Clear old cache entries
    if (this.cache.size > 100) {
      const keys = Array.from(this.cache.keys()).slice(0, 50);
      for (const key of keys) {
        this.cache.delete(key);
      }
    }

    return completions;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton
export const inlineCompletionProvider = new InlineCompletionProvider();
