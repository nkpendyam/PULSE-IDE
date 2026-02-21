/**
 * Kyro IDE Search Engine
 * High-performance search with regex, file content, and symbol search
 */

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
  context?: string;
}

export interface FileMatch {
  path: string;
  matches: SearchResult[];
  modified: Date;
  size: number;
}

export interface SearchOptions {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  includePattern?: string;
  excludePattern?: string;
  maxResults?: number;
  contextLines?: number;
}

export interface ReplaceOptions extends SearchOptions {
  replacement: string;
  replaceAll?: boolean;
}

export interface SymbolResult {
  name: string;
  kind: 'class' | 'interface' | 'function' | 'variable' | 'constant' | 'import' | 'other';
  file: string;
  line: number;
  column: number;
  container?: string;
  signature?: string;
}

// ============================================================================
// SEARCH ENGINE
// ============================================================================

export class SearchEngine {
  private searchHistory: string[] = [];
  private maxHistory = 50;

  /**
   * Search in text content
   */
  searchInContent(content: string, options: SearchOptions): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = content.split('\n');

    let pattern: RegExp;
    try {
      if (options.regex) {
        pattern = new RegExp(options.query, options.caseSensitive ? 'g' : 'gi');
      } else {
        let escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (options.wholeWord) {
          escaped = `\\b${escaped}\\b`;
        }
        pattern = new RegExp(escaped, options.caseSensitive ? 'g' : 'gi');
      }
    } catch {
      return results;
    }

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(line)) !== null) {
        const contextLines = options.contextLines || 2;
        const contextStart = Math.max(0, lineIndex - contextLines);
        const contextEnd = Math.min(lines.length - 1, lineIndex + contextLines);
        const context = lines.slice(contextStart, contextEnd + 1).join('\n');

        results.push({
          file: '',
          line: lineIndex + 1,
          column: match.index + 1,
          text: line,
          matchStart: match.index,
          matchEnd: match.index + match[0].length,
          context,
        });

        if (options.maxResults && results.length >= options.maxResults) {
          return results;
        }
      }
    }

    return results;
  }

  /**
   * Replace in content
   */
  replaceInContent(content: string, options: ReplaceOptions): { result: string; count: number } {
    let pattern: RegExp;
    try {
      if (options.regex) {
        pattern = new RegExp(options.query, options.caseSensitive ? 'g' : 'gi');
      } else {
        let escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (options.wholeWord) {
          escaped = `\\b${escaped}\\b`;
        }
        pattern = new RegExp(escaped, options.caseSensitive ? 'g' : 'gi');
      }
    } catch {
      return { result: content, count: 0 };
    }

    let count = 0;
    const result = content.replace(pattern, (match) => {
      count++;
      if (!options.replaceAll && count > 1) return match;
      
      // Handle replace with capture groups
      if (options.regex) {
        return options.replacement.replace(/\$(\d+)/g, (_, num) => {
          const groups = match.match(pattern);
          return groups ? groups[parseInt(num)] || '' : '';
        });
      }
      return options.replacement;
    });

    return { result, count };
  }

  /**
   * Search files by name pattern
   */
  searchFiles(files: string[], pattern: string, caseSensitive = false): string[] {
    const regex = new RegExp(
      pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
      caseSensitive ? '' : 'i'
    );
    return files.filter(f => regex.test(f));
  }

  /**
   * Extract symbols from code
   */
  extractSymbols(content: string, filename: string): SymbolResult[] {
    const symbols: SymbolResult[] = [];
    const ext = filename.split('.').pop()?.toLowerCase();

    if (['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) {
      return this.extractJSSymbols(content, filename);
    } else if (ext === 'py') {
      return this.extractPythonSymbols(content, filename);
    } else if (ext === 'rs') {
      return this.extractRustSymbols(content, filename);
    } else if (ext === 'go') {
      return this.extractGoSymbols(content, filename);
    }

    return symbols;
  }

  private extractJSSymbols(content: string, filename: string): SymbolResult[] {
    const symbols: SymbolResult[] = [];
    const lines = content.split('\n');

    // Class patterns
    const classPattern = /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/;
    const interfacePattern = /^(?:export\s+)?interface\s+(\w+)/;
    const functionPattern = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/;
    const arrowPattern = /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/;
    const constPattern = /^(?:export\s+)?const\s+([A-Z_][A-Z0-9_]*)\s*=/;
    const importPattern = /^import\s+.*from\s+['"]([^'"]+)['"]/;

    let currentClass = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const classMatch = line.match(classPattern);
      if (classMatch) {
        currentClass = classMatch[1];
        symbols.push({
          name: classMatch[1],
          kind: 'class',
          file: filename,
          line: i + 1,
          column: line.indexOf(classMatch[1]) + 1,
        });
        continue;
      }

      const interfaceMatch = line.match(interfacePattern);
      if (interfaceMatch) {
        symbols.push({
          name: interfaceMatch[1],
          kind: 'interface',
          file: filename,
          line: i + 1,
          column: line.indexOf(interfaceMatch[1]) + 1,
        });
        continue;
      }

      const funcMatch = line.match(functionPattern);
      if (funcMatch) {
        symbols.push({
          name: funcMatch[1],
          kind: 'function',
          file: filename,
          line: i + 1,
          column: line.indexOf(funcMatch[1]) + 1,
          container: currentClass || undefined,
        });
        continue;
      }

      const arrowMatch = line.match(arrowPattern);
      if (arrowMatch) {
        symbols.push({
          name: arrowMatch[1],
          kind: 'function',
          file: filename,
          line: i + 1,
          column: line.indexOf(arrowMatch[1]) + 1,
        });
        continue;
      }

      const constMatch = line.match(constPattern);
      if (constMatch) {
        symbols.push({
          name: constMatch[1],
          kind: 'constant',
          file: filename,
          line: i + 1,
          column: line.indexOf(constMatch[1]) + 1,
        });
      }
    }

    return symbols;
  }

  private extractPythonSymbols(content: string, filename: string): SymbolResult[] {
    const symbols: SymbolResult[] = [];
    const lines = content.split('\n');

    const classPattern = /^class\s+(\w+)/;
    const funcPattern = /^def\s+(\w+)/;
    const asyncPattern = /^async\s+def\s+(\w+)/;

    let currentClass = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const classMatch = line.match(classPattern);
      if (classMatch) {
        currentClass = classMatch[1];
        symbols.push({
          name: classMatch[1],
          kind: 'class',
          file: filename,
          line: i + 1,
          column: line.indexOf(classMatch[1]) + 1,
        });
        continue;
      }

      const asyncMatch = line.match(asyncPattern);
      if (asyncMatch) {
        symbols.push({
          name: asyncMatch[1],
          kind: 'function',
          file: filename,
          line: i + 1,
          column: line.indexOf(asyncMatch[1]) + 1,
          container: currentClass || undefined,
        });
        continue;
      }

      const funcMatch = line.match(funcPattern);
      if (funcMatch && !line.startsWith('    ')) {
        symbols.push({
          name: funcMatch[1],
          kind: 'function',
          file: filename,
          line: i + 1,
          column: line.indexOf(funcMatch[1]) + 1,
        });
      }
    }

    return symbols;
  }

  private extractRustSymbols(content: string, filename: string): SymbolResult[] {
    const symbols: SymbolResult[] = [];
    const lines = content.split('\n');

    const patterns = [
      { regex: /^(?:pub\s+)?struct\s+(\w+)/, kind: 'class' as const },
      { regex: /^(?:pub\s+)?enum\s+(\w+)/, kind: 'class' as const },
      { regex: /^(?:pub\s+)?fn\s+(\w+)/, kind: 'function' as const },
      { regex: /^(?:pub\s+)?const\s+(\w+)/, kind: 'constant' as const },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { regex, kind } of patterns) {
        const match = line.match(regex);
        if (match) {
          symbols.push({
            name: match[1],
            kind,
            file: filename,
            line: i + 1,
            column: line.indexOf(match[1]) + 1,
          });
          break;
        }
      }
    }

    return symbols;
  }

  private extractGoSymbols(content: string, filename: string): SymbolResult[] {
    const symbols: SymbolResult[] = [];
    const lines = content.split('\n');

    const patterns = [
      { regex: /^type\s+(\w+)\s+struct/, kind: 'class' as const },
      { regex: /^type\s+(\w+)\s+interface/, kind: 'interface' as const },
      { regex: /^func\s+(\w+)\(/, kind: 'function' as const },
      { regex: /^func\s+\(\w+\s+\*?\w+\)\s+(\w+)\(/, kind: 'function' as const },
      { regex: /^const\s+(\w+)/, kind: 'constant' as const },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { regex, kind } of patterns) {
        const match = line.match(regex);
        if (match) {
          symbols.push({
            name: match[1],
            kind,
            file: filename,
            line: i + 1,
            column: line.indexOf(match[1]) + 1,
          });
          break;
        }
      }
    }

    return symbols;
  }

  /**
   * Add to search history
   */
  addToHistory(query: string): void {
    const index = this.searchHistory.indexOf(query);
    if (index > -1) this.searchHistory.splice(index, 1);
    this.searchHistory.unshift(query);
    if (this.searchHistory.length > this.maxHistory) {
      this.searchHistory.pop();
    }
  }

  /**
   * Get search history
   */
  getHistory(): string[] {
    return [...this.searchHistory];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.searchHistory = [];
  }
}

// Singleton export
export const searchEngine = new SearchEngine();
