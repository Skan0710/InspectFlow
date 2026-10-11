import { Router, type Request, type Response } from 'express';
import { RecommendationService } from '../services/recommendations/recommendationService.js';
import { FeedbackStore } from '../services/feedbackStore.js';

const router = Router();
const store = FeedbackStore.getInstance();
const service = new RecommendationService();

/**
 * GET /api/recommendations
 * Returns stored recommendations across issues, with optional filtering.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { issueId, priorityTier, team } = req.query as {
      issueId?: string;
      priorityTier?: string;
      team?: string;
    };

    let recommendations = store.getAllRecommendations();

    // If no recommendations exist yet, check if there are high-priority issues to auto-populate
    if (recommendations.length === 0) {
      const issues = store.getAllIssues();
      const highPriority = issues.filter(
        (i) => i.priority === 'critical' || i.priority === 'high'
      );
      if (highPriority.length > 0) {
        recommendations = await service.generateRecommendationsForHighPriority();
      }
    }

    if (issueId) {
      recommendations = recommendations.filter((r) => r.issueId === issueId);
    }

    if (priorityTier && priorityTier !== 'all') {
      const tier = priorityTier.toLowerCase().trim();
      recommendations = recommendations.filter(
        (r) => r.measuredFacts.priorityTier.toLowerCase() === tier
      );
    }

    if (team && team !== 'all') {
      const targetTeam = team.toLowerCase().trim();
      recommendations = recommendations.filter(
        (r) => r.suggestedTeam.toLowerCase() === targetTeam
      );
    }

    res.status(200).json({
      success: true,
      count: recommendations.length,
      recommendations,
    });
  } catch (err: unknown) {
    console.error('[Recommendations API] Error fetching recommendations:', err);
    res.status(500).json({
      error: 'RecommendationsError',
      message: err instanceof Error ? err.message : 'Failed to retrieve recommendations.',
    });
  }
});

/**
 * GET /api/recommendations/issue/:id
 * Retrieves or generates an evidence-backed recommendation for a specific issue.
 */
router.get('/issue/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const issue = store.getIssueById(id);

    if (!issue) {
      res.status(404).json({
        error: 'NotFound',
        message: `Issue cluster with id '${id}' not found.`,
      });
      return;
    }

    const recommendation = await service.generateRecommendation(id, {
      forceRefresh: req.query.refresh === 'true',
    });

    res.status(200).json({
      success: true,
      recommendation,
    });
  } catch (err: unknown) {
    console.error(`[Recommendations API] Error fetching recommendation for issue ${req.params.id}:`, err);
    res.status(500).json({
      error: 'RecommendationsError',
      message: err instanceof Error ? err.message : 'Failed to generate recommendation.',
    });
  }
});

/**
 * POST /api/recommendations/generate/:id
 * Generates or regenerates an evidence-backed recommendation for an issue.
 */
router.post('/generate/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const issue = store.getIssueById(id);

    if (!issue) {
      res.status(404).json({
        error: 'NotFound',
        message: `Issue cluster with id '${id}' not found.`,
      });
      return;
    }

    const recommendation = await service.generateRecommendation(id, {
      forceRefresh: true,
    });

    res.status(200).json({
      success: true,
      message: `Generated evidence-backed recommendation for issue ${issue.issueCode}.`,
      recommendation,
    });
  } catch (err: unknown) {
    console.error(`[Recommendations API] Error generating recommendation for issue ${req.params.id}:`, err);
    res.status(500).json({
      error: 'GenerationError',
      message: err instanceof Error ? err.message : 'Failed to generate recommendation.',
    });
  }
});

/**
 * POST /api/recommendations/generate-all
 * Batch generates evidence-backed recommendations for all high-priority issues.
 */
router.post('/generate-all', async (_req: Request, res: Response) => {
  try {
    const recommendations = await service.generateRecommendationsForHighPriority();

    res.status(200).json({
      success: true,
      message: `Generated recommendations for ${recommendations.length} high-priority issues.`,
      count: recommendations.length,
      recommendations,
    });
  } catch (err: unknown) {
    console.error('[Recommendations API] Error generating all high-priority recommendations:', err);
    res.status(500).json({
      error: 'GenerationError',
      message: err instanceof Error ? err.message : 'Failed to batch generate recommendations.',
    });
  }
});

export default router;
