import { ref } from 'vue'
import { defineStore } from 'pinia'
// import { getQueryableFunc } from '@/infrastructure/queries/queryable'
import { getCommandableFunc } from '@/infrastructure/queries/commandable'
import type { DateCommandQueryTypes } from '@/infrastructure/stores/date/types'
import { DateUpdateCommand } from '@/domain/commands/date.command'
import { delay } from '@/utils/delay'

// const queryable = getQueryableFunc<CommandQueryTypes>()
const commandable = getCommandableFunc<DateCommandQueryTypes>()

export const useDateStore = defineStore('date', ({ action }) => {
  const dt = ref(new Date())

  async function update(command: DateUpdateCommand): Promise<void> {
    await delay(500)
    dt.value = command.dt
    return Promise.resolve()
  }

  return {
    dt,
    update: commandable(DateUpdateCommand, action(update))
  }
})
