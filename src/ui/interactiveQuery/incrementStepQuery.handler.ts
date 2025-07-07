import { DEPS } from '@/ui/depIds'
import { InteractiveQuery } from '@/decorators/interactiveQuery'
import { injectable } from 'inversify'
import { BaseInteractiveQueryHandler } from '@/ui/interactiveQuery/baseInteractive.handler'
import { DialogButton, type DialogWithComponent } from '@/ui/interactiveQuery/types'
import { IncrementStepQuery } from '@/domain/queries/interactiveQuery/incrementStep.query'
import IncrementStep from '@/ui/components/IncrementStep.vue'

@injectable()
@InteractiveQuery(DEPS.IncrementStepQuery, IncrementStepQuery)
export class IncrementStepQueryHandler extends BaseInteractiveQueryHandler<number> {
  async exec(query: IncrementStepQuery): Promise<number> {
    const dlgInfo: DialogWithComponent<number, typeof IncrementStep> = {
      title: 'Select step',
      component: IncrementStep,
      props: {
        min: query.min,
        max: query.max
      },
      result: query.min
    }
    const dlgResult = await this.waitForDialogResult(dlgInfo)
    return dlgResult.button === DialogButton.Ok ? dlgResult.result : 0
  }
}
