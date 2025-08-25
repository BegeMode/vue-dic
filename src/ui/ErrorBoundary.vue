<template>
  <slot v-if="!error" />
  <ErrorComponent v-else :error="error" />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import ErrorComponent from '@/ui/components/ErrorComponent.vue'

const error = ref<unknown>(null)

onErrorCaptured((err) => {
  error.value = err
  return false
})
</script>
