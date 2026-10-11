import type { RawFeedbackRecord } from '../../types/import.js';
import type { FeedbackAnalysisRecord } from '../analysis/types.js';
import type { IssueNote, StatusHistoryEntry } from '../../types/issues.js';

export interface ClusterableItem {
  id: string;
  text: string;
  category: string;
  contentHash: string;
  source?: string;
  analysis?: FeedbackAnalysisRecord | null;
  datasetType?: string;
}

export interface ClusteringOptions {
  similarityThreshold?: number; // Cosine similarity cutoff (default: 0.35)
  minClusterSize?: number; // Minimum number of items to form a cluster (default: 2)
  maxClusters?: number; // Max clusters to produce (default: 50)
  datasetType?: 'all' | 'genuine_import' | 'demo_sample';
}

export interface RepresentativeExample {
  feedbackId: string;
  quote: string;
  relevanceScore: number;
  category: string;
  source?: string;
}

export interface IssueClusterData {
  id: string; // Stable UUID
  issueCode: string; // ISS-001, ISS-002, etc.
  title: string; // Concise human-readable name
  description: string;
  category: string; // Primary supplied category
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'backlog' | 'in_review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  impactSummary: string;
  feedbackCount: number;
  uniqueTextCount: number;
  representativeExamples: RepresentativeExample[];
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  avgConfidence: number;
  memberFeedbackIds: string[];
  assignee?: string;
  assigneeEmail?: string;
  isSaved?: boolean;
  statusUpdatedAt?: string;
  notes?: IssueNote[];
  statusHistory?: StatusHistoryEntry[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UnmatchedFeedbackItem {
  feedbackId: string;
  text: string;
  category: string;
  reason: 'below_similarity_threshold' | 'singleton_outlier' | 'low_confidence';
  bestSimilarityScore: number;
}

export interface ClusteringResult {
  runId: string;
  totalFeedbackEvaluated: number;
  uniqueTextsEvaluated: number;
  clusteredFeedbackCount: number;
  unmatchedFeedbackCount: number;
  clustersCount: number;
  clusters: IssueClusterData[];
  unmatched: UnmatchedFeedbackItem[];
  executionDurationMs: number;
  parameters: ClusteringOptions;
  createdAt: string;
}

export interface IssueFeedbackLink {
  id: string; // UUID
  issueId: string; // UUID
  feedbackId: string; // UUID
  relevanceScore: number;
  citationQuote: string;
  addedBy: string;
  createdAt: string;
}

export interface ClusteringEngine {
  name: string;
  computeSimilarities(items: { id: string; text: string }[]): Promise<number[][]>;
}
