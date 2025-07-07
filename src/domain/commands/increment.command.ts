import { CommandBase } from '@/domain/commands/commandBase'

export class IncrementCommand extends CommandBase<void> {
  constructor(public step: number) {
    super()
  }
}
