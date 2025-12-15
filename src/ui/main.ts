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

const ioc = new Container()
ioc.bind<Container>(DEPS.Container).toConstantValue(ioc)
ioc.bind(DEPS_REGISTER).toConstantValue(deps)

const app = createApp(App)

app.provide('_ioc', ioc)

const pinia = createPinia()
app.use(pinia)
app.use(router)

registerStaticDeps(ioc).then(() => {
  Reflect.defineMetadata(QUERY_INVOKER, new QueryInvoker(ioc), QueryBase)
  Reflect.defineMetadata(COMMAND_INVOKER, new CommandInvoker(ioc), CommandBase)
  Reflect.defineMetadata(
    INTERACTIVE_QUERY_INVOKER,
    new InteractiveQueryInvoker(ioc),
    QueryBase
  )
})

app.mount('#app')
