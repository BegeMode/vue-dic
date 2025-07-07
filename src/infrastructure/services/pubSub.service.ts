import type { IPubSub } from '@/domain/interfaces/pubSub'
import { injectable } from 'inversify'

@injectable()
export class PubSubService implements IPubSub {
  private events: { [key: string]: Array<(payload: any) => void> } = {}

  publish(event: string, payload: any): void {
    if (!this.events[event]) return
    this.events[event].forEach((handler) => handler(payload))
  }

  subscribe(event: string, handler: (payload: any) => void): void {
    if (!this.events[event]) this.events[event] = []
    this.events[event].push(handler)
  }

  unsubscribe(event: string, handler: (payload: any) => void): void {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter((h) => h !== handler)
  }
}
