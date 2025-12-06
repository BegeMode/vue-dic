import { APP_DEPS } from '@/application/depIds'

export const INFRA_DEPS = {
  ...APP_DEPS,
  MoviesStore: Symbol.for('MoviesStore'),
  CounterStore: Symbol.for('CounterStore'),
  DateStore: Symbol.for('DateStore'),
} as const
