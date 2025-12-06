import type { Movie } from '@/domain/models/movie'
import { QueryBase } from '@/domain/queries/queryBase'

export class MovieListQuery extends QueryBase<Array<Movie>> {
  readonly __brand = 'MovieListQuery' as const

  constructor(public year: number) {
    super()
  }
}
