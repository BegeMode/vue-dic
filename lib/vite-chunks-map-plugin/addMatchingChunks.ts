import { RouteDepsMap } from './types'

/**
 * Convert glob pattern to regex (simple implementation for chunk matching)
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars
    .replace(/\*/g, '.*')                   // * -> .*
    .replace(/\?/g, '.')                    // ? -> .
  return new RegExp(`^${escaped}$`)
}

/**
 * Add chunks matching patterns to all non-empty routes
 */
export function addMatchingChunks(
  routeDepsMap: RouteDepsMap,
  bundle: Record<string, any>,
  patterns: string[],
  devTelemetry?: boolean
): RouteDepsMap {
  // Find all chunks matching any pattern
  const regexPatterns = patterns.map(globToRegex)
  const matchingChunks: string[] = []
  
  for (const [fileName, chunk] of Object.entries(bundle)) {
    if (chunk.type === 'chunk') {
      // Check against filename without path
      const baseName = fileName.split('/').pop() || fileName
      if (regexPatterns.some(re => re.test(baseName) || re.test(fileName))) {
        matchingChunks.push(fileName)
      }
    }
  }
  
  if (devTelemetry && matchingChunks.length > 0) {
    console.log(`[vite-chunks-map-plugin] Chunks matching patterns ${patterns.join(', ')}: ${matchingChunks.join(', ')}`)
  }
  
  // Add matching chunks to all non-empty routes
  const result: RouteDepsMap = {}
  for (const [routePath, chunks] of Object.entries(routeDepsMap)) {
    if (chunks.length > 0) {
      const allChunks = new Set(chunks)
      for (const chunk of matchingChunks) {
        allChunks.add(chunk)
      }
      result[routePath] = Array.from(allChunks).sort()
    } else {
      result[routePath] = chunks
    }
  }
  
  return result
}
