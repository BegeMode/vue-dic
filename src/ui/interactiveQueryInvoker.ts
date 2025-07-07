import type { IQuery, IQueryInvoker } from '@/domain/queries/query'
import { DEPS } from '@/ui/depIds'
import { Container, inject, injectable } from 'inversify'
import { getServiceAsync } from '@/infrastructure/ioc/ioc'

@injectable()
export class InteractiveQueryInvoker<TResult> implements IQueryInvoker<TResult> {
  constructor(@inject(DEPS.Container) private readonly container: Container) {}

  public async exec(query: IQuery<TResult>): Promise<TResult> {
    const proto = Object.getPrototypeOf(query)
    const depId = Reflect.getMetadata(proto, proto)
    const queryInvoker: IQueryInvoker<TResult> | undefined = await getServiceAsync(
      depId,
      this.container
    )
    if (queryInvoker) {
      return queryInvoker.exec(query)
    }
    throw new Error(`InteractiveQueryInvoker not found for ${depId.toString()}`)
  }
}
