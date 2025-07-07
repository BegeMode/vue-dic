export const isFunction = (val: unknown) => typeof val === 'function'
export const isString = (val: unknown) => typeof val === 'string'
export const isSymbol = (val: unknown) => typeof val === 'symbol'
export const isObject = (val: unknown) => val !== null && typeof val === 'object'

export const isPromise = (val: any) => {
  return (isObject(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch)
}
