import type { Container } from 'inversify'
import type { IQuery, IQueryInvoker } from '@/domain/queries/query'
import { INTERACTIVE_QUERY_INVOKER, QUERY_INVOKER } from '@/domain/global'
import { getActiveContainer } from '@/ui/appContext'

export abstract class QueryBase<TResult> implements IQuery<TResult> {
  /** Unique brand for nominal typing. Each descendant must define its unique literal. */
  abstract readonly __brand: string

  protected isInteractiveQuery = false

  public fromRemote?: boolean
  public cancelable?: boolean
  public uid?: string | number

  /**
   * Container captured at the moment of query creation.
   * This ensures async operations use the correct container
   * even if the active app changes during execution.
   */
  private readonly _capturedContainer: Container | null = getActiveContainer()

  private get queryInvoker(): IQueryInvoker {
    if (this._capturedContainer) {
      return this._capturedContainer.get<IQueryInvoker>(QUERY_INVOKER)
    }
    // Fallback to global metadata (for backwards compatibility)
    return Reflect.getMetadata(QUERY_INVOKER, QueryBase) as IQueryInvoker
  }

  private get interactiveQueryInvoker(): IQueryInvoker {
    if (this._capturedContainer) {
      return this._capturedContainer.get<IQueryInvoker>(INTERACTIVE_QUERY_INVOKER)
    }
    // Fallback to global metadata (for backwards compatibility)
    return Reflect.getMetadata(INTERACTIVE_QUERY_INVOKER, QueryBase) as IQueryInvoker
  }

  /**
   * Executes the query. If the query is interactive, it will be executed through InteractiveQueryInvoker, otherwise through QueryInvoker.
   * Called when the store where the query is implemented is not yet loaded.
   * @returns The result of the query execution.
   */
  public exec(): Promise<TResult> {
    if (this.isInteractiveQuery) {
      return this.interactiveQueryInvoker.exec(this) as Promise<TResult>
    }
    return this.queryInvoker.exec(this) as Promise<TResult>
  }
}
