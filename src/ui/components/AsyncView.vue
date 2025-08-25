<template>
  <Suspense>
    <template #default>
      <component :is="component" />
    </template>
    <template #fallback>
      <component :is="loadingComponent" />
    </template>
  </Suspense>
</template>

<script setup lang="ts">
import type { Component } from 'vue';


defineProps<{
  component: Component
  loadingComponent?: Component
  errorComponent?: Component
}>()
</script>
