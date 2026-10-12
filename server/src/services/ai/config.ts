import type { AIProviderConfig, AIProviderStatus, AIProviderType } from './types.js';

export interface ResolvedAIConfig {
  provider: AIProviderType;
  apiKey?: string;
  model: string;
  baseUrl?: string;
  timeoutMs: number;
  maxRetries: number;
  isConfigured: boolean;
}

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Returns default model ONLY when valid configuration is detected.
 * Never hardcodes or returns a model when provider is unconfigured.
 */
function getDefaultModelForConfiguredProvider(provider: AIProviderType): string {
  switch (provider) {
    case 'gemini':
      return 'gemini-1.5-flash';
    case 'openai':
      return 'gpt-4o-mini';
    case 'groq':
      return 'llama-3.3-70b-versatile';
    case 'anthropic':
      return 'claude-haiku-5-5';
    case 'test':
      return 'deterministic-test-model';
    default:
      return '';
  }
}

/**
 * Resolves current AI Provider settings from environment variables.
 * Credentials are kept strictly on the server and never exposed.
 */
export function resolveAIConfig(override?: Partial<AIProviderConfig>): ResolvedAIConfig {
  const envProvider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  const envModel = (process.env.AI_MODEL || '').trim();
  const envBaseUrl = (process.env.AI_BASE_URL || '').trim();
  const envTimeout = process.env.AI_TIMEOUT_MS ? parseInt(process.env.AI_TIMEOUT_MS, 10) : NaN;
  const envRetries = process.env.AI_MAX_RETRIES ? parseInt(process.env.AI_MAX_RETRIES, 10) : NaN;

  const timeoutMs = override?.timeoutMs ?? (!isNaN(envTimeout) && envTimeout > 0 ? envTimeout : DEFAULT_TIMEOUT_MS);
  const maxRetries = override?.maxRetries ?? (!isNaN(envRetries) && envRetries >= 0 ? envRetries : DEFAULT_MAX_RETRIES);

  // If explicitly given in override or test environment
  if (override?.provider) {
    const isTest = override.provider === 'test';
    const isConfigured = isTest || Boolean(override.apiKey);
    return {
      provider: override.provider,
      apiKey: override.apiKey,
      model: override.model || (isConfigured ? getDefaultModelForConfiguredProvider(override.provider) : ''),
      baseUrl: override.baseUrl,
      timeoutMs,
      maxRetries,
      isConfigured,
    };
  }

  // Check if test provider requested
  if (envProvider === 'test' || (process.env.NODE_ENV === 'test' && !envProvider)) {
    return {
      provider: 'test',
      apiKey: undefined,
      model: envModel || getDefaultModelForConfiguredProvider('test'),
      baseUrl: envBaseUrl || undefined,
      timeoutMs,
      maxRetries,
      isConfigured: true,
    };
  }

  // Resolve provider from explicit env or detect from available keys
  let provider: AIProviderType = 'unconfigured';
  let apiKey: string | undefined;
  let defaultBaseUrl: string | undefined;

  if (envProvider === 'gemini') {
    provider = 'gemini';
    apiKey = process.env.GEMINI_API_KEY;
  } else if (envProvider === 'openai') {
    provider = 'openai';
    apiKey = process.env.OPENAI_API_KEY;
  } else if (envProvider === 'groq') {
    provider = 'groq';
    apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
    defaultBaseUrl = 'https://api.groq.com/openai/v1';
  } else if (envProvider === 'anthropic') {
    provider = 'anthropic';
    apiKey = process.env.ANTHROPIC_API_KEY;
  } else if (!envProvider) {
    // Auto-detect based on presence of API keys
    if (process.env.GEMINI_API_KEY) {
      provider = 'gemini';
      apiKey = process.env.GEMINI_API_KEY;
    } else if (process.env.OPENAI_API_KEY) {
      provider = 'openai';
      apiKey = process.env.OPENAI_API_KEY;
    } else if (process.env.GROQ_API_KEY) {
      provider = 'groq';
      apiKey = process.env.GROQ_API_KEY;
      defaultBaseUrl = 'https://api.groq.com/openai/v1';
    } else if (process.env.ANTHROPIC_API_KEY) {
      provider = 'anthropic';
      apiKey = process.env.ANTHROPIC_API_KEY;
    }
  }

  const isConfigured = Boolean(apiKey && apiKey.trim().length > 0 && provider !== 'unconfigured');

  return {
    provider: isConfigured ? provider : 'unconfigured',
    apiKey: isConfigured ? apiKey : undefined,
    model: isConfigured ? (envModel || getDefaultModelForConfiguredProvider(provider)) : '',
    baseUrl: envBaseUrl || defaultBaseUrl || undefined,
    timeoutMs,
    maxRetries,
    isConfigured,
  };
}

/**
 * Returns safe metadata about the AI service without leaking secrets
 */
export function getSafeAIStatus(config: ResolvedAIConfig): AIProviderStatus {
  return {
    configured: config.isConfigured,
    provider: config.provider,
    model: config.model,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    requiresKey: config.provider !== 'test' && !config.isConfigured,
  };
}
