import { BaseAIProvider } from './baseProvider.js';
import type { AICompletionRequest, AICompletionResponse } from '../types.js';
import { executeWithRetry, sleep } from '../retryHandler.js';

export interface TestProviderOptions {
  model?: string;
  defaultResponse?: string | Record<string, unknown>;
  simulatedDelayMs?: number;
  maxRetries?: number;
}

/**
 * Deterministic AI Provider designed exclusively for automated unit and integration tests.
 * Never performs real network requests or consumes external API quotas.
 */
export class TestAIProvider extends BaseAIProvider {
  public readonly name = 'test';
  public readonly model: string;

  private responseQueue: string[] = [];
  private errorQueue: Error[] = [];
  private recordedRequests: AICompletionRequest[] = [];
  private defaultResponse: string;
  private simulatedDelayMs: number;
  private maxRetries: number;

  constructor(options: TestProviderOptions = {}) {
    super();
    this.model = options.model || 'deterministic-test-model';
    this.simulatedDelayMs = options.simulatedDelayMs ?? 0;
    this.maxRetries = options.maxRetries ?? 0;

    if (typeof options.defaultResponse === 'object' && options.defaultResponse !== null) {
      this.defaultResponse = JSON.stringify(options.defaultResponse);
    } else {
      this.defaultResponse = options.defaultResponse || JSON.stringify({
        sentiment: 'negative',
        sentiment_score: -0.75,
        urgency: 'high',
        urgency_score: 0.85,
        primary_category: 'Product Feedback',
        topics: ['latency', 'timeout'],
        summary: 'Customer reports severe dashboard latency and request timeouts.',
      });
    }
  }

  public isConfigured(): boolean {
    return true;
  }

  /**
   * Enqueues a scripted response to be returned on the next call
   */
  public enqueueResponse(response: string | Record<string, unknown>): this {
    if (typeof response === 'object' && response !== null) {
      this.responseQueue.push(JSON.stringify(response));
    } else {
      this.responseQueue.push(response);
    }
    return this;
  }

  /**
   * Enqueues an error to be thrown on the next call (useful for simulating 429 rate limits, timeouts)
   */
  public enqueueError(error: Error): this {
    this.errorQueue.push(error);
    return this;
  }

  /**
   * Sets simulated network delay
   */
  public setSimulatedDelay(delayMs: number): this {
    this.simulatedDelayMs = delayMs;
    return this;
  }

  /**
   * Gets list of all recorded requests
   */
  public getRecordedRequests(): readonly AICompletionRequest[] {
    return [...this.recordedRequests];
  }

  /**
   * Clears state queues and recorded history
   */
  public reset(): void {
    this.responseQueue = [];
    this.errorQueue = [];
    this.recordedRequests = [];
    this.simulatedDelayMs = 0;
  }

  public async generateCompletion(request: AICompletionRequest): Promise<AICompletionResponse> {
    const timeoutMs = request.timeoutMs ?? 0;

    return executeWithRetry<AICompletionResponse>(
      async (signal) => {
        const startTime = performance.now();
        this.recordedRequests.push({ ...request });

        // Handle cancellation or simulated timeout
        if (signal.aborted) {
          throw new Error('Request was aborted prior to execution');
        }

        if (this.simulatedDelayMs > 0) {
          await sleep(this.simulatedDelayMs, signal);
        }

        // Check error queue
        if (this.errorQueue.length > 0) {
          const errorToThrow = this.errorQueue.shift()!;
          throw errorToThrow;
        }

        // Determine response content
        let content = this.defaultResponse;
        if (this.responseQueue.length > 0) {
          content = this.responseQueue.shift()!;
        }

        const latencyMs = Math.round(performance.now() - startTime);

        return {
          content,
          provider: this.name,
          model: this.model,
          usage: {
            promptTokens: 42,
            completionTokens: 28,
            totalTokens: 70,
          },
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
