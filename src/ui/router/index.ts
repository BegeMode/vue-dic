import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/ui/views/HomeView.vue'
import { loadView } from '@/ui/router/loadView'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/about',
      name: 'about',
      component: loadView(() => import('@/ui/views/AboutView.vue'))
    },
    {
      path: '/movies',
      name: 'movies',
      component: loadView(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(import(`@/ui/views/MovieList.vue`)), 2000)
          )
      )
    }
  ]
})

export default router
