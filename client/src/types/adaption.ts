export type AdaptionRunStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'unconfigured'
  | 'blocked_confirmation_required';

export interface AdaptionColumnMapping {
  prompt: string;
  completion: string;
  context?: string[];
}

export interface AdaptionPromptPair {
  originalId: string;
  originalIds?: string[];
  duplicateCount?: number;
  prompt: string;
  completion: string;
  category: string;
  isSourceCategory?: boolean;
  sentiment: string;
  urgencyScore: number;
  primaryTopic: string;
  context?: Record<string, unknown>;
}

export interface AdaptionQualityMetrics {
  grade_before?: string;
  grade_after?: string;
  score_before?: number;
  score_after?: number;
  percentile_after?: number;
  improvement_percent?: number;
}

export interface AdaptionEstimate {
  recordsCount: number;
  estimatedCredits: number;
  estimatedCostUsd: number;
  isMock: boolean;
  requiresConfirmation: boolean;
  explanation: string;
}

export interface AdaptionRunRecord {
  id: string;
  name: string;
  datasetVersion: string;
  status: AdaptionRunStatus;
  recordsCount: number;
  trainingType: 'instruction_dataset' | 'preference_pairs';
  columnMapping: AdaptionColumnMapping;
  quality?: AdaptionQualityMetrics;
  samplePairs: AdaptionPromptPair[];
  benchmarkIntegrated: boolean;
  rawResults?: Record<string, unknown>;
  errorMessage?: string;
  isMock: boolean;
  estimate?: AdaptionEstimate;
  confirmed?: boolean;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AdaptionProviderStatus {
  configured: boolean;
  baseUrl: string;
  hasApiKey: boolean;
  isMockMode: boolean;
  apiKeyMasked?: string;
  validationState?: 'unconfigured' | 'configured' | 'simulation' | 'auth_failed' | 'connected';
  message: string;
}

export interface EvaluationMetrics {
  validStructuredOutputRate: number; // 0.0 - 1.0
  categoryAgreementRate: number; // 0.0 - 1.0
  evidenceGroundingRate: number; // 0.0 - 1.0
  avgConfidence: number; // 0.0 - 1.0
  avgLatencyMs: number;
}

export interface AdaptionEvaluationComparison {
  id: string;
  sampleSize: number;
  exemplarLibraryVersion: string;
  exemplarsCount: number;
  leakageFree: boolean;
  baseline: EvaluationMetrics;
  adapted: EvaluationMetrics;
  delta: {
    structuredOutputDiff: number;
    categoryAgreementDiff: number;
    groundingDiff: number;
    confidenceDiff: number;
    latencyDiffMs: number;
  };
  limitations: string;
  sourceCategoryDisclaimer: string;
  evaluatedAt: string;
}

export interface ExemplarLibraryMetadata {
  version: string;
  count: number;
  categories: string[];
  lastUpdated: string;
  isEnabled: boolean;
}

