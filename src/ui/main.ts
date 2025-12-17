import '@/assets/main.css'
import 'reflect-metadata'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@/ui/App.vue'
import router from '@/ui/router'
import { Container } from 'inversify'
import { deps } from '@/ui/deps'
import { DEPS_REGISTER } from '@/infrastructure/ioc/types'
import { registerStaticDeps } from '@/infrastructure/ioc/ioc'
import { COMMAND_INVOKER, INTERACTIVE_QUERY_INVOKER, QUERY_INVOKER } from '@/domain/global'
import { QueryBase } from '@/domain/queries/queryBase'
import { DEPS } from '@/ui/depIds'
import { CommandBase } from '@/domain/commands/commandBase'
import { QueryInvoker } from '@/domain/queries/queryInvoker'
import { CommandInvoker } from '@/domain/commands/commandInvoker'
import { InteractiveQueryInvoker } from '@/ui/interactiveQueryInvoker'
import { registerApp, setActiveContainer } from '@/ui/appContext'

function createAppInstance(rootEl: HTMLElement) {
  const ioc = new Container()
  ioc.bind<Container>(DEPS.Container).toConstantValue(ioc)
  ioc.bind(DEPS_REGISTER).toConstantValue(deps)

  // Register invokers in the IoC container for multi-app support
  ioc.bind<QueryInvoker<unknown>>(QUERY_INVOKER).toConstantValue(new QueryInvoker(ioc))
  ioc.bind<CommandInvoker<unknown>>(COMMAND_INVOKER).toConstantValue(new CommandInvoker(ioc))
  ioc.bind<InteractiveQueryInvoker<unknown>>(INTERACTIVE_QUERY_INVOKER).toConstantValue(
    new InteractiveQueryInvoker(ioc)
  )

  const app = createApp(App)

  app.provide('_ioc', ioc)

  const pinia = createPinia()
  app.use(pinia)
  app.use(router)

  // Set as active container before mounting (for queries created during setup)
  setActiveContainer(ioc)

  registerStaticDeps(ioc).then(() => {
    // Keep global metadata as fallback for backwards compatibility
    Reflect.defineMetadata(QUERY_INVOKER, ioc.get(QUERY_INVOKER), QueryBase)
    Reflect.defineMetadata(COMMAND_INVOKER, ioc.get(COMMAND_INVOKER), CommandBase)
    Reflect.defineMetadata(INTERACTIVE_QUERY_INVOKER, ioc.get(INTERACTIVE_QUERY_INVOKER), QueryBase)
  })

  app.mount(rootEl)

  // Register app for automatic context switching on user interaction
  registerApp(app, ioc, rootEl)
}

const el = document.querySelector('#app') as HTMLElement
if (el) {
  createAppInstance(el)
}
