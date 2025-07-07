// import { INFRA_DEPS } from '@/infrastructure/depIds'

import { DOMAIN_DEPS } from '@/domain/depIds'
import { PubSubService } from '@/infrastructure/services/pubSub.service'

export const deps = {
  [DOMAIN_DEPS.PubSub]: PubSubService
}
