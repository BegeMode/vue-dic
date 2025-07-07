import { CommandsQueries } from '@/domain/commandsQueries'
import type { IQuery, IQueryInvoker } from '@/domain/queries/query'
import { QueryBase } from '@/domain/queries/queryBase'
import { injectable } from 'inversify'

@injectable()
export class QueryInvoker<TResult> implements IQueryInvoker<TResult> {
  public async exec(query: IQuery<TResult>): Promise<TResult> {
    const proto = Object.getPrototypeOf(query)
    const loader = CommandsQueries.get(proto.constructor)
    if (loader) {
      await loader()
    }
    const action = Reflect.getMetadata(proto, QueryBase)
    return action(query)
  }
}
