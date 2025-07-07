import { DateUpdateCommand } from '@/domain/commands/date.command'

export const DateCommandQuery = [DateUpdateCommand]

export type DateCommandQueryTypes = InstanceType<(typeof DateCommandQuery)[number]>
