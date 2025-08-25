<template>
  <div class="error-container">
    <div class="error-content">
      <div class="error-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="#ff4757" stroke-width="2" />
          <path d="M15 9l-6 6M9 9l6 6" stroke="#ff4757" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
      <h2 class="error-title">Something went wrong</h2>
      <p class="error-description">An error occurred in the application. Try refreshing the page.</p>

      <div v-if="showDetails" class="error-details">
        <h3>Error details:</h3>
        <div class="error-message">
          <code>{{ errorMessage }}</code>
        </div>
        <div v-if="errorStack" class="error-stack">
          <details>
            <summary>Call stack</summary>
            <pre>{{ errorStack }}</pre>
          </details>
        </div>
      </div>

      <div class="error-actions">
        <button @click="toggleDetails" class="btn btn-secondary">
          {{ showDetails ? 'Hide' : 'Show' }} details
        </button>
        <button @click="reloadPage" class="btn btn-primary">
          Refresh page
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  error: unknown
}

const props = defineProps<Props>()
const showDetails = ref(false)

const errorMessage = computed(() => {
  if (props.error instanceof Error) {
    return props.error.message
  }
  if (typeof props.error === 'string') {
    return props.error
  }
  return 'Unknown error'
})

const errorStack = computed(() => {
  if (props.error instanceof Error && props.error.stack) {
    return props.error.stack
  }
  return null
})

const toggleDetails = () => {
  showDetails.value = !showDetails.value
}

const reloadPage = () => {
  window.location.reload()
}
</script>

<style scoped>
.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
  padding: 2rem;
  background-color: #fafafa;
}

.error-content {
  max-width: 600px;
  width: 100%;
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.error-icon {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: center;
}

.error-title {
  color: #2c3e50;
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.error-description {
  color: #6c757d;
  font-size: 1rem;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.error-details {
  text-align: left;
  margin-bottom: 2rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #ff4757;
}

.error-details h3 {
  color: #2c3e50;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.error-message {
  margin-bottom: 1rem;
}

.error-message code {
  background-color: #e9ecef;
  padding: 0.5rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: #e74c3c;
  display: block;
  word-break: break-all;
}

.error-stack details {
  margin-top: 0.75rem;
}

.error-stack summary {
  cursor: pointer;
  font-weight: 500;
  color: #495057;
  margin-bottom: 0.5rem;
}

.error-stack summary:hover {
  color: #007bff;
}

.error-stack pre {
  background-color: #2d3748;
  color: #e2e8f0;
  padding: 1rem;
  border-radius: 4px;
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.btn:active {
  transform: translateY(0);
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #545b62;
}

@media (max-width: 768px) {
  .error-container {
    padding: 1rem;
  }

  .error-content {
    padding: 1.5rem;
  }

  .error-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>