import { BaseAIProvider } from './baseProvider.js';
import type { AICompletionRequest, AICompletionResponse, TokenUsage } from '../types.js';
import {
  AIProviderError,
  AIRateLimitError,
  AIAuthError,
  AIConfigurationError,
} from '../errors.js';
import { executeWithRetry, parseRetryAfterSeconds } from '../retryHandler.js';

export interface GeminiProviderOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class GeminiProvider extends BaseAIProvider {
  public readonly name = 'gemini';
  public readonly model: string;

  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(options: GeminiProviderOptions) {
    super();
    if (!options.apiKey || options.apiKey.trim().length === 0) {
      throw new AIConfigurationError('gemini', 'GeminiProvider requires a valid GEMINI_API_KEY');
    }
    this.apiKey = options.apiKey.trim();
    this.model = options.model || 'gemini-1.5-flash';
    this.baseUrl = (options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  public async generateCompletion(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = performance.now();
    const timeoutMs = request.timeoutMs ?? this.timeoutMs;
    const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: request.prompt }],
        },
      ],
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        responseMimeType: 'application/json',
      },
    };

    if (request.maxTokens) {
      (body.generationConfig as Record<string, unknown>).maxOutputTokens = request.maxTokens;
    }

    if (request.systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: request.systemPrompt }],
      };
    }

    return executeWithRetry<AICompletionResponse>(
      async (signal) => {
        let response: Response;
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal,
          });
        } catch (fetchErr) {
          throw new AIProviderError(
            fetchErr instanceof Error ? fetchErr.message : 'Network error during Gemini request',
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
            'Gemini API quota/rate limit exceeded (HTTP 429).',
            retryAfter
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new AIAuthError(this.name, `Gemini authentication rejected (HTTP ${response.status}).`);
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

          throw new AIProviderError(`Gemini request failed: ${errorDetail}`, {
            code: response.status >= 500 ? 'UPSTREAM_ERROR' : 'NETWORK_ERROR',
            provider: this.name,
            statusCode: response.status,
            retryable: response.status >= 500,
          });
        }

        const data = await response.json() as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
            finishReason?: string;
          }>;
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        };

        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        if (typeof text !== 'string') {
          throw new AIProviderError('Gemini response did not contain text content', {
            code: 'UPSTREAM_ERROR',
            provider: this.name,
            retryable: false,
            details: data,
          });
        }

        const usage: TokenUsage | undefined = data.usageMetadata
          ? {
              promptTokens: data.usageMetadata.promptTokenCount,
              completionTokens: data.usageMetadata.candidatesTokenCount,
              totalTokens: data.usageMetadata.totalTokenCount,
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
