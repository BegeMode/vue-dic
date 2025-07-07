import type { ICommand, ICommandInvoker } from '@/domain/commands/command'
import { CommandBase } from '@/domain/commands/commandBase'
import { CommandsQueries } from '@/domain/commandsQueries'
import { injectable } from 'inversify'

@injectable()
export class CommandInvoker<TResult> implements ICommandInvoker<TResult> {
  public async exec(query: ICommand<TResult>): Promise<TResult> {
    const proto = Object.getPrototypeOf(query)
    const loader = CommandsQueries.get(proto.constructor)
    if (loader) {
      await loader()
    }
    const action = Reflect.getMetadata(proto, CommandBase)
    return action(query)
  }
}
