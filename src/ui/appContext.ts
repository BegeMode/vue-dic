import type { Container } from 'inversify'
import type { App } from 'vue'

interface AppInstance {
  app: App
  container: Container
  rootEl: HTMLElement
}

const apps = new Map<HTMLElement, AppInstance>()
let activeContainer: Container | null = null

/**
 * Returns the currently active IoC container.
 * The active container is determined by user interaction (focus, pointer, keyboard events).
 */
export function getActiveContainer(): Container | null {
  return activeContainer
}

/**
 * Manually sets the active container.
 * Useful for initial setup or programmatic switching.
 */
export function setActiveContainer(container: Container | null): void {
  activeContainer = container
}

/**
 * Registers a Vue app instance with its IoC container.
 * Sets up event listeners to automatically switch the active container
 * when the user interacts with the app.
 */
export function registerApp(app: App, container: Container, rootEl: HTMLElement): void {
  const instance: AppInstance = { app, container, rootEl }
  apps.set(rootEl, instance)

  const activateHandler = () => {
    activeContainer = container
  }

  // Use capturing phase to intercept events before any other handlers
  rootEl.addEventListener('focusin', activateHandler, true)
  rootEl.addEventListener('pointerdown', activateHandler, true)
  rootEl.addEventListener('keydown', activateHandler, true)

  // Store cleanup function for later use
  ;(rootEl as any).__appContextCleanup = () => {
    rootEl.removeEventListener('focusin', activateHandler, true)
    rootEl.removeEventListener('pointerdown', activateHandler, true)
    rootEl.removeEventListener('keydown', activateHandler, true)
  }

  // Make the first registered app active by default
  if (apps.size === 1) {
    activeContainer = container
  }
}

/**
 * Unregisters a Vue app instance.
 * Cleans up event listeners and switches to another app if available.
 */
export function unregisterApp(rootEl: HTMLElement): void {
  const instance = apps.get(rootEl)
  
  // Clean up event listeners
  const cleanup = (rootEl as any).__appContextCleanup
  if (cleanup) {
    cleanup()
    delete (rootEl as any).__appContextCleanup
  }

  // If this was the active app, switch to another one
  if (instance && activeContainer === instance.container) {
    activeContainer = null
    const remaining = [...apps.values()].find(a => a.rootEl !== rootEl)
    if (remaining) {
      activeContainer = remaining.container
    }
  }

  apps.delete(rootEl)
}

/**
 * Returns all registered app instances.
 * Useful for debugging or advanced scenarios.
 */
export function getRegisteredApps(): ReadonlyMap<HTMLElement, AppInstance> {
  return apps
}
