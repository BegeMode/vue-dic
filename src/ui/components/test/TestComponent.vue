<template>
  <div>Now is {{ dt }}</div>
  <div>{{ message }}</div>
</template>
<script lang="ts">
import type { DateTimeService } from '@/application/dateTimeService'
import { DEPS } from '@/ui/depIds'
import type { FirstService } from '@/ui/services/firstService'
import type { SetupContextExtended } from '@/ui/types'
import { defineComponent, onBeforeUnmount, onMounted, onUnmounted, onUpdated } from 'vue'

type TDeps = {
  dateTimeService: DateTimeService
  firstService: FirstService
}

export default defineComponent({
  deps: {
    dateTimeService: DEPS.DateTime,
    firstService: DEPS.First
  },
  setup(_props, context) {
    const { dateTimeService, firstService } = (context as SetupContextExtended<TDeps>).deps
    console.log('dateTimeService', dateTimeService)

    onMounted(() => {
      console.log('Called onMounted in TestComponent')
    })
    onBeforeUnmount(() => {
      console.log('Called onBeforeUnmount in TestComponent')
    })
    onUnmounted(() => {
      console.log('Called onUnmounted in TestComponent')
    })
    onUpdated(() => {
      console.log('Called onUpdated in TestComponent')
    })

    return {
      dt: dateTimeService.now(),
      message: firstService.getMessage()
    }
  }
})

</script>