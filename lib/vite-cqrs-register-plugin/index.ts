import type { Plugin, ViteDevServer } from 'vite'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, relative, normalize, join } from 'path'

import type { CqrsRegisterPluginOptions, StoreInfo } from './types'
import { parseDepIdsFile, buildDepIdsMap, resolveStoreId } from './parseDepIds'
import { parseStoreFile, hasStoreDefinition, hasCqrsHandlers } from './parseStore'
import { generateQueriesModule, generateCommandsModule, getRegistrySummary } from './generateModule'

const PLUGIN_NAME = 'vite-cqrs-register'

// Default options
const DEFAULTS = {
  storesDir: 'src/infrastructure/stores',
  storePattern: '**/[!_]*.ts',
  exclude: ['**/__tests__/**', '**/loader.ts', '**/types.ts', '**/config.ts', '**/register.ts'],
  queriesVirtualModuleId: 'virtual:queries-registry',
  commandsVirtualModuleId: 'virtual:commands-registry',
  devTelemetry: false,
}

/**
 * Vite plugin for automatic CQRS Query/Command → Store ID registration.
 *
 * Scans store files, extracts queryable/commandable calls, and generates
 * two virtual modules: `virtual:queries-registry` and `virtual:commands-registry`.
 *
 * @param userOptions - Plugin options
 * @returns Vite plugin
 */
export default function cqrsRegisterPlugin(userOptions: CqrsRegisterPluginOptions): Plugin {
  const opts = { ...DEFAULTS, ...userOptions }

  // Virtual module IDs
  const QUERIES_VIRTUAL_ID = opts.queriesVirtualModuleId
  const COMMANDS_VIRTUAL_ID = opts.commandsVirtualModuleId
  const RESOLVED_QUERIES_ID = '\0' + QUERIES_VIRTUAL_ID
  const RESOLVED_COMMANDS_ID = '\0' + COMMANDS_VIRTUAL_ID

  // State
  let projectRoot = ''
  let depIdsMap: Map<string, string> = new Map()
  const stores: Map<string, StoreInfo> = new Map() // filePath → StoreInfo

  /**
   * Log a message if devTelemetry is enabled.
   */
  function log(...args: any[]) {
    if (opts.devTelemetry) {
      console.log(`[${PLUGIN_NAME}]`, ...args)
    }
  }

  /**
   * Log an error.
   */
  function logError(...args: any[]) {
    console.error(`[${PLUGIN_NAME}]`, ...args)
  }

  /**
   * Resolve a file path relative to project root.
   */
  function resolvePath(filePath: string): string {
    if (filePath.startsWith('/')) return filePath
    return resolve(projectRoot, filePath)
  }

  /**
   * Get relative path for display.
   */
  function getRelativePath(filePath: string): string {
    return relative(projectRoot, filePath)
  }

  /**
   * Check if a file is within the stores directory.
   */
  function isStoreFile(filePath: string): boolean {
    const storesDir = resolvePath(opts.storesDir)
    const normalizedPath = normalize(filePath)
    const normalizedStoresDir = normalize(storesDir)
    return normalizedPath.startsWith(normalizedStoresDir)
  }

  /**
   * Check if a file is a depIds file.
   */
  function isDepIdsFile(filePath: string): boolean {
    const normalizedPath = normalize(filePath)
    return opts.depIdsFiles.some((f) => {
      const resolved = normalize(resolvePath(f))
      return normalizedPath === resolved
    })
  }

  /**
   * Parse all depIds files and build the map.
   */
  function parseAllDepIds(): void {
    const allEntries: { constName: string; propertyName: string; value: string }[] = []

    log('Parsing depIds files...')

    for (const filePath of opts.depIdsFiles) {
      const absolutePath = resolvePath(filePath)

      if (!existsSync(absolutePath)) {
        logError(`depIds file not found: ${filePath}`)
        continue
      }

      const code = readFileSync(absolutePath, 'utf-8')
      const entries = parseDepIdsFile(code)

      log(`  ${filePath}: ${entries.length} entries`)
      allEntries.push(...entries)
    }

    depIdsMap = buildDepIdsMap(allEntries)
    log(`Total depIds entries: ${depIdsMap.size}`)
  }

  /**
   * Find all TypeScript files in a directory recursively.
   */
  function findTsFiles(dir: string): string[] {
    const files: string[] = []

    try {
      const entries = readdirSync(dir)
      for (const entry of entries) {
        const fullPath = join(dir, entry)

        // Check exclusions
        const relativePath = relative(resolvePath(opts.storesDir), fullPath)
        const shouldExclude = opts.exclude.some((pattern) => {
          // Simple pattern matching: **/__tests__/**, **/loader.ts, etc.
          if (pattern.includes('**')) {
            const cleanPattern = pattern.replace(/\*\*/g, '')
            return relativePath.includes(cleanPattern.replace(/\//g, ''))
          }
          return entry === pattern || relativePath.endsWith(pattern.replace('**/', ''))
        })

        if (shouldExclude) continue

        try {
          const stat = statSync(fullPath)

          if (stat.isDirectory()) {
            files.push(...findTsFiles(fullPath))
          } else if (stat.isFile() && /\.ts$/.test(entry) && !entry.startsWith('_')) {
            files.push(fullPath)
          }
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      // Directory doesn't exist or not accessible
    }

    return files
  }

  /**
   * Scan and parse all store files.
   */
  async function scanAllStores(): Promise<void> {
    const storesDir = resolvePath(opts.storesDir)

    if (!existsSync(storesDir)) {
      logError(`Stores directory not found: ${opts.storesDir}`)
      return
    }

    log(`Scanning stores in: ${opts.storesDir}`)

    // Find store files
    const files = findTsFiles(storesDir)

    log(`Found ${files.length} store files`)

    stores.clear()

    for (const filePath of files) {
      await processStoreFile(filePath)
    }

    // Log summary
    const summary = getRegistrySummary(Array.from(stores.values()))
    log(`Total: ${summary.totalQueries} queries, ${summary.totalCommands} commands`)
  }

  /**
   * Process a single store file.
   */
  async function processStoreFile(filePath: string): Promise<void> {
    const code = readFileSync(filePath, 'utf-8')

    // Quick check: skip if no defineStore
    if (!hasStoreDefinition(code)) {
      return
    }

    // Quick check: skip if no queryable/commandable
    if (!hasCqrsHandlers(code)) {
      return
    }

    const result = parseStoreFile(code)

    if (!result.storeIdExpr) {
      logError(`No defineStore found in: ${getRelativePath(filePath)}`)
      return
    }

    // Resolve Store ID
    let storeId: string
    try {
      storeId = resolveStoreId(result.storeIdExpr, depIdsMap)
    } catch (e) {
      logError(`${e}`)
      logError(`  File: ${getRelativePath(filePath)}`)
      throw e
    }

    // Check for missing imports
    for (const query of result.queries) {
      if (!query.importPath) {
        const error = `Query class "${query.className}" is not imported in ${getRelativePath(filePath)}`
        logError(error)
        throw new Error(error)
      }
    }

    for (const command of result.commands) {
      if (!command.importPath) {
        const error = `Command class "${command.className}" is not imported in ${getRelativePath(filePath)}`
        logError(error)
        throw new Error(error)
      }
    }

    const storeInfo: StoreInfo = {
      filePath,
      storeId,
      queries: result.queries,
      commands: result.commands,
    }

    stores.set(filePath, storeInfo)

    // Log store details
    if (opts.devTelemetry) {
      log(`\n${getRelativePath(filePath)}:`)
      log(`  Store ID: ${result.storeIdExpr} → '${storeId}'`)
      if (result.queries.length > 0) {
        log('  Queries:')
        for (const q of result.queries) {
          log(`    - ${q.className} (${q.importPath})`)
        }
      }
      if (result.commands.length > 0) {
        log('  Commands:')
        for (const c of result.commands) {
          log(`    - ${c.className} (${c.importPath})`)
        }
      }
    }
  }

  /**
   * Remove a store from registry.
   */
  function removeStore(filePath: string): void {
    stores.delete(filePath)
  }

  /**
   * Invalidate virtual modules (for HMR).
   */
  function invalidateVirtualModules(server: ViteDevServer): void {
    const queriesMod = server.moduleGraph.getModuleById(RESOLVED_QUERIES_ID)
    const commandsMod = server.moduleGraph.getModuleById(RESOLVED_COMMANDS_ID)

    if (queriesMod) {
      server.moduleGraph.invalidateModule(queriesMod)
    }
    if (commandsMod) {
      server.moduleGraph.invalidateModule(commandsMod)
    }

    // Trigger HMR
    server.ws.send({ type: 'full-reload' })
  }

  return {
    name: PLUGIN_NAME,
    enforce: 'pre',

    configResolved(config) {
      projectRoot = config.root
    },

    async buildStart() {
      // Parse depIds files
      parseAllDepIds()

      // Scan store files
      await scanAllStores()
    },

    resolveId(id) {
      if (id === QUERIES_VIRTUAL_ID) {
        return RESOLVED_QUERIES_ID
      }
      if (id === COMMANDS_VIRTUAL_ID) {
        return RESOLVED_COMMANDS_ID
      }
      return null
    },

    load(id) {
      if (id === RESOLVED_QUERIES_ID) {
        const code = generateQueriesModule(Array.from(stores.values()))
        if (opts.devTelemetry) {
          log('Generated queries registry:\n' + code)
        }
        return code
      }

      if (id === RESOLVED_COMMANDS_ID) {
        const code = generateCommandsModule(Array.from(stores.values()))
        if (opts.devTelemetry) {
          log('Generated commands registry:\n' + code)
        }
        return code
      }

      return null
    },

    configureServer(server) {
      // Watch for changes in store files and depIds files
      server.watcher.on('change', async (file) => {
        const normalizedFile = normalize(file)

        // depIds file changed
        if (isDepIdsFile(normalizedFile)) {
          log(`depIds file changed: ${getRelativePath(normalizedFile)}`)
          parseAllDepIds()
          await scanAllStores()
          invalidateVirtualModules(server)
          return
        }

        // Store file changed
        if (isStoreFile(normalizedFile)) {
          log(`Store file changed: ${getRelativePath(normalizedFile)}`)
          try {
            await processStoreFile(normalizedFile)
            invalidateVirtualModules(server)
          } catch (e) {
            logError(`Error processing store file: ${e}`)
          }
        }
      })

      // Watch for new store files
      server.watcher.on('add', async (file) => {
        const normalizedFile = normalize(file)

        if (isStoreFile(normalizedFile)) {
          log(`New store file: ${getRelativePath(normalizedFile)}`)
          try {
            await processStoreFile(normalizedFile)
            invalidateVirtualModules(server)
          } catch (e) {
            logError(`Error processing store file: ${e}`)
          }
        }
      })

      // Watch for deleted store files
      server.watcher.on('unlink', (file) => {
        const normalizedFile = normalize(file)

        if (isStoreFile(normalizedFile)) {
          log(`Store file deleted: ${getRelativePath(normalizedFile)}`)
          removeStore(normalizedFile)
          invalidateVirtualModules(server)
        }
      })
    },
  }
}

// Named export for convenience
export { cqrsRegisterPlugin }

// Re-export types
export type { CqrsRegisterPluginOptions, StoreInfo, CqrsEntry } from './types'

