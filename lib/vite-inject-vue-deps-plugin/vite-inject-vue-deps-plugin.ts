import type { Plugin } from 'vite'
import MagicString from 'magic-string'
import { walk } from 'estree-walker'
import { relative } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import type {
  Node,
  Program,
  ImportDeclaration,
  Identifier,
} from 'estree'

// AST node types with position info (parsers add start/end properties)
type ASTNode = Node & { start: number; end: number; [key: string]: any }
type ASTProgram = Program & { start: number; end: number; body: ASTNode[] }
type ASTImportDeclaration = ImportDeclaration & {
  start: number
  end: number
  specifiers: ASTNode[]
}
type ASTIdentifier = Identifier & { start: number; end: number; name: string }

const  PluginName = 'vite-inject-vue-deps-plugin'

export type DIPluginOptions = {
  loadFnImport: { from: string; name: string }
  getHooksFnImport: { from: string; name: string }
  devTelemetry?: boolean
}

const DEFAULTS: Required<Pick<DIPluginOptions, 'devTelemetry'>> = { devTelemetry: false }

// ---------- IoC deps graph (for vite-chunks-map-plugin) ----------
const VIRTUAL_IOC_DEPS_ID = 'virtual:ioc-deps-graph'
const RESOLVED_VIRTUAL_IOC_DEPS_ID = '\0' + VIRTUAL_IOC_DEPS_ID

/** Stores collected DEPS.* identifiers per module (absolute path) */
const fileIocDeps = new Map<string /* moduleId */, Set<string /* depSymbolString */>>()

/** Get collected IoC dependencies map (for external use) */
export function getFileIocDeps(): Map<string, Set<string>> {
  return fileIocDeps
}

// ---------- import helpers ----------
function isImportFrom(node: ASTNode, from: string): boolean {
  return (
    node.type === 'ImportDeclaration' &&
    node.source?.type === 'Literal' &&
    node.source.value === from
  )
}

function ensureVueImports(
  s: MagicString,
  ast: ASTProgram,
  shouldBeRemoved: string[],
  shouldBeAdded: string[] = []
) {
  const toRemove = new Set(shouldBeRemoved || [])
  const toAdd = new Set(shouldBeAdded || [])

  for (const n of ast.body) {
    if (n.type !== 'ImportDeclaration') continue
    if (!isImportFrom(n, 'vue')) continue

    const imp = n as ASTImportDeclaration
    const defaultSpec = (imp.specifiers || []).find(
      (sp: any) => sp.type === 'ImportDefaultSpecifier'
    )
    const namespaceSpec = (imp.specifiers || []).find(
      (sp: any) => sp.type === 'ImportNamespaceSpecifier'
    )
    const namedSpecs = (imp.specifiers || []).filter((sp: any) => sp.type === 'ImportSpecifier')

    // Build remaining named specifiers, excluding those slated for removal (by imported name)
    const remainingNamedStrings: string[] = []
    let hadRemovals = false
    for (const sp of namedSpecs) {
      const isp = sp as any
      if (isp.imported?.type === 'Identifier') {
        const importedName = (isp.imported as ASTIdentifier).name
        const localName = isp.local?.name

        // Build the full import name with the alias
        const fullName =
          localName && localName !== importedName ? `${importedName} as ${localName}` : importedName

        if (toRemove.has(importedName)) {
          hadRemovals = true
          continue
        }

        // Remove from the list to add, if already exists
        toAdd.delete(fullName)
        toAdd.delete(importedName)

        remainingNamedStrings.push(fullName)
      }
    }

    if (!hadRemovals && toAdd.size === 0) continue

    // Add missing imports (only once, to the first processed import)
    const allNamedStrings = [...remainingNamedStrings, ...Array.from(toAdd)]

    // Clear toAdd, to not add imports again to other import from 'vue'
    toAdd.clear()

    // Reconstruct the import preserving default/namespace parts
    const parts: string[] = []
    if (defaultSpec) {
      const name = (defaultSpec as any).local?.name
      if (name) parts.push(name)
    }
    if (namespaceSpec) {
      const name = (namespaceSpec as any).local?.name
      if (name) parts.push(`* as ${name}`)
    }
    if (allNamedStrings.length > 0) {
      parts.push(`{ ${allNamedStrings.join(', ')} }`)
    }

    if (parts.length === 0) {
      // No specifiers left — remove whole import including trailing newline
      let endPos = imp.end
      const code = s.original
      // Remove the newline after the import, to not leave an empty line
      if (code[endPos] === '\r') {
        endPos++
        if (code[endPos] === '\n') endPos++ // for \r\n
      } else if (code[endPos] === '\n') {
        endPos++
      }
      s.remove(imp.start, endPos)
    } else {
      const newImport = `import ${parts.join(', ')} from 'vue';`
      s.overwrite(imp.start, imp.end, newImport)
    }
  }
}

function ensureOneNamedImport(s: MagicString, ast: ASTProgram, from: string, name: string) {
  for (const n of ast.body) {
    if (n.type !== 'ImportDeclaration') break
    if (isImportFrom(n, from)) {
      for (const sp of (n as ASTImportDeclaration).specifiers || []) {
        if (
          sp.type === 'ImportSpecifier' &&
          sp.imported?.type === 'Identifier' &&
          (sp.imported as ASTIdentifier).name === name
        )
          return
      }
    }
  }

  const code = s.toString()
  const needsLeadingNewline = code.length > 0 && code[code.length - 1] !== '\n'
  const statement = `${needsLeadingNewline ? '\n' : ''}import { ${name} } from '${from}';\n`
  s.append(statement)
}

// ---------- defineOptions helpers ----------
function hasDepsAlready(ast: ASTProgram, mainId: string): boolean {
  let found = false
  walk(ast, {
    enter(n: Node) {
      if (
        n.type === 'CallExpression' &&
        n.callee?.type === 'MemberExpression' &&
        n.callee.object?.type === 'Identifier' &&
        n.callee.object.name === 'Object' &&
        n.callee.property?.type === 'Identifier' &&
        n.callee.property.name === 'assign'
      ) {
        const [target, src] = n.arguments || []
        if (
          target?.type === 'Identifier' &&
          target.name === mainId &&
          src?.type === 'ObjectExpression'
        ) {
          for (const p of src.properties || []) {
            if (p.type === 'Property') {
              const key = p.key.type === 'Identifier' ? p.key.name : String((p.key as any).value)
              if (key === 'deps') {
                found = true
                this.skip()
                break
              }
            }
          }
        }
      }
    }
  })
  return found
}

/** Finds local names, under which defineDeps is available (takes into account alias). */
function collectLocalDefineDepsNames(ast: ASTProgram): Set<string> {
  const names = new Set<string>()
  for (const n of ast.body) {
    if (n.type !== 'ImportDeclaration') continue
    for (const sp of n.specifiers || []) {
      if (
        sp.type === 'ImportSpecifier' &&
        sp.imported?.type === 'Identifier' &&
        sp.imported.name === 'defineDeps'
      ) {
        names.add(sp.local?.name || 'defineDeps')
      }
    }
  }
  // fallback case (if the call without import ended up in the build)
  names.add('defineDeps')
  return names
}

function injectDepsFromDefineDepsPost(
  code: string,
  id: string,
  ast: ASTProgram,
  mainId: string,
  ms: MagicString,
  allDepIds: Set<string>  // ✅ We use already collected depIds!
) {
  if (!mainId) return null

  // if deps already exist (through defineOptions), exit
  if (hasDepsAlready(ast, mainId)) return null

  // We use already collected depIds (no repeated pass through AST!)
  if (allDepIds.size === 0) return null

  // Form deps as an array from collected depIds
  const mergedExpr = `[${Array.from(allDepIds).join(', ')}]`

  // Insert Object.assign(_sfc_main, { deps: <mergedExpr> }) before export default,
  // to guarantee that deps are on __Inner after our further code.
  const snippet = `// [${PluginName}] deps injected\nObject.assign(${mainId}, { deps: ${mergedExpr} });\n`
  ms.append(snippet)
}

/** 
 * Transforms destructuring of defineDeps into indexed access for minimization
 * And collects all depIds (optimization - one pass through AST)
 */
function transformDefineDepsDestructuring(code: string, ast: ASTProgram, ms: MagicString): Set<string> {
  const localNames = collectLocalDefineDepsNames(ast)
  const transformations: Array<{ start: number; end: number; replacement: string }> = []
  const allDepIds = new Set<string>()  // Collect all depIds

  walk(ast, {
    enter(n: Node) {
      // We look for: const { prop1, prop2, ... } = defineDeps(...)
      // Transform everywhere where there is destructuring (ObjectPattern)
      if (n.type === 'VariableDeclaration' && n.declarations && n.declarations.length === 1) {
        const decl = n.declarations[0] as any

        // Check destructuring
        if (
          decl.id?.type === 'ObjectPattern' &&
          decl.init?.type === 'CallExpression' &&
          decl.init.callee?.type === 'Identifier' &&
          localNames.has(decl.init.callee.name)
        ) {
          const properties = decl.id.properties || []
          const arg = decl.init.arguments?.[0]

          // There should be an object with dependencies
          if (arg?.type === 'ObjectExpression') {
            const objProps = (arg as any).properties || []

            // Extract property names from destructuring
            const propNames: string[] = []
            const propAliases: string[] = []
            for (const prop of properties) {
              if (prop.type === 'Property' && prop.value?.type === 'Identifier') {
                propNames.push(prop.key?.name || prop.value.name)
                propAliases.push(prop.value.name)
              }
            }

            // Extract values (symbols) in the same order
            const symbolValues: string[] = []
            for (let idx = 0; idx < propNames.length; idx++) {
              const propName = propNames[idx]
              const propAlias = propAliases[idx]
              const objProp = objProps.find(
                (p: any) => p.key?.type === 'Identifier' && (p.key.name === propName || p.key.name === propAlias)
              )
              if (objProp && objProp.value) {
                const depId = code.slice(objProp.value.start, objProp.value.end)
                symbolValues.push(depId)
                allDepIds.add(depId)  // ✅ Collect depId
              }
            }

            // Generate transformed code in one line for sourcemaps
            if (propAliases.length > 0 && symbolValues.length === propAliases.length) {
              const tempVar = '__deps_' + Math.random().toString(36).substr(2, 9)
              const arrayArg = `[${symbolValues.join(', ')}]`

              // Everything in one line, to not shift sourcemaps
              let replacement = `const ${tempVar} = ${decl.init.callee.name}(${arrayArg}); `
              propAliases.forEach((name, idx) => {
                replacement += `const ${name} = ${tempVar}[${idx}]; `
              })

              // Save the transformation for later application
              const astNode = n as ASTNode
              transformations.push({
                start: astNode.start,
                end: astNode.end,
                replacement
              })
            }
          }
        }
      }

      // ✅ Collect depIds from ALL other calls of defineDeps (without transformation)
      if (
        n.type === 'CallExpression' &&
        n.callee?.type === 'Identifier' &&
        localNames.has(n.callee.name)
      ) {
        // Check that this is NOT the same call from ObjectPattern above
        const parent = (n as any).__parent
        const isDestructured = parent?.type === 'VariableDeclarator' && parent.id?.type === 'ObjectPattern'
        
        if (!isDestructured) {
          const arg0 = n.arguments?.[0]
          if (arg0?.type === 'ObjectExpression') {
            // Collect depIds from the object
            const objProps = (arg0 as any).properties || []
            for (const prop of objProps) {
              if (prop.type === 'Property' && prop.value) {
                const depId = code.slice(prop.value.start, prop.value.end)
                allDepIds.add(depId)
              }
            }
          } else if (arg0?.type === 'ArrayExpression') {
            // Collect depIds from the array
            const elements = (arg0 as any).elements || []
            for (const el of elements) {
              if (el) {
                const depId = code.slice(el.start, el.end)
                allDepIds.add(depId)
              }
            }
          }
        }
      }
    }
  })

  // Apply transformations in reverse order (from end to start)
  transformations
    .sort((a, b) => b.start - a.start)
    .forEach((t) => {
      ms.overwrite(t.start, t.end, t.replacement)
    })

  return allDepIds
}

/** 
 * Transforms destructuring of context.deps into indexed access for minimization
 * One pass through AST (optimization!)
 * Returns collected depIds (e.g. "DEPS.DateTime", "DEPS.First")
 */
function transformContextDepsDestructuring(code: string, ast: ASTProgram, ms: MagicString): Set<string> {
  const transformations: Array<{ start: number; end: number; replacement: string }> = []
  let depsObjectPropNames: string[] = []
  const allDepIds = new Set<string>()  // Collect all depIds

  // One pass - we seek the deps object AND destructuring of context.deps
  walk(ast, {
    enter(n: Node) {
      // 1) We seek: defineComponent({ deps: { ... } })
      if (n.type === 'CallExpression' && isDefineComponentCall(n)) {
        const arg0 = (n as any).arguments?.[0]
        if (arg0?.type === 'ObjectExpression') {
          const depsProperty = arg0.properties?.find(
            (p: any) => p.type === 'Property' && p.key?.name === 'deps'
          )
          if (depsProperty && depsProperty.value?.type === 'ObjectExpression') {
            // Extract names and values from the deps object
            const depsProps = depsProperty.value.properties || []
            const propNames: string[] = []
            const symbolValues: string[] = []

            for (const prop of depsProps) {
              if (prop.type === 'Property' && prop.key?.type === 'Identifier') {
                propNames.push(prop.key.name)
                const depId = code.slice(prop.value.start, prop.value.end)
                symbolValues.push(depId)
                allDepIds.add(depId)  // ✅ Collect depId
              }
            }

            if (propNames.length > 0) {
              depsObjectPropNames = propNames // Save the order for destructuring

              // Transform the deps object into an array
              const arrayValue = `[${symbolValues.join(', ')}]`
              transformations.push({
                start: depsProperty.value.start,
                end: depsProperty.value.end,
                replacement: arrayValue
              })
            }
          }
        }
      }

      // 2) We seek: const { prop1, prop2, ... } = context.deps or ctx.deps
      if (n.type === 'VariableDeclaration' && n.declarations && n.declarations.length === 1) {
        const decl = n.declarations[0] as any

        // Check destructuring from context.deps
        if (
          decl.id?.type === 'ObjectPattern' &&
          decl.init?.type === 'MemberExpression' &&
          decl.init.property?.type === 'Identifier' &&
          decl.init.property.name === 'deps'
        ) {
          const properties = decl.id.properties || []

          // Extract property names from destructuring
          const propNames: string[] = []
          for (const prop of properties) {
            if (prop.type === 'Property' && prop.value?.type === 'Identifier') {
              propNames.push(prop.value.name)
            }
          }

          // Generate transformed code using the order from the deps object
          if (propNames.length > 0 && depsObjectPropNames.length > 0) {
            const contextExpr = code.slice(decl.init.object.start, decl.init.object.end)

            let replacement = ''
            propNames.forEach((name) => {
              // Find the index in the original order of the deps object
              const idx = depsObjectPropNames.indexOf(name)
              if (idx !== -1) {
                replacement += `const ${name} = ${contextExpr}.deps[${idx}];\n`
              }
            })

            // Save the transformation for later application
            const astNode = n as ASTNode
            transformations.push({
              start: astNode.start,
              end: astNode.end,
              replacement
            })
          }
        }
      }
    }
  })

  // Apply transformations in reverse order (from end to start)
  transformations
    .sort((a, b) => b.start - a.start)
    .forEach((t) => {
      ms.overwrite(t.start, t.end, t.replacement)
    })

  return allDepIds
}

// ---------- locators ----------
/** determine if the node is a call to defineComponent/_defineComponent (sometimes with /* @__PURE__ *\/) */
function isDefineComponentCall(n: any): boolean {
  if (!n || n.type !== 'CallExpression') return false

  const isId = (x: any) =>
    x && x.type === 'Identifier' && (x.name === 'defineComponent' || x.name === '_defineComponent')

  if (isId(n.callee)) return true

  // variant with SequenceExpression: /* @__PURE__ */ _defineComponent(...)
  if (n.callee.type === 'SequenceExpression') {
    return n.callee.expressions.some(isId)
  }
  return false
}

function getExportComponentName(
  ast: ASTProgram,
  code: string,
  ms: MagicString,
  defName = '_di_comp'
): string | null {
  // collect taken names at the top level (for unique name)
  const taken = new Set<string>()
  for (const n of ast.body) {
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) {
        if (d.id?.type === 'Identifier') taken.add(d.id.name)
      }
    } else if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) {
      taken.add(n.id.name)
    } else if (n.type === 'ExportDefaultDeclaration' && n.declaration.type === 'Identifier') {
      taken.add(n.declaration.name)
    }
  }
  const makeUnique = (base: string) => {
    let name = base,
      i = 1
    while (taken.has(name)) name = `${base}_${i++}`
    taken.add(name)
    return name
  }

  let compName: string | null = null
  let defaultExportNode: any | null = null

  // 1) try to find the declaration of the variable = defineComponent(...)
  walk(ast as any, {
    enter(n: any, parent: any) {
      // only top-level declarations are interesting
      if (parent?.type !== 'Program') return

      if (n.type === 'VariableDeclaration') {
        for (const d of n.declarations) {
          if (
            d.type === 'VariableDeclarator' &&
            d.id?.type === 'Identifier' &&
            isDefineComponentCall(d.init)
          ) {
            compName = d.id.name
            this.skip()
            return
          }
        }
      }
      if (n.type === 'ExportDefaultDeclaration') {
        defaultExportNode = n
      }
    }
  })
  // 2) if we didn't find the variable name, look at export default
  if (!compName && defaultExportNode) {
    const decl = defaultExportNode.declaration

    // export default _sfc_main;
    if (decl.type === 'Identifier') {
      compName = decl.name
    } else if (decl.type === 'CallExpression' && isDefineComponentCall(decl)) {
      // export default defineComponent({...})  →  const __di_comp = defineComponent({...}); export default __di_comp;
      const name = makeUnique(defName)
      const start = defaultExportNode.start!
      const end = defaultExportNode.end!
      const defExpr = code.slice(decl.start!, decl.end!)
      const replacement = `const ${name} = ${defExpr};\nexport default ${name};`
      ms.overwrite(start, end, replacement)
      compName = name
    } else {
      // just in case: export default { ... }  (unlikely after plugin-vue, but support)
      const name = makeUnique('__di_comp')
      const start = defaultExportNode.start!
      const end = defaultExportNode.end!
      const defExpr = code.slice(decl.start!, decl.end!)
      const replacement = `const ${name} = ${defExpr};\nexport default ${name};`
      ms.overwrite(start, end, replacement)
      compName = name
    }
  }

  // 3) fallback — soft regex on «export default IDENT»
  if (!compName) {
    const m = code.match(/\bexport\s+default\s+([A-Za-z$_][\w$]*)\s*;?/)
    if (m) compName = m[1]
  }

  return compName
}

function buildMainSetupPatch(mainId: string): string {
  return `\n// ${PluginName} patch setup to inject deps (sync wrapper)
let onBeforeMount, onMounted, onBeforeUpdate, onUpdated, onBeforeUnmount, onUnmounted, onActivated,
    onDeactivated, onRenderTriggered, onRenderTracked, onErrorCaptured, register;

${mainId}.__di_setup = ${mainId}.setup;
${mainId}.setup = function(props, ctx) {
  const ioc = __di_inject('_ioc');
  const deps = ${mainId}.deps;
  defineDeps = (d) => __diMaterialize(d ?? deps, ioc);
  const callOriginalSetup = (ctx) => ${mainId}.__di_setup?.call(this, props, ctx);
  if (__diAllBound(deps, ioc)) {
    const h = getOriginalHooks();
    onBeforeMount = h[0];
    onMounted = h[1];
    onBeforeUpdate = h[2];
    onUpdated = h[3];
    onBeforeUnmount = h[4];
    onUnmounted = h[5];
    onActivated = h[6];
    onDeactivated = h[7];
    onRenderTriggered = h[8];
    onRenderTracked = h[9];
    onErrorCaptured = h[10];
    const ctx2 = { ...ctx, deps: __diMaterialize(deps, ioc) };
    return callOriginalSetup(ctx2);
  }
  const instance = getCurrentInstance()
  let buf = {};
  const hooks = getHooks(buf);
  onBeforeMount = hooks[0];
  onMounted = hooks[1];
  onBeforeUpdate = hooks[2];
  onUpdated = hooks[3];
  onBeforeUnmount = hooks[4];
  onUnmounted = hooks[5];
  onActivated = hooks[6];
  onDeactivated = hooks[7];
  onRenderTriggered = hooks[8];
  onRenderTracked = hooks[9];
  onErrorCaptured = hooks[10];
  register = hooks[11];

  return __diEnsureReady(deps, ioc).then(() => {
    const ctx2 = { ...ctx, deps: __diMaterialize(deps, ioc) };
    const result = callOriginalSetup(ctx2);
    register(instance);
    return result;
  }).finally(() => {
    buf = null;
  }); 
};
\n`
}

// ---------- patch builders (to __Inner) ----------
function buildDiUtils(opts: DIPluginOptions) {
  return `\n// === [${PluginName} injected] ===
let defineDeps = null;

function __diAllBound(deps, ioc) {
  if(!deps || !ioc) return true;
  return Object.keys(deps).every(id => ioc.isBound(deps[id]))
}

async function __diEnsureReady(deps, ioc) {
  const ids = Object.values(deps).filter(id => !ioc.isBound(id))
  if(ids.length === 0) {
    return Promise.resolve()
  }
  return ${opts.loadFnImport.name}(ids, ioc)
}

function __diMaterialize(deps, ioc) {
  // If deps is an array, return an array
  if (Array.isArray(deps)) {
    return deps.map(id => ioc.get(id))
  }
  // If deps is an object, return an object
  const out = {}
  if(!deps || !ioc) return out;
  for (const k of Object.keys(deps)) {
    out[k] = ioc.get(deps[k])
  }
  return out
}
// === [/${PluginName} injected] ===\n`
}

// ---------- plugin ----------
export default function diVitePostPlugin(userOpts: DIPluginOptions): Plugin {
  const opts = { ...DEFAULTS, ...userOpts }

  // Store sourcemaps from transform for use in writeBundle
  const transformedSourceMaps = new Map<string, any>()

  // Define the build mode
  let isProduction = false

  return {
    name: 'vite-di-plugin-post',
    enforce: 'post',

    configResolved(config) {
      // Define the mode: production or dev
      // In the build mode we consider production (regardless of mode)
      isProduction = config.command === 'build'
    },

    // ---------- virtual:ioc-deps-graph module ----------
    resolveId(id) {
      if (id === VIRTUAL_IOC_DEPS_ID) {
        return RESOLVED_VIRTUAL_IOC_DEPS_ID
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_IOC_DEPS_ID) {
        // Convert Map<string, Set<string>> to Record<string, string[]>
        const result: Record<string, string[]> = {}
        for (const [moduleId, deps] of fileIocDeps) {
          result[moduleId] = Array.from(deps)
        }
        return `export const iocDepsByFile = ${JSON.stringify(result, null, 2)};`
      }
    },

    async transform(code, id) {
      // In production process .vue?type=script
      // In dev process simply .vue
      const isVueFile = id.includes('.vue')
      const isScriptPart = id.includes('type=script')
      const isDevVueFile = !isProduction && id.endsWith('.vue')
      const isProdScriptFile = isProduction && isVueFile && isScriptPart

      if (!isDevVueFile && !isProdScriptFile) {
        return null
      }

      if (code.includes(`// [${PluginName}] deps injected`)) {
        return null
      }

      // Define the type of using DI
      let scan = { kind: 'none' }
      if (code.includes('deps:')) {
        scan = { kind: 'options' }
      } else if (code.includes('defineDeps')) {
        scan = { kind: 'script-setup' }
      }

      if (scan.kind === 'none') {
        if (opts.devTelemetry) {
          this.warn(`[${PluginName}] skip ${id}: ${scan.kind}`)
        }
        return null
      }

      let ast: ASTProgram
      try {
        ast = this.parse(code) as ASTProgram
      } catch (e) {
        if (opts.devTelemetry) {
          this.warn(`[${PluginName}] parse error in ${id}: ${e}`)
        }
        return null
      }

      // Clear id from query parameters and make relative
      const cleanId = id.split('?')[0]
      const relativeId = cleanId.startsWith('/') ? relative(process.cwd(), cleanId) : cleanId

      // Get sourcemap from previous plugins for correct chaining
      const existingSourceMap = this.getCombinedSourcemap()

      // Create MagicString for transformation of code
      let s = new MagicString(code, {
        filename: relativeId
      })

      // 0) THE FIRST TRANSFORMATION: destructuring of dependencies for minimization
      // And collection of all depIds (one pass through AST!)
      let allDepIds = new Set<string>()
      if (scan.kind === 'script-setup') {
        const before = s.toString()
        allDepIds = transformDefineDepsDestructuring(code, ast, s)  // ✅ Get depIds
        const after = s.toString()
        if (before !== after) {
          // Re-parse transformed code to get correct positions
          const transformedCode = s.toString()
          try {
            ast = this.parse(transformedCode) as ASTProgram
            code = transformedCode // Update code for subsequent operations
            // ❗ Create NEW MagicString from transformedCode!
            s = new MagicString(code, { filename: relativeId })
          } catch (e) {
            if (opts.devTelemetry) {
              console.error(`[${PluginName}] Failed to re-parse after transformation:`, e)
            }
          }
          if (opts.devTelemetry) {
            this.warn(`[${PluginName}] transformed defineDeps destructuring in ${id}`)
          }
        }
      } else if (scan.kind === 'options') {
        const before = s.toString()
        allDepIds = transformContextDepsDestructuring(code, ast, s)  // ✅ Get depIds
        const after = s.toString()
        if (before !== after) {
          // Re-parse transformed code
          const transformedCode = s.toString()
          try {
            ast = this.parse(transformedCode) as ASTProgram
            code = transformedCode
            // ❗ Create NEW MagicString from transformedCode!
            s = new MagicString(code, { filename: relativeId })
          } catch (e) {
            if (opts.devTelemetry) {
              console.error(`[${PluginName}] Failed to re-parse after transformation:`, e)
            }
          }
          if (opts.devTelemetry) {
            this.warn(`[${PluginName}] transformed context.deps destructuring in ${id}`)
          }
        }
      }

      // ✅ Store collected depIds for ioc-deps-graph virtual module
      if (allDepIds.size > 0) {
        fileIocDeps.set(cleanId, allDepIds)
      }

      // 1) Cut the default export expression and get the component name
      // or replace export default defineComponent(...) with
      // const __di_comp = defineComponent(...); export default __di_comp;
      // Now ast and code are synchronized after transformation
      const compName = getExportComponentName(ast, code, s)
      if (!compName) {
        return null
      }

      // 2) Manage Vue imports: remove lifecycle hooks and add needed imports
      ensureVueImports(
        s,
        ast,
        [
          'onBeforeMount',
          'onMounted',
          'onBeforeUpdate',
          'onUpdated',
          'onBeforeUnmount',
          'onUnmounted',
          'onActivated',
          'onDeactivated',
          'onRenderTriggered',
          'onRenderTracked',
          'onErrorCaptured'
        ],
        ['inject as __di_inject', 'getCurrentInstance']
      )

      ensureOneNamedImport(s, ast, opts.loadFnImport.from, opts.loadFnImport.name)
      ensureOneNamedImport(s, ast, opts.getHooksFnImport.from, opts.getHooksFnImport.name)

      // 3) Add deps to the component in script setup (Object.assign(compName, { deps: [depId1, depId2, ...] }))
      if (scan.kind === 'script-setup') {
        injectDepsFromDefineDepsPost(code, id, ast, compName, s, allDepIds)
      }

      // 4) patch setup
      s.append(buildMainSetupPatch(compName))

      // 5) DI-utilities + patch __Inner.setup + wrapper
      // remove import { defineDeps [as alias]? } from '...'
      for (const n of ast.body) {
        if (n.type !== 'ImportDeclaration') continue

        const idx = ((n as ASTImportDeclaration).specifiers || []).findIndex(
          (sp: any) =>
            sp.type === 'ImportSpecifier' &&
            sp.imported?.type === 'Identifier' &&
            (sp.imported as ASTIdentifier).name === 'defineDeps'
        )
        if (idx === -1) continue

        if ((n as ASTImportDeclaration).specifiers.length === 1) {
          // Remove the whole import
          s.remove(n.start, n.end)
        } else {
          // Remove only the specifier and the comma next to it
          const sp = (n as ASTImportDeclaration).specifiers[idx]
          let cutStart = sp.start,
            cutEnd = sp.end
          const before = code.slice(cutStart - 2, cutStart)
          const after = code.slice(cutEnd, cutEnd + 2)
          if (/^\\s*,/.test(after)) cutEnd += 1
          else if (/,.?$/.test(before)) cutStart -= 1
          s.remove(cutStart, cutEnd)
        }
      }

      s.append(buildDiUtils(opts))

      const result = s.toString()

      // Generate sourcemap through MagicString, which tracks all our changes
      const ourMap = s.generateMap({
        source: existingSourceMap.sources[0] || relativeId,
        file: relativeId,
        hires: true,
        includeContent: true
      })

      // Replace sourcesContent with the original from Vue
      ourMap.sourcesContent = existingSourceMap.sourcesContent

      // In production save the original Vue sourcemap for writeBundle
      if (isProduction) {
        transformedSourceMaps.set(cleanId, {
          map: existingSourceMap, // Original from Vue
          relativeId: relativeId
        })

        return {
          code: result,
          map: null
        }
      }

      // Dev: return our sourcemap
      return {
        code: result,
        map: ourMap as any
      }
    },

    // generateBundle hook
    generateBundle(options, bundle) {
      if (!isProduction) return

      const filesToFix: Array<{ fileName: string; mapData: any }> = []

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          for (const moduleId of Object.keys(chunk.modules || {})) {
            const cleanModuleId = moduleId.split('?')[0]
            const savedMap = transformedSourceMaps.get(cleanModuleId)

            if (savedMap && savedMap.map?.sourcesContent?.length > 0) {
              filesToFix.push({
                fileName: fileName + '.map',
                mapData: savedMap
              })
              break
            }
          }
        }
      }

      ;(this as any)._filesToFix = filesToFix
    },

    // writeBundle hook - restore sources and sourcesContent
    writeBundle(options) {
      if (!isProduction) return

      const filesToFix = (this as any)._filesToFix || []
      if (filesToFix.length === 0) return

      const outDir = options.dir || 'dist'

      for (const { fileName, mapData } of filesToFix) {
        try {
          const mapPath = `${outDir}/${fileName}`
          const minifiedMap = JSON.parse(readFileSync(mapPath, 'utf-8'))

          // Restore sources and sourcesContent from Vue
          minifiedMap.sources = mapData.map.sources
          minifiedMap.sourcesContent = mapData.map.sourcesContent

          writeFileSync(mapPath, JSON.stringify(minifiedMap))
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }
}

// ========== Exports for testing and vite-chunks-map-plugin ==========
export {
  collectLocalDefineDepsNames,
  transformDefineDepsDestructuring,
  transformContextDepsDestructuring,
  hasDepsAlready,
  isDefineComponentCall,
  // Virtual module exports for vite-chunks-map-plugin
  VIRTUAL_IOC_DEPS_ID,
  RESOLVED_VIRTUAL_IOC_DEPS_ID
  // getFileIocDeps is already exported above as function declaration
}
