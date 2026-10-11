import type { AIProvider, AIProviderConfig, AIProviderStatus } from './types.js';
import { resolveAIConfig, getSafeAIStatus } from './config.js';
import { UnconfiguredAIProvider } from './providers/unconfiguredProvider.js';
import { TestAIProvider, type TestProviderOptions } from './providers/testProvider.js';
import { GeminiProvider } from './providers/geminiProvider.js';
import { OpenAIProvider } from './providers/openaiProvider.js';

export * from './types.js';
export * from './errors.js';
export * from './jsonParser.js';
export * from './schemaValidators.js';
export * from './retryHandler.js';
export * from './config.js';
export { BaseAIProvider } from './providers/baseProvider.js';
export { TestAIProvider } from './providers/testProvider.js';
export { UnconfiguredAIProvider } from './providers/unconfiguredProvider.js';
export { GeminiProvider } from './providers/geminiProvider.js';
export { OpenAIProvider } from './providers/openaiProvider.js';

let cachedProviderInstance: AIProvider | null = null;

/**
 * Factory function to create a provider instance from configuration or environment.
 */
export function createAIProvider(configOverride?: Partial<AIProviderConfig>): AIProvider {
  const resolved = resolveAIConfig(configOverride);

  if (resolved.provider === 'test') {
    return new TestAIProvider({
      model: resolved.model,
    });
  }

  if (!resolved.isConfigured || !resolved.apiKey) {
    return new UnconfiguredAIProvider();
  }

  switch (resolved.provider) {
    case 'gemini':
      return new GeminiProvider({
        apiKey: resolved.apiKey,
        model: resolved.model,
        baseUrl: resolved.baseUrl,
        timeoutMs: resolved.timeoutMs,
        maxRetries: resolved.maxRetries,
      });

    case 'openai':
      return new OpenAIProvider({
        apiKey: resolved.apiKey,
        providerName: 'openai',
        model: resolved.model,
        baseUrl: resolved.baseUrl,
        timeoutMs: resolved.timeoutMs,
        maxRetries: resolved.maxRetries,
      });

    case 'groq':
      return new OpenAIProvider({
        apiKey: resolved.apiKey,
        providerName: 'groq',
        model: resolved.model,
        baseUrl: resolved.baseUrl,
        timeoutMs: resolved.timeoutMs,
        maxRetries: resolved.maxRetries,
      });

    default:
      return new UnconfiguredAIProvider();
  }
}

/**
 * Returns the active application AI provider singleton.
 */
export function getAIProvider(): AIProvider {
  if (!cachedProviderInstance) {
    cachedProviderInstance = createAIProvider();
  }
  return cachedProviderInstance;
}

/**
 * Resets the cached AI provider singleton (useful in test lifecycle or when env vars change).
 */
export function resetAIProvider(): void {
  cachedProviderInstance = null;
}

/**
 * Returns safe metadata about current AI provider status without leaking secrets.
 */
export function getAIStatus(): AIProviderStatus {
  const resolved = resolveAIConfig();
  return getSafeAIStatus(resolved);
}
