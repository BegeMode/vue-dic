import { CommandsQueries } from '@/domain/commandsQueries'
import { CurrentUserQuery } from '@/domain/queries/user.query'
import { IncrementCommand } from '@/domain/commands/increment.command'
import { DateUpdateCommand } from '@/domain/commands/date.command'
import { MovieListQuery } from '@/domain/queries/movie.query'

function registerCommandsQueries(types: Array<any>, loader: () => unknown) {
  if (!Array.isArray(types)) {
    return
  }
  types.forEach((t) => {
    CommandsQueries.set(t, loader)
  })
}

registerCommandsQueries(
  [CurrentUserQuery, IncrementCommand],
  () => import('@/infrastructure/stores/counter/loader')
)
registerCommandsQueries([DateUpdateCommand], () => import('@/infrastructure/stores/date/loader'))
registerCommandsQueries([MovieListQuery], () => import('@/infrastructure/stores/movies/loader'))
