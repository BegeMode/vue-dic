/**
 * Options for vite-cqrs-register-plugin
 */
export interface CqrsRegisterPluginOptions {
  /** Path to stores directory (absolute or relative to project root) */
  storesDir?: string

  /** Glob pattern for store files */
  storePattern?: string

  /** Glob patterns to exclude */
  exclude?: string[]

  /** Array of paths to depIds files containing Store ID definitions */
  depIdsFiles: string[]

  /** Virtual module ID for queries registry */
  queriesVirtualModuleId?: string

  /** Virtual module ID for commands registry */
  commandsVirtualModuleId?: string

  /** Enable console logging */
  devTelemetry?: boolean
}

/**
 * Entry from depIds file: CONST_NAME.propertyName → 'value'
 */
export interface DepIdEntry {
  /** Constant name (e.g., 'INFRA_DEPS') */
  constName: string
  /** Property name (e.g., 'CounterStore') */
  propertyName: string
  /** String value (e.g., 'CounterStore') */
  value: string
}

/**
 * Query or Command entry extracted from store file
 */
export interface CqrsEntry {
  /** Class name (e.g., 'CurrentUserQuery') */
  className: string
  /** Original name if aliased (e.g., 'CurrentUserQuery' for 'import { X as CurrentUserQuery }') */
  originalName: string
  /** Import path (e.g., '@/domain/queries/user.query') */
  importPath: string
}

/**
 * Result of parsing a store file
 */
export interface StoreParseResult {
  /** Store ID expression as found in code (e.g., 'INFRA_DEPS.CounterStore' or "'counter'") */
  storeIdExpr: string | null
  /** List of queryable entries */
  queries: CqrsEntry[]
  /** List of commandable entries */
  commands: CqrsEntry[]
}

/**
 * Fully resolved store info
 */
export interface StoreInfo {
  /** Absolute file path */
  filePath: string
  /** Resolved Store ID (e.g., 'CounterStore') */
  storeId: string
  /** List of queryable entries */
  queries: CqrsEntry[]
  /** List of commandable entries */
  commands: CqrsEntry[]
}

/**
 * Import info extracted from import declarations
 */
export interface ImportInfo {
  /** Original exported name */
  originalName: string
  /** Import path */
  importPath: string
}

