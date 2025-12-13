import { parse } from '@typescript-eslint/typescript-estree'
import { simpleTraverse } from '@typescript-eslint/typescript-estree'
import type { DepIdEntry } from './types'

/**
 * Parse a depIds file and extract string property values.
 * 
 * Example input:
 * ```ts
 * export const INFRA_DEPS = {
 *   ...APP_DEPS,           // ignored (spread)
 *   CounterStore: 'CounterStore',  // extracted
 * } as const
 * ```
 * 
 * @param code - Source code of the depIds file
 * @returns Array of DepIdEntry
 */
export function parseDepIdsFile(code: string): DepIdEntry[] {
  const entries: DepIdEntry[] = []

  let ast: any
  try {
    ast = parse(code, {
      loc: true,
      range: true,
      comment: false,
      jsx: false,
    })
  } catch (e) {
    console.error('[vite-cqrs-register] Failed to parse depIds file:', e)
    return entries
  }

  simpleTraverse(ast, {
    enter(node: any) {
      // Look for: const CONST_NAME = { ... } or export const CONST_NAME = { ... }
      if (node.type === 'VariableDeclaration') {
        for (const declarator of node.declarations || []) {
          if (
            declarator.type === 'VariableDeclarator' &&
            declarator.id?.type === 'Identifier'
          ) {
            const constName = declarator.id.name
            
            // Handle: INFRA_DEPS = { ... } as const
            // The init can be TSAsExpression wrapping ObjectExpression
            let objExpr = declarator.init
            if (objExpr?.type === 'TSAsExpression') {
              objExpr = objExpr.expression
            }
            
            if (objExpr?.type === 'ObjectExpression') {
              for (const prop of objExpr.properties || []) {
                // Skip SpreadElement (...APP_DEPS)
                if (prop.type === 'SpreadElement') continue

                // Extract: propertyName: 'stringValue'
                if (
                  prop.type === 'Property' &&
                  prop.key?.type === 'Identifier' &&
                  prop.value?.type === 'Literal' &&
                  typeof prop.value.value === 'string'
                ) {
                  entries.push({
                    constName,
                    propertyName: prop.key.name,
                    value: prop.value.value,
                  })
                }
              }
            }
          }
        }
      }
    },
  })

  return entries
}

/**
 * Build a Map from depIds entries.
 * Key: "CONST_NAME.propertyName"
 * Value: string value
 * 
 * @param entries - Array of DepIdEntry from all depIds files
 * @returns Map for resolving store ID expressions
 */
export function buildDepIdsMap(entries: DepIdEntry[]): Map<string, string> {
  const map = new Map<string, string>()

  for (const entry of entries) {
    const key = `${entry.constName}.${entry.propertyName}`
    map.set(key, entry.value)
  }

  return map
}

/**
 * Resolve a Store ID expression to its string value.
 * 
 * @param storeIdExpr - Expression like "INFRA_DEPS.CounterStore" or "'counter'"
 * @param depIdsMap - Map from buildDepIdsMap
 * @returns Resolved string value
 * @throws Error if expression cannot be resolved
 */
export function resolveStoreId(
  storeIdExpr: string,
  depIdsMap: Map<string, string>
): string {
  // String literal: "'counter'" → 'counter'
  if (storeIdExpr.startsWith("'") && storeIdExpr.endsWith("'")) {
    return storeIdExpr.slice(1, -1)
  }
  if (storeIdExpr.startsWith('"') && storeIdExpr.endsWith('"')) {
    return storeIdExpr.slice(1, -1)
  }

  // MemberExpression: "INFRA_DEPS.CounterStore"
  const resolved = depIdsMap.get(storeIdExpr)
  if (resolved !== undefined) {
    return resolved
  }

  throw new Error(
    `[vite-cqrs-register] Cannot resolve Store ID: ${storeIdExpr}. ` +
      `Make sure it's defined in one of depIdsFiles.`
  )
}

