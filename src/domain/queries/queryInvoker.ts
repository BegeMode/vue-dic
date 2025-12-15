import type { IQuery, IQueryInvoker } from '@/domain/queries/query'
import { QueryBase } from '@/domain/queries/queryBase'
import type { Container } from 'inversify'
import { getServiceAsync } from '@/infrastructure/ioc/ioc'

// Lazy import to avoid circular dependency:
// QueryBase → QueryInvoker → virtual:queries-registry → CurrentUserQuery → QueryBase
let queriesRegistry: Map<Function, string> | null = null

async function getQueriesRegistry(): Promise<Map<Function, string>> {
  if (!queriesRegistry) {
    const module = await import('virtual:queries-registry')
    queriesRegistry = module.queriesRegistry
  }
  return queriesRegistry
}

export class QueryInvoker<TResult> implements IQueryInvoker<TResult> {
  constructor(private readonly ioc: Container) {}

  public async exec(query: IQuery<TResult>): Promise<TResult> {
    const proto = Object.getPrototypeOf(query)

    // Get Store ID from registry and load store if needed
    const registry = await getQueriesRegistry()
    const storeId = registry.get(proto.constructor)
    if (storeId) {
      await getServiceAsync(storeId, this.ioc)
    }

    const action = Reflect.getMetadata(proto, QueryBase)
    return action(query)
  }
}
