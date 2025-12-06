export const DEPS_REGISTER = Symbol.for('DEPS_REGISTER')

export const enum DepScope {
  TransientScope = 'transient',
  RequestScope = 'request',
  SingletonScope = 'singleton',
}

export const enum DepType {
  Store = 'store',
}

export interface IDep {
  type?: DepType
  scope: DepScope
  loader: () => InstanceType<any>
  autoCreate?: boolean
}
