export interface ICommand<TResult, TBrand extends string = string> {
  readonly __brand: TBrand
  cancelable?: boolean
  exec?(): Promise<TResult>
}

export interface ICommandInvoker<TResult = unknown> {
  exec(query: ICommand<TResult>): Promise<TResult>
}
