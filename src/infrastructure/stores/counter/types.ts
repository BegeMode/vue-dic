import { IncrementCommand } from '@/domain/commands/increment.command'
import { CurrentUserQuery } from '@/domain/queries/user.query'

export const CommandQuery = [CurrentUserQuery, IncrementCommand]

export type CommandQueryTypes = InstanceType<(typeof CommandQuery)[number]>
