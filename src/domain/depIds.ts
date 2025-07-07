export const DOMAIN_DEPS = {
  Container: Symbol.for('Container'),
  QueryInvoker: Symbol.for('QueryInvoker'),
  Logger: Symbol.for('Logger'),
  PubSub: Symbol.for('PubSub')
} as const
