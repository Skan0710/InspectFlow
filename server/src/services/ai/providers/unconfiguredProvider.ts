import { AIConfigurationError } from '../errors.js';
import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  AIStructuredRequest,
  AIStructuredResponse,
} from '../types.js';

/**
 * Safe unconfigured provider.
 * Returned when no provider or credentials are provided in the environment.
 * Does NOT hardcode model names, API endpoints, or attempt unauthorized network calls.
 */
export class UnconfiguredAIProvider implements AIProvider {
  public readonly name = 'unconfigured';
  public readonly model = '';

  public isConfigured(): boolean {
    return false;
  }

  public async generateCompletion(_request: AICompletionRequest): Promise<AICompletionResponse> {
    throw new AIConfigurationError(
      this.name,
      'AI Provider is not configured. Please supply AI_PROVIDER and the corresponding API key (e.g. GEMINI_API_KEY, OPENAI_API_KEY) in server environment variables.'
    );
  }

  public async generateStructured<T>(_request: AIStructuredRequest<T>): Promise<AIStructuredResponse<T>> {
    throw new AIConfigurationError(
      this.name,
      'AI Provider is not configured. Please supply AI_PROVIDER and the corresponding API key (e.g. GEMINI_API_KEY, OPENAI_API_KEY) in server environment variables.'
    );
  }
}
