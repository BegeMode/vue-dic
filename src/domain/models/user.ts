import { getFullName } from '@/utils/getFullName'

export default class User {
  public id: string = ''

  public firstName: string | null = null

  public lastName: string | null = null

  public username: string = ''

  public email: string = ''

  public phone: string | null = null

  public company: string | null = null

  public balance: number = 0

  public pendingAmount: number = 0

  public avatarId: string = ''

  // public countryId: CountryCode

  // public country: Country

  public timezoneId: string = ''

  // public timezone: Timezone

  // public displayTimeFormat: UserTimeFormat

  // public currency: UserCurrency

  // public status: UserStatus

  // public subaccountType: UserRole

  public emailAccepted: boolean = false

  public isShowShared: boolean = false

  public phoneAccepted: boolean = false

  public lastActive: string = ''

  public createdAt: string = ''

  public isRemoved: boolean = false

  public get fullName(): string {
    return User.getFullName(this)
  }

  public static getFullName(
    user: Pick<User, 'firstName' | 'lastName' | 'email'>,
    withoutEmail?: boolean
  ): string {
    if (!user.firstName && !user.lastName) {
      return withoutEmail ? '' : user.email
    }
    return getFullName(user.firstName, user.lastName)
  }

  // public get isAllowEditSubAccount(): boolean {
  //   return this.subaccountType !== UserRole.SUPER_ADMIN
  // }

  // public get isAllowDetailsPage(): boolean {
  //   return this.status !== UserStatus.ST_SUSPEND && this.status !== UserStatus.ST_FRAUD
  // }

  // public get isCriticallyLowBalance() {
  //   return User.checkCriticallyLowBalance(this)
  // }

  // public static checkCriticallyLowBalance(user: Pick<User, 'status' | 'balance'>) {
  //   return (
  //     (user.status === UserStatus.ST_TRIAL && user.balance < 0.2) ||
  //     (user.status === UserStatus.ST_ACTIVE && user.balance < 5)
  //   )
  // }
}
