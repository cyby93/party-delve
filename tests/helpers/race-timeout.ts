export function raceTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let handle: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    handle = setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(handle));
}
