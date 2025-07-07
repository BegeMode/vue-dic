import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getQueryableFunc } from '@/infrastructure/queries/queryable'
import { MovieListQuery } from '@/domain/queries/movie.query'
import type { Movie } from '@/domain/models/movie'
import axios from 'axios'
import { API_KEY, API_URL } from '@/infrastructure/stores/movies/config'
import type { MoviesCommandQueryTypes } from '@/infrastructure/stores/movies/types'

const queryable = getQueryableFunc<MoviesCommandQueryTypes>()

export const useMoviesStore = defineStore('movies', ({ action }) => {
  const movies = ref<Array<Movie>>([])

  async function fetchList(query: MovieListQuery): Promise<Array<Movie>> {
    const response = await axios.get(API_URL, {
      params: {
        apikey: API_KEY,
        y: query.year,
        s: 'all', // Search all films (required not empty request)
        type: 'movie'
      }
    })

    if (response.data.Response === 'True') {
      movies.value = response.data.Search
    } else {
      console.error('Error: ', response.data.Error)
    }
    return movies.value
  }

  return {
    movies,
    fetchList: queryable(MovieListQuery, action(fetchList))
  }
})
