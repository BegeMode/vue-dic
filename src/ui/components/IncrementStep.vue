<template>
  <div>
    <label for="step">Step:</label>
    <input id="step" type="number" v-model="model" :min="min" :max="max" />
  </div>
</template>

<script setup lang="ts">
import { delay } from '@/utils/delay';

defineProps<{
  min: number,
  max: number
}>()
const model = defineModel()
// imitation of request to the server
await delay(1000)
</script>

<style scoped lang="scss">
button {
  margin-right: 10px;
}
</style>