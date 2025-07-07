export interface IPubSub {
  publish(event: string, payload: unknown): void
  subscribe(event: string, handler: (payload: unknown) => void): void
  unsubscribe(event: string, handler: (payload: unknown) => void): void
}
