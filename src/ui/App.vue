<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import HelloWorld from '@/ui/components/HelloWorld.vue'
import DialogContainer from '@/ui/components/dialogContainer/dialogContainer.vue'
import ErrorBoundary from '@/ui/ErrorBoundary.vue'
import { preloadView } from '@/ui/router/loadView'
</script>

<template>
  <header>
    <img alt="Vue logo" class="logo" src="@/assets/logo.svg" width="125" height="125" />

    <div class="wrapper">
      <Suspense :suspensible="true">
        <HelloWorld msg="You did it!!!" />
      </Suspense>
      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about" @mouseenter="() => preloadView('AboutView')">About</RouterLink>
        <RouterLink to="/movies" @mouseenter="() => preloadView('MovieList')">Movie list</RouterLink>
      </nav>
    </div>
  </header>

  <ErrorBoundary>
    <Suspense>
      <template #default>
        <RouterView />
      </template>
      <template #fallback>
        Loading...
      </template>
    </Suspense>
  </ErrorBoundary>

  <Suspense>
    <dialog-container />
  </Suspense>
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

.loading-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  padding: 2rem;
}

.loading-fallback h2 {
  margin-bottom: 1rem;
  color: #2c3e50;
  font-size: 1.5rem;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
