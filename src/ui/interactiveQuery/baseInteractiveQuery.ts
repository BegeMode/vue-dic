import { ILogger } from 'app/domain/models/logger'
import {
  IModalData,
  IModalInfo,
  IModalResult,
  ModalType
} from 'app/infrastructure/viewModels/modals'
import { IViewModel } from 'app/infrastructure/viewModels/viewModel'
import { ServiceIds } from 'app/service.ids'
import { inject, injectable } from 'inversify'

const DIALOG_OPEN_EVENT = 'dialog:open'

@injectable()
export class BaseInteractiveQueryHandler {
  constructor(@inject(ServiceIds.ILogger) protected _log: ILogger) {}

  protected async alertDialog(
    modalInfo: IModalInfo<IViewModel<number | string>>
  ): Promise<boolean> {
    modalInfo.type = ModalType.Alert
    return this.simpleDialog(modalInfo)
  }

  protected async promptDialog(
    modalInfo: IModalInfo<IViewModel<number | string>>
  ): Promise<string> {
    modalInfo.type = ModalType.Prompt
    modalInfo.twoStepOpen = false
    return new Promise<string>((resolve) => {
      Hub.$nextTick(() => {
        modalInfo.resolveFunction = resolve as (v: string) => void
        Hub.$emit(DIALOG_OPEN_EVENT, modalInfo)
      })
    })
  }

  protected async noticeDialog(
    modalInfo: IModalInfo<IViewModel<number | string>>
  ): Promise<boolean> {
    modalInfo.type = ModalType.Notification
    return this.simpleDialog(modalInfo)
  }

  protected async confirmDialog(
    modalInfo: IModalInfo<IViewModel<number | string>>
  ): Promise<boolean> {
    modalInfo.type = ModalType.Confirm
    return this.simpleDialog(modalInfo)
  }

  /**
   * инфо-диалог с произвольным компонентом, без выбора значений
   */
  protected async openInfoDialog<T>(modalInfo: IModalInfo<T | Array<T>>): Promise<number> {
    modalInfo.type = ModalType.Info
    return this.openTwoStepDialog<T>(modalInfo)
  }

  /**
   * вторая стадия инфо-диалога
   * @param modalId  - Id модального окна, возвращенное openInfoDialog
   * @param modalData - данные, из которых нужно сделать выбор
   */
  protected async waitForInfoDialog<T, TResult>(
    modalId: number,
    modalData: IModalData<T | Array<T>>
  ): Promise<IModalResult<TResult>> {
    return this.waitForTwoStepDialog<T, TResult>(modalData, modalId)
  }

  /**
   * диалог выбора значений, имеет две стадии
   * первая - открыть диалог
   * вторая - отравить в диалог данные
   * @param modalInfo IModalInfo<T>
   * @returns ID модального окна
   */
  protected async openSelectDialog<T>(modalInfo: IModalInfo<T | Array<T>>): Promise<number> {
    modalInfo.type = ModalType.Select
    return this.openTwoStepDialog<T>(modalInfo)
  }

  /**
   * вторая стадия диалога выбора значений
   * @param modalId  - Id модального окна, возвращенное openSelectDialog
   * @param modalData - данные, из которых нужно сделать выбор
   */
  protected async waitForSelectDialog<T, TResult>(
    modalId: number,
    modalData: IModalData<T | Array<T>>
  ): Promise<IModalResult<TResult>> {
    return this.waitForTwoStepDialog<T, TResult>(modalData, modalId)
  }

  /**
   * диалог создания-редактирования чего-либо, имеет две стадии
   * первая - открыть диалог
   * вторая - отравить в диалог данные
   * @param modalInfo IModalInfo<T>
   * @returns ID модального окна
   */
  protected async openCreateEditDialog<T>(modalInfo: IModalInfo<T | Array<T>>): Promise<number> {
    modalInfo.type = ModalType.CreateEdit
    return this.openTwoStepDialog<T>(modalInfo)
  }

  /**
   * вторая стадия диалога создания-редактирования чего-либо
   * @param modalId  - Id модального окна, возвращенное openSelectDialog
   * @param modalData - данные, из которых нужно сделать выбор
   */
  protected async waitForCreateEditDialog<T, TResult>(
    modalId: number,
    modalData: IModalData<T | Array<T>>
  ): Promise<IModalResult<TResult>> {
    return this.waitForTwoStepDialog<T, TResult>(modalData, modalId)
  }

  private async simpleDialog(modalInfo: IModalInfo<IViewModel<number | string>>): Promise<boolean> {
    modalInfo.twoStepOpen = false
    // eslint-disable-next-line sonarjs/no-identical-functions
    return new Promise<boolean>((resolve) => {
      Hub.$nextTick(() => {
        modalInfo.resolveFunction = resolve as (v: boolean) => void
        Hub.$emit(DIALOG_OPEN_EVENT, modalInfo)
      })
    })
  }

  private openTwoStepDialog<T>(modalInfo: IModalInfo<T | Array<T>>) {
    modalInfo.twoStepOpen = true
    // eslint-disable-next-line sonarjs/no-identical-functions
    return new Promise<number>((resolve) => {
      Hub.$nextTick(() => {
        modalInfo.resolveFunction = resolve as (v: number) => void
        Hub.$emit(DIALOG_OPEN_EVENT, modalInfo)
      })
    })
  }

  private waitForTwoStepDialog<T, TResult>(
    modalData: IModalData<T | Array<T>>,
    modalId: number
  ): IModalResult<TResult> | PromiseLike<IModalResult<TResult>> {
    return new Promise<IModalResult<TResult>>((resolve) => {
      Hub.$nextTick(() => {
        modalData.resolveFunction = resolve as unknown as (v: IModalResult<T>) => void
        Hub.$emit('dialog:set-data', modalId, modalData)
      })
    })
  }
}
