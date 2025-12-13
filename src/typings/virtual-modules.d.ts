// Virtual modules from vite-cqrs-register-plugin

declare module 'virtual:queries-registry' {
  export const queriesRegistry: Map<Function, string>
}

declare module 'virtual:commands-registry' {
  export const commandsRegistry: Map<Function, string>
}

