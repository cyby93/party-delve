export const raceTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms)
  )]);
