import { defineAsyncComponent, h, Suspense, type Component } from 'vue'
import LoadingSpinner from '@/ui/components/LoadingSpinner.vue'
import ErrorComponent from '@/ui/components/ErrorComponent.vue'

const componentCache = new Map<Function, Component>()

export function loadView(
  loader: () => Promise<Component>,
  loadingComponent: Component = LoadingSpinner,
  errorComponent: Component = ErrorComponent
) {
  let component = componentCache.get(loader)
  if (!component) {
    component = defineAsyncComponent({
      loader,
      errorComponent,
      delay: 0
    })
    componentCache.set(loader, component)
  }
  return {
    render() {
      return h(
        Suspense,
        {},
        {
          default: () => h(component),
          fallback: () => h(loadingComponent)
        }
      )
    }
    // !!!! example of using AsyncView !!!!
    // render() {
    //   return h(AsyncView, {
    //     component,
    //     loadingComponent,
    //     errorComponent
    //   })
    // }
  }
}

export function preloadView(viewName: string) {
  import(`@/ui/views/${viewName}.vue`)
}
