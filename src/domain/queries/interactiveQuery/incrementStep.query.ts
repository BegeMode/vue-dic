import { InteractiveQueryBase } from '@/domain/queries/queryIneractiveBase'

export class IncrementStepQuery extends InteractiveQueryBase<number> {
  readonly __brand = 'IncrementStepQuery' as const

  constructor(
    public min: number,
    public max: number
  ) {
    super()
  }
}
