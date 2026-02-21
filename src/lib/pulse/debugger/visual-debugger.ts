/**
 * Kyro IDE Visual Debugger
 * 
 * Comprehensive visual debugging engine with variable watches,
 * call stack visualization, breakpoint management, and step execution.
 * 
 * Features:
 * - VariableWatch for tracking variable changes
 * - WatchExpression evaluator with expression parsing
 * - CallStack visualization with frame navigation
 * - Conditional and hit-count breakpoints
 * - Step over/into/out execution control
 * - Variable scope inspection (local, global, closure)
 * - Real-time value updates with change detection
 */

// ============================================================================
// TYPES
// ============================================================================

export interface VariableWatch {
  id: string;
  expression: string;
  name: string;
  value: WatchValue | null;
  type: string;
  scope: VariableScope;
  path: string;
  isExpanded: boolean;
  hasChildren: boolean;
  children: VariableWatch[];
  lastEvaluated?: Date;
  evaluationError?: string;
  isEnabled: boolean;
  updateCount: number;
  previousValue?: WatchValue;
  valueChanges: ValueChangeRecord[];
}

export interface WatchValue {
  type: ValueType;
  value: unknown;
  displayValue: string;
  objectId?: string;
  size?: number;
  isTruncated: boolean;
}

export type ValueType = 
  | 'undefined' 
  | 'null' 
  | 'boolean' 
  | 'number' 
  | 'string' 
  | 'bigint'
  | 'symbol'
  | 'object' 
  | 'array' 
  | 'function' 
  | 'date'
  | 'regexp'
  | 'map'
  | 'set'
  | 'weakmap'
  | 'weakset'
  | 'promise'
  | 'error'
  | 'class'
  | 'proxy';

export type VariableScope = 'local' | 'global' | 'closure' | 'script' | 'with' | 'catch' | 'block';

export interface ValueChangeRecord {
  timestamp: Date;
  oldValue: WatchValue | null;
  newValue: WatchValue;
  sequenceNumber: number;
  source: 'evaluation' | 'step' | 'breakpoint';
}

export interface WatchExpression {
  id: string;
  expression: string;
  compiledExpression?: CompiledExpression;
  result: WatchValue | null;
  error?: string;
  lastEvaluated?: Date;
}

export interface CompiledExpression {
  ast: ExpressionNode;
  dependencies: string[];
  isPure: boolean;
}

export interface ExpressionNode {
  type: 'identifier' | 'literal' | 'member' | 'call' | 'binary' | 'unary' | 'conditional';
  value?: string | number | boolean;
  operator?: string;
  left?: ExpressionNode;
  right?: ExpressionNode;
  object?: ExpressionNode;
  property?: ExpressionNode;
  arguments?: ExpressionNode[];
  test?: ExpressionNode;
  consequent?: ExpressionNode;
  alternate?: ExpressionNode;
}

export interface CallStackFrame {
  id: string;
  name: string;
  displayName: string;
  location: SourceLocation;
  source?: SourceInfo;
  line: number;
  column: number;
  scopeChain: Scope[];
  locals: Map<string, VariableWatch>;
  arguments: VariableWatch[];
  thisValue?: WatchValue;
  returnValue?: WatchValue;
  isPaused: boolean;
  canRestart: boolean;
  instructionPointer?: number;
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  function?: string;
}

export interface SourceInfo {
  path: string;
  content?: string;
  mimeType: string;
  lines: number;
  hash?: string;
}

export interface Scope {
  type: VariableScope;
  name: string;
  object: WatchValue;
  variables: Map<string, VariableWatch>;
  startLocation?: SourceLocation;
  endLocation?: SourceLocation;
}

export interface Breakpoint {
  id: string;
  location: SourceLocation;
  condition?: BreakpointCondition;
  hitCondition?: string;
  logMessage?: string;
  isEnabled: boolean;
  isVerified: boolean;
  hitCount: number;
  lastHitAt?: Date;
  state: BreakpointState;
}

export interface BreakpointCondition {
  expression: string;
  compiledExpression?: CompiledExpression;
  language: 'javascript' | 'typescript';
}

export type BreakpointState = 'pending' | 'verified' | 'bound' | 'error';

export interface BreakpointHitResult {
  breakpoint: Breakpoint;
  shouldPause: boolean;
  logOutput?: string;
  conditionMet: boolean;
}

export interface StepResult {
  success: boolean;
  frame?: CallStackFrame;
  location?: SourceLocation;
  error?: string;
  hitBreakpoint?: Breakpoint;
  executionEvent?: ExecutionEvent;
}

export interface ExecutionEvent {
  type: ExecutionEventType;
  timestamp: Date;
  sequenceNumber: number;
  location: SourceLocation;
  frame?: CallStackFrame;
  data?: unknown;
}

export type ExecutionEventType = 
  | 'step'
  | 'breakpoint'
  | 'function_call'
  | 'function_return'
  | 'exception'
  | 'break'
  | 'pause'
  | 'resume';

export interface VariableUpdate {
  id: string;
  variable: VariableWatch;
  change: ValueChangeRecord;
  source: 'watch' | 'scope' | 'hover';
}

// ============================================================================
// VARIABLE WATCH CLASS
// ============================================================================

export class VariableWatchManager {
  private watches: Map<string, VariableWatch> = new Map();
  private updateCallbacks: Set<(update: VariableUpdate) => void> = new Set();
  private sequenceNumber: number = 0;

  /**
   * Add a new variable watch
   */
  addWatch(expression: string, scope: VariableScope = 'local'): VariableWatch {
    const id = `watch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const name = this.extractVariableName(expression);
    
    const watch: VariableWatch = {
      id,
      expression,
      name,
      value: null,
      type: 'unknown',
      scope,
      path: expression,
      isExpanded: false,
      hasChildren: false,
      children: [],
      isEnabled: true,
      updateCount: 0,
      valueChanges: [],
    };

    this.watches.set(id, watch);
    return watch;
  }

  /**
   * Remove a variable watch
   */
  removeWatch(id: string): boolean {
    return this.watches.delete(id);
  }

  /**
   * Get all watches
   */
  getWatches(): VariableWatch[] {
    return Array.from(this.watches.values());
  }

  /**
   * Get watch by ID
   */
  getWatch(id: string): VariableWatch | undefined {
    return this.watches.get(id);
  }

  /**
   * Update watch value
   */
  updateWatchValue(id: string, value: unknown, source: 'evaluation' | 'step' | 'breakpoint' = 'evaluation'): void {
    const watch = this.watches.get(id);
    if (!watch || !watch.isEnabled) return;

    const watchValue = this.createWatchValue(value);
    const now = new Date();

    // Track changes
    if (watch.value !== null && !this.valuesEqual(watch.value, watchValue)) {
      const change: ValueChangeRecord = {
        timestamp: now,
        oldValue: watch.value,
        newValue: watchValue,
        sequenceNumber: ++this.sequenceNumber,
        source,
      };

      watch.valueChanges.push(change);
      watch.previousValue = watch.value;

      // Notify listeners
      this.notifyUpdate({
        id,
        variable: watch,
        change,
        source: 'watch',
      });
    }

    watch.value = watchValue;
    watch.type = watchValue.type;
    watch.hasChildren = this.hasChildren(value);
    watch.lastEvaluated = now;
    watch.updateCount++;
    watch.evaluationError = undefined;
  }

  /**
   * Set watch error
   */
  setWatchError(id: string, error: string): void {
    const watch = this.watches.get(id);
    if (!watch) return;

    watch.evaluationError = error;
    watch.value = null;
    watch.lastEvaluated = new Date();
  }

  /**
   * Toggle watch enabled state
   */
  toggleWatch(id: string): boolean {
    const watch = this.watches.get(id);
    if (!watch) return false;
    
    watch.isEnabled = !watch.isEnabled;
    return watch.isEnabled;
  }

  /**
   * Expand/collapse watch
   */
  toggleExpand(id: string): void {
    const watch = this.watches.get(id);
    if (watch) {
      watch.isExpanded = !watch.isExpanded;
    }
  }

  /**
   * Subscribe to variable updates
   */
  onUpdate(callback: (update: VariableUpdate) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  /**
   * Clear all watches
   */
  clearWatches(): void {
    this.watches.clear();
  }

  /**
   * Create watch value from raw value
   */
  private createWatchValue(value: unknown): WatchValue {
    if (value === undefined) {
      return { type: 'undefined', value: undefined, displayValue: 'undefined', isTruncated: false };
    }
    if (value === null) {
      return { type: 'null', value: null, displayValue: 'null', isTruncated: false };
    }

    const type = this.getValueType(value);
    const displayValue = this.formatDisplayValue(value, type);
    
    return {
      type,
      value,
      displayValue,
      objectId: type === 'object' || type === 'array' ? this.getObjectId(value) : undefined,
      size: type === 'array' ? (value as unknown[]).length : undefined,
      isTruncated: displayValue.length > 1000,
    };
  }

  /**
   * Get value type
   */
  private getValueType(value: unknown): ValueType {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    const type = typeof value;
    if (type === 'boolean') return 'boolean';
    if (type === 'number') return 'number';
    if (type === 'string') return 'string';
    if (type === 'bigint') return 'bigint';
    if (type === 'symbol') return 'symbol';
    if (type === 'function') return 'function';

    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof RegExp) return 'regexp';
    if (value instanceof Map) return 'map';
    if (value instanceof Set) return 'set';
    if (value instanceof Error) return 'error';
    if (value instanceof Promise) return 'promise';

    if (type === 'object') {
      const obj = value as object;
      if (Object.prototype.toString.call(obj) === '[object WeakMap]') return 'weakmap';
      if (Object.prototype.toString.call(obj) === '[object WeakSet]') return 'weakset';
      if (Object.prototype.toString.call(obj) === '[object Proxy]') return 'proxy';
      return 'object';
    }

    return 'object';
  }

  /**
   * Format display value
   */
  private formatDisplayValue(value: unknown, type: ValueType): string {
    switch (type) {
      case 'undefined':
      case 'null':
      case 'boolean':
      case 'number':
      case 'bigint':
      case 'string':
        return String(value);
      
      case 'symbol':
        return (value as symbol).toString();
      
      case 'function':
        return `ƒ ${(value as (...args: unknown[]) => unknown).name || 'anonymous'}()`;
      
      case 'array':
        return `Array(${(value as unknown[]).length})`;
      
      case 'date':
        return (value as Date).toISOString();
      
      case 'regexp':
        return (value as RegExp).toString();
      
      case 'map':
        return `Map(${(value as Map<unknown, unknown>).size})`;
      
      case 'set':
        return `Set(${(value as Set<unknown>).size})`;
      
      case 'error':
        return `${(value as Error).name}: ${(value as Error).message}`;
      
      case 'promise':
        return 'Promise { <pending> }';
      
      case 'object':
        if (value === null) return 'null';
        const constructor = (value as object).constructor?.name || 'Object';
        return `${constructor} {}`;
      
      default:
        return String(value);
    }
  }

  /**
   * Get object ID for reference tracking
   */
  private getObjectId(value: object): string {
    return `obj-${typeof WeakRef !== 'undefined' ? '' : Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if value has children (can be expanded)
   */
  private hasChildren(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    
    const type = typeof value;
    if (type !== 'object' && type !== 'function') return false;
    if (value instanceof Date || value instanceof RegExp) return false;
    
    if (Array.isArray(value)) return value.length > 0;
    if (value instanceof Map || value instanceof Set) return value.size > 0;
    
    if (type === 'function') {
      const fn = value as (...args: unknown[]) => unknown;
      return Object.keys(fn).length > 0;
    }
    
    return Object.keys(value as object).length > 0;
  }

  /**
   * Check if two values are equal
   */
  private valuesEqual(a: WatchValue, b: WatchValue): boolean {
    if (a.type !== b.type) return false;
    
    if (a.objectId && b.objectId) {
      return a.objectId === b.objectId;
    }
    
    return a.displayValue === b.displayValue;
  }

  /**
   * Extract variable name from expression
   */
  private extractVariableName(expression: string): string {
    const match = expression.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    return match ? match[1] : expression;
  }

  /**
   * Notify update listeners
   */
  private notifyUpdate(update: VariableUpdate): void {
    for (const callback of this.updateCallbacks) {
      try {
        callback(update);
      } catch (error) {
        console.error('Variable update callback error:', error);
      }
    }
  }
}

// ============================================================================
// WATCH EXPRESSION EVALUATOR
// ============================================================================

export class WatchExpressionEvaluator {
  /**
   * Parse expression into AST
   */
  parse(expression: string): ExpressionNode {
    return this.parseExpression(expression.trim());
  }

  /**
   * Compile expression for efficient evaluation
   */
  compile(expression: string): CompiledExpression {
    const ast = this.parse(expression);
    const dependencies = this.extractDependencies(ast);
    const isPure = this.checkPurity(ast);

    return {
      ast,
      dependencies,
      isPure,
    };
  }

  /**
   * Evaluate expression in given context
   */
  evaluate(expression: CompiledExpression, context: EvaluationContext): unknown {
    return this.evaluateNode(expression.ast, context);
  }

  /**
   * Parse expression into AST (simplified parser)
   */
  private parseExpression(expr: string): ExpressionNode {
    // Handle member access (e.g., obj.prop, arr[0])
    const memberMatch = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\.(.+)$/);
    if (memberMatch) {
      return {
        type: 'member',
        object: { type: 'identifier', value: memberMatch[1] },
        property: this.parseExpression(memberMatch[2]),
      };
    }

    const bracketMatch = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\[(.+)\]$/);
    if (bracketMatch) {
      return {
        type: 'member',
        object: { type: 'identifier', value: bracketMatch[1] },
        property: { type: 'literal', value: bracketMatch[2] },
      };
    }

    // Handle binary operators
    const binaryOps = ['===', '!==', '==', '!=', '<=', '>=', '&&', '||', '+', '-', '*', '/', '%', '<', '>'];
    for (const op of binaryOps) {
      const index = expr.lastIndexOf(op);
      if (index > 0) {
        return {
          type: 'binary',
          operator: op,
          left: this.parseExpression(expr.slice(0, index)),
          right: this.parseExpression(expr.slice(index + op.length)),
        };
      }
    }

    // Handle unary operators
    if (expr.startsWith('!') || expr.startsWith('-') || expr.startsWith('+') || expr.startsWith('typeof')) {
      const op = expr.startsWith('typeof') ? 'typeof' : expr[0];
      return {
        type: 'unary',
        operator: op,
        right: this.parseExpression(expr.slice(op.length)),
      };
    }

    // Handle ternary
    const questionIndex = expr.indexOf('?');
    if (questionIndex > 0) {
      const colonIndex = expr.indexOf(':', questionIndex);
      if (colonIndex > questionIndex) {
        return {
          type: 'conditional',
          test: this.parseExpression(expr.slice(0, questionIndex)),
          consequent: this.parseExpression(expr.slice(questionIndex + 1, colonIndex)),
          alternate: this.parseExpression(expr.slice(colonIndex + 1)),
        };
      }
    }

    // Handle function calls
    const callMatch = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\((.*)\)$/);
    if (callMatch) {
      const args = callMatch[2] ? callMatch[2].split(',').map(a => this.parseExpression(a.trim())) : [];
      return {
        type: 'call',
        object: { type: 'identifier', value: callMatch[1] },
        arguments: args,
      };
    }

    // Handle literals
    if (expr.startsWith('"') || expr.startsWith("'") || expr.startsWith('`')) {
      return { type: 'literal', value: expr.slice(1, -1) };
    }
    if (expr === 'true' || expr === 'false') {
      return { type: 'literal', value: expr === 'true' };
    }
    if (expr === 'null') {
      return { type: 'literal', value: null };
    }
    if (expr === 'undefined') {
      return { type: 'literal', value: undefined };
    }
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return { type: 'literal', value: parseFloat(expr) };
    }

    // Default to identifier
    return { type: 'identifier', value: expr };
  }

  /**
   * Extract variable dependencies from AST
   */
  private extractDependencies(ast: ExpressionNode): string[] {
    const deps: string[] = [];

    const traverse = (node: ExpressionNode): void => {
      if (node.type === 'identifier' && typeof node.value === 'string') {
        deps.push(node.value);
      }
      if (node.object) traverse(node.object);
      if (node.property) traverse(node.property);
      if (node.left) traverse(node.left);
      if (node.right) traverse(node.right);
      if (node.test) traverse(node.test);
      if (node.consequent) traverse(node.consequent);
      if (node.alternate) traverse(node.alternate);
      if (node.arguments) node.arguments.forEach(traverse);
    };

    traverse(ast);
    return [...new Set(deps)];
  }

  /**
   * Check if expression is pure (no side effects)
   */
  private checkPurity(ast: ExpressionNode): boolean {
    // An expression is pure if it doesn't contain function calls
    const check = (node: ExpressionNode): boolean => {
      if (node.type === 'call') return false;
      if (node.object && !check(node.object)) return false;
      if (node.property && !check(node.property)) return false;
      if (node.left && !check(node.left)) return false;
      if (node.right && !check(node.right)) return false;
      if (node.test && !check(node.test)) return false;
      if (node.consequent && !check(node.consequent)) return false;
      if (node.alternate && !check(node.alternate)) return false;
      if (node.arguments) return node.arguments.every(check);
      return true;
    };

    return check(ast);
  }

  /**
   * Evaluate AST node
   */
  private evaluateNode(node: ExpressionNode, context: EvaluationContext): unknown {
    switch (node.type) {
      case 'literal':
        return node.value;

      case 'identifier':
        return this.resolveIdentifier(node.value as string, context);

      case 'member':
        const obj = this.evaluateNode(node.object!, context);
        const prop = this.evaluateNode(node.property!, context);
        return this.getProperty(obj, prop);

      case 'binary':
        const left = this.evaluateNode(node.left!, context);
        const right = this.evaluateNode(node.right!, context);
        return this.evaluateBinary(node.operator!, left, right);

      case 'unary':
        const operand = this.evaluateNode(node.right!, context);
        return this.evaluateUnary(node.operator!, operand);

      case 'conditional':
        const test = this.evaluateNode(node.test!, context);
        return test 
          ? this.evaluateNode(node.consequent!, context) 
          : this.evaluateNode(node.alternate!, context);

      case 'call':
        // Function calls are not supported in watch expressions for safety
        throw new Error('Function calls are not supported in watch expressions');

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  /**
   * Resolve identifier in context
   */
  private resolveIdentifier(name: string, context: EvaluationContext): unknown {
    // Check locals first
    if (context.locals && name in context.locals) {
      return context.locals[name];
    }
    // Check closure scope
    if (context.closure && name in context.closure) {
      return context.closure[name];
    }
    // Check global scope
    if (context.globals && name in context.globals) {
      return context.globals[name];
    }
    // Check this value
    if (name === 'this' && context.thisValue !== undefined) {
      return context.thisValue;
    }
    return undefined;
  }

  /**
   * Get property from object
   */
  private getProperty(obj: unknown, prop: unknown): unknown {
    if (obj === null || obj === undefined) {
      return undefined;
    }

    if (typeof obj === 'object' || typeof obj === 'function') {
      return (obj as Record<string | number | symbol, unknown>)[prop as string | number | symbol];
    }

    return undefined;
  }

  /**
   * Evaluate binary operation
   */
  private evaluateBinary(operator: string, left: unknown, right: unknown): unknown {
    switch (operator) {
      case '+': return (left as number) + (right as number);
      case '-': return (left as number) - (right as number);
      case '*': return (left as number) * (right as number);
      case '/': return (left as number) / (right as number);
      case '%': return (left as number) % (right as number);
      case '===': return left === right;
      case '!==': return left !== right;
      case '==': return left == right;
      case '!=': return left != right;
      case '<': return (left as number) < (right as number);
      case '>': return (left as number) > (right as number);
      case '<=': return (left as number) <= (right as number);
      case '>=': return (left as number) >= (right as number);
      case '&&': return left && right;
      case '||': return left || right;
      default: throw new Error(`Unknown operator: ${operator}`);
    }
  }

  /**
   * Evaluate unary operation
   */
  private evaluateUnary(operator: string, operand: unknown): unknown {
    switch (operator) {
      case '!': return !operand;
      case '-': return -(operand as number);
      case '+': return +(operand as number);
      case 'typeof': return typeof operand;
      default: throw new Error(`Unknown operator: ${operator}`);
    }
  }
}

export interface EvaluationContext {
  locals?: Record<string, unknown>;
  closure?: Record<string, unknown>;
  globals?: Record<string, unknown>;
  thisValue?: unknown;
  arguments?: unknown[];
}

// ============================================================================
// BREAKPOINT MANAGER
// ============================================================================

export class BreakpointManager {
  private breakpoints: Map<string, Breakpoint> = new Map();
  private locationIndex: Map<string, Set<string>> = new Map();
  private evaluator: WatchExpressionEvaluator;

  constructor() {
    this.evaluator = new WatchExpressionEvaluator();
  }

  /**
   * Add breakpoint at location
   */
  addBreakpoint(location: SourceLocation, options?: Partial<Breakpoint>): Breakpoint {
    const id = `bp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const key = this.getLocationKey(location);

    const breakpoint: Breakpoint = {
      id,
      location,
      isEnabled: true,
      isVerified: false,
      hitCount: 0,
      state: 'pending',
      ...options,
    };

    this.breakpoints.set(id, breakpoint);

    // Index by location
    if (!this.locationIndex.has(key)) {
      this.locationIndex.set(key, new Set());
    }
    this.locationIndex.get(key)!.add(id);

    return breakpoint;
  }

  /**
   * Remove breakpoint
   */
  removeBreakpoint(id: string): boolean {
    const bp = this.breakpoints.get(id);
    if (!bp) return false;

    const key = this.getLocationKey(bp.location);
    this.locationIndex.get(key)?.delete(id);
    return this.breakpoints.delete(id);
  }

  /**
   * Get all breakpoints
   */
  getBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  /**
   * Get breakpoints for file
   */
  getBreakpointsForFile(file: string): Breakpoint[] {
    return this.getBreakpoints().filter(bp => bp.location.file === file);
  }

  /**
   * Get breakpoint at location
   */
  getBreakpointsAtLocation(location: SourceLocation): Breakpoint[] {
    const key = this.getLocationKey(location);
    const ids = this.locationIndex.get(key);
    if (!ids) return [];
    return Array.from(ids).map(id => this.breakpoints.get(id)!).filter(Boolean);
  }

  /**
   * Toggle breakpoint enabled state
   */
  toggleBreakpoint(id: string): boolean {
    const bp = this.breakpoints.get(id);
    if (!bp) return false;
    bp.isEnabled = !bp.isEnabled;
    return bp.isEnabled;
  }

  /**
   * Set breakpoint condition
   */
  setBreakpointCondition(id: string, condition: string, language: 'javascript' | 'typescript' = 'javascript'): void {
    const bp = this.breakpoints.get(id);
    if (!bp) return;

    try {
      const compiled = this.evaluator.compile(condition);
      bp.condition = {
        expression: condition,
        compiledExpression: compiled,
        language,
      };
    } catch (error) {
      bp.state = 'error';
      throw error;
    }
  }

  /**
   * Set hit condition (e.g., ">5" to break after 5 hits)
   */
  setHitCondition(id: string, condition: string): void {
    const bp = this.breakpoints.get(id);
    if (!bp) return;
    bp.hitCondition = condition;
  }

  /**
   * Set log message for breakpoint
   */
  setLogMessage(id: string, message: string): void {
    const bp = this.breakpoints.get(id);
    if (!bp) return;
    bp.logMessage = message;
  }

  /**
   * Verify breakpoint (mark as bound to actual code)
   */
  verifyBreakpoint(id: string): void {
    const bp = this.breakpoints.get(id);
    if (bp) {
      bp.isVerified = true;
      bp.state = 'verified';
    }
  }

  /**
   * Check if location hits any breakpoint
   */
  checkBreakpointHit(location: SourceLocation, context: EvaluationContext): BreakpointHitResult | null {
    const breakpoints = this.getBreakpointsAtLocation(location);
    
    for (const bp of breakpoints) {
      if (!bp.isEnabled) continue;

      // Check condition
      let conditionMet = true;
      if (bp.condition?.compiledExpression) {
        try {
          conditionMet = !!this.evaluator.evaluate(bp.condition.compiledExpression, context);
        } catch {
          conditionMet = false;
        }
      }

      // Check hit condition
      if (bp.hitCondition) {
        conditionMet = conditionMet && this.checkHitCondition(bp);
      }

      // Record hit
      bp.hitCount++;
      bp.lastHitAt = new Date();

      if (conditionMet) {
        let logOutput: string | undefined;
        
        // Generate log message if present
        if (bp.logMessage) {
          logOutput = this.formatLogMessage(bp.logMessage, context);
        }

        return {
          breakpoint: bp,
          shouldPause: !bp.logMessage, // Logpoints don't pause
          logOutput,
          conditionMet,
        };
      }
    }

    return null;
  }

  /**
   * Check hit condition
   */
  private checkHitCondition(bp: Breakpoint): boolean {
    if (!bp.hitCondition) return true;

    const match = bp.hitCondition.match(/^([><]=?|=)(\d+)$/);
    if (!match) return false;

    const operator = match[1];
    const count = parseInt(match[2], 10);

    switch (operator) {
      case '>': return bp.hitCount > count;
      case '>=': return bp.hitCount >= count;
      case '<': return bp.hitCount < count;
      case '<=': return bp.hitCount <= count;
      case '=': return bp.hitCount === count;
      default: return false;
    }
  }

  /**
   * Format log message with interpolated values
   */
  private formatLogMessage(template: string, context: EvaluationContext): string {
    return template.replace(/\{([^}]+)\}/g, (_, expr) => {
      try {
        const compiled = this.evaluator.compile(expr);
        const value = this.evaluator.evaluate(compiled, context);
        return String(value);
      } catch {
        return `{${expr}}`;
      }
    });
  }

  /**
   * Get location key for indexing
   */
  private getLocationKey(location: SourceLocation): string {
    return `${location.file}:${location.line}:${location.column}`;
  }

  /**
   * Clear all breakpoints
   */
  clearBreakpoints(): void {
    this.breakpoints.clear();
    this.locationIndex.clear();
  }

  /**
   * Export breakpoints for persistence
   */
  exportBreakpoints(): string {
    return JSON.stringify(this.getBreakpoints());
  }

  /**
   * Import breakpoints from JSON
   */
  importBreakpoints(json: string): void {
    const breakpoints = JSON.parse(json) as Breakpoint[];
    for (const bp of breakpoints) {
      this.breakpoints.set(bp.id, bp);
      const key = this.getLocationKey(bp.location);
      if (!this.locationIndex.has(key)) {
        this.locationIndex.set(key, new Set());
      }
      this.locationIndex.get(key)!.add(bp.id);
    }
  }
}

// ============================================================================
// CALL STACK VISUALIZER
// ============================================================================

export class CallStackVisualizer {
  private frames: CallStackFrame[] = [];
  private currentFrameIndex: number = 0;
  private frameChangeCallbacks: Set<(frame: CallStackFrame) => void> = new Set();

  /**
   * Set call stack frames
   */
  setFrames(frames: CallStackFrame[]): void {
    this.frames = frames;
    this.currentFrameIndex = 0;
    this.notifyFrameChange();
  }

  /**
   * Get all frames
   */
  getFrames(): CallStackFrame[] {
    return this.frames;
  }

  /**
   * Get current frame
   */
  getCurrentFrame(): CallStackFrame | undefined {
    return this.frames[this.currentFrameIndex];
  }

  /**
   * Get frame at index
   */
  getFrame(index: number): CallStackFrame | undefined {
    return this.frames[index];
  }

  /**
   * Select frame by index
   */
  selectFrame(index: number): CallStackFrame | undefined {
    if (index < 0 || index >= this.frames.length) return undefined;
    this.currentFrameIndex = index;
    this.notifyFrameChange();
    return this.frames[index];
  }

  /**
   * Navigate to next frame (up the stack)
   */
  nextFrame(): CallStackFrame | undefined {
    return this.selectFrame(this.currentFrameIndex + 1);
  }

  /**
   * Navigate to previous frame (down the stack)
   */
  previousFrame(): CallStackFrame | undefined {
    return this.selectFrame(this.currentFrameIndex - 1);
  }

  /**
   * Get current frame index
   */
  getCurrentIndex(): number {
    return this.currentFrameIndex;
  }

  /**
   * Add frame to top of stack
   */
  pushFrame(frame: CallStackFrame): void {
    this.frames.unshift(frame);
    this.currentFrameIndex = 0;
    this.notifyFrameChange();
  }

  /**
   * Remove top frame from stack
   */
  popFrame(): CallStackFrame | undefined {
    if (this.frames.length === 0) return undefined;
    const frame = this.frames.shift()!;
    if (this.currentFrameIndex > 0) {
      this.currentFrameIndex--;
    }
    this.notifyFrameChange();
    return frame;
  }

  /**
   * Subscribe to frame changes
   */
  onFrameChange(callback: (frame: CallStackFrame) => void): () => void {
    this.frameChangeCallbacks.add(callback);
    return () => this.frameChangeCallbacks.delete(callback);
  }

  /**
   * Format frame for display
   */
  formatFrame(frame: CallStackFrame, includeLocation: boolean = true): string {
    let display = frame.displayName || frame.name;
    
    if (includeLocation && frame.location.file) {
      const file = frame.location.file.split('/').pop() || frame.location.file;
      display += ` at ${file}:${frame.line}`;
    }
    
    return display;
  }

  /**
   * Format entire stack for display
   */
  formatStack(maxLines: number = 20): string {
    const lines = this.frames.slice(0, maxLines).map((frame, index) => {
      const marker = index === this.currentFrameIndex ? '>' : ' ';
      return `${marker} #${index} ${this.formatFrame(frame)}`;
    });

    if (this.frames.length > maxLines) {
      lines.push(`  ... ${this.frames.length - maxLines} more`);
    }

    return lines.join('\n');
  }

  /**
   * Notify frame change listeners
   */
  private notifyFrameChange(): void {
    const currentFrame = this.getCurrentFrame();
    if (currentFrame) {
      for (const callback of this.frameChangeCallbacks) {
        try {
          callback(currentFrame);
        } catch (error) {
          console.error('Frame change callback error:', error);
        }
      }
    }
  }

  /**
   * Clear call stack
   */
  clear(): void {
    this.frames = [];
    this.currentFrameIndex = 0;
  }
}

// ============================================================================
// STEP EXECUTOR
// ============================================================================

export class StepExecutor {
  private callStackVisualizer: CallStackVisualizer;
  private breakpointManager: BreakpointManager;
  private evaluator: WatchExpressionEvaluator;
  private eventListeners: Set<(event: ExecutionEvent) => void> = new Set();
  private sequenceNumber: number = 0;

  constructor(
    callStackVisualizer: CallStackVisualizer,
    breakpointManager: BreakpointManager
  ) {
    this.callStackVisualizer = callStackVisualizer;
    this.breakpointManager = breakpointManager;
    this.evaluator = new WatchExpressionEvaluator();
  }

  /**
   * Execute step over
   */
  async stepOver(): Promise<StepResult> {
    const currentFrame = this.callStackVisualizer.getCurrentFrame();
    if (!currentFrame) {
      return { success: false, error: 'No active frame' };
    }

    const currentDepth = this.callStackVisualizer.getFrames().length;

    // Simulate stepping over (would be replaced by actual debug adapter)
    const event: ExecutionEvent = {
      type: 'step',
      timestamp: new Date(),
      sequenceNumber: ++this.sequenceNumber,
      location: currentFrame.location,
      frame: currentFrame,
    };

    this.emitEvent(event);

    // Check for breakpoint hit
    const context = this.createEvaluationContext(currentFrame);
    const hitResult = this.breakpointManager.checkBreakpointHit(currentFrame.location, context);

    return {
      success: true,
      frame: currentFrame,
      location: currentFrame.location,
      hitBreakpoint: hitResult?.shouldPause ? hitResult.breakpoint : undefined,
      executionEvent: event,
    };
  }

  /**
   * Execute step into
   */
  async stepInto(): Promise<StepResult> {
    const currentFrame = this.callStackVisualizer.getCurrentFrame();
    if (!currentFrame) {
      return { success: false, error: 'No active frame' };
    }

    const event: ExecutionEvent = {
      type: 'step',
      timestamp: new Date(),
      sequenceNumber: ++this.sequenceNumber,
      location: currentFrame.location,
      frame: currentFrame,
    };

    this.emitEvent(event);

    return {
      success: true,
      frame: currentFrame,
      location: currentFrame.location,
      executionEvent: event,
    };
  }

  /**
   * Execute step out
   */
  async stepOut(): Promise<StepResult> {
    const frames = this.callStackVisualizer.getFrames();
    if (frames.length <= 1) {
      return { success: false, error: 'Cannot step out from bottom frame' };
    }

    const parentFrame = frames[1]; // Get parent frame
    const event: ExecutionEvent = {
      type: 'step',
      timestamp: new Date(),
      sequenceNumber: ++this.sequenceNumber,
      location: parentFrame.location,
      frame: parentFrame,
    };

    this.emitEvent(event);

    return {
      success: true,
      frame: parentFrame,
      location: parentFrame.location,
      executionEvent: event,
    };
  }

  /**
   * Continue execution
   */
  async continue(): Promise<StepResult> {
    const currentFrame = this.callStackVisualizer.getCurrentFrame();
    if (!currentFrame) {
      return { success: false, error: 'No active frame' };
    }

    const event: ExecutionEvent = {
      type: 'resume',
      timestamp: new Date(),
      sequenceNumber: ++this.sequenceNumber,
      location: currentFrame.location,
      frame: currentFrame,
    };

    this.emitEvent(event);

    return {
      success: true,
      frame: currentFrame,
      location: currentFrame.location,
      executionEvent: event,
    };
  }

  /**
   * Pause execution
   */
  async pause(): Promise<StepResult> {
    const currentFrame = this.callStackVisualizer.getCurrentFrame();
    if (!currentFrame) {
      return { success: false, error: 'No active frame' };
    }

    const event: ExecutionEvent = {
      type: 'pause',
      timestamp: new Date(),
      sequenceNumber: ++this.sequenceNumber,
      location: currentFrame.location,
      frame: currentFrame,
    };

    this.emitEvent(event);

    return {
      success: true,
      frame: currentFrame,
      location: currentFrame.location,
      executionEvent: event,
    };
  }

  /**
   * Subscribe to execution events
   */
  onEvent(callback: (event: ExecutionEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  /**
   * Create evaluation context from frame
   */
  private createEvaluationContext(frame: CallStackFrame): EvaluationContext {
    const locals: Record<string, unknown> = {};
    frame.locals.forEach((value, key) => {
      locals[key] = value.value?.value;
    });

    return {
      locals,
      thisValue: frame.thisValue?.value,
    };
  }

  /**
   * Emit execution event
   */
  private emitEvent(event: ExecutionEvent): void {
    for (const callback of this.eventListeners) {
      try {
        callback(event);
      } catch (error) {
        console.error('Execution event callback error:', error);
      }
    }
  }
}

// ============================================================================
// SCOPE INSPECTOR
// ============================================================================

export class ScopeInspector {
  private scopes: Map<string, Scope> = new Map();
  private changeCallbacks: Set<(scopes: Scope[]) => void> = new Set();

  /**
   * Set scopes for current context
   */
  setScopes(scopes: Scope[]): void {
    this.scopes.clear();
    scopes.forEach(scope => this.scopes.set(scope.name, scope));
    this.notifyChange();
  }

  /**
   * Get all scopes
   */
  getScopes(): Scope[] {
    return Array.from(this.scopes.values());
  }

  /**
   * Get scope by name
   */
  getScope(name: string): Scope | undefined {
    return this.scopes.get(name);
  }

  /**
   * Get local scope
   */
  getLocalScope(): Scope | undefined {
    return this.scopes.get('Local');
  }

  /**
   * Get global scope
   */
  getGlobalScope(): Scope | undefined {
    return this.scopes.get('Global');
  }

  /**
   * Get closure scopes
   */
  getClosureScopes(): Scope[] {
    return this.getScopes().filter(s => s.type === 'closure');
  }

  /**
   * Get all variables across all scopes
   */
  getAllVariables(): Map<string, VariableWatch> {
    const all = new Map<string, VariableWatch>();
    this.scopes.forEach(scope => {
      scope.variables.forEach((variable, name) => {
        all.set(name, variable);
      });
    });
    return all;
  }

  /**
   * Find variable by name across all scopes
   */
  findVariable(name: string): VariableWatch | undefined {
    // Search in order: local -> closure -> global
    for (const scopeType of ['local', 'closure', 'global'] as VariableScope[]) {
      for (const scope of this.scopes.values()) {
        if (scope.type === scopeType && scope.variables.has(name)) {
          return scope.variables.get(name);
        }
      }
    }
    return undefined;
  }

  /**
   * Update variable value
   */
  updateVariable(scopeName: string, variableName: string, value: unknown): boolean {
    const scope = this.scopes.get(scopeName);
    if (!scope) return false;

    const variable = scope.variables.get(variableName);
    if (!variable) return false;

    // This would be replaced by actual debug adapter call
    variable.value = {
      type: this.getType(value),
      value,
      displayValue: String(value),
      isTruncated: false,
    };

    this.notifyChange();
    return true;
  }

  /**
   * Subscribe to scope changes
   */
  onChange(callback: (scopes: Scope[]) => void): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  /**
   * Get type string
   */
  private getType(value: unknown): ValueType {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value as ValueType;
  }

  /**
   * Notify change listeners
   */
  private notifyChange(): void {
    const scopes = this.getScopes();
    for (const callback of this.changeCallbacks) {
      try {
        callback(scopes);
      } catch (error) {
        console.error('Scope change callback error:', error);
      }
    }
  }

  /**
   * Clear scopes
   */
  clear(): void {
    this.scopes.clear();
  }
}

// ============================================================================
// VISUAL DEBUGGER (Main Class)
// ============================================================================

export class VisualDebugger {
  public readonly watchManager: VariableWatchManager;
  public readonly breakpointManager: BreakpointManager;
  public readonly callStackVisualizer: CallStackVisualizer;
  public readonly stepExecutor: StepExecutor;
  public readonly scopeInspector: ScopeInspector;
  public readonly expressionEvaluator: WatchExpressionEvaluator;

  constructor() {
    this.watchManager = new VariableWatchManager();
    this.breakpointManager = new BreakpointManager();
    this.callStackVisualizer = new CallStackVisualizer();
    this.expressionEvaluator = new WatchExpressionEvaluator();
    this.scopeInspector = new ScopeInspector();
    this.stepExecutor = new StepExecutor(
      this.callStackVisualizer,
      this.breakpointManager
    );
  }

  /**
   * Initialize debugger with execution context
   */
  initialize(context: DebugContext): void {
    this.callStackVisualizer.setFrames(context.callStack);
    this.scopeInspector.setScopes(context.scopes);
    
    // Update watches with current values
    this.refreshWatches();
  }

  /**
   * Refresh all watch values
   */
  refreshWatches(): void {
    const currentFrame = this.callStackVisualizer.getCurrentFrame();
    if (!currentFrame) return;

    const context: EvaluationContext = {
      locals: this.localsToRecord(currentFrame.locals),
      thisValue: currentFrame.thisValue?.value,
    };

    for (const watch of this.watchManager.getWatches()) {
      try {
        const compiled = this.expressionEvaluator.compile(watch.expression);
        const value = this.expressionEvaluator.evaluate(compiled, context);
        this.watchManager.updateWatchValue(watch.id, value, 'evaluation');
      } catch (error) {
        this.watchManager.setWatchError(watch.id, (error as Error).message);
      }
    }
  }

  /**
   * Add watch expression
   */
  addWatch(expression: string, scope: VariableScope = 'local'): VariableWatch {
    const watch = this.watchManager.addWatch(expression, scope);
    
    // Evaluate immediately
    const currentFrame = this.callStackVisualizer.getCurrentFrame();
    if (currentFrame) {
      const context: EvaluationContext = {
        locals: this.localsToRecord(currentFrame.locals),
        thisValue: currentFrame.thisValue?.value,
      };

      try {
        const compiled = this.expressionEvaluator.compile(expression);
        const value = this.expressionEvaluator.evaluate(compiled, context);
        this.watchManager.updateWatchValue(watch.id, value, 'evaluation');
      } catch (error) {
        this.watchManager.setWatchError(watch.id, (error as Error).message);
      }
    }

    return watch;
  }

  /**
   * Set breakpoint with optional condition
   */
  setBreakpoint(
    location: SourceLocation,
    condition?: string,
    hitCondition?: string,
    logMessage?: string
  ): Breakpoint {
    const bp = this.breakpointManager.addBreakpoint(location);
    
    if (condition) {
      this.breakpointManager.setBreakpointCondition(bp.id, condition);
    }
    if (hitCondition) {
      this.breakpointManager.setHitCondition(bp.id, hitCondition);
    }
    if (logMessage) {
      this.breakpointManager.setLogMessage(bp.id, logMessage);
    }

    return bp;
  }

  /**
   * Step over current line
   */
  async stepOver(): Promise<StepResult> {
    const result = await this.stepExecutor.stepOver();
    if (result.success) {
      this.refreshWatches();
    }
    return result;
  }

  /**
   * Step into function
   */
  async stepInto(): Promise<StepResult> {
    const result = await this.stepExecutor.stepInto();
    if (result.success) {
      this.refreshWatches();
    }
    return result;
  }

  /**
   * Step out of current function
   */
  async stepOut(): Promise<StepResult> {
    const result = await this.stepExecutor.stepOut();
    if (result.success) {
      this.refreshWatches();
    }
    return result;
  }

  /**
   * Continue execution
   */
  async continue(): Promise<StepResult> {
    return this.stepExecutor.continue();
  }

  /**
   * Pause execution
   */
  async pause(): Promise<StepResult> {
    return this.stepExecutor.pause();
  }

  /**
   * Get current execution state
   */
  getState(): DebugState {
    const currentFrame = this.callStackVisualizer.getCurrentFrame();
    
    return {
      isPaused: true, // Would be updated by actual debug adapter
      currentLocation: currentFrame?.location,
      currentFrame,
      stackDepth: this.callStackVisualizer.getFrames().length,
      activeBreakpoints: this.breakpointManager.getBreakpoints().filter(bp => bp.isEnabled).length,
      activeWatches: this.watchManager.getWatches().filter(w => w.isEnabled).length,
    };
  }

  /**
   * Clear all debugger state
   */
  clear(): void {
    this.watchManager.clearWatches();
    this.breakpointManager.clearBreakpoints();
    this.callStackVisualizer.clear();
    this.scopeInspector.clear();
  }

  /**
   * Convert locals Map to Record
   */
  private localsToRecord(locals: Map<string, VariableWatch>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    locals.forEach((watch, key) => {
      result[key] = watch.value?.value;
    });
    return result;
  }
}

export interface DebugContext {
  callStack: CallStackFrame[];
  scopes: Scope[];
}

export interface DebugState {
  isPaused: boolean;
  currentLocation?: SourceLocation;
  currentFrame?: CallStackFrame;
  stackDepth: number;
  activeBreakpoints: number;
  activeWatches: number;
}

// Export singleton instance
export const visualDebugger = new VisualDebugger();
