<template>
  <div class="loading-spinner-wrapper">
    <div class="loading-spinner-container" :style="containerStyle">
      <div class="loading-spinner" :style="spinnerStyle"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: string | number
  color?: string
  thickness?: string | number
}>(), {
  size: 40,
  color: '#409eff',
  thickness: 4
})

const containerStyle = computed(() => ({
  width: typeof props.size === 'number' ? `${props.size}px` : props.size,
  height: typeof props.size === 'number' ? `${props.size}px` : props.size,
}))

const spinnerStyle = computed(() => ({
  borderTopColor: props.color,
  borderWidth: typeof props.thickness === 'number' ? `${props.thickness}px` : props.thickness,
}))
</script>

<style scoped>
.loading-spinner-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.loading-spinner-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: inherit;
}

.loading-spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #409eff;
  border-radius: 50%;
  width: 100%;
  height: 100%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
