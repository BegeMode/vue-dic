import { parse } from '@typescript-eslint/typescript-estree'
import { simpleTraverse } from '@typescript-eslint/typescript-estree'
import type { StoreParseResult, CqrsEntry, ImportInfo } from './types'

/**
 * Parse a store file and extract Store ID, queries, and commands.
 *
 * Example input:
 * ```ts
 * import { defineStore } from 'pinia'
 * import { queryable } from '@/infrastructure/queries/queryable'
 * import { CurrentUserQuery } from '@/domain/queries/user.query'
 * import { INFRA_DEPS } from '@/infrastructure/depIds'
 *
 * const useStore = defineStore(INFRA_DEPS.CounterStore, ({ action }) => {
 *   return {
 *     getUser: queryable(CurrentUserQuery, action(getUser))
 *   }
 * })
 * ```
 *
 * @param code - Source code of the store file
 * @returns StoreParseResult with storeIdExpr, queries, and commands
 */
export function parseStoreFile(code: string): StoreParseResult {
  const result: StoreParseResult = {
    storeIdExpr: null,
    queries: [],
    commands: [],
  }

  let ast: any
  try {
    ast = parse(code, {
      loc: true,
      range: true,
      comment: false,
      jsx: false,
    })
  } catch (e) {
    console.error('[vite-cqrs-register] Failed to parse store file:', e)
    return result
  }

  // 1. Collect imports: localName → ImportInfo
  const importMap = new Map<string, ImportInfo>()

  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') {
      const importPath = node.source?.value
      if (typeof importPath !== 'string') continue

      for (const spec of node.specifiers || []) {
        if (spec.type === 'ImportSpecifier') {
          const localName = spec.local?.name
          const originalName = spec.imported?.name ?? localName
          if (localName) {
            importMap.set(localName, { originalName, importPath })
          }
        }
        // Also handle default imports if needed
        if (spec.type === 'ImportDefaultSpecifier') {
          const localName = spec.local?.name
          if (localName) {
            importMap.set(localName, { originalName: 'default', importPath })
          }
        }
      }
    }
  }

  // 2. Walk AST to find defineStore, queryable, commandable
  simpleTraverse(ast, {
    enter(node: any) {
      if (node.type !== 'CallExpression') return

      const callee = node.callee

      // Handle defineStore(...)
      if (callee?.type === 'Identifier' && callee.name === 'defineStore') {
        const firstArg = node.arguments?.[0]
        if (firstArg) {
          result.storeIdExpr = extractStoreIdExpr(firstArg, code)
        }
      }

      // Handle queryable(...) and commandable(...)
      if (callee?.type === 'Identifier') {
        const fnName = callee.name
        if (fnName === 'queryable' || fnName === 'commandable') {
          const firstArg = node.arguments?.[0]
          if (firstArg?.type === 'Identifier') {
            const className = firstArg.name
            const importInfo = importMap.get(className)

            if (importInfo) {
              const entry: CqrsEntry = {
                className,
                originalName: importInfo.originalName,
                importPath: importInfo.importPath,
              }

              if (fnName === 'queryable') {
                result.queries.push(entry)
              } else {
                result.commands.push(entry)
              }
            }
          }
        }
      }
    },
  })

  return result
}

/**
 * Extract Store ID expression from AST node.
 *
 * @param node - First argument of defineStore()
 * @param code - Original source code (for fallback extraction)
 * @returns String representation of the expression
 */
function extractStoreIdExpr(node: any, code: string): string | null {
  // MemberExpression: INFRA_DEPS.CounterStore
  if (node.type === 'MemberExpression') {
    const obj = node.object
    const prop = node.property

    if (obj?.type === 'Identifier' && prop?.type === 'Identifier') {
      return `${obj.name}.${prop.name}`
    }

    // Fallback: extract from source code using range
    if (Array.isArray(node.range)) {
      return code.slice(node.range[0], node.range[1])
    }
  }

  // Literal: 'counter' or "counter"
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return `'${node.value}'`
  }

  // Identifier: STORE_ID (variable reference)
  if (node.type === 'Identifier') {
    return node.name
  }

  // Fallback: extract from source code using range
  if (Array.isArray(node.range)) {
    return code.slice(node.range[0], node.range[1])
  }

  return null
}

/**
 * Check if a file likely contains a store definition.
 * Quick check before full parsing.
 *
 * @param code - Source code
 * @returns true if file contains defineStore
 */
export function hasStoreDefinition(code: string): boolean {
  return code.includes('defineStore')
}

/**
 * Check if a file contains queryable or commandable.
 * Quick check to determine if parsing is needed.
 *
 * @param code - Source code
 * @returns true if file contains queryable or commandable
 */
export function hasCqrsHandlers(code: string): boolean {
  return code.includes('queryable') || code.includes('commandable')
}

