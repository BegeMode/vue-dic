import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { walk } from 'estree-walker'
import type { ParsedRoute } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ASTNode = any

interface ParseRouterOptions {
  routerDir: string
  rootDir: string
  parse: (code: string) => any
  resolve: (source: string, importer: string) => Promise<{ id: string } | null>
  devTelemetry?: boolean
}

interface StaticImport {
  localName: string
  source: string
  resolvedPath?: string
}

/**
 * Parse router files and extract route definitions
 */
export async function parseRouterFiles(options: ParseRouterOptions): Promise<{
  routes: ParsedRoute[]
  staticImports: Map<string, string>
}> {
  const { routerDir, rootDir, parse, resolve: resolveId, devTelemetry } = options
  
  const absoluteRouterDir = resolve(rootDir, routerDir)
  const routerFiles = findRouterFiles(absoluteRouterDir)
  
  const allRoutes: ParsedRoute[] = []
  const allStaticImports = new Map<string, string>()
  
  for (const filePath of routerFiles) {
    const code = readFileSync(filePath, 'utf-8')
    
    let ast: any
    try {
      ast = parse(code)
    } catch (e) {
      if (devTelemetry) {
        console.warn(`[vite-chunks-map-plugin] Failed to parse ${filePath}:`, e)
      }
      continue
    }
    
    // Collect static imports
    const staticImports = collectStaticImports(ast, code)
    
    // Resolve static import paths
    for (const imp of staticImports) {
      const resolved = await resolveId(imp.source, filePath)
      if (resolved) {
        imp.resolvedPath = resolved.id
        allStaticImports.set(imp.localName, resolved.id)
      }
    }
    
    // Find routes
    const routes = await extractRoutes(ast, code, filePath, staticImports, resolveId, devTelemetry)
    allRoutes.push(...routes)
  }
  
  return { routes: allRoutes, staticImports: allStaticImports }
}

/**
 * Find all TS/JS files in router directory
 */
function findRouterFiles(dir: string): string[] {
  const files: string[] = []
  
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      
      if (stat.isFile() && /\.(ts|js|tsx|jsx)$/.test(entry) && !entry.includes('.spec.') && !entry.includes('.test.')) {
        files.push(fullPath)
      }
    }
  } catch (e) {
    // Directory doesn't exist or not accessible
  }
  
  return files
}

/**
 * Collect static imports from AST
 */
function collectStaticImports(ast: any, code: string): StaticImport[] {
  const imports: StaticImport[] = []
  
  for (const node of ast.body || []) {
    if (node.type === 'ImportDeclaration') {
      const source = node.source?.value as string
      if (!source) continue
      
      for (const spec of node.specifiers || []) {
        if (spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportSpecifier') {
          imports.push({
            localName: spec.local?.name,
            source
          })
        }
      }
    }
  }
  
  return imports
}

/**
 * Extract routes from AST
 */
async function extractRoutes(
  ast: any,
  code: string,
  filePath: string,
  staticImports: StaticImport[],
  resolveId: (source: string, importer: string) => Promise<{ id: string } | null>,
  devTelemetry?: boolean
): Promise<ParsedRoute[]> {
  const routes: ParsedRoute[] = []
  
  walk(ast, {
    enter(node: ASTNode) {
      // Look for createRouter({ routes: [...] })
      if (node.type === 'CallExpression') {
        const n = node as ASTNode
        
        // Check if it's createRouter call
        if (n.callee?.type === 'Identifier' && n.callee.name === 'createRouter') {
          const arg0 = n.arguments?.[0]
          if (arg0?.type === 'ObjectExpression') {
            const routesProp = arg0.properties?.find(
              (p: any) => p.type === 'Property' && p.key?.name === 'routes'
            )
            if (routesProp?.value?.type === 'ArrayExpression') {
              // Process routes array
              processRoutesArray(routesProp.value, '', routes, code, staticImports)
            }
          }
        }
      }
    }
  })
  
  // Resolve dynamic imports in routes
  for (const route of routes) {
    if (route.isDynamic && route.entryModuleId) {
      // entryModuleId contains the raw import path, need to resolve it
      const resolved = await resolveId(route.entryModuleId, filePath)
      if (resolved) {
        route.entryModuleId = resolved.id
      }
    } else if (!route.isDynamic && route.componentIdentifier) {
      // Static import - find resolved path from staticImports
      const imp = staticImports.find(i => i.localName === route.componentIdentifier)
      if (imp?.resolvedPath) {
        route.entryModuleId = imp.resolvedPath
      }
    }
  }
  
  if (devTelemetry) {
    console.log(`[vite-chunks-map-plugin] Found ${routes.length} routes in ${filePath}`)
  }
  
  return routes
}

/**
 * Process routes array recursively
 */
function processRoutesArray(
  arrayNode: ASTNode,
  parentPath: string,
  routes: ParsedRoute[],
  code: string,
  staticImports: StaticImport[]
): void {
  for (const element of arrayNode.elements || []) {
    if (element?.type === 'ObjectExpression') {
      processRouteObject(element, parentPath, routes, code, staticImports)
    }
  }
}

/**
 * Process single route object
 */
function processRouteObject(
  routeNode: ASTNode,
  parentPath: string,
  routes: ParsedRoute[],
  code: string,
  staticImports: StaticImport[]
): void {
  let path = ''
  let componentNode: ASTNode | null = null
  let childrenNode: ASTNode | null = null
  
  for (const prop of routeNode.properties || []) {
    if (prop.type !== 'Property') continue
    
    const keyName = prop.key?.name || prop.key?.value
    
    if (keyName === 'path' && prop.value?.type === 'Literal') {
      path = prop.value.value as string
    } else if (keyName === 'component') {
      componentNode = prop.value
    } else if (keyName === 'children' && prop.value?.type === 'ArrayExpression') {
      childrenNode = prop.value
    }
  }
  
  // Build full path
  const fullPath = buildFullPath(parentPath, path)
  
  // Extract component info
  if (componentNode) {
    const componentInfo = extractComponentInfo(componentNode, code, staticImports)
    
    routes.push({
      path,
      fullPath,
      entryModuleId: componentInfo.importPath,
      isDynamic: componentInfo.isDynamic,
      componentIdentifier: componentInfo.identifier
    })
  }
  
  // Process children recursively
  if (childrenNode) {
    processRoutesArray(childrenNode, fullPath, routes, code, staticImports)
  }
}

/**
 * Build full path from parent and current path
 */
export function buildFullPath(parentPath: string, currentPath: string): string {
  if (currentPath.startsWith('/')) {
    return currentPath
  }
  
  if (!parentPath || parentPath === '/') {
    return '/' + currentPath
  }
  
  return parentPath + '/' + currentPath
}

/**
 * Extract component info from component value node
 */
function extractComponentInfo(
  node: ASTNode,
  code: string,
  staticImports: StaticImport[]
): { importPath: string | null; isDynamic: boolean; identifier?: string } {
  // Case 1: Static identifier (e.g., component: HomeView)
  if (node.type === 'Identifier') {
    return {
      importPath: null, // Will be resolved later from staticImports
      isDynamic: false,
      identifier: node.name
    }
  }
  
  // Case 2-4: Look for any import() call inside the value
  const importPath = findDynamicImport(node, code)
  if (importPath) {
    return {
      importPath,
      isDynamic: true
    }
  }
  
  // No import found
  return {
    importPath: null,
    isDynamic: false
  }
}

/**
 * Find dynamic import() call anywhere in the node tree
 * Handles: 
 *   - () => import('...')
 *   - loadView(() => import('...'))
 *   - loadView(() => new Promise(resolve => resolve(import('...'))))
 */
export function findDynamicImport(node: ASTNode, code: string): string | null {
  let importPath: string | null = null
  
  walk(node as any, {
    enter(n: ASTNode) {
      if (importPath) {
        this.skip()
        return
      }
      
      // Look for import() call expression
      if (n.type === 'ImportExpression' || 
          (n.type === 'CallExpression' && n.callee?.type === 'Import')) {
        const arg = n.source || n.arguments?.[0]
        if (arg?.type === 'Literal' && typeof arg.value === 'string') {
          importPath = arg.value
          this.skip()
        } else if (arg?.type === 'TemplateLiteral' && arg.quasis?.length === 1) {
          // Handle template literal without expressions: `@/ui/views/MovieList.vue`
          importPath = arg.quasis[0].value?.cooked || arg.quasis[0].value?.raw
          this.skip()
        }
      }
    }
  })
  
  return importPath
}
