export type TFunc = (...args: any[]) => any
export type TAction<Q, R> = (query: Q) => Promise<R>
