import { BaseAIProvider } from './baseProvider.js';
import type { AICompletionRequest, AICompletionResponse, TokenUsage } from '../types.js';
import {
  AIProviderError,
  AIRateLimitError,
  AIAuthError,
  AIConfigurationError,
} from '../errors.js';
import { executeWithRetry, parseRetryAfterSeconds } from '../retryHandler.js';

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

const ANTHROPIC_API_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 2048;

export class AnthropicProvider extends BaseAIProvider {
  public readonly name = 'anthropic';
  public readonly model: string;

  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(options: AnthropicProviderOptions) {
    super();
    if (!options.apiKey || options.apiKey.trim().length === 0) {
      throw new AIConfigurationError('anthropic', 'AnthropicProvider requires a valid ANTHROPIC_API_KEY');
    }
    this.apiKey = options.apiKey.trim();
    this.model = options.model || 'claude-haiku-5-5';
    this.baseUrl = (options.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  public async generateCompletion(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = performance.now();
    const timeoutMs = request.timeoutMs ?? this.timeoutMs;
    const url = `${this.baseUrl}/messages`;

    const body: Record<string, unknown> = {
      model: this.model,
      // The Messages API requires max_tokens on every request
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: request.temperature ?? 0.2,
      messages: [{ role: 'user', content: request.prompt }],
    };

    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }

    return executeWithRetry<AICompletionResponse>(
      async (signal) => {
        let response: Response;
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey,
              'anthropic-version': ANTHROPIC_API_VERSION,
            },
            body: JSON.stringify(body),
            signal,
          });
        } catch (fetchErr) {
          throw new AIProviderError(
            fetchErr instanceof Error ? fetchErr.message : 'Network error during Anthropic request',
            {
              code: 'NETWORK_ERROR',
              provider: this.name,
              retryable: true,
              cause: fetchErr instanceof Error ? fetchErr : undefined,
            }
          );
        }

        if (response.status === 429) {
          const retryAfter = parseRetryAfterSeconds(response.headers);
          throw new AIRateLimitError(
            this.name,
            'Anthropic API rate limit exceeded (HTTP 429).',
            retryAfter
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new AIAuthError(this.name, `Anthropic authentication rejected (HTTP ${response.status}).`);
        }

        if (!response.ok) {
          let errorDetail = `HTTP ${response.status} ${response.statusText}`;
          try {
            const errJson = (await response.json()) as { error?: { message?: string } };
            if (errJson?.error?.message) {
              errorDetail = errJson.error.message;
            }
          } catch {
            // Ignore response body parse error
          }

          // 529 is Anthropic's "overloaded" status; it is transient like any 5xx
          throw new AIProviderError(`Anthropic request failed: ${errorDetail}`, {
            code: response.status >= 500 ? 'UPSTREAM_ERROR' : 'NETWORK_ERROR',
            provider: this.name,
            statusCode: response.status,
            retryable: response.status >= 500,
          });
        }

        const data = (await response.json()) as {
          content?: Array<{ type?: string; text?: string }>;
          usage?: { input_tokens?: number; output_tokens?: number };
        };

        const text = data.content
          ?.filter((block) => block.type === 'text' && typeof block.text === 'string')
          .map((block) => block.text)
          .join('');

        if (!text) {
          throw new AIProviderError('Anthropic response did not contain text content', {
            code: 'UPSTREAM_ERROR',
            provider: this.name,
            retryable: false,
            details: data,
          });
        }

        const usage: TokenUsage | undefined = data.usage
          ? {
              promptTokens: data.usage.input_tokens,
              completionTokens: data.usage.output_tokens,
              totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
            }
          : undefined;

        return {
          content: text,
          provider: this.name,
          model: this.model,
          usage,
          latencyMs: Math.round(performance.now() - startTime),
        };
      },
      {
        maxRetries: this.maxRetries,
        timeoutMs,
        provider: this.name,
      },
      request.signal
    );
  }
}
