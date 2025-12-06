import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'reflect-metadata'
import { mount } from '@vue/test-utils'
import HelloWorld from '../HelloWorld.vue'
import { defineStore, setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import { queryable } from '@/infrastructure/queries/queryable'
import { QueryBase } from '@/domain/queries/queryBase'

class SampleQuery extends QueryBase<string> {
  readonly __brand = 'SampleQuery' as const

  constructor(public id: string) {
    super()
  }
}

export const useCounterStore = defineStore('counter', ({ action }) => {
  const count = ref(0)

  async function increment(query: SampleQuery): Promise<string> {
    count.value++
    return Promise.resolve(query.id)
  }

  return {
    count,
    increment: queryable(SampleQuery, action(increment))
  }
})

describe('HelloWorld', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useCounterStore()
  })

  afterEach(() => {
    Reflect.deleteMetadata(SampleQuery.prototype, QueryBase)
  })

  it('renders properly', () => {
    const wrapper = mount(HelloWorld, { props: { msg: 'Hello Vitest' } })
    expect(wrapper.text()).toContain('Hello Vitest')
  })
})
