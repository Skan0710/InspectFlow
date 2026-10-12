export type AdaptionRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'unconfigured';

export interface AdaptionColumnMapping {
  prompt: string;
  completion: string;
  context?: string[];
}

export interface AdaptionPromptPair {
  originalId: string;
  prompt: string;
  completion: string;
  category: string;
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
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AdaptionProviderStatus {
  configured: boolean;
  baseUrl: string;
  hasApiKey: boolean;
  isMockMode: boolean;
  message: string;
}
