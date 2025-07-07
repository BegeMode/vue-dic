import type { IQuery } from '@/domain/queries/query'
import type { TAction } from '@/infrastructure/stores/types'
import { QueryBase } from '@/domain/queries/queryBase'
import { isTest } from '@/utils/system'

export type TQueryResult<T> = T extends IQuery<infer TResult> ? TResult : never

function queryable<TQry extends IQuery<TResult>, TResult>(
  query: { prototype: TQry; name: string },
  action: TAction<TQry, TResult>
) {
  if (
    !isTest() &&
    (action.name !== 'wrappedAction' || Object.getOwnPropertySymbols(action).length < 2)
  ) {
    throw new Error(`Action ${action.name} is not a Pinia action`)
  }
  const found = Reflect.getMetadata(query.prototype, QueryBase)
  if (found) {
    throw new Error(`Action for ${query.name} already exists`)
  }
  Reflect.defineMetadata(query.prototype, action, QueryBase)
  query.prototype.exec = function () {
    return action(this)
  }
  return action
}

export function getQueryableFunc<T extends IQuery<TQueryResult<T>>>() {
  return function <R extends T>(
    query: { prototype: R; name: string },
    action: TAction<R, TQueryResult<R>>
  ) {
    return queryable(query, action)
  }
}

// export function genQueryable<T extends IQuery<TQueryResult<T>>>() {
//   return function (
//     query: { prototype: T extends IQuery<TQueryResult<T>> ? T : never; name: string },
//     action: TAction<T, TQueryResult<T>>
//   ) {
//     return queryable(query, action)
//   }
// }

// export function genQueryable1<T extends IQuery<TQueryResult<T>>>() {
//   const result = function (
//     query: { prototype: T; name: string },
//     action: TAction<T, TQueryResult<T>>
//   ) {
//     return queryable(query, action)
//   }
//   return result
// }

// type TQuery<T, TR> = T extends IQuery<TR> ? T : never
// export function queryable<T extends IQuery<TQueryResult<T>>>(
//   query: { prototype: T; name: string },
//   action: TAction<T, TQueryResult<T>> // (query: T) => TQueryResult<T>
// ) {}

// type Kind = number | string
// type KindOther = number | boolean

// function increment(n: number): number {
//   return n++
// }

// function len(s: string): number {
//   return s.length
// }

// export function apply<T>(arg: T, action: (arg: T) => any): ReturnType<typeof action> {
//   return action(arg)
// }

// export const obj = {
//   inc: apply<Kind>(1, increment),
//   len: apply('qwe', len)
// }
