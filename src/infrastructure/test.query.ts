import { CurrentUserQuery, SampleQuery } from '@/domain/queries/user.query'
import { Queryable } from './queries/query.bus'
import User from '@/domain/models/user'

const delay = (t: number) => new Promise((resolve) => setTimeout(resolve, t))

export class TestQuery {
  @Queryable(CurrentUserQuery)
  public async getCurrentUser(query: CurrentUserQuery) {
    console.log(query)
    await delay(2000)
    return new User()
  }

  @Queryable(SampleQuery)
  public sampleQuery(query: SampleQuery) {
    console.log('sampleQuery', query)
    return 'sampleQuery'
  }
}
