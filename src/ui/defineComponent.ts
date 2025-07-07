import {
  inject,
  type ComponentOptions,
  type SetupContext,
  defineComponent as originalDefineComponent,
  onActivated as onActivatedOrigin,
  onDeactivated as onDeactivatedOrigin,
  onBeforeMount as onBeforeMountOrigin,
  onMounted as onMountedOrigin,
  onBeforeUpdate as onBeforeUpdateOrigin,
  onUpdated as onUpdatedOrigin,
  onBeforeUnmount as onBeforeUnmountOrigin,
  onUnmounted as onUnmountedOrigin,
  onRenderTriggered as onRenderTriggeredOrigin,
  onRenderTracked as onRenderTrackedOrigin,
  onErrorCaptured as onErrorCapturedOrigin,
  type DebuggerEvent,
  type ComponentPublicInstance,
  getCurrentInstance,
  type ComponentInternalInstance
} from 'vue'
import { Container } from 'inversify'
import type { SetupContextExtended } from '@/ui/types'
import {
  getService,
  getServiceAsync,
  isDepNeedToLoad,
  loadAndBindDep
} from '@/infrastructure/ioc/ioc'
import { isPromise } from '@/utils/helpers'

type THookArray = Array<() => any | Function>

interface IInstance extends ComponentInternalInstance {
  suspense: {
    vnode: {
      props: Record<string, unknown>
    }
  }
}

const hooksFunc = {
  onActivatedOrigin,
  onDeactivatedOrigin,
  onBeforeMountOrigin,
  onMountedOrigin,
  onBeforeUpdateOrigin,
  onUpdatedOrigin,
  onBeforeUnmountOrigin,
  onUnmountedOrigin,
  onRenderTriggeredOrigin,
  onRenderTrackedOrigin,
  onErrorCapturedOrigin
}

type HOOK_NAMES = keyof typeof hooksFunc

interface IHookRecord extends Partial<Record<HOOK_NAMES, THookArray>> {
  onActivatedOrigin?: THookArray
  onDeactivatedOrigin?: THookArray
  onBeforeMountOrigin?: THookArray
  onMountedOrigin?: THookArray
  onBeforeUpdateOrigin?: THookArray
  onUpdatedOrigin?: THookArray
  onBeforeUnmountOrigin?: THookArray
  onUnmountedOrigin?: THookArray
  onRenderTriggeredOrigin?: THookArray
  onRenderTrackedOrigin?: THookArray
  onErrorCapturedOrigin?: THookArray
}

let hooks: IHookRecord

export function onActivated(hook: Function) {
  if (!hooks) {
    throw new Error('Unable to add lifecycle hook')
  }
  hooks.onActivatedOrigin
    ? hooks.onActivatedOrigin.push(hook as any)
    : (hooks.onActivatedOrigin = [hook as any])
}

export function onDeactivated(hook: Function) {
  if (!hooks) {
    throw new Error('Unable to add lifecycle hook')
  }
  hooks.onDeactivatedOrigin
    ? hooks.onDeactivatedOrigin.push(hook as any)
    : (hooks.onDeactivatedOrigin = [hook as any])
}

export const onBeforeMount = (hook: () => any) => {
  if (!hooks) {
    throw new Error('Unable to add lifecycle hook')
  }
  hooks.onBeforeMountOrigin
    ? hooks.onBeforeMountOrigin.push(hook)
    : (hooks.onBeforeMountOrigin = [hook])
}

export const onMounted = (hook: () => any) => {
  if (!hooks) {
    throw new Error('Unable to add lifecycle hook')
  }
  hooks.onMountedOrigin ? hooks.onMountedOrigin.push(hook) : (hooks.onMountedOrigin = [hook])
}

export const onBeforeUpdate = (hook: () => any) => {
  if (!hooks) {
    throw new Error('Unable to add lifecycle hook')
  }
  hooks.onBeforeUpdateOrigin
    ? hooks.onBeforeUpdateOrigin.push(hook)
    : (hooks.onBeforeUpdateOrigin = [hook])
}

export const onUpdated = (hook: () => any) => {
  if (!hooks) {
    throw new Error('Unable to add lifecycle hook')
  }
  hooks.onUpdatedOrigin ? hooks.onUpdatedOrigin.push(hook) : (hooks.onUpdatedOrigin = [hook])
}

export const onBeforeUnmount = (hook: () => any) => {
  if (!hooks) {
    throw new Error('Unable to add lifecycle hook')
  }
  hooks.onBeforeUnmountOrigin
    ? hooks.onBeforeUnmountOrigin.push(hook)
    : (hooks.onBeforeUnmountOrigin = [hook])
}

export const onUnmounted = (hook: () => any) => {
  if (!hooks) {
    throw new Error('Unable to add lifecycle hook')
  }
  hooks.onUnmountedOrigin ? hooks.onUnmountedOrigin.push(hook) : (hooks.onUnmountedOrigin = [hook])
}

type DebuggerHook = (e: DebuggerEvent) => void
export const onRenderTriggered = (hook: DebuggerHook) => {
  if (!hooks) {
    throw new Error('Unable to add lifecycle hook')
  }
  hooks.onRenderTriggeredOrigin
    ? hooks.onRenderTriggeredOrigin.push(hook as any)
    : (hooks.onRenderTriggeredOrigin = [hook as any])
}

export const onRenderTracked = (hook: DebuggerHook) => {
  if (!hooks) {
    throw new Error('Unable to add lifecycle hook')
  }
  hooks.onRenderTrackedOrigin
    ? hooks.onRenderTrackedOrigin.push(hook as any)
    : (hooks.onRenderTrackedOrigin = [hook as any])
}

type ErrorCapturedHook<TError = unknown> = (
  err: TError,
  instance: ComponentPublicInstance | null,
  info: string
) => boolean | void
export function onErrorCaptured<TError = Error>(hook: ErrorCapturedHook<TError>) {
  if (!hooks) {
    throw new Error('Unable to add lifecycle hook')
  }
  hooks.onErrorCapturedOrigin
    ? hooks.onErrorCapturedOrigin.push(hook as any)
    : (hooks.onErrorCapturedOrigin = [hook as any])
}

function callHooks(arr?: Array<any>) {
  arr?.forEach((hook) => {
    if (typeof hook === 'function') {
      hook()
    }
  })
}

function isNeedToLoadDeps(deps: Record<string, symbol> | undefined, ioc: Container) {
  if (deps) {
    for (const key of Object.keys(deps)) {
      const depId = deps[key]
      if (!ioc.isBound(depId) && isDepNeedToLoad(depId, ioc)) {
        return true
      }
    }
  }
  return false
}

function getLoadedDeps(
  deps: Record<string, symbol> | undefined,
  ioc: Container
): Record<string, () => unknown> {
  const result: Record<string, () => unknown> = {}
  if (!deps) {
    return result
  }
  for (const key of Object.keys(deps)) {
    const depId = deps[key]
    if (!depId) {
      continue
    }
    if (!ioc.isBound(depId)) {
      loadAndBindDep(depId, ioc)
    }
    const dep = getService(depId, ioc)
    Object.defineProperty(result, key, {
      get: () => dep,
      enumerable: true
    })
  }
  return result
}

async function loadDeps(
  deps: Record<string, symbol> | undefined,
  ioc: Container,
  result: Record<string, () => unknown>
) {
  if (!deps) {
    return
  }
  for (const key of Object.keys(deps)) {
    const depId = deps[key]
    let dep
    if (!ioc.isBound(depId)) {
      dep = await getServiceAsync(depId, ioc)
    } else {
      dep = getService(depId, ioc)
    }
    Object.defineProperty(result, key, {
      get: () => dep,
      enumerable: true
    })
  }
}

type TClass<T> = T extends Record<string, infer R> ? R : never

export async function defineDeps<T extends Record<string, any>>(
  deps: Record<string, symbol>
): Promise<Record<keyof typeof deps, TClass<T>>> {
  const instance = getCurrentInstance() as IInstance
  const ioc = inject('_ioc') as Container
  if (instance) {
    try {
      const result: Record<string, TClass<T>> = {}
      const isDepsNeedToLoad = isNeedToLoadDeps(deps, ioc)
      if (isDepsNeedToLoad) {
        await loadDeps(deps, ioc, result)
      } else {
        Object.assign(result, getLoadedDeps(deps, ioc) as Record<string, TClass<T>>)
      }
      if (!isDepsNeedToLoad && instance.suspense?.vnode) {
        let props = instance.suspense.vnode.props
        if (!props) {
          props = {}
          instance.suspense.vnode.props = props
        }
        props.suspensible = false
      }
      return result
    } catch (error) {
      console.error('Error loading dependencies:', error)
      return {}
    }
  } else {
    console.warn('defineDeps must be called inside setup()')
    return {}
  }
}

export function _defineComponent(options: ComponentOptions) {
  const { setup, ...withoutSetup } = options
  let data
  if (!options.deps) {
    // synchronic version without deps
    data = {
      ...withoutSetup,
      setup(props: Record<string, unknown>, ctx: SetupContext) {
        const instance = getCurrentInstance() as IInstance
        hooks = {}
        const result = setup ? setup(props, ctx) : {}
        subscribeToLifecycleHooks(instance, hooks)
        return result
      }
    }
  } else {
    // asynchronic version
    data = {
      ...withoutSetup,
      async setup(props: Record<string, unknown>, ctx: SetupContext) {
        const instance = getCurrentInstance() as IInstance
        const ioc = inject('_ioc') as Container
        const getDep = <T>(id: symbol): T => getService<T>(id, ioc)
        const deps: Record<string, () => unknown> = {}
        const extCtx = { ...ctx, getDep, deps }
        const isDepsNeedToLoad = isNeedToLoadDeps(options.deps, ioc)
        if (isDepsNeedToLoad) {
          await loadDeps(options.deps, ioc, deps)
        } else {
          Object.assign(deps, getLoadedDeps(options.deps, ioc))
        }
        extCtx.expose({ deps })
        Object.preventExtensions(extCtx)

        // record for lifecicle hooks
        hooks = {}
        const result = setup ? await setup(props, extCtx) : {}
        subscribeToLifecycleHooks(instance, hooks)

        if (!isDepsNeedToLoad && !isPromise(result) && instance.suspense?.vnode) {
          let props = instance.suspense.vnode.props
          if (!props) {
            props = {}
            instance.suspense.vnode.props = props
          }
          props.suspensible = false
        }
        return result
      }
    }
  }
  return originalDefineComponent(data)
}

function subscribeToLifecycleHooks(instance: IInstance, hooksRecord: IHookRecord) {
  Object.keys(hooksRecord).forEach((key) => {
    const hookFunc = hooksFunc[key as HOOK_NAMES]
    hookFunc(() => callHooks(hooksRecord[key as HOOK_NAMES]), instance)
  })
  // the last callback in the onUnmounted should be a cleanup of the closure
  let _h: IHookRecord | null = hooksRecord
  onUnmountedOrigin(() => {
    if (!_h) {
      return
    }
    Object.keys(_h).forEach((key) => delete _h![key as HOOK_NAMES])
    _h = null
  }, instance)
}

export function toDeps<T>(context: unknown) {
  const { getDep, deps } = context as SetupContextExtended
  return {
    getDep,
    deps: deps as T
  }
}

type D = typeof originalDefineComponent

export const defineComponent = _defineComponent as D & {
  setup: (props: Record<string, unknown>, ctx: SetupContextExtended) => unknown
}
