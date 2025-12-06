// import { MODULE1_DEPS } from '@/services/module1/module1.types'
import { InteractiveQuery } from '@/decorators/interactiveQuery'
import { deps as domainDeps } from '@/domain/deps'
import { deps as appDeps } from '@/application/deps'
import { deps as infraDeps } from '@/infrastructure/deps'
import { AlertQuery } from '@/domain/queries/interactiveQuery/alert.query'
import { DepScope, type IDep } from '@/infrastructure/ioc/types'
import { DEPS } from '@/ui/depIds'
import { InteractiveQueryInvoker } from '@/ui/interactiveQueryInvoker'
import { Logger } from '@/ui/logger'
import { ConfirmQuery } from '@/domain/queries/interactiveQuery/confirm.query'
import { IncrementStepQuery } from '@/domain/queries/interactiveQuery/incrementStep.query'

export function registerModule(moduleDeps: Record<string, symbol>, loader: () => Promise<unknown>) {
  Object.keys(moduleDeps).forEach((dep) => {
    if (moduleDeps[dep]) {
      deps[moduleDeps[dep]] = loader
    }
  })
}

const queryDynamicImport = (depId: symbol, query: Function, loader: () => InstanceType<any>) => {
  InteractiveQuery(depId, query)(query)
  return loader
}

export const deps = {
  ...domainDeps,
  ...appDeps,
  ...infraDeps,
  [DEPS.Logger]: Logger,
  [DEPS.InteractiveQueryInvoker]: InteractiveQueryInvoker,
  [DEPS.AlertQuery]: queryDynamicImport(
    DEPS.AlertQuery,
    AlertQuery,
    () => import('@/ui/interactiveQuery/alertQuery.handler')
  ),
  [DEPS.ConfirmQuery]: queryDynamicImport(
    DEPS.ConfirmQuery,
    ConfirmQuery,
    () => import('@/ui/interactiveQuery/confirmQuery.handler')
  ),
  [DEPS.IncrementStepQuery]: queryDynamicImport(
    DEPS.IncrementStepQuery,
    IncrementStepQuery,
    () => import('@/ui/interactiveQuery/incrementStepQuery.handler')
  ),
  [DEPS.First]: {
    loader: () => import('@/ui/services/firstService'),
    scope: DepScope.SingletonScope
  }
  // [SERVICES.Second]: () => import('@/services/second'),
  // [SERVICES.Third]: () => import('@/services/third'),
  // [SERVICES.Forth]: () => import('@/services/forth')
} as Record<symbol, IDep | (() => InstanceType<any>) | InstanceType<any>>

// registerModule(MODULE1_DEPS, () => import('@/services/module1/module1'))
