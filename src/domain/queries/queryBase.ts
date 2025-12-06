import type { IQuery, IQueryInvoker } from '@/domain/queries/query'
import { INTERACTIVE_QUERY_INVOKER, QUERY_INVOKER } from '@/domain/global'

export abstract class QueryBase<TResult> implements IQuery<TResult> {
  /** Unique brand for nominal typing. Each descendant must define its unique literal. */
  abstract readonly __brand: string
  private static _queryInvoker: IQueryInvoker

  private static _interactiveQueryInvoker: IQueryInvoker

  private static get queryInvoker(): IQueryInvoker {
    if (!QueryBase._queryInvoker) {
      // inversify not used to be able to create queries with new operator (e.g. new UserQuery())
      QueryBase._queryInvoker = Reflect.getMetadata(QUERY_INVOKER, QueryBase) as IQueryInvoker
    }
    return QueryBase._queryInvoker
  }

  private static get interactiveQueryInvoker(): IQueryInvoker {
    if (!QueryBase._interactiveQueryInvoker) {
      // inversify not used to be able to create queries with new operator (e.g. new AlertQuery())
      QueryBase._interactiveQueryInvoker = Reflect.getMetadata(
        INTERACTIVE_QUERY_INVOKER,
        QueryBase
      ) as IQueryInvoker
    }
    return QueryBase._interactiveQueryInvoker
  }

  protected isInteractiveQuery = false

  public exec(): Promise<TResult> {
    if (this.isInteractiveQuery) {
      return QueryBase.interactiveQueryInvoker.exec(this) as Promise<TResult>
    }
    return QueryBase.queryInvoker.exec(this) as Promise<TResult>
  }

  public fromRemote?: boolean
  public cancelable?: boolean
  public uid?: string | number
}
