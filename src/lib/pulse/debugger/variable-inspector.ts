/**
 * Kyro IDE Variable Inspector
 * 
 * Comprehensive variable inspection with expansion, editing,
 * path copying, and watch expression evaluation.
 * 
 * Features:
 * - Expand object/array nodes recursively
 * - Edit variable values in-place
 * - Copy variable paths to clipboard
 * - Watch expressions with live evaluation
 * - Variable search and filtering
 * - Variable grouping and sorting
 */

import type { EvaluationContext } from './visual-debugger';

// ============================================================================
// TYPES
// ============================================================================

export interface InspectionNode {
  id: string;
  name: string;
  fullPath: string;
  value: InspectedValue;
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
  hasChildren: boolean;
  children: InspectionNode[];
  parent: InspectionNode | null;
  metadata: NodeMetadata;
  editState?: EditState;
}

export interface InspectedValue {
  type: ValueTypeName;
  displayValue: string;
  rawValue: unknown;
  size?: number;
  objectId?: string;
  preview?: string;
  isTruncated: boolean;
  isEditable: boolean;
  isError: boolean;
  errorMessage?: string;
}

export type ValueTypeName = 
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
  | 'proxy'
  | 'iterator'
  | 'generator'
  | 'typedarray'
  | 'arraybuffer'
  | 'dataview';

export interface NodeMetadata {
  scope: 'local' | 'global' | 'closure' | 'script' | 'watch';
  isOwnProperty: boolean;
  isGetter: boolean;
  isSetter: boolean;
  isEnumerable: boolean;
  isConfigurable: boolean;
  isWritable: boolean;
  accessModifier?: 'public' | 'private' | 'protected' | 'internal';
  source?: string;
  line?: number;
  column?: number;
}

export interface EditState {
  isEditing: boolean;
  originalValue: string;
  currentValue: string;
  isValid: boolean;
  validationError?: string;
  isSubmitting: boolean;
}

export interface WatchExpressionEntry {
  id: string;
  expression: string;
  node: InspectionNode | null;
  error?: string;
  isEnabled: boolean;
  createdAt: Date;
  lastEvaluatedAt?: Date;
  evaluationCount: number;
}

export interface SearchResult {
  node: InspectionNode;
  matchType: 'name' | 'value' | 'path';
  matchText: string;
  matchIndex: number;
}

export interface InspectionOptions {
  maxDepth: number;
  maxStringLength: number;
  maxArrayElements: number;
  maxObjectProperties: number;
  showGetters: boolean;
  showInternalProperties: boolean;
  showPrototypes: boolean;
  showSymbolKeys: boolean;
  sortProperties: boolean;
  groupByType: boolean;
}

export interface VariableEditResult {
  success: boolean;
  newValue?: InspectedValue;
  error?: string;
  requiresRestart?: boolean;
}

// ============================================================================
// VARIABLE INSPECTOR
// ============================================================================

export class VariableInspector {
  private rootNodes: Map<string, InspectionNode> = new Map();
  private expandedNodes: Set<string> = new Set();
  private watchExpressions: Map<string, WatchExpressionEntry> = new Map();
  private nodeCache: Map<string, InspectionNode> = new Map();
  private idCounter: number = 0;
  private options: InspectionOptions;
  private changeListeners: Set<(nodes: InspectionNode[]) => void> = new Set();
  private evaluationContext: EvaluationContext = {};

  constructor(options?: Partial<InspectionOptions>) {
    this.options = {
      maxDepth: 10,
      maxStringLength: 1000,
      maxArrayElements: 100,
      maxObjectProperties: 100,
      showGetters: false,
      showInternalProperties: false,
      showPrototypes: false,
      showSymbolKeys: true,
      sortProperties: true,
      groupByType: false,
      ...options,
    };
  }

  // ============================================================================
  // ROOT NODE MANAGEMENT
  // ============================================================================

  /**
   * Set root variables (e.g., from a scope)
   */
  setRootVariables(
    scopeName: string,
    variables: Record<string, unknown>,
    scope: 'local' | 'global' | 'closure' | 'script' | 'watch' = 'local'
  ): InspectionNode[] {
    const nodes: InspectionNode[] = [];

    for (const [name, value] of Object.entries(variables)) {
      const node = this.createNode(name, name, value, 0, scope);
      nodes.push(node);
      this.rootNodes.set(node.id, node);
    }

    if (this.options.sortProperties) {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
    }

    this.notifyChange();
    return nodes;
  }

  /**
   * Get all root nodes
   */
  getRootNodes(): InspectionNode[] {
    return Array.from(this.rootNodes.values());
  }

  /**
   * Clear all nodes
   */
  clearNodes(): void {
    this.rootNodes.clear();
    this.expandedNodes.clear();
    this.nodeCache.clear();
    this.notifyChange();
  }

  // ============================================================================
  // NODE EXPANSION
  // ============================================================================

  /**
   * Expand node and load children
   */
  async expandNode(nodeId: string): Promise<InspectionNode | null> {
    const node = this.nodeCache.get(nodeId);
    if (!node) return null;

    if (node.isExpanded) return node;

    node.isExpanded = true;
    node.isLoading = true;
    this.expandedNodes.add(nodeId);
    this.notifyChange();

    try {
      await this.loadChildren(node);
    } catch (error) {
      node.value.isError = true;
      node.value.errorMessage = (error as Error).message;
    } finally {
      node.isLoading = false;
    }

    this.notifyChange();
    return node;
  }

  /**
   * Collapse node
   */
  collapseNode(nodeId: string): InspectionNode | null {
    const node = this.nodeCache.get(nodeId);
    if (!node) return null;

    node.isExpanded = false;
    this.expandedNodes.delete(nodeId);
    this.notifyChange();
    return node;
  }

  /**
   * Toggle node expansion
   */
  async toggleNode(nodeId: string): Promise<InspectionNode | null> {
    const node = this.nodeCache.get(nodeId);
    if (!node) return null;

    if (node.isExpanded) {
      return this.collapseNode(nodeId);
    } else {
      return this.expandNode(nodeId);
    }
  }

  /**
   * Expand to specific depth
   */
  async expandToDepth(nodeId: string, targetDepth: number): Promise<void> {
    const expandRecursive = async (node: InspectionNode, currentDepth: number): Promise<void> => {
      if (currentDepth >= targetDepth) return;
      if (!node.hasChildren) return;

      await this.expandNode(node.id);

      for (const child of node.children) {
        await expandRecursive(child, currentDepth + 1);
      }
    };

    const node = this.nodeCache.get(nodeId);
    if (node) {
      await expandRecursive(node, 0);
    }
  }

  /**
   * Expand all nodes
   */
  async expandAll(maxDepth: number = 3): Promise<void> {
    const expandRecursive = async (nodes: InspectionNode[], depth: number): Promise<void> => {
      if (depth >= maxDepth) return;

      for (const node of nodes) {
        if (node.hasChildren && !node.isExpanded) {
          await this.expandNode(node.id);
        }
        if (node.children.length > 0) {
          await expandRecursive(node.children, depth + 1);
        }
      }
    };

    await expandRecursive(this.getRootNodes(), 0);
  }

  /**
   * Collapse all nodes
   */
  collapseAll(): void {
    this.expandedNodes.clear();
    for (const node of this.nodeCache.values()) {
      node.isExpanded = false;
    }
    this.notifyChange();
  }

  // ============================================================================
  // CHILD LOADING
  // ============================================================================

  /**
   * Load children for a node
   */
  private async loadChildren(node: InspectionNode): Promise<void> {
    const value = node.value.rawValue;

    if (value === null || value === undefined) {
      node.hasChildren = false;
      return;
    }

    const type = node.value.type;
    let children: Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> = [];

    switch (type) {
      case 'object':
        children = this.getObjectChildren(value as object);
        break;
      case 'array':
        children = this.getArrayChildren(value as unknown[]);
        break;
      case 'map':
        children = this.getMapChildren(value as Map<unknown, unknown>);
        break;
      case 'set':
        children = this.getSetChildren(value as Set<unknown>);
        break;
      case 'function':
        children = this.getFunctionChildren(value as (...args: unknown[]) => unknown);
        break;
      case 'date':
        children = this.getDateChildren(value as Date);
        break;
      case 'regexp':
        children = this.getRegExpChildren(value as RegExp);
        break;
      case 'error':
        children = this.getErrorChildren(value as Error);
        break;
      case 'promise':
        children = this.getPromiseChildren(value as Promise<unknown>);
        break;
      case 'typedarray':
        children = this.getTypedArrayChildren(value as ArrayLike<unknown>);
        break;
      default:
        node.hasChildren = false;
        return;
    }

    // Apply limits
    if (children.length > this.options.maxObjectProperties) {
      children = children.slice(0, this.options.maxObjectProperties);
    }

    // Sort if enabled
    if (this.options.sortProperties) {
      children.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Create child nodes
    node.children = children.map(child => 
      this.createNode(
        child.name,
        `${node.fullPath}.${child.name}`,
        child.value,
        node.depth + 1,
        node.metadata.scope,
        node,
        child.metadata
      )
    );

    node.hasChildren = node.children.length > 0;
  }

  /**
   * Get object children
   */
  private getObjectChildren(obj: object): Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> {
    const children: Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> = [];
    const proto = Object.getPrototypeOf(obj);

    // Own properties
    const descriptors = Object.getOwnPropertyDescriptors(obj);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!this.options.showInternalProperties && key.startsWith('_')) continue;

      const isGetter = typeof descriptor.get === 'function';
      const isSetter = typeof descriptor.set === 'function';

      children.push({
        name: key,
        value: isGetter ? descriptor.get?.call(obj) : descriptor.value,
        metadata: {
          isOwnProperty: true,
          isGetter,
          isSetter,
          isEnumerable: descriptor.enumerable,
          isConfigurable: descriptor.configurable,
          isWritable: descriptor.writable ?? false,
        },
      });
    }

    // Symbol properties
    if (this.options.showSymbolKeys) {
      const symbols = Object.getOwnPropertySymbols(obj);
      for (const sym of symbols) {
        const descriptor = Object.getOwnPropertyDescriptor(obj, sym);
        if (descriptor) {
          children.push({
            name: sym.toString(),
            value: descriptor.value,
            metadata: {
              isOwnProperty: true,
              isEnumerable: descriptor.enumerable,
            },
          });
        }
      }
    }

    // Prototype chain
    if (this.options.showPrototypes && proto && proto !== Object.prototype) {
      children.push({
        name: '[[Prototype]]',
        value: proto,
        metadata: {
          isOwnProperty: false,
        },
      });
    }

    return children;
  }

  /**
   * Get array children
   */
  private getArrayChildren(arr: unknown[]): Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> {
    const children: Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> = [];
    
    const limit = Math.min(arr.length, this.options.maxArrayElements);

    for (let i = 0; i < limit; i++) {
      children.push({
        name: String(i),
        value: arr[i],
        metadata: {
          isOwnProperty: true,
          isEnumerable: true,
        },
      });
    }

    if (arr.length > limit) {
      children.push({
        name: '...',
        value: `${arr.length - limit} more elements`,
        metadata: {
          isOwnProperty: false,
        },
      });
    }

    // Add length property
    children.push({
      name: 'length',
      value: arr.length,
      metadata: {
        isOwnProperty: true,
        isEnumerable: false,
      },
    });

    return children;
  }

  /**
   * Get Map children
   */
  private getMapChildren(map: Map<unknown, unknown>): Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> {
    const children: Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> = [];
    let index = 0;

    for (const [key, value] of map.entries()) {
      children.push({
        name: this.formatKey(key),
        value,
        metadata: {
          isOwnProperty: true,
        },
      });

      if (++index >= this.options.maxObjectProperties) break;
    }

    children.push({
      name: 'size',
      value: map.size,
      metadata: {
        isOwnProperty: true,
      },
    });

    return children;
  }

  /**
   * Get Set children
   */
  private getSetChildren(set: Set<unknown>): Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> {
    const children: Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> = [];
    let index = 0;

    for (const value of set.values()) {
      children.push({
        name: `entry ${index}`,
        value,
        metadata: {
          isOwnProperty: true,
        },
      });

      if (++index >= this.options.maxObjectProperties) break;
    }

    children.push({
      name: 'size',
      value: set.size,
      metadata: {
        isOwnProperty: true,
      },
    });

    return children;
  }

  /**
   * Get function children
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private getFunctionChildren(fn: Function): Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> {
    const children: Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> = [];

    // Function properties
    const props = Object.getOwnPropertyNames(fn);
    for (const prop of props) {
      if (prop === 'prototype' || prop === 'length' || prop === 'name') continue;
      children.push({
        name: prop,
        value: (fn as Record<string, unknown>)[prop],
        metadata: {
          isOwnProperty: true,
        },
      });
    }

    // Prototype
    if (fn.prototype) {
      children.push({
        name: 'prototype',
        value: fn.prototype,
        metadata: {
          isOwnProperty: true,
        },
      });
    }

    // Function metadata
    children.push({
      name: 'name',
      value: fn.name || 'anonymous',
      metadata: {
        isOwnProperty: true,
      },
    });

    children.push({
      name: 'length',
      value: fn.length,
      metadata: {
        isOwnProperty: true,
      },
    });

    return children;
  }

  /**
   * Get Date children
   */
  private getDateChildren(date: Date): Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> {
    return [
      { name: 'toISOString', value: date.toISOString() },
      { name: 'toLocaleString', value: date.toLocaleString() },
      { name: 'valueOf', value: date.valueOf() },
      { name: 'getTime', value: date.getTime() },
    ];
  }

  /**
   * Get RegExp children
   */
  private getRegExpChildren(regex: RegExp): Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> {
    return [
      { name: 'source', value: regex.source },
      { name: 'flags', value: regex.flags },
      { name: 'lastIndex', value: regex.lastIndex },
      { name: 'global', value: regex.global },
      { name: 'ignoreCase', value: regex.ignoreCase },
      { name: 'multiline', value: regex.multiline },
    ];
  }

  /**
   * Get Error children
   */
  private getErrorChildren(error: Error): Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> {
    const children: Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> = [
      { name: 'name', value: error.name },
      { name: 'message', value: error.message },
    ];

    if (error.stack) {
      children.push({ name: 'stack', value: error.stack });
    }

    if ('cause' in error && error.cause) {
      children.push({ name: 'cause', value: error.cause });
    }

    return children;
  }

  /**
   * Get Promise children
   */
  private getPromiseChildren(_promise: Promise<unknown>): Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> {
    return [
      { name: '[[PromiseState]]', value: 'pending' },
      { name: '[[PromiseResult]]', value: undefined },
    ];
  }

  /**
   * Get TypedArray children
   */
  private getTypedArrayChildren(arr: ArrayLike<unknown>): Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> {
    const children: Array<{ name: string; value: unknown; metadata?: Partial<NodeMetadata> }> = [];

    const limit = Math.min(arr.length, this.options.maxArrayElements);

    for (let i = 0; i < limit; i++) {
      children.push({
        name: String(i),
        value: arr[i],
      });
    }

    children.push({
      name: 'length',
      value: arr.length,
    });

    children.push({
      name: 'byteLength',
      value: (arr as ArrayBufferView).byteLength,
    });

    return children;
  }

  // ============================================================================
  // VARIABLE EDITING
  // ============================================================================

  /**
   * Start editing a variable
   */
  startEditing(nodeId: string): InspectionNode | null {
    const node = this.nodeCache.get(nodeId);
    if (!node || !node.value.isEditable) return null;

    node.editState = {
      isEditing: true,
      originalValue: this.serializeValue(node.value.rawValue),
      currentValue: this.serializeValue(node.value.rawValue),
      isValid: true,
      isSubmitting: false,
    };

    this.notifyChange();
    return node;
  }

  /**
   * Update edit value
   */
  updateEditValue(nodeId: string, newValue: string): InspectionNode | null {
    const node = this.nodeCache.get(nodeId);
    if (!node || !node.editState) return null;

    node.editState.currentValue = newValue;

    // Validate
    const validation = this.validateValue(newValue);
    node.editState.isValid = validation.isValid;
    node.editState.validationError = validation.error;

    this.notifyChange();
    return node;
  }

  /**
   * Commit edit
   */
  async commitEdit(nodeId: string): Promise<VariableEditResult> {
    const node = this.nodeCache.get(nodeId);
    if (!node || !node.editState) {
      return { success: false, error: 'Node not found or not editing' };
    }

    if (!node.editState.isValid) {
      return { success: false, error: node.editState.validationError };
    }

    node.editState.isSubmitting = true;
    this.notifyChange();

    try {
      const newValue = this.parseValue(node.editState.currentValue);
      
      // In a real implementation, this would call the debug adapter
      // to set the variable value
      const success = await this.setVariableValue(node.fullPath, newValue);

      if (success) {
        node.value = this.createInspectedValue(newValue);
        node.editState = undefined;
        this.notifyChange();
        return { success: true, newValue: node.value };
      } else {
        return { success: false, error: 'Failed to set variable value' };
      }
    } catch (error) {
      return { success: false, error: (error as Error).message };
    } finally {
      if (node.editState) {
        node.editState.isSubmitting = false;
      }
      this.notifyChange();
    }
  }

  /**
   * Cancel edit
   */
  cancelEdit(nodeId: string): InspectionNode | null {
    const node = this.nodeCache.get(nodeId);
    if (!node) return null;

    node.editState = undefined;
    this.notifyChange();
    return node;
  }

  /**
   * Set variable value (placeholder for debug adapter call)
   */
  private async setVariableValue(_path: string, _value: unknown): Promise<boolean> {
    // In a real implementation, this would call the debug adapter
    return true;
  }

  // ============================================================================
  // PATH OPERATIONS
  // ============================================================================

  /**
   * Copy variable path to clipboard
   */
  copyPath(nodeId: string): string {
    const node = this.nodeCache.get(nodeId);
    if (!node) return '';

    // In a browser environment, this would copy to clipboard
    // navigator.clipboard.writeText(node.fullPath);
    
    return node.fullPath;
  }

  /**
   * Copy variable value to clipboard
   */
  copyValue(nodeId: string): string {
    const node = this.nodeCache.get(nodeId);
    if (!node) return '';

    const serialized = this.serializeValue(node.value.rawValue);
    
    // In a browser environment, this would copy to clipboard
    // navigator.clipboard.writeText(serialized);
    
    return serialized;
  }

  /**
   * Copy as JSON
   */
  copyAsJSON(nodeId: string): string {
    const node = this.nodeCache.get(nodeId);
    if (!node) return '';

    try {
      const json = JSON.stringify(node.value.rawValue, null, 2);
      
      // In a browser environment, this would copy to clipboard
      // navigator.clipboard.writeText(json);
      
      return json;
    } catch {
      return '';
    }
  }

  /**
   * Get variable path expression
   */
  getPathExpression(nodeId: string): string {
    const node = this.nodeCache.get(nodeId);
    if (!node) return '';

    // Convert path to valid JavaScript expression
    return this.fullPathToExpression(node.fullPath);
  }

  /**
   * Convert full path to JS expression
   */
  private fullPathToExpression(path: string): string {
    // Handle array indices and special characters
    return path
      .split('.')
      .map((part, index) => {
        if (/^\d+$/.test(part)) {
          return `[${part}]`;
        }
        if (index === 0) {
          return part;
        }
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(part)) {
          return `.${part}`;
        }
        return `["${part}"]`;
      })
      .join('');
  }

  // ============================================================================
  // WATCH EXPRESSIONS
  // ============================================================================

  /**
   * Add watch expression
   */
  addWatchExpression(expression: string): WatchExpressionEntry {
    const id = `watch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const entry: WatchExpressionEntry = {
      id,
      expression,
      node: null,
      isEnabled: true,
      createdAt: new Date(),
      evaluationCount: 0,
    };

    this.watchExpressions.set(id, entry);
    this.evaluateWatchExpression(id);

    return entry;
  }

  /**
   * Remove watch expression
   */
  removeWatchExpression(id: string): boolean {
    return this.watchExpressions.delete(id);
  }

  /**
   * Update watch expression
   */
  updateWatchExpression(id: string, expression: string): WatchExpressionEntry | null {
    const entry = this.watchExpressions.get(id);
    if (!entry) return null;

    entry.expression = expression;
    entry.node = null;
    entry.error = undefined;

    this.evaluateWatchExpression(id);
    return entry;
  }

  /**
   * Toggle watch expression enabled state
   */
  toggleWatchExpression(id: string): boolean {
    const entry = this.watchExpressions.get(id);
    if (!entry) return false;

    entry.isEnabled = !entry.isEnabled;
    this.notifyChange();
    return entry.isEnabled;
  }

  /**
   * Evaluate watch expression
   */
  evaluateWatchExpression(id: string): WatchExpressionEntry | null {
    const entry = this.watchExpressions.get(id);
    if (!entry || !entry.isEnabled) return null;

    try {
      const value = this.evaluateExpression(entry.expression);
      
      entry.node = this.createNode(
        entry.expression,
        entry.expression,
        value,
        0,
        'watch'
      );
      entry.error = undefined;
    } catch (error) {
      entry.error = (error as Error).message;
      entry.node = null;
    }

    entry.lastEvaluatedAt = new Date();
    entry.evaluationCount++;

    this.notifyChange();
    return entry;
  }

  /**
   * Evaluate all watch expressions
   */
  evaluateAllWatchExpressions(): void {
    for (const id of this.watchExpressions.keys()) {
      this.evaluateWatchExpression(id);
    }
  }

  /**
   * Get all watch expressions
   */
  getWatchExpressions(): WatchExpressionEntry[] {
    return Array.from(this.watchExpressions.values());
  }

  /**
   * Set evaluation context
   */
  setEvaluationContext(context: EvaluationContext): void {
    this.evaluationContext = context;
    this.evaluateAllWatchExpressions();
  }

  /**
   * Evaluate expression in current context
   */
  private evaluateExpression(expression: string): unknown {
    // Simplified expression evaluation
    // In a real implementation, this would use proper parsing and evaluation
    
    const context = {
      ...this.evaluationContext.locals,
      ...this.evaluationContext.closure,
      ...this.evaluationContext.globals,
    };

    // Try to resolve as simple identifier
    if (expression in context) {
      return context[expression];
    }

    // Try to resolve as property access
    const parts = expression.split('.');
    let value: unknown = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  }

  // ============================================================================
  // SEARCH
  // ============================================================================

  /**
   * Search for variables
   */
  search(query: string, options?: { searchNames?: boolean; searchValues?: boolean; caseSensitive?: boolean }): SearchResult[] {
    const results: SearchResult[] = [];
    const searchNames = options?.searchNames ?? true;
    const searchValues = options?.searchValues ?? true;
    const caseSensitive = options?.caseSensitive ?? false;

    const searchQuery = caseSensitive ? query : query.toLowerCase();

    const searchNode = (node: InspectionNode): void => {
      // Search in name
      if (searchNames) {
        const name = caseSensitive ? node.name : node.name.toLowerCase();
        const index = name.indexOf(searchQuery);
        if (index !== -1) {
          results.push({
            node,
            matchType: 'name',
            matchText: node.name,
            matchIndex: index,
          });
        }
      }

      // Search in value
      if (searchValues) {
        const value = caseSensitive 
          ? node.value.displayValue 
          : node.value.displayValue.toLowerCase();
        const index = value.indexOf(searchQuery);
        if (index !== -1) {
          results.push({
            node,
            matchType: 'value',
            matchText: node.value.displayValue,
            matchIndex: index,
          });
        }
      }

      // Search in path
      const path = caseSensitive ? node.fullPath : node.fullPath.toLowerCase();
      const pathIndex = path.indexOf(searchQuery);
      if (pathIndex !== -1) {
        results.push({
          node,
          matchType: 'path',
          matchText: node.fullPath,
          matchIndex: pathIndex,
        });
      }

      // Search children
      for (const child of node.children) {
        searchNode(child);
      }
    };

    for (const node of this.rootNodes.values()) {
      searchNode(node);
    }

    return results;
  }

  /**
   * Find node by path
   */
  findByPath(path: string): InspectionNode | null {
    for (const node of this.nodeCache.values()) {
      if (node.fullPath === path) {
        return node;
      }
    }
    return null;
  }

  /**
   * Find node by ID
   */
  findById(id: string): InspectionNode | null {
    return this.nodeCache.get(id) || null;
  }

  // ============================================================================
  // NODE CREATION
  // ============================================================================

  /**
   * Create inspection node
   */
  private createNode(
    name: string,
    fullPath: string,
    value: unknown,
    depth: number,
    scope: 'local' | 'global' | 'closure' | 'script' | 'watch',
    parent: InspectionNode | null = null,
    metadata?: Partial<NodeMetadata>
  ): InspectionNode {
    const id = `node-${++this.idCounter}`;
    
    const node: InspectionNode = {
      id,
      name,
      fullPath,
      value: this.createInspectedValue(value),
      depth,
      isExpanded: this.expandedNodes.has(id),
      isLoading: false,
      hasChildren: false,
      children: [],
      parent,
      metadata: {
        scope,
        isOwnProperty: true,
        isGetter: false,
        isSetter: false,
        isEnumerable: true,
        isConfigurable: true,
        isWritable: true,
        ...metadata,
      },
    };

    // Determine if has children
    node.hasChildren = this.determineHasChildren(value, depth);

    this.nodeCache.set(id, node);
    return node;
  }

  /**
   * Create inspected value
   */
  private createInspectedValue(value: unknown): InspectedValue {
    if (value === undefined) {
      return {
        type: 'undefined',
        displayValue: 'undefined',
        rawValue: undefined,
        isTruncated: false,
        isEditable: false,
        isError: false,
      };
    }

    if (value === null) {
      return {
        type: 'null',
        displayValue: 'null',
        rawValue: null,
        isTruncated: false,
        isEditable: false,
        isError: false,
      };
    }

    const type = this.getValueType(value);
    let displayValue = this.formatDisplayValue(value, type);
    const isTruncated = displayValue.length > this.options.maxStringLength;

    if (isTruncated) {
      displayValue = displayValue.slice(0, this.options.maxStringLength) + '...';
    }

    return {
      type,
      displayValue,
      rawValue: value,
      size: this.getValueSize(value, type),
      objectId: type === 'object' || type === 'array' ? `obj-${Date.now()}` : undefined,
      preview: this.createPreview(value, type),
      isTruncated,
      isEditable: this.isEditable(type),
      isError: false,
    };
  }

  /**
   * Get value type
   */
  private getValueType(value: unknown): ValueTypeName {
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
    if (value instanceof ArrayBuffer) return 'arraybuffer';
    if (ArrayBuffer.isView(value)) return 'typedarray';

    // Check for iterator/generator
    if (typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function') {
      if ((value as Generator).next && typeof (value as Generator).next === 'function') {
        return 'generator';
      }
      return 'iterator';
    }

    return 'object';
  }

  /**
   * Format display value
   */
  private formatDisplayValue(value: unknown, type: ValueTypeName): string {
    switch (type) {
      case 'undefined':
      case 'null':
      case 'boolean':
      case 'number':
      case 'bigint':
        return String(value);

      case 'string': {
        const str = value as string;
        if (str.length > this.options.maxStringLength) {
          return `"${str.slice(0, this.options.maxStringLength)}..."`;
        }
        return `"${str}"`;
      }

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

      case 'arraybuffer':
        return `ArrayBuffer(${(value as ArrayBuffer).byteLength})`;

      case 'typedarray':
        return `${(value as object).constructor.name}(${(value as ArrayLike<unknown>).length})`;

      case 'iterator':
        return 'Iterator';

      case 'generator':
        return 'Generator';

      case 'object':
        if (value === null) return 'null';
        const constructor = (value as object).constructor?.name || 'Object';
        return `${constructor} {}`;

      default:
        return String(value);
    }
  }

  /**
   * Get value size
   */
  private getValueSize(value: unknown, type: ValueTypeName): number | undefined {
    switch (type) {
      case 'string':
        return (value as string).length;
      case 'array':
        return (value as unknown[]).length;
      case 'map':
        return (value as Map<unknown, unknown>).size;
      case 'set':
        return (value as Set<unknown>).size;
      case 'arraybuffer':
        return (value as ArrayBuffer).byteLength;
      case 'typedarray':
        return (value as ArrayLike<unknown>).length;
      default:
        return undefined;
    }
  }

  /**
   * Create preview string
   */
  private createPreview(value: unknown, type: ValueTypeName): string | undefined {
    if (type === 'object' && value !== null) {
      const keys = Object.keys(value as object).slice(0, 3);
      if (keys.length > 0) {
        return `{ ${keys.map(k => `${k}: ...`).join(', ')} }`;
      }
    }

    if (type === 'array') {
      const arr = value as unknown[];
      if (arr.length > 0) {
        const preview = arr.slice(0, 3).map(v => {
          if (v === null) return 'null';
          if (v === undefined) return 'undefined';
          if (typeof v === 'object') return '{...}';
          return String(v);
        });
        return `[${preview.join(', ')}${arr.length > 3 ? ', ...' : ''}]`;
      }
    }

    return undefined;
  }

  /**
   * Determine if value has children
   */
  private determineHasChildren(value: unknown, depth: number): boolean {
    if (value === null || value === undefined) return false;
    if (depth >= this.options.maxDepth) return false;

    const type = typeof value;
    if (type !== 'object' && type !== 'function') return false;

    if (value instanceof Date || value instanceof RegExp) return false;

    if (Array.isArray(value)) return value.length > 0;
    if (value instanceof Map || value instanceof Set) return value.size > 0;

    return Object.keys(value as object).length > 0;
  }

  /**
   * Check if type is editable
   */
  private isEditable(type: ValueTypeName): boolean {
    return ['string', 'number', 'boolean', 'null', 'undefined'].includes(type);
  }

  /**
   * Format key for display
   */
  private formatKey(key: unknown): string {
    if (typeof key === 'string') {
      return key;
    }
    if (typeof key === 'symbol') {
      return key.toString();
    }
    return String(key);
  }

  // ============================================================================
  // SERIALIZATION
  // ============================================================================

  /**
   * Serialize value to string
   */
  private serializeValue(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Parse value from string
   */
  private parseValue(str: string): unknown {
    // Try parsing as JSON
    try {
      return JSON.parse(str);
    } catch {
      // Not valid JSON
    }

    // Try as primitive
    if (str === 'undefined') return undefined;
    if (str === 'null') return null;
    if (str === 'true') return true;
    if (str === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(str)) return parseFloat(str);

    // Return as string
    return str;
  }

  /**
   * Validate value string
   */
  private validateValue(str: string): { isValid: boolean; error?: string } {
    try {
      this.parseValue(str);
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: (error as Error).message };
    }
  }

  // ============================================================================
  // CHANGE NOTIFICATION
  // ============================================================================

  /**
   * Subscribe to changes
   */
  onChange(callback: (nodes: InspectionNode[]) => void): () => void {
    this.changeListeners.add(callback);
    return () => this.changeListeners.delete(callback);
  }

  /**
   * Notify change listeners
   */
  private notifyChange(): void {
    const nodes = this.getRootNodes();
    for (const callback of this.changeListeners) {
      try {
        callback(nodes);
      } catch (error) {
        console.error('Change listener error:', error);
      }
    }
  }

  // ============================================================================
  // OPTIONS
  // ============================================================================

  /**
   * Update inspection options
   */
  setOptions(options: Partial<InspectionOptions>): void {
    this.options = { ...this.options, ...options };
    this.notifyChange();
  }

  /**
   * Get current options
   */
  getOptions(): InspectionOptions {
    return { ...this.options };
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  /**
   * Export nodes to JSON
   */
  exportToJSON(): string {
    const data = {
      nodes: this.getRootNodes().map(n => this.serializeNode(n)),
      watchExpressions: Array.from(this.watchExpressions.values()).map(e => ({
        id: e.id,
        expression: e.expression,
        isEnabled: e.isEnabled,
      })),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Serialize node for export
   */
  private serializeNode(node: InspectionNode): Record<string, unknown> {
    return {
      name: node.name,
      fullPath: node.fullPath,
      value: node.value.rawValue,
      type: node.value.type,
      displayValue: node.value.displayValue,
      children: node.children.map(c => this.serializeNode(c)),
    };
  }
}

// Export singleton instance
export const variableInspector = new VariableInspector();
