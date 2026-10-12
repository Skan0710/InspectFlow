import type { AnalyticsFilterParams } from './analytics';
import type { IssuePriority } from './issues';

export type ReportFormat = 'pdf' | 'csv' | 'both';
export type ReportStatus = 'draft' | 'scheduled' | 'generating' | 'generated' | 'failed';
export type ReportType = 'executive_summary' | 'full_audit' | 'issue_digest' | 'sentiment_overview';

export interface ReportScope extends AnalyticsFilterParams {
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportRepresentativeExcerpt {
  feedbackId: string;
  quote: string;
  sentiment: string;
  category?: string;
}

export interface ReportTopIssue {
  id: string;
  code: string;
  title: string;
  category: string;
  priority: IssuePriority;
  priorityScore: number;
  status: string;
  frequency: number;
  uniqueReports: number;
  negativeSentimentRatio: number;
  scoreBreakdown: {
    frequencyPoints: number;
    severityPoints: number;
    negativeSentimentPoints: number;
  };
  representativeExcerpts: ReportRepresentativeExcerpt[];
  recommendation?: {
    summary: string;
    whyItMatters: string;
    responsibleTeam: string;
    recommendedActions: Array<{
      action: string;
      rationale: string;
      expectedImpact?: string;
    }>;
  };
}

export interface ReportContentPayload {
  metadata: {
    reportId: string;
    reportCode: string;
    title: string;
    description: string;
    reportType: ReportType;
    format: ReportFormat;
    generatedAt: string;
    applicableDateRange: {
      start: string | null;
      end: string | null;
      isSnapshot: boolean;
      note: string;
    };
    filterScope: ReportScope;
  };
  executiveSummary: string;
  datasetScope: {
    totalFeedback: number;
    analyzedFeedback: number;
    pendingAnalysis: number;
    analysisCoveragePercent: number;
    datasetOrigin: string;
    duplicateCount: number;
    uniqueCount: number;
    duplicateRatePercent: number;
  };
  sentimentDistribution: {
    positive: { count: number; percentage: number };
    neutral: { count: number; percentage: number };
    negative: { count: number; percentage: number };
    mixed: { count: number; percentage: number };
    denominator: number;
    netSentimentScore: number;
  };
  categoryBreakdown: Array<{
    category: string;
    count: number;
    percentage: number;
    dominantSentiment: string;
  }>;
  topPriorityIssues: ReportTopIssue[];
  issueStatusSummary: {
    open: number;
    in_progress: number;
    resolved: number;
    dismissed: number;
    total: number;
  };
}

export interface ReportRecord {
  id: string;
  reportCode: string;
  title: string;
  description: string | null;
  reportType: ReportType;
  status: ReportStatus;
  cadence: string | null;
  format: ReportFormat;
  contentPayload: ReportContentPayload;
  storagePath: string | null;
  recipients: string[];
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportRequest {
  title?: string;
  description?: string;
  reportType?: ReportType;
  format?: ReportFormat;
  scope?: ReportScope;
  cadence?: string;
  recipients?: string[];
}
