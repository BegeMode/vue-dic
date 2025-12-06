import type User from '@/domain/models/user'
import { QueryBase } from '@/domain/queries/queryBase'

export class CurrentUserQuery extends QueryBase<User> {
  readonly __brand = 'CurrentUserQuery' as const
}
