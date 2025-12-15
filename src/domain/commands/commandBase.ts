import type { ICommand, ICommandInvoker } from '@/domain/commands/command'
import { COMMAND_INVOKER } from '@/domain/global'

export abstract class CommandBase<TResult> implements ICommand<TResult> {
  /** Unique brand for nominal typing. Each descendant must define its unique literal. */
  abstract readonly __brand: string
  private static _commandInvoker: ICommandInvoker

  private static get commandInvoker(): ICommandInvoker {
    if (!CommandBase._commandInvoker) {
      CommandBase._commandInvoker = Reflect.getMetadata(COMMAND_INVOKER, CommandBase) as ICommandInvoker
    }
    return CommandBase._commandInvoker
  }

  public exec(): Promise<TResult> {
    return CommandBase.commandInvoker.exec(this) as Promise<TResult>
  }

  public cancelable?: boolean
}
