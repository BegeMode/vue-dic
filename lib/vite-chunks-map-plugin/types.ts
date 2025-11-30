import type { Plugin } from 'vite'

// ============ Plugin Options ============

export interface RouteDepsPluginOptions {
  /** Absolute or relative path to the router directory with createRouter(...) */
  routerDir: string

  /** Array of paths to TS files with export const deps = ... */
  iocMapFiles: string[]

  /** Virtual module name for runtime */
  virtualModuleId?: string // default 'virtual:route-deps-map'

  /** Enable glob/globEager heuristics */
  enableGlobImports?: boolean // default true

  /** 
   * Include statically imported chunks (code-split by Vite).
   * When true, includes chunks that are imported through static imports.
   * default: false
   */
  includeStaticChunks?: boolean
  
  /**
   * Glob patterns for chunks to include in all non-empty routes.
   * Useful for runtime-loaded chunks like loaders with axios, etc.
   * Example: ['loader-*', 'service-*']
   * default: []
   */
  includeChunkPatterns?: string[]

  /** Logging to console during build */
  devTelemetry?: boolean // default false
}

// ============ Route Dependencies Map ============

/** Final output: route path -> chunk file names */
export type RouteDepsMap = Record<string /* routePath */, string[] /* chunk file names */>

// ============ Parsed Route Info ============

export interface ParsedRoute {
  /** Route path, e.g. "/", "/about", "/movies/:id" */
  path: string
  
  /** Full path including parent paths for nested routes */
  fullPath: string
  
  /** Entry module ID (resolved absolute path) */
  entryModuleId: string | null
  
  /** Whether component is a dynamic import */
  isDynamic: boolean
  
  /** Raw component identifier (for static imports) */
  componentIdentifier?: string
}

// ============ IoC Dependencies ============

/** Map of DEPS.X -> dynamic import path */
export type DepIdToDynamicImport = Record<string /* 'DEPS.First' */, string /* resolved module path */>

/** IoC dependencies collected from components */
export type IocDepsByFile = Record<string /* moduleId */, string[] /* depIds like 'DEPS.DateTime' */>

// ============ Dynamic Imports ============

/** Dynamic imports per file */
export type DynamicImportsByFile = Map<string /* moduleId */, Set<string /* resolved target module */>>

// ============ Chunk Mapping ============

/** Module to chunk file name mapping */
export type ChunkByModule = Map<string /* moduleId */, string /* chunkFileName */>

/** CSS files associated with each chunk */
export type CssByChunk = Map<string /* chunkFileName */, Set<string> /* css file names */>

// ============ Graph Walk Result ============

export interface RouteGraphResult {
  /** All dynamic import targets for this route */
  dynamicTargets: Set<string /* moduleId */>
  
  /** All visited modules during graph traversal */
  visitedModules: Set<string /* moduleId */>
}

// ============ Plugin Context ============

export interface PluginContext {
  /** Vite resolved config */
  config: any
  
  /** Parsed routes from router files */
  routes: ParsedRoute[]
  
  /** Dynamic imports per module */
  dynamicImportsByFile: DynamicImportsByFile
  
  /** IoC deps per module (from virtual:ioc-deps-graph) */
  iocDepsByFile: IocDepsByFile
  
  /** DEPS.X -> dynamic import path mapping */
  depIdToDynamicImport: DepIdToDynamicImport
  
  /** Static imports mapping for router file */
  staticImportsInRouter: Map<string /* identifier */, string /* resolved path */>
}
