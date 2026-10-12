import type { DatasetOriginType } from './import.js';
import type { FeedbackSentiment } from '../services/analysis/types.js';

export interface AnalyticsFilterParams {
  category?: string;
  sentiment?: FeedbackSentiment | 'all';
  topic?: string;
  severity?: number | 'all';
  analysisStatus?: 'analyzed' | 'pending' | 'all';
  datasetType?: DatasetOriginType | 'all';
  search?: string;
  sortBy?: 'rowNumber' | 'severity' | 'confidence' | 'sentimentScore' | 'category' | 'importedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface SentimentCountAndPercent {
  count: number;
  percentage: number;
}

export interface SentimentMetrics {
  denominator: number;
  counts: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  percentages: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  averageSentimentScore: number | null;
  averageSeverity: number | null;
}

export interface CategoryMetric {
  category: string;
  count: number;
  percentage: number;
  analyzedCount: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
}

export interface IssueFrequencyMetric {
  topic: string;
  count: number;
  percentage: number;
  averageSeverity: number | null;
  negativeCount: number;
  negativePercentage: number;
  categories: Record<string, number>;
}

export interface PriorityRankingMetric {
  issueId: string;
  issueCode: string;
  title: string;
  category: string;
  priorityTier: 'critical' | 'high' | 'medium' | 'low';
  priorityScore: number;
  totalMentions: number;
  uniqueReports: number;
  duplicateRatio: number;
  status?: string;
  assignee?: string;
  isSaved?: boolean;
}

export interface PriorityTierSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface TopRepeatedReview {
  textSnippet: string;
  count: number;
  duplicateCount: number;
  category: string;
}

export interface DuplicateTextStatistics {
  totalFeedback: number;
  uniqueReviewTexts: number;
  duplicateFeedbackCount: number;
  duplicateRatio: number;
  topRepeatedReviews: TopRepeatedReview[];
}

export interface AnalyticsMetricsResponse {
  filtersApplied: {
    category?: string;
    sentiment?: string;
    topic?: string;
    analysisStatus?: string;
    severity?: number | string;
    datasetType?: string;
    search?: string;
  };
  summary: {
    totalFeedback: number;
    analyzedFeedback: number;
    pendingAnalysis: number;
    analysisCoveragePercent: number;
    hasAnalysisRun: boolean;
    isEmpty: boolean;
    statusMessage: string;
  };
  sentiment: SentimentMetrics;
  categories: CategoryMetric[];
  issueFrequencies: IssueFrequencyMetric[];
  priorityRankings: {
    issues: PriorityRankingMetric[];
    tierSummary: PriorityTierSummary;
    openIssuesCount?: number;
    statusSummary?: {
      open: number;
      in_progress: number;
      resolved: number;
      dismissed: number;
    };
    hasScoredIssues: boolean;
    disclaimer: string;
  };
  duplicateStats: DuplicateTextStatistics;
  calculatedAt: string;
}
