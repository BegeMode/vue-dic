export interface ICommand<TResult> {
  cancelable?: boolean
  exec?(): Promise<TResult>
}

export interface ICommandInvoker<TResult = unknown> {
  exec(query: ICommand<TResult>): Promise<TResult>
}
