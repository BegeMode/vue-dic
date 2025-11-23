import { injectable } from 'inversify'

@injectable()
export class FirstService {
  constructor() {
    console.log('FirstService constructor')
  }

  public getMessage(): string {
    return 'Hello, world! from FirstService'
  }
}
