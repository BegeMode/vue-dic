import { InteractiveQueryBase } from '@/domain/queries/queryIneractiveBase'

export class AlertQuery extends InteractiveQueryBase<boolean> {
  constructor(
    public text: string,
    public title?: string
  ) {
    super()
  }
}
