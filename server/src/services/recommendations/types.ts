export type ResponsibleTeam =
  | 'Product'
  | 'Engineering'
  | 'Customer Support'
  | 'Operations'
  | 'Trust & Safety'
  | 'Billing & Finance';

export type ActionTimeframe = 'immediate' | 'short_term' | 'medium_term';

export interface RecommendationAction {
  title: string;
  description: string;
  expectedImpact: string;
  timeframe: ActionTimeframe;
  suggestedOwnerTeam: ResponsibleTeam;
}

export interface EvidenceExcerpt {
  feedbackId: string;
  quote: string;
  category: string;
  source?: string;
  severity?: number;
  sentiment?: string;
  relevanceScore?: number;
}

export interface SeverityDistribution {
  sev1: number;
  sev2: number;
  sev3: number;
  sev4: number;
  sev5: number;
}

export interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
}

export interface MeasuredFacts {
  totalFrequency: number;
  uniqueReports: number;
  duplicateRatio: number;
  sentimentDistribution: SentimentDistribution;
  severityBreakdown: SeverityDistribution;
  averageSeverity: number;
  priorityScore: number;
  priorityTier: 'critical' | 'high' | 'medium' | 'low';
}

export interface IssueRecommendation {
  id: string; // UUID
  issueId: string;
  issueCode: string;
  title: string;
  issueSummary: string;
  whyItMatters: string;
  suggestedTeam: ResponsibleTeam;
  recommendedActions: RecommendationAction[];
  evidenceExcerpts: EvidenceExcerpt[];
  measuredFacts: MeasuredFacts;
  isFallback: boolean;
  confidenceScore: number;
  generatedAt: string;
  modelVersion: string;
  promptVersion: string;
}

/**
 * Raw structured JSON output expected from LLM
 */
export interface RawRecommendationModelOutput {
  issue_summary: string;
  why_it_matters: string;
  suggested_team: string;
  recommended_actions: Array<{
    title: string;
    description: string;
    expected_impact: string;
    timeframe: string;
    suggested_owner_team?: string;
  }>;
  evidence_feedback_ids: string[];
  confidence?: number;
}
