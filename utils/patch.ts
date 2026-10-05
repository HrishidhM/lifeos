/** Zod 4 applies `.default()` inside `.partial()`, which would silently reset untouched columns on update. Keep only the keys the caller actually passed. */
export function onlyProvided<T extends Record<string, unknown>>(parsed: T, input: Record<string, unknown>): Partial<T> {
  return Object.fromEntries(Object.entries(parsed).filter(([k]) => input[k] !== undefined)) as Partial<T>;
}
