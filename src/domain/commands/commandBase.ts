import type { ICommand, ICommandInvoker } from '@/domain/commands/command'
import { CommandInvoker } from '@/domain/commands/commandInvoker'

export class CommandBase<TResult> implements ICommand<TResult> {
  private static _commandInvoker: ICommandInvoker

  private static get commandInvoker(): ICommandInvoker {
    if (!CommandBase._commandInvoker) {
      // inversify not used to be able to create comannds with new operator (e.g. new UserUpdateCommand())
      CommandBase._commandInvoker = new CommandInvoker()
    }
    return CommandBase._commandInvoker
  }

  public exec(): Promise<TResult> {
    return CommandBase.commandInvoker.exec(this) as Promise<TResult>
  }

  public cancelable?: boolean
}
