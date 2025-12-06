import { InteractiveQueryBase } from '@/domain/queries/queryIneractiveBase'

export class AlertQuery extends InteractiveQueryBase<boolean> {
  readonly __brand = 'AlertQuery' as const

  constructor(
    public text: string,
    public title?: string
  ) {
    super()
  }
}
