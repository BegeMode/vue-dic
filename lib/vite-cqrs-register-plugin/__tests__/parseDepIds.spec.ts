import { describe, it, expect } from 'vitest'
import { parseDepIdsFile, buildDepIdsMap, resolveStoreId } from '../parseDepIds'

describe('parseDepIds', () => {
  describe('parseDepIdsFile', () => {
    it('should extract string properties from const object', () => {
      const code = `
        export const INFRA_DEPS = {
          CounterStore: 'CounterStore',
          MoviesStore: 'MoviesStore',
        }
      `
      const entries = parseDepIdsFile(code)

      expect(entries).toHaveLength(2)
      expect(entries[0]).toEqual({
        constName: 'INFRA_DEPS',
        propertyName: 'CounterStore',
        value: 'CounterStore',
      })
      expect(entries[1]).toEqual({
        constName: 'INFRA_DEPS',
        propertyName: 'MoviesStore',
        value: 'MoviesStore',
      })
    })

    it('should handle "as const" assertion', () => {
      const code = `
        export const INFRA_DEPS = {
          CounterStore: 'CounterStore',
        } as const
      `
      const entries = parseDepIdsFile(code)

      expect(entries).toHaveLength(1)
      expect(entries[0].value).toBe('CounterStore')
    })

    it('should ignore spread elements', () => {
      const code = `
        import { APP_DEPS } from './appDeps'
        
        export const INFRA_DEPS = {
          ...APP_DEPS,
          CounterStore: 'CounterStore',
        } as const
      `
      const entries = parseDepIdsFile(code)

      expect(entries).toHaveLength(1)
      expect(entries[0].propertyName).toBe('CounterStore')
    })

    it('should ignore Symbol values', () => {
      const code = `
        export const DOMAIN_DEPS = {
          Container: Symbol.for('Container'),
          QueryInvoker: Symbol.for('QueryInvoker'),
        }
      `
      const entries = parseDepIdsFile(code)

      expect(entries).toHaveLength(0)
    })

    it('should handle multiple const declarations', () => {
      const code = `
        export const DEPS_A = {
          StoreA: 'StoreA',
        }
        
        export const DEPS_B = {
          StoreB: 'StoreB',
        }
      `
      const entries = parseDepIdsFile(code)

      expect(entries).toHaveLength(2)
      expect(entries[0].constName).toBe('DEPS_A')
      expect(entries[1].constName).toBe('DEPS_B')
    })

    it('should handle empty objects', () => {
      const code = `
        export const EMPTY_DEPS = {}
      `
      const entries = parseDepIdsFile(code)

      expect(entries).toHaveLength(0)
    })

    it('should ignore number and boolean values', () => {
      const code = `
        export const CONFIG = {
          timeout: 5000,
          enabled: true,
          name: 'test',
        }
      `
      const entries = parseDepIdsFile(code)

      expect(entries).toHaveLength(1)
      expect(entries[0].propertyName).toBe('name')
    })
  })

  describe('buildDepIdsMap', () => {
    it('should build map with CONST.property keys', () => {
      const entries = [
        { constName: 'INFRA_DEPS', propertyName: 'CounterStore', value: 'CounterStore' },
        { constName: 'INFRA_DEPS', propertyName: 'MoviesStore', value: 'MoviesStore' },
      ]

      const map = buildDepIdsMap(entries)

      expect(map.get('INFRA_DEPS.CounterStore')).toBe('CounterStore')
      expect(map.get('INFRA_DEPS.MoviesStore')).toBe('MoviesStore')
      expect(map.size).toBe(2)
    })

    it('should handle entries from multiple const names', () => {
      const entries = [
        { constName: 'DEPS_A', propertyName: 'Store1', value: 'Store1' },
        { constName: 'DEPS_B', propertyName: 'Store2', value: 'Store2' },
      ]

      const map = buildDepIdsMap(entries)

      expect(map.get('DEPS_A.Store1')).toBe('Store1')
      expect(map.get('DEPS_B.Store2')).toBe('Store2')
    })

    it('should handle empty entries', () => {
      const map = buildDepIdsMap([])

      expect(map.size).toBe(0)
    })
  })

  describe('resolveStoreId', () => {
    const depIdsMap = new Map([
      ['INFRA_DEPS.CounterStore', 'CounterStore'],
      ['INFRA_DEPS.MoviesStore', 'MoviesStore'],
    ])

    it('should resolve MemberExpression to value', () => {
      const result = resolveStoreId('INFRA_DEPS.CounterStore', depIdsMap)

      expect(result).toBe('CounterStore')
    })

    it('should resolve single-quoted string literal', () => {
      const result = resolveStoreId("'counter'", depIdsMap)

      expect(result).toBe('counter')
    })

    it('should resolve double-quoted string literal', () => {
      const result = resolveStoreId('"counter"', depIdsMap)

      expect(result).toBe('counter')
    })

    it('should throw error for unresolved expression', () => {
      expect(() => resolveStoreId('UNKNOWN.Store', depIdsMap)).toThrow(
        'Cannot resolve Store ID: UNKNOWN.Store'
      )
    })

    it('should handle empty map', () => {
      const emptyMap = new Map<string, string>()

      expect(() => resolveStoreId('INFRA_DEPS.Store', emptyMap)).toThrow()
    })
  })
})

