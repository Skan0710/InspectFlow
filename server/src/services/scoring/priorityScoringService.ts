import type { RawFeedbackRecord } from '../../types/import.js';
import type { FeedbackAnalysisRecord } from '../analysis/types.js';
import type { IssueClusterData } from '../clustering/types.js';
import {
  DEFAULT_PRIORITY_TIER_THRESHOLDS,
  SCORING_ALGORITHM_VERSION,
  SCORING_DISCLAIMER,
  type PriorityScoreBreakdown,
  type PriorityScoreComponents,
  type PriorityTier,
  type PriorityTierThresholds,
  type ScoringOptions,
  type IssueScoringRecord,
  type ScoringResultSummary,
} from './types.js';

export class PriorityScoringService {
  private readonly defaultWeights = {
    frequency: 0.40,
    severity: 0.35,
    negativeSentiment: 0.25,
  };

  /**
   * Deterministically calculates priority scores for a collection of issue clusters.
   * Priority = 100 * (0.40 * F + 0.35 * S + 0.25 * N)
   */
  public scoreIssues(
    issues: IssueClusterData[],
    analysesMap: Map<string, FeedbackAnalysisRecord>,
    rawFeedbackMap?: Map<string, RawFeedbackRecord>,
    options: ScoringOptions = {}
  ): {
    issues: IssueScoringRecord[];
    summary: ScoringResultSummary;
  } {
    const calculatedAt = new Date().toISOString();
    const thresholds: PriorityTierThresholds = {
      ...DEFAULT_PRIORITY_TIER_THRESHOLDS,
      ...(options.thresholds || {}),
    };

    const weights = {
      frequency: options.weights?.frequency ?? this.defaultWeights.frequency,
      severity: options.weights?.severity ?? this.defaultWeights.severity,
      negativeSentiment: options.weights?.negativeSentiment ?? this.defaultWeights.negativeSentiment,
    };

    // Normalize weights if custom weights do not sum exactly to 1.0
    const weightSum = weights.frequency + weights.severity + weights.negativeSentiment;
    const wF = weightSum > 0 ? weights.frequency / weightSum : this.defaultWeights.frequency;
    const wS = weightSum > 0 ? weights.severity / weightSum : this.defaultWeights.severity;
    const wN = weightSum > 0 ? weights.negativeSentiment / weightSum : this.defaultWeights.negativeSentiment;

    // Handle empty dataset safely
    if (!issues || issues.length === 0) {
      return {
        issues: [],
        summary: {
          algorithmVersion: SCORING_ALGORITHM_VERSION,
          totalIssuesScored: 0,
          tierCounts: { critical: 0, high: 0, medium: 0, low: 0 },
          averageScore: 0,
          highestScoredIssue: null,
          lowestScoredIssue: null,
          recalculatedAt: calculatedAt,
          disclaimer: SCORING_DISCLAIMER,
        },
      };
    }

    // Step 1: Find maximum frequency across all issues for relative normalization
    let maxMentions = 0;
    for (const issue of issues) {
      const mentions = issue.feedbackCount ?? issue.memberFeedbackIds?.length ?? 0;
      if (mentions > maxMentions) {
        maxMentions = mentions;
      }
    }

    const tierCounts: Record<PriorityTier, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    let totalScoreSum = 0;

    // Step 2: Calculate individual scores
    const scoredIssues: IssueScoringRecord[] = issues.map((issue) => {
      const totalMentions = Math.max(0, issue.feedbackCount ?? issue.memberFeedbackIds?.length ?? 0);
      
      // Calculate unique reports (to expose duplicate copies)
      let uniqueReports = issue.uniqueTextCount;
      if (uniqueReports === undefined || uniqueReports === null) {
        if (rawFeedbackMap && issue.memberFeedbackIds) {
          const uniqueTexts = new Set<string>();
          for (const fbId of issue.memberFeedbackIds) {
            const fb = rawFeedbackMap.get(fbId);
            if (fb) uniqueTexts.add(fb.review.trim().toLowerCase());
          }
          uniqueReports = Math.max(1, uniqueTexts.size);
        } else {
          uniqueReports = totalMentions;
        }
      }
      uniqueReports = Math.min(totalMentions, Math.max(1, uniqueReports));

      const duplicateCount = Math.max(0, totalMentions - uniqueReports);
      const duplicateRatio = totalMentions > 0 ? Math.round((duplicateCount / totalMentions) * 100) / 100 : 0.0;

      // 1. F Component: Normalized Frequency [0, 1]
      const frequencyScore = maxMentions > 0 ? Math.min(1.0, Math.max(0.0, totalMentions / maxMentions)) : 0.0;
      const frequencyPoints = Math.round(100 * wF * frequencyScore * 10) / 10;

      // 2. S Component: Normalized Severity [0, 1]
      let severitySum = 0;
      let severityCount = 0;
      let negativeCount = 0;
      let analyzedCount = 0;

      const memberIds = issue.memberFeedbackIds || [];
      for (const fbId of memberIds) {
        const analysis = analysesMap.get(fbId);
        if (analysis) {
          analyzedCount++;
          if (analysis.severity !== undefined && analysis.severity !== null) {
            severitySum += Math.min(5, Math.max(1, analysis.severity));
            severityCount++;
          }
          if (analysis.sentiment === 'negative') {
            negativeCount++;
          }
        }
      }

      let rawAverageSeverity = options.defaultSeverity ?? 3.0;
      if (severityCount > 0) {
        rawAverageSeverity = severitySum / severityCount;
      }
      // Normalize severity from [1, 5] range into [0, 1] range: (S_raw - 1) / 4
      const severityScore = Math.min(1.0, Math.max(0.0, (rawAverageSeverity - 1.0) / 4.0));
      const severityPoints = Math.round(100 * wS * severityScore * 10) / 10;

      // 3. N Component: Negative Sentiment Proportion [0, 1]
      let negativeSentimentRatio = 0.0;
      if (analyzedCount > 0) {
        negativeSentimentRatio = Math.min(1.0, Math.max(0.0, negativeCount / analyzedCount));
      } else if (issue.sentimentBreakdown) {
        // Fallback to cluster breakdown if individual records not provided
        const total = (issue.sentimentBreakdown.positive || 0) +
          (issue.sentimentBreakdown.neutral || 0) +
          (issue.sentimentBreakdown.negative || 0) +
          (issue.sentimentBreakdown.mixed || 0);
        if (total > 0) {
          negativeSentimentRatio = Math.min(1.0, Math.max(0.0, (issue.sentimentBreakdown.negative || 0) / total));
          negativeCount = issue.sentimentBreakdown.negative || 0;
          analyzedCount = total;
        }
      }
      const negativeSentimentPoints = Math.round(100 * wN * negativeSentimentRatio * 10) / 10;

      // Calculate combined Priority Score: 100 * (0.40 * F + 0.35 * S + 0.25 * N)
      const rawScore = 100 * (wF * frequencyScore + wS * severityScore + wN * negativeSentimentRatio);
      const score = Math.min(100.0, Math.max(0.0, Math.round(rawScore * 10) / 10));

      totalScoreSum += score;

      // Assign priority tier
      let tier: PriorityTier = 'low';
      if (score >= thresholds.critical) {
        tier = 'critical';
      } else if (score >= thresholds.high) {
        tier = 'high';
      } else if (score >= thresholds.medium) {
        tier = 'medium';
      } else {
        tier = 'low';
      }

      tierCounts[tier]++;

      // Summary text
      const summary = `Priority ${score}/100 [${tier.toUpperCase()}]: Frequency contributed ${frequencyPoints} pts (${totalMentions} mentions, ${uniqueReports} unique), Severity contributed ${severityPoints} pts (avg ${Math.round(rawAverageSeverity * 10) / 10}/5), Negative sentiment contributed ${negativeSentimentPoints} pts (${Math.round(negativeSentimentRatio * 100)}% negative).`;

      const components: PriorityScoreComponents = {
        frequencyScore: Math.round(frequencyScore * 1000) / 1000,
        frequencyWeight: Math.round(wF * 100) / 100,
        frequencyPoints,
        totalMentions,
        uniqueReports,
        duplicateCount,
        duplicateRatio,

        severityScore: Math.round(severityScore * 1000) / 1000,
        severityWeight: Math.round(wS * 100) / 100,
        severityPoints,
        rawAverageSeverity: Math.round(rawAverageSeverity * 10) / 10,
        severityCount,

        negativeSentimentRatio: Math.round(negativeSentimentRatio * 1000) / 1000,
        negativeSentimentWeight: Math.round(wN * 100) / 100,
        negativeSentimentPoints,
        negativeCount,
        analyzedCount,
      };

      const breakdown: PriorityScoreBreakdown = {
        score,
        tier,
        components,
        formula: '100 * (0.40 * F + 0.35 * S + 0.25 * N)',
        algorithmVersion: SCORING_ALGORITHM_VERSION,
        summary,
        disclaimer: SCORING_DISCLAIMER,
        calculatedAt,
      };

      return {
        issueId: issue.id,
        issueCode: issue.issueCode,
        title: issue.title,
        category: issue.category,
        score,
        tier,
        totalMentions,
        uniqueReports,
        duplicateRatio,
        breakdown,
        algorithmVersion: SCORING_ALGORITHM_VERSION,
      };
    });

    // Sort descending by score for consistent ranking
    scoredIssues.sort((a, b) => b.score - a.score);

    const averageScore = Math.round((totalScoreSum / scoredIssues.length) * 10) / 10;
    const highestScoredIssue = scoredIssues[0]
      ? { issueCode: scoredIssues[0].issueCode, title: scoredIssues[0].title, score: scoredIssues[0].score }
      : null;
    const lowestScoredIssue = scoredIssues[scoredIssues.length - 1]
      ? {
          issueCode: scoredIssues[scoredIssues.length - 1].issueCode,
          title: scoredIssues[scoredIssues.length - 1].title,
          score: scoredIssues[scoredIssues.length - 1].score,
        }
      : null;

    return {
      issues: scoredIssues,
      summary: {
        algorithmVersion: SCORING_ALGORITHM_VERSION,
        totalIssuesScored: scoredIssues.length,
        tierCounts,
        averageScore,
        highestScoredIssue,
        lowestScoredIssue,
        recalculatedAt: calculatedAt,
        disclaimer: SCORING_DISCLAIMER,
      },
    };
  }

  /**
   * Helper to evaluate a single issue's score given explicit components (useful for unit testing).
   */
  public evaluateSingleScore(
    normalizedFrequency: number,
    normalizedSeverity: number,
    negativeProportion: number,
    thresholds: PriorityTierThresholds = DEFAULT_PRIORITY_TIER_THRESHOLDS
  ): {
    score: number;
    tier: PriorityTier;
    frequencyPoints: number;
    severityPoints: number;
    negativePoints: number;
  } {
    const F = Math.min(1.0, Math.max(0.0, normalizedFrequency));
    const S = Math.min(1.0, Math.max(0.0, normalizedSeverity));
    const N = Math.min(1.0, Math.max(0.0, negativeProportion));

    const fPoints = Math.round(100 * 0.40 * F * 10) / 10;
    const sPoints = Math.round(100 * 0.35 * S * 10) / 10;
    const nPoints = Math.round(100 * 0.25 * N * 10) / 10;

    const raw = 100 * (0.40 * F + 0.35 * S + 0.25 * N);
    const score = Math.min(100.0, Math.max(0.0, Math.round(raw * 10) / 10));

    let tier: PriorityTier = 'low';
    if (score >= thresholds.critical) {
      tier = 'critical';
    } else if (score >= thresholds.high) {
      tier = 'high';
    } else if (score >= thresholds.medium) {
      tier = 'medium';
    }

    return {
      score,
      tier,
      frequencyPoints: fPoints,
      severityPoints: sPoints,
      negativePoints: nPoints,
    };
  }
}
