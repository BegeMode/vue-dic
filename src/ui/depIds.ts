// import { MODULE1_DEPS } from '@/services/module1/module1.ids'

import { INFRA_DEPS } from '@/infrastructure/depIds'

export const DEPS = {
  ...INFRA_DEPS,
  InteractiveQueryInvoker: Symbol.for('InteractiveQueryInvoker'),
  AlertQuery: Symbol.for('AlertQuery'),
  ConfirmQuery: Symbol.for('ConfirmQuery'),
  IncrementStepQuery: Symbol.for('IncrementStepQuery'),
  Alert: Symbol.for('Alert'),
  First: Symbol.for('First'),
  Second: Symbol.for('Second'),
  Third: Symbol.for('Third'),
  Forth: Symbol.for('Forth')
  // ...MODULE1_DEPS
} as const
