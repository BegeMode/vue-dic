declare module '@vue/runtime-core' {
  interface ComponentCustomOptions {
    deps?: Record<string, symbol>
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

export {}
