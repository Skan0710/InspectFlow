import type { IssueRecommendation } from './recommendations';

export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';

export interface IssueNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: string;
  toStatus: IssueStatus;
  changedAt: string;
  changedBy?: string;
  reason?: string;
}

export interface RepresentativeExample {
  feedbackId: string;
  quote: string;
  relevanceScore: number;
  category: string;
  source?: string;
}

export interface ScoreComponents {
  frequencyScore: number;
  frequencyWeight: number;
  frequencyPoints: number;
  totalMentions: number;
  uniqueReports: number;
  duplicateCount: number;
  duplicateRatio: number;

  severityScore: number;
  severityWeight: number;
  severityPoints: number;
  rawAverageSeverity: number;
  severityCount: number;

  negativeSentimentRatio: number;
  negativeSentimentWeight: number;
  negativeSentimentPoints: number;
  negativeCount: number;
  analyzedCount: number;
}

export interface ScoreBreakdown {
  score: number;
  tier: IssuePriority;
  components: ScoreComponents;
  formula: string;
  algorithmVersion: string;
  summary: string;
  disclaimer: string;
  calculatedAt: string;
}

export interface ActionIssue {
  id: string;
  issueCode: string;
  title: string;
  description: string;
  category: string;
  status: IssueStatus | string;
  priority: IssuePriority;
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
  metadata?: {
    priorityScore?: number;
    priorityTier?: string;
    scoreBreakdown?: ScoreBreakdown;
    algorithmVersion?: string;
    disclaimer?: string;
    totalMentions?: number;
    uniqueReports?: number;
    duplicateRatio?: number;
    recommendation?: IssueRecommendation;
  };
  createdAt: string;
  updatedAt: string;
}

export interface IssueMemberFeedback {
  feedback: {
    id: string;
    review: string;
    category: string;
    source: string;
    importedAt: string;
  };
  link: {
    relevanceScore: number;
    citationQuote: string;
  };
  analysis?: {
    sentiment: string;
    severity?: number;
    confidenceScore?: number;
    primaryTopic?: string;
  } | null;
}

export interface IssueDetailResponse {
  success: boolean;
  issue: ActionIssue;
  scoreBreakdown: ScoreBreakdown | null;
  priorityScore: number;
  priorityTier: IssuePriority;
  frequency: number;
  uniqueReports: number;
  duplicateRatio: number;
  negativeSentimentRatio: number;
  members: IssueMemberFeedback[];
  recommendation: IssueRecommendation | null;
  notes: IssueNote[];
  statusHistory: StatusHistoryEntry[];
  isSaved: boolean;
  statusUpdatedAt: string;
}

export interface StatusSummary {
  open: number;
  in_progress: number;
  resolved: number;
  dismissed: number;
  saved: number;
}
