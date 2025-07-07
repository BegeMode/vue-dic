import { MovieListQuery } from '@/domain/queries/movie.query'

export const MoviesCommandQuery = [MovieListQuery]

export type MoviesCommandQueryTypes = InstanceType<(typeof MoviesCommandQuery)[number]>
