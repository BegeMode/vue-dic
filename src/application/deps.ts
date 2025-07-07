import { DateTimeService } from '@/application/dateTimeService'
import { APP_DEPS } from '@/application/depIds'

export const deps = {
  [APP_DEPS.DateTime]: DateTimeService
}
