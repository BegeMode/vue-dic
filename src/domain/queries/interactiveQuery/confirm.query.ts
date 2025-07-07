import { InteractiveQueryBase } from '@/domain/queries/queryIneractiveBase'

export type ConfirmResult = {
  confirmed: boolean
  checkbox?: boolean
}

export class ConfirmQuery extends InteractiveQueryBase<ConfirmResult> {
  constructor(
    public text: string,
    public title?: string,
    public checkboxText?: string,
    public checkboxValue?: boolean,
    public okTitle?: string,
    public cancelTitle?: string
  ) {
    super()
  }
}
