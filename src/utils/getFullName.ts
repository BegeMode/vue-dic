export const getFullName = (firstName?: string | null, lastName?: string | null): string => {
  if (firstName || lastName) {
    return [firstName, lastName]
      .filter(Boolean)
      .map((item) => item?.replace('null', '').trim())
      .join(' ')
      .trim()
  }
  return ''
}
