import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import viteInjectVueDepsPlugin from './lib/vite-inject-vue-deps-plugin/vite-inject-vue-deps-plugin'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    minify: true,
    sourcemap: true,
  },
  css: {
    devSourcemap: true
  },
  plugins: [
    viteInjectVueDepsPlugin({
      loadFnImport: {
        from: '@/infrastructure/ioc/ioc',
        name: 'loadAndBindDeps'
      },
      getHooksFnImport: {
        from: '@/ui/hooks',
        name: 'getHooks, getOriginalHooks'
      },
      devTelemetry: false
    }),
    vue(),
    vueDevTools()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
