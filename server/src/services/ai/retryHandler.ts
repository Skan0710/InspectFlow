import {
  AIProviderError,
  AIRateLimitError,
  AITimeoutError,
  AIAuthError,
  AIConfigurationError,
} from './errors.js';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs: number;
  provider: string;
}

const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8000;

/**
 * Checks if an error is considered transient and eligible for retry.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof AIConfigurationError || error instanceof AIAuthError) {
    return false;
  }

  if (error instanceof AIRateLimitError || (error instanceof AIProviderError && error.isRateLimit)) {
    return true;
  }

  if (error instanceof AITimeoutError || (error instanceof AIProviderError && error.isTimeout)) {
    return true;
  }

  if (error instanceof AIProviderError) {
    if (error.statusCode === 400 || error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 404) {
      return false;
    }
    return error.retryable;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('rate limit') ||
      msg.includes('too many requests') ||
      msg.includes('quota exceeded') ||
      msg.includes('resource_exhausted') ||
      msg.includes('timeout') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('fetch failed')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Parses Retry-After header in seconds from Response headers
 */
export function parseRetryAfterSeconds(headers?: Headers): number | undefined {
  if (!headers) return undefined;
  const retryHeader = headers.get('retry-after');
  if (!retryHeader) return undefined;

  const seconds = parseInt(retryHeader, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return seconds;
  }

  // HTTP-date format
  const dateMs = Date.parse(retryHeader);
  if (!isNaN(dateMs)) {
    const diffSec = Math.ceil((dateMs - Date.now()) / 1000);
    return diffSec > 0 ? diffSec : undefined;
  }

  return undefined;
}

/**
 * Sleep with cancellation support
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Operation aborted during backoff delay'));
    }

    const timer = setTimeout(() => {
      resolve();
    }, ms);

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new Error('Operation aborted during backoff delay'));
        },
        { once: true }
      );
    }
  });
}

/**
 * Executes an asynchronous operation with timeout enforcement and bounded retries.
 */
export async function executeWithRetry<T>(
  operation: (signal: AbortSignal, attempt: number) => Promise<T>,
  config: RetryConfig,
  parentSignal?: AbortSignal
): Promise<T> {
  const {
    maxRetries,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    timeoutMs,
    provider,
  } = config;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;
    let didTimeout = false;

    // Connect with parent signal if provided
    const onParentAbort = () => {
      controller.abort();
    };
    if (parentSignal) {
      if (parentSignal.aborted) {
        throw new Error('Operation was cancelled prior to execution');
      }
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }

    // Set timeout timer
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, timeoutMs);
    }

    try {
      const result = await operation(controller.signal, attempt);
      if (timeoutId) clearTimeout(timeoutId);
      if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
      return result;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);

      if (didTimeout) {
        lastError = new AITimeoutError(provider, timeoutMs);
      } else {
        lastError = err;
      }

      // Check if this error should be retried and we still have attempts left
      const canRetry = attempt < maxRetries && isTransientError(lastError);
      if (!canRetry) {
        break;
      }

      // Calculate exponential backoff with jitter
      let delayMs = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200)
      );

      // Respect Retry-After if available
      if (lastError instanceof AIRateLimitError && lastError.retryAfterSeconds) {
        const headerDelayMs = lastError.retryAfterSeconds * 1000;
        delayMs = Math.min(Math.max(delayMs, headerDelayMs), maxDelayMs);
      }

      await sleep(delayMs, parentSignal);
    }
  }

  // All retries exhausted or non-retryable error
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new AIProviderError(`Operation failed after ${maxRetries} retries`, {
    code: 'UPSTREAM_ERROR',
    provider,
    details: lastError,
  });
}
