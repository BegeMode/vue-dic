import { InteractiveQueryBase } from '@/domain/queries/queryIneractiveBase'

export class IncrementStepQuery extends InteractiveQueryBase<number> {
  constructor(
    public min: number,
    public max: number
  ) {
    super()
  }
}
