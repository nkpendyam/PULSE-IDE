/**
 * Kyro IDE - Database Module
 * Database connection, query execution, and schema exploration
 */

// ============================================
// DATABASE EXPLORER
// ============================================

export {
  DatabaseExplorer,
  ConnectionStringParser,
  ConnectionPool,
  getDatabaseExplorer,
  // Types
  type DatabaseType,
  type ConnectionStatus,
  type ConnectionConfig,
  type SSLConfig,
  type PoolConfig,
  type DatabaseConnection,
  type ConnectionMetadata,
  type ParsedConnectionString,
  type QueryOptions,
  type IsolationLevel,
  type TransactionOptions,
  type ConnectionStats,
  type Transaction,
  type QueryExecutionResult,
  type QueryField,
} from './database-explorer';

// ============================================
// QUERY RUNNER
// ============================================

export {
  QueryRunner,
  QueryHistoryManager,
  ResultExporter,
  SQLAutocomplete,
  QueryValidator,
  getQueryRunner,
  getQueryHistory,
  getResultExporter,
  getSQLAutocomplete,
  getQueryValidator,
  // Types
  type QueryResult,
  type QueryStatus,
  type QueryError,
  type PaginationInfo,
  type QueryHistoryItem,
  type ParameterizedQuery,
  type QueryParameter,
  type ParameterType,
  type ExportOptions,
  type ExportFormat,
  type ExplainResult,
  type ExplainPlanRow,
  type BufferInfo,
  type QueryEditorState,
  type AutocompleteSuggestion,
  type HistoryFilter,
  type HistoryStats,
  type QueryExecutionOptions,
  type AutocompleteContext,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
} from './query-runner';

// ============================================
// SCHEMA BROWSER
// ============================================

export {
  SchemaBrowser,
  getSchemaBrowser,
  // Types
  type TableSchema,
  type TableType,
  type ColumnInfo,
  type PrimaryKey,
  type ForeignKey,
  type ReferentialAction,
  type MatchType,
  type IndexInfo,
  type IndexType,
  type IndexColumn,
  type Constraint,
  type ConstraintType,
  type Trigger,
  type TriggerEvent,
  type TriggerTiming,
  type TriggerLevel,
  type TablePrivilege,
  type ViewDefinition,
  type MaterializedView,
  type StoredProcedure,
  type RoutineType,
  type SecurityType,
  type RoutineParameter,
  type ParameterMode,
  type SequenceInfo,
  type SchemaInfo,
  type EnumType,
  type DomainType,
  type CollationInfo,
  type SearchOptions,
  type SearchType,
  type SearchResult,
  type TableDependencies,
  type DependencyItem,
} from './schema-browser';
