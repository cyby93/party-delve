export function serialize<T>(data: T): string {
  return JSON.stringify(data);
}

export function deserialize<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new SyntaxError(`deserialize: malformed JSON — ${raw.slice(0, 80)}`);
  }
}
