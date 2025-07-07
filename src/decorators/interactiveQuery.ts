import type { IQuery } from '@/domain/queries/query'

export function InteractiveQuery(depId: symbol, query: { prototype: IQuery }): ClassDecorator {
  return () => Reflect.defineMetadata(query.prototype, depId, query.prototype)
}
