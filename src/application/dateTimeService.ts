import { injectable } from 'inversify'

@injectable()
export class DateTimeService {
  public now(): Date {
    return new Date()
  }

  public addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  public getYear(date: Date): number {
    return date.getFullYear()
  }
}
