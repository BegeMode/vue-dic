import { QueryBase } from '@/domain/queries/queryBase'

export class InteractiveQueryBase<TResult> extends QueryBase<TResult> {
  protected readonly isInteractiveQuery = true
}
