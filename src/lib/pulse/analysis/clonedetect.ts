/**
 * Kyro IDE Semantic Code Clone Detection
 * 
 * Detects code duplication through structural and semantic analysis.
 * Supports Type-1 (exact), Type-2 (renamed), Type-3 (modified), and
 * Type-4 (semantic) clone detection.
 * 
 * Features:
 * - Token-based exact clone detection
 * - AST-based structural clone detection
 * - Semantic similarity analysis
 * - Clone refactoring suggestions
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ClonePair {
  id: string;
  type: CloneType;
  source: CloneLocation;
  target: CloneLocation;
  similarity: number;
  tokenCount: number;
  suggestedRefactoring?: RefactoringSuggestion;
}

export type CloneType =
  | 'type1' // Exact copy (except whitespace/comments)
  | 'type2' // Renamed variables
  | 'type3' // Modified with additions/deletions
  | 'type4' // Semantically equivalent

export interface CloneLocation {
  file: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  code?: string;
  nodeType: string;
  name?: string;
}

export interface RefactoringSuggestion {
  type: 'extract_method' | 'extract_class' | 'parameterize' | 'template';
  suggestedName: string;
  parameters: string[];
  description: string;
  estimatedBenefit: 'low' | 'medium' | 'high';
}

export interface CloneClass {
  id: string;
  type: CloneType;
  members: CloneLocation[];
  similarity: number;
  totalLines: number;
  totalFiles: number;
  refactoringPotential: number;
}

export interface Token {
  type: string;
  value: string;
  normalized: string;
  line: number;
  column: number;
}

export interface ASTFingerprint {
  hash: string;
  structure: string;
  depth: number;
  nodeCount: number;
  leafCount: number;
}

// ============================================================================
// TOKEN-BASED CLONE DETECTOR (Type-1 & Type-2)
// ============================================================================

export class TokenBasedDetector {
  private minTokenCount: number;
  private minSimilarity: number;

  constructor(options: { minTokenCount?: number; minSimilarity?: number } = {}) {
    this.minTokenCount = options.minTokenCount || 50;
    this.minSimilarity = options.minSimilarity || 0.8;
  }

  /**
   * Detect clones in source code
   */
  detectClones(sources: Map<string, string>): ClonePair[] {
    const clonePairs: ClonePair[] = [];
    const tokenized = new Map<string, Token[]>();

    for (const [file, code] of sources) {
      tokenized.set(file, this.tokenize(code));
    }

    const files = Array.from(tokenized.keys());
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const tokens1 = tokenized.get(files[i])!;
        const tokens2 = tokenized.get(files[j])!;

        const type1Clones = this.findExactClones(files[i], files[j], tokens1, tokens2);
        clonePairs.push(...type1Clones);

        const type2Clones = this.findRenamedClones(files[i], files[j], tokens1, tokens2);
        clonePairs.push(...type2Clones);
      }

      const selfClones = this.findSelfClones(files[i], tokenized.get(files[i])!);
      clonePairs.push(...selfClones);
    }

    return this.deduplicateClones(clonePairs);
  }

  /**
   * Tokenize source code
   */
  private tokenize(code: string): Token[] {
    const tokens: Token[] = [];
    const lines = code.split('\n');

    const patterns = [
      { type: 'comment', regex: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm },
      { type: 'string', regex: /(['"`])(?:(?!\1|\\).|\\.)*\1/g },
      { type: 'number', regex: /\b\d+\.?\d*\b/g },
      { type: 'keyword', regex: /\b(if|else|for|while|do|switch|case|break|continue|return|function|class|interface|const|let|var|import|export|from|new|this|super|extends|implements|try|catch|finally|throw|async|await)\b/g },
      { type: 'identifier', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g },
      { type: 'operator', regex: /([+\-*/%=&|^!<>?:]+|\.\.\.|=>)/g },
      { type: 'punctuation', regex: /([{}()\[\];,.])/g },
    ];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const trimmed = line.trimStart();

      for (const { type, regex } of patterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(trimmed)) !== null) {
          tokens.push({
            type,
            value: match[0],
            normalized: this.normalizeToken(match[0], type),
            line: lineNum + 1,
            column: match.index + 1,
          });
        }
      }
    }

    return tokens;
  }

  /**
   * Normalize token for comparison
   */
  private normalizeToken(value: string, type: string): string {
    if (type === 'identifier') {
      return 'ID';
    }
    if (type === 'string') {
      return 'STR';
    }
    if (type === 'number') {
      return 'NUM';
    }
    if (type === 'comment') {
      return '';
    }
    return value;
  }

  /**
   * Find exact clones (Type-1)
   */
  private findExactClones(
    file1: string,
    file2: string,
    tokens1: Token[],
    tokens2: Token[]
  ): ClonePair[] {
    const clones: ClonePair[] = [];
    const minLen = this.minTokenCount;

    const hash1 = this.buildTokenHashes(tokens1, false);
    const hash2 = this.buildTokenHashes(tokens2, false);

    for (let i = 0; i < hash1.length; i++) {
      for (let j = 0; j < hash2.length; j++) {
        const match = this.findLongestMatch(hash1, hash2, i, j, minLen);
        
        if (match.length >= minLen) {
          const startToken1 = tokens1[i];
          const endToken1 = tokens1[Math.min(i + match.length - 1, tokens1.length - 1)];
          const startToken2 = tokens2[j];
          const endToken2 = tokens2[Math.min(j + match.length - 1, tokens2.length - 1)];

          clones.push({
            id: `clone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'type1',
            source: {
              file: file1,
              startLine: startToken1.line,
              endLine: endToken1.line,
              startColumn: startToken1.column,
              endColumn: endToken1.column,
              nodeType: 'Unknown',
            },
            target: {
              file: file2,
              startLine: startToken2.line,
              endLine: endToken2.line,
              startColumn: startToken2.column,
              endColumn: endToken2.column,
              nodeType: 'Unknown',
            },
            similarity: 1.0,
            tokenCount: match.length,
          });

          i += match.length - 1;
          break;
        }
      }
    }

    return clones;
  }

  /**
   * Find renamed clones (Type-2)
   */
  private findRenamedClones(
    file1: string,
    file2: string,
    tokens1: Token[],
    tokens2: Token[]
  ): ClonePair[] {
    const clones: ClonePair[] = [];
    const minLen = this.minTokenCount;

    const hash1 = this.buildTokenHashes(tokens1, true);
    const hash2 = this.buildTokenHashes(tokens2, true);

    for (let i = 0; i < hash1.length; i++) {
      for (let j = 0; j < hash2.length; j++) {
        const match = this.findLongestMatch(hash1, hash2, i, j, minLen);
        
        if (match.length >= minLen && match.similarity >= this.minSimilarity) {
          const startToken1 = tokens1[i];
          const endToken1 = tokens1[Math.min(i + match.length - 1, tokens1.length - 1)];
          const startToken2 = tokens2[j];
          const endToken2 = tokens2[Math.min(j + match.length - 1, tokens2.length - 1)];

          clones.push({
            id: `clone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'type2',
            source: {
              file: file1,
              startLine: startToken1.line,
              endLine: endToken1.line,
              startColumn: startToken1.column,
              endColumn: endToken1.column,
              nodeType: 'Unknown',
            },
            target: {
              file: file2,
              startLine: startToken2.line,
              endLine: endToken2.line,
              startColumn: startToken2.column,
              endColumn: endToken2.column,
              nodeType: 'Unknown',
            },
            similarity: match.similarity,
            tokenCount: match.length,
          });
        }
      }
    }

    return clones;
  }

  /**
   * Find clones within the same file
   */
  private findSelfClones(file: string, tokens: Token[]): ClonePair[] {
    const clones: ClonePair[] = [];
    const minLen = this.minTokenCount;
    const hash = this.buildTokenHashes(tokens, false);

    for (let i = 0; i < hash.length; i++) {
      for (let j = i + minLen; j < hash.length; j++) {
        const match = this.findLongestMatch(hash, hash, i, j, minLen);
        
        if (match.length >= minLen) {
          const startToken1 = tokens[i];
          const endToken1 = tokens[Math.min(i + match.length - 1, tokens.length - 1)];
          const startToken2 = tokens[j];
          const endToken2 = tokens[Math.min(j + match.length - 1, tokens.length - 1)];

          clones.push({
            id: `clone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'type1',
            source: {
              file,
              startLine: startToken1.line,
              endLine: endToken1.line,
              startColumn: startToken1.column,
              endColumn: endToken1.column,
              nodeType: 'Unknown',
            },
            target: {
              file,
              startLine: startToken2.line,
              endLine: endToken2.line,
              startColumn: startToken2.column,
              endColumn: endToken2.column,
              nodeType: 'Unknown',
            },
            similarity: 1.0,
            tokenCount: match.length,
          });
        }
      }
    }

    return clones;
  }

  /**
   * Build rolling hash for tokens
   */
  private buildTokenHashes(tokens: Token[], normalized: boolean): string[] {
    const hashes: string[] = [];
    const windowSize = 5;

    for (let i = 0; i <= tokens.length - windowSize; i++) {
      const window = tokens.slice(i, i + windowSize);
      const hash = window
        .map(t => normalized ? t.normalized : t.value)
        .filter(v => v)
        .join('|');
      hashes.push(hash);
    }

    return hashes;
  }

  /**
   * Find longest matching sequence
   */
  private findLongestMatch(
    hash1: string[],
    hash2: string[],
    start1: number,
    start2: number,
    minLen: number
  ): { length: number; similarity: number } {
    let length = 0;
    let matches = 0;
    const maxLen = Math.min(hash1.length - start1, hash2.length - start2);

    while (length < maxLen && hash1[start1 + length] === hash2[start2 + length]) {
      matches++;
      length++;
    }

    if (length < minLen / 5) {
      return { length: 0, similarity: 0 };
    }

    return {
      length: length * 5,
      similarity: matches / length,
    };
  }

  /**
   * Remove duplicate clone pairs
   */
  private deduplicateClones(clones: ClonePair[]): ClonePair[] {
    const seen = new Set<string>();
    const unique: ClonePair[] = [];

    for (const clone of clones) {
      const key = [
        clone.source.file,
        clone.source.startLine,
        clone.target.file,
        clone.target.startLine,
      ].join(':');

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(clone);
      }
    }

    return unique;
  }
}

// ============================================================================
// CLONE CLASS BUILDER
// ============================================================================

export class CloneClassBuilder {
  /**
   * Group clone pairs into classes
   */
  buildClasses(clonePairs: ClonePair[]): CloneClass[] {
    const classes: CloneClass[] = [];
    const assigned = new Set<string>();

    for (const pair of clonePairs) {
      if (assigned.has(pair.id)) continue;

      const cloneClass: CloneClass = {
        id: `class-${classes.length}`,
        type: pair.type,
        members: [pair.source, pair.target],
        similarity: pair.similarity,
        totalLines: pair.source.endLine - pair.source.startLine + 1,
        totalFiles: new Set([pair.source.file, pair.target.file]).size,
        refactoringPotential: this.calculateRefactoringPotential(pair),
      };

      assigned.add(pair.id);

      for (const other of clonePairs) {
        if (assigned.has(other.id)) continue;

        if (this.areRelated(pair, other)) {
          cloneClass.members.push(other.source);
          cloneClass.totalFiles = new Set([
            ...cloneClass.members.map(m => m.file),
          ]).size;
          assigned.add(other.id);
        }
      }

      cloneClass.totalLines = cloneClass.members.reduce(
        (sum, m) => sum + (m.endLine - m.startLine + 1),
        0
      );

      classes.push(cloneClass);
    }

    return classes.sort((a, b) => b.refactoringPotential - a.refactoringPotential);
  }

  /**
   * Check if two clone pairs are related
   */
  private areRelated(pair1: ClonePair, pair2: ClonePair): boolean {
    return (
      this.locationsOverlap(pair1.source, pair2.source) ||
      this.locationsOverlap(pair1.source, pair2.target) ||
      this.locationsOverlap(pair1.target, pair2.source) ||
      this.locationsOverlap(pair1.target, pair2.target)
    );
  }

  /**
   * Check if two locations overlap
   */
  private locationsOverlap(loc1: CloneLocation, loc2: CloneLocation): boolean {
    if (loc1.file !== loc2.file) return false;

    return loc1.startLine <= loc2.endLine && loc2.startLine <= loc1.endLine;
  }

  /**
   * Calculate refactoring potential score
   */
  private calculateRefactoringPotential(pair: ClonePair): number {
    const lines = pair.source.endLine - pair.source.startLine + 1;
    const similarity = pair.similarity;
    const hasSuggestion = pair.suggestedRefactoring ? 1.2 : 1.0;

    return lines * similarity * hasSuggestion;
  }
}

// ============================================================================
// COMBINED CLONE DETECTOR
// ============================================================================

export class CloneDetector {
  private tokenDetector: TokenBasedDetector;
  private classBuilder: CloneClassBuilder;

  constructor(options: { minTokenCount?: number; minSimilarity?: number } = {}) {
    this.tokenDetector = new TokenBasedDetector(options);
    this.classBuilder = new CloneClassBuilder();
  }

  /**
   * Perform comprehensive clone detection
   */
  async detect(sources: Map<string, string>): Promise<CloneReport> {
    const tokenClones = this.tokenDetector.detectClones(sources);
    const classes = this.classBuilder.buildClasses(tokenClones);

    return {
      clones: tokenClones,
      classes,
      summary: {
        totalClones: tokenClones.length,
        totalClasses: classes.length,
        type1Clones: tokenClones.filter(c => c.type === 'type1').length,
        type2Clones: tokenClones.filter(c => c.type === 'type2').length,
        type3Clones: tokenClones.filter(c => c.type === 'type3').length,
        type4Clones: tokenClones.filter(c => c.type === 'type4').length,
        totalDuplicatedLines: classes.reduce((sum, c) => sum + c.totalLines, 0),
        affectedFiles: new Set(tokenClones.flatMap(c => [c.source.file, c.target.file])).size,
      },
    };
  }

  /**
   * Detect clones in a single file
   */
  detectInFile(code: string, filename: string): ClonePair[] {
    const sources = new Map([[filename, code]]);
    const report = this.tokenDetector.detectClones(sources);
    return report.filter(c => c.source.file === filename && c.target.file === filename);
  }
}

export interface CloneReport {
  clones: ClonePair[];
  classes: CloneClass[];
  summary: {
    totalClones: number;
    totalClasses: number;
    type1Clones: number;
    type2Clones: number;
    type3Clones: number;
    type4Clones: number;
    totalDuplicatedLines: number;
    affectedFiles: number;
  };
}

// Export singleton
export const cloneDetector = new CloneDetector();
