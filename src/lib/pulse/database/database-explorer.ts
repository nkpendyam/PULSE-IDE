/**
 * Kyro IDE - Database Explorer
 * Database connection manager with support for PostgreSQL, MySQL, SQLite, MongoDB
 */

// ============================================
// INTERFACES
// ============================================

export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionConfig {
  id: string;
  name: string;
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  connectionString?: string;
  ssl?: boolean;
  sslConfig?: SSLConfig;
  poolConfig?: PoolConfig;
  options?: Record<string, unknown>;
  timeout?: number;
  color?: string;
  isFavorite?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SSLConfig {
  rejectUnauthorized?: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

export interface PoolConfig {
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  acquireTimeoutMillis?: number;
}

export interface DatabaseConnection {
  id: string;
  config: ConnectionConfig;
  status: ConnectionStatus;
  connectedAt?: Date;
  lastActivity?: Date;
  error?: string;
  serverVersion?: string;
  metadata?: ConnectionMetadata;
}

export interface ConnectionMetadata {
  type: DatabaseType;
  version: string;
  serverInfo?: string;
  capabilities?: string[];
  charset?: string;
  timezone?: string;
}

export interface ParsedConnectionString {
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  options?: Record<string, string>;
}

export interface QueryOptions {
  timeout?: number;
  fetchSize?: number;
  autoCommit?: boolean;
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
}

export type IsolationLevel = 
  | 'READ UNCOMMITTED'
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

export interface TransactionOptions extends QueryOptions {
  savepointName?: string;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingCount: number;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageQueryTime: number;
}

// ============================================
// CONNECTION STRING PARSER
// ============================================

export class ConnectionStringParser {
  /**
   * Parse a connection string into its components
   */
  static parse(connectionString: string): ParsedConnectionString {
    // Detect database type
    let type: DatabaseType;
    let remaining: string;

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      type = 'postgresql';
      remaining = connectionString.replace(/^(postgresql|postgres):\/\//, '');
    } else if (connectionString.startsWith('mysql://')) {
      type = 'mysql';
      remaining = connectionString.replace(/^mysql:\/\//, '');
    } else if (connectionString.startsWith('mongodb://') || connectionString.startsWith('mongodb+srv://')) {
      type = 'mongodb';
      return this.parseMongoDB(connectionString);
    } else if (connectionString.startsWith('sqlite://') || connectionString.includes('.db') || connectionString.includes('.sqlite')) {
      type = 'sqlite';
      return {
        type: 'sqlite',
        database: connectionString.replace(/^sqlite:\/\//, ''),
      };
    } else {
      throw new Error('Unsupported database connection string format');
    }

    // Parse standard format: [user[:password]@][host][:port][/database][?options]
    const result: ParsedConnectionString = { type, database: '' };
    
    // Split options
    const [mainPart, optionsPart] = remaining.split('?');
    
    // Parse options
    if (optionsPart) {
      result.options = {};
      const params = new URLSearchParams(optionsPart);
      params.forEach((value, key) => {
        result.options![key] = value;
        if (key === 'ssl' || key === 'sslmode') {
          result.ssl = value === 'true' || value === 'require';
        }
      });
    }

    // Parse credentials and host
    const atIndex = mainPart.lastIndexOf('@');
    let hostPortDb: string;
    
    if (atIndex !== -1) {
      const credentials = mainPart.substring(0, atIndex);
      hostPortDb = mainPart.substring(atIndex + 1);
      
      const colonIndex = credentials.indexOf(':');
      if (colonIndex !== -1) {
        result.username = decodeURIComponent(credentials.substring(0, colonIndex));
        result.password = decodeURIComponent(credentials.substring(colonIndex + 1));
      } else {
        result.username = decodeURIComponent(credentials);
      }
    } else {
      hostPortDb = mainPart;
    }

    // Parse host, port, database
    const slashIndex = hostPortDb.indexOf('/');
    if (slashIndex !== -1) {
      const hostPort = hostPortDb.substring(0, slashIndex);
      result.database = decodeURIComponent(hostPortDb.substring(slashIndex + 1));
      
      const portIndex = hostPort.lastIndexOf(':');
      if (portIndex !== -1 && !hostPort.startsWith('[')) {
        result.host = hostPort.substring(0, portIndex);
        result.port = parseInt(hostPort.substring(portIndex + 1), 10);
      } else {
        result.host = hostPort;
      }
    } else {
      result.host = hostPortDb;
    }

    // Set default ports
    if (!result.port) {
      result.port = this.getDefaultPort(type);
    }

    return result;
  }

  private static parseMongoDB(connectionString: string): ParsedConnectionString {
    const result: ParsedConnectionString = { type: 'mongodb', database: '' };
    
    // Handle mongodb+srv://
    const isSrv = connectionString.startsWith('mongodb+srv://');
    const prefix = isSrv ? 'mongodb+srv://' : 'mongodb://';
    const remaining = connectionString.replace(prefix, '');

    // Split options
    const [mainPart, optionsPart] = remaining.split('?');
    
    // Parse options
    if (optionsPart) {
      result.options = {};
      const params = new URLSearchParams(optionsPart);
      params.forEach((value, key) => {
        result.options![key] = value;
        if (key === 'ssl' || key === 'tls') {
          result.ssl = value === 'true';
        }
      });
    }

    // Parse credentials and hosts
    const atIndex = mainPart.lastIndexOf('@');
    let hostsDb: string;
    
    if (atIndex !== -1) {
      const credentials = mainPart.substring(0, atIndex);
      hostsDb = mainPart.substring(atIndex + 1);
      
      const colonIndex = credentials.indexOf(':');
      if (colonIndex !== -1) {
        result.username = decodeURIComponent(credentials.substring(0, colonIndex));
        result.password = decodeURIComponent(credentials.substring(colonIndex + 1));
      } else {
        result.username = decodeURIComponent(credentials);
      }
    } else {
      hostsDb = mainPart;
    }

    // Parse hosts and database
    const slashIndex = hostsDb.indexOf('/');
    if (slashIndex !== -1) {
      result.host = hostsDb.substring(0, slashIndex);
      result.database = hostsDb.substring(slashIndex + 1);
    } else {
      result.host = hostsDb;
    }

    // Set default port
    result.port = isSrv ? undefined : 27017;

    return result;
  }

  static getDefaultPort(type: DatabaseType): number {
    const ports: Record<DatabaseType, number> = {
      postgresql: 5432,
      mysql: 3306,
      sqlite: 0,
      mongodb: 27017,
    };
    return ports[type];
  }

  /**
   * Build a connection string from config
   */
  static build(config: ConnectionConfig): string {
    switch (config.type) {
      case 'postgresql':
        return this.buildPostgreSQL(config);
      case 'mysql':
        return this.buildMySQL(config);
      case 'mongodb':
        return this.buildMongoDB(config);
      case 'sqlite':
        return `sqlite://${config.database}`;
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  private static buildPostgreSQL(config: ConnectionConfig): string {
    const parts: string[] = ['postgresql://'];
    
    if (config.username) {
      parts.push(encodeURIComponent(config.username));
      if (config.password) {
        parts.push(':', encodeURIComponent(config.password));
      }
      parts.push('@');
    }
    
    parts.push(config.host || 'localhost');
    
    if (config.port) {
      parts.push(`:${config.port}`);
    }
    
    parts.push('/', encodeURIComponent(config.database));
    
    const params = new URLSearchParams();
    if (config.ssl) {
      params.set('sslmode', 'require');
    }
    if (config.options) {
      Object.entries(config.options).forEach(([key, value]) => {
        params.set(key, String(value));
      });
    }
    
    const queryString = params.toString();
    if (queryString) {
      parts.push('?', queryString);
    }
    
    return parts.join('');
  }

  private static buildMySQL(config: ConnectionConfig): string {
    const parts: string[] = ['mysql://'];
    
    if (config.username) {
      parts.push(encodeURIComponent(config.username));
      if (config.password) {
        parts.push(':', encodeURIComponent(config.password));
      }
      parts.push('@');
    }
    
    parts.push(config.host || 'localhost');
    
    if (config.port) {
      parts.push(`:${config.port}`);
    }
    
    parts.push('/', encodeURIComponent(config.database));
    
    const params = new URLSearchParams();
    if (config.ssl) {
      params.set('ssl', 'true');
    }
    if (config.options) {
      Object.entries(config.options).forEach(([key, value]) => {
        params.set(key, String(value));
      });
    }
    
    const queryString = params.toString();
    if (queryString) {
      parts.push('?', queryString);
    }
    
    return parts.join('');
  }

  private static buildMongoDB(config: ConnectionConfig): string {
    const parts: string[] = ['mongodb://'];
    
    if (config.username) {
      parts.push(encodeURIComponent(config.username));
      if (config.password) {
        parts.push(':', encodeURIComponent(config.password));
      }
      parts.push('@');
    }
    
    parts.push(config.host || 'localhost');
    
    if (config.port) {
      parts.push(`:${config.port}`);
    }
    
    parts.push('/', encodeURIComponent(config.database));
    
    const params = new URLSearchParams();
    if (config.ssl) {
      params.set('ssl', 'true');
    }
    if (config.options) {
      Object.entries(config.options).forEach(([key, value]) => {
        params.set(key, String(value));
      });
    }
    
    const queryString = params.toString();
    if (queryString) {
      parts.push('?', queryString);
    }
    
    return parts.join('');
  }
}

// ============================================
// CONNECTION POOL
// ============================================

interface PoolConnection {
  id: string;
  inUse: boolean;
  lastUsed: number;
  connection: MockConnection;
}

interface MockConnection {
  id: string;
  config: ConnectionConfig;
}

/**
 * Simple connection pool implementation
 */
export class ConnectionPool {
  private connections: Map<string, PoolConnection> = new Map();
  private config: PoolConfig;
  private waitQueue: Array<{
    resolve: (conn: PoolConnection) => void;
    reject: (error: Error) => void;
  }> = [];
  private acquireCount = 0;
  private releaseCount = 0;

  constructor(config: PoolConfig = {}) {
    this.config = {
      min: config.min ?? 2,
      max: config.max ?? 10,
      idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
      acquireTimeoutMillis: config.acquireTimeoutMillis ?? 60000,
    };
  }

  async initialize(connConfig: ConnectionConfig): Promise<void> {
    // Create minimum connections
    for (let i = 0; i < this.config.min!; i++) {
      const conn = await this.createConnection(connConfig);
      this.connections.set(conn.id, conn);
    }
  }

  private async createConnection(config: ConnectionConfig): Promise<PoolConnection> {
    const id = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      id,
      inUse: false,
      lastUsed: Date.now(),
      connection: { id, config },
    };
  }

  async acquire(config: ConnectionConfig): Promise<PoolConnection> {
    // Find available connection
    for (const conn of this.connections.values()) {
      if (!conn.inUse) {
        conn.inUse = true;
        conn.lastUsed = Date.now();
        this.acquireCount++;
        return conn;
      }
    }

    // Create new if under max
    if (this.connections.size < this.config.max!) {
      const conn = await this.createConnection(config);
      conn.inUse = true;
      this.connections.set(conn.id, conn);
      this.acquireCount++;
      return conn;
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex(w => w.resolve === resolve);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
          reject(new Error('Connection acquire timeout'));
        }
      }, this.config.acquireTimeoutMillis);

      this.waitQueue.push({
        resolve: (conn) => {
          clearTimeout(timeout);
          resolve(conn);
        },
        reject,
      });
    });
  }

  release(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.inUse = false;
      conn.lastUsed = Date.now();
      this.releaseCount++;

      // Process wait queue
      if (this.waitQueue.length > 0) {
        const waiter = this.waitQueue.shift();
        if (waiter) {
          conn.inUse = true;
          waiter.resolve(conn);
        }
      }
    }
  }

  async destroy(connectionId: string): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (conn && !conn.inUse) {
      this.connections.delete(connectionId);
    }
  }

  async drain(): Promise<void> {
    for (const conn of this.connections.values()) {
      if (!conn.inUse) {
        this.connections.delete(conn.id);
      }
    }
  }

  async close(): Promise<void> {
    this.connections.clear();
    this.waitQueue.forEach(w => w.reject(new Error('Pool closed')));
    this.waitQueue = [];
  }

  getStats() {
    let idle = 0;
    let active = 0;
    
    for (const conn of this.connections.values()) {
      if (conn.inUse) {
        active++;
      } else {
        idle++;
      }
    }

    return {
      total: this.connections.size,
      idle,
      active,
      waiting: this.waitQueue.length,
      acquireCount: this.acquireCount,
      releaseCount: this.releaseCount,
    };
  }
}

// ============================================
// DATABASE EXPLORER
// ============================================

export class DatabaseExplorer {
  private connections: Map<string, DatabaseConnection> = new Map();
  private pools: Map<string, ConnectionPool> = new Map();
  private queryCount = 0;
  private successCount = 0;
  private failedCount = 0;
  private totalQueryTime = 0;

  constructor() {}

  /**
   * Create a new connection configuration
   */
  createConnectionConfig(
    name: string,
    type: DatabaseType,
    options: Partial<Omit<ConnectionConfig, 'id' | 'name' | 'type' | 'createdAt' | 'updatedAt'>>
  ): ConnectionConfig {
    const id = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    
    return {
      id,
      name,
      type,
      database: options.database || '',
      host: options.host,
      port: options.port ?? ConnectionStringParser.getDefaultPort(type),
      username: options.username,
      password: options.password,
      connectionString: options.connectionString,
      ssl: options.ssl ?? false,
      sslConfig: options.sslConfig,
      poolConfig: options.poolConfig,
      options: options.options,
      timeout: options.timeout ?? 30000,
      color: options.color,
      isFavorite: options.isFavorite ?? false,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Parse and create config from connection string
   */
  parseConnectionString(name: string, connectionString: string): ConnectionConfig {
    const parsed = ConnectionStringParser.parse(connectionString);
    
    return this.createConnectionConfig(name, parsed.type, {
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      username: parsed.username,
      password: parsed.password,
      ssl: parsed.ssl,
      options: parsed.options as Record<string, unknown>,
      connectionString,
    });
  }

  /**
   * Connect to a database
   */
  async connect(config: ConnectionConfig): Promise<DatabaseConnection> {
    const connection: DatabaseConnection = {
      id: config.id,
      config,
      status: 'connecting',
    };

    this.connections.set(config.id, connection);

    try {
      // Create connection pool
      const pool = new ConnectionPool(config.poolConfig);
      await pool.initialize(config);
      this.pools.set(config.id, pool);

      // Simulate connection (in real implementation, this would actually connect)
      await this.simulateConnect(config);

      connection.status = 'connected';
      connection.connectedAt = new Date();
      connection.lastActivity = new Date();
      connection.serverVersion = await this.getServerVersion(config);
      connection.metadata = {
        type: config.type,
        version: connection.serverVersion,
        capabilities: this.getCapabilities(config.type),
      };

      return connection;
    } catch (error) {
      connection.status = 'error';
      connection.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private async simulateConnect(config: ConnectionConfig): Promise<void> {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Validate configuration
    if (config.type !== 'sqlite' && !config.host && !config.connectionString) {
      throw new Error('Host is required for non-SQLite databases');
    }
    
    if (!config.database) {
      throw new Error('Database name is required');
    }
  }

  private async getServerVersion(config: ConnectionConfig): Promise<string> {
    // In real implementation, query the server for version
    const versions: Record<DatabaseType, string> = {
      postgresql: '15.4',
      mysql: '8.0.34',
      sqlite: '3.42.0',
      mongodb: '7.0.2',
    };
    return versions[config.type];
  }

  private getCapabilities(type: DatabaseType): string[] {
    const capabilities: Record<DatabaseType, string[]> = {
      postgresql: [
        'transactions',
        'savepoints',
        'prepared-statements',
        'json',
        'arrays',
        'full-text-search',
        'geospatial',
        'partitioning',
      ],
      mysql: [
        'transactions',
        'savepoints',
        'prepared-statements',
        'json',
        'full-text-search',
        'geospatial',
        'partitioning',
      ],
      sqlite: [
        'transactions',
        'savepoints',
        'prepared-statements',
        'json',
        'full-text-search',
      ],
      mongodb: [
        'transactions',
        'aggregation',
        'geospatial',
        'full-text-search',
        'change-streams',
        'gridfs',
      ],
    };
    return capabilities[type];
  }

  /**
   * Disconnect from a database
   */
  async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const pool = this.pools.get(connectionId);
    if (pool) {
      await pool.close();
      this.pools.delete(connectionId);
    }

    connection.status = 'disconnected';
    this.connections.delete(connectionId);
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): DatabaseConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections
   */
  getAllConnections(): DatabaseConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Test connection
   */
  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message: string; latency: number }> {
    const startTime = Date.now();
    
    try {
      const connection = await this.connect(config);
      await this.disconnect(connection.id);
      
      return {
        success: true,
        message: 'Connection successful',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a query
   */
  async executeQuery(
    connectionId: string,
    query: string,
    params?: unknown[],
    options?: QueryOptions
  ): Promise<QueryExecutionResult> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection not available');
    }

    const pool = this.pools.get(connectionId);
    if (!pool) {
      throw new Error('Connection pool not found');
    }

    const startTime = Date.now();
    let poolConn: PoolConnection | undefined;

    try {
      poolConn = await pool.acquire(connection.config);
      
      // Execute query (simulated)
      const result = await this.simulateQuery(connection.config, query, params, options);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      this.queryCount++;
      this.successCount++;
      this.totalQueryTime += executionTime;
      
      connection.lastActivity = new Date();

      return {
        ...result,
        executionTime,
        connectionId,
      };
    } catch (error) {
      this.queryCount++;
      this.failedCount++;
      
      throw error;
    } finally {
      if (poolConn) {
        pool.release(poolConn.id);
      }
    }
  }

  private async simulateQuery(
    config: ConnectionConfig,
    query: string,
    params?: unknown[],
    _options?: QueryOptions
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number; fields: QueryField[] }> {
    // Simulate query execution delay
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 50));

    // In a real implementation, this would execute the actual query
    // For now, return simulated results based on query type
    const upperQuery = query.trim().toUpperCase();
    
    if (upperQuery.startsWith('SELECT')) {
      return {
        rows: [
          { id: 1, name: 'Sample Data 1', created_at: new Date() },
          { id: 2, name: 'Sample Data 2', created_at: new Date() },
        ],
        rowCount: 2,
        fields: [
          { name: 'id', type: 'integer', nullable: false },
          { name: 'name', type: 'varchar', nullable: true },
          { name: 'created_at', type: 'timestamp', nullable: true },
        ],
      };
    }
    
    if (upperQuery.startsWith('INSERT') || upperQuery.startsWith('UPDATE') || upperQuery.startsWith('DELETE')) {
      return {
        rows: [],
        rowCount: 1,
        fields: [],
      };
    }

    return {
      rows: [],
      rowCount: 0,
      fields: [],
    };
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(connectionId: string, options?: TransactionOptions): Promise<Transaction> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('Connection not available');
    }

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    return {
      id: transactionId,
      connectionId,
      isActive: true,
      savepoints: [],
      options,
      execute: async (query: string, params?: unknown[]) => {
        return this.executeQuery(connectionId, query, params, { ...options, autoCommit: false });
      },
      commit: async () => {
        // Execute COMMIT
        await this.executeQuery(connectionId, 'COMMIT');
        transaction.isActive = false;
      },
      rollback: async () => {
        // Execute ROLLBACK
        await this.executeQuery(connectionId, 'ROLLBACK');
        transaction.isActive = false;
      },
      createSavepoint: async (name: string) => {
        await this.executeQuery(connectionId, `SAVEPOINT ${name}`);
        transaction.savepoints.push(name);
        return name;
      },
      rollbackToSavepoint: async (name: string) => {
        await this.executeQuery(connectionId, `ROLLBACK TO SAVEPOINT ${name}`);
        transaction.savepoints = transaction.savepoints.filter(s => s !== name);
      },
      releaseSavepoint: async (name: string) => {
        await this.executeQuery(connectionId, `RELEASE SAVEPOINT ${name}`);
        transaction.savepoints = transaction.savepoints.filter(s => s !== name);
      },
    };
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    let activeConnections = 0;
    let idleConnections = 0;

    for (const conn of this.connections.values()) {
      if (conn.status === 'connected') {
        activeConnections++;
      }
    }

    // Get pool stats
    let waitingCount = 0;
    for (const pool of this.pools.values()) {
      const stats = pool.getStats();
      idleConnections += stats.idle;
      waitingCount += stats.waiting;
    }

    return {
      totalConnections: this.connections.size,
      activeConnections,
      idleConnections,
      waitingCount,
      totalQueries: this.queryCount,
      successfulQueries: this.successCount,
      failedQueries: this.failedCount,
      averageQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
    };
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(id => 
      this.disconnect(id).catch(() => {})
    );
    await Promise.all(disconnectPromises);
  }
}

// ============================================
// TRANSACTION INTERFACE
// ============================================

export interface Transaction {
  id: string;
  connectionId: string;
  isActive: boolean;
  savepoints: string[];
  options?: TransactionOptions;
  execute(query: string, params?: unknown[]): Promise<QueryExecutionResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  createSavepoint(name: string): Promise<string>;
  rollbackToSavepoint(name: string): Promise<void>;
  releaseSavepoint(name: string): Promise<void>;
}

export interface QueryExecutionResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: QueryField[];
  executionTime: number;
  connectionId: string;
  error?: string;
}

export interface QueryField {
  name: string;
  type: string;
  nullable: boolean;
  table?: string;
  schema?: string;
}

// ============================================
// SINGLETON EXPORT
// ============================================

let databaseExplorerInstance: DatabaseExplorer | null = null;

export function getDatabaseExplorer(): DatabaseExplorer {
  if (!databaseExplorerInstance) {
    databaseExplorerInstance = new DatabaseExplorer();
  }
  return databaseExplorerInstance;
}
