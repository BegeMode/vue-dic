// import { INFRA_DEPS } from '@/infrastructure/depIds'

import { DOMAIN_DEPS } from '@/domain/depIds'
import { INFRA_DEPS } from '@/infrastructure/depIds'
import { DepScope, DepType, type IDep } from '@/infrastructure/ioc/types'
import { PubSubService } from '@/infrastructure/services/pubSub.service'

export const deps: Record<symbol, IDep | (() => InstanceType<any>) | InstanceType<any>> = {
  [DOMAIN_DEPS.PubSub]: PubSubService,
  [INFRA_DEPS.MoviesStore]: {
    type: DepType.Store,
    scope: DepScope.SingletonScope,
    loader: () => import('@/infrastructure/stores/movies/movies'),
    autoCreate: true,
  },
  [INFRA_DEPS.CounterStore]: {
    type: DepType.Store,
    scope: DepScope.SingletonScope,
    loader: () => import('@/infrastructure/stores/counter/counter'),
  },
  [INFRA_DEPS.DateStore]: {
    type: DepType.Store,
    scope: DepScope.SingletonScope,
    loader: () => import('@/infrastructure/stores/date/date'),
  },
}
