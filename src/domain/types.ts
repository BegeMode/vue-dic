export type CTOR = abstract new (...args: any) => any

export type TClass = { constructor: { prototype: unknown } }

export interface IErrorMessage {
  name: string
  text: string
}

export class MaybeError {
  private readonly _messages: Array<IErrorMessage>
  constructor(
    message: string | Array<IErrorMessage>,
    public readonly exception?: Error,
    public readonly data?: unknown,
    public readonly notDisplayError?: boolean
  ) {
    if (Array.isArray(message)) {
      this._messages = message
    } else {
      this._messages = [{ name: '', text: message }]
    }
    if (this.exception && this.exception instanceof MaybeError) {
      this.exception = this.exception.exception
    }
  }
  get message(): string {
    let msg = ''
    this._messages.forEach((err) => {
      if (err.name) {
        msg += `${err.name} - `
      }
      if (err.text) {
        msg += `${err.text}\r\n`
      }
    })
    return msg
  }
  get messages(): Array<IErrorMessage> {
    return this._messages
  }
}

export class MaybeResult<T> {
  value?: T
  error?: MaybeError

  constructor({ value = undefined, error = undefined }: { value?: T; error?: MaybeError } = {}) {
    this.value = value
    this.error = error
  }

  get isFailure(): boolean {
    return Boolean(this.error)
  }

  get message(): string {
    return this.error ? this.error.message : ''
  }
}
