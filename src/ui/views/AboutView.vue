<template>
  <div class="about">
    <h1>This is an about page</h1>
    <div>
      <button @click="showStatic = !showStatic">Static component with dep</button>
      <TestComponent v-if="showStatic" />
    </div>
    <div>
      <button @click="showDynamic = !showDynamic">Dynamic component with dep</button>
      <component :is="component" v-if="showDynamic" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue'
import TestComponent from '@/ui/components/test/TestComponent.vue'

const showStatic = ref(false)
const showDynamic = ref(false)
const component = defineAsyncComponent(() => import('@/ui/components/test/TestComponent1.vue'))
</script>

<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    flex-flow: column;
    align-items: center;
    justify-content: center;
  }
}
</style>
