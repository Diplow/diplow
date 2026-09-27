/**
 * The messages to show for a field's errors. A validator returns a message; a Standard Schema, such as
 * Effect Schema, returns issues that carry one. Anything else has nothing to show.
 */
export function errorMessages(errors: readonly unknown[]): string[] {
  return errors.flatMap((error) => {
    if (typeof error === 'string') return error ? [error] : []
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return typeof error.message === 'string' ? [error.message] : []
    }
    return []
  })
}
