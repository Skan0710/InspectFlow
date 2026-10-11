import { Router, type Request, type Response } from 'express';
import { AnalyticsService } from '../services/analytics/analyticsService.js';
import type { AnalyticsFilterParams } from '../types/analytics.js';
import type { FeedbackSentiment } from '../services/analysis/types.js';

const router = Router();
const analyticsService = new AnalyticsService();

const ALLOWED_SENTIMENTS = new Set(['positive', 'neutral', 'negative', 'mixed', 'all']);
const ALLOWED_ANALYSIS_STATUSES = new Set(['analyzed', 'pending', 'all']);
const ALLOWED_DATASET_TYPES = new Set(['genuine_import', 'demo_sample', 'all']);

export function validateAnalyticsFilters(query: Request['query']): {
  filters: AnalyticsFilterParams;
  error?: string;
} {
  const category = typeof query.category === 'string' && query.category.trim() ? query.category.trim() : undefined;
  const topic = typeof query.topic === 'string' && query.topic.trim() ? query.topic.trim() : undefined;
  const search = typeof query.search === 'string' && query.search.trim() ? query.search.trim() : undefined;

  let sentiment: FeedbackSentiment | 'all' | undefined;
  if (typeof query.sentiment === 'string' && query.sentiment.trim()) {
    const s = query.sentiment.toLowerCase().trim();
    if (!ALLOWED_SENTIMENTS.has(s)) {
      return {
        filters: {},
        error: `Invalid sentiment filter '${query.sentiment}'. Must be one of: positive, neutral, negative, mixed, all.`,
      };
    }
    sentiment = s as FeedbackSentiment | 'all';
  }

  let analysisStatus: 'analyzed' | 'pending' | 'all' | undefined;
  if (typeof query.analysisStatus === 'string' && query.analysisStatus.trim()) {
    const as = query.analysisStatus.toLowerCase().trim();
    if (!ALLOWED_ANALYSIS_STATUSES.has(as)) {
      return {
        filters: {},
        error: `Invalid analysisStatus filter '${query.analysisStatus}'. Must be one of: analyzed, pending, all.`,
      };
    }
    analysisStatus = as as 'analyzed' | 'pending' | 'all';
  }

  let datasetType: 'genuine_import' | 'demo_sample' | 'all' | undefined;
  if (typeof query.datasetType === 'string' && query.datasetType.trim()) {
    const dt = query.datasetType.trim();
    if (!ALLOWED_DATASET_TYPES.has(dt)) {
      return {
        filters: {},
        error: `Invalid datasetType filter '${query.datasetType}'. Must be one of: genuine_import, demo_sample, all.`,
      };
    }
    datasetType = dt as 'genuine_import' | 'demo_sample' | 'all';
  }

  let severity: number | 'all' | undefined;
  if (typeof query.severity === 'string' && query.severity.trim()) {
    const sevStr = query.severity.trim().toLowerCase();
    if (sevStr !== 'all') {
      const parsed = Number(sevStr);
      if (isNaN(parsed) || parsed < 1 || parsed > 5) {
        return {
          filters: {},
          error: `Invalid severity filter '${query.severity}'. Must be an integer between 1 and 5, or 'all'.`,
        };
      }
      severity = parsed;
    } else {
      severity = 'all';
    }
  }

  const ALLOWED_SORT_FIELDS = new Set(['rowNumber', 'severity', 'confidence', 'sentimentScore', 'category', 'importedAt']);
  let sortBy: any = undefined;
  if (typeof query.sortBy === 'string' && query.sortBy.trim()) {
    const s = query.sortBy.trim();
    if (!ALLOWED_SORT_FIELDS.has(s)) {
      return {
        filters: {},
        error: `Invalid sortBy field '${query.sortBy}'. Must be one of: ${Array.from(ALLOWED_SORT_FIELDS).join(', ')}.`,
      };
    }
    sortBy = s;
  }

  let sortOrder: 'asc' | 'desc' | undefined = undefined;
  if (typeof query.sortOrder === 'string' && query.sortOrder.trim()) {
    const so = query.sortOrder.trim().toLowerCase();
    if (so !== 'asc' && so !== 'desc') {
      return {
        filters: {},
        error: `Invalid sortOrder '${query.sortOrder}'. Must be 'asc' or 'desc'.`,
      };
    }
    sortOrder = so as 'asc' | 'desc';
  }

  return {
    filters: {
      category,
      sentiment,
      topic,
      severity,
      analysisStatus,
      datasetType,
      search,
      sortBy,
      sortOrder,
    },
  };
}

async function handleGetMetrics(req: Request, res: Response): Promise<void> {
  const { filters, error } = validateAnalyticsFilters(req.query);
  if (error) {
    res.status(400).json({
      error: 'ValidationError',
      message: error,
    });
    return;
  }

  try {
    const metrics = await analyticsService.getMetrics(filters);
    res.status(200).json(metrics);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to calculate analytics metrics';
    console.error('[Analytics API] Error computing metrics:', err);
    res.status(500).json({
      error: 'AnalyticsError',
      message,
    });
  }
}

/**
 * GET /api/analytics
 * GET /api/analytics/metrics
 * GET /api/analytics/overview
 * Comprehensive customer feedback intelligence metrics, sentiment ratios, category breakdown,
 * issue frequencies, priority rankings, and duplicate statistics.
 */
router.get('/', handleGetMetrics);
router.get('/metrics', handleGetMetrics);
router.get('/overview', handleGetMetrics);

export default router;
