import 'reflect-metadata'
import { type Container } from 'inversify'
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

export async function loadDeps(ids: symbol[], ioc: Container) {
  const deps = getDepsRegister(ioc)
  const promises = []
  const map: Record<number, symbol> = {}
  for (const id of ids) {
    if (ioc.isBound(id)) {
      continue
    }
    const deps = getDepsRegister(ioc)
    const depInfo: IDep | InstanceType<any> = deps[id]
    if (!depInfo) {
      return
    }
    let loader: (() => InstanceType<any>) | InstanceType<any> = depInfo
    if (isDepObject(depInfo)) {
      loader = depInfo.loader
    }
    if (!loader.prototype) {
      const i = promises.push(loader()) - 1
      map[i] = id
    }
  }
  const loadedDeps = await Promise.all(promises)
  for (let i = 0; i < loadedDeps.length; i++) {
    const id = map[i]
    if (ioc.isBound(id)) {
      continue
    }
    let loaded = loadedDeps[i]
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
}

export async function loadAndBindDeps(ids: symbol[], ioc: Container) {
  await loadDeps(ids, ioc)
  const deps = getDepsRegister(ioc)
  for (const id of ids) {
    const depInfo: IDep | InstanceType<any> = deps[id]
    await bindDep(ioc, id, depInfo, depInfo.scope)
    if (depInfo.autoCreate) {
      ioc.get(id)
    }
  }
}

export async function loadAndBindDep(id: symbol, ioc: Container) {
  if (ioc.isBound(id)) {
    return
  }
  const deps = getDepsRegister(ioc)
  let depInfo: IDep | InstanceType<any> = deps[id]
  if (!depInfo) {
    return
  }
  const scope = depInfo.scope
  const autoCreate = depInfo.autoCreate
  if (isDepObject(depInfo) || !depInfo.prototype) {
    // dep is not loaded yet, load it
    await loadDeps([id], ioc)
    depInfo = deps[id]
  }
  await bindDep(ioc, id, depInfo, scope)
  if (autoCreate) {
    ioc.get(id)
  }
}

function getDepsIdentifiers(target: Function, withOptional: boolean = false): unknown[] {
  const CLASS_METADATA_KEY = '@inversifyjs/core/classMetadataReflectKey'
  const metadata = Reflect.getMetadata(CLASS_METADATA_KEY, target)
  if (!metadata) {
    return []
  }
  const ids = new Set<unknown>()
  // Add dependencies from constructor
  if (metadata.constructorArguments) {
    for (const arg of metadata.constructorArguments) {
      if (arg?.value && (!arg.optional || withOptional)) {
        // Exclude optional
        ids.add(arg.value)
      }
    }
  }
  // Add dependencies from properties
  if (metadata.properties) {
    for (const [, propertyMetadata] of metadata.properties) {
      if (propertyMetadata?.value && (!propertyMetadata.optional || withOptional)) {
        // Exclude optional
        ids.add(propertyMetadata.value)
      }
    }
  }
  return Array.from(ids)
}

async function bindDep(
  ioc: Container,
  id: symbol,
  dep: any,
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
  const _deps = getDepsIdentifiers(dep)
  for (let i = 0; i < _deps.length; i++) {
    const depId = _deps[i]
    await loadAndBindDep(depId as symbol, ioc)
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
