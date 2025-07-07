<template>
  <div class="movie-list">
    <section class="movie-list__filters">
      <p>
        <label for="selYear">Select year:</label>
        <select id="selYear" v-model="selectedYear">
          <option v-for="year in years" :key="year">{{ year }}</option>
        </select>
      </p>
    </section>
    <ul>
      <li v-for="movie in movies" :key="movie.imdbID">
        {{ movie.Title }} | {{ movie.imdbID }}
      </li>
    </ul>
  </div>
</template>
<script lang="ts">
import type { Movie } from '@/domain/models/movie';
import { MovieListQuery } from '@/domain/queries/movie.query';
import type { TDepIds } from '@/ui/types';
import { defineComponent, ref, watch } from 'vue';

type TDeps = {
  // firstService: FirstService;
}

const deps: TDepIds<TDeps> = {
  // firstService: SERVICES.First,
}

export default defineComponent({
  components: {
  },
  deps,
  setup() {
    // const { deps } = context as SetupContextExtended<TDeps>
    // console.log(deps.firstService)
    const movies = ref<Movie[]>([])
    const years = ref<number[]>([])
    for (let i = 2024; i > 1999; i--) {
      years.value.push(i)
    }
    const selectedYear = ref<number>(2024)
    const loading = ref(false)

    watch(selectedYear, (newVal) => {
      loading.value = true
      new MovieListQuery(newVal).exec().then((result) => {
        movies.value = result
      }).catch((e) => {
        console.error(e)
      }).finally(() => {
        loading.value = false
      })
    }, { immediate: true })

    return {
      movies,
      loading,
      years,
      selectedYear,
    }
  },
})
</script>
<style lang="scss" scoped>
.movie-list {
  display: flex;
  flex-direction: column;
  align-items: center;

  &__filters {
    margin-bottom: 1rem;
  }
}
</style>