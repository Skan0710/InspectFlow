import crypto from 'node:crypto';
import type { AIProvider } from '../ai/types.js';
import { getAIProvider } from '../ai/index.js';
import { FeedbackStore } from '../feedbackStore.js';
import type { IssueClusterData } from '../clustering/types.js';
import type {
  IssueRecommendation,
  MeasuredFacts,
  ResponsibleTeam,
  RecommendationAction,
  EvidenceExcerpt,
  RawRecommendationModelOutput,
  SeverityDistribution,
  SentimentDistribution,
} from './types.js';
import {
  RECOMMENDATION_SYSTEM_PROMPT,
  RECOMMENDATION_PROMPT_VERSION,
  buildRecommendationPrompt,
  type CandidateReview,
} from './prompt.js';
import { validateRecommendationOutput } from './validator.js';
import { generateDeterministicFallback } from './fallbackGenerator.js';

export class RecommendationService {
  private provider: AIProvider;
  private store: FeedbackStore;

  constructor(provider?: AIProvider, store?: FeedbackStore) {
    this.provider = provider || getAIProvider();
    this.store = store || FeedbackStore.getInstance();
  }

  /**
   * Computes objective, verified facts from raw feedback and analysis records for an issue.
   * Completely distinct from AI-generated recommendations.
   */
  public computeMeasuredFacts(issue: IssueClusterData): MeasuredFacts {
    const memberIds = issue.memberFeedbackIds || [];
    const memberDetails = this.store.getFeedbackForIssue(issue.id);

    const severityBreakdown: SeverityDistribution = {
      sev1: 0,
      sev2: 0,
      sev3: 0,
      sev4: 0,
      sev5: 0,
    };

    const sentimentDistribution: SentimentDistribution = {
      positive: 0,
      neutral: 0,
      negative: 0,
      mixed: 0,
    };

    let totalSeveritySum = 0;
    let severityCount = 0;

    for (const item of memberDetails) {
      const analysis = item.analysis;
      if (analysis) {
        // Severity
        const sev = analysis.severity || (analysis.urgencyScore ? Math.round(analysis.urgencyScore * 5) : 3);
        const clampedSev = Math.max(1, Math.min(5, Math.round(sev)));
        const key = `sev${clampedSev}` as keyof SeverityDistribution;
        severityBreakdown[key] = (severityBreakdown[key] || 0) + 1;
        totalSeveritySum += clampedSev;
        severityCount++;

        // Sentiment
        const sent = analysis.sentiment;
        if (sent === 'positive' || sent === 'negative' || sent === 'neutral' || sent === 'mixed') {
          sentimentDistribution[sent]++;
        }
      }
    }

    // Fallback if no member analyses were found, use cluster's sentiment breakdown
    if (severityCount === 0) {
      sentimentDistribution.positive = issue.sentimentBreakdown?.positive || 0;
      sentimentDistribution.negative = issue.sentimentBreakdown?.negative || 0;
      sentimentDistribution.neutral = issue.sentimentBreakdown?.neutral || 0;
      sentimentDistribution.mixed = issue.sentimentBreakdown?.mixed || 0;
      severityBreakdown.sev3 = issue.feedbackCount;
      totalSeveritySum = issue.feedbackCount * 3;
      severityCount = issue.feedbackCount;
    }

    const averageSeverity = severityCount > 0 ? Number((totalSeveritySum / severityCount).toFixed(2)) : 3.0;

    const totalFrequency = issue.feedbackCount;
    const uniqueReports = issue.uniqueTextCount || totalFrequency;
    const duplicateRatio = totalFrequency > 0 
      ? Number(((totalFrequency - uniqueReports) / totalFrequency).toFixed(2)) 
      : 0;

    const priorityScore = issue.metadata?.priorityScore !== undefined 
      ? Number(issue.metadata.priorityScore) 
      : 50;

    const priorityTier = issue.priority || 'medium';

    return {
      totalFrequency,
      uniqueReports,
      duplicateRatio,
      sentimentDistribution,
      severityBreakdown,
      averageSeverity,
      priorityScore,
      priorityTier,
    };
  }

  /**
   * Prepares representative candidate reviews from the issue's member feedback.
   */
  public getCandidateReviews(issue: IssueClusterData): CandidateReview[] {
    const memberDetails = this.store.getFeedbackForIssue(issue.id);
    const candidateMap = new Map<string, CandidateReview>();

    for (const item of memberDetails) {
      const fb = item.feedback;
      if (fb && !candidateMap.has(fb.id)) {
        candidateMap.set(fb.id, {
          id: fb.id,
          review: fb.review,
          category: fb.category,
          sentiment: item.analysis?.sentiment,
          severity: item.analysis?.severity,
        });
      }
    }

    // Also include representative examples from cluster definition if available
    if (issue.representativeExamples) {
      for (const ex of issue.representativeExamples) {
        if (!candidateMap.has(ex.feedbackId)) {
          const fb = this.store.getRecordById(ex.feedbackId);
          if (fb) {
            candidateMap.set(ex.feedbackId, {
              id: ex.feedbackId,
              review: fb.review,
              category: fb.category,
              sentiment: 'negative',
              severity: 4,
            });
          }
        }
      }
    }

    return Array.from(candidateMap.values());
  }

  /**
   * Generates or retrieves an evidence-backed recommendation for a specific issue.
   */
  public async generateRecommendation(
    issueId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<IssueRecommendation> {
    const issue = this.store.getIssueById(issueId);
    if (!issue) {
      throw new Error(`Issue cluster with id "${issueId}" not found.`);
    }

    // Check existing stored recommendation unless forceRefresh is true
    if (!options.forceRefresh) {
      const existing = this.store.getRecommendationByIssueId(issueId);
      if (existing) {
        return existing;
      }
    }

    const facts = this.computeMeasuredFacts(issue);
    const candidateReviews = this.getCandidateReviews(issue);
    const validFeedbackIds = new Set(candidateReviews.map((r) => r.id));

    try {
      // 1. Construct grounded prompt with real candidate reviews only
      const prompt = buildRecommendationPrompt(issue, facts, candidateReviews);

      // 2. Query AI Provider with strict schema and feedback ID verification
      const response = await this.provider.generateStructured<RawRecommendationModelOutput>({
        prompt,
        systemPrompt: RECOMMENDATION_SYSTEM_PROMPT,
        validator: (data) =>
          validateRecommendationOutput(data, {
            validFeedbackIds,
            requireEvidence: candidateReviews.length > 0,
          }),
        temperature: 0.2,
      });

      const output = response.data;

      // 3. Resolve evidence excerpts from real candidate reviews
      const evidenceExcerpts: EvidenceExcerpt[] = [];
      const reviewMap = new Map(candidateReviews.map((r) => [r.id, r]));

      for (const fbId of output.evidence_feedback_ids) {
        const candidate = reviewMap.get(fbId);
        if (candidate) {
          evidenceExcerpts.push({
            feedbackId: candidate.id,
            quote: candidate.review.length > 250 ? `${candidate.review.slice(0, 247)}...` : candidate.review,
            category: candidate.category,
            severity: candidate.severity,
            sentiment: candidate.sentiment,
          });
        }
      }

      // If LLM returned zero valid evidence IDs, fallback to candidate review quotes
      if (evidenceExcerpts.length === 0 && candidateReviews.length > 0) {
        evidenceExcerpts.push({
          feedbackId: candidateReviews[0].id,
          quote: candidateReviews[0].review,
          category: candidateReviews[0].category,
          severity: candidateReviews[0].severity,
          sentiment: candidateReviews[0].sentiment,
        });
      }

      const recommendation: IssueRecommendation = {
        id: crypto.randomUUID(),
        issueId: issue.id,
        issueCode: issue.issueCode,
        title: issue.title,
        issueSummary: output.issue_summary,
        whyItMatters: output.why_it_matters,
        suggestedTeam: output.suggested_team as ResponsibleTeam,
        recommendedActions: output.recommended_actions.map((act) => ({
          title: act.title,
          description: act.description,
          expectedImpact: act.expected_impact,
          timeframe: (act.timeframe as any) || 'short_term',
          suggestedOwnerTeam: (act.suggested_owner_team as ResponsibleTeam) || (output.suggested_team as ResponsibleTeam),
        })),
        evidenceExcerpts,
        measuredFacts: facts,
        isFallback: false,
        confidenceScore: output.confidence ?? 0.92,
        generatedAt: new Date().toISOString(),
        modelVersion: this.provider.model,
        promptVersion: RECOMMENDATION_PROMPT_VERSION,
      };

      await this.store.saveRecommendation(recommendation);
      return recommendation;
    } catch (err: unknown) {
      console.warn(
        `[RecommendationService] AI generation for issue "${issue.issueCode}" failed or unconfigured, utilizing deterministic fallback:`,
        err instanceof Error ? err.message : err
      );

      // Graceful fallback grounded strictly in real data
      const fallback = generateDeterministicFallback(issue, facts, candidateReviews);
      await this.store.saveRecommendation(fallback);
      return fallback;
    }
  }

  /**
   * Generates recommendations for all high-priority issues (Critical & High).
   */
  public async generateRecommendationsForHighPriority(): Promise<IssueRecommendation[]> {
    const issues = this.store.getAllIssues();
    const highPriorityIssues = issues.filter(
      (iss) => iss.priority === 'critical' || iss.priority === 'high'
    );

    const recommendations: IssueRecommendation[] = [];
    for (const issue of highPriorityIssues) {
      const rec = await this.generateRecommendation(issue.id);
      recommendations.push(rec);
    }

    return recommendations;
  }
}
