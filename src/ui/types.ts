import * as Vue from 'vue'

export type SetupContextExtended<Deps extends Record<string, unknown> = {}> = Vue.SetupContext & {
  getDep: <T>(id: symbol, args?: unknown[]) => T
  deps: Deps
}

export interface IDeps {
  [key: string]: string | symbol
}

export type TDepIds<T = IDeps> = {
  [K in keyof T]: symbol
}
