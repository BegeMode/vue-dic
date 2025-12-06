<template>
  <div class="greetings">
    <h1 class="green">{{ msg }}</h1>
    <h3>
      You’ve successfully created a project with
      <a href="https://vitejs.dev/" target="_blank" rel="noopener">Vite</a> +
      <a href="https://vuejs.org/" target="_blank" rel="noopener">Vue 3</a>. What's next?
    </h3>
    <h2>{{ counter }}</h2>
    <button @click="onIncrement" :disabled="incBtnDisabled">Increment</button>
    <button @click="onAlert">Alert query</button>
    <h4>{{ dateStore.dt }}</h4>
    <button @click="onAddDay" :disabled="addDayBtnDisabled">Increment date</button>
  </div>
</template>
<script setup lang="ts">
import type { DateTimeService } from '@/application/dateTimeService';
import { DateUpdateCommand } from '@/domain/commands/date.command';
import { IncrementCommand } from '@/domain/commands/increment.command';
import { AlertQuery } from '@/domain/queries/interactiveQuery/alert.query';
import { ConfirmQuery } from '@/domain/queries/interactiveQuery/confirm.query';
import { IncrementStepQuery } from '@/domain/queries/interactiveQuery/incrementStep.query';
import type { CounterStore } from '@/infrastructure/stores/counter/counter';
import type { DateStore } from '@/infrastructure/stores/date/date';
import { defineDeps } from '@/ui/defineComponent';
import { DEPS } from '@/ui/depIds';
import { computed, ref } from 'vue';

type TDeps = {
  dateTimeService: DateTimeService
  counterStore: CounterStore
  dateStore: DateStore
}

defineProps<{
  msg: string
}>()

const incBtnDisabled = ref(false)
const addDayBtnDisabled = ref(false)

const onIncrement = async () => {
  const step = await new IncrementStepQuery(1, 100).exec()
  if (!step) {
    return
  }
  incBtnDisabled.value = true
  try {
    await new IncrementCommand(step).exec()
  } catch (e) {
    console.error(e)
  } finally {
    incBtnDisabled.value = false
  }
}

const onAlert = async () => {
  const result = await new AlertQuery('Are you see this alert?').exec()
  console.log(result)
}

const counter = computed(() => counterStore.count)
let dontAskToAddDay = false

const { dateTimeService, counterStore, dateStore } = defineDeps<TDeps>({
  dateTimeService: DEPS.DateTime,
  counterStore: DEPS.CounterStore,
  dateStore: DEPS.DateStore
})

const onAddDay = async () => {
  if (!dontAskToAddDay) {
    const confirm = await new ConfirmQuery('Are you sure you want to add day?', 'Confirmation', 'Don\'t ask next time').exec()
    if (!confirm?.confirmed) {
      return
    }
    dontAskToAddDay = !!confirm?.checkbox
  }
  addDayBtnDisabled.value = true
  try {
    const newDt = dateTimeService.addDays(dateStore.dt, 1)
    await new DateUpdateCommand(newDt).exec()
  } catch (e) {
    console.error(e)
  } finally {
    addDayBtnDisabled.value = false
  }
}
console.log('dateStore:', dateStore)
console.log('dateStore.dt:', dateStore.dt)
console.log('typeof dateStore.dt:', typeof dateStore.dt)
</script>
<style scoped>
h1 {
  font-weight: 500;
  font-size: 2.6rem;
  position: relative;
  top: -10px;
}

h3 {
  font-size: 1.2rem;
}

.greetings h1,
.greetings h3 {
  text-align: center;
}

@media (min-width: 1024px) {

  .greetings h1,
  .greetings h3 {
    text-align: left;
  }
}
</style>
