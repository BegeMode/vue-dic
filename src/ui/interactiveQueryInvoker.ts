import type { IQuery, IQueryInvoker } from '@/domain/queries/query'
import { Container } from 'inversify'
import { getServiceAsync } from '@/infrastructure/ioc/ioc'

export class InteractiveQueryInvoker<TResult> implements IQueryInvoker<TResult> {
  constructor(private readonly ioc: Container) {}

  public async exec(query: IQuery<TResult>): Promise<TResult> {
    const proto = Object.getPrototypeOf(query)
    const depId = Reflect.getMetadata(proto, proto)
    const queryInvoker: IQueryInvoker<TResult> | undefined = await getServiceAsync(
      depId,
      this.ioc
    )
    if (queryInvoker) {
      return queryInvoker.exec(query)
    }
    throw new Error(`InteractiveQueryInvoker not found for ${depId.toString()}`)
  }
}
