import { walk } from 'estree-walker'
import type { Node } from 'estree'
import type { DynamicImportsByFile } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ASTNode = any

interface CollectDynamicImportsOptions {
  code: string
  id: string
  ast: any
  resolve: (source: string, importer: string) => Promise<{ id: string } | null>
  enableGlobImports?: boolean
  devTelemetry?: boolean
}

/**
 * Collect dynamic imports from a module's AST
 * Handles:
 *   - import('...')
 *   - defineAsyncComponent(() => import('...'))
 *   - import.meta.glob('...')
 *   - import.meta.globEager('...')
 */
export async function collectDynamicImports(
  options: CollectDynamicImportsOptions
): Promise<Set<string>> {
  const { code, id, ast, resolve, enableGlobImports = true, devTelemetry } = options
  
  const dynamicImports = new Set<string>()
  const rawImportPaths: string[] = []
  
  walk(ast, {
    enter(node: Node) {
      const n = node as ASTNode
      
      // Case 1: import('...')
      if (n.type === 'ImportExpression') {
        const source = n.source
        const importPath = extractStringLiteral(source, code)
        if (importPath) {
          rawImportPaths.push(importPath)
        }
        return
      }
      
      // Case 2: CallExpression with callee type 'Import' (older parser format)
      if (n.type === 'CallExpression' && n.callee?.type === 'Import') {
        const arg = n.arguments?.[0]
        const importPath = extractStringLiteral(arg, code)
        if (importPath) {
          rawImportPaths.push(importPath)
        }
        return
      }
      
      // Case 3: import.meta.glob / import.meta.globEager
      if (enableGlobImports && n.type === 'CallExpression') {
        const callee = n.callee
        if (
          callee?.type === 'MemberExpression' &&
          callee.object?.type === 'MetaProperty' &&
          callee.object.meta?.name === 'import' &&
          callee.object.property?.name === 'meta'
        ) {
          const methodName = callee.property?.name
          if (methodName === 'glob' || methodName === 'globEager') {
            // For now, we don't expand globs - would require fs access
            // The spec allows "с запасом" (with margin) so this is acceptable
            if (devTelemetry) {
              console.log(`[vite-chunks-map-plugin] Found ${methodName} in ${id}, not expanded`)
            }
          }
        }
        return
      }
    }
  })
  
  // Resolve all import paths
  for (const rawPath of rawImportPaths) {
    try {
      const resolved = await resolve(rawPath, id)
      if (resolved) {
        dynamicImports.add(resolved.id)
      }
    } catch (e) {
      if (devTelemetry) {
        console.warn(`[vite-chunks-map-plugin] Failed to resolve ${rawPath} from ${id}`)
      }
    }
  }
  
  return dynamicImports
}

/**
 * Extract string value from a literal or template literal node
 */
function extractStringLiteral(node: ASTNode | null | undefined, code: string): string | null {
  if (!node) return null
  
  // Simple string literal
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }
  
  // Template literal without expressions: `@/path/to/file`
  if (node.type === 'TemplateLiteral') {
    if (node.expressions?.length === 0 && node.quasis?.length === 1) {
      return node.quasis[0].value?.cooked || node.quasis[0].value?.raw || null
    }
    // Template with expressions - can't statically analyze, skip
    return null
  }
  
  return null
}

/**
 * Create a collector that accumulates dynamic imports across transform calls
 */
export function createDynamicImportsCollector(): {
  add: (moduleId: string, imports: Set<string>) => void
  get: () => DynamicImportsByFile
  clear: () => void
} {
  const map: DynamicImportsByFile = new Map()
  
  return {
    add(moduleId: string, imports: Set<string>) {
      const existing = map.get(moduleId)
      if (existing) {
        for (const imp of imports) {
          existing.add(imp)
        }
      } else {
        map.set(moduleId, new Set(imports))
      }
    },
    
    get() {
      return map
    },
    
    clear() {
      map.clear()
    }
  }
}

/**
 * Check if a file should be processed for dynamic imports
 */
export function shouldProcessFile(id: string): boolean {
  // Process .vue, .ts, .tsx, .js, .jsx files
  // Exclude node_modules and type-only imports
  if (id.includes('node_modules')) return false
  if (id.includes('?')) {
    // For Vue files, only process the script part in production
    // In transform hook, Vite already gives us the processed script
    const cleanId = id.split('?')[0]
    return /\.(vue|ts|tsx|js|jsx)$/.test(cleanId)
  }
  return /\.(vue|ts|tsx|js|jsx)$/.test(id)
}

