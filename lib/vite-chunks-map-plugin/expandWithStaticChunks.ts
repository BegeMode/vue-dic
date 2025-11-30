import { RouteDepsMap } from './types'

/**
 * Expand route deps map to include statically imported chunks.
 * Uses chunk.imports to find all dependent chunks recursively.
 * Excludes main entry chunk (index-*.js) from recursive traversal as it contains all dynamic imports.
 */
export function expandWithStaticChunks(
  routeDepsMap: RouteDepsMap,
  bundle: Record<string, any>,
  devTelemetry?: boolean
): RouteDepsMap {
  // Find the main entry chunk (typically index-*.js or the largest chunk with isEntry)
  let mainEntryChunk: string | null = null
  for (const [fileName, chunk] of Object.entries(bundle)) {
    if (chunk.type === 'chunk' && chunk.isEntry) {
      mainEntryChunk = fileName
      break
    }
  }
  
  // Build map of chunk fileName -> chunk.imports (static imports only)
  const chunkImports = new Map<string, string[]>()
  
  for (const [fileName, chunk] of Object.entries(bundle)) {
    if (chunk.type === 'chunk' && chunk.imports) {
      chunkImports.set(fileName, chunk.imports as string[])
    }
  }
  
  // For each route, recursively collect all statically imported chunks
  const expandedMap: RouteDepsMap = {}
  
  for (const [routePath, chunks] of Object.entries(routeDepsMap)) {
    const allChunks = new Set<string>(chunks)
    const queue = [...chunks]
    
    while (queue.length > 0) {
      const chunkFileName = queue.shift()!
      
      // Skip main entry chunk - it contains imports to everything
      if (chunkFileName === mainEntryChunk) continue
      
      // Add static imports only (not dynamic - they're handled separately by our plugin)
      const staticImports = chunkImports.get(chunkFileName)
      if (staticImports) {
        for (const importedChunk of staticImports) {
          // Skip main entry chunk
          if (importedChunk === mainEntryChunk) continue
          
          if (!allChunks.has(importedChunk)) {
            allChunks.add(importedChunk)
            queue.push(importedChunk)
          }
        }
      }
    }
    
    // Remove main entry chunk from result if it was in original chunks
    if (mainEntryChunk) {
      allChunks.delete(mainEntryChunk)
    }
    
    expandedMap[routePath] = Array.from(allChunks).sort()
    
    if (devTelemetry && allChunks.size !== chunks.length) {
      console.log(`[vite-chunks-map-plugin] Route ${routePath}: ${chunks.length} -> ${allChunks.size} chunks`)
    }
  }
  
  return expandedMap
}
