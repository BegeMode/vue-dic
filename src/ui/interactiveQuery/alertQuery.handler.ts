import { DEPS } from '@/ui/depIds'
import { AlertQuery } from '@/domain/queries/interactiveQuery/alert.query'
import { InteractiveQuery } from '@/decorators/interactiveQuery'
import { injectable, injectFromBase } from 'inversify'
import { BaseInteractiveQueryHandler } from '@/ui/interactiveQuery/baseInteractive.handler'
import type { DialogWithText } from '@/ui/interactiveQuery/types'

@injectable()
@injectFromBase()
@InteractiveQuery(DEPS.AlertQuery, AlertQuery)
export class AlertQueryHandler extends BaseInteractiveQueryHandler<boolean> {
  async exec(query: AlertQuery): Promise<boolean> {
    const dlgInfo: DialogWithText<boolean> = {
      text: query.text,
      title: query.title ?? 'Alert',
      okOnly: true
    }
    await this.waitForDialogResult(dlgInfo)
    return true
  }
}
