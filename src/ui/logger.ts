import type { ILogger } from '@/domain/interfaces/logger'
import { injectable } from 'inversify'

const logLevel = import.meta.env.DEV ? 'debug' : 'error'
// process.env.NODE_ENV === 'development'

@injectable()
export class Logger implements ILogger {
  debug(...args: Array<unknown>) {
    if (logLevel !== 'debug') {
      return
    }
    // eslint-disable-next-line no-console
    console.log(...args)
  }

  info(...args: Array<unknown>) {
    const [arg0, ...rest] = args
    // eslint-disable-next-line no-console
    console.info('%c ' + arg0, ...rest, 'background: #222; color: #bada55')
  }

  warn(...args: Array<unknown>) {
    // eslint-disable-next-line no-console
    console.warn(...args)
  }

  error(...args: Array<unknown>) {
    // eslint-disable-next-line no-console
    console.error(...args)
  }

  fatal(...args: Array<unknown>) {
    // eslint-disable-next-line no-console
    console.error(...args)
  }
}
