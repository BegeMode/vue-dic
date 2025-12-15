import type { Container } from 'inversify'
import type { ICommand, ICommandInvoker } from '@/domain/commands/command'
import { COMMAND_INVOKER } from '@/domain/global'
import { getActiveContainer } from '@/ui/appContext'

export abstract class CommandBase<TResult> implements ICommand<TResult> {
  /** Unique brand for nominal typing. Each descendant must define its unique literal. */
  abstract readonly __brand: string

  public cancelable?: boolean

  /**
   * Container captured at the moment of command creation.
   * This ensures async operations use the correct container
   * even if the active app changes during execution.
   */
  private readonly _capturedContainer: Container | null = getActiveContainer()

  private get commandInvoker(): ICommandInvoker {
    if (this._capturedContainer) {
      return this._capturedContainer.get<ICommandInvoker>(COMMAND_INVOKER)
    }
    // Fallback to global metadata (for backwards compatibility)
    return Reflect.getMetadata(COMMAND_INVOKER, CommandBase) as ICommandInvoker
  }

  /**
  * Executes the command. Called when store where the command is implemented is not yet loaded.
  * @returns The result of the command execution.
  */
  public exec(): Promise<TResult> {
    return this.commandInvoker.exec(this) as Promise<TResult>
  }
}
