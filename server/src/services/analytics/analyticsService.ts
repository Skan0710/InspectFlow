import { FeedbackStore } from '../feedbackStore.js';
import { getDatabaseConfig } from '../../db/config.js';
import { getPgPool } from '../../db/client.js';
import type {
  AnalyticsFilterParams,
  AnalyticsMetricsResponse,
  CategoryMetric,
  IssueFrequencyMetric,
  PriorityRankingMetric,
  PriorityTierSummary,
  SentimentMetrics,
  TopRepeatedReview,
} from '../../types/analytics.js';
import type { RawFeedbackRecord } from '../../types/import.js';
import type { FeedbackAnalysisRecord } from '../analysis/types.js';

export class AnalyticsService {
  private store: FeedbackStore;

  constructor() {
    this.store = FeedbackStore.getInstance();
  }

  /**
   * Computes comprehensive customer feedback intelligence metrics.
   * Excludes unanalyzed feedback from sentiment calculations and returns explicit denominator.
   * Guarantees consistent filter semantics with paginated feedback results.
   */
  public async getMetrics(filters: AnalyticsFilterParams = {}): Promise<AnalyticsMetricsResponse> {
    // Check if live PostgreSQL pool can be used
    const dbConfig = getDatabaseConfig();
    if (dbConfig.isConfigured && dbConfig.databaseUrl) {
      try {
        const poolMetrics = await this.getMetricsFromDatabase(filters);
        if (poolMetrics) {
          return poolMetrics;
        }
      } catch (err) {
        console.warn('[AnalyticsService] DB aggregation query failed, falling back to store cache:', err);
      }
    }

    return this.getMetricsFromStore(filters);
  }

  /**
   * In-memory store calculation (source of truth for file persistence and zero-config mode)
   */
  public getMetricsFromStore(filters: AnalyticsFilterParams = {}): AnalyticsMetricsResponse {
    // 1. Retrieve all raw records and apply identical filter rules
    const records = this.store.getRecords({
      page: 1,
      pageSize: 1000000,
      category: filters.category,
      datasetType: filters.datasetType,
      sentiment: filters.sentiment,
      topic: filters.topic,
      analysisStatus: filters.analysisStatus,
      search: filters.search,
    }).data;

    const totalFeedback = records.length;
    const analysesMap = new Map<string, FeedbackAnalysisRecord>();
    for (const a of this.store.getAllAnalyses()) {
      analysesMap.set(a.feedbackId, a);
    }

    // 2. Identify analyzed slice among filtered records
    const analyzedRecords: Array<{ record: RawFeedbackRecord; analysis: FeedbackAnalysisRecord }> = [];
    for (const r of records) {
      const analysis = analysesMap.get(r.id);
      if (analysis) {
        analyzedRecords.push({ record: r, analysis });
      }
    }

    const analyzedFeedback = analyzedRecords.length;
    const pendingAnalysis = totalFeedback - analyzedFeedback;
    const analysisCoveragePercent = totalFeedback > 0
      ? Number(((analyzedFeedback / totalFeedback) * 100).toFixed(2))
      : 0;
    const hasAnalysisRun = analyzedFeedback > 0;
    const isEmpty = totalFeedback === 0;

    let statusMessage = 'Analysis metrics calculated from actual customer feedback records.';
    if (isEmpty) {
      statusMessage = 'No feedback records found matching the specified filters.';
    } else if (!hasAnalysisRun) {
      statusMessage = 'Feedback exists, but AI analysis has not yet been executed. Run batch analysis to see sentiment and issue insights.';
    }

    // 3. Sentiment distribution: Exclude unanalyzed records, denominator is analyzedFeedback
    const sentimentDenominator = analyzedFeedback;
    const sentimentCounts = {
      positive: 0,
      neutral: 0,
      negative: 0,
      mixed: 0,
    };
    let totalSentimentScore = 0;
    let totalSeverity = 0;

    if (sentimentDenominator > 0) {
      for (const { analysis } of analyzedRecords) {
        const s = analysis.sentiment;
        if (s in sentimentCounts) {
          sentimentCounts[s as keyof typeof sentimentCounts]++;
        }
        totalSentimentScore += analysis.sentimentScore || 0;
        
        // Compute severity from analysis urgencyScore or severity if present
        const sev = analysis.urgencyScore ? Math.round(analysis.urgencyScore * 5) : 3;
        totalSeverity += sev;
      }
    }

    const sentimentPercentages = {
      positive: sentimentDenominator > 0 ? Number(((sentimentCounts.positive / sentimentDenominator) * 100).toFixed(2)) : 0,
      neutral: sentimentDenominator > 0 ? Number(((sentimentCounts.neutral / sentimentDenominator) * 100).toFixed(2)) : 0,
      negative: sentimentDenominator > 0 ? Number(((sentimentCounts.negative / sentimentDenominator) * 100).toFixed(2)) : 0,
      mixed: sentimentDenominator > 0 ? Number(((sentimentCounts.mixed / sentimentDenominator) * 100).toFixed(2)) : 0,
    };

    const averageSentimentScore = sentimentDenominator > 0
      ? Number((totalSentimentScore / sentimentDenominator).toFixed(3))
      : null;

    const averageSeverity = sentimentDenominator > 0
      ? Number((totalSeverity / sentimentDenominator).toFixed(2))
      : null;

    const sentimentMetrics: SentimentMetrics = {
      denominator: sentimentDenominator,
      counts: sentimentCounts,
      percentages: sentimentPercentages,
      averageSentimentScore,
      averageSeverity,
    };

    // 4. Category distribution: Denominator is totalFeedback
    const categoryMap = new Map<string, {
      total: number;
      analyzed: number;
      sentiment: { positive: number; neutral: number; negative: number; mixed: number };
    }>();

    for (const r of records) {
      const cat = r.category;
      let entry = categoryMap.get(cat);
      if (!entry) {
        entry = {
          total: 0,
          analyzed: 0,
          sentiment: { positive: 0, neutral: 0, negative: 0, mixed: 0 },
        };
        categoryMap.set(cat, entry);
      }
      entry.total++;

      const analysis = analysesMap.get(r.id);
      if (analysis) {
        entry.analyzed++;
        const s = analysis.sentiment;
        if (s in entry.sentiment) {
          entry.sentiment[s as keyof typeof entry.sentiment]++;
        }
      }
    }

    const categories: CategoryMetric[] = Array.from(categoryMap.entries())
      .map(([catName, stats]) => ({
        category: catName,
        count: stats.total,
        percentage: totalFeedback > 0 ? Number(((stats.total / totalFeedback) * 100).toFixed(2)) : 0,
        analyzedCount: stats.analyzed,
        sentimentBreakdown: stats.sentiment,
      }))
      .sort((a, b) => b.count - a.count);

    // 5. Issue Frequencies: derived from analyzed records' primary topics
    const topicMap = new Map<string, {
      count: number;
      severities: number[];
      negativeCount: number;
      categories: Record<string, number>;
    }>();

    for (const { record, analysis } of analyzedRecords) {
      const topic = (analysis.primaryTopic || 'General Feedback').trim();
      if (!topic) continue;

      let entry = topicMap.get(topic);
      if (!entry) {
        entry = { count: 0, severities: [], negativeCount: 0, categories: {} };
        topicMap.set(topic, entry);
      }
      entry.count++;
      const sev = analysis.urgencyScore ? Math.round(analysis.urgencyScore * 5) : 3;
      entry.severities.push(sev);
      if (analysis.sentiment === 'negative') {
        entry.negativeCount++;
      }
      entry.categories[record.category] = (entry.categories[record.category] || 0) + 1;
    }

    const issueFrequencies: IssueFrequencyMetric[] = Array.from(topicMap.entries())
      .map(([topic, stats]) => {
        const avgSev = stats.severities.length > 0
          ? Number((stats.severities.reduce((a, b) => a + b, 0) / stats.severities.length).toFixed(2))
          : null;
        return {
          topic,
          count: stats.count,
          percentage: analyzedFeedback > 0 ? Number(((stats.count / analyzedFeedback) * 100).toFixed(2)) : 0,
          averageSeverity: avgSev,
          negativeCount: stats.negativeCount,
          negativePercentage: stats.count > 0 ? Number(((stats.negativeCount / stats.count) * 100).toFixed(2)) : 0,
          categories: stats.categories,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // 6. Priority rankings: calculated from stored issue clusters
    let issuesList = this.store.getAllIssues({
      category: filters.category,
      search: filters.search,
    });

    if (filters.topic && filters.topic !== 'all') {
      const topLower = filters.topic.toLowerCase().trim();
      issuesList = issuesList.filter(
        (i) => i.title.toLowerCase().includes(topLower) || i.category.toLowerCase().includes(topLower)
      );
    }

    const tierSummary: PriorityTierSummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const priorityRankings: PriorityRankingMetric[] = issuesList.map((issue) => {
      const tier = (issue.priority || 'medium').toLowerCase() as keyof PriorityTierSummary;
      if (tier in tierSummary) {
        tierSummary[tier]++;
      }
      const rawScore = issue.metadata?.priorityScore;
      const score = typeof rawScore === 'number' ? rawScore : Number(rawScore) || 0;
      return {
        issueId: issue.id,
        issueCode: issue.issueCode,
        title: issue.title,
        category: issue.category,
        priorityTier: issue.priority as 'critical' | 'high' | 'medium' | 'low',
        priorityScore: score,
        totalMentions: issue.feedbackCount,
        uniqueReports: issue.uniqueTextCount,
        duplicateRatio: issue.feedbackCount > 0
          ? Number((((issue.feedbackCount - issue.uniqueTextCount) / issue.feedbackCount) * 100).toFixed(2))
          : 0,
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);

    // 7. Duplicate-text statistics across matching records
    const textFreqMap = new Map<string, { count: number; category: string; fullSnippet: string }>();
    for (const r of records) {
      const normalized = r.review.trim().toLowerCase();
      const existing = textFreqMap.get(normalized);
      if (existing) {
        existing.count++;
      } else {
        textFreqMap.set(normalized, {
          count: 1,
          category: r.category,
          fullSnippet: r.review.length > 120 ? `${r.review.slice(0, 117)}...` : r.review,
        });
      }
    }

    const uniqueReviewTexts = textFreqMap.size;
    const duplicateFeedbackCount = Math.max(0, totalFeedback - uniqueReviewTexts);
    const duplicateRatio = totalFeedback > 0
      ? Number(((duplicateFeedbackCount / totalFeedback) * 100).toFixed(2))
      : 0;

    const topRepeatedReviews: TopRepeatedReview[] = Array.from(textFreqMap.values())
      .filter((item) => item.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => ({
        textSnippet: item.fullSnippet,
        count: item.count,
        duplicateCount: item.count - 1,
        category: item.category,
      }));

    return {
      filtersApplied: {
        category: filters.category || 'all',
        sentiment: filters.sentiment || 'all',
        topic: filters.topic || 'all',
        analysisStatus: filters.analysisStatus || 'all',
        datasetType: filters.datasetType || 'all',
        search: filters.search || '',
      },
      summary: {
        totalFeedback,
        analyzedFeedback,
        pendingAnalysis,
        analysisCoveragePercent,
        hasAnalysisRun,
        isEmpty,
        statusMessage,
      },
      sentiment: sentimentMetrics,
      categories,
      issueFrequencies,
      priorityRankings: {
        issues: priorityRankings,
        tierSummary,
        hasScoredIssues: priorityRankings.length > 0,
        disclaimer: 'Priority scores are deterministic heuristics calculated for triage ranking and do not represent validated financial or legal risk.',
      },
      duplicateStats: {
        totalFeedback,
        uniqueReviewTexts,
        duplicateFeedbackCount,
        duplicateRatio,
        topRepeatedReviews,
      },
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * High performance SQL query aggregation when PostgreSQL connection is available
   */
  private async getMetricsFromDatabase(filters: AnalyticsFilterParams): Promise<AnalyticsMetricsResponse | null> {
    const pool = getPgPool();
    const whereClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.datasetType && filters.datasetType !== 'all') {
      whereClauses.push(`(f.metadata->>'datasetType') = $${paramIndex++}`);
      values.push(filters.datasetType);
    }

    if (filters.category && filters.category !== 'all') {
      whereClauses.push(`LOWER(f.metadata->>'category') = LOWER($${paramIndex++})`);
      values.push(filters.category);
    }

    if (filters.analysisStatus && filters.analysisStatus !== 'all') {
      if (filters.analysisStatus === 'analyzed') {
        whereClauses.push('fa.id IS NOT NULL');
      } else if (filters.analysisStatus === 'pending') {
        whereClauses.push('fa.id IS NULL');
      }
    }

    if (filters.sentiment && filters.sentiment !== 'all') {
      whereClauses.push(`LOWER(fa.sentiment) = LOWER($${paramIndex++})`);
      values.push(filters.sentiment);
    }

    if (filters.topic && filters.topic !== 'all') {
      whereClauses.push(`(LOWER(fa.primary_topic) LIKE LOWER($${paramIndex}) OR fa.topics::text ILIKE $${paramIndex})`);
      values.push(`%${filters.topic}%`);
      paramIndex++;
    }

    if (filters.search && filters.search.trim()) {
      whereClauses.push(`(f.content ILIKE $${paramIndex} OR f.metadata->>'category' ILIKE $${paramIndex})`);
      values.push(`%${filters.search.trim()}%`);
      paramIndex++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Fast aggregate query
    const aggSql = `
      SELECT
        COUNT(*)::int AS total_feedback,
        COUNT(fa.id)::int AS analyzed_feedback,
        COUNT(CASE WHEN fa.sentiment = 'positive' THEN 1 END)::int AS positive_count,
        COUNT(CASE WHEN fa.sentiment = 'neutral' THEN 1 END)::int AS neutral_count,
        COUNT(CASE WHEN fa.sentiment = 'negative' THEN 1 END)::int AS negative_count,
        COUNT(CASE WHEN fa.sentiment = 'mixed' THEN 1 END)::int AS mixed_count,
        AVG(fa.sentiment_score)::float AS avg_sentiment_score,
        AVG(CASE WHEN fa.urgency_score IS NOT NULL THEN (fa.urgency_score * 5) END)::float AS avg_severity
      FROM feedback f
      LEFT JOIN feedback_analysis fa ON f.id = fa.feedback_id
      ${whereSql};
    `;

    const aggRes = await pool.query(aggSql, values);
    const row = aggRes.rows[0];
    if (!row) return null;

    // Delegate remaining deep clustering/scoring synthesis to store to ensure exact consistency
    const storeFallback = this.getMetricsFromStore(filters);

    const totalFeedback = Number(row.total_feedback || 0);
    const analyzedFeedback = Number(row.analyzed_feedback || 0);
    const pendingAnalysis = totalFeedback - analyzedFeedback;
    const denominator = analyzedFeedback;

    storeFallback.summary.totalFeedback = totalFeedback;
    storeFallback.summary.analyzedFeedback = analyzedFeedback;
    storeFallback.summary.pendingAnalysis = pendingAnalysis;
    storeFallback.summary.analysisCoveragePercent = totalFeedback > 0
      ? Number(((analyzedFeedback / totalFeedback) * 100).toFixed(2))
      : 0;
    storeFallback.summary.hasAnalysisRun = analyzedFeedback > 0;
    storeFallback.summary.isEmpty = totalFeedback === 0;

    storeFallback.sentiment.denominator = denominator;
    storeFallback.sentiment.counts = {
      positive: Number(row.positive_count || 0),
      neutral: Number(row.neutral_count || 0),
      negative: Number(row.negative_count || 0),
      mixed: Number(row.mixed_count || 0),
    };
    storeFallback.sentiment.percentages = {
      positive: denominator > 0 ? Number(((Number(row.positive_count || 0) / denominator) * 100).toFixed(2)) : 0,
      neutral: denominator > 0 ? Number(((Number(row.neutral_count || 0) / denominator) * 100).toFixed(2)) : 0,
      negative: denominator > 0 ? Number(((Number(row.negative_count || 0) / denominator) * 100).toFixed(2)) : 0,
      mixed: denominator > 0 ? Number(((Number(row.mixed_count || 0) / denominator) * 100).toFixed(2)) : 0,
    };
    storeFallback.sentiment.averageSentimentScore = row.avg_sentiment_score != null
      ? Number(Number(row.avg_sentiment_score).toFixed(3))
      : null;
    storeFallback.sentiment.averageSeverity = row.avg_severity != null
      ? Number(Number(row.avg_severity).toFixed(2))
      : null;

    return storeFallback;
  }
}
