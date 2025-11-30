import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { DepIdToDynamicImport } from './types'

interface ParseIocMapsOptions {
  iocMapFiles: string[]
  rootDir: string
  parse: (code: string) => any
  resolve: (source: string, importer: string) => Promise<{ id: string } | null>
  devTelemetry?: boolean
}

/**
 * Parse IoC map files and extract DEPS.X -> dynamic import path mapping
 * 
 * Uses regex-based approach to avoid TypeScript parsing issues.
 * 
 * Supports:
 *   - [DEPS.X]: queryDynamicImport(..., () => import('path'))
 *   - [DEPS.X]: { loader: () => import('path') }
 *   - [DEPS.X]: () => import('path')
 * 
 * Static deps like [DEPS.X]: SomeClass are IGNORED
 */
export async function parseIocMaps(options: ParseIocMapsOptions): Promise<DepIdToDynamicImport> {
  const { iocMapFiles, rootDir, resolve: resolveId, devTelemetry } = options
  
  const result: DepIdToDynamicImport = {}
  
  // Process files in order - later files override earlier ones
  for (const filePath of iocMapFiles) {
    const absolutePath = resolve(rootDir, filePath)
    
    let code: string
    try {
      code = readFileSync(absolutePath, 'utf-8')
    } catch (e) {
      if (devTelemetry) {
        console.warn(`[vite-chunks-map-plugin] Failed to read IoC map file ${absolutePath}:`, e)
      }
      continue
    }
    
    // Use regex to extract [DEPS.X]: ...import('path')... patterns
    const entries = extractDepsEntriesWithRegex(code)
    
    if (devTelemetry && entries.length > 0) {
      console.log(`[vite-chunks-map-plugin] Found ${entries.length} deps entries in ${filePath}`)
    }
    
    // Resolve import paths
    for (const entry of entries) {
      if (entry.importPath) {
        try {
          const resolved = await resolveId(entry.importPath, absolutePath)
          if (resolved) {
            result[entry.depId] = resolved.id
          }
        } catch (e) {
          if (devTelemetry) {
            console.warn(`[vite-chunks-map-plugin] Failed to resolve ${entry.importPath} from ${absolutePath}`)
          }
        }
      }
    }
  }
  
  if (devTelemetry) {
    console.log(`[vite-chunks-map-plugin] Parsed IoC maps:`, Object.keys(result).length, 'dynamic deps')
  }
  
  return result
}

interface DepsEntry {
  depId: string        // e.g. "DEPS.First"
  importPath: string | null  // e.g. "@/ui/services/firstService"
}

/**
 * Extract deps entries using regex (works with TypeScript without parsing)
 * 
 * Handles multi-line entries like:
 *   [DEPS.AlertQuery]: queryDynamicImport(
 *     DEPS.AlertQuery,
 *     AlertQuery,
 *     () => import('@/ui/interactiveQuery/alertQuery.handler')
 *   ),
 */
function extractDepsEntriesWithRegex(code: string): DepsEntry[] {
  const entries: DepsEntry[] = []
  
  // First, find all [DEPS.X] or [SOMETHING_DEPS.X] occurrences
  const depsKeyPattern = /\[(\w*DEPS\w*)\.(\w+)\]\s*:/g
  
  let keyMatch
  while ((keyMatch = depsKeyPattern.exec(code)) !== null) {
    const objName = keyMatch[1] // DEPS
    const propName = keyMatch[2] // First, Logger, etc.
    const depId = `${objName}.${propName}`
    
    // Get the position after the key
    const startPos = keyMatch.index + keyMatch[0].length
    
    // Find the value - it ends at the next [DEPS. or at the closing } of the object
    // We need to find the matching closing bracket/paren if there are nested structures
    const valueEndPos = findValueEnd(code, startPos)
    const value = code.slice(startPos, valueEndPos)
    
    // Look for import('...') or import(`...`) in the value
    const importMatch = value.match(/import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/)
    
    if (importMatch) {
      entries.push({
        depId,
        importPath: importMatch[1]
      })
    }
    // If no import found, it's a static dep - we skip it
  }
  
  return entries
}

/**
 * Find the end position of a value in deps object
 * Handles nested brackets and parentheses
 */
function findValueEnd(code: string, startPos: number): number {
  let depth = 0
  let inString: string | null = null
  
  for (let i = startPos; i < code.length; i++) {
    const char = code[i]
    const prevChar = i > 0 ? code[i - 1] : ''
    
    // Handle strings
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (inString === char) {
        inString = null
      } else if (!inString) {
        inString = char
      }
      continue
    }
    
    if (inString) continue
    
    // Track depth
    if (char === '(' || char === '{' || char === '[') {
      depth++
    } else if (char === ')' || char === '}' || char === ']') {
      depth--
      if (depth < 0) {
        // We've gone past the end of the deps object
        return i
      }
    }
    
    // A comma at depth 0 means end of this value
    if (char === ',' && depth === 0) {
      return i
    }
    
    // A new [DEPS. at depth 0 means next entry
    if (depth === 0 && code.slice(i, i + 6) === '[DEPS.') {
      return i
    }
  }
  
  return code.length
}
