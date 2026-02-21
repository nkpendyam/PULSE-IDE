/**
 * Kyro IDE - Schema Browser
 * Schema exploration with tables, indexes, foreign keys, constraints, stored procedures, and views
 */

import type { DatabaseType, DatabaseConnection } from './database-explorer';

// ============================================
// INTERFACES
// ============================================

export interface TableSchema {
  catalog: string;
  schema: string;
  name: string;
  type: TableType;
  comment?: string;
  rowCount?: number;
  dataSize?: number;
  indexSize?: number;
  createdAt?: Date;
  updatedAt?: Date;
  columns: ColumnInfo[];
  primaryKey?: PrimaryKey;
  foreignKeys: ForeignKey[];
  indexes: IndexInfo[];
  constraints: Constraint[];
  triggers: Trigger[];
  privileges?: TablePrivilege[];
}

export type TableType = 'table' | 'view' | 'materialized_view' | 'foreign_table' | 'temporary_table';

export interface ColumnInfo {
  name: string;
  ordinalPosition: number;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  comment?: string;
  charset?: string;
  collation?: string;
  maxLength?: number;
  precision?: number;
  scale?: number;
  isAutoIncrement: boolean;
  isGenerated: boolean;
  generatedExpression?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  enumValues?: string[];
}

export interface PrimaryKey {
  name: string;
  columns: string[];
}

export interface ForeignKey {
  name: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
  onUpdate: ReferentialAction;
  onDelete: ReferentialAction;
  matchType?: MatchType;
  isDeferrable: boolean;
  initiallyDeferred: boolean;
}

export type ReferentialAction = 
  | 'CASCADE'
  | 'RESTRICT'
  | 'SET NULL'
  | 'SET DEFAULT'
  | 'NO ACTION';

export type MatchType = 'FULL' | 'PARTIAL' | 'SIMPLE';

export interface IndexInfo {
  name: string;
  schema: string;
  tableName: string;
  isUnique: boolean;
  isPrimary: boolean;
  type: IndexType;
  columns: IndexColumn[];
  filter?: string;
  isClustered: boolean;
  size?: number;
  comment?: string;
}

export type IndexType = 
  | 'btree'
  | 'hash'
  | 'gist'
  | 'gin'
  | 'spgist'
  | 'brin'
  | 'fulltext'
  | 'bitmap';

export interface IndexColumn {
  name: string;
  order: 'ASC' | 'DESC';
  nulls: 'FIRST' | 'LAST' | undefined;
  expression?: string;
  collation?: string;
  operatorClass?: string;
}

export interface Constraint {
  name: string;
  schema: string;
  tableName: string;
  type: ConstraintType;
  columns: string[];
  definition?: string;
  checkClause?: string;
  referenceTable?: string;
  referenceColumns?: string[];
  isDeferrable: boolean;
  initiallyDeferred: boolean;
  comment?: string;
}

export type ConstraintType = 
  | 'PRIMARY KEY'
  | 'FOREIGN KEY'
  | 'UNIQUE'
  | 'CHECK'
  | 'EXCLUSION'
  | 'NOT NULL';

export interface Trigger {
  name: string;
  schema: string;
  tableName: string;
  event: TriggerEvent[];
  timing: TriggerTiming;
  level: TriggerLevel;
  statement: string;
  function?: string;
  isEnabled: boolean;
  comment?: string;
}

export type TriggerEvent = 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE';
export type TriggerTiming = 'BEFORE' | 'AFTER' | 'INSTEAD OF';
export type TriggerLevel = 'ROW' | 'STATEMENT';

export interface TablePrivilege {
  grantee: string;
  privileges: string[];
  isGrantable: boolean;
}

export interface ViewDefinition {
  catalog: string;
  schema: string;
  name: string;
  definition: string;
  checkOption?: 'CASCADED' | 'LOCAL' | 'NONE';
  isUpdatable: boolean;
  isInsertable: boolean;
  isDeletable: boolean;
  comment?: string;
  columns: ColumnInfo[];
}

export interface MaterializedView extends ViewDefinition {
  isPopulated: boolean;
  lastRefresh?: Date;
  refreshMethod?: 'COMPLETE' | 'FAST' | 'FORCE';
  buildMode?: 'IMMEDIATE' | 'DEFERRED';
}

export interface StoredProcedure {
  catalog: string;
  schema: string;
  name: string;
  type: RoutineType;
  language: string;
  definition: string;
  parameters: RoutineParameter[];
  returnType?: string;
  returnTypeSchema?: string;
  isDeterministic: boolean;
  securityType: SecurityType;
  comment?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RoutineType = 'FUNCTION' | 'PROCEDURE' | 'TRIGGER' | 'AGGREGATE';
export type SecurityType = 'DEFINER' | 'INVOKER';

export interface RoutineParameter {
  name: string;
  ordinalPosition: number;
  mode: ParameterMode;
  type: string;
  defaultValue?: string;
  comment?: string;
}

export type ParameterMode = 'IN' | 'OUT' | 'INOUT';

export interface SequenceInfo {
  catalog: string;
  schema: string;
  name: string;
  dataType: string;
  startValue: bigint;
  minimumValue: bigint;
  maximumValue: bigint;
  increment: bigint;
  cycleOption: boolean;
  cacheSize?: number;
  currentValue?: bigint;
  ownedBy?: string;
  comment?: string;
}

export interface SchemaInfo {
  catalog: string;
  name: string;
  owner?: string;
  comment?: string;
  tableCount: number;
  viewCount: number;
  procedureCount: number;
  sequenceCount: number;
  totalSize?: number;
}

export interface EnumType {
  schema: string;
  name: string;
  values: string[];
  comment?: string;
}

export interface DomainType {
  schema: string;
  name: string;
  baseType: string;
  nullable: boolean;
  defaultValue?: string;
  checkClause?: string;
  comment?: string;
}

export interface CollationInfo {
  name: string;
  schema: string;
  locale: string;
  provider?: 'libc' | 'icu';
  isDeterministic: boolean;
  comment?: string;
}

// ============================================
// SCHEMA BROWSER
// ============================================

export class SchemaBrowser {
  private schemaCache: Map<string, CachedSchema> = new Map();
  private cacheTimeout = 30000; // 30 seconds

  /**
   * Get all schemas/databases
   */
  async getSchemas(connection: DatabaseConnection): Promise<SchemaInfo[]> {
    const cacheKey = `${connection.id}_schemas`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as SchemaInfo[];

    const schemas = await this.fetchSchemas(connection);
    this.setCache(cacheKey, schemas);
    return schemas;
  }

  private async fetchSchemas(connection: DatabaseConnection): Promise<SchemaInfo[]> {
    // Simulate fetching schemas
    await this.simulateDelay(50);

    switch (connection.config.type) {
      case 'postgresql':
        return [
          { catalog: 'postgres', name: 'public', owner: 'postgres', tableCount: 15, viewCount: 3, procedureCount: 5, sequenceCount: 2 },
          { catalog: 'postgres', name: 'information_schema', owner: 'postgres', tableCount: 60, viewCount: 0, procedureCount: 0, sequenceCount: 0 },
          { catalog: 'postgres', name: 'pg_catalog', owner: 'postgres', tableCount: 100, viewCount: 0, procedureCount: 50, sequenceCount: 0 },
        ];
      case 'mysql':
        return [
          { catalog: connection.config.database, name: connection.config.database, tableCount: 20, viewCount: 5, procedureCount: 10, sequenceCount: 0 },
          { catalog: 'information_schema', name: 'information_schema', tableCount: 60, viewCount: 0, procedureCount: 0, sequenceCount: 0 },
          { catalog: 'mysql', name: 'mysql', tableCount: 30, viewCount: 0, procedureCount: 5, sequenceCount: 0 },
        ];
      case 'sqlite':
        return [
          { catalog: 'main', name: 'main', tableCount: 10, viewCount: 2, procedureCount: 0, sequenceCount: 0 },
        ];
      case 'mongodb':
        return [
          { catalog: connection.config.database, name: connection.config.database, tableCount: 25, viewCount: 0, procedureCount: 0, sequenceCount: 0 },
        ];
      default:
        return [];
    }
  }

  /**
   * Get all tables in a schema
   */
  async getTables(connection: DatabaseConnection, schemaName: string): Promise<TableSchema[]> {
    const cacheKey = `${connection.id}_${schemaName}_tables`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as TableSchema[];

    const tables = await this.fetchTables(connection, schemaName);
    this.setCache(cacheKey, tables);
    return tables;
  }

  private async fetchTables(connection: DatabaseConnection, schemaName: string): Promise<TableSchema[]> {
    await this.simulateDelay(80);

    // Generate sample tables based on connection type
    const tableNames = this.getSampleTableNames(connection.config.type, schemaName);
    
    return tableNames.map((name, index) => ({
      catalog: connection.config.database,
      schema: schemaName,
      name,
      type: 'table' as TableType,
      comment: `Sample table ${index + 1}`,
      rowCount: Math.floor(Math.random() * 10000),
      dataSize: Math.floor(Math.random() * 1000000),
      indexSize: Math.floor(Math.random() * 500000),
      columns: [],
      foreignKeys: [],
      indexes: [],
      constraints: [],
      triggers: [],
    }));
  }

  private getSampleTableNames(type: DatabaseType, _schemaName: string): string[] {
    const commonTables = ['users', 'roles', 'permissions', 'sessions', 'logs'];
    
    if (type === 'postgresql') {
      return [...commonTables, 'products', 'orders', 'order_items', 'categories', 'audit_log'];
    } else if (type === 'mysql') {
      return [...commonTables, 'customers', 'invoices', 'payments', 'accounts'];
    } else if (type === 'sqlite') {
      return [...commonTables.slice(0, 3), 'settings', 'cache'];
    } else {
      return [...commonTables, 'documents', 'metadata'];
    }
  }

  /**
   * Get detailed table information including columns
   */
  async getTableDetails(
    connection: DatabaseConnection,
    schemaName: string,
    tableName: string
  ): Promise<TableSchema> {
    const cacheKey = `${connection.id}_${schemaName}_${tableName}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as TableSchema;

    const table = await this.fetchTableDetails(connection, schemaName, tableName);
    this.setCache(cacheKey, table);
    return table;
  }

  private async fetchTableDetails(
    connection: DatabaseConnection,
    schemaName: string,
    tableName: string
  ): Promise<TableSchema> {
    await this.simulateDelay(100);

    const columns = await this.getTableColumns(connection, schemaName, tableName);
    const primaryKey = await this.getPrimaryKey(connection, schemaName, tableName);
    const foreignKeys = await this.getForeignKeys(connection, schemaName, tableName);
    const indexes = await this.getIndexes(connection, schemaName, tableName);
    const constraints = await this.getConstraints(connection, schemaName, tableName);
    const triggers = await this.getTriggers(connection, schemaName, tableName);

    return {
      catalog: connection.config.database,
      schema: schemaName,
      name: tableName,
      type: 'table',
      comment: `Table ${tableName}`,
      rowCount: Math.floor(Math.random() * 10000),
      dataSize: Math.floor(Math.random() * 1000000),
      indexSize: Math.floor(Math.random() * 500000),
      columns,
      primaryKey,
      foreignKeys,
      indexes,
      constraints,
      triggers,
    };
  }

  /**
   * Get table columns
   */
  async getTableColumns(
    _connection: DatabaseConnection,
    _schemaName: string,
    tableName: string
  ): Promise<ColumnInfo[]> {
    await this.simulateDelay(50);

    // Generate sample columns based on table name
    const sampleColumns: Record<string, ColumnInfo[]> = {
      users: [
        { name: 'id', ordinalPosition: 1, type: 'bigint', nullable: false, isAutoIncrement: true, isGenerated: false, isPrimaryKey: true, isForeignKey: false, isUnique: true },
        { name: 'username', ordinalPosition: 2, type: 'varchar(50)', nullable: false, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: true },
        { name: 'email', ordinalPosition: 3, type: 'varchar(255)', nullable: false, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: true },
        { name: 'password_hash', ordinalPosition: 4, type: 'varchar(255)', nullable: false, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'full_name', ordinalPosition: 5, type: 'varchar(100)', nullable: true, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'role_id', ordinalPosition: 6, type: 'integer', nullable: true, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: true, isUnique: false },
        { name: 'is_active', ordinalPosition: 7, type: 'boolean', nullable: false, defaultValue: 'true', isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'created_at', ordinalPosition: 8, type: 'timestamp', nullable: false, defaultValue: 'CURRENT_TIMESTAMP', isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'updated_at', ordinalPosition: 9, type: 'timestamp', nullable: true, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
      ],
      roles: [
        { name: 'id', ordinalPosition: 1, type: 'integer', nullable: false, isAutoIncrement: true, isGenerated: false, isPrimaryKey: true, isForeignKey: false, isUnique: true },
        { name: 'name', ordinalPosition: 2, type: 'varchar(50)', nullable: false, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: true },
        { name: 'description', ordinalPosition: 3, type: 'text', nullable: true, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
      ],
      orders: [
        { name: 'id', ordinalPosition: 1, type: 'bigint', nullable: false, isAutoIncrement: true, isGenerated: false, isPrimaryKey: true, isForeignKey: false, isUnique: true },
        { name: 'user_id', ordinalPosition: 2, type: 'bigint', nullable: false, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: true, isUnique: false },
        { name: 'total_amount', ordinalPosition: 3, type: 'decimal(10,2)', nullable: false, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'status', ordinalPosition: 4, type: 'varchar(20)', nullable: false, defaultValue: 'pending', isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false, enumValues: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] },
        { name: 'created_at', ordinalPosition: 5, type: 'timestamp', nullable: false, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
      ],
    };

    if (sampleColumns[tableName]) {
      return sampleColumns[tableName];
    }

    // Default columns for unknown tables
    return [
      { name: 'id', ordinalPosition: 1, type: 'integer', nullable: false, isAutoIncrement: true, isGenerated: false, isPrimaryKey: true, isForeignKey: false, isUnique: true },
      { name: 'name', ordinalPosition: 2, type: 'varchar(255)', nullable: true, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
      { name: 'description', ordinalPosition: 3, type: 'text', nullable: true, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
      { name: 'created_at', ordinalPosition: 4, type: 'timestamp', nullable: false, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
      { name: 'updated_at', ordinalPosition: 5, type: 'timestamp', nullable: true, isAutoIncrement: false, isGenerated: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
    ];
  }

  /**
   * Get primary key
   */
  async getPrimaryKey(
    _connection: DatabaseConnection,
    _schemaName: string,
    tableName: string
  ): Promise<PrimaryKey | undefined> {
    await this.simulateDelay(30);

    return {
      name: `pk_${tableName}`,
      columns: ['id'],
    };
  }

  /**
   * Get foreign keys
   */
  async getForeignKeys(
    _connection: DatabaseConnection,
    _schemaName: string,
    tableName: string
  ): Promise<ForeignKey[]> {
    await this.simulateDelay(40);

    const foreignKeys: ForeignKey[] = [];

    if (tableName === 'users') {
      foreignKeys.push({
        name: 'fk_users_role_id',
        columns: ['role_id'],
        referencedSchema: 'public',
        referencedTable: 'roles',
        referencedColumns: ['id'],
        onUpdate: 'NO ACTION',
        onDelete: 'SET NULL',
        isDeferrable: false,
        initiallyDeferred: false,
      });
    }

    if (tableName === 'orders') {
      foreignKeys.push({
        name: 'fk_orders_user_id',
        columns: ['user_id'],
        referencedSchema: 'public',
        referencedTable: 'users',
        referencedColumns: ['id'],
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        isDeferrable: false,
        initiallyDeferred: false,
      });
    }

    return foreignKeys;
  }

  /**
   * Get indexes
   */
  async getIndexes(
    _connection: DatabaseConnection,
    _schemaName: string,
    tableName: string
  ): Promise<IndexInfo[]> {
    await this.simulateDelay(50);

    const indexes: IndexInfo[] = [
      {
        name: `pk_${tableName}`,
        schema: 'public',
        tableName,
        isUnique: true,
        isPrimary: true,
        type: 'btree',
        columns: [{ name: 'id', order: 'ASC' }],
        isClustered: true,
      },
    ];

    if (tableName === 'users') {
      indexes.push(
        {
          name: 'idx_users_username',
          schema: 'public',
          tableName,
          isUnique: true,
          isPrimary: false,
          type: 'btree',
          columns: [{ name: 'username', order: 'ASC' }],
          isClustered: false,
        },
        {
          name: 'idx_users_email',
          schema: 'public',
          tableName,
          isUnique: true,
          isPrimary: false,
          type: 'btree',
          columns: [{ name: 'email', order: 'ASC' }],
          isClustered: false,
        }
      );
    }

    return indexes;
  }

  /**
   * Get constraints
   */
  async getConstraints(
    _connection: DatabaseConnection,
    _schemaName: string,
    tableName: string
  ): Promise<Constraint[]> {
    await this.simulateDelay(40);

    const constraints: Constraint[] = [
      {
        name: `pk_${tableName}`,
        schema: 'public',
        tableName,
        type: 'PRIMARY KEY',
        columns: ['id'],
        isDeferrable: false,
        initiallyDeferred: false,
      },
    ];

    if (tableName === 'users') {
      constraints.push(
        {
          name: 'chk_users_email',
          schema: 'public',
          tableName,
          type: 'CHECK',
          columns: ['email'],
          checkClause: "email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
          isDeferrable: false,
          initiallyDeferred: false,
        },
        {
          name: 'uq_users_username',
          schema: 'public',
          tableName,
          type: 'UNIQUE',
          columns: ['username'],
          isDeferrable: false,
          initiallyDeferred: false,
        }
      );
    }

    return constraints;
  }

  /**
   * Get triggers
   */
  async getTriggers(
    _connection: DatabaseConnection,
    _schemaName: string,
    tableName: string
  ): Promise<Trigger[]> {
    await this.simulateDelay(30);

    if (tableName === 'users' || tableName === 'orders') {
      return [
        {
          name: `trg_${tableName}_updated_at`,
          schema: 'public',
          tableName,
          event: ['UPDATE'],
          timing: 'BEFORE',
          level: 'ROW',
          statement: `UPDATE ${tableName} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id`,
          function: 'update_timestamp',
          isEnabled: true,
        },
      ];
    }

    return [];
  }

  /**
   * Get views
   */
  async getViews(connection: DatabaseConnection, schemaName: string): Promise<ViewDefinition[]> {
    const cacheKey = `${connection.id}_${schemaName}_views`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as ViewDefinition[];

    const views = await this.fetchViews(connection, schemaName);
    this.setCache(cacheKey, views);
    return views;
  }

  private async fetchViews(_connection: DatabaseConnection, _schemaName: string): Promise<ViewDefinition[]> {
    await this.simulateDelay(60);

    return [
      {
        catalog: 'main',
        schema: 'public',
        name: 'active_users',
        definition: 'SELECT * FROM users WHERE is_active = true',
        checkOption: 'NONE',
        isUpdatable: true,
        isInsertable: true,
        isDeletable: true,
        columns: [],
      },
      {
        catalog: 'main',
        schema: 'public',
        name: 'order_summary',
        definition: 'SELECT o.id, o.user_id, u.username, o.total_amount, o.status FROM orders o JOIN users u ON o.user_id = u.id',
        checkOption: 'NONE',
        isUpdatable: false,
        isInsertable: false,
        isDeletable: false,
        columns: [],
      },
    ];
  }

  /**
   * Get stored procedures and functions
   */
  async getStoredProcedures(
    connection: DatabaseConnection,
    schemaName: string
  ): Promise<StoredProcedure[]> {
    const cacheKey = `${connection.id}_${schemaName}_procedures`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as StoredProcedure[];

    const procedures = await this.fetchStoredProcedures(connection, schemaName);
    this.setCache(cacheKey, procedures);
    return procedures;
  }

  private async fetchStoredProcedures(
    connection: DatabaseConnection,
    _schemaName: string
  ): Promise<StoredProcedure[]> {
    await this.simulateDelay(70);

    if (connection.config.type === 'sqlite' || connection.config.type === 'mongodb') {
      return [];
    }

    return [
      {
        catalog: connection.config.database,
        schema: 'public',
        name: 'get_user_by_id',
        type: 'FUNCTION',
        language: connection.config.type === 'postgresql' ? 'plpgsql' : 'SQL',
        definition: 'CREATE FUNCTION get_user_by_id(user_id bigint) RETURNS TABLE(...) AS $$ ... $$ LANGUAGE plpgsql;',
        parameters: [{ name: 'user_id', ordinalPosition: 1, mode: 'IN', type: 'bigint' }],
        returnType: 'TABLE',
        isDeterministic: true,
        securityType: 'INVOKER',
      },
      {
        catalog: connection.config.database,
        schema: 'public',
        name: 'update_user_status',
        type: 'PROCEDURE',
        language: connection.config.type === 'postgresql' ? 'plpgsql' : 'SQL',
        definition: 'CREATE PROCEDURE update_user_status(user_id bigint, new_status boolean) AS $$ ... $$ LANGUAGE plpgsql;',
        parameters: [
          { name: 'user_id', ordinalPosition: 1, mode: 'IN', type: 'bigint' },
          { name: 'new_status', ordinalPosition: 2, mode: 'IN', type: 'boolean' },
        ],
        isDeterministic: true,
        securityType: 'INVOKER',
      },
    ];
  }

  /**
   * Get sequences
   */
  async getSequences(
    connection: DatabaseConnection,
    schemaName: string
  ): Promise<SequenceInfo[]> {
    const cacheKey = `${connection.id}_${schemaName}_sequences`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as SequenceInfo[];

    const sequences = await this.fetchSequences(connection, schemaName);
    this.setCache(cacheKey, sequences);
    return sequences;
  }

  private async fetchSequences(_connection: DatabaseConnection, _schemaName: string): Promise<SequenceInfo[]> {
    await this.simulateDelay(40);

    return [
      {
        catalog: 'main',
        schema: 'public',
        name: 'users_id_seq',
        dataType: 'bigint',
        startValue: BigInt(1),
        minimumValue: BigInt(1),
        maximumValue: BigInt(9223372036854775807),
        increment: BigInt(1),
        cycleOption: false,
        cacheSize: 1,
        ownedBy: 'users.id',
      },
    ];
  }

  /**
   * Get enum types (PostgreSQL specific)
   */
  async getEnumTypes(connection: DatabaseConnection, schemaName: string): Promise<EnumType[]> {
    if (connection.config.type !== 'postgresql') {
      return [];
    }

    const cacheKey = `${connection.id}_${schemaName}_enums`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as EnumType[];

    const enums = await this.fetchEnumTypes(connection, schemaName);
    this.setCache(cacheKey, enums);
    return enums;
  }

  private async fetchEnumTypes(_connection: DatabaseConnection, _schemaName: string): Promise<EnumType[]> {
    await this.simulateDelay(30);

    return [
      {
        schema: 'public',
        name: 'order_status',
        values: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      },
      {
        schema: 'public',
        name: 'user_role',
        values: ['admin', 'moderator', 'user', 'guest'],
      },
    ];
  }

  /**
   * Search for tables, columns, procedures, etc.
   */
  async search(
    connection: DatabaseConnection,
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    await this.simulateDelay(100);

    const results: SearchResult[] = [];
    const schemas = await this.getSchemas(connection);
    const searchSchema = options?.schema || schemas[0]?.name;

    if (searchSchema) {
      // Search tables
      const tables = await this.getTables(connection, searchSchema);
      for (const table of tables) {
        if (table.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            type: 'table',
            schema: table.schema,
            name: table.name,
            description: table.comment,
          });
        }

        // Search columns
        const columns = await this.getTableColumns(connection, table.schema, table.name);
        for (const column of columns) {
          if (column.name.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              type: 'column',
              schema: table.schema,
              name: column.name,
              parent: table.name,
              description: `${column.type}${column.nullable ? ' (nullable)' : ''}`,
            });
          }
        }
      }

      // Search procedures
      const procedures = await this.getStoredProcedures(connection, searchSchema);
      for (const proc of procedures) {
        if (proc.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            type: 'procedure',
            schema: proc.schema,
            name: proc.name,
            description: `${proc.type} in ${proc.language}`,
          });
        }
      }
    }

    return results.slice(0, options?.limit || 50);
  }

  /**
   * Get table dependencies (what this table depends on and what depends on it)
   */
  async getTableDependencies(
    connection: DatabaseConnection,
    schemaName: string,
    tableName: string
  ): Promise<TableDependencies> {
    await this.simulateDelay(60);

    const dependencies: TableDependencies = {
      dependsOn: [],
      dependedBy: [],
    };

    // Get foreign keys to find dependencies
    const foreignKeys = await this.getForeignKeys(connection, schemaName, tableName);
    for (const fk of foreignKeys) {
      dependencies.dependsOn.push({
        schema: fk.referencedSchema,
        name: fk.referencedTable,
        type: 'table',
        relationship: 'foreign_key',
      });
    }

    // Find tables that reference this table
    const schemas = await this.getSchemas(connection);
    for (const schema of schemas) {
      const tables = await this.getTables(connection, schema.name);
      for (const table of tables) {
        if (table.name !== tableName) {
          const tableFks = await this.getForeignKeys(connection, schema.name, table.name);
          for (const fk of tableFks) {
            if (fk.referencedTable === tableName) {
              dependencies.dependedBy.push({
                schema: schema.name,
                name: table.name,
                type: 'table',
                relationship: 'foreign_key',
              });
            }
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Generate DDL for a table
   */
  async generateDDL(
    connection: DatabaseConnection,
    schemaName: string,
    tableName: string
  ): Promise<string> {
    const table = await this.getTableDetails(connection, schemaName, tableName);

    const lines: string[] = [];
    const dbType = connection.config.type;

    // Table creation
    lines.push(`-- Table: ${table.schema}.${table.name}`);
    lines.push(`CREATE TABLE ${this.quoteIdentifier(table.schema, dbType)}.${this.quoteIdentifier(table.name, dbType)} (`);
    lines.push('');

    // Columns
    const columnDefs: string[] = [];
    for (const col of table.columns) {
      let colDef = `  ${this.quoteIdentifier(col.name, dbType)} ${col.type}`;
      
      if (col.isAutoIncrement) {
        if (dbType === 'postgresql') {
          colDef = `  ${this.quoteIdentifier(col.name, dbType)} BIGSERIAL`;
        } else if (dbType === 'mysql') {
          colDef += ' AUTO_INCREMENT';
        }
      }

      if (!col.nullable && !col.isPrimaryKey) {
        colDef += ' NOT NULL';
      }

      if (col.defaultValue !== undefined && col.defaultValue !== null) {
        colDef += ` DEFAULT ${col.defaultValue}`;
      }

      columnDefs.push(colDef);
    }
    lines.push(columnDefs.join(',\n'));

    // Primary key
    if (table.primaryKey) {
      lines.push(`  , CONSTRAINT ${this.quoteIdentifier(table.primaryKey.name, dbType)} PRIMARY KEY (${table.primaryKey.columns.map(c => this.quoteIdentifier(c, dbType)).join(', ')})`);
    }

    lines.push(');');
    lines.push('');

    // Foreign keys
    for (const fk of table.foreignKeys) {
      lines.push(`ALTER TABLE ${this.quoteIdentifier(table.schema, dbType)}.${this.quoteIdentifier(table.name, dbType)}`);
      lines.push(`  ADD CONSTRAINT ${this.quoteIdentifier(fk.name, dbType)}`);
      lines.push(`  FOREIGN KEY (${fk.columns.map(c => this.quoteIdentifier(c, dbType)).join(', ')})`);
      lines.push(`  REFERENCES ${this.quoteIdentifier(fk.referencedSchema, dbType)}.${this.quoteIdentifier(fk.referencedTable, dbType)} (${fk.referencedColumns.map(c => this.quoteIdentifier(c, dbType)).join(', ')})`);
      lines.push(`  ON UPDATE ${fk.onUpdate}`);
      lines.push(`  ON DELETE ${fk.onDelete};`);
      lines.push('');
    }

    // Indexes
    for (const idx of table.indexes) {
      if (!idx.isPrimary) {
        lines.push(`CREATE ${idx.isUnique ? 'UNIQUE ' : ''}INDEX ${this.quoteIdentifier(idx.name, dbType)}`);
        lines.push(`  ON ${this.quoteIdentifier(idx.schema, dbType)}.${this.quoteIdentifier(idx.tableName, dbType)}`);
        lines.push(`  (${idx.columns.map(c => this.quoteIdentifier(c.name, dbType) + (c.order !== 'ASC' ? ` ${c.order}` : '')).join(', ')});`);
        lines.push('');
      }
    }

    // Constraints
    for (const con of table.constraints) {
      if (con.type !== 'PRIMARY KEY' && con.type !== 'FOREIGN KEY') {
        lines.push(`ALTER TABLE ${this.quoteIdentifier(table.schema, dbType)}.${this.quoteIdentifier(table.name, dbType)}`);
        lines.push(`  ADD CONSTRAINT ${this.quoteIdentifier(con.name, dbType)}`);
        
        if (con.type === 'UNIQUE') {
          lines.push(`  UNIQUE (${con.columns.map(c => this.quoteIdentifier(c, dbType)).join(', ')});`);
        } else if (con.type === 'CHECK' && con.checkClause) {
          lines.push(`  CHECK (${con.checkClause});`);
        }
        lines.push('');
      }
    }

    // Comments
    if (table.comment) {
      if (dbType === 'postgresql') {
        lines.push(`COMMENT ON TABLE ${this.quoteIdentifier(table.schema, dbType)}.${this.quoteIdentifier(table.name, dbType)} IS '${table.comment}';`);
      } else if (dbType === 'mysql') {
        lines.push(`ALTER TABLE ${this.quoteIdentifier(table.schema, dbType)}.${this.quoteIdentifier(table.name, dbType)} COMMENT = '${table.comment}';`);
      }
    }

    return lines.join('\n');
  }

  private quoteIdentifier(name: string, dbType: DatabaseType): string {
    switch (dbType) {
      case 'postgresql':
        return `"${name.replace(/"/g, '""')}"`;
      case 'mysql':
        return `\`${name.replace(/`/g, '``')}\``;
      case 'sqlite':
        return `"${name}"`;
      default:
        return name;
    }
  }

  // ============================================
  // CACHE MANAGEMENT
  // ============================================

  private getFromCache(key: string): unknown | null {
    const cached = this.schemaCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.schemaCache.delete(key);
    return null;
  }

  private setCache(key: string, data: unknown): void {
    this.schemaCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clearCache(): void {
    this.schemaCache.clear();
  }

  invalidateTable(schemaName: string, tableName: string): void {
    for (const key of this.schemaCache.keys()) {
      if (key.includes(`_${schemaName}_${tableName}`) || key.includes(`_${schemaName}_tables`)) {
        this.schemaCache.delete(key);
      }
    }
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// HELPER INTERFACES
// ============================================

interface CachedSchema {
  data: unknown;
  timestamp: number;
}

export interface SearchOptions {
  schema?: string;
  types?: SearchType[];
  limit?: number;
}

export type SearchType = 'table' | 'column' | 'procedure' | 'view' | 'sequence';

export interface SearchResult {
  type: SearchType;
  schema: string;
  name: string;
  parent?: string;
  description?: string;
}

export interface TableDependencies {
  dependsOn: DependencyItem[];
  dependedBy: DependencyItem[];
}

export interface DependencyItem {
  schema: string;
  name: string;
  type: 'table' | 'view' | 'procedure';
  relationship: string;
}

// ============================================
// SINGLETON EXPORT
// ============================================

let schemaBrowserInstance: SchemaBrowser | null = null;

export function getSchemaBrowser(): SchemaBrowser {
  if (!schemaBrowserInstance) {
    schemaBrowserInstance = new SchemaBrowser();
  }
  return schemaBrowserInstance;
}
