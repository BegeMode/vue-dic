import { DOMAIN_DEPS } from '@/domain/depIds'
import { QueryInvoker } from '@/domain/queries/queryInvoker'

export const deps = {
  [DOMAIN_DEPS.QueryInvoker]: QueryInvoker
}
