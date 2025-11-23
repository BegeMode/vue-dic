import {
  onActivated as _onActivated,
  onDeactivated as _onDeactivated,
  onBeforeMount as _onBeforeMount,
  onMounted as _onMounted,
  onBeforeUpdate as _onBeforeUpdate,
  onUpdated as _onUpdated,
  onBeforeUnmount as _onBeforeUnmount,
  onUnmounted as _onUnmounted,
  onRenderTriggered as _onRenderTriggered,
  onRenderTracked as _onRenderTracked,
  onErrorCaptured as _onErrorCaptured,
  type ComponentInternalInstance
} from 'vue'

// Important: The order of elements in the array is critical!
// Array is used to better code minification
// Do not change without synchronization with the plugin (vite-inject-vue-deps-plugin)
export function getOriginalHooks() {
  return [
    _onBeforeMount,
    _onMounted,
    _onBeforeUpdate,
    _onUpdated,
    _onBeforeUnmount,
    _onUnmounted,
    _onActivated,
    _onDeactivated,
    _onRenderTriggered,
    _onRenderTracked,
    _onErrorCaptured
  ]
}

export function getHooks(hooks: Record<string, Function[]>) {
  function addHook(name: string, cb: Function) {
    hooks[name] ? hooks[name].push(cb) : (hooks[name] = [cb])
  }
  function onBeforeMount(cb: Function) {
    addHook('onBeforeMount', cb)
  }
  function onMounted(cb: Function) {
    addHook('onMounted', cb)
  }
  function onBeforeUpdate(cb: Function) {
    addHook('onBeforeUpdate', cb)
  }
  function onUpdated(cb: Function) {
    addHook('onUpdated', cb)
  }
  function onBeforeUnmount(cb: Function) {
    addHook('onBeforeUnmount', cb)
  }
  function onUnmounted(cb: Function) {
    addHook('onUnmounted', cb)
  }
  function onActivated(cb: Function) {
    addHook('onActivated', cb)
  }
  function onDeactivated(cb: Function) {
    addHook('onDeactivated', cb)
  }
  function onRenderTriggered(cb: Function) {
    addHook('onRenderTriggered', cb)
  }
  function onRenderTracked(cb: Function) {
    addHook('onRenderTracked', cb)
  }
  function onErrorCaptured(cb: Function) {
    addHook('onErrorCaptured', cb)
  }

  function register(instance: ComponentInternalInstance) {
    const [
      _onBeforeMount,
      _onMounted,
      _onBeforeUpdate,
      _onUpdated,
      _onBeforeUnmount,
      _onUnmounted,
      _onActivated,
      _onDeactivated,
      _onRenderTriggered,
      _onRenderTracked,
      _onErrorCaptured
    ] = getOriginalHooks()

    const hookMap = {
      onBeforeMount: _onBeforeMount,
      onMounted: _onMounted,
      onBeforeUpdate: _onBeforeUpdate,
      onUpdated: _onUpdated,
      onBeforeUnmount: _onBeforeUnmount,
      onUnmounted: _onUnmounted,
      onActivated: _onActivated,
      onDeactivated: _onDeactivated,
      onRenderTriggered: _onRenderTriggered,
      onRenderTracked: _onRenderTracked,
      onErrorCaptured: _onErrorCaptured
    }

    if (instance) {
      Object.keys(hooks).forEach((key) => {
        const originalHook = hookMap[key as keyof typeof hookMap]
        if (hooks[key] && originalHook) {
          for (const h of hooks[key]) {
            originalHook(h as any, instance)
          }
        }
      })
    }
  }

  // Порядок элементов в массиве критичен! Не изменяйте без синхронизации с плагином
  return [
    onBeforeMount,
    onMounted,
    onBeforeUpdate,
    onUpdated,
    onBeforeUnmount,
    onUnmounted,
    onActivated,
    onDeactivated,
    onRenderTriggered,
    onRenderTracked,
    onErrorCaptured,
    register
  ]
}
