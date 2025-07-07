import type { ILogger } from '@/domain/interfaces/logger'
import type { IPubSub } from '@/domain/interfaces/pubSub'
import type { IQuery, IQueryInvoker } from '@/domain/queries/query'
import { DIALOG_OPEN_EVENT } from '@/ui/components/dialogContainer/types'
import { DEPS } from '@/ui/depIds'
import { type DialogInfo, type IDialogResult } from '@/ui/interactiveQuery/types'
import { injectable, inject } from 'inversify'

@injectable()
export abstract class BaseInteractiveQueryHandler<T> implements IQueryInvoker<T> {
  constructor(
    @inject(DEPS.Logger) protected logger: ILogger,
    @inject(DEPS.PubSub) protected pubSub: IPubSub
  ) {}

  public abstract exec(query: IQuery<T>): Promise<T>

  protected waitForDialogResult<T>(dlgInfo: DialogInfo<T>): Promise<IDialogResult<T>> {
    return new Promise<IDialogResult<T>>((resolve) => {
      setTimeout(() => {
        dlgInfo.resolveFunction = resolve as (result: IDialogResult<T> | null) => void
        this.pubSub.publish(DIALOG_OPEN_EVENT, dlgInfo)
      })
    })
  }

  // protected async alertDialog(
  //   modalInfo: IDialogInfo<IViewModel<number | string>>
  // ): Promise<boolean> {
  //   modalInfo.type = DialogType.Alert
  //   return this.simpleDialog(modalInfo)
  // }

  // protected async promptDialog(
  //   modalInfo: IDialogInfo<IViewModel<number | string>>
  // ): Promise<string | number> {
  //   modalInfo.type = DialogType.Prompt
  //   modalInfo.twoStepOpen = false
  //   return this.promisifyResult<number | string, IViewModel<number | string>>(
  //     modalInfo,
  //     DIALOG_OPEN_EVENT
  //   )
  // }

  // protected async noticeDialog(
  //   modalInfo: IDialogInfo<IViewModel<number | string>>
  // ): Promise<boolean> {
  //   modalInfo.type = DialogType.Notification
  //   return this.simpleDialog(modalInfo)
  // }

  // protected async confirmDialog(
  //   modalInfo: IDialogInfo<IViewModel<number | string>>
  // ): Promise<boolean> {
  //   modalInfo.type = DialogType.Confirm
  //   return this.simpleDialog(modalInfo)
  // }

  // /**
  //  * info-dialog with any component, without value selection
  //  */
  // protected async openInfoDialog<T>(modalInfo: IDialogInfo<T | Array<T>>): Promise<number> {
  //   modalInfo.type = DialogType.Info
  //   return this.openTwoStepDialog<T>(modalInfo)
  // }

  // /**
  //  * second stage of info-dialog
  //  * @param modalId  - ID of dialog window, returned from openInfoDialog
  //  * @param modalData - data to be selected
  //  */
  // protected async waitForInfoDialog<T, TResult>(
  //   modalId: number,
  //   modalData: IDialogData<T | Array<T>>
  // ): Promise<IDialogResult<TResult>> {
  //   return this.waitForTwoStepDialog<T, TResult>(modalData, modalId)
  // }

  // /**
  //  * the dialog of value selection, has two stages
  //  * first - open dialog
  //  * second - send data to dialog
  //  * @param modalInfo IModalInfo<T>
  //  * @returns ID of dialog window
  //  */
  // protected async openSelectDialog<T>(modalInfo: IDialogInfo<T | Array<T>>): Promise<number> {
  //   modalInfo.type = DialogType.Select
  //   return this.openTwoStepDialog<T>(modalInfo)
  // }

  // /**
  //  * second stage of value selection dialog
  //  * @param modalId  - ID of dialog window, returned from openSelectDialog
  //  * @param modalData - data to be selected
  //  */
  // protected async waitForSelectDialog<T, TResult>(
  //   modalId: number,
  //   modalData: IDialogData<T | Array<T>>
  // ): Promise<IDialogResult<TResult>> {
  //   return this.waitForTwoStepDialog<T, TResult>(modalData, modalId)
  // }

  // /**
  //  * the dialog of creating-editing something, has two stages
  //  * first - open dialog
  //  * second - send data to dialog
  //  * @param modalInfo IModalInfo<T>
  //  * @returns ID of dialog window
  //  */
  // protected async openCreateEditDialog<T>(modalInfo: IDialogInfo<T | Array<T>>): Promise<number> {
  //   modalInfo.type = DialogType.CreateEdit
  //   return this.openTwoStepDialog<T>(modalInfo)
  // }

  // /**
  //  * вторая стадия диалога создания-редактирования чего-либо
  //  * second stage of create-edit dialog
  //  * @param modalId  - Id модального окна, возвращенное openSelectDialog
  //  * @param modalId  - ID of dialog window, returned from openCreateEditDialog
  //  * @param modalData - data to be selected
  //  */
  // protected async waitForCreateEditDialog<T, TResult>(
  //   modalId: number,
  //   modalData: IDialogData<T | Array<T>>
  // ): Promise<IDialogResult<TResult>> {
  //   return this.waitForTwoStepDialog<T, TResult>(modalData, modalId)
  // }

  // private async simpleDialog(
  //   modalInfo: IDialogInfo<IViewModel<number | string>>
  // ): Promise<boolean> {
  //   modalInfo.twoStepOpen = false
  //   return this.promisifyResult<boolean, IViewModel<number | string>>(modalInfo, DIALOG_OPEN_EVENT)
  // }

  // private openTwoStepDialog<T>(modalInfo: IDialogInfo<T | Array<T>>) {
  //   modalInfo.twoStepOpen = true
  //   return this.promisifyResult<number, T | Array<T>>(modalInfo, DIALOG_OPEN_EVENT)
  // }

  // private waitForTwoStepDialog<T, TResult>(
  //   modalData: IDialogData<T | Array<T>>,
  //   modalId: number
  // ): IDialogResult<TResult> | PromiseLike<IDialogResult<TResult>> {
  //   return new Promise<IDialogResult<TResult>>((resolve) => {
  //     setTimeout(() => {
  //       modalData.resolveFunction = resolve as (
  //         value?: number | IDialogResult<T | T[]> | undefined
  //       ) => void
  //       this.pubSub.publish(DIALOG_SET_DATA, { modalId, modalData })
  //     })
  //   })
  // }

  // private promisifyResult<T, TInfo>(modalInfo: IDialogInfo<TInfo>, event: string): Promise<T> {
  //   return new Promise<T>((resolve) => {
  //     setTimeout(() => {
  //       modalInfo.resolveFunction = resolve as (value?: number | IDialogResult<TInfo>) => void
  //       this.pubSub.publish(event, modalInfo)
  //     })
  //   })
  // }
}
