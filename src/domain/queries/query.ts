export interface IQuery<TResult = unknown> {
  fromRemote?: boolean
  cancelable?: boolean
  uid?: string | number // unique identifier of the request (e.g. component uid )
  exec?: () => Promise<TResult>
}

export interface IHostObject {
  id: number | string
  kind?: unknown
}

export interface IInteractiveQuery<TResult> extends IQuery<TResult> {
  title: string
  multiselect?: boolean
  hostObject?: IHostObject
}

export interface IQueryInvoker<TResult = unknown> {
  exec(query: IQuery<TResult>): Promise<TResult>
}
