import { CommandBase } from '@/domain/commands/commandBase'

export class DateUpdateCommand extends CommandBase<void> {
  constructor(public dt: Date) {
    super()
  }
}
