import type { AIErrorCode } from './types.js';

/**
 * Sanitizes error messages to remove API keys and sensitive tokens
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return '';
  return message
    .replace(/(?:key|api[_-]?key|token)=([a-zA-Z0-9_\-]{8,})/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+([a-zA-Z0-9_\-\.]{8,})/gi, 'Bearer [REDACTED]')
    .replace(/AIza[0-9A-Za-z\-_]{35}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/sk-ant-[a-zA-Z0-9_\-]{20,}/g, '[REDACTED_ANTHROPIC_KEY]')
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED_OPENAI_KEY]');
}

export interface AIProviderErrorOptions {
  code: AIErrorCode;
  provider: string;
  statusCode?: number;
  retryable?: boolean;
  retryAfterSeconds?: number;
  details?: unknown;
  cause?: Error;
}

export class AIProviderError extends Error {
  public readonly code: AIErrorCode;
  public readonly provider: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly retryAfterSeconds?: number;
  public readonly details?: unknown;

  constructor(message: string, options: AIProviderErrorOptions) {
    const cleanMessage = sanitizeErrorMessage(message);
    super(cleanMessage);
    this.name = 'AIProviderError';
    this.code = options.code;
    this.provider = options.provider;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.details = options.details;

    if (options.cause) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get isRateLimit(): boolean {
    return this.code === 'RATE_LIMITED' || this.statusCode === 429;
  }

  get isTimeout(): boolean {
    return this.code === 'TIMEOUT';
  }

  get isConfigError(): boolean {
    return this.code === 'UNCONFIGURED';
  }

  get isValidationError(): boolean {
    return this.code === 'VALIDATION_ERROR' || this.code === 'PARSE_ERROR';
  }
}

export class AIConfigurationError extends AIProviderError {
  constructor(provider: string, message: string) {
    super(message, {
      code: 'UNCONFIGURED',
      provider,
      retryable: false,
    });
    this.name = 'AIConfigurationError';
  }
}

export class AIRateLimitError extends AIProviderError {
  constructor(provider: string, message: string, retryAfterSeconds?: number) {
    super(message, {
      code: 'RATE_LIMITED',
      provider,
      statusCode: 429,
      retryable: true,
      retryAfterSeconds,
    });
    this.name = 'AIRateLimitError';
  }
}

export class AITimeoutError extends AIProviderError {
  constructor(provider: string, timeoutMs: number) {
    super(`AI provider request timed out after ${timeoutMs}ms`, {
      code: 'TIMEOUT',
      provider,
      retryable: true,
    });
    this.name = 'AITimeoutError';
  }
}

export class AIValidationError extends AIProviderError {
  public readonly validationErrors: string[];

  constructor(provider: string, errors: string[], rawContent?: string) {
    super(`Model response failed strict schema validation: ${errors.join('; ')}`, {
      code: 'VALIDATION_ERROR',
      provider,
      retryable: false,
      details: { errors, rawContent },
    });
    this.name = 'AIValidationError';
    this.validationErrors = errors;
  }
}

export class AIParseError extends AIProviderError {
  constructor(provider: string, parseErrorMessage: string, rawContent?: string) {
    super(`Failed to parse model output as JSON: ${parseErrorMessage}`, {
      code: 'PARSE_ERROR',
      provider,
      retryable: false,
      details: { parseErrorMessage, rawContent },
    });
    this.name = 'AIParseError';
  }
}

export class AIAuthError extends AIProviderError {
  constructor(provider: string, message: string) {
    super(`Authentication failed for AI provider ${provider}: ${message}`, {
      code: 'AUTH_ERROR',
      provider,
      statusCode: 401,
      retryable: false,
    });
    this.name = 'AIAuthError';
  }
}
