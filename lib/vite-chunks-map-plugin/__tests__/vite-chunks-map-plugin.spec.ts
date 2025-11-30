import { describe, it, expect, beforeEach, vi } from 'vitest'
import { parse } from 'acorn'
import { walkModuleGraph, buildRouteDepsFromGraph, mapModulesToChunks } from '../graphWalk'
import { createDynamicImportsCollector, shouldProcessFile, collectDynamicImports } from '../parseDynamicImports'
import { buildFullPath, findDynamicImport } from '../parseRouter'
import type { DynamicImportsByFile, IocDepsByFile, DepIdToDynamicImport, ParsedRoute } from '../types'

// Helper for parsing code into AST
function parseCode(code: string): any {
  return parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true
  })
}

describe('vite-chunks-map-plugin', () => {
  describe('shouldProcessFile', () => {
    it('should process .vue files', () => {
      expect(shouldProcessFile('/src/App.vue')).toBe(true)
    })

    it('should process .ts files', () => {
      expect(shouldProcessFile('/src/main.ts')).toBe(true)
    })

    it('should process .tsx files', () => {
      expect(shouldProcessFile('/src/Component.tsx')).toBe(true)
    })

    it('should process .js files', () => {
      expect(shouldProcessFile('/src/utils.js')).toBe(true)
    })

    it('should NOT process node_modules', () => {
      expect(shouldProcessFile('/node_modules/vue/index.js')).toBe(false)
    })

    it('should NOT process .css files', () => {
      expect(shouldProcessFile('/src/styles.css')).toBe(false)
    })

    it('should process Vue files with query params', () => {
      expect(shouldProcessFile('/src/App.vue?vue&type=script&lang.ts')).toBe(true)
    })
  })

  describe('createDynamicImportsCollector', () => {
    it('should accumulate dynamic imports', () => {
      const collector = createDynamicImportsCollector()
      
      collector.add('/src/A.vue', new Set(['/src/B.vue', '/src/C.vue']))
      collector.add('/src/D.vue', new Set(['/src/E.vue']))
      
      const result = collector.get()
      
      expect(result.size).toBe(2)
      expect(result.get('/src/A.vue')?.has('/src/B.vue')).toBe(true)
      expect(result.get('/src/A.vue')?.has('/src/C.vue')).toBe(true)
      expect(result.get('/src/D.vue')?.has('/src/E.vue')).toBe(true)
    })

    it('should merge imports for same module', () => {
      const collector = createDynamicImportsCollector()
      
      collector.add('/src/A.vue', new Set(['/src/B.vue']))
      collector.add('/src/A.vue', new Set(['/src/C.vue']))
      
      const result = collector.get()
      
      expect(result.size).toBe(1)
      expect(result.get('/src/A.vue')?.size).toBe(2)
      expect(result.get('/src/A.vue')?.has('/src/B.vue')).toBe(true)
      expect(result.get('/src/A.vue')?.has('/src/C.vue')).toBe(true)
    })

    it('should clear all data', () => {
      const collector = createDynamicImportsCollector()
      
      collector.add('/src/A.vue', new Set(['/src/B.vue']))
      collector.clear()
      
      expect(collector.get().size).toBe(0)
    })
  })

  describe('walkModuleGraph', () => {
    let dynamicImportsByFile: DynamicImportsByFile
    let iocDepsByFile: IocDepsByFile
    let depIdToDynamicImport: DepIdToDynamicImport
    let moduleGraph: Map<string, string[]>

    beforeEach(() => {
      dynamicImportsByFile = new Map()
      iocDepsByFile = {}
      depIdToDynamicImport = {}
      moduleGraph = new Map()
    })

    function getModuleInfo(id: string) {
      const imports = moduleGraph.get(id)
      return imports ? { importedIds: imports } : null
    }

    it('should collect direct dynamic imports', () => {
      dynamicImportsByFile.set('/src/Router.ts', new Set([
        '/src/views/Home.vue',
        '/src/views/About.vue'
      ]))
      
      const result = walkModuleGraph({
        entryModuleId: '/src/Router.ts',
        dynamicImportsByFile,
        iocDepsByFile,
        depIdToDynamicImport,
        getModuleInfo
      })
      
      expect(result.dynamicTargets.has('/src/views/Home.vue')).toBe(true)
      expect(result.dynamicTargets.has('/src/views/About.vue')).toBe(true)
      expect(result.dynamicTargets.size).toBe(2)
    })

    it('should follow static imports', () => {
      moduleGraph.set('/src/App.vue', ['/src/components/Header.vue'])
      moduleGraph.set('/src/components/Header.vue', ['/src/utils/format.ts'])
      
      dynamicImportsByFile.set('/src/utils/format.ts', new Set(['/src/lazy/Tooltip.vue']))
      
      const result = walkModuleGraph({
        entryModuleId: '/src/App.vue',
        dynamicImportsByFile,
        iocDepsByFile,
        depIdToDynamicImport,
        getModuleInfo
      })
      
      expect(result.dynamicTargets.has('/src/lazy/Tooltip.vue')).toBe(true)
      expect(result.visitedModules.has('/src/App.vue')).toBe(true)
      expect(result.visitedModules.has('/src/components/Header.vue')).toBe(true)
      expect(result.visitedModules.has('/src/utils/format.ts')).toBe(true)
    })

    it('should skip node_modules in static imports', () => {
      moduleGraph.set('/src/App.vue', [
        '/node_modules/vue/index.js',
        '/src/components/Header.vue'
      ])
      
      const result = walkModuleGraph({
        entryModuleId: '/src/App.vue',
        dynamicImportsByFile,
        iocDepsByFile,
        depIdToDynamicImport,
        getModuleInfo
      })
      
      expect(result.visitedModules.has('/src/App.vue')).toBe(true)
      expect(result.visitedModules.has('/src/components/Header.vue')).toBe(true)
      expect(result.visitedModules.has('/node_modules/vue/index.js')).toBe(false)
    })

    it('should collect IoC dynamic dependencies', () => {
      iocDepsByFile['/src/views/Home.vue'] = ['DEPS.DateTime', 'DEPS.UserService']
      depIdToDynamicImport['DEPS.DateTime'] = '/src/services/DateTime.ts'
      // DEPS.UserService is not in depIdToDynamicImport (static dependency)
      
      const result = walkModuleGraph({
        entryModuleId: '/src/views/Home.vue',
        dynamicImportsByFile,
        iocDepsByFile,
        depIdToDynamicImport,
        getModuleInfo
      })
      
      expect(result.dynamicTargets.has('/src/services/DateTime.ts')).toBe(true)
      expect(result.dynamicTargets.size).toBe(1) // Only dynamic IoC deps
    })

    it('should handle circular dependencies', () => {
      moduleGraph.set('/src/A.vue', ['/src/B.vue'])
      moduleGraph.set('/src/B.vue', ['/src/A.vue']) // circular!
      
      const result = walkModuleGraph({
        entryModuleId: '/src/A.vue',
        dynamicImportsByFile,
        iocDepsByFile,
        depIdToDynamicImport,
        getModuleInfo
      })
      
      // Should not hang or crash
      expect(result.visitedModules.has('/src/A.vue')).toBe(true)
      expect(result.visitedModules.has('/src/B.vue')).toBe(true)
      expect(result.visitedModules.size).toBe(2)
    })

    it('should traverse into dynamic imports', () => {
      dynamicImportsByFile.set('/src/App.vue', new Set(['/src/LazyComponent.vue']))
      dynamicImportsByFile.set('/src/LazyComponent.vue', new Set(['/src/NestedLazy.vue']))
      
      const result = walkModuleGraph({
        entryModuleId: '/src/App.vue',
        dynamicImportsByFile,
        iocDepsByFile,
        depIdToDynamicImport,
        getModuleInfo
      })
      
      expect(result.dynamicTargets.has('/src/LazyComponent.vue')).toBe(true)
      expect(result.dynamicTargets.has('/src/NestedLazy.vue')).toBe(true)
    })
  })

  describe('buildRouteDepsFromGraph', () => {
    it('should build deps map for multiple routes', () => {
      const routes: ParsedRoute[] = [
        { path: '/', fullPath: '/', entryModuleId: '/src/views/Home.vue', isDynamic: true },
        { path: '/about', fullPath: '/about', entryModuleId: '/src/views/About.vue', isDynamic: true }
      ]
      
      const dynamicImportsByFile: DynamicImportsByFile = new Map([
        ['/src/views/Home.vue', new Set(['/src/components/Banner.vue'])],
        ['/src/views/About.vue', new Set(['/src/components/Team.vue'])]
      ])
      
      const result = buildRouteDepsFromGraph(
        routes,
        dynamicImportsByFile,
        {},
        {},
        () => null
      )
      
      expect(result.get('/')?.has('/src/views/Home.vue')).toBe(true)
      expect(result.get('/')?.has('/src/components/Banner.vue')).toBe(true)
      
      expect(result.get('/about')?.has('/src/views/About.vue')).toBe(true)
      expect(result.get('/about')?.has('/src/components/Team.vue')).toBe(true)
    })

    it('should handle routes without entry module', () => {
      const routes: ParsedRoute[] = [
        { path: '/', fullPath: '/', entryModuleId: null, isDynamic: false }
      ]
      
      const result = buildRouteDepsFromGraph(
        routes,
        new Map(),
        {},
        {},
        () => null
      )
      
      expect(result.get('/')?.size).toBe(0)
    })
  })

  describe('mapModulesToChunks', () => {
    it('should map modules to chunk file names', () => {
      const routeModuleDeps = new Map([
        ['/', new Set(['/src/views/Home.vue', '/src/components/Banner.vue'])]
      ])
      
      const chunkByModule = new Map([
        ['/src/views/Home.vue', 'assets/Home-abc123.js'],
        ['/src/components/Banner.vue', 'assets/Banner-def456.js']
      ])
      
      const cssByChunk = new Map<string, Set<string>>()
      
      const result = mapModulesToChunks(routeModuleDeps, chunkByModule, cssByChunk)
      
      expect(result['/']).toContain('assets/Home-abc123.js')
      expect(result['/']).toContain('assets/Banner-def456.js')
    })

    it('should include CSS files associated with chunks', () => {
      const routeModuleDeps = new Map([
        ['/', new Set(['/src/views/Home.vue'])]
      ])
      
      const chunkByModule = new Map([
        ['/src/views/Home.vue', 'assets/Home-abc123.js']
      ])
      
      const cssByChunk = new Map([
        ['assets/Home-abc123.js', new Set(['assets/Home-abc123.css'])]
      ])
      
      const result = mapModulesToChunks(routeModuleDeps, chunkByModule, cssByChunk)
      
      expect(result['/']).toContain('assets/Home-abc123.js')
      expect(result['/']).toContain('assets/Home-abc123.css')
    })

    it('should skip modules without corresponding chunks', () => {
      const routeModuleDeps = new Map([
        ['/', new Set(['/src/views/Home.vue', '/src/inline-module.ts'])]
      ])
      
      const chunkByModule = new Map([
        ['/src/views/Home.vue', 'assets/Home-abc123.js']
        // /src/inline-module.ts is inlined, no separate chunk
      ])
      
      const result = mapModulesToChunks(routeModuleDeps, chunkByModule, new Map())
      
      expect(result['/'].length).toBe(1)
      expect(result['/']).toContain('assets/Home-abc123.js')
    })

    it('should sort chunks for consistent output', () => {
      const routeModuleDeps = new Map([
        ['/', new Set(['/src/A.vue', '/src/B.vue', '/src/C.vue'])]
      ])
      
      const chunkByModule = new Map([
        ['/src/C.vue', 'assets/C.js'],
        ['/src/A.vue', 'assets/A.js'],
        ['/src/B.vue', 'assets/B.js']
      ])
      
      const result = mapModulesToChunks(routeModuleDeps, chunkByModule, new Map())
      
      // Should be sorted
      expect(result['/']).toEqual(['assets/A.js', 'assets/B.js', 'assets/C.js'])
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete route with dynamic imports and IoC deps', () => {
      // Setup: /about route imports About.vue which has dynamic import to TestComponent
      // and IoC dependency on DEPS.First (dynamic)
      
      const routes: ParsedRoute[] = [
        { path: '/about', fullPath: '/about', entryModuleId: '/src/views/About.vue', isDynamic: true }
      ]
      
      const dynamicImportsByFile: DynamicImportsByFile = new Map([
        ['/src/views/About.vue', new Set(['/src/components/TestComponent.vue'])]
      ])
      
      const iocDepsByFile: IocDepsByFile = {
        '/src/views/About.vue': ['DEPS.DateTime', 'DEPS.First']
      }
      
      const depIdToDynamicImport: DepIdToDynamicImport = {
        'DEPS.First': '/src/services/FirstService.ts'
        // DEPS.DateTime is static (not in map)
      }
      
      const moduleGraph = new Map([
        ['/src/views/About.vue', ['/src/utils/helpers.ts']],
        ['/src/utils/helpers.ts', []]
      ])
      
      const chunkByModule = new Map([
        ['/src/views/About.vue', 'assets/About-abc.js'],
        ['/src/components/TestComponent.vue', 'assets/TestComponent-def.js'],
        ['/src/services/FirstService.ts', 'assets/FirstService-ghi.js']
      ])
      
      const cssByChunk = new Map([
        ['assets/About-abc.js', new Set(['assets/About-abc.css'])]
      ])
      
      // Build deps
      const routeModuleDeps = buildRouteDepsFromGraph(
        routes,
        dynamicImportsByFile,
        iocDepsByFile,
        depIdToDynamicImport,
        (id) => {
          const imports = moduleGraph.get(id)
          return imports ? { importedIds: imports } : null
        }
      )
      
      // Map to chunks
      const result = mapModulesToChunks(routeModuleDeps, chunkByModule, cssByChunk)
      
      // Verify
      expect(result['/about']).toContain('assets/About-abc.js')
      expect(result['/about']).toContain('assets/About-abc.css')
      expect(result['/about']).toContain('assets/TestComponent-def.js')
      expect(result['/about']).toContain('assets/FirstService-ghi.js')
    })

    it('should handle empty routes', () => {
      const routes: ParsedRoute[] = [
        { path: '/', fullPath: '/', entryModuleId: '/src/views/Home.vue', isDynamic: true }
      ]
      
      // Home.vue has no dynamic imports, no IoC deps
      const routeModuleDeps = buildRouteDepsFromGraph(
        routes,
        new Map(),
        {},
        {},
        () => null
      )
      
      const chunkByModule = new Map([
        ['/src/views/Home.vue', 'assets/Home.js']
      ])
      
      const result = mapModulesToChunks(routeModuleDeps, chunkByModule, new Map())
      
      // Should still include the entry module chunk
      expect(result['/']).toContain('assets/Home.js')
      expect(result['/'].length).toBe(1)
    })
  })

  describe('collectDynamicImports', () => {
    async function testCollectDynamicImports(code: string): Promise<Set<string>> {
      const ast = parseCode(code)
      const resolve = vi.fn().mockImplementation(async (source: string) => ({ id: source }))
      
      return collectDynamicImports({
        code,
        id: '/test/file.ts',
        ast,
        resolve
      })
    }

    it('should collect simple dynamic import', async () => {
      const code = `const Component = () => import('./Component.vue')`
      const result = await testCollectDynamicImports(code)
      
      expect(result.has('./Component.vue')).toBe(true)
    })

    it('should collect multiple dynamic imports', async () => {
      const code = `
        const A = () => import('./A.vue')
        const B = () => import('./B.vue')
        const C = () => import('./C.vue')
      `
      const result = await testCollectDynamicImports(code)
      
      expect(result.size).toBe(3)
      expect(result.has('./A.vue')).toBe(true)
      expect(result.has('./B.vue')).toBe(true)
      expect(result.has('./C.vue')).toBe(true)
    })

    it('should collect defineAsyncComponent imports', async () => {
      const code = `
        const LazyComponent = defineAsyncComponent(() => import('./LazyComponent.vue'))
      `
      const result = await testCollectDynamicImports(code)
      
      expect(result.has('./LazyComponent.vue')).toBe(true)
    })

    it('should collect imports with template literals', async () => {
      const code = 'const Component = () => import(`./Component.vue`)'
      const result = await testCollectDynamicImports(code)
      
      expect(result.has('./Component.vue')).toBe(true)
    })

    it('should handle empty code', async () => {
      const code = `const x = 1`
      const result = await testCollectDynamicImports(code)
      
      expect(result.size).toBe(0)
    })

    it('should NOT collect static imports', async () => {
      const code = `
        import Component from './Component.vue'
        import { ref } from 'vue'
      `
      const result = await testCollectDynamicImports(code)
      
      expect(result.size).toBe(0)
    })
  })

  describe('parseIocMaps regex extraction', () => {
    // Test the regex-based extraction logic
    it('should extract DEPS.X with dynamic import', () => {
      const code = `
        export const deps = {
          [DEPS.First]: () => import('@/services/firstService'),
          [DEPS.Second]: SomeStaticClass
        }
      `
      
      // We test the logic indirectly through the pattern
      const depsKeyPattern = /\[(\w*DEPS\w*)\.(\w+)\]\s*:/g
      const matches: string[] = []
      
      let match
      while ((match = depsKeyPattern.exec(code)) !== null) {
        matches.push(`${match[1]}.${match[2]}`)
      }
      
      expect(matches).toContain('DEPS.First')
      expect(matches).toContain('DEPS.Second')
    })

    it('should find import() in multi-line entries', () => {
      const code = `
        [DEPS.AlertQuery]: queryDynamicImport(
          DEPS.AlertQuery,
          AlertQuery,
          () => import('@/ui/interactiveQuery/alertQuery.handler')
        ),
      `
      
      const importMatch = code.match(/import\s*\(\s*['"\`]([^'"\`]+)['"\`]\s*\)/)
      
      expect(importMatch).not.toBeNull()
      expect(importMatch![1]).toBe('@/ui/interactiveQuery/alertQuery.handler')
    })

    it('should find import in loader pattern', () => {
      const code = `[DEPS.Service]: { loader: () => import('@/services/myService') }`
      
      const importMatch = code.match(/import\s*\(\s*['"\`]([^'"\`]+)['"\`]\s*\)/)
      
      expect(importMatch).not.toBeNull()
      expect(importMatch![1]).toBe('@/services/myService')
    })

    it('should NOT find import in static deps', () => {
      const code = `[DEPS.Static]: SomeClass`
      
      const importMatch = code.match(/import\s*\(\s*['"\`]([^'"\`]+)['"\`]\s*\)/)
      
      expect(importMatch).toBeNull()
    })
  })

  describe('parseRouter - buildFullPath', () => {
    it('should return absolute path as-is', () => {
      expect(buildFullPath('/parent', '/about')).toBe('/about')
    })

    it('should combine parent and child paths', () => {
      expect(buildFullPath('/parent', 'child')).toBe('/parent/child')
    })

    it('should handle root parent path', () => {
      expect(buildFullPath('/', 'about')).toBe('/about')
    })

    it('should handle empty parent path', () => {
      expect(buildFullPath('', 'about')).toBe('/about')
    })

    it('should handle nested paths', () => {
      expect(buildFullPath('/admin/users', 'edit')).toBe('/admin/users/edit')
    })
  })

  describe('parseRouter - findDynamicImport', () => {
    it('should find simple dynamic import', () => {
      const code = `() => import('./Component.vue')`
      const ast = parseCode(code)
      
      const result = findDynamicImport(ast, code)
      
      expect(result).toBe('./Component.vue')
    })

    it('should find import wrapped in arrow function', () => {
      const code = `() => import('@/views/Home.vue')`
      const ast = parseCode(code)
      
      const result = findDynamicImport(ast, code)
      
      expect(result).toBe('@/views/Home.vue')
    })

    it('should find import in loadView wrapper', () => {
      const code = `loadView(() => import('@/views/About.vue'))`
      const ast = parseCode(code)
      
      const result = findDynamicImport(ast, code)
      
      expect(result).toBe('@/views/About.vue')
    })

    it('should find import in defineAsyncComponent', () => {
      const code = `defineAsyncComponent(() => import('./LazyComponent.vue'))`
      const ast = parseCode(code)
      
      const result = findDynamicImport(ast, code)
      
      expect(result).toBe('./LazyComponent.vue')
    })

    it('should find import with template literal', () => {
      const code = 'loadView(() => import(`@/views/Movies.vue`))'
      const ast = parseCode(code)
      
      const result = findDynamicImport(ast, code)
      
      expect(result).toBe('@/views/Movies.vue')
    })

    it('should return null for static identifier', () => {
      const code = `HomeView`
      const ast = parseCode(code)
      
      const result = findDynamicImport(ast, code)
      
      expect(result).toBeNull()
    })

    it('should return null for non-import call', () => {
      const code = `someFunction('./path')`
      const ast = parseCode(code)
      
      const result = findDynamicImport(ast, code)
      
      expect(result).toBeNull()
    })
  })
})

