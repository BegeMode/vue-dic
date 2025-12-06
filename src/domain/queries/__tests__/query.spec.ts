import 'reflect-metadata'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QueryBase } from '@/domain/queries/queryBase'
import { defineStore, setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import { queryable } from '@/infrastructure/queries/queryable'

class TestQuery extends QueryBase<number> {
  readonly __brand = 'TestQuery' as const

  constructor(public value: number) {
    super()
  }
}

export const useTestStore = defineStore('test', ({ action }) => {
  const count = ref(0)

  async function increment(query: TestQuery): Promise<number> {
    count.value += query.value
    return Promise.resolve(count.value)
  }

  spyIncrement = vi.fn(action(increment))
  return {
    count,
    increment: queryable(TestQuery, spyIncrement)
  }
})

let spyIncrement: any

describe('Query', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTestStore()
  })

  afterEach(() => {
    Reflect.deleteMetadata(TestQuery.prototype, QueryBase)
  })

  it('query return correct result', async () => {
    const query = new TestQuery(42)
    await query.exec()
    query.value = 1
    await query.exec()
    const result = await new TestQuery(42).exec()
    expect(result).toEqual(85)
  })

  it('query calls correct invoker', async () => {
    const query = new TestQuery(7)
    const result = await query.exec()
    expect(result).toEqual(7)
    expect(spyIncrement).toHaveBeenCalledTimes(1)
    expect(spyIncrement).toHaveBeenCalledWith(query)
  })
})
