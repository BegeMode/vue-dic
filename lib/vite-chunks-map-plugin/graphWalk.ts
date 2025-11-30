import type {
  DynamicImportsByFile,
  IocDepsByFile,
  DepIdToDynamicImport,
  RouteGraphResult,
  ParsedRoute
} from './types'

interface GraphWalkOptions {
  /** Entry module ID for the route */
  entryModuleId: string
  
  /** Dynamic imports collected per module */
  dynamicImportsByFile: DynamicImportsByFile
  
  /** IoC dependencies per module (from virtual:ioc-deps-graph) */
  iocDepsByFile: IocDepsByFile
  
  /** DEPS.X -> dynamic import path mapping */
  depIdToDynamicImport: DepIdToDynamicImport
  
  /** Function to get static imports for a module */
  getModuleInfo: (id: string) => { importedIds?: readonly string[] } | null
  
  /** Optional: enable telemetry logging */
  devTelemetry?: boolean
}

/**
 * Walk the module graph starting from an entry module
 * Collects all dynamic import targets (for chunks) and IoC dynamic deps
 * 
 * Algorithm (BFS):
 * 1. Start with entry module(s)
 * 2. For each module:
 *    - Add its dynamic imports to targets
 *    - Follow its static imports (to traverse the tree)
 *    - Check IoC deps and add dynamic ones to targets
 * 3. Continue until all reachable modules are visited
 */
export function walkModuleGraph(options: GraphWalkOptions): RouteGraphResult {
  const {
    entryModuleId,
    dynamicImportsByFile,
    iocDepsByFile,
    depIdToDynamicImport,
    getModuleInfo,
    devTelemetry
  } = options
  
  const visited = new Set<string>()
  const dynamicTargets = new Set<string>()
  const queue: string[] = [entryModuleId]
  
  while (queue.length > 0) {
    const moduleId = queue.shift()!
    
    if (visited.has(moduleId)) continue
    visited.add(moduleId)
    
    // 1. Collect dynamic imports from this module
    const moduleDynamicImports = dynamicImportsByFile.get(moduleId)
    if (moduleDynamicImports) {
      for (const target of moduleDynamicImports) {
        dynamicTargets.add(target)
        // Also traverse into dynamic imports
        if (!visited.has(target)) {
          queue.push(target)
        }
      }
    }
    
    // 2. Follow static imports (to traverse the component tree)
    const moduleInfo = getModuleInfo(moduleId)
    if (moduleInfo?.importedIds) {
      for (const staticImport of moduleInfo.importedIds) {
        // Skip node_modules
        if (staticImport.includes('node_modules')) continue
        
        if (!visited.has(staticImport)) {
          queue.push(staticImport)
        }
      }
    }
    
    // 3. Check IoC dependencies
    const iocDeps = iocDepsByFile[moduleId]
    if (iocDeps) {
      for (const depId of iocDeps) {
        // Only process dynamic IoC deps
        const dynamicImportPath = depIdToDynamicImport[depId]
        if (dynamicImportPath) {
          dynamicTargets.add(dynamicImportPath)
          // Also traverse into IoC dynamic import
          if (!visited.has(dynamicImportPath)) {
            queue.push(dynamicImportPath)
          }
        }
      }
    }
  }
  
  if (devTelemetry) {
    console.log(`[vite-chunks-map-plugin] Graph walk from ${entryModuleId}:`)
    console.log(`  - Visited ${visited.size} modules`)
    console.log(`  - Found ${dynamicTargets.size} dynamic targets`)
  }
  
  return {
    dynamicTargets,
    visitedModules: visited
  }
}

/**
 * Build route dependencies map by walking graph for each route
 */
export function buildRouteDepsFromGraph(
  routes: ParsedRoute[],
  dynamicImportsByFile: DynamicImportsByFile,
  iocDepsByFile: IocDepsByFile,
  depIdToDynamicImport: DepIdToDynamicImport,
  getModuleInfo: (id: string) => { importedIds?: readonly string[] } | null,
  devTelemetry?: boolean
): Map<string /* routePath */, Set<string> /* moduleIds */> {
  const routeDeps = new Map<string, Set<string>>()
  
  for (const route of routes) {
    if (!route.entryModuleId) {
      if (devTelemetry) {
        console.warn(`[vite-chunks-map-plugin] Route ${route.fullPath} has no entry module`)
      }
      routeDeps.set(route.fullPath, new Set())
      continue
    }
    
    const result = walkModuleGraph({
      entryModuleId: route.entryModuleId,
      dynamicImportsByFile,
      iocDepsByFile,
      depIdToDynamicImport,
      getModuleInfo,
      devTelemetry
    })
    
    // Include the entry module itself in dynamic targets
    // (it will be in a chunk too)
    result.dynamicTargets.add(route.entryModuleId)
    
    routeDeps.set(route.fullPath, result.dynamicTargets)
  }
  
  return routeDeps
}

/**
 * Map module IDs to chunk file names
 */
export function mapModulesToChunks(
  routeModuleDeps: Map<string, Set<string>>,
  chunkByModule: Map<string, string>,
  cssByChunk: Map<string, Set<string>>
): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  
  for (const [routePath, moduleIds] of routeModuleDeps) {
    const chunks = new Set<string>()
    
    for (const moduleId of moduleIds) {
      const chunkFileName = chunkByModule.get(moduleId)
      if (chunkFileName) {
        chunks.add(chunkFileName)
        
        // Also add associated CSS files
        const cssFiles = cssByChunk.get(chunkFileName)
        if (cssFiles) {
          for (const css of cssFiles) {
            chunks.add(css)
          }
        }
      }
    }
    
    // Sort for consistent output
    result[routePath] = Array.from(chunks).sort()
  }
  
  return result
}
