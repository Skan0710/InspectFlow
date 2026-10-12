import { Router, type Request, type Response } from 'express';
import { FeedbackStore } from '../services/feedbackStore.js';
import type { ScoringOptions } from '../services/scoring/types.js';

const router = Router();
const store = FeedbackStore.getInstance();

/**
 * POST /api/scoring/recalculate
 * Triggers deterministic priority score recalculation across all stored issues.
 */
router.post('/recalculate', async (req: Request, res: Response) => {
  try {
    const { weights, thresholds, defaultSeverity } = req.body || {};

    const isFiniteNonNegative = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
    const options: ScoringOptions = {};

    if (weights !== undefined && weights !== null) {
      const valid =
        typeof weights === 'object' &&
        Object.entries(weights).every(
          ([k, v]) => ['frequency', 'severity', 'negativeSentiment'].includes(k) && isFiniteNonNegative(v)
        );
      if (!valid) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'weights must be an object of non-negative numbers keyed by frequency, severity, negativeSentiment.',
        });
        return;
      }
      options.weights = weights;
    }

    if (thresholds !== undefined && thresholds !== null) {
      const valid =
        typeof thresholds === 'object' &&
        Object.entries(thresholds).every(
          ([k, v]) =>
            ['critical', 'high', 'medium'].includes(k) && isFiniteNonNegative(v) && (v as number) <= 100
        );
      if (!valid) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'thresholds must be an object of numbers between 0 and 100 keyed by critical, high, medium.',
        });
        return;
      }
      options.thresholds = thresholds;
    }

    if (defaultSeverity !== undefined && defaultSeverity !== null) {
      if (typeof defaultSeverity !== 'number' || !Number.isFinite(defaultSeverity) || defaultSeverity < 1 || defaultSeverity > 5) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'defaultSeverity must be a number between 1 and 5.',
        });
        return;
      }
      options.defaultSeverity = defaultSeverity;
    }

    const result = await store.recalculateIssuePriorityScores(options);

    res.status(200).json({
      success: true,
      message: `Successfully recalculated priority scores for ${result.summary.totalIssuesScored} issues.`,
      summary: result.summary,
      issues: result.issues,
    });
  } catch (err: any) {
    console.error('[Scoring API] Error recalculating priority scores:', err);
    res.status(500).json({
      error: 'ScoringError',
      message: err.message || 'Failed to recalculate priority scores.',
    });
  }
});

/**
 * GET /api/scoring/summary
 * Returns global priority scoring summary, tier breakdown, and algorithm metadata.
 */
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const result = await store.recalculateIssuePriorityScores();

    res.status(200).json({
      success: true,
      summary: result.summary,
    });
  } catch (err: any) {
    console.error('[Scoring API] Error retrieving scoring summary:', err);
    res.status(500).json({
      error: 'RetrievalError',
      message: err.message || 'Failed to retrieve scoring summary.',
    });
  }
});

/**
 * GET /api/scoring/issues/:id
 * Returns score breakdown, component values, and duplicate analysis for a specific issue.
 */
router.get('/issues/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const issue = store.getIssueById(id);

    if (!issue) {
      res.status(404).json({
        error: 'NotFound',
        message: `Issue with id '${id}' not found.`,
      });
      return;
    }

    const breakdown = issue.metadata?.scoreBreakdown;
    const priorityScore = issue.metadata?.priorityScore ?? 0;
    const priorityTier = issue.priority;

    res.status(200).json({
      success: true,
      issueId: issue.id,
      issueCode: issue.issueCode,
      title: issue.title,
      category: issue.category,
      priorityScore,
      priorityTier,
      totalMentions: issue.feedbackCount,
      uniqueReports: issue.uniqueTextCount,
      breakdown,
      algorithmVersion: issue.metadata?.algorithmVersion,
      disclaimer: issue.metadata?.disclaimer,
    });
  } catch (err: any) {
    console.error('[Scoring API] Error retrieving issue score:', err);
    res.status(500).json({
      error: 'RetrievalError',
      message: err.message || 'Failed to retrieve issue score breakdown.',
    });
  }
});

export default router;
