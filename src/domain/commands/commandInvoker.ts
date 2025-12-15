import type { ICommand, ICommandInvoker } from '@/domain/commands/command'
import { CommandBase } from '@/domain/commands/commandBase'
import type { Container } from 'inversify'
import { getServiceAsync } from '@/infrastructure/ioc/ioc'

// Lazy import to avoid circular dependency:
// CommandBase → CommandInvoker → virtual:commands-registry → IncrementCommand → CommandBase
let commandsRegistry: Map<Function, string> | null = null

async function getCommandsRegistry(): Promise<Map<Function, string>> {
  if (!commandsRegistry) {
    const module = await import('virtual:commands-registry')
    commandsRegistry = module.commandsRegistry
  }
  return commandsRegistry
}

export class CommandInvoker<TResult> implements ICommandInvoker<TResult> {
  constructor(private readonly ioc: Container) {}

  public async exec(command: ICommand<TResult>): Promise<TResult> {
    const proto = Object.getPrototypeOf(command)

    // Get Store ID from registry and load store if needed
    const registry = await getCommandsRegistry()
    const storeId = registry.get(proto.constructor)
    if (storeId) {
      await getServiceAsync(storeId, this.ioc)
    }

    const action = Reflect.getMetadata(proto, CommandBase)
    return action(command)
  }
}
