export type DatasetOriginType = 'genuine_import' | 'demo_sample';

export interface AnalyticsFilterParams {
  category?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed' | 'all';
  topic?: string;
  severity?: number | 'all';
  analysisStatus?: 'analyzed' | 'pending' | 'all';
  datasetType?: DatasetOriginType | 'all';
  search?: string;
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

export interface DatasetStatus {
  totalRecords: number;
  genuineCount: number;
  sampleCount: number;
  categories: Record<string, number>;
  activeDatasetType: 'empty' | 'genuine' | 'sample' | 'mixed';
  lastImportAt: string | null;
  lastBatchId?: string | null;
  analysisStatus: 'not_started' | 'running' | 'completed';
  hasAnalysisRun: boolean;
}
