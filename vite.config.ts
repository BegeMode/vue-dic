import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import viteInjectVueDepsPlugin from './lib/vite-inject-vue-deps-plugin/vite-inject-vue-deps-plugin'
import viteChunksMapPlugin from './lib/vite-chunks-map-plugin'
import cqrsRegisterPlugin from './lib/vite-cqrs-register-plugin'

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
    cqrsRegisterPlugin({
      storesDir: 'src/infrastructure/stores',
      depIdsFiles: ['src/infrastructure/depIds.ts'],
      devTelemetry: false
    }),
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
    vueDevTools(),
    viteChunksMapPlugin({
      routerDir: 'src/ui/router',
      iocMapFiles: [
        'src/domain/deps.ts',
        'src/application/deps.ts', 
        'src/infrastructure/deps.ts',
        'src/ui/deps.ts'
      ],
      includeStaticChunks:  false,
      // includeChunkPatterns: ['loader-*'],
      devTelemetry: false
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
