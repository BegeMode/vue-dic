import { CommandsQueries } from '@/domain/commandsQueries'
import { CommandQuery as CounterCommandQuery } from '@/infrastructure/stores/counter/types'
import { DateCommandQuery } from '@/infrastructure/stores/date/types'
import { MoviesCommandQuery } from '@/infrastructure/stores/movies/types'

function registerCommandsQueries(types: Array<any>, loader: () => unknown) {
  if (!Array.isArray(types)) {
    return
  }
  types.forEach((t) => {
    CommandsQueries.set(t, loader)
  })
}

registerCommandsQueries(CounterCommandQuery, () => import('@/infrastructure/stores/counter/loader'))
registerCommandsQueries(DateCommandQuery, () => import('@/infrastructure/stores/date/loader'))
registerCommandsQueries(MoviesCommandQuery, () => import('@/infrastructure/stores/movies/loader'))
