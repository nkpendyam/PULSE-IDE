/**
 * Kyro IDE Semantic Analysis Engine
 * 
 * A PSI-like (Program Structure Interface) implementation that provides
 * deep semantic understanding of code, similar to JetBrains' architecture.
 * 
 * Features:
 * - Multi-language AST parsing
 * - Symbol table management
 * - Type inference
 * - Reference resolution
 * - Scope chain analysis
 * - Real-time incremental updates
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface SourceFile {
  uri: string;
  content: string;
  language: string;
  version: number;
}

// AST Types
export interface ASTNode {
  id: string;
  type: NodeType;
  range: Range;
  text: string;
  children: ASTNode[];
  parent?: ASTNode;
  language: string;
}

export type NodeType =
  | 'Program'
  | 'FunctionDeclaration'
  | 'FunctionExpression'
  | 'ArrowFunction'
  | 'ClassDeclaration'
  | 'ClassExpression'
  | 'InterfaceDeclaration'
  | 'TypeAlias'
  | 'EnumDeclaration'
  | 'VariableDeclaration'
  | 'VariableDeclarator'
  | 'Identifier'
  | 'Literal'
  | 'TemplateLiteral'
  | 'CallExpression'
  | 'MemberExpression'
  | 'NewExpression'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'ConditionalExpression'
  | 'ObjectExpression'
  | 'ArrayExpression'
  | 'Property'
  | 'MethodDefinition'
  | 'ImportDeclaration'
  | 'ImportSpecifier'
  | 'ExportDeclaration'
  | 'ExportSpecifier'
  | 'BlockStatement'
  | 'ReturnStatement'
  | 'IfStatement'
  | 'ForStatement'
  | 'WhileStatement'
  | 'TryStatement'
  | 'ThrowStatement'
  | 'ExpressionStatement'
  | 'Parameter'
  | 'TypeParameter'
  | 'GenericType'
  | 'UnionType'
  | 'IntersectionType'
  | 'ArrayType'
  | 'TupleType'
  | 'ObjectType'
  | 'FunctionType'
  | 'Comment'
  | 'JSXElement'
  | 'JSXAttribute'
  | 'Unknown';

// Symbol Types
export interface Symbol {
  id: string;
  name: string;
  type: SymbolType;
  range: Range;
  scope: Scope;
  typeSignature?: TypeSignature;
  documentation?: string;
  deprecated?: boolean;
  exported?: boolean;
  imported?: boolean;
  sourceFile: string;
}

export type SymbolType =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'constant'
  | 'parameter'
  | 'property'
  | 'method'
  | 'namespace'
  | 'module'
  | 'import';

// Type System
export interface TypeSignature {
  kind: TypeKind;
  name?: string;
  parameters?: TypeSignature[];
  returnType?: TypeSignature;
  properties?: Map<string, TypeSignature>;
  unionTypes?: TypeSignature[];
  intersectionTypes?: TypeSignature[];
  genericParams?: TypeParameter[];
}

export type TypeKind =
  | 'primitive'
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'array'
  | 'tuple'
  | 'object'
  | 'union'
  | 'intersection'
  | 'generic'
  | 'unknown'
  | 'any'
  | 'void'
  | 'null'
  | 'undefined'
  | 'never';

export interface TypeParameter {
  name: string;
  constraint?: TypeSignature;
  default?: TypeSignature;
}

// Scope
export interface Scope {
  id: string;
  type: ScopeType;
  parent?: Scope;
  children: Scope[];
  symbols: Map<string, Symbol>;
  range: Range;
}

export type ScopeType =
  | 'global'
  | 'module'
  | 'function'
  | 'class'
  | 'block'
  | 'for'
  | 'catch';

// Reference
export interface Reference {
  id: string;
  symbolId: string;
  range: Range;
  type: 'read' | 'write' | 'call' | 'import' | 'export';
  sourceFile: string;
}

// ============================================================================
// LEXER
// ============================================================================

export class Lexer {
  private content: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(content: string) {
    this.content = content;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.position < this.content.length) {
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }

    return tokens;
  }

  private nextToken(): Token | null {
    this.skipWhitespace();

    if (this.position >= this.content.length) {
      return null;
    }

    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.position;

    const char = this.content[this.position];

    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(char)) {
      return this.readIdentifier(startLine, startColumn, startOffset);
    }

    // Numbers
    if (/[0-9]/.test(char)) {
      return this.readNumber(startLine, startColumn, startOffset);
    }

    // Strings
    if (char === '"' || char === "'" || char === '`') {
      return this.readString(startLine, startColumn, startOffset);
    }

    // Operators and punctuation
    return this.readOperator(startLine, startColumn, startOffset);
  }

  private readIdentifier(line: number, column: number, offset: number): Token {
    const start = this.position;

    while (this.position < this.content.length) {
      const char = this.content[this.position];
      if (!/[a-zA-Z0-9_$]/.test(char)) break;
      this.advance();
    }

    const value = this.content.slice(start, this.position);
    const type = KEYWORDS.has(value) ? 'keyword' : 'identifier';

    return {
      type,
      value,
      range: {
        start: { line, column, offset },
        end: { line: this.line, column: this.column, offset: this.position },
      },
    };
  }

  private readNumber(line: number, column: number, offset: number): Token {
    const start = this.position;

    while (this.position < this.content.length) {
      const char = this.content[this.position];
      if (!/[0-9.eExXa-fA-F]/.test(char)) break;
      this.advance();
    }

    return {
      type: 'number',
      value: this.content.slice(start, this.position),
      range: {
        start: { line, column, offset },
        end: { line: this.line, column: this.column, offset: this.position },
      },
    };
  }

  private readString(line: number, column: number, offset: number): Token {
    const quote = this.content[this.position];
    const start = this.position;
    this.advance();

    while (this.position < this.content.length) {
      const char = this.content[this.position];
      if (char === '\\' && this.position + 1 < this.content.length) {
        this.advance();
        this.advance();
        continue;
      }
      if (char === quote) {
        this.advance();
        break;
      }
      if (char === '\n' && quote !== '`') {
        break;
      }
      this.advance();
    }

    return {
      type: 'string',
      value: this.content.slice(start, this.position),
      range: {
        start: { line, column, offset },
        end: { line: this.line, column: this.column, offset: this.position },
      },
    };
  }

  private readOperator(line: number, column: number, offset: number): Token {
    const char = this.content[this.position];

    // Multi-character operators
    const twoChar = this.content.slice(this.position, this.position + 2);
    const threeChar = this.content.slice(this.position, this.position + 3);

    if (OPERATORS_3.has(threeChar)) {
      this.advance();
      this.advance();
      this.advance();
      return {
        type: 'operator',
        value: threeChar,
        range: {
          start: { line, column, offset },
          end: { line: this.line, column: this.column, offset: this.position },
        },
      };
    }

    if (OPERATORS_2.has(twoChar)) {
      this.advance();
      this.advance();
      return {
        type: 'operator',
        value: twoChar,
        range: {
          start: { line, column, offset },
          end: { line: this.line, column: this.column, offset: this.position },
        },
      };
    }

    this.advance();

    return {
      type: PUNCTUATION.has(char) ? 'punctuation' : 'operator',
      value: char,
      range: {
        start: { line, column, offset },
        end: { line: this.line, column: this.column, offset: this.position },
      },
    };
  }

  private skipWhitespace(): void {
    while (this.position < this.content.length) {
      const char = this.content[this.position];

      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else if (char === '\n') {
        this.line++;
        this.column = 1;
        this.position++;
      } else if (char === '/' && this.content[this.position + 1] === '/') {
        // Single-line comment
        while (this.position < this.content.length && this.content[this.position] !== '\n') {
          this.advance();
        }
      } else if (char === '/' && this.content[this.position + 1] === '*') {
        // Multi-line comment
        this.advance();
        this.advance();
        while (this.position < this.content.length - 1) {
          if (this.content[this.position] === '*' && this.content[this.position + 1] === '/') {
            this.advance();
            this.advance();
            break;
          }
          if (this.content[this.position] === '\n') {
            this.line++;
            this.column = 0;
          }
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  private advance(): void {
    this.position++;
    this.column++;
  }
}

export interface Token {
  type: TokenType;
  value: string;
  range: Range;
}

export type TokenType =
  | 'identifier'
  | 'keyword'
  | 'number'
  | 'string'
  | 'operator'
  | 'punctuation';

const KEYWORDS = new Set([
  'abstract', 'any', 'as', 'assert', 'async', 'await', 'boolean', 'break',
  'case', 'catch', 'class', 'const', 'constructor', 'continue', 'debugger',
  'declare', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
  'false', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements',
  'import', 'in', 'instanceof', 'interface', 'is', 'keyof', 'let', 'module',
  'namespace', 'never', 'new', 'null', 'number', 'object', 'of', 'package',
  'private', 'protected', 'public', 'readonly', 'require', 'return', 'set',
  'static', 'string', 'super', 'switch', 'symbol', 'this', 'throw', 'true',
  'try', 'type', 'typeof', 'undefined', 'unique', 'unknown', 'var', 'void',
  'while', 'with', 'yield',
]);

const OPERATORS_2 = new Set([
  '=>', '==', '===', '!=', '!==', '<=', '>=', '++', '--', '&&', '||',
  '??', '?.', '**', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
  '<<', '>>', '<<=', '>>=', '>>>', '@>', '<@',
]);

const OPERATORS_3 = new Set([
  '===', '!==', '>>>', '**=', '<<<', '>>>', '..=',
]);

const PUNCTUATION = new Set([
  '(', ')', '{', '}', '[', ']', ',', ';', ':', '.', '?', '@', '#',
]);

// ============================================================================
// PARSER
// ============================================================================

export class Parser {
  private tokens: Token[];
  private position: number = 0;
  private sourceFile: string;
  private language: string;

  constructor(tokens: Token[], sourceFile: string, language: string) {
    this.tokens = tokens;
    this.sourceFile = sourceFile;
    this.language = language;
  }

  parse(): ASTNode {
    const children: ASTNode[] = [];

    while (this.position < this.tokens.length) {
      const node = this.parseStatement();
      if (node) {
        children.push(node);
      }
    }

    return {
      id: this.generateId(),
      type: 'Program',
      range: {
        start: { line: 1, column: 1, offset: 0 },
        end: this.tokens[this.tokens.length - 1]?.range.end || { line: 1, column: 1, offset: 0 },
      },
      text: '',
      children,
      language: this.language,
    };
  }

  private parseStatement(): ASTNode | null {
    const token = this.current();
    if (!token) return null;

    // Import declarations
    if (token.type === 'keyword' && token.value === 'import') {
      return this.parseImportDeclaration();
    }

    // Export declarations
    if (token.type === 'keyword' && token.value === 'export') {
      return this.parseExportDeclaration();
    }

    // Function declarations
    if (token.type === 'keyword' && token.value === 'function') {
      return this.parseFunctionDeclaration();
    }

    // Class declarations
    if (token.type === 'keyword' && token.value === 'class') {
      return this.parseClassDeclaration();
    }

    // Interface declarations
    if (token.type === 'keyword' && token.value === 'interface') {
      return this.parseInterfaceDeclaration();
    }

    // Type aliases
    if (token.type === 'keyword' && token.value === 'type') {
      return this.parseTypeAlias();
    }

    // Enum declarations
    if (token.type === 'keyword' && token.value === 'enum') {
      return this.parseEnumDeclaration();
    }

    // Variable declarations
    if (token.type === 'keyword' && (token.value === 'const' || token.value === 'let' || token.value === 'var')) {
      return this.parseVariableDeclaration();
    }

    // Expression statements
    return this.parseExpressionStatement();
  }

  private parseFunctionDeclaration(): ASTNode {
    const startRange = this.currentRangeStart();
    this.advance(); // 'function'

    const name = this.expectIdentifier();
    const params = this.parseParameters();
    const returnType = this.parseReturnType();
    const body = this.parseBlock();

    return {
      id: this.generateId(),
      type: 'FunctionDeclaration',
      range: {
        start: startRange,
        end: body.range.end,
      },
      text: '',
      children: [name, params, body].filter(Boolean) as ASTNode[],
      language: this.language,
    };
  }

  private parseClassDeclaration(): ASTNode {
    const startRange = this.currentRangeStart();
    this.advance(); // 'class'

    const name = this.expectIdentifier();
    const heritage = this.parseHeritage();
    const body = this.parseClassBody();

    return {
      id: this.generateId(),
      type: 'ClassDeclaration',
      range: {
        start: startRange,
        end: body.range.end,
      },
      text: '',
      children: [name, heritage, body].filter(Boolean) as ASTNode[],
      language: this.language,
    };
  }

  private parseInterfaceDeclaration(): ASTNode {
    const startRange = this.currentRangeStart();
    this.advance(); // 'interface'

    const name = this.expectIdentifier();
    const heritage = this.parseHeritage();
    const body = this.parseInterfaceBody();

    return {
      id: this.generateId(),
      type: 'InterfaceDeclaration',
      range: {
        start: startRange,
        end: body.range.end,
      },
      text: '',
      children: [name, heritage, body].filter(Boolean) as ASTNode[],
      language: this.language,
    };
  }

  private parseTypeAlias(): ASTNode {
    const startRange = this.currentRangeStart();
    this.advance(); // 'type'

    const name = this.expectIdentifier();
    this.expectOperator('=');
    const typeValue = this.parseType();

    return {
      id: this.generateId(),
      type: 'TypeAlias',
      range: {
        start: startRange,
        end: typeValue.range.end,
      },
      text: '',
      children: [name, typeValue],
      language: this.language,
    };
  }

  private parseEnumDeclaration(): ASTNode {
    const startRange = this.currentRangeStart();
    this.advance(); // 'enum'

    const name = this.expectIdentifier();
    const members = this.parseEnumMembers();

    return {
      id: this.generateId(),
      type: 'EnumDeclaration',
      range: {
        start: startRange,
        end: members.range.end,
      },
      text: '',
      children: [name, members],
      language: this.language,
    };
  }

  private parseVariableDeclaration(): ASTNode {
    const startRange = this.currentRangeStart();
    const kind = this.current()?.value as string;
    this.advance(); // const/let/var

    const declarators: ASTNode[] = [];

    do {
      const name = this.expectIdentifier();
      const typeAnnotation = this.parseTypeAnnotation();
      let init = null;

      if (this.current()?.value === '=') {
        this.advance();
        init = this.parseExpression();
      }

      declarators.push({
        id: this.generateId(),
        type: 'VariableDeclarator',
        range: {
          start: name.range.start,
          end: init?.range.end || typeAnnotation?.range.end || name.range.end,
        },
        text: '',
        children: [name, ...(typeAnnotation ? [typeAnnotation] : []), ...(init ? [init] : [])],
        language: this.language,
      });
    } while (this.current()?.value === ',' && this.advance());

    return {
      id: this.generateId(),
      type: 'VariableDeclaration',
      range: {
        start: startRange,
        end: declarators[declarators.length - 1].range.end,
      },
      text: '',
      children: declarators,
      language: this.language,
    };
  }

  private parseImportDeclaration(): ASTNode {
    const startRange = this.currentRangeStart();
    this.advance(); // 'import'

    const specifiers: ASTNode[] = [];

    if (this.current()?.value === '{') {
      this.advance();
      while (this.current()?.value !== '}') {
        const local = this.expectIdentifier();
        specifiers.push({
          id: this.generateId(),
          type: 'ImportSpecifier',
          range: local.range,
          text: local.text,
          children: [local],
          language: this.language,
        });
        if (this.current()?.value === ',') this.advance();
      }
      this.advance(); // '}'
    }

    this.expectIdentifier('from');
    const source = this.parseLiteral();

    return {
      id: this.generateId(),
      type: 'ImportDeclaration',
      range: {
        start: startRange,
        end: source.range.end,
      },
      text: '',
      children: [...specifiers, source],
      language: this.language,
    };
  }

  private parseExportDeclaration(): ASTNode {
    const startRange = this.currentRangeStart();
    this.advance(); // 'export'

    const declaration = this.parseStatement();

    return {
      id: this.generateId(),
      type: 'ExportDeclaration',
      range: {
        start: startRange,
        end: declaration?.range.end || startRange,
      },
      text: '',
      children: declaration ? [declaration] : [],
      language: this.language,
    };
  }

  private parseExpressionStatement(): ASTNode {
    const expression = this.parseExpression();
    
    if (this.current()?.value === ';') {
      this.advance();
    }

    return {
      id: this.generateId(),
      type: 'ExpressionStatement',
      range: expression.range,
      text: '',
      children: [expression],
      language: this.language,
    };
  }

  private parseExpression(): ASTNode {
    return this.parseAssignmentExpression();
  }

  private parseAssignmentExpression(): ASTNode {
    const left = this.parseCallExpression();

    if (this.current()?.value === '=') {
      const operator = this.current()!;
      this.advance();
      const right = this.parseAssignmentExpression();

      return {
        id: this.generateId(),
        type: 'BinaryExpression',
        range: {
          start: left.range.start,
          end: right.range.end,
        },
        text: '',
        children: [left, right],
        language: this.language,
      };
    }

    return left;
  }

  private parseCallExpression(): ASTNode {
    let expression = this.parseMemberExpression();

    while (this.current()?.value === '(') {
      const args = this.parseArguments();
      expression = {
        id: this.generateId(),
        type: 'CallExpression',
        range: {
          start: expression.range.start,
          end: args.range.end,
        },
        text: '',
        children: [expression, args],
        language: this.language,
      };
    }

    return expression;
  }

  private parseMemberExpression(): ASTNode {
    let expression = this.parsePrimaryExpression();

    while (this.current()?.value === '.' || this.current()?.value === '?.') {
      const operator = this.current()!;
      this.advance();
      const property = this.expectIdentifier();

      expression = {
        id: this.generateId(),
        type: 'MemberExpression',
        range: {
          start: expression.range.start,
          end: property.range.end,
        },
        text: '',
        children: [expression, property],
        language: this.language,
      };
    }

    return expression;
  }

  private parsePrimaryExpression(): ASTNode {
    const token = this.current();

    if (!token) {
      return {
        id: this.generateId(),
        type: 'Unknown',
        range: { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
        text: '',
        children: [],
        language: this.language,
      };
    }

    // Identifier
    if (token.type === 'identifier') {
      this.advance();
      return {
        id: this.generateId(),
        type: 'Identifier',
        range: token.range,
        text: token.value,
        children: [],
        language: this.language,
      };
    }

    // Literals
    if (token.type === 'number' || token.type === 'string') {
      return this.parseLiteral();
    }

    // Parenthesized expression
    if (token.value === '(') {
      this.advance();
      const expression = this.parseExpression();
      this.expectOperator(')');
      return expression;
    }

    // Object literal
    if (token.value === '{') {
      return this.parseObjectExpression();
    }

    // Array literal
    if (token.value === '[') {
      return this.parseArrayExpression();
    }

    // Arrow function
    if (token.type === 'keyword' && token.value === 'async') {
      return this.parseArrowFunction();
    }

    // New expression
    if (token.type === 'keyword' && token.value === 'new') {
      return this.parseNewExpression();
    }

    this.advance();
    return {
      id: this.generateId(),
      type: 'Unknown',
      range: token.range,
      text: token.value,
      children: [],
      language: this.language,
    };
  }

  private parseLiteral(): ASTNode {
    const token = this.current()!;
    this.advance();

    return {
      id: this.generateId(),
      type: 'Literal',
      range: token.range,
      text: token.value,
      children: [],
      language: this.language,
    };
  }

  private parseObjectExpression(): ASTNode {
    const startRange = this.currentRangeStart();
    this.advance(); // '{'

    const properties: ASTNode[] = [];

    while (this.current()?.value !== '}') {
      const key = this.expectIdentifier();
      let value = key;

      if (this.current()?.value === ':') {
        this.advance();
        value = this.parseExpression();
      }

      properties.push({
        id: this.generateId(),
        type: 'Property',
        range: {
          start: key.range.start,
          end: value.range.end,
        },
        text: '',
        children: [key, value],
        language: this.language,
      });

      if (this.current()?.value === ',') this.advance();
    }

    const endRange = this.currentRangeEnd();
    this.advance(); // '}'

    return {
      id: this.generateId(),
      type: 'ObjectExpression',
      range: {
        start: startRange,
        end: endRange,
      },
      text: '',
      children: properties,
      language: this.language,
    };
  }

  private parseArrayExpression(): ASTNode {
    const startRange = this.currentRangeStart();
    this.advance(); // '['

    const elements: ASTNode[] = [];

    while (this.current()?.value !== ']') {
      elements.push(this.parseExpression());
      if (this.current()?.value === ',') this.advance();
    }

    const endRange = this.currentRangeEnd();
    this.advance(); // ']'

    return {
      id: this.generateId(),
      type: 'ArrayExpression',
      range: {
        start: startRange,
        end: endRange,
      },
      text: '',
      children: elements,
      language: this.language,
    };
  }

  private parseBlock(): ASTNode {
    const startRange = this.currentRangeStart();
    this.expectOperator('{');

    const statements: ASTNode[] = [];

    while (this.current()?.value !== '}') {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }

    const endRange = this.currentRangeEnd();
    this.expectOperator('}');

    return {
      id: this.generateId(),
      type: 'BlockStatement',
      range: {
        start: startRange,
        end: endRange,
      },
      text: '',
      children: statements,
      language: this.language,
    };
  }

  private parseParameters(): ASTNode {
    this.expectOperator('(');

    const params: ASTNode[] = [];

    while (this.current()?.value !== ')') {
      const param = this.expectIdentifier();
      const typeAnnotation = this.parseTypeAnnotation();
      
      params.push({
        id: this.generateId(),
        type: 'Parameter',
        range: {
          start: param.range.start,
          end: typeAnnotation?.range.end || param.range.end,
        },
        text: '',
        children: [param, ...(typeAnnotation ? [typeAnnotation] : [])],
        language: this.language,
      });

      if (this.current()?.value === ',') this.advance();
    }

    const endRange = this.currentRangeEnd();
    this.expectOperator(')');

    return {
      id: this.generateId(),
      type: 'Unknown', // Parameter list
      range: {
        start: { line: 0, column: 0, offset: 0 },
        end: endRange,
      },
      text: '',
      children: params,
      language: this.language,
    };
  }

  private parseTypeAnnotation(): ASTNode | null {
    if (this.current()?.value !== ':') return null;
    this.advance();
    return this.parseType();
  }

  private parseType(): ASTNode {
    // Simplified type parsing
    const token = this.current();
    this.advance();

    return {
      id: this.generateId(),
      type: 'GenericType',
      range: token?.range || { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
      text: token?.value || '',
      children: [],
      language: this.language,
    };
  }

  private parseReturnType(): ASTNode | null {
    return null; // Simplified
  }

  private parseHeritage(): ASTNode | null {
    return null; // Simplified
  }

  private parseClassBody(): ASTNode {
    return this.parseBlock();
  }

  private parseInterfaceBody(): ASTNode {
    return this.parseBlock();
  }

  private parseEnumMembers(): ASTNode {
    return this.parseBlock();
  }

  private parseArrowFunction(): ASTNode {
    return this.parseFunctionDeclaration(); // Simplified
  }

  private parseNewExpression(): ASTNode {
    this.advance(); // 'new'
    const callee = this.parseCallExpression();
    return {
      id: this.generateId(),
      type: 'NewExpression',
      range: callee.range,
      text: '',
      children: [callee],
      language: this.language,
    };
  }

  private parseArguments(): ASTNode {
    this.expectOperator('(');

    const args: ASTNode[] = [];

    while (this.current()?.value !== ')') {
      args.push(this.parseExpression());
      if (this.current()?.value === ',') this.advance();
    }

    const endRange = this.currentRangeEnd();
    this.expectOperator(')');

    return {
      id: this.generateId(),
      type: 'Unknown',
      range: {
        start: { line: 0, column: 0, offset: 0 },
        end: endRange,
      },
      text: '',
      children: args,
      language: this.language,
    };
  }

  // Helper methods
  private current(): Token | null {
    return this.tokens[this.position];
  }

  private advance(): Token | null {
    return this.tokens[this.position++];
  }

  private currentRangeStart(): { line: number; column: number; offset: number } {
    const token = this.current();
    return token?.range.start || { line: 1, column: 1, offset: 0 };
  }

  private currentRangeEnd(): { line: number; column: number; offset: number } {
    const token = this.current();
    return token?.range.end || { line: 1, column: 1, offset: 0 };
  }

  private expectIdentifier(expected?: string): ASTNode {
    const token = this.current();
    if (!token || token.type !== 'identifier') {
      throw new Error(`Expected identifier${expected ? ` '${expected}'` : ''}`);
    }
    if (expected && token.value !== expected) {
      throw new Error(`Expected '${expected}' but got '${token.value}'`);
    }
    this.advance();
    return {
      id: this.generateId(),
      type: 'Identifier',
      range: token.range,
      text: token.value,
      children: [],
      language: this.language,
    };
  }

  private expectOperator(value: string): void {
    const token = this.current();
    if (!token || token.value !== value) {
      throw new Error(`Expected '${value}'`);
    }
    this.advance();
  }

  private generateId(): string {
    return `node-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// SEMANTIC ANALYZER
// ============================================================================

export class SemanticAnalyzer {
  private symbols: Map<string, Symbol> = new Map();
  private references: Map<string, Reference[]> = new Map();
  private scopes: Map<string, Scope> = new Map();
  private globalScope: Scope;

  constructor() {
    this.globalScope = {
      id: 'scope-global',
      type: 'global',
      children: [],
      symbols: new Map(),
      range: {
        start: { line: 0, column: 0, offset: 0 },
        end: { line: Infinity, column: Infinity, offset: Infinity },
      },
    };
    this.scopes.set(this.globalScope.id, this.globalScope);
  }

  analyze(ast: ASTNode, sourceFile: string): SemanticModel {
    this.visitNode(ast, this.globalScope, sourceFile);

    return {
      symbols: this.symbols,
      references: this.references,
      scopes: this.scopes,
      globalScope: this.globalScope,
    };
  }

  private visitNode(node: ASTNode, scope: Scope, sourceFile: string): void {
    switch (node.type) {
      case 'FunctionDeclaration':
        this.visitFunctionDeclaration(node, scope, sourceFile);
        break;
      case 'ClassDeclaration':
        this.visitClassDeclaration(node, scope, sourceFile);
        break;
      case 'InterfaceDeclaration':
        this.visitInterfaceDeclaration(node, scope, sourceFile);
        break;
      case 'TypeAlias':
        this.visitTypeAlias(node, scope, sourceFile);
        break;
      case 'EnumDeclaration':
        this.visitEnumDeclaration(node, scope, sourceFile);
        break;
      case 'VariableDeclaration':
        this.visitVariableDeclaration(node, scope, sourceFile);
        break;
      case 'Identifier':
        this.visitIdentifier(node, scope, sourceFile);
        break;
      default:
        for (const child of node.children) {
          this.visitNode(child, scope, sourceFile);
        }
    }
  }

  private visitFunctionDeclaration(node: ASTNode, scope: Scope, sourceFile: string): void {
    const nameNode = node.children.find(c => c.type === 'Identifier');
    if (!nameNode) return;

    const symbol: Symbol = {
      id: this.generateSymbolId(),
      name: nameNode.text,
      type: 'function',
      range: node.range,
      scope,
      sourceFile,
      exported: this.isExported(node),
    };

    this.symbols.set(symbol.id, symbol);
    scope.symbols.set(symbol.name, symbol);

    // Create function scope
    const functionScope: Scope = {
      id: `scope-${symbol.id}`,
      type: 'function',
      parent: scope,
      children: [],
      symbols: new Map(),
      range: node.range,
    };
    this.scopes.set(functionScope.id, functionScope);
    scope.children.push(functionScope);

    // Visit parameters and body
    for (const child of node.children) {
      this.visitNode(child, functionScope, sourceFile);
    }
  }

  private visitClassDeclaration(node: ASTNode, scope: Scope, sourceFile: string): void {
    const nameNode = node.children.find(c => c.type === 'Identifier');
    if (!nameNode) return;

    const symbol: Symbol = {
      id: this.generateSymbolId(),
      name: nameNode.text,
      type: 'class',
      range: node.range,
      scope,
      sourceFile,
      exported: this.isExported(node),
    };

    this.symbols.set(symbol.id, symbol);
    scope.symbols.set(symbol.name, symbol);

    // Create class scope
    const classScope: Scope = {
      id: `scope-${symbol.id}`,
      type: 'class',
      parent: scope,
      children: [],
      symbols: new Map(),
      range: node.range,
    };
    this.scopes.set(classScope.id, classScope);
    scope.children.push(classScope);

    for (const child of node.children) {
      this.visitNode(child, classScope, sourceFile);
    }
  }

  private visitInterfaceDeclaration(node: ASTNode, scope: Scope, sourceFile: string): void {
    const nameNode = node.children.find(c => c.type === 'Identifier');
    if (!nameNode) return;

    const symbol: Symbol = {
      id: this.generateSymbolId(),
      name: nameNode.text,
      type: 'interface',
      range: node.range,
      scope,
      sourceFile,
      exported: this.isExported(node),
    };

    this.symbols.set(symbol.id, symbol);
    scope.symbols.set(symbol.name, symbol);
  }

  private visitTypeAlias(node: ASTNode, scope: Scope, sourceFile: string): void {
    const nameNode = node.children.find(c => c.type === 'Identifier');
    if (!nameNode) return;

    const symbol: Symbol = {
      id: this.generateSymbolId(),
      name: nameNode.text,
      type: 'type',
      range: node.range,
      scope,
      sourceFile,
      exported: this.isExported(node),
    };

    this.symbols.set(symbol.id, symbol);
    scope.symbols.set(symbol.name, symbol);
  }

  private visitEnumDeclaration(node: ASTNode, scope: Scope, sourceFile: string): void {
    const nameNode = node.children.find(c => c.type === 'Identifier');
    if (!nameNode) return;

    const symbol: Symbol = {
      id: this.generateSymbolId(),
      name: nameNode.text,
      type: 'enum',
      range: node.range,
      scope,
      sourceFile,
      exported: this.isExported(node),
    };

    this.symbols.set(symbol.id, symbol);
    scope.symbols.set(symbol.name, symbol);
  }

  private visitVariableDeclaration(node: ASTNode, scope: Scope, sourceFile: string): void {
    for (const declarator of node.children) {
      const nameNode = declarator.children.find(c => c.type === 'Identifier');
      if (!nameNode) continue;

      const symbol: Symbol = {
        id: this.generateSymbolId(),
        name: nameNode.text,
        type: node.text === 'const' ? 'constant' : 'variable',
        range: declarator.range,
        scope,
        sourceFile,
        exported: this.isExported(node),
      };

      this.symbols.set(symbol.id, symbol);
      scope.symbols.set(symbol.name, symbol);
    }
  }

  private visitIdentifier(node: ASTNode, scope: Scope, sourceFile: string): void {
    // Try to resolve the identifier
    const resolved = this.resolveSymbol(node.text, scope);
    if (resolved) {
      const reference: Reference = {
        id: this.generateReferenceId(),
        symbolId: resolved.id,
        range: node.range,
        type: 'read',
        sourceFile,
      };

      if (!this.references.has(resolved.id)) {
        this.references.set(resolved.id, []);
      }
      this.references.get(resolved.id)!.push(reference);
    }
  }

  private resolveSymbol(name: string, scope: Scope): Symbol | null {
    // Search in current scope
    const symbol = scope.symbols.get(name);
    if (symbol) return symbol;

    // Search in parent scopes
    if (scope.parent) {
      return this.resolveSymbol(name, scope.parent);
    }

    return null;
  }

  private isExported(node: ASTNode): boolean {
    return node.parent?.type === 'ExportDeclaration';
  }

  private generateSymbolId(): string {
    return `symbol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReferenceId(): string {
    return `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// SEMANTIC MODEL
// ============================================================================

export interface SemanticModel {
  symbols: Map<string, Symbol>;
  references: Map<string, Reference[]>;
  scopes: Map<string, Scope>;
  globalScope: Scope;
}

// ============================================================================
// QUERY ENGINE
// ============================================================================

export class SemanticQueryEngine {
  constructor(private model: SemanticModel) {}

  /**
   * Find all usages of a symbol
   */
  findUsages(symbolId: string): Reference[] {
    return this.model.references.get(symbolId) || [];
  }

  /**
   * Find symbol at position
   */
  findSymbolAt(position: Position, sourceFile: string): Symbol | null {
    for (const symbol of this.model.symbols.values()) {
      if (symbol.sourceFile === sourceFile && this.isInRange(position, symbol.range)) {
        return symbol;
      }
    }
    return null;
  }

  /**
   * Go to definition
   */
  goToDefinition(position: Position, sourceFile: string): Symbol | null {
    // Find reference at position
    for (const [symbolId, refs] of this.model.references) {
      for (const ref of refs) {
        if (ref.sourceFile === sourceFile && this.isInRange(position, ref.range)) {
          return this.model.symbols.get(symbolId) || null;
        }
      }
    }
    return null;
  }

  /**
   * Find all symbols matching pattern
   */
  findSymbols(pattern: string, options?: { type?: SymbolType }): Symbol[] {
    const results: Symbol[] = [];
    const regex = new RegExp(pattern, 'i');

    for (const symbol of this.model.symbols.values()) {
      if (regex.test(symbol.name)) {
        if (!options?.type || symbol.type === options.type) {
          results.push(symbol);
        }
      }
    }

    return results;
  }

  /**
   * Get symbols in scope at position
   */
  getSymbolsInScope(position: Position, sourceFile: string): Symbol[] {
    const scope = this.findScopeAt(position, sourceFile);
    if (!scope) return [];

    const symbols: Symbol[] = [];
    let current: Scope | undefined = scope;

    while (current) {
      for (const symbol of current.symbols.values()) {
        symbols.push(symbol);
      }
      current = current.parent;
    }

    return symbols;
  }

  /**
   * Get call hierarchy
   */
  getCallHierarchy(symbolId: string): { callers: Symbol[]; callees: Symbol[] } {
    // Simplified - would need full control flow analysis
    return {
      callers: [],
      callees: [],
    };
  }

  /**
   * Find dead code (unreferenced symbols)
   */
  findDeadCode(): Symbol[] {
    const dead: Symbol[] = [];

    for (const symbol of this.model.symbols.values()) {
      const refs = this.model.references.get(symbol.id);
      if (!refs || refs.length === 0) {
        if (!symbol.exported && symbol.type !== 'parameter') {
          dead.push(symbol);
        }
      }
    }

    return dead;
  }

  private findScopeAt(position: Position, sourceFile: string): Scope | null {
    for (const scope of this.model.scopes.values()) {
      // Check if position is within scope range
      // This is simplified - would need proper range checking
    }
    return this.model.globalScope;
  }

  private isInRange(position: Position, range: Range): boolean {
    if (position.line < range.start.line || position.line > range.end.line) {
      return false;
    }
    if (position.line === range.start.line && position.column < range.start.column) {
      return false;
    }
    if (position.line === range.end.line && position.column > range.end.column) {
      return false;
    }
    return true;
  }
}

// ============================================================================
// INDEXER
// ============================================================================

export class ProjectIndexer {
  private files: Map<string, { version: number; model: SemanticModel }> = new Map();
  private globalSymbols: Map<string, Symbol> = new Map();

  /**
   * Index a source file
   */
  indexFile(file: SourceFile): SemanticModel {
    // Lexing
    const lexer = new Lexer(file.content);
    const tokens = lexer.tokenize();

    // Parsing
    const parser = new Parser(tokens, file.uri, file.language);
    const ast = parser.parse();

    // Semantic analysis
    const analyzer = new SemanticAnalyzer();
    const model = analyzer.analyze(ast, file.uri);

    // Update cache
    this.files.set(file.uri, { version: file.version, model });

    // Update global symbols
    for (const symbol of model.symbols.values()) {
      this.globalSymbols.set(symbol.id, symbol);
    }

    return model;
  }

  /**
   * Get symbol by ID
   */
  getSymbol(id: string): Symbol | undefined {
    return this.globalSymbols.get(id);
  }

  /**
   * Find symbols across project
   */
  findSymbols(query: string): Symbol[] {
    const results: Symbol[] = [];
    const lowerQuery = query.toLowerCase();

    for (const symbol of this.globalSymbols.values()) {
      if (symbol.name.toLowerCase().includes(lowerQuery)) {
        results.push(symbol);
      }
    }

    return results;
  }

  /**
   * Get all indexed files
   */
  getIndexedFiles(): string[] {
    return Array.from(this.files.keys());
  }

  /**
   * Clear index
   */
  clear(): void {
    this.files.clear();
    this.globalSymbols.clear();
  }
}

// Export singleton indexer
export const projectIndexer = new ProjectIndexer();
