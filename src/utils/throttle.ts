/**
 * Native throttle implementation to replace lodash dependency
 * Ensures a function is called at most once per specified interval
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null
  let lastExecTime = 0

  return function throttled(this: unknown, ...args: Parameters<T>) {
    const currentTime = Date.now()

    const execute = () => {
      lastExecTime = Date.now()
      func.apply(this, args)
    }

    if (currentTime - lastExecTime >= delay) {
      execute()
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(() => {
        execute()
        timeoutId = null
      }, delay - (currentTime - lastExecTime))
    }
  }
}

/**
 * Throttle with leading and trailing options
 * @param func Function to throttle
 * @param delay Delay in milliseconds
 * @param options.leading Execute on leading edge (default: true)
 * @param options.trailing Execute on trailing edge (default: true)
 */
export function throttleAdvanced<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): (...args: Parameters<T>) => void {
  const { leading = true, trailing = true } = options
  let timeoutId: NodeJS.Timeout | null = null
  let lastExecTime = 0
  let lastArgs: Parameters<T> | null = null

  return function throttled(this: unknown, ...args: Parameters<T>) {
    const currentTime = Date.now()
    const timeSinceLastExec = currentTime - lastExecTime
    const context = this

    lastArgs = args

    const execute = () => {
      lastExecTime = Date.now()
      if (lastArgs !== null) {
        func.apply(context, lastArgs)
        lastArgs = null
      }
    }

    const shouldExecuteImmediately = leading && timeSinceLastExec >= delay

    if (shouldExecuteImmediately) {
      execute()
    }

    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    if (trailing && !shouldExecuteImmediately) {
      const remainingTime = delay - timeSinceLastExec
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          execute()
        }
        timeoutId = null
      }, remainingTime > 0 ? remainingTime : delay)
    }
  }
}