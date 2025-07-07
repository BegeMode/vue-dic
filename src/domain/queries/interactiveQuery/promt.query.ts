import { InteractiveQueryBase } from '@/domain/queries/queryIneractiveBase'

export class PromptQuery extends InteractiveQueryBase<string | number> {
  constructor(
    public title: string,
    public initValue?: string | number,
    public width?: number | string
  ) {
    super()
  }
}
