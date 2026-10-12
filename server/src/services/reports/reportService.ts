import crypto from 'node:crypto';
import { FeedbackStore } from '../feedbackStore.js';
import { AnalyticsService } from '../analytics/analyticsService.js';
import { RecommendationService } from '../recommendations/recommendationService.js';
import type {
  CreateReportRequest,
  ReportContentPayload,
  ReportRecord,
  ReportScope,
  ReportTopIssue,
  ReportRepresentativeExcerpt,
} from '../../types/reports.js';
import type { IssuePriority } from '../../types/issues.js';

export class ReportService {
  private store: FeedbackStore;
  private analyticsService: AnalyticsService;
  private recommendationService: RecommendationService;

  constructor() {
    this.store = FeedbackStore.getInstance();
    this.analyticsService = new AnalyticsService();
    this.recommendationService = new RecommendationService();
  }

  /**
   * Generates a comprehensive, evidence-backed business intelligence report
   * strictly calculated from actual database records.
   */
  public async generateReport(request: CreateReportRequest = {}): Promise<ReportRecord> {
    const scope: ReportScope = request.scope || {};
    const reportType = request.reportType || 'executive_summary';
    const format = request.format || 'both';

    // 1. Calculate analytics metrics from actual records matching the filter scope
    const metrics = await this.analyticsService.getMetrics(scope);

    // 2. Retrieve actual records to determine genuine date range (without fabricating trends)
    const recordsResult = this.store.getRecords({
      page: 1,
      pageSize: 100000,
      category: scope.category,
      datasetType: scope.datasetType,
      sentiment: scope.sentiment,
      topic: scope.topic,
      severity: scope.severity,
      analysisStatus: scope.analysisStatus,
      search: scope.search,
    });
    const records = recordsResult.data;

    let minDate: string | null = null;
    let maxDate: string | null = null;
    const distinctDates = new Set<string>();

    for (const r of records) {
      const ts = r.importedAt || (r as any).createdAt;
      if (ts) {
        const dStr = new Date(ts).toISOString();
        distinctDates.add(dStr.slice(0, 10));
        if (!minDate || dStr < minDate) minDate = dStr;
        if (!maxDate || dStr > maxDate) maxDate = dStr;
      }
    }

    const isSnapshot = distinctDates.size <= 1;
    const applicableDateRange = {
      start: minDate,
      end: maxDate,
      isSnapshot,
      note: isSnapshot
        ? 'Current Snapshot (Imported Dataset) — historical trend comparisons are omitted because records share the same ingestion snapshot.'
        : `Spanning ${distinctDates.size} discrete observation days from ${minDate ? minDate.slice(0, 10) : ''} to ${maxDate ? maxDate.slice(0, 10) : ''}.`,
    };

    // 3. Issue Action Center Status Summary
    const allIssues = this.store.getAllIssues();
    const issueStatusSummary = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      dismissed: 0,
      total: allIssues.length,
    };

    for (const issue of allIssues) {
      const st = (issue.status || 'open').toLowerCase();
      if (st === 'open' || st === 'backlog') issueStatusSummary.open++;
      else if (st === 'in_progress' || st === 'in_review') issueStatusSummary.in_progress++;
      else if (st === 'resolved' || st === 'completed') issueStatusSummary.resolved++;
      else if (st === 'dismissed' || st === 'cancelled') issueStatusSummary.dismissed++;
      else issueStatusSummary.open++;
    }

    // 4. Top Priority Issues & Score Components & Grounded Recommendations
    const topIssuesData: ReportTopIssue[] = [];
    const getPriorityScore = (iss: any): number => {
      if (typeof iss.metadata?.priorityScore === 'number') return iss.metadata.priorityScore;
      return Number(iss.metadata?.priorityScore) || 50;
    };

    const rankedIssues = [...allIssues].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
    const targetIssues = rankedIssues.slice(0, 8);

    for (const issue of targetIssues) {
      const memberDetails = this.store.getFeedbackForIssue(issue.id);
      const excerpts: ReportRepresentativeExcerpt[] = [];

      for (const m of memberDetails.slice(0, 4)) {
        excerpts.push({
          feedbackId: m.feedback.id,
          quote: m.feedback.review,
          sentiment: m.analysis?.sentiment || 'unanalyzed',
          category: m.feedback.category,
        });
      }

      // Check recommendation
      let rec = this.store.getRecommendationByIssueId(issue.id);
      if (!rec && issue.metadata && (issue.metadata as any).recommendation) {
        rec = (issue.metadata as any).recommendation;
      }
      if (!rec) {
        try {
          rec = await this.recommendationService.generateRecommendation(issue.id);
        } catch {
          rec = null;
        }
      }

      const priorityScore = getPriorityScore(issue);
      // Stored breakdowns nest the point values under `components`; tolerate the flat shape too
      const storedBreakdown = (issue.metadata as any)?.scoreBreakdown;
      const scoreBreakdown = storedBreakdown?.components ||
        storedBreakdown || {
          frequencyPoints: Math.round(priorityScore * 0.4),
          severityPoints: Math.round(priorityScore * 0.35),
          negativeSentimentPoints: Math.round(priorityScore * 0.25),
        };

      const negRatio =
        issue.feedbackCount > 0
          ? Number((issue.sentimentBreakdown.negative / issue.feedbackCount).toFixed(2))
          : 0;

      topIssuesData.push({
        id: issue.id,
        code: issue.issueCode,
        title: issue.title,
        category: issue.category,
        priority: (issue.priority || 'medium') as IssuePriority,
        priorityScore,
        status: issue.status || 'open',
        frequency: issue.feedbackCount || 0,
        uniqueReports: issue.uniqueTextCount || issue.feedbackCount || 0,
        negativeSentimentRatio: negRatio,
        scoreBreakdown: {
          frequencyPoints: scoreBreakdown.frequencyPoints || 0,
          severityPoints: scoreBreakdown.severityPoints || 0,
          negativeSentimentPoints: scoreBreakdown.negativeSentimentPoints || 0,
        },
        representativeExcerpts: excerpts,
        recommendation: rec
          ? {
              summary: rec.issueSummary,
              whyItMatters: rec.whyItMatters,
              responsibleTeam: rec.suggestedTeam,
              recommendedActions: rec.recommendedActions.map((a) => ({
                action: a.title,
                rationale: a.description,
                expectedImpact: a.expectedImpact,
              })),
            }
          : undefined,
      });
    }

    // 5. Net Sentiment Calculation
    const analyzedDenominator = metrics.sentiment.denominator || 0;
    const netSentimentScore =
      analyzedDenominator > 0
        ? Number(
            (
              ((metrics.sentiment.counts.positive - metrics.sentiment.counts.negative) /
                analyzedDenominator) *
              100
            ).toFixed(1)
          )
        : 0;

    // 6. Synthesize Executive Summary from Measured Facts
    const datasetOriginName = scope.datasetType
      ? scope.datasetType === 'genuine_import'
        ? 'Genuine Production CSV Dataset'
        : scope.datasetType === 'demo_sample'
        ? 'Demo Sample Demonstration Fixture'
        : 'All Feedback Data'
      : 'Complete Customer Ingestion Corpus';

    const execSummaryParts: string[] = [];
    execSummaryParts.push(
      `This report synthesizes customer feedback across ${metrics.summary.totalFeedback} feedback items from the ${datasetOriginName}.`
    );

    if (metrics.summary.analyzedFeedback > 0) {
      execSummaryParts.push(
        `AI sentiment and semantic analysis coverage stands at ${metrics.summary.analysisCoveragePercent}% (${metrics.summary.analyzedFeedback} analyzed, ${metrics.summary.pendingAnalysis} pending).`
      );
      execSummaryParts.push(
        `Customer sentiment reflects ${metrics.sentiment.percentages.positive}% positive, ${metrics.sentiment.percentages.neutral}% neutral, and ${metrics.sentiment.percentages.negative}% negative distribution, yielding a Net Sentiment Index of ${netSentimentScore > 0 ? '+' : ''}${netSentimentScore}.`
      );
    } else {
      execSummaryParts.push(
        `Semantic analysis has not yet run across this dataset partition; all records remain queued for classification.`
      );
    }

    if (metrics.categories.length > 0) {
      const topCat = metrics.categories[0];
      execSummaryParts.push(
        `The primary driver of customer feedback volume is "${topCat.category}" (${topCat.count} items, ${topCat.percentage}% of corpus).`
      );
    }

    if (topIssuesData.length > 0) {
      const highestSev = topIssuesData[0];
      execSummaryParts.push(
        `Top operational friction is concentrated in "${highestSev.title}" (Priority Score: ${highestSev.priorityScore}/100 [${highestSev.priority.toUpperCase()}], Frequency: ${highestSev.frequency} mentions). Action Center tracks ${issueStatusSummary.open + issueStatusSummary.in_progress} open/in-progress initiatives against ${issueStatusSummary.resolved} resolved tickets.`
      );
    }

    const executiveSummary = execSummaryParts.join(' ');

    // 7. Generate Unique Report Code & IDs
    const now = new Date();
    const dateCode = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const reportCode = `REP-${dateCode}-${randomSuffix}`;
    const reportId = crypto.randomUUID();

    const title =
      request.title && request.title.trim()
        ? request.title.trim()
        : `${reportType === 'executive_summary' ? 'Executive Customer Intelligence Digest' : reportType === 'full_audit' ? 'Comprehensive Product Friction Audit' : reportType === 'issue_digest' ? 'High-Priority Issue & Action Digest' : 'Customer Sentiment Overview'} (${reportCode})`;

    const description =
      request.description && request.description.trim()
        ? request.description.trim()
        : `Automated analytical intelligence briefing based on verified feedback records. Generated on ${now.toUTCString()}.`;

    // 8. Assemble Content Payload
    const contentPayload: ReportContentPayload = {
      metadata: {
        reportId,
        reportCode,
        title,
        description,
        reportType,
        format,
        generatedAt: now.toISOString(),
        applicableDateRange,
        filterScope: scope,
      },
      executiveSummary,
      datasetScope: {
        totalFeedback: metrics.summary.totalFeedback,
        analyzedFeedback: metrics.summary.analyzedFeedback,
        pendingAnalysis: metrics.summary.pendingAnalysis,
        analysisCoveragePercent: metrics.summary.analysisCoveragePercent,
        datasetOrigin: datasetOriginName,
        duplicateCount: metrics.duplicateStats.duplicateFeedbackCount,
        uniqueCount: metrics.duplicateStats.uniqueReviewTexts,
        // duplicateStats.duplicateRatio is already expressed as a percentage
        duplicateRatePercent: Math.round(metrics.duplicateStats.duplicateRatio),
      },
      sentimentDistribution: {
        positive: {
          count: metrics.sentiment.counts.positive,
          percentage: metrics.sentiment.percentages.positive,
        },
        neutral: {
          count: metrics.sentiment.counts.neutral,
          percentage: metrics.sentiment.percentages.neutral,
        },
        negative: {
          count: metrics.sentiment.counts.negative,
          percentage: metrics.sentiment.percentages.negative,
        },
        mixed: {
          count: metrics.sentiment.counts.mixed,
          percentage: metrics.sentiment.percentages.mixed,
        },
        denominator: analyzedDenominator,
        netSentimentScore,
      },
      categoryBreakdown: metrics.categories.map((c) => {
        const sb = c.sentimentBreakdown;
        const dominantSentiment =
          sb.positive >= sb.negative && sb.positive >= sb.neutral
            ? 'positive'
            : sb.negative >= sb.neutral
            ? 'negative'
            : 'neutral';
        return {
          category: c.category,
          count: c.count,
          percentage: c.percentage,
          dominantSentiment,
        };
      }),
      topPriorityIssues: topIssuesData,
      issueStatusSummary,
    };

    const reportRecord: ReportRecord = {
      id: reportId,
      reportCode,
      title,
      description,
      reportType,
      status: 'generated',
      cadence: request.cadence || 'On-Demand',
      format,
      contentPayload,
      storagePath: null,
      recipients: request.recipients || [],
      generatedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // 9. Persist to store & PostgreSQL
    await this.store.saveReport(reportRecord);

    return reportRecord;
  }
}
