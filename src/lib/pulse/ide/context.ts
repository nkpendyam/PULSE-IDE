// Kyro IDE - Context Engine
// Smart code indexing and semantic context retrieval

import { CodeSymbol, CodeContext, ConversationContext, CodeSnippet, SearchResult, ProjectInfo, GitStatus } from '@/types/ide';
import { EventEmitter } from 'events';

// ============================================================================
// CONTEXT ENGINE
// ============================================================================

export class ContextEngine extends EventEmitter {
  private symbols: Map<string, CodeSymbol[]> = new Map(); // path -> symbols
  private embeddings: Map<string, number[]> = new Map(); // chunk_id -> embedding
  private index: Map<string, string[]> = new Map(); // query_hash -> relevant_paths
  private projectInfo: ProjectInfo | null = null;
  private fileContents: Map<string, string> = new Map();
  private lastIndexed: Map<string, Date> = new Map();

  constructor() {
    super();
  }

  // Index a file's content
  async indexFile(path: string, content: string): Promise<void> {
    this.fileContents.set(path, content);
    
    // Extract symbols
    const symbols = this.extractSymbols(path, content);
    this.symbols.set(path, symbols);
    
    // Create chunks for embedding
    const chunks = this.chunkContent(content, path);
    
    // Update last indexed
    this.lastIndexed.set(path, new Date());
    
    this.emit('file:indexed', { path, symbolCount: symbols.length });
  }

  // Remove a file from index
  removeFile(path: string): void {
    this.fileContents.delete(path);
    this.symbols.delete(path);
    this.lastIndexed.delete(path);
    this.emit('file:removed', { path });
  }

  // Get symbols for a file
  getFileSymbols(path: string): CodeSymbol[] {
    return this.symbols.get(path) || [];
  }

  // Get all symbols
  getAllSymbols(): CodeSymbol[] {
    const allSymbols: CodeSymbol[] = [];
    this.symbols.forEach(symbols => {
      allSymbols.push(...symbols);
    });
    return allSymbols;
  }

  // Find symbol by name
  findSymbol(name: string): CodeSymbol | undefined {
    for (const symbols of this.symbols.values()) {
      for (const symbol of symbols) {
        if (symbol.name === name) {
          return symbol;
        }
      }
    }
    return undefined;
  }

  // Find symbols by type
  findSymbolsByType(type: CodeSymbol['type']): CodeSymbol[] {
    return this.getAllSymbols().filter(s => s.type === type);
  }

  // Search for relevant context
  async searchContext(
    query: string,
    options: {
      maxResults?: number;
      includeCode?: boolean;
      includeSymbols?: boolean;
      maxTokens?: number;
    } = {}
  ): Promise<ConversationContext> {
    const {
      maxResults = 10,
      includeCode = true,
      includeSymbols = true,
      maxTokens = 8000
    } = options;

    const context: ConversationContext = {
      files: [],
      symbols: [],
      codeSnippets: [],
      searchResults: [],
      projectInfo: this.projectInfo || {
        name: 'Unknown Project',
        rootPath: '/',
        language: 'unknown',
        structure: ''
      }
    };

    // Keyword search for relevant files
    const keywords = this.extractKeywords(query);
    const relevantFiles = this.findRelevantFiles(keywords);
    context.files = relevantFiles.slice(0, maxResults);

    // Find relevant symbols
    if (includeSymbols) {
      const relevantSymbols = this.findRelevantSymbols(keywords);
      context.symbols = relevantSymbols.map(s => s.name).slice(0, maxResults);
    }

    // Extract relevant code snippets
    if (includeCode) {
      let tokenCount = 0;
      for (const path of relevantFiles) {
        const content = this.fileContents.get(path);
        if (content) {
          const snippets = this.extractRelevantSnippets(content, keywords, path);
          for (const snippet of snippets) {
            if (tokenCount + snippet.code.length / 4 > maxTokens) break;
            context.codeSnippets.push(snippet);
            tokenCount += snippet.code.length / 4;
          }
        }
        if (context.codeSnippets.length >= maxResults) break;
      }
    }

    return context;
  }

  // Get code context for a specific file and position
  getFileContext(path: string, line: number): CodeContext {
    const symbols = this.symbols.get(path) || [];
    const content = this.fileContents.get(path) || '';
    const lines = content.split('\n');

    return {
      symbols: symbols.filter(s => line >= s.lineStart && line <= s.lineEnd),
      imports: this.extractImports(content),
      exports: this.extractExports(content),
      dependencies: this.extractDependencies(content),
      relatedFiles: this.findRelatedFiles(path),
      summary: this.generateFileSummary(path, content)
    };
  }

  // Set project info
  setProjectInfo(info: ProjectInfo): void {
    this.projectInfo = info;
    this.emit('project:updated', info);
  }

  // Get project info
  getProjectInfo(): ProjectInfo | null {
    return this.projectInfo;
  }

  // Extract symbols from code
  private extractSymbols(path: string, content: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split('\n');
    const ext = path.split('.').pop()?.toLowerCase() || '';

    // Pattern definitions for different languages
    const patterns = this.getSymbolPatterns(ext);

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Check for functions
      const funcMatch = patterns.function.exec(line);
      if (funcMatch) {
        symbols.push({
          id: `${path}:${funcMatch[1]}:${lineNum}`,
          name: funcMatch[1],
          type: 'function',
          path,
          lineStart: lineNum,
          lineEnd: this.findBlockEnd(lines, index),
          signature: funcMatch[0],
          references: [],
          dependencies: []
        });
      }

      // Check for classes
      const classMatch = patterns.class.exec(line);
      if (classMatch) {
        symbols.push({
          id: `${path}:${classMatch[1]}:${lineNum}`,
          name: classMatch[1],
          type: 'class',
          path,
          lineStart: lineNum,
          lineEnd: this.findBlockEnd(lines, index),
          signature: classMatch[0],
          references: [],
          dependencies: []
        });
      }

      // Check for interfaces
      const interfaceMatch = patterns.interface.exec(line);
      if (interfaceMatch) {
        symbols.push({
          id: `${path}:${interfaceMatch[1]}:${lineNum}`,
          name: interfaceMatch[1],
          type: 'interface',
          path,
          lineStart: lineNum,
          lineEnd: this.findBlockEnd(lines, index),
          signature: interfaceMatch[0],
          references: [],
          dependencies: []
        });
      }

      // Check for variables/constants
      const constMatch = patterns.constant.exec(line);
      if (constMatch) {
        symbols.push({
          id: `${path}:${constMatch[1]}:${lineNum}`,
          name: constMatch[1],
          type: 'constant',
          path,
          lineStart: lineNum,
          lineEnd: lineNum,
          signature: constMatch[0],
          references: [],
          dependencies: []
        });
      }
    });

    return symbols;
  }

  // Get symbol patterns for language
  private getSymbolPatterns(ext: string): {
    function: RegExp;
    class: RegExp;
    interface: RegExp;
    constant: RegExp;
  } {
    switch (ext) {
      case 'ts':
      case 'tsx':
        return {
          function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*\w+)?\s*=>/,
          class: /(?:export\s+)?class\s+(\w+)/,
          interface: /(?:export\s+)?interface\s+(\w+)/,
          constant: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::|=\s*(?!async|\()))/
        };
      case 'js':
      case 'jsx':
        return {
          function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
          class: /(?:export\s+)?class\s+(\w+)/,
          interface: /(?:export\s+)?interface\s+(\w+)/,
          constant: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/
        };
      case 'py':
        return {
          function: /def\s+(\w+)\s*\(/,
          class: /class\s+(\w+)(?:\s*\([^)]*\))?:/,
          interface: /class\s+(\w+)\s*\(\s*Protocol\s*\)/,
          constant: /^([A-Z_][A-Z0-9_]*)\s*=/
        };
      case 'rs':
        return {
          function: /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
          class: /(?:pub\s+)?struct\s+(\w+)/,
          interface: /(?:pub\s+)?trait\s+(\w+)/,
          constant: /(?:pub\s+)?const\s+(\w+):/
        };
      case 'go':
        return {
          function: /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/,
          class: /type\s+(\w+)\s+struct/,
          interface: /type\s+(\w+)\s+interface/,
          constant: /const\s+(\w+)\s*=/
        };
      default:
        return {
          function: /function\s+(\w+)/,
          class: /class\s+(\w+)/,
          interface: /interface\s+(\w+)/,
          constant: /const\s+(\w+)/
        };
    }
  }

  // Find block end
  private findBlockEnd(lines: string[], startIndex: number): number {
    let depth = 0;
    let foundOpen = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      // Count braces
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      
      depth += openBraces - closeBraces;
      
      if (openBraces > 0) foundOpen = true;
      if (foundOpen && depth === 0) return i + 1;
    }

    return lines.length;
  }

  // Extract keywords from query
  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of',
      'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
      'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
      'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'i', 'me', 'my',
      'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself']);

    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  // Find relevant files
  private findRelevantFiles(keywords: string[]): string[] {
    const scores = new Map<string, number>();

    this.fileContents.forEach((content, path) => {
      let score = 0;
      const lowerContent = content.toLowerCase();
      const pathLower = path.toLowerCase();

      for (const keyword of keywords) {
        // Path matches
        if (pathLower.includes(keyword)) {
          score += 10;
        }
        // Content frequency
        const regex = new RegExp(keyword, 'gi');
        const matches = lowerContent.match(regex);
        if (matches) {
          score += Math.min(matches.length, 5);
        }
      }

      if (score > 0) {
        scores.set(path, score);
      }
    });

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([path]) => path);
  }

  // Find relevant symbols
  private findRelevantSymbols(keywords: string[]): CodeSymbol[] {
    const allSymbols = this.getAllSymbols();
    const scores = new Map<CodeSymbol, number>();

    for (const symbol of allSymbols) {
      let score = 0;
      const nameLower = symbol.name.toLowerCase();

      for (const keyword of keywords) {
        if (nameLower.includes(keyword)) {
          score += 5;
        }
        if (symbol.signature?.toLowerCase().includes(keyword)) {
          score += 2;
        }
      }

      if (score > 0) {
        scores.set(symbol, score);
      }
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([symbol]) => symbol);
  }

  // Extract relevant code snippets
  private extractRelevantSnippets(
    content: string,
    keywords: string[],
    path: string
  ): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];
    const lines = content.split('\n');
    const ext = path.split('.').pop()?.toLowerCase() || 'txt';

    // Find lines with keyword matches
    const matchLines = new Set<number>();
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      for (const keyword of keywords) {
        if (lineLower.includes(keyword)) {
          // Add surrounding context
          for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 5); j++) {
            matchLines.add(j);
          }
          break;
        }
      }
    }

    // Group consecutive lines into snippets
    const sortedLines = Array.from(matchLines).sort((a, b) => a - b);
    let startLine = -1;
    let currentLines: string[] = [];

    for (const lineNum of sortedLines) {
      if (startLine === -1) {
        startLine = lineNum;
        currentLines = [lines[lineNum]];
      } else if (lineNum === startLine + currentLines.length) {
        currentLines.push(lines[lineNum]);
      } else {
        // Save current snippet
        if (currentLines.length >= 3) {
          snippets.push({
            path,
            code: currentLines.join('\n'),
            language: ext,
            lineStart: startLine + 1,
            lineEnd: startLine + currentLines.length,
            relevance: currentLines.length / 10,
            reason: 'Keyword match'
          });
        }
        startLine = lineNum;
        currentLines = [lines[lineNum]];
      }
    }

    // Save last snippet
    if (currentLines.length >= 3) {
      snippets.push({
        path,
        code: currentLines.join('\n'),
        language: ext,
        lineStart: startLine + 1,
        lineEnd: startLine + currentLines.length,
        relevance: currentLines.length / 10,
        reason: 'Keyword match'
      });
    }

    return snippets;
  }

  // Chunk content for embedding
  private chunkContent(content: string, path: string): string[] {
    const chunks: string[] = [];
    const lines = content.split('\n');
    const chunkSize = 50; // lines per chunk

    for (let i = 0; i < lines.length; i += chunkSize) {
      chunks.push(lines.slice(i, i + chunkSize).join('\n'));
    }

    return chunks;
  }

  // Extract imports
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const patterns = [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /from\s+['"]([^'"]+)['"]\s+import/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }

    return [...new Set(imports)];
  }

  // Extract exports
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const patterns = [
      /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
      /export\s+\{([^}]+)\}/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1].includes(',')) {
          exports.push(...match[1].split(',').map(s => s.trim()));
        } else {
          exports.push(match[1]);
        }
      }
    }

    return [...new Set(exports)];
  }

  // Extract dependencies
  private extractDependencies(content: string): string[] {
    const deps: string[] = [];
    const importPattern = /(?:import|from)\s+['"]([^'"./][^'"]*)['"]/g;
    
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      const dep = match[1].split('/')[0];
      if (dep) deps.push(dep);
    }

    return [...new Set(deps)];
  }

  // Find related files
  private findRelatedFiles(path: string): string[] {
    const content = this.fileContents.get(path);
    if (!content) return [];

    const imports = this.extractImports(content);
    const related: string[] = [];

    this.fileContents.forEach((otherContent, otherPath) => {
      if (otherPath === path) return;

      // Check if file is imported
      for (const imp of imports) {
        if (otherPath.includes(imp) || imp.includes(otherPath.split('/').pop() || '')) {
          related.push(otherPath);
          return;
        }
      }

      // Check if other file imports this
      const otherImports = this.extractImports(otherContent);
      for (const imp of otherImports) {
        if (path.includes(imp) || imp.includes(path.split('/').pop() || '')) {
          related.push(otherPath);
          return;
        }
      }
    });

    return related;
  }

  // Generate file summary
  private generateFileSummary(path: string, content: string): string {
    const symbols = this.symbols.get(path) || [];
    const ext = path.split('.').pop()?.toLowerCase() || '';

    const functions = symbols.filter(s => s.type === 'function');
    const classes = symbols.filter(s => s.type === 'class');
    const interfaces = symbols.filter(s => s.type === 'interface');

    let summary = `${path} - ${ext.toUpperCase()} file\n`;
    if (classes.length > 0) {
      summary += `Classes: ${classes.map(c => c.name).join(', ')}\n`;
    }
    if (interfaces.length > 0) {
      summary += `Interfaces: ${interfaces.map(i => i.name).join(', ')}\n`;
    }
    if (functions.length > 0) {
      summary += `Functions: ${functions.slice(0, 10).map(f => f.name).join(', ')}`;
      if (functions.length > 10) summary += ` and ${functions.length - 10} more`;
    }

    return summary;
  }
}

let contextEngineInstance: ContextEngine | null = null;

export function getContextEngine(): ContextEngine {
  if (!contextEngineInstance) {
    contextEngineInstance = new ContextEngine();
  }
  return contextEngineInstance;
}
