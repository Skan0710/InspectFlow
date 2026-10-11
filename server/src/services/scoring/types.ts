export type PriorityTier = 'critical' | 'high' | 'medium' | 'low';

export interface PriorityTierThresholds {
  critical: number; // default: 70.0
  high: number; // default: 50.0
  medium: number; // default: 30.0
}

export const DEFAULT_PRIORITY_TIER_THRESHOLDS: PriorityTierThresholds = {
  critical: 70.0,
  high: 50.0,
  medium: 30.0,
};

export const SCORING_ALGORITHM_VERSION = 'deterministic_priority_v1.0';

export const SCORING_DISCLAIMER =
  'This priority score is an operational feedback triage heuristic based on frequency, severity, and negative sentiment. It is not an actuarial, financial risk, or dollar impact valuation.';

export interface PriorityScoreComponents {
  // F component (Frequency)
  frequencyScore: number; // F normalized to [0, 1]
  frequencyWeight: number; // 0.40
  frequencyPoints: number; // 100 * 0.40 * F
  totalMentions: number; // Raw feedback count
  uniqueReports: number; // Deduplicated feedback count
  duplicateCount: number; // totalMentions - uniqueReports
  duplicateRatio: number; // duplicateCount / totalMentions (0 to 1)

  // S component (Severity)
  severityScore: number; // S normalized to [0, 1] via (avgSeverity - 1) / 4
  severityWeight: number; // 0.35
  severityPoints: number; // 100 * 0.35 * S
  rawAverageSeverity: number; // Raw 1-5 average severity
  severityCount: number; // Number of analyzed records with severity

  // N component (Negative Sentiment Proportion)
  negativeSentimentRatio: number; // N normalized to [0, 1]
  negativeSentimentWeight: number; // 0.25
  negativeSentimentPoints: number; // 100 * 0.25 * N
  negativeCount: number; // Number of negative reviews
  analyzedCount: number; // Total analyzed reviews in cluster
}

export interface PriorityScoreBreakdown {
  score: number; // 0.0 to 100.0
  tier: PriorityTier;
  components: PriorityScoreComponents;
  formula: string;
  algorithmVersion: string;
  summary: string;
  disclaimer: string;
  calculatedAt: string;
}

export interface ScoringOptions {
  weights?: {
    frequency?: number;
    severity?: number;
    negativeSentiment?: number;
  };
  thresholds?: Partial<PriorityTierThresholds>;
  defaultSeverity?: number; // Used when unanalyzed (1.0 to 5.0, default 3.0 -> S = 0.5)
}

export interface IssueScoringRecord {
  issueId: string;
  issueCode: string;
  title: string;
  category: string;
  score: number;
  tier: PriorityTier;
  totalMentions: number;
  uniqueReports: number;
  duplicateRatio: number;
  breakdown: PriorityScoreBreakdown;
  algorithmVersion: string;
}

export interface ScoringResultSummary {
  algorithmVersion: string;
  totalIssuesScored: number;
  tierCounts: Record<PriorityTier, number>;
  averageScore: number;
  highestScoredIssue: { issueCode: string; title: string; score: number } | null;
  lowestScoredIssue: { issueCode: string; title: string; score: number } | null;
  recalculatedAt: string;
  disclaimer: string;
}
