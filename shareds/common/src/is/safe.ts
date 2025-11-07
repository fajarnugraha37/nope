
export const safeCallback = (callback: any, errorHandler?: (error: any) => void) => {
  return (...args: any[]) => {
    try {
      return callback?.(...args)
    } catch (error) {
      if (errorHandler) {
        errorHandler(error)
      } else {
        console.error(error)
      }
    }
  }
}

export const safeConcat = <T>(...args: (T[] | undefined)[]) => {
  return args.map((arg) => arg || []).flat()
}
