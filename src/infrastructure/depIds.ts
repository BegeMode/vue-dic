import { APP_DEPS } from '@/application/depIds'

export const INFRA_DEPS = {
  ...APP_DEPS,
  MoviesStore: 'MoviesStore',
  CounterStore: 'CounterStore',
  DateStore: 'DateStore',
} as const
