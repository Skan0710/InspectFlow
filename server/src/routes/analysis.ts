import { Router, type Request, type Response } from 'express';
import { BatchAnalysisPipeline } from '../services/analysis/batchPipeline.js';
import { FeedbackStore } from '../services/feedbackStore.js';

const router = Router();
const pipeline = BatchAnalysisPipeline.getInstance();
const store = FeedbackStore.getInstance();

/**
 * POST /api/analysis/start
 * Starts batch analysis on unanalyzed feedback in the background.
 * Concurrency protected: rejects if another run is currently active.
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { batchSize, concurrency, rateLimitDelayMs, datasetType, limit } = req.body;

    const run = await pipeline.startRun({
      batchSize: batchSize ? Number(batchSize) : undefined,
      concurrency: concurrency ? Number(concurrency) : undefined,
      rateLimitDelayMs: rateLimitDelayMs !== undefined ? Number(rateLimitDelayMs) : undefined,
      datasetType,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(202).json({
      success: true,
      message: run.itemsTotal === 0
        ? 'All records have already been analyzed.'
        : `Analysis run initiated for ${run.itemsTotal} unanalyzed reviews.`,
      data: run,
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err as unknown as { code: string }).code === 'RUN_ALREADY_IN_PROGRESS') {
      const activeStatus = pipeline.getStatus();
      res.status(409).json({
        error: 'Conflict',
        message: 'An analysis run is already in progress. Please wait for it to finish or cancel it before starting another.',
        data: activeStatus.run,
      });
      return;
    }

    console.error('[AnalysisRoutes] Error starting run:', err);
    res.status(500).json({
      error: 'InternalServerError',
      message: err instanceof Error ? err.message : 'Failed to start analysis run',
    });
  }
});

/**
 * GET /api/analysis/status
 * Polling endpoint returning the live progress, counts, and failure details of active/latest run.
 */
router.get('/status', (req: Request, res: Response) => {
  const runId = req.query.runId as string | undefined;
  const status = pipeline.getStatus(runId);
  const unanalyzedCount = store.getUnanalyzedRecords().length;
  const totalRecords = store.getTotalRecordsCount();

  res.status(200).json({
    data: {
      ...status,
      dataset: {
        totalRecords,
        unanalyzedCount,
        analyzedCount: totalRecords - unanalyzedCount,
      },
    },
  });
});

/**
 * POST /api/analysis/cancel
 * Cancels an active analysis run cleanly without losing previously completed results.
 */
router.post('/cancel', async (req: Request, res: Response) => {
  const runId = req.body.runId as string | undefined;
  const cancelled = await pipeline.cancelActiveRun(runId);

  if (!cancelled) {
    res.status(404).json({
      error: 'NotFound',
      message: 'No active analysis run found to cancel.',
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Analysis run was cancelled.',
    data: cancelled,
  });
});

/**
 * POST /api/analysis/resume
 * Resumes analysis by picking up remaining unanalyzed records without duplicating finished results.
 */
router.post('/resume', async (req: Request, res: Response) => {
  try {
    const { batchSize, concurrency, rateLimitDelayMs, datasetType, limit } = req.body;

    const run = await pipeline.startRun({
      batchSize: batchSize ? Number(batchSize) : undefined,
      concurrency: concurrency ? Number(concurrency) : undefined,
      rateLimitDelayMs: rateLimitDelayMs !== undefined ? Number(rateLimitDelayMs) : undefined,
      datasetType,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(202).json({
      success: true,
      message: run.itemsTotal === 0
        ? 'All records have already been analyzed.'
        : `Resumed analysis run for remaining ${run.itemsTotal} unanalyzed reviews.`,
      data: run,
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err as unknown as { code: string }).code === 'RUN_ALREADY_IN_PROGRESS') {
      const activeStatus = pipeline.getStatus();
      res.status(409).json({
        error: 'Conflict',
        message: 'An analysis run is already in progress.',
        data: activeStatus.run,
      });
      return;
    }

    res.status(500).json({
      error: 'InternalServerError',
      message: err instanceof Error ? err.message : 'Failed to resume analysis run',
    });
  }
});

/**
 * GET /api/analysis/runs
 * Returns history of past analysis runs.
 */
router.get('/runs', (_req: Request, res: Response) => {
  const runs = store.getAllAnalysisRuns();
  res.status(200).json({ data: runs });
});

/**
 * GET /api/analysis/runs/:id
 * Returns details of a specific past run.
 */
router.get('/runs/:id', (req: Request, res: Response) => {
  const run = store.getAnalysisRunById(req.params.id);
  if (!run) {
    res.status(404).json({
      error: 'NotFound',
      message: `Analysis run "${req.params.id}" not found.`,
    });
    return;
  }
  res.status(200).json({ data: run });
});

export default router;
