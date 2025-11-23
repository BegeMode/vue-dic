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
    <LoadingSpinner v-if="loading" />
    <ul v-else>
      <li v-for="movie in movies" :key="movie.imdbID">
        {{ movie.Title }} | {{ movie.imdbID }}
      </li>
    </ul>
  </div>
</template>
<script lang="ts">
import type { Movie } from '@/domain/models/movie'
import { MovieListQuery } from '@/domain/queries/movie.query'
import type { SetupContextExtended, TDepIds } from '@/ui/types'
import { defineComponent, ref, watch } from 'vue'
import LoadingSpinner from '@/ui/components/LoadingSpinner.vue'
import type { DateTimeService } from '@/application/dateTimeService'
import { DEPS } from '@/ui/depIds'

type TDeps = {
  dateTimeService: DateTimeService;
}

const deps: TDepIds<TDeps> = {
  dateTimeService: DEPS.DateTime,
}

export default defineComponent({
  components: {
    LoadingSpinner
  },
  deps,
  setup(_props, context) {
    const { deps } = context as SetupContextExtended<TDeps>
    const movies = ref<Movie[]>([])
    const years = ref<number[]>([])
    const startYear = deps.dateTimeService.getYear(deps.dateTimeService.now())
    for (let i = startYear; i > 1999; i--) {
      years.value.push(i)
    }
    const selectedYear = ref<number>(startYear)
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

/*
  LARGE COMMENT TO INCREASE FILE SIZE FOR TESTING SUSPENSE
  ========================================================
  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis 
  nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
  Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore
  eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident,
  sunt in culpa qui officia deserunt mollit anim id est laborum.
  
  Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
  doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore
  veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim
  ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.
  
  At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis
  praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias
  excepturi sint occaecati cupiditate non provident, similique sunt in culpa
  qui officia deserunt mollitia animi, id est laborum et dolorum fuga.
  
  Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore,
  cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod
  maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor
  repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum
  necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae
  non recusandae. Itaque earum rerum hic tenetur a sapiente delectus.
  
  This comment is repeated multiple times to significantly increase file size...
  Lorem ipsum dolor sit amet, consectetur adipiscing elit...
  [Content repeated many times to make file larger for testing purposes]
*/
</style>