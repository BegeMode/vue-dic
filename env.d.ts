/// <reference types="vite/client" />

// Virtual module from vite-chunks-map-plugin
declare module 'virtual:route-deps-map' {
  const routeDepsMap: Record<string, string[]>
  export default routeDepsMap
}

// Virtual module from vite-inject-vue-deps-plugin
declare module 'virtual:ioc-deps-graph' {
  export const iocDepsByFile: Record<string, string[]>
}
