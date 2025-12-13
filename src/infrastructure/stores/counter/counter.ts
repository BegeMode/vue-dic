import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { queryable } from '@/infrastructure/queries/queryable'
import { CurrentUserQuery } from '@/domain/queries/user.query'
import User from '@/domain/models/user'
import { IncrementCommand } from '@/domain/commands/increment.command'
import { commandable } from '@/infrastructure/queries/commandable'
import { delay } from '@/utils/delay'
import { INFRA_DEPS } from '@/infrastructure/depIds'

const useCounterStore = defineStore(INFRA_DEPS.CounterStore, ({ action }) => {
  const count = ref(0)
  const doubleCount = computed(() => count.value * 2)

  async function increment1(_query: CurrentUserQuery): Promise<User> {
    count.value++
    return new User()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function increment(cmd: IncrementCommand): Promise<void> {
    await delay(1000)
    // @ts-ignore
    console.log(this, cmd)
    count.value += cmd.step
    return Promise.resolve()
  }

  return {
    count,
    doubleCount,
    increment: commandable(IncrementCommand, action(increment)),
    increment1: queryable(CurrentUserQuery, action(increment1))
  }
})

export type CounterStore = ReturnType<typeof useCounterStore>

export default useCounterStore
