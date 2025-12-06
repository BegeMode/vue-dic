import { InteractiveQueryBase } from '@/domain/queries/queryIneractiveBase'

export class PromptQuery extends InteractiveQueryBase<string | number> {
  readonly __brand = 'PromptQuery' as const

  constructor(
    public title: string,
    public initValue?: string | number,
    public width?: number | string
  ) {
    super()
  }
}
