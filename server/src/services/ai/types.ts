export type AIProviderType =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'test'
  | 'unconfigured';

export type AIErrorCode =
  | 'UNCONFIGURED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'PARSE_ERROR'
  | 'AUTH_ERROR'
  | 'NETWORK_ERROR'
  | 'UPSTREAM_ERROR'
  | 'ABORTED';

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AICompletionRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface AICompletionResponse {
  content: string;
  provider: string;
  model: string;
  usage?: TokenUsage;
  latencyMs: number;
}

export interface SchemaValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export type SchemaValidator<T> = (data: unknown) => SchemaValidationResult<T>;

export interface AIStructuredRequest<T> {
  prompt: string;
  systemPrompt?: string;
  validator: SchemaValidator<T>;
  schemaDescription?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}

export interface AIStructuredResponse<T> {
  data: T;
  rawContent: string;
  provider: string;
  model: string;
  usage?: TokenUsage;
  latencyMs: number;
}

export interface AIProviderConfig {
  provider?: AIProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface AIProviderStatus {
  configured: boolean;
  provider: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  requiresKey: boolean;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  isConfigured(): boolean;
  generateCompletion(request: AICompletionRequest): Promise<AICompletionResponse>;
  generateStructured<T>(request: AIStructuredRequest<T>): Promise<AIStructuredResponse<T>>;
}
