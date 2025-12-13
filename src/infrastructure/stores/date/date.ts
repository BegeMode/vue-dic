import { ref } from 'vue'
import { defineStore } from 'pinia'
import { commandable } from '@/infrastructure/queries/commandable'
import { DateUpdateCommand } from '@/domain/commands/date.command'
import { delay } from '@/utils/delay'
import { INFRA_DEPS } from '@/infrastructure/depIds'

const useDateStore = defineStore(INFRA_DEPS.DateStore, ({ action }) => {
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

export type DateStore = ReturnType<typeof useDateStore>

export default useDateStore
