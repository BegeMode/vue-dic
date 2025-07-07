import 'reflect-metadata'
import { getDependencies, type Container, type interfaces } from 'inversify'
import { DepScope, DEPS_REGISTER, type IDep } from '@/infrastructure/ioc/types'

function getDepsRegister(
  ioc: Container
): Record<symbol, IDep | InstanceType<any> | (() => InstanceType<any>)> {
  try {
    return ioc.get(DEPS_REGISTER)
  } catch (e) {
    throw new Error(`Dependency register not found in IoC ${(e as Error).message}`)
  }
}

export async function registerStaticDeps(ioc: Container) {
  const deps = getDepsRegister(ioc)
  for (const id of Object.getOwnPropertySymbols(deps)) {
    const depInfo = deps[id]
    if (!depInfo) {
      continue
    }
    let loader: (() => InstanceType<any>) | InstanceType<any> = depInfo
    if (isDepObject(depInfo)) {
      loader = depInfo.loader
    }
    if (!loader.prototype) {
      continue
    }
    loadAndBindDep(id, ioc)
  }
}

export function isDepNeedToLoad(id: symbol, ioc: Container): boolean {
  const deps = getDepsRegister(ioc)
  const depInfo: IDep | InstanceType<any> = deps[id]
  if (!depInfo) {
    return false
  }
  let loader: (() => InstanceType<any>) | InstanceType<any> = depInfo
  if (isDepObject(depInfo)) {
    loader = depInfo.loader
  }
  if (!loader.prototype) {
    // this is not a JS object
    return true
  }
  return false
}

export async function loadAndBindDep(id: symbol, ioc: Container) {
  if (ioc.isBound(id)) {
    return
  }
  const deps = getDepsRegister(ioc)
  const depInfo: IDep | InstanceType<any> = deps[id]
  if (!depInfo) {
    return
  }
  let depScope: DepScope = DepScope.SingletonScope
  let autoCreate = false
  let loader: (() => InstanceType<any>) | InstanceType<any> = depInfo
  if (isDepObject(depInfo)) {
    depScope = depInfo.scope
    autoCreate = Boolean(depInfo.autoCreate)
    loader = depInfo.loader
  }
  if (!loader.prototype) {
    let loaded = await loader()
    if (ioc.isBound(id)) {
      // double check if another thread already bound the dep
      return
    }
    if ('default' in loaded) {
      loaded = loaded.default
    }
    if (typeof loaded === 'object' && loaded[Symbol.toStringTag] !== 'Module') {
      // this is an our module
      Object.getOwnPropertySymbols(loaded).forEach((key) => {
        deps[key] = loaded[key]
      })
    } else if (loaded?.prototype) {
      // this is a JS object
      deps[id] = loaded
    } else if (loaded && loaded[Symbol.toStringTag] === 'Module') {
      // JS module
      const [firstElement] = Object.values(loaded)
      deps[id] = firstElement
    } else {
      throw new Error(`Invalid module loader result for ${id.toString()}`)
    }
  }
  const dep = deps[id]
  await bindDep(ioc, id, dep, depScope)
  if (autoCreate) {
    ioc.get(id)
  }
}

async function bindDep(
  ioc: Container,
  id: symbol,
  dep: interfaces.Newable<unknown>,
  depScope: DepScope = DepScope.SingletonScope
) {
  const binding = ioc.bind(id).to(dep)
  switch (depScope) {
    case DepScope.SingletonScope:
      binding.inSingletonScope()
      break
    case DepScope.RequestScope:
      binding.inRequestScope()
      break
    case DepScope.TransientScope:
      binding.inTransientScope()
      break

    default:
      break
  }
  const _deps: interfaces.Target[] = getDependencies((ioc as any)._metadataReader, dep)
  for (let i = 0; i < _deps.length; i++) {
    const dep = _deps[i]
    await loadAndBindDep(dep.serviceIdentifier as symbol, ioc)
  }
}

export function getService<T>(id: symbol, ioc: Container) {
  return ioc.get(id) as T
}

export async function getServiceAsync<T>(id: symbol, ioc: Container) {
  try {
    if (!ioc.isBound(id)) {
      await loadAndBindDep(id, ioc)
    }
    const result = getService<T>(id, ioc)
    return result
  } catch (e) {
    console.error(e)
  }
}

function isDepObject(dep: Object): dep is IDep {
  if ('scope' in dep && 'loader' in dep) {
    return true
  }
  return false
}
