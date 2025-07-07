import { DEPS } from '@/ui/depIds'
import { InteractiveQuery } from '@/decorators/interactiveQuery'
import { injectable } from 'inversify'
import { BaseInteractiveQueryHandler } from '@/ui/interactiveQuery/baseInteractive.handler'
import { DialogButton, type DialogWithText } from '@/ui/interactiveQuery/types'
import { ConfirmQuery, type ConfirmResult } from '@/domain/queries/interactiveQuery/confirm.query'

@injectable()
@InteractiveQuery(DEPS.ConfirmQuery, ConfirmQuery)
export class ConfirmQueryHandler extends BaseInteractiveQueryHandler<ConfirmResult> {
  async exec(query: ConfirmQuery): Promise<ConfirmResult> {
    const dlgInfo: DialogWithText<boolean> = {
      text: query.text,
      title: query.title ?? 'Confirm',
      checkboxText: query.checkboxText,
      result: query.checkboxValue
    }
    const result = await this.waitForDialogResult(dlgInfo)
    return { confirmed: result.button === DialogButton.Ok, checkbox: Boolean(result.result) }
  }
}
