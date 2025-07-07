import type { Movie } from '@/domain/models/movie'
import { QueryBase } from '@/domain/queries/queryBase'

export class MovieListQuery extends QueryBase<Array<Movie>> {
  constructor(public year: number) {
    super()
  }
}
