import { DOMAIN_DEPS } from '@/domain/depIds'

export const APP_DEPS = {
  ...DOMAIN_DEPS,
  DateTime: Symbol.for('DateTime')
} as const
