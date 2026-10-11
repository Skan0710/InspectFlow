import { BaseAIProvider } from './baseProvider.js';
import type { AICompletionRequest, AICompletionResponse, TokenUsage } from '../types.js';
import {
  AIProviderError,
  AIRateLimitError,
  AIAuthError,
  AIConfigurationError,
} from '../errors.js';
import { executeWithRetry, parseRetryAfterSeconds } from '../retryHandler.js';

export interface OpenAIProviderOptions {
  apiKey: string;
  providerName?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class OpenAIProvider extends BaseAIProvider {
  public readonly name: string;
  public readonly model: string;

  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(options: OpenAIProviderOptions) {
    super();
    this.name = options.providerName || 'openai';
    if (!options.apiKey || options.apiKey.trim().length === 0) {
      throw new AIConfigurationError(this.name, `${this.name} provider requires a valid API key`);
    }
    this.apiKey = options.apiKey.trim();
    this.model = options.model || (this.name === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');
    this.baseUrl = (options.baseUrl || (this.name === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1')).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  public async generateCompletion(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = performance.now();
    const timeoutMs = request.timeoutMs ?? this.timeoutMs;
    const url = `${this.baseUrl}/chat/completions`;

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: request.temperature ?? 0.2,
      response_format: { type: 'json_object' },
    };

    if (request.maxTokens) {
      body.max_tokens = request.maxTokens;
    }

    return executeWithRetry<AICompletionResponse>(
      async (signal) => {
        let response: Response;
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
            signal,
          });
        } catch (fetchErr) {
          throw new AIProviderError(
            fetchErr instanceof Error ? fetchErr.message : `Network error during ${this.name} request`,
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
            `${this.name} rate limit exceeded (HTTP 429).`,
            retryAfter
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new AIAuthError(this.name, `Invalid API key for ${this.name} (HTTP ${response.status}).`);
        }

        if (!response.ok) {
          let errorDetail = `HTTP ${response.status} ${response.statusText}`;
          try {
            const errJson = await response.json() as { error?: { message?: string } };
            if (errJson?.error?.message) {
              errorDetail = errJson.error.message;
            }
          } catch {
            // Ignore response body parse error
          }

          throw new AIProviderError(`${this.name} request failed: ${errorDetail}`, {
            code: response.status >= 500 ? 'UPSTREAM_ERROR' : 'NETWORK_ERROR',
            provider: this.name,
            statusCode: response.status,
            retryable: response.status >= 500,
          });
        }

        const data = await response.json() as {
          choices?: Array<{
            message?: { content?: string };
            finish_reason?: string;
          }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
        };

        const choice = data.choices?.[0];
        const text = choice?.message?.content;

        if (typeof text !== 'string') {
          throw new AIProviderError(`${this.name} response did not contain message content`, {
            code: 'UPSTREAM_ERROR',
            provider: this.name,
            retryable: false,
            details: data,
          });
        }

        const usage: TokenUsage | undefined = data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined;

        const latencyMs = Math.round(performance.now() - startTime);

        return {
          content: text,
          provider: this.name,
          model: this.model,
          usage,
          latencyMs,
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
