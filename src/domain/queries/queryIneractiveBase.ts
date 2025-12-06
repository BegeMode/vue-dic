import { QueryBase } from '@/domain/queries/queryBase'

export abstract class InteractiveQueryBase<TResult> extends QueryBase<TResult> {
  protected readonly isInteractiveQuery = true
}
