import type { AllowedComponentProps, Component, VNodeProps } from 'vue'

export enum DialogButton {
  Ok,
  Cancel
}

export interface IDialogResult<T> {
  button: DialogButton
  result: T
}

export interface DialogInfo<T = any> {
  title: string
  okOnly?: boolean
  description?: string | (() => string)
  el?: HTMLElement
  noModal?: boolean
  resolveFunction?: (result: IDialogResult<T> | null) => void
  selectAsOk?: boolean
  okTitle?: string
  okDisabled?: boolean
  cancelTitle?: string
  size?: string
  hideFooter?: boolean
  width?: number | string
  height?: number | string
  fullHeight?: boolean
  closable?: boolean
  isChanged?: () => boolean // ф-ция, вызываемая для определения того, были ли изменения в диалоге
  result?: T
}

export interface DialogWithText<T = any> extends DialogInfo<T> {
  text: string
  checkboxText?: string
}

// https://stackoverflow.com/questions/68602712/extracting-the-prop-types-of-a-component-in-vue-3-typescript-to-use-them-somew
type ComponentProps<C extends Component> = C extends new (...args: any) => any
  ? Omit<InstanceType<C>['$props'], keyof VNodeProps | keyof AllowedComponentProps>
  : never

export interface DialogWithComponent<T = any, TComponent extends Component = Component>
  extends DialogInfo<T> {
  component: TComponent
  props: ComponentProps<TComponent>
}
