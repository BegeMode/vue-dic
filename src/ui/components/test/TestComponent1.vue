<template>
  <div>Now is {{ dt }}</div>
  <div>{{ message }}</div>
</template>
<script setup lang="ts">
import type { DateTimeService } from '@/application/dateTimeService'
import { defineDeps } from '@/ui/defineComponent'
import { DEPS } from '@/ui/depIds'
import type { FirstService } from '@/ui/services/firstService'

type TDeps = {
  dateTimeService: DateTimeService
  firstService: FirstService
}
const { dateTimeService, firstService } = defineDeps<TDeps>({ dateTimeService: DEPS.DateTime, firstService: DEPS.First })

const dt = dateTimeService.now().toISOString()
console.log('dt:', dt)
const message = firstService.getMessage()
console.log('message:', message)

const tomorrow = () => {
  const { dateTimeService: dtService } = defineDeps<{ dateTimeService: DateTimeService }>({ dateTimeService: DEPS.DateTime })
  return dtService.addDays(dtService.now(), 1)
}

const add2days = () => {
  const deps = defineDeps<{ dateTimeService: DateTimeService }>({ dateTimeService: DEPS.DateTime })
  return deps.dateTimeService.addDays(deps.dateTimeService.now(), 2)
}

const tmrw = tomorrow()
console.log('tomorrow:', tmrw)
const d2 = add2days()
console.log('add2days:', d2)
</script>
