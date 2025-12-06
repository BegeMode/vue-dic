import { CommandBase } from '@/domain/commands/commandBase'

export class IncrementCommand extends CommandBase<void> {
  readonly __brand = 'IncrementCommand' as const

  constructor(public step: number) {
    super()
  }
}
