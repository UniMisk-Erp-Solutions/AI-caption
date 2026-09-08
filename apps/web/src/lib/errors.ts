/**
 * Turn an unknown thrown value into something worth showing a user.
 *
 * `error instanceof Error` is not enough here. Supabase rejects with a plain
 * `PostgrestError` object - `{ message, code, details, hint }` with no Error in
 * its prototype chain - so an instanceof check silently discards the one piece
 * of information that explains the failure. That is exactly how a real upload
 * failure reached the UI as "The video could not be backed up", which says
 * nothing about the database constraint that actually rejected it.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string' && error.trim()) return error;

  if (error && typeof error === 'object') {
    const shape = error as Record<string, unknown>;
    const text = [shape.message, shape.error, shape.details, shape.hint].find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );
    if (text) {
      const code = typeof shape.code === 'string' && shape.code ? ` (${shape.code})` : '';
      return `${text}${code}`;
    }
  }

  return 'Unknown error';
}
