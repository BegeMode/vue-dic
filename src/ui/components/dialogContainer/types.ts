import type { DialogWithComponent, DialogWithText } from '@/ui/interactiveQuery/types'

export const DIALOG_OPEN_EVENT = 'dialog:open'
export const DIALOG_SET_DATA = 'dialog:set-data'
export const DIALOG_CLOSE_ALL = 'dialog:close:all'

// export type DialogWindow<T = any> = DialogWithText<T> | DialogWithComponent<T>

export type DialogWindow<T = any> = (DialogWithComponent<T> | DialogWithText<T>) & {
  id: number
  show: boolean
  okLoading: boolean
  componentInstance?: { save?(): void }
  resolved: boolean
  result: T | null
}
