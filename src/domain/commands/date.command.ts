import { CommandBase } from '@/domain/commands/commandBase'

export class DateUpdateCommand extends CommandBase<void> {
  readonly __brand = 'DateUpdateCommand' as const

  constructor(public dt: Date) {
    super()
  }
}
