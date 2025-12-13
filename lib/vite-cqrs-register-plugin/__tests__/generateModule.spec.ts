import { describe, it, expect } from 'vitest'
import {
  generateQueriesModule,
  generateCommandsModule,
  getRegistrySummary,
} from '../generateModule'
import type { StoreInfo } from '../types'

describe('generateModule', () => {
  describe('generateQueriesModule', () => {
    it('should generate empty registry for no queries', () => {
      const stores: StoreInfo[] = [
        {
          filePath: '/test/store.ts',
          storeId: 'TestStore',
          queries: [],
          commands: [],
        },
      ]

      const result = generateQueriesModule(stores)

      expect(result).toBe('export const queriesRegistry = new Map()\n')
    })

    it('should generate registry with single query', () => {
      const stores: StoreInfo[] = [
        {
          filePath: '/test/counter.ts',
          storeId: 'CounterStore',
          queries: [
            {
              className: 'CurrentUserQuery',
              originalName: 'CurrentUserQuery',
              importPath: '@/domain/queries/user.query',
            },
          ],
          commands: [],
        },
      ]

      const result = generateQueriesModule(stores)

      expect(result).toContain("import { CurrentUserQuery } from '@/domain/queries/user.query'")
      expect(result).toContain('export const queriesRegistry = new Map([')
      expect(result).toContain("[CurrentUserQuery, 'CounterStore']")
    })

    it('should generate registry with multiple queries from multiple stores', () => {
      const stores: StoreInfo[] = [
        {
          filePath: '/test/counter.ts',
          storeId: 'CounterStore',
          queries: [
            {
              className: 'QueryA',
              originalName: 'QueryA',
              importPath: '@/domain/queries/a.query',
            },
          ],
          commands: [],
        },
        {
          filePath: '/test/movies.ts',
          storeId: 'MoviesStore',
          queries: [
            {
              className: 'QueryB',
              originalName: 'QueryB',
              importPath: '@/domain/queries/b.query',
            },
          ],
          commands: [],
        },
      ]

      const result = generateQueriesModule(stores)

      expect(result).toContain("import { QueryA } from '@/domain/queries/a.query'")
      expect(result).toContain("import { QueryB } from '@/domain/queries/b.query'")
      expect(result).toContain("[QueryA, 'CounterStore']")
      expect(result).toContain("[QueryB, 'MoviesStore']")
    })

    it('should handle aliased imports', () => {
      const stores: StoreInfo[] = [
        {
          filePath: '/test/store.ts',
          storeId: 'TestStore',
          queries: [
            {
              className: 'MyQuery',
              originalName: 'SomeQuery',
              importPath: '@/domain/queries/some.query',
            },
          ],
          commands: [],
        },
      ]

      const result = generateQueriesModule(stores)

      expect(result).toContain("import { SomeQuery as MyQuery } from '@/domain/queries/some.query'")
      expect(result).toContain("[MyQuery, 'TestStore']")
    })

    it('should deduplicate imports', () => {
      const stores: StoreInfo[] = [
        {
          filePath: '/test/store1.ts',
          storeId: 'Store1',
          queries: [
            {
              className: 'SharedQuery',
              originalName: 'SharedQuery',
              importPath: '@/domain/queries/shared.query',
            },
          ],
          commands: [],
        },
        {
          filePath: '/test/store2.ts',
          storeId: 'Store2',
          queries: [
            {
              className: 'SharedQuery',
              originalName: 'SharedQuery',
              importPath: '@/domain/queries/shared.query',
            },
          ],
          commands: [],
        },
      ]

      const result = generateQueriesModule(stores)

      // Import should appear only once
      const importCount = (result.match(/import { SharedQuery }/g) || []).length
      expect(importCount).toBe(1)

      // But both entries should be in the Map
      expect(result).toContain("[SharedQuery, 'Store1']")
      expect(result).toContain("[SharedQuery, 'Store2']")
    })

    it('should generate valid JavaScript (no TypeScript generics)', () => {
      const stores: StoreInfo[] = [
        {
          filePath: '/test/store.ts',
          storeId: 'TestStore',
          queries: [
            {
              className: 'TestQuery',
              originalName: 'TestQuery',
              importPath: '@/domain/queries/test.query',
            },
          ],
          commands: [],
        },
      ]

      const result = generateQueriesModule(stores)

      // Should NOT contain TypeScript generic syntax
      expect(result).not.toContain('<Function, string>')
      expect(result).toContain('new Map([')
    })
  })

  describe('generateCommandsModule', () => {
    it('should generate empty registry for no commands', () => {
      const stores: StoreInfo[] = [
        {
          filePath: '/test/store.ts',
          storeId: 'TestStore',
          queries: [],
          commands: [],
        },
      ]

      const result = generateCommandsModule(stores)

      expect(result).toBe('export const commandsRegistry = new Map()\n')
    })

    it('should generate registry with single command', () => {
      const stores: StoreInfo[] = [
        {
          filePath: '/test/counter.ts',
          storeId: 'CounterStore',
          queries: [],
          commands: [
            {
              className: 'IncrementCommand',
              originalName: 'IncrementCommand',
              importPath: '@/domain/commands/increment.command',
            },
          ],
        },
      ]

      const result = generateCommandsModule(stores)

      expect(result).toContain(
        "import { IncrementCommand } from '@/domain/commands/increment.command'"
      )
      expect(result).toContain('export const commandsRegistry = new Map([')
      expect(result).toContain("[IncrementCommand, 'CounterStore']")
    })

    it('should generate registry with multiple commands from multiple stores', () => {
      const stores: StoreInfo[] = [
        {
          filePath: '/test/counter.ts',
          storeId: 'CounterStore',
          queries: [],
          commands: [
            {
              className: 'CommandA',
              originalName: 'CommandA',
              importPath: '@/domain/commands/a.command',
            },
          ],
        },
        {
          filePath: '/test/date.ts',
          storeId: 'DateStore',
          queries: [],
          commands: [
            {
              className: 'CommandB',
              originalName: 'CommandB',
              importPath: '@/domain/commands/b.command',
            },
          ],
        },
      ]

      const result = generateCommandsModule(stores)

      expect(result).toContain("import { CommandA } from '@/domain/commands/a.command'")
      expect(result).toContain("import { CommandB } from '@/domain/commands/b.command'")
      expect(result).toContain("[CommandA, 'CounterStore']")
      expect(result).toContain("[CommandB, 'DateStore']")
    })

    it('should generate valid JavaScript (no TypeScript generics)', () => {
      const stores: StoreInfo[] = [
        {
          filePath: '/test/store.ts',
          storeId: 'TestStore',
          queries: [],
          commands: [
            {
              className: 'TestCommand',
              originalName: 'TestCommand',
              importPath: '@/domain/commands/test.command',
            },
          ],
        },
      ]

      const result = generateCommandsModule(stores)

      // Should NOT contain TypeScript generic syntax
      expect(result).not.toContain('<Function, string>')
      expect(result).toContain('new Map([')
    })
  })

  describe('getRegistrySummary', () => {
    it('should count queries and commands correctly', () => {
      const stores: StoreInfo[] = [
        {
          filePath: '/test/counter.ts',
          storeId: 'CounterStore',
          queries: [
            { className: 'Q1', originalName: 'Q1', importPath: '@/q1' },
            { className: 'Q2', originalName: 'Q2', importPath: '@/q2' },
          ],
          commands: [{ className: 'C1', originalName: 'C1', importPath: '@/c1' }],
        },
        {
          filePath: '/test/movies.ts',
          storeId: 'MoviesStore',
          queries: [{ className: 'Q3', originalName: 'Q3', importPath: '@/q3' }],
          commands: [],
        },
      ]

      const summary = getRegistrySummary(stores)

      expect(summary.totalQueries).toBe(3)
      expect(summary.totalCommands).toBe(1)
      expect(summary.storeCount).toBe(2)
    })

    it('should return zeros for empty stores', () => {
      const stores: StoreInfo[] = []

      const summary = getRegistrySummary(stores)

      expect(summary.totalQueries).toBe(0)
      expect(summary.totalCommands).toBe(0)
      expect(summary.storeCount).toBe(0)
    })

    it('should handle stores with no queries or commands', () => {
      const stores: StoreInfo[] = [
        {
          filePath: '/test/store.ts',
          storeId: 'EmptyStore',
          queries: [],
          commands: [],
        },
      ]

      const summary = getRegistrySummary(stores)

      expect(summary.totalQueries).toBe(0)
      expect(summary.totalCommands).toBe(0)
      expect(summary.storeCount).toBe(1)
    })
  })
})

