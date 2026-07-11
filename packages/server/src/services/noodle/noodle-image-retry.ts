export const NOODLE_IMAGE_GENERATION_MAX_ATTEMPTS = 2;

export async function generateNoodleImageWithRetry<T>(
  generate: (attempt: number) => Promise<T>,
  onAttemptFailure?: (error: unknown, attempt: number, maxAttempts: number) => void,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= NOODLE_IMAGE_GENERATION_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await generate(attempt);
    } catch (error) {
      lastError = error;
      onAttemptFailure?.(error, attempt, NOODLE_IMAGE_GENERATION_MAX_ATTEMPTS);
    }
  }

  throw lastError;
}
