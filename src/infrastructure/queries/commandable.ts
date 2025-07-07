import { isTest } from '@/utils/system'
import type { ICommand } from '@/domain/commands/command'
import type { TAction } from '@/infrastructure/stores/types'
import { CommandBase } from '@/domain/commands/commandBase'

export type TCommandResult<T> = T extends ICommand<infer TResult> ? TResult : never

function commandable<TCommand extends ICommand<TResult>, TResult>(
  command: { prototype: TCommand; name: string },
  action: TAction<TCommand, TResult>
) {
  if (
    !isTest() &&
    (action.name !== 'wrappedAction' || Object.getOwnPropertySymbols(action).length < 2)
  ) {
    throw new Error(`Action ${action.name} is not a Pinia action`)
  }
  const found = Reflect.getMetadata(command.prototype, CommandBase)
  if (found) {
    throw new Error(`Action for ${command.name} already exists`)
  }
  Reflect.defineMetadata(command.prototype, action, CommandBase)
  command.prototype.exec = function () {
    return action(this)
  }
  return action
}

export function getCommandableFunc<T extends ICommand<TCommandResult<T>>>() {
  return function <R extends T>(
    command: { prototype: R; name: string },
    action: TAction<R, TCommandResult<R>>
  ) {
    return commandable(command, action)
  }
}
