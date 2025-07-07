import '@/assets/main.css'
import 'reflect-metadata'
import '@/infrastructure/stores/register'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@/ui/App.vue'
import router from '@/ui/router'
import { Container } from 'inversify'
import { deps } from '@/ui/deps'
import { DEPS_REGISTER } from '@/infrastructure/ioc/types'
import { registerStaticDeps } from '@/infrastructure/ioc/ioc'
import { INTERACTIVE_QUERY_INVOKER, QUERY_INVOKER } from '@/domain/global'
import { QueryBase } from '@/domain/queries/queryBase'
import { DEPS } from '@/ui/depIds'

const ioc = new Container({ autoBindInjectable: true })
ioc.bind<Container>(DEPS.Container).toConstantValue(ioc)
ioc.bind(DEPS_REGISTER).toConstantValue(deps)

const app = createApp(App)

app.provide('_ioc', ioc)

const pinia = createPinia()
app.use(pinia)
app.use(router)

registerStaticDeps(ioc)
Reflect.defineMetadata(QUERY_INVOKER, ioc.get(DEPS.QueryInvoker), QueryBase)
Reflect.defineMetadata(INTERACTIVE_QUERY_INVOKER, ioc.get(DEPS.InteractiveQueryInvoker), QueryBase)

app.mount('#app')
