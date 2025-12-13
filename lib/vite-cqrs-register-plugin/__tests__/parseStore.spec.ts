import { describe, it, expect } from 'vitest'
import { parseStoreFile, hasStoreDefinition, hasCqrsHandlers } from '../parseStore'

describe('parseStore', () => {
  describe('parseStoreFile', () => {
    it('should extract storeIdExpr from MemberExpression', () => {
      const code = `
        import { defineStore } from 'pinia'
        import { INFRA_DEPS } from '@/infrastructure/depIds'
        
        const useStore = defineStore(INFRA_DEPS.CounterStore, () => {
          return {}
        })
      `
      const result = parseStoreFile(code)

      expect(result.storeIdExpr).toBe('INFRA_DEPS.CounterStore')
    })

    it('should extract storeIdExpr from string literal', () => {
      const code = `
        import { defineStore } from 'pinia'
        
        const useStore = defineStore('counter', () => {
          return {}
        })
      `
      const result = parseStoreFile(code)

      expect(result.storeIdExpr).toBe("'counter'")
    })

    it('should extract queryable entries', () => {
      const code = `
        import { defineStore } from 'pinia'
        import { queryable } from '@/infrastructure/queries/queryable'
        import { CurrentUserQuery } from '@/domain/queries/user.query'
        import { INFRA_DEPS } from '@/infrastructure/depIds'
        
        const useStore = defineStore(INFRA_DEPS.CounterStore, ({ action }) => {
          async function getUser(query: CurrentUserQuery) {
            return {}
          }
          
          return {
            getUser: queryable(CurrentUserQuery, action(getUser))
          }
        })
      `
      const result = parseStoreFile(code)

      expect(result.queries).toHaveLength(1)
      expect(result.queries[0]).toEqual({
        className: 'CurrentUserQuery',
        originalName: 'CurrentUserQuery',
        importPath: '@/domain/queries/user.query',
      })
    })

    it('should extract commandable entries', () => {
      const code = `
        import { defineStore } from 'pinia'
        import { commandable } from '@/infrastructure/queries/commandable'
        import { IncrementCommand } from '@/domain/commands/increment.command'
        import { INFRA_DEPS } from '@/infrastructure/depIds'
        
        const useStore = defineStore(INFRA_DEPS.CounterStore, ({ action }) => {
          async function increment(cmd: IncrementCommand) {
            return
          }
          
          return {
            increment: commandable(IncrementCommand, action(increment))
          }
        })
      `
      const result = parseStoreFile(code)

      expect(result.commands).toHaveLength(1)
      expect(result.commands[0]).toEqual({
        className: 'IncrementCommand',
        originalName: 'IncrementCommand',
        importPath: '@/domain/commands/increment.command',
      })
    })

    it('should extract multiple queryable and commandable entries', () => {
      const code = `
        import { defineStore } from 'pinia'
        import { queryable } from '@/infrastructure/queries/queryable'
        import { commandable } from '@/infrastructure/queries/commandable'
        import { QueryA } from '@/domain/queries/a.query'
        import { QueryB } from '@/domain/queries/b.query'
        import { CommandA } from '@/domain/commands/a.command'
        import { INFRA_DEPS } from '@/infrastructure/depIds'
        
        const useStore = defineStore(INFRA_DEPS.Store, ({ action }) => {
          return {
            a: queryable(QueryA, action(() => {})),
            b: queryable(QueryB, action(() => {})),
            c: commandable(CommandA, action(() => {}))
          }
        })
      `
      const result = parseStoreFile(code)

      expect(result.queries).toHaveLength(2)
      expect(result.commands).toHaveLength(1)
      expect(result.queries[0].className).toBe('QueryA')
      expect(result.queries[1].className).toBe('QueryB')
      expect(result.commands[0].className).toBe('CommandA')
    })

    it('should handle aliased imports', () => {
      const code = `
        import { defineStore } from 'pinia'
        import { queryable } from '@/infrastructure/queries/queryable'
        import { SomeQuery as MyQuery } from '@/domain/queries/some.query'
        import { INFRA_DEPS } from '@/infrastructure/depIds'
        
        const useStore = defineStore(INFRA_DEPS.Store, ({ action }) => {
          return {
            get: queryable(MyQuery, action(() => {}))
          }
        })
      `
      const result = parseStoreFile(code)

      expect(result.queries).toHaveLength(1)
      expect(result.queries[0].className).toBe('MyQuery')
      expect(result.queries[0].originalName).toBe('SomeQuery')
      expect(result.queries[0].importPath).toBe('@/domain/queries/some.query')
    })

    it('should return null storeIdExpr if no defineStore', () => {
      const code = `
        import { ref } from 'vue'
        
        const count = ref(0)
      `
      const result = parseStoreFile(code)

      expect(result.storeIdExpr).toBeNull()
      expect(result.queries).toHaveLength(0)
      expect(result.commands).toHaveLength(0)
    })

    it('should return empty queries/commands if no queryable/commandable', () => {
      const code = `
        import { defineStore } from 'pinia'
        import { INFRA_DEPS } from '@/infrastructure/depIds'
        
        const useStore = defineStore(INFRA_DEPS.Store, () => {
          return {
            count: 0
          }
        })
      `
      const result = parseStoreFile(code)

      expect(result.storeIdExpr).toBe('INFRA_DEPS.Store')
      expect(result.queries).toHaveLength(0)
      expect(result.commands).toHaveLength(0)
    })

    it('should ignore queryable/commandable with non-imported class', () => {
      const code = `
        import { defineStore } from 'pinia'
        import { queryable } from '@/infrastructure/queries/queryable'
        import { INFRA_DEPS } from '@/infrastructure/depIds'
        
        const LocalQuery = class {}
        
        const useStore = defineStore(INFRA_DEPS.Store, ({ action }) => {
          return {
            get: queryable(LocalQuery, action(() => {}))
          }
        })
      `
      const result = parseStoreFile(code)

      // LocalQuery is not in importMap, so it should be ignored
      expect(result.queries).toHaveLength(0)
    })

    it('should handle TypeScript type annotations', () => {
      const code = `
        import { ref, computed, type ComputedRef, type Ref } from 'vue'
        import { defineStore } from 'pinia'
        import { queryable } from '@/infrastructure/queries/queryable'
        import { CurrentUserQuery } from '@/domain/queries/user.query'
        import User from '@/domain/models/user'
        import { INFRA_DEPS } from '@/infrastructure/depIds'
        
        const useStore = defineStore(INFRA_DEPS.CounterStore, ({ action }) => {
          const count: Ref<number> = ref(0)
          const doubleCount: ComputedRef<number> = computed(() => count.value * 2)
          
          async function getUser(query: CurrentUserQuery): Promise<User> {
            return new User()
          }
          
          return {
            count,
            doubleCount,
            getUser: queryable(CurrentUserQuery, action(getUser))
          }
        })
      `
      const result = parseStoreFile(code)

      expect(result.storeIdExpr).toBe('INFRA_DEPS.CounterStore')
      expect(result.queries).toHaveLength(1)
      expect(result.queries[0].className).toBe('CurrentUserQuery')
    })
  })

  describe('hasStoreDefinition', () => {
    it('should return true if code contains defineStore', () => {
      const code = `const store = defineStore('test', () => {})`
      
      expect(hasStoreDefinition(code)).toBe(true)
    })

    it('should return false if code does not contain defineStore', () => {
      const code = `const store = createStore('test')`
      
      expect(hasStoreDefinition(code)).toBe(false)
    })
  })

  describe('hasCqrsHandlers', () => {
    it('should return true if code contains queryable', () => {
      const code = `return { get: queryable(Query, action) }`
      
      expect(hasCqrsHandlers(code)).toBe(true)
    })

    it('should return true if code contains commandable', () => {
      const code = `return { exec: commandable(Command, action) }`
      
      expect(hasCqrsHandlers(code)).toBe(true)
    })

    it('should return true if code contains both', () => {
      const code = `
        return { 
          get: queryable(Query, action),
          exec: commandable(Command, action)
        }
      `
      
      expect(hasCqrsHandlers(code)).toBe(true)
    })

    it('should return false if code contains neither', () => {
      const code = `return { count: 0 }`
      
      expect(hasCqrsHandlers(code)).toBe(false)
    })
  })
})

