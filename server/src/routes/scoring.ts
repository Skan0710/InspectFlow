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

    const options: ScoringOptions = {};
    if (weights) options.weights = weights;
    if (thresholds) options.thresholds = thresholds;
    if (typeof defaultSeverity === 'number') options.defaultSeverity = defaultSeverity;

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
    const issues = store.getAllIssues();
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
