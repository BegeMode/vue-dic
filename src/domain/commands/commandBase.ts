import type { ICommand, ICommandInvoker } from '@/domain/commands/command'
import { CommandInvoker } from '@/domain/commands/commandInvoker'

export abstract class CommandBase<TResult> implements ICommand<TResult> {
  /** Уникальный бренд для номинальной типизации. Каждый наследник должен определить свой уникальный литерал. */
  abstract readonly __brand: string
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
