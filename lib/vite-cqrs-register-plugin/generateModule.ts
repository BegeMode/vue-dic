import type { StoreInfo, CqrsEntry } from './types'

/**
 * Generate the virtual queries registry module.
 *
 * Example output:
 * ```ts
 * import { CurrentUserQuery } from '@/domain/queries/user.query'
 * import { MovieListQuery } from '@/domain/queries/movie.query'
 *
 * export const queriesRegistry = new Map<Function, string>([
 *   [CurrentUserQuery, 'CounterStore'],
 *   [MovieListQuery, 'MoviesStore'],
 * ])
 * ```
 *
 * @param stores - Array of StoreInfo with resolved Store IDs
 * @returns Generated module code
 */
export function generateQueriesModule(stores: StoreInfo[]): string {
  const imports: string[] = []
  const entries: string[] = []
  const seen = new Set<string>()

  for (const store of stores) {
    for (const query of store.queries) {
      const importKey = `${query.originalName}:${query.importPath}`

      if (!seen.has(importKey)) {
        seen.add(importKey)
        // Use originalName for import, className for Map entry
        if (query.className !== query.originalName) {
          imports.push(
            `import { ${query.originalName} as ${query.className} } from '${query.importPath}'`
          )
        } else {
          imports.push(`import { ${query.className} } from '${query.importPath}'`)
        }
      }

      entries.push(`  [${query.className}, '${store.storeId}']`)
    }
  }

  if (imports.length === 0) {
    return `export const queriesRegistry = new Map()\n`
  }

  return `${imports.join('\n')}

export const queriesRegistry = new Map([
${entries.join(',\n')}
])
`
}

/**
 * Generate the virtual commands registry module.
 *
 * Example output:
 * ```ts
 * import { IncrementCommand } from '@/domain/commands/increment.command'
 * import { DateUpdateCommand } from '@/domain/commands/date.command'
 *
 * export const commandsRegistry = new Map<Function, string>([
 *   [IncrementCommand, 'CounterStore'],
 *   [DateUpdateCommand, 'DateStore'],
 * ])
 * ```
 *
 * @param stores - Array of StoreInfo with resolved Store IDs
 * @returns Generated module code
 */
export function generateCommandsModule(stores: StoreInfo[]): string {
  const imports: string[] = []
  const entries: string[] = []
  const seen = new Set<string>()

  for (const store of stores) {
    for (const command of store.commands) {
      const importKey = `${command.originalName}:${command.importPath}`

      if (!seen.has(importKey)) {
        seen.add(importKey)
        // Use originalName for import, className for Map entry
        if (command.className !== command.originalName) {
          imports.push(
            `import { ${command.originalName} as ${command.className} } from '${command.importPath}'`
          )
        } else {
          imports.push(`import { ${command.className} } from '${command.importPath}'`)
        }
      }

      entries.push(`  [${command.className}, '${store.storeId}']`)
    }
  }

  if (imports.length === 0) {
    return `export const commandsRegistry = new Map()\n`
  }

  return `${imports.join('\n')}

export const commandsRegistry = new Map([
${entries.join(',\n')}
])
`
}

/**
 * Get summary of all registries for logging.
 *
 * @param stores - Array of StoreInfo
 * @returns Summary object
 */
export function getRegistrySummary(stores: StoreInfo[]): {
  totalQueries: number
  totalCommands: number
  storeCount: number
} {
  let totalQueries = 0
  let totalCommands = 0

  for (const store of stores) {
    totalQueries += store.queries.length
    totalCommands += store.commands.length
  }

  return {
    totalQueries,
    totalCommands,
    storeCount: stores.length,
  }
}

