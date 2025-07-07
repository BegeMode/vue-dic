export interface ILogger {
  debug(...args: Array<string | unknown>): void
  info(...args: Array<string | unknown>): void
  warn(...args: Array<string | unknown>): void
  error(...args: Array<string | unknown>): void
  fatal(...args: Array<string | unknown>): void
}
