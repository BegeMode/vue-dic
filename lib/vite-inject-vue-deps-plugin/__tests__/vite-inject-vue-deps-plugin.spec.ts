import { describe, it, expect } from 'vitest'
import MagicString from 'magic-string'
import { parse } from 'acorn'
import {
  collectLocalDefineDepsNames,
  transformDefineDepsDestructuring,
  transformContextDepsDestructuring,
  hasDepsAlready,
  isDefineComponentCall
} from '../vite-inject-vue-deps-plugin'

// Helper for parsing code into AST
function parseCode(code: string): any {
  // We use acorn (the same parser as Vite uses)
  // We return any, because acorn doesn't add start/end to Program
  const ast = parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true
  })
  
  return ast
}

describe('vite-di-plugin-post3', () => {
  describe('collectLocalDefineDepsNames', () => {
    it('should find import defineDeps', () => {
      const code = `import { defineDeps } from './defineComponent'`
      const ast = parseCode(code)
      const names = collectLocalDefineDepsNames(ast)
      
      expect(names.has('defineDeps')).toBe(true)
      expect(names.size).toBeGreaterThan(0)
    })

    it('should find import defineDeps with alias', () => {
      const code = `import { defineDeps as dd } from './defineComponent'`
      const ast = parseCode(code)
      const names = collectLocalDefineDepsNames(ast)
      
      expect(names.has('dd')).toBe(true)
    })

    it('should always add "defineDeps" as fallback', () => {
      const code = `const x = 1`
      const ast = parseCode(code)
      const names = collectLocalDefineDepsNames(ast)
      
      // Even if there is no import, there should be a default name
      expect(names.has('defineDeps')).toBe(true)
    })
  })

  describe('transformDefineDepsDestructuring', () => {
    it('should transform destructuring of defineDeps', () => {
      const code = `const { dateTimeService, firstService } = defineDeps({ dateTimeService: DEPS.DateTime, firstService: DEPS.First })`
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      const depIds = transformDefineDepsDestructuring(code, ast, ms)
      const result = ms.toString()
      
      // Check the transformation
      expect(result).toMatch(/const __deps_\w+ = defineDeps\(\[DEPS\.DateTime, DEPS\.First\]\);/)
      expect(result).toMatch(/const dateTimeService = __deps_\w+\[0\];/)
      expect(result).toMatch(/const firstService = __deps_\w+\[1\];/)
      
      // Check collected depIds
      expect(depIds.has('DEPS.DateTime')).toBe(true)
      expect(depIds.has('DEPS.First')).toBe(true)
      expect(depIds.size).toBe(2)
    })

    it('should transform destructuring with aliases', () => {
      const code = `const { dateTimeService: dt, firstService: fs } = defineDeps({ dateTimeService: DEPS.DateTime, firstService: DEPS.First })`
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      transformDefineDepsDestructuring(code, ast, ms)
      const result = ms.toString()
      
      expect(result).toMatch(/const dt = __deps_\w+\[0\];/)
      expect(result).toMatch(/const fs = __deps_\w+\[1\];/)
    })

    it('should transform nested calls of defineDeps', () => {
      const code = `
const { dateTimeService } = defineDeps({ dateTimeService: DEPS.DateTime })

const tomorrow = () => {
  const { dateTimeService: dtService } = defineDeps({ dateTimeService: DEPS.DateTime })
  return dtService.now()
}
`.trim()
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      transformDefineDepsDestructuring(code, ast, ms)
      const result = ms.toString()
      
      // Both calls should be transformed
      const matches = result.match(/const __deps_\w+ = defineDeps\(\[DEPS\.DateTime\]\);/g)
      expect(matches).toBeTruthy()
      expect(matches!.length).toBeGreaterThanOrEqual(2)
    })

    it('should not transform call without destructuring', () => {
      const code = `const deps = defineDeps({ dateTimeService: DEPS.DateTime })`
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      transformDefineDepsDestructuring(code, ast, ms)
      const result = ms.toString()
      
      // The code should remain unchanged
      expect(result).toBe(code)
    })

    it('should collect depIds from call without destructuring', () => {
      const code = `const deps = defineDeps({ dateTimeService: DEPS.DateTime, firstService: DEPS.First })`
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      const depIds = transformDefineDepsDestructuring(code, ast, ms)
      
      // depIds should be collected, even if the code is not transformed
      expect(depIds.has('DEPS.DateTime')).toBe(true)
      expect(depIds.has('DEPS.First')).toBe(true)
    })

    it('should collect depIds from array', () => {
      const code = `const deps = defineDeps([DEPS.DateTime, DEPS.First])`
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      const depIds = transformDefineDepsDestructuring(code, ast, ms)
      
      expect(depIds.has('DEPS.DateTime')).toBe(true)
      expect(depIds.has('DEPS.First')).toBe(true)
    })

    it('should handle complex cases with multiple calls', () => {
      const code = `
const { dateTimeService, firstService } = defineDeps({ 
  dateTimeService: DEPS.DateTime, 
  firstService: DEPS.First 
})

const tomorrow = () => {
  const { dateTimeService: dt } = defineDeps({ dateTimeService: DEPS.DateTime })
  return dt.now()
}

const deps = defineDeps({ secondService: DEPS.Second })

const add2days = () => {
  const d = defineDeps([DEPS.Third])
  return d
}
`.trim()
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      const depIds = transformDefineDepsDestructuring(code, ast, ms)
      
      // All unique depIds should be collected
      expect(depIds.has('DEPS.DateTime')).toBe(true)
      expect(depIds.has('DEPS.First')).toBe(true)
      expect(depIds.has('DEPS.Second')).toBe(true)
      expect(depIds.has('DEPS.Third')).toBe(true)
      expect(depIds.size).toBe(4)
    })
  })

  describe('transformContextDepsDestructuring (Options API)', () => {
    it('should collect depIds from inline deps object', () => {
      const code = `
export default defineComponent({
  deps: {
    dateTimeService: DEPS.DateTime,
    firstService: DEPS.First
  },
  setup(props, context) {
    const { deps } = context
  }
})
`.trim()
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      const depIds = transformContextDepsDestructuring(code, ast, ms)
      const result = ms.toString()
      
      // Code should NOT be transformed (deps stays as object for property access)
      expect(result).toBe(code)
      
      // But depIds should be collected
      expect(depIds.has('DEPS.DateTime')).toBe(true)
      expect(depIds.has('DEPS.First')).toBe(true)
      expect(depIds.size).toBe(2)
    })

    it('should collect depIds from shorthand deps property', () => {
      const code = `
const deps = {
  dateTimeService: DEPS.DateTime,
  moviesStore: DEPS.MoviesStore
}
export default defineComponent({
  deps,
  setup(props, context) {
    const { deps: deps2 } = context
  }
})
`.trim()
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      const depIds = transformContextDepsDestructuring(code, ast, ms)
      const result = ms.toString()
      
      // Code should NOT be transformed
      expect(result).toBe(code)
      
      // DepIds should be collected from the variable declaration
      expect(depIds.has('DEPS.DateTime')).toBe(true)
      expect(depIds.has('DEPS.MoviesStore')).toBe(true)
      expect(depIds.size).toBe(2)
    })

    it('should collect depIds from deps: depsVar pattern', () => {
      const code = `
const myDeps = {
  service1: DEPS.S1,
  service2: DEPS.S2
}
export default defineComponent({
  deps: myDeps,
  setup(props, ctx) {
    const { deps } = ctx
  }
})
`.trim()
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      const depIds = transformContextDepsDestructuring(code, ast, ms)
      
      expect(depIds.has('DEPS.S1')).toBe(true)
      expect(depIds.has('DEPS.S2')).toBe(true)
      expect(depIds.size).toBe(2)
    })

    it('should collect depIds from inline deps without destructuring', () => {
      const code = `
export default defineComponent({
  deps: {
    service1: DEPS.Service1,
    service2: DEPS.Service2
  }
})
`.trim()
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      const depIds = transformContextDepsDestructuring(code, ast, ms)
      const result = ms.toString()
      
      // Code should NOT be transformed
      expect(result).toBe(code)
      
      // DepIds should be collected
      expect(depIds.has('DEPS.Service1')).toBe(true)
      expect(depIds.has('DEPS.Service2')).toBe(true)
      expect(depIds.size).toBe(2)
    })

    it('should collect depIds when destructuring from context.deps (TestComponent pattern)', () => {
      // Real pattern from src/ui/components/test/TestComponent.vue
      const code = `
export default defineComponent({
  deps: {
    dateTimeService: DEPS.DateTime,
    firstService: DEPS.First
  },
  setup(_props, context) {
    const { dateTimeService, firstService } = context.deps
    return { dt: dateTimeService.now() }
  }
})
`.trim()
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      const depIds = transformContextDepsDestructuring(code, ast, ms)
      const result = ms.toString()
      
      // Code should NOT be transformed (deps stays as object)
      expect(result).toBe(code)
      
      // DepIds should be collected
      expect(depIds.has('DEPS.DateTime')).toBe(true)
      expect(depIds.has('DEPS.First')).toBe(true)
      expect(depIds.size).toBe(2)
    })

    it('should return empty set when no deps found', () => {
      const code = `
export default defineComponent({
  setup(props, ctx) {
    return {}
  }
})
`.trim()
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      const depIds = transformContextDepsDestructuring(code, ast, ms)
      
      expect(depIds.size).toBe(0)
    })
  })

  describe('hasDepsAlready', () => {
    it('should find deps in Object.assign', () => {
      const code = `
Object.assign(_sfc_main, { deps: [DEPS.DateTime] })
export default _sfc_main
`.trim()
      const ast = parseCode(code)
      
      const result = hasDepsAlready(ast, '_sfc_main')
      
      expect(result).toBe(true)
    })

    it('should return false if deps is not present', () => {
      const code = `
export default defineComponent({ name: 'Test' })
`.trim()
      const ast = parseCode(code)
      
      const result = hasDepsAlready(ast, '_sfc_main')
      
      expect(result).toBe(false)
    })
  })

  describe('isDefineComponentCall', () => {
    it('should recognize defineComponent call', () => {
      const code = `defineComponent({ name: 'Test' })`
      const ast = parseCode(code)
      
      const callNode = (ast.body[0] as any).expression
      const result = isDefineComponentCall(callNode)
      
      expect(result).toBe(true)
    })

    it('should recognize _defineComponent call', () => {
      const code = `_defineComponent({ name: 'Test' })`
      const ast = parseCode(code)
      
      const callNode = (ast.body[0] as any).expression
      const result = isDefineComponentCall(callNode)
      
      expect(result).toBe(true)
    })

    it('should not recognize other functions', () => {
      const code = `someFunction({ name: 'Test' })`
      const ast = parseCode(code)
      
      const callNode = (ast.body[0] as any).expression
      const result = isDefineComponentCall(callNode)
      
      expect(result).toBe(false)
    })
  })

  describe('Performance', () => {
    it('should handle large files efficiently', () => {
      // Generate a large component with many dependencies
      const depsCount = 50
      const depsEntries = Array.from({ length: depsCount }, (_, i) => 
        `service${i}: DEPS.Service${i}`
      ).join(', ')
      const destructuring = Array.from({ length: depsCount }, (_, i) => 
        `service${i}`
      ).join(', ')
      
      const code = `const { ${destructuring} } = defineDeps({ ${depsEntries} })`
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      const start = performance.now()
      const depIds = transformDefineDepsDestructuring(code, ast, ms)
      const duration = performance.now() - start
      
      // It should handle it quickly (< 100ms even for large files)
      expect(duration).toBeLessThan(100)
      
      // All dependencies should be collected
      expect(depIds.size).toBe(depsCount)
      
      // The result should contain the transformation
      const result = ms.toString()
      expect(result).toMatch(/const __deps_\w+ = defineDeps\(\[/)
    })

    it('should handle multiple calls efficiently', () => {
      const callsCount = 100
      const calls = Array.from({ length: callsCount }, (_, i) => 
        `const { service${i} } = defineDeps({ service${i}: DEPS.S${i} })`
      ).join('\n')
      
      const ast = parseCode(calls)
      const ms = new MagicString(calls)
      
      const start = performance.now()
      const depIds = transformDefineDepsDestructuring(calls, ast, ms)
      const duration = performance.now() - start
      
      expect(duration).toBeLessThan(200)
      expect(depIds.size).toBe(callsCount)
    })
  })

  describe('Integration - real scenarios', () => {
    it('should handle combination of different patterns', () => {
      const code = `
import { defineDeps } from './defineComponent'

// Pattern 1: destructuring (transformed)
const { dateTimeService, firstService } = defineDeps({ 
  dateTimeService: DEPS.DateTime, 
  firstService: DEPS.First 
})

// Pattern 2: without destructuring (not transformed, but depIds are collected)
const deps = defineDeps({ secondService: DEPS.Second })

// Pattern 3: nested call with destructuring (transformed)
const tomorrow = () => {
  const { dateTimeService: dt } = defineDeps({ dateTimeService: DEPS.DateTime })
  return dt.now()
}

// Pattern 4: array (not transformed, but depIds are collected)
const moreDeps = defineDeps([DEPS.Third, DEPS.Fourth])
`.trim()
      const ast = parseCode(code)
      const ms = new MagicString(code)
      
      const depIds = transformDefineDepsDestructuring(code, ast, ms)
      const result = ms.toString()
      
      // Check the transformations
      expect(result).toMatch(/const __deps_\w+ = defineDeps\(\[DEPS\.DateTime, DEPS\.First\]\);/)
      expect(result).toMatch(/const __deps_\w+ = defineDeps\(\[DEPS\.DateTime\]\);/)
      
      // Patterns without destructuring should not change
      expect(result).toContain('const deps = defineDeps({ secondService: DEPS.Second })')
      expect(result).toContain('const moreDeps = defineDeps([DEPS.Third, DEPS.Fourth])')
      
      // All depIds should be collected
      expect(depIds.has('DEPS.DateTime')).toBe(true)
      expect(depIds.has('DEPS.First')).toBe(true)
      expect(depIds.has('DEPS.Second')).toBe(true)
      expect(depIds.has('DEPS.Third')).toBe(true)
      expect(depIds.has('DEPS.Fourth')).toBe(true)
      expect(depIds.size).toBe(5)
    })
  })
})
