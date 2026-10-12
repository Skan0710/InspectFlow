/**
 * Adaption Labs API and Workflow Types
 * Based on official Adaption Labs API specification:
 * Base URL: https://api.prod.adaptionlabs.ai/api/v1
 */

export type AdaptionRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'unconfigured';

export type AdaptionTrainingType = 'instruction_dataset' | 'preference_pairs';

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
  id: string; // Adaption dataset ID or unique run identifier
  name: string;
  datasetVersion: string;
  status: AdaptionRunStatus;
  recordsCount: number;
  trainingType: AdaptionTrainingType;
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

export interface AdaptionConfig {
  apiKey?: string;
  baseUrl: string;
  isMock?: boolean;
}

export interface AdaptionProviderStatus {
  configured: boolean;
  baseUrl: string;
  hasApiKey: boolean;
  isMockMode: boolean;
  message: string;
}

export interface PrepareDatasetOptions {
  name?: string;
  datasetType?: 'all' | 'genuine_import' | 'demo_sample';
  maxRows?: number;
  requireAnalyzed?: boolean;
}

export interface RunAdaptionOptions {
  datasetName?: string;
  datasetType?: 'all' | 'genuine_import' | 'demo_sample';
  maxRows?: number;
  estimateOnly?: boolean;
  simulateRun?: boolean;
}
