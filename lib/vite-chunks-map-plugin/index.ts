import type { Plugin, ResolvedConfig } from 'vite'
import type {
  RouteDepsPluginOptions,
  RouteDepsMap,
  ParsedRoute,
  IocDepsByFile,
  DepIdToDynamicImport,
  ChunkByModule,
  CssByChunk
} from './types'
import { parseRouterFiles } from './parseRouter'
import { collectDynamicImports, createDynamicImportsCollector, shouldProcessFile } from './parseDynamicImports'
import { parseIocMaps } from './parseIocMaps'
import { buildRouteDepsFromGraph, mapModulesToChunks } from './graphWalk'
import { getFileIocDeps } from '../vite-inject-vue-deps-plugin/vite-inject-vue-deps-plugin'
import { expandWithStaticChunks } from './expandWithStaticChunks'
import { addMatchingChunks } from './addMatchingChunks'

// Virtual module IDs
const VIRTUAL_ID_DEFAULT = 'virtual:route-deps-map'
const PLACEHOLDER = '__ROUTE_DEPS_MAP_PLACEHOLDER__'

interface PluginState {
  config: ResolvedConfig | null
  routes: ParsedRoute[]
  dynamicImportsCollector: ReturnType<typeof createDynamicImportsCollector>
  iocDepsByFile: IocDepsByFile
  depIdToDynamicImport: DepIdToDynamicImport
  staticImportsInRouter: Map<string, string>
}

/**
 * Vite plugin for collecting route dependencies map
 * 
 * This plugin:
 * 1. Parses router files to extract routes and their entry components
 * 2. Collects dynamic imports from all modules during build
 * 3. Parses IoC map files to extract DEPS.X -> dynamic import mappings
 * 4. Builds a dependency graph for each route
 * 5. Maps dependencies to chunk file names in generateBundle
 * 6. Exports the map via virtual:route-deps-map module
 */
export default function viteChunksMapPlugin(userOptions: RouteDepsPluginOptions): Plugin {
  const options: Required<RouteDepsPluginOptions> = {
    routerDir: userOptions.routerDir,
    iocMapFiles: userOptions.iocMapFiles,
    virtualModuleId: userOptions.virtualModuleId ?? VIRTUAL_ID_DEFAULT,
    enableGlobImports: userOptions.enableGlobImports ?? true,
    includeStaticChunks: userOptions.includeStaticChunks ?? false,
    includeChunkPatterns: userOptions.includeChunkPatterns ?? [],
    devTelemetry: userOptions.devTelemetry ?? false
  }

  const VIRTUAL_ID = options.virtualModuleId
  const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID

  const state: PluginState = {
    config: null,
    routes: [],
    dynamicImportsCollector: createDynamicImportsCollector(),
    iocDepsByFile: {},
    depIdToDynamicImport: {},
    staticImportsInRouter: new Map()
  }

  return {
    name: 'vite-chunks-map-plugin',
    apply: 'build',
    enforce: 'post',

    // ============ Config ============
    
    configResolved(config) {
      state.config = config
    },

    // ============ Virtual Module ============
    
    resolveId(id) {
      if (id === VIRTUAL_ID) {
        return RESOLVED_VIRTUAL_ID
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_ID) {
        // Return placeholder - will be replaced in generateBundle
        return `export default "${PLACEHOLDER}";`
      }
    },

    // ============ Build Start ============
    
    async buildStart() {
      if (!state.config) return
      
      const rootDir = state.config.root
      
      // Parse router files
      const { routes, staticImports } = await parseRouterFiles({
        routerDir: options.routerDir,
        rootDir,
        parse: (code) => this.parse(code),
        resolve: async (source, importer) => {
          const resolved = await this.resolve(source, importer)
          return resolved ? { id: resolved.id } : null
        },
        devTelemetry: options.devTelemetry
      })
      
      state.routes = routes
      state.staticImportsInRouter = staticImports
      
      if (options.devTelemetry) {
        console.log('[vite-chunks-map-plugin] Parsed routes:', routes.map(r => r.fullPath))
      }
      
      // Parse IoC map files
      state.depIdToDynamicImport = await parseIocMaps({
        iocMapFiles: options.iocMapFiles,
        rootDir,
        parse: (code) => this.parse(code),
        resolve: async (source, importer) => {
          const resolved = await this.resolve(source, importer)
          return resolved ? { id: resolved.id } : null
        },
        devTelemetry: options.devTelemetry
      })
      
      if (options.devTelemetry) {
        console.log('[vite-chunks-map-plugin] IoC dynamic deps:', Object.keys(state.depIdToDynamicImport))
      }
    },

    // ============ Transform: Collect Dynamic Imports ============
    
    async transform(code, id) {
      // Only process relevant files
      if (!shouldProcessFile(id)) return null
      
      // Skip if no dynamic import syntax
      if (!code.includes('import(') && !code.includes('import.meta.glob')) {
        return null
      }
      
      let ast: any
      try {
        ast = this.parse(code)
      } catch (e) {
        if (options.devTelemetry) {
          console.warn(`[vite-chunks-map-plugin] Failed to parse ${id}:`, e)
        }
        return null
      }
      
      // Clean the id (remove query params)
      const cleanId = id.split('?')[0]
      
      // Collect dynamic imports
      const dynamicImports = await collectDynamicImports({
        code,
        id: cleanId,
        ast,
        resolve: async (source, importer) => {
          const resolved = await this.resolve(source, importer)
          return resolved ? { id: resolved.id } : null
        },
        enableGlobImports: options.enableGlobImports,
        devTelemetry: options.devTelemetry
      })
      
      if (dynamicImports.size > 0) {
        state.dynamicImportsCollector.add(cleanId, dynamicImports)
        
        if (options.devTelemetry) {
          console.log(`[vite-chunks-map-plugin] Found ${dynamicImports.size} dynamic imports in ${cleanId}`)
        }
      }
      
      // Don't modify the code
      return null
    },

    // ============ Generate Bundle: Build Final Map ============
    
    generateBundle(_outputOptions, bundle) {
      // Import IoC deps from virtual module (collected by vite-inject-vue-deps-plugin)
      // We need to get this at generateBundle time when all transforms are done
      try {
        // Look for the virtual module in the bundle or use direct access
        // For now, we'll build the map without IoC deps and add them if available
      } catch (e) {
        if (options.devTelemetry) {
          console.warn('[vite-chunks-map-plugin] Could not get IoC deps:', e)
        }
      }
      
      // Build chunk mapping
      const chunkByModule: ChunkByModule = new Map()
      const cssByChunk: CssByChunk = new Map()
      
      for (const [_fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          // Map modules to chunk
          for (const moduleId of Object.keys(chunk.modules || {})) {
            chunkByModule.set(moduleId, chunk.fileName)
          }
          
          // Collect CSS files
          const viteMetadata = (chunk as any).viteMetadata
          if (viteMetadata?.importedCss) {
            cssByChunk.set(chunk.fileName, viteMetadata.importedCss as Set<string>)
          }
        }
      }
      
      // Get IoC deps from the IoC plugin's shared state
      // The IoC plugin runs with enforce: 'post' too, but processes files before us
      let iocDepsByFile: IocDepsByFile = {}
      try {
        const map = getFileIocDeps()
        for (const [moduleId, deps] of map) {
          iocDepsByFile[moduleId] = Array.from(deps)
        }
        if (options.devTelemetry) {
          console.log('[vite-chunks-map-plugin] Got IoC deps from plugin:', Object.keys(iocDepsByFile).length, 'files')
        }
      } catch (e) {
        if (options.devTelemetry) {
          console.log('[vite-chunks-map-plugin] IoC plugin not available:', e)
        }
      }
      
      // Build route deps graph
      const routeModuleDeps = buildRouteDepsFromGraph(
        state.routes,
        state.dynamicImportsCollector.get(),
        iocDepsByFile,
        state.depIdToDynamicImport,
        (id) => this.getModuleInfo(id),
        options.devTelemetry
      )
      
      // Map to chunk file names
      let routeDepsMap: RouteDepsMap = mapModulesToChunks(
        routeModuleDeps,
        chunkByModule,
        cssByChunk
      )
      
      // Include statically imported chunks (code-split by Vite)
      if (options.includeStaticChunks) {
        routeDepsMap = expandWithStaticChunks(routeDepsMap, bundle, options.devTelemetry)
      }
      
      // Include chunks matching patterns (for runtime-loaded chunks like loaders)
      if (options.includeChunkPatterns.length > 0) {
        routeDepsMap = addMatchingChunks(routeDepsMap, bundle, options.includeChunkPatterns, options.devTelemetry)
      }
      
      if (options.devTelemetry) {
        console.log('[vite-chunks-map-plugin] Final route deps map:')
        for (const [route, chunks] of Object.entries(routeDepsMap)) {
          console.log(`  ${route}: ${chunks.length} chunks`)
        }
      }
      
      // Replace placeholder in virtual module chunk
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.code.includes(PLACEHOLDER)) {
          chunk.code = chunk.code.replace(
            `"${PLACEHOLDER}"`,
            JSON.stringify(routeDepsMap)
          )
          
          if (options.devTelemetry) {
            console.log(`[vite-chunks-map-plugin] Replaced placeholder in ${fileName}`)
          }
        }
      }
      
      // Also emit as a standalone asset for direct access
      this.emitFile({
        type: 'asset',
        fileName: 'route-deps-map.json',
        source: JSON.stringify(routeDepsMap, null, 2)
      })
    }
  }
}

