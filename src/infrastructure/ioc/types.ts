export const DEPS_REGISTER = Symbol.for('DEPS_REGISTER')

export const enum DepScope {
  TransientScope,
  RequestScope,
  SingletonScope
}

export interface IDep {
  scope: DepScope
  loader: () => InstanceType<any>
  autoCreate?: boolean
}
