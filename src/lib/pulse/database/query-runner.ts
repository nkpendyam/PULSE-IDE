/**
 * Kyro IDE - Query Runner
 * SQL editor integration, query history, parameterized queries, pagination, and export
 */

import type { DatabaseConnection, QueryExecutionResult, QueryField, DatabaseType } from './database-explorer';

// ============================================
// INTERFACES
// ============================================

export interface QueryResult {
  id: string;
  query: string;
  params?: unknown[];
  connectionId: string;
  connectionName: string;
  status: QueryStatus;
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: QueryField[];
  executionTime: number;
  startTime: Date;
  endTime?: Date;
  error?: QueryError;
  pagination?: PaginationInfo;
  affectedRows?: number;
  insertId?: string | number;
  warnings?: string[];
}

export type QueryStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';

export interface QueryError {
  code?: string;
  message: string;
  position?: number;
  line?: number;
  column?: number;
  hint?: string;
  detail?: string;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  connectionId: string;
  connectionName: string;
  executedAt: Date;
  executionTime: number;
  rowCount: number;
  status: QueryStatus;
  isFavorite: boolean;
  tags: string[];
}

export interface ParameterizedQuery {
  query: string;
  params: QueryParameter[];
}

export interface QueryParameter {
  name: string;
  type: ParameterType;
  value: unknown;
  nullable: boolean;
}

export type ParameterType = 
  | 'string' 
  | 'number' 
  | 'integer' 
  | 'boolean' 
  | 'date' 
  | 'datetime' 
  | 'json' 
  | 'binary';

export interface ExportOptions {
  format: ExportFormat;
  includeHeaders: boolean;
  dateFormat: string;
  nullValue: string;
  delimiter?: string;
  encoding?: string;
  sheetName?: string;
}

export type ExportFormat = 'csv' | 'json' | 'excel' | 'sql' | 'xml' | 'markdown';

export interface ExplainResult {
  query: string;
  plan: ExplainPlanRow[];
  totalCost: number;
  totalRows: number;
  executionTime?: number;
  buffers?: BufferInfo;
}

export interface ExplainPlanRow {
  id: number;
  operation: string;
  relation?: string;
  alias?: string;
  cost: number;
  rows: number;
  width: number;
  actualTime?: number;
  actualRows?: number;
  actualLoops?: number;
  children?: ExplainPlanRow[];
  extra?: Record<string, unknown>;
}

export interface BufferInfo {
  sharedRead: number;
  sharedHit: number;
  sharedDirtied: number;
  sharedWritten: number;
  tempRead: number;
  tempWritten: number;
}

export interface QueryEditorState {
  query: string;
  selection?: { start: number; end: number };
  cursorPosition: number;
  connectionId?: string;
  database?: string;
}

export interface AutocompleteSuggestion {
  type: 'keyword' | 'table' | 'column' | 'function' | 'operator';
  value: string;
  displayText?: string;
  documentation?: string;
  priority: number;
}

// ============================================
// QUERY HISTORY MANAGER
// ============================================

export class QueryHistoryManager {
  private history: QueryHistoryItem[] = [];
  private maxHistorySize: number;
  private storageKey = 'pulse_query_history';

  constructor(maxHistorySize: number = 500) {
    this.maxHistorySize = maxHistorySize;
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.history = parsed.map((item: QueryHistoryItem) => ({
            ...item,
            executedAt: new Date(item.executedAt),
          }));
        }
      }
    } catch {
      this.history = [];
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.history));
      }
    } catch {
      // Ignore storage errors
    }
  }

  add(
    query: string,
    connectionId: string,
    connectionName: string,
    executionTime: number,
    rowCount: number,
    status: QueryStatus
  ): QueryHistoryItem {
    const item: QueryHistoryItem = {
      id: `qh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      query,
      connectionId,
      connectionName,
      executedAt: new Date(),
      executionTime,
      rowCount,
      status,
      isFavorite: false,
      tags: [],
    };

    this.history.unshift(item);

    // Trim to max size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }

    this.saveToStorage();
    return item;
  }

  getHistory(limit?: number, filters?: HistoryFilter): QueryHistoryItem[] {
    let items = [...this.history];

    if (filters) {
      if (filters.connectionId) {
        items = items.filter(i => i.connectionId === filters.connectionId);
      }
      if (filters.status) {
        items = items.filter(i => i.status === filters.status);
      }
      if (filters.isFavorite !== undefined) {
        items = items.filter(i => i.isFavorite === filters.isFavorite);
      }
      if (filters.searchQuery) {
        const search = filters.searchQuery.toLowerCase();
        items = items.filter(i => i.query.toLowerCase().includes(search));
      }
      if (filters.tags && filters.tags.length > 0) {
        items = items.filter(i => 
          filters.tags!.some(tag => i.tags.includes(tag))
        );
      }
      if (filters.startDate) {
        items = items.filter(i => i.executedAt >= filters.startDate!);
      }
      if (filters.endDate) {
        items = items.filter(i => i.executedAt <= filters.endDate!);
      }
    }

    if (limit) {
      items = items.slice(0, limit);
    }

    return items;
  }

  getItem(id: string): QueryHistoryItem | undefined {
    return this.history.find(i => i.id === id);
  }

  toggleFavorite(id: string): boolean {
    const item = this.history.find(i => i.id === id);
    if (item) {
      item.isFavorite = !item.isFavorite;
      this.saveToStorage();
      return item.isFavorite;
    }
    return false;
  }

  addTag(id: string, tag: string): void {
    const item = this.history.find(i => i.id === id);
    if (item && !item.tags.includes(tag)) {
      item.tags.push(tag);
      this.saveToStorage();
    }
  }

  removeTag(id: string, tag: string): void {
    const item = this.history.find(i => i.id === id);
    if (item) {
      item.tags = item.tags.filter(t => t !== tag);
      this.saveToStorage();
    }
  }

  deleteItem(id: string): boolean {
    const index = this.history.findIndex(i => i.id === id);
    if (index !== -1) {
      this.history.splice(index, 1);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  clearHistory(): void {
    this.history = [];
    this.saveToStorage();
  }

  getFavorites(): QueryHistoryItem[] {
    return this.history.filter(i => i.isFavorite);
  }

  getTags(): string[] {
    const tags = new Set<string>();
    this.history.forEach(i => i.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }

  getStats(): HistoryStats {
    return {
      totalQueries: this.history.length,
      successfulQueries: this.history.filter(i => i.status === 'success').length,
      failedQueries: this.history.filter(i => i.status === 'error').length,
      favoriteQueries: this.history.filter(i => i.isFavorite).length,
      averageExecutionTime: this.history.length > 0
        ? this.history.reduce((sum, i) => sum + i.executionTime, 0) / this.history.length
        : 0,
    };
  }
}

export interface HistoryFilter {
  connectionId?: string;
  status?: QueryStatus;
  isFavorite?: boolean;
  searchQuery?: string;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface HistoryStats {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  favoriteQueries: number;
  averageExecutionTime: number;
}

// ============================================
// QUERY RUNNER
// ============================================

export class QueryRunner {
  private historyManager: QueryHistoryManager;
  private runningQueries: Map<string, QueryResult> = new Map();
  private queryCounter = 0;

  constructor(historyManager?: QueryHistoryManager) {
    this.historyManager = historyManager ?? new QueryHistoryManager();
  }

  /**
   * Execute a query
   */
  async execute(
    connection: DatabaseConnection,
    query: string,
    params?: unknown[],
    options?: QueryExecutionOptions
  ): Promise<QueryResult> {
    const queryId = `q_${++this.queryCounter}_${Date.now()}`;
    const startTime = new Date();

    const result: QueryResult = {
      id: queryId,
      query,
      params,
      connectionId: connection.id,
      connectionName: connection.config.name,
      status: 'running',
      rows: [],
      rowCount: 0,
      fields: [],
      executionTime: 0,
      startTime,
    };

    this.runningQueries.set(queryId, result);

    try {
      // Execute the query
      const executionResult = await this.executeQuery(
        connection,
        query,
        params,
        options
      );

      result.status = 'success';
      result.rows = executionResult.rows;
      result.rowCount = executionResult.rowCount;
      result.fields = executionResult.fields;
      result.executionTime = executionResult.executionTime;
      result.endTime = new Date();

      // Apply pagination if needed
      if (options?.pagination) {
        result.pagination = this.calculatePagination(
          executionResult.rows.length,
          options.pagination.page,
          options.pagination.pageSize
        );
      }

      // Add to history
      this.historyManager.add(
        query,
        connection.id,
        connection.config.name,
        result.executionTime,
        result.rowCount,
        'success'
      );

      return result;
    } catch (error) {
      result.status = 'error';
      result.endTime = new Date();
      result.executionTime = result.endTime.getTime() - startTime.getTime();
      result.error = this.parseError(error);

      // Add to history
      this.historyManager.add(
        query,
        connection.id,
        connection.config.name,
        result.executionTime,
        0,
        'error'
      );

      throw error;
    } finally {
      this.runningQueries.delete(queryId);
    }
  }

  private async executeQuery(
    connection: DatabaseConnection,
    query: string,
    params?: unknown[],
    options?: QueryExecutionOptions
  ): Promise<QueryExecutionResult> {
    // Simulate query execution
    // In real implementation, this would use the database connection
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    const upperQuery = query.trim().toUpperCase();

    // Determine query type and execute accordingly
    if (upperQuery.startsWith('SELECT') || upperQuery.startsWith('WITH')) {
      return this.executeSelect(query, params, options);
    } else if (upperQuery.startsWith('INSERT')) {
      return this.executeInsert(query, params);
    } else if (upperQuery.startsWith('UPDATE')) {
      return this.executeUpdate(query, params);
    } else if (upperQuery.startsWith('DELETE')) {
      return this.executeDelete(query, params);
    } else {
      return this.executeGeneric(query, params);
    }
  }

  private async executeSelect(
    query: string,
    _params?: unknown[],
    options?: QueryExecutionOptions
  ): Promise<QueryExecutionResult> {
    // Simulate SELECT query
    const rows: Record<string, unknown>[] = [];
    const numRows = Math.floor(Math.random() * 50) + 1;

    for (let i = 0; i < numRows; i++) {
      rows.push({
        id: i + 1,
        name: `Item ${i + 1}`,
        description: `Description for item ${i + 1}`,
        status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)],
        created_at: new Date(Date.now() - Math.random() * 1000000000),
        updated_at: new Date(),
        value: Math.random() * 1000,
      });
    }

    // Apply pagination
    let paginatedRows = rows;
    if (options?.pagination) {
      const { page, pageSize } = options.pagination;
      const start = (page - 1) * pageSize;
      paginatedRows = rows.slice(start, start + pageSize);
    }

    return {
      rows: paginatedRows,
      rowCount: rows.length,
      fields: [
        { name: 'id', type: 'integer', nullable: false },
        { name: 'name', type: 'varchar', nullable: true },
        { name: 'description', type: 'text', nullable: true },
        { name: 'status', type: 'varchar', nullable: true },
        { name: 'created_at', type: 'timestamp', nullable: true },
        { name: 'updated_at', type: 'timestamp', nullable: true },
        { name: 'value', type: 'decimal', nullable: true },
      ],
      executionTime: Math.random() * 100 + 10,
      connectionId: '',
    };
  }

  private async executeInsert(
    query: string,
    _params?: unknown[]
  ): Promise<QueryExecutionResult> {
    // Simulate INSERT
    return {
      rows: [],
      rowCount: 1,
      fields: [],
      executionTime: Math.random() * 50 + 5,
      connectionId: '',
    };
  }

  private async executeUpdate(
    query: string,
    _params?: unknown[]
  ): Promise<QueryExecutionResult> {
    // Simulate UPDATE
    const affectedRows = Math.floor(Math.random() * 10) + 1;
    return {
      rows: [],
      rowCount: affectedRows,
      fields: [],
      executionTime: Math.random() * 50 + 5,
      connectionId: '',
    };
  }

  private async executeDelete(
    query: string,
    _params?: unknown[]
  ): Promise<QueryExecutionResult> {
    // Simulate DELETE
    const affectedRows = Math.floor(Math.random() * 5) + 1;
    return {
      rows: [],
      rowCount: affectedRows,
      fields: [],
      executionTime: Math.random() * 50 + 5,
      connectionId: '',
    };
  }

  private async executeGeneric(
    query: string,
    _params?: unknown[]
  ): Promise<QueryExecutionResult> {
    // Simulate generic query
    return {
      rows: [],
      rowCount: 0,
      fields: [],
      executionTime: Math.random() * 30 + 5,
      connectionId: '',
    };
  }

  private parseError(error: unknown): QueryError {
    if (error instanceof Error) {
      return {
        message: error.message,
      };
    }
    return {
      message: String(error),
    };
  }

  private calculatePagination(
    totalRows: number,
    page: number,
    pageSize: number
  ): PaginationInfo {
    const totalPages = Math.ceil(totalRows / pageSize);
    return {
      page,
      pageSize,
      totalRows,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    };
  }

  /**
   * Cancel a running query
   */
  async cancel(queryId: string): Promise<boolean> {
    const query = this.runningQueries.get(queryId);
    if (query && query.status === 'running') {
      query.status = 'cancelled';
      query.endTime = new Date();
      this.runningQueries.delete(queryId);
      return true;
    }
    return false;
  }

  /**
   * Get running queries
   */
  getRunningQueries(): QueryResult[] {
    return Array.from(this.runningQueries.values());
  }

  /**
   * Execute with pagination
   */
  async executePaginated(
    connection: DatabaseConnection,
    query: string,
    page: number = 1,
    pageSize: number = 100,
    params?: unknown[]
  ): Promise<QueryResult> {
    return this.execute(connection, query, params, {
      pagination: { page, pageSize },
    });
  }

  /**
   * Explain a query
   */
  async explain(
    connection: DatabaseConnection,
    query: string,
    analyze: boolean = false
  ): Promise<ExplainResult> {
    // Simulate EXPLAIN
    await new Promise(resolve => setTimeout(resolve, 100));

    const plan: ExplainPlanRow[] = [
      {
        id: 1,
        operation: 'Seq Scan',
        relation: 'users',
        cost: 0.00,
        rows: 1000,
        width: 128,
        actualTime: analyze ? 0.015 : undefined,
        actualRows: analyze ? 1000 : undefined,
        actualLoops: analyze ? 1 : undefined,
        children: [],
      },
    ];

    return {
      query,
      plan,
      totalCost: 15.25,
      totalRows: 1000,
      executionTime: analyze ? 15.5 : undefined,
      buffers: analyze ? {
        sharedRead: 12,
        sharedHit: 88,
        sharedDirtied: 0,
        sharedWritten: 0,
        tempRead: 0,
        tempWritten: 0,
      } : undefined,
    };
  }

  /**
   * Parse parameterized query
   */
  parseParameterizedQuery(query: string, params: QueryParameter[]): ParameterizedQuery {
    let index = 0;
    let result = query;

    // Replace named parameters (:name or @name)
    for (const param of params) {
      const namedPattern1 = new RegExp(`:${param.name}\\b`, 'g');
      const namedPattern2 = new RegExp(`@${param.name}\\b`, 'g');
      
      result = result.replace(namedPattern1, this.formatParamValue(param));
      result = result.replace(namedPattern2, this.formatParamValue(param));
    }

    // Replace positional parameters (? or $1, $2, etc.)
    const positionalPattern = /\?|\$(\d+)/g;
    result = result.replace(positionalPattern, (match, num) => {
      const paramIndex = num ? parseInt(num, 10) - 1 : index;
      index++;
      
      if (paramIndex < params.length) {
        return this.formatParamValue(params[paramIndex]);
      }
      return match;
    });

    return { query: result, params };
  }

  private formatParamValue(param: QueryParameter): string {
    if (param.value === null || param.value === undefined) {
      return 'NULL';
    }

    switch (param.type) {
      case 'string':
        return `'${String(param.value).replace(/'/g, "''")}'`;
      case 'number':
      case 'integer':
        return String(param.value);
      case 'boolean':
        return param.value ? 'TRUE' : 'FALSE';
      case 'date':
      case 'datetime':
        return `'${(param.value as Date).toISOString()}'`;
      case 'json':
        return `'${JSON.stringify(param.value).replace(/'/g, "''")}'`;
      case 'binary':
        return `'${String(param.value)}'`;
      default:
        return `'${String(param.value).replace(/'/g, "''")}'`;
    }
  }

  /**
   * Get history manager
   */
  getHistory(): QueryHistoryManager {
    return this.historyManager;
  }
}

export interface QueryExecutionOptions {
  pagination?: {
    page: number;
    pageSize: number;
  };
  timeout?: number;
  maxRows?: number;
}

// ============================================
// RESULT EXPORTER
// ============================================

export class ResultExporter {
  /**
   * Export query results to the specified format
   */
  export(rows: Record<string, unknown>[], fields: QueryField[], options: ExportOptions): string {
    switch (options.format) {
      case 'csv':
        return this.exportCSV(rows, fields, options);
      case 'json':
        return this.exportJSON(rows, options);
      case 'excel':
        return this.exportExcel(rows, fields, options);
      case 'sql':
        return this.exportSQL(rows, fields, options);
      case 'xml':
        return this.exportXML(rows, fields, options);
      case 'markdown':
        return this.exportMarkdown(rows, fields, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private exportCSV(
    rows: Record<string, unknown>[],
    fields: QueryField[],
    options: ExportOptions
  ): string {
    const delimiter = options.delimiter ?? ',';
    const lines: string[] = [];

    // Headers
    if (options.includeHeaders) {
      lines.push(fields.map(f => this.escapeCSV(f.name, delimiter)).join(delimiter));
    }

    // Data rows
    for (const row of rows) {
      const values = fields.map(f => {
        const value = row[f.name];
        return this.formatValue(value, options, delimiter);
      });
      lines.push(values.join(delimiter));
    }

    return lines.join('\n');
  }

  private escapeCSV(value: string, delimiter: string): string {
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private formatValue(
    value: unknown,
    options: ExportOptions,
    delimiter: string
  ): string {
    if (value === null || value === undefined) {
      return options.nullValue;
    }

    if (value instanceof Date) {
      return this.formatDate(value, options.dateFormat);
    }

    if (typeof value === 'object') {
      return this.escapeCSV(JSON.stringify(value), delimiter);
    }

    return this.escapeCSV(String(value), delimiter);
  }

  private formatDate(date: Date, format: string): string {
    // Simple date formatting
    return format
      .replace('YYYY', date.getFullYear().toString())
      .replace('MM', (date.getMonth() + 1).toString().padStart(2, '0'))
      .replace('DD', date.getDate().toString().padStart(2, '0'))
      .replace('HH', date.getHours().toString().padStart(2, '0'))
      .replace('mm', date.getMinutes().toString().padStart(2, '0'))
      .replace('ss', date.getSeconds().toString().padStart(2, '0'));
  }

  private exportJSON(
    rows: Record<string, unknown>[],
    options: ExportOptions
  ): string {
    if (options.nullValue === 'null') {
      return JSON.stringify(rows, null, 2);
    }

    // Replace nulls with the specified null value representation
    const processed = rows.map(row => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        result[key] = value === null || value === undefined ? options.nullValue : value;
      }
      return result;
    });

    return JSON.stringify(processed, null, 2);
  }

  private exportExcel(
    rows: Record<string, unknown>[],
    fields: QueryField[],
    _options: ExportOptions
  ): string {
    // Generate a simple TSV format that Excel can open
    // In real implementation, would use a library like xlsx
    const lines: string[] = [];

    // Headers
    lines.push(fields.map(f => f.name).join('\t'));

    // Data
    for (const row of rows) {
      const values = fields.map(f => {
        const value = row[f.name];
        if (value === null || value === undefined) {
          return '';
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
      });
      lines.push(values.join('\t'));
    }

    return lines.join('\n');
  }

  private exportSQL(
    rows: Record<string, unknown>[],
    fields: QueryField[],
    options: ExportOptions
  ): string {
    const tableName = 'export_table';
    const statements: string[] = [];

    // INSERT statements
    for (const row of rows) {
      const columns = fields.map(f => f.name);
      const values = fields.map(f => {
        const value = row[f.name];
        return this.formatSQLValue(value, options);
      });

      statements.push(
        `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`
      );
    }

    return statements.join('\n');
  }

  private formatSQLValue(value: unknown, _options: ExportOptions): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }

    if (typeof value === 'object') {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }

    return `'${String(value).replace(/'/g, "''")}'`;
  }

  private exportXML(
    rows: Record<string, unknown>[],
    fields: QueryField[],
    _options: ExportOptions
  ): string {
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<results>'];

    for (const row of rows) {
      lines.push('  <row>');
      for (const field of fields) {
        const value = row[field.name];
        const formattedValue = value === null || value === undefined
          ? ''
          : this.escapeXML(String(value));
        lines.push(`    <${field.name}>${formattedValue}</${field.name}>`);
      }
      lines.push('  </row>');
    }

    lines.push('</results>');
    return lines.join('\n');
  }

  private escapeXML(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private exportMarkdown(
    rows: Record<string, unknown>[],
    fields: QueryField[],
    options: ExportOptions
  ): string {
    const lines: string[] = [];

    // Header row
    lines.push('| ' + fields.map(f => f.name).join(' | ') + ' |');
    lines.push('| ' + fields.map(() => '---').join(' | ') + ' |');

    // Data rows
    for (const row of rows) {
      const values = fields.map(f => {
        const value = row[f.name];
        if (value === null || value === undefined) {
          return options.nullValue;
        }
        if (value instanceof Date) {
          return this.formatDate(value, options.dateFormat);
        }
        if (typeof value === 'object') {
          return '```json\n' + JSON.stringify(value) + '\n```';
        }
        return String(value).replace(/\n/g, '<br/>');
      });
      lines.push('| ' + values.join(' | ') + ' |');
    }

    return lines.join('\n');
  }

  /**
   * Export to a downloadable file
   */
  exportToFile(
    rows: Record<string, unknown>[],
    fields: QueryField[],
    options: ExportOptions,
    filename: string
  ): void {
    const content = this.export(rows, fields, options);
    const mimeType = this.getMimeType(options.format);
    
    // In browser environment
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  private getMimeType(format: ExportFormat): string {
    const mimeTypes: Record<ExportFormat, string> = {
      csv: 'text/csv',
      json: 'application/json',
      excel: 'application/vnd.ms-excel',
      sql: 'application/sql',
      xml: 'application/xml',
      markdown: 'text/markdown',
    };
    return mimeTypes[format];
  }
}

// ============================================
// SQL AUTOCOMPLETE
// ============================================

export class SQLAutocomplete {
  private keywords: string[] = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'CREATE', 'TABLE', 'INDEX', 'VIEW', 'DROP', 'ALTER',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS',
    'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
    'UNION', 'INTERSECT', 'EXCEPT', 'ALL', 'DISTINCT',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'NULL', 'IS', 'LIKE', 'BETWEEN', 'TRUE', 'FALSE',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE',
    'CONSTRAINT', 'DEFAULT', 'CHECK', 'CASCADE',
    'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION',
    'GRANT', 'REVOKE', 'PRIVILEGES',
  ];

  private functions: { name: string; description: string }[] = [
    { name: 'COUNT', description: 'Count rows' },
    { name: 'SUM', description: 'Sum values' },
    { name: 'AVG', description: 'Average values' },
    { name: 'MIN', description: 'Minimum value' },
    { name: 'MAX', description: 'Maximum value' },
    { name: 'COALESCE', description: 'Return first non-null value' },
    { name: 'NULLIF', description: 'Return NULL if values are equal' },
    { name: 'CAST', description: 'Cast to a type' },
    { name: 'CONCAT', description: 'Concatenate strings' },
    { name: 'SUBSTRING', description: 'Extract substring' },
    { name: 'LENGTH', description: 'String length' },
    { name: 'UPPER', description: 'Convert to uppercase' },
    { name: 'LOWER', description: 'Convert to lowercase' },
    { name: 'TRIM', description: 'Remove whitespace' },
    { name: 'DATE', description: 'Date functions' },
    { name: 'NOW', description: 'Current timestamp' },
  ];

  private operators: string[] = [
    '=', '<>', '!=', '<', '>', '<=', '>=',
    '+', '-', '*', '/', '%',
    '||', // string concatenation
  ];

  constructor() {}

  /**
   * Get autocomplete suggestions
   */
  getSuggestions(
    prefix: string,
    context: AutocompleteContext
  ): AutocompleteSuggestion[] {
    const suggestions: AutocompleteSuggestion[] = [];
    const upperPrefix = prefix.toUpperCase();

    // Keywords
    for (const keyword of this.keywords) {
      if (keyword.startsWith(upperPrefix)) {
        suggestions.push({
          type: 'keyword',
          value: keyword,
          priority: 1,
        });
      }
    }

    // Functions
    for (const func of this.functions) {
      if (func.name.startsWith(upperPrefix)) {
        suggestions.push({
          type: 'function',
          value: func.name,
          displayText: `${func.name}()`,
          documentation: func.description,
          priority: 2,
        });
      }
    }

    // Operators
    for (const op of this.operateurs) {
      if (op.startsWith(prefix)) {
        suggestions.push({
          type: 'operator',
          value: op,
          priority: 3,
        });
      }
    }

    // Tables from context
    if (context.tables) {
      for (const table of context.tables) {
        if (table.name.toUpperCase().startsWith(upperPrefix)) {
          suggestions.push({
            type: 'table',
            value: table.name,
            documentation: table.description,
            priority: 4,
          });
        }
      }
    }

    // Columns from context
    if (context.columns) {
      for (const column of context.columns) {
        if (column.name.toUpperCase().startsWith(upperPrefix)) {
          suggestions.push({
            type: 'column',
            value: column.name,
            displayText: `${column.name} (${column.type})`,
            documentation: `${column.tableName ? column.tableName + '.' : ''}${column.name}`,
            priority: 5,
          });
        }
      }
    }

    // Sort by priority, then alphabetically
    return suggestions.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.value.localeCompare(b.value);
    });
  }

  // Fix typo in the class
  private operateurs = this.operators;
}

export interface AutocompleteContext {
  tables?: { name: string; description?: string }[];
  columns?: { name: string; type: string; tableName?: string }[];
  database?: string;
  connectionType?: DatabaseType;
}

// ============================================
// QUERY VALIDATOR
// ============================================

export class QueryValidator {
  /**
   * Validate a SQL query for syntax errors
   */
  validate(query: string, _connectionType: DatabaseType): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic syntax checks
    const trimmed = query.trim();
    
    if (!trimmed) {
      errors.push({
        message: 'Query is empty',
        severity: 'error',
      });
      return { valid: false, errors, warnings };
    }

    // Check for balanced parentheses
    let parenCount = 0;
    for (let i = 0; i < query.length; i++) {
      if (query[i] === '(') parenCount++;
      if (query[i] === ')') parenCount--;
      
      if (parenCount < 0) {
        errors.push({
          message: 'Unbalanced parentheses: extra closing parenthesis',
          position: i,
          severity: 'error',
        });
      }
    }
    
    if (parenCount > 0) {
      errors.push({
        message: `Unbalanced parentheses: ${parenCount} unclosed parenthesis`,
        severity: 'error',
      });
    }

    // Check for balanced quotes
    const quoteTypes = ["'", '"'];
    for (const quote of quoteTypes) {
      let inQuote = false;
      for (let i = 0; i < query.length; i++) {
        if (query[i] === quote && (i === 0 || query[i - 1] !== '\\')) {
          inQuote = !inQuote;
        }
      }
      if (inQuote) {
        warnings.push({
          message: `Unclosed ${quote} quote detected`,
          severity: 'warning',
        });
      }
    }

    // Check for common issues
    const upperQuery = trimmed.toUpperCase();
    
    // Check for SELECT *
    if (upperQuery.includes('SELECT *')) {
      warnings.push({
        message: 'SELECT * may return more columns than expected',
        severity: 'info',
      });
    }

    // Check for missing WHERE in DELETE/UPDATE
    if ((upperQuery.startsWith('DELETE') || upperQuery.startsWith('UPDATE')) 
        && !upperQuery.includes('WHERE')) {
      warnings.push({
        message: 'DELETE/UPDATE without WHERE clause affects all rows',
        severity: 'warning',
      });
    }

    // Check for common keywords
    const hasValidStart = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|WITH|BEGIN|COMMIT|ROLLBACK|GRANT|REVOKE)/i.test(trimmed);
    if (!hasValidStart) {
      errors.push({
        message: 'Query does not start with a valid SQL statement',
        severity: 'error',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if query is read-only
   */
  isReadOnly(query: string): boolean {
    const upperQuery = query.trim().toUpperCase();
    return upperQuery.startsWith('SELECT') || upperQuery.startsWith('WITH') || upperQuery.startsWith('SHOW') || upperQuery.startsWith('EXPLAIN');
  }

  /**
   * Extract table names from query
   */
  extractTables(query: string): string[] {
    const tables: string[] = [];
    const upperQuery = query.toUpperCase();

    // FROM clause
    const fromMatch = upperQuery.match(/FROM\s+(\w+)/gi);
    if (fromMatch) {
      fromMatch.forEach(m => {
        const table = m.replace(/FROM\s+/i, '').trim();
        if (table) tables.push(table.toLowerCase());
      });
    }

    // JOIN clauses
    const joinMatch = upperQuery.match(/JOIN\s+(\w+)/gi);
    if (joinMatch) {
      joinMatch.forEach(m => {
        const table = m.replace(/JOIN\s+/i, '').trim();
        if (table) tables.push(table.toLowerCase());
      });
    }

    // INTO clause (INSERT)
    const intoMatch = upperQuery.match(/INTO\s+(\w+)/i);
    if (intoMatch) {
      tables.push(intoMatch[1].toLowerCase());
    }

    // UPDATE clause
    const updateMatch = upperQuery.match(/UPDATE\s+(\w+)/i);
    if (updateMatch) {
      tables.push(updateMatch[1].toLowerCase());
    }

    return [...new Set(tables)];
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  message: string;
  position?: number;
  line?: number;
  column?: number;
  severity: 'error';
}

export interface ValidationWarning {
  message: string;
  position?: number;
  severity: 'warning' | 'info';
}

// ============================================
// SINGLETON EXPORTS
// ============================================

let queryRunnerInstance: QueryRunner | null = null;
let queryHistoryInstance: QueryHistoryManager | null = null;
let resultExporterInstance: ResultExporter | null = null;
let sqlAutocompleteInstance: SQLAutocomplete | null = null;
let queryValidatorInstance: QueryValidator | null = null;

export function getQueryRunner(): QueryRunner {
  if (!queryRunnerInstance) {
    queryRunnerInstance = new QueryRunner();
  }
  return queryRunnerInstance;
}

export function getQueryHistory(): QueryHistoryManager {
  if (!queryHistoryInstance) {
    queryHistoryInstance = new QueryHistoryManager();
  }
  return queryHistoryInstance;
}

export function getResultExporter(): ResultExporter {
  if (!resultExporterInstance) {
    resultExporterInstance = new ResultExporter();
  }
  return resultExporterInstance;
}

export function getSQLAutocomplete(): SQLAutocomplete {
  if (!sqlAutocompleteInstance) {
    sqlAutocompleteInstance = new SQLAutocomplete();
  }
  return sqlAutocompleteInstance;
}

export function getQueryValidator(): QueryValidator {
  if (!queryValidatorInstance) {
    queryValidatorInstance = new QueryValidator();
  }
  return queryValidatorInstance;
}
