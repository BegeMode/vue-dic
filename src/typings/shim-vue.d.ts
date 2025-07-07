declare module '@vue/runtime-core' {
  interface ComponentCustomOptions {
    deps?: Record<string, symbol>
  }
}

export {}
