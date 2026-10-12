import { Router, type Request, type Response } from 'express';
import { AdaptionService, NoFeedbackError } from '../services/adaption/adaptionService.js';

const router = Router();
const adaptionService = new AdaptionService();

/**
 * GET /api/adaption/status
 * Returns operational status of the Adaption Labs integration.
 */
router.get('/status', (_req: Request, res: Response) => {
  const status = adaptionService.getStatus();
  res.status(200).json(status);
});

/**
 * POST /api/adaption/test-connection
 * Tests live connectivity and authentication with upstream Adaption Labs API.
 */
router.post('/test-connection', async (_req: Request, res: Response) => {
  try {
    const result = await adaptionService.testConnection();
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection test failed';
    res.status(500).json({ ok: false, status: 500, message });
  }
});

/**
 * GET /api/adaption/test-connection
 * Convenience GET alias for quick dashboard health check.
 */
router.get('/test-connection', async (_req: Request, res: Response) => {
  try {
    const result = await adaptionService.testConnection();
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection test failed';
    res.status(500).json({ ok: false, status: 500, message });
  }
});

/**
 * POST /api/adaption/estimate
 * Calculates credit consumption and dollar cost estimate before launching a run.
 */
router.post('/estimate', (req: Request, res: Response) => {
  try {
    const { datasetType, maxRows, simulateRun } = req.body || {};
    if (maxRows !== undefined && maxRows !== null && !(Number.isInteger(Number(maxRows)) && Number(maxRows) >= 1)) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'maxRows must be a positive integer.',
      });
      return;
    }

    const estimate = adaptionService.getEstimate({
      datasetType,
      maxRows: maxRows ? Number(maxRows) : undefined,
      simulateRun: Boolean(simulateRun),
    });

    res.status(200).json({
      success: true,
      data: estimate,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to calculate estimate';
    res.status(400).json({
      error: 'EstimationError',
      message,
    });
  }
});

/**
 * GET /api/adaption/runs
 * Returns list of all persisted Adaption runs.
 */
router.get('/runs', (_req: Request, res: Response) => {
  const runs = adaptionService.getRuns();
  res.status(200).json({
    data: runs,
    total: runs.length,
  });
});

/**
 * GET /api/adaption/runs/:id
 * Retrieves details, quality metrics, and sample before/after pairs for a single run.
 */
router.get('/runs/:id', (req: Request, res: Response) => {
  const run = adaptionService.getRunById(req.params.id);
  if (!run) {
    res.status(404).json({
      error: 'NotFound',
      message: `Adaption run '${req.params.id}' not found.`,
    });
    return;
  }
  res.status(200).json({ data: run });
});

/**
 * POST /api/adaption/prepare
 * Prepares a representative customer feedback dataset as prompt-completion pairs.
 */
router.post('/prepare', (req: Request, res: Response) => {
  try {
    const { datasetType, maxRows, requireAnalyzed } = req.body || {};
    if (maxRows !== undefined && maxRows !== null && !(Number.isInteger(Number(maxRows)) && Number(maxRows) >= 1)) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'maxRows must be a positive integer.',
      });
      return;
    }
    const prepared = adaptionService.prepareDataset({
      datasetType,
      maxRows: maxRows ? Number(maxRows) : undefined,
      requireAnalyzed: Boolean(requireAnalyzed),
    });

    res.status(200).json({
      success: true,
      data: prepared,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to prepare dataset';
    res.status(400).json({
      error: 'PreparationError',
      message,
    });
  }
});

/**
 * POST /api/adaption/runs
 * Initiates an Adaption workflow run (or simulation).
 * Requires confirmed: true for credit-consuming live runs.
 */
router.post('/runs', async (req: Request, res: Response) => {
  try {
    const { datasetName, datasetType, maxRows, estimateOnly, simulateRun, confirmed } = req.body || {};
    const idempotencyKey =
      (req.headers['idempotency-key'] as string) ||
      (req.headers['x-idempotency-key'] as string) ||
      (req.body?.idempotencyKey as string);

    if (maxRows !== undefined && maxRows !== null && !(Number.isInteger(Number(maxRows)) && Number(maxRows) >= 1)) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'maxRows must be a positive integer.',
      });
      return;
    }

    const run = await adaptionService.runAdaption({
      datasetName,
      datasetType,
      maxRows: maxRows ? Number(maxRows) : undefined,
      estimateOnly: Boolean(estimateOnly),
      simulateRun: Boolean(simulateRun),
      confirmed: Boolean(confirmed),
      idempotencyKey: idempotencyKey || undefined,
    });

    let statusCode = 201;
    if (run.status === 'unconfigured' || run.status === 'blocked_confirmation_required') {
      statusCode = 200;
    }

    let message = `Adaption run '${run.name}' initiated with ${run.recordsCount} records.`;
    if (run.status === 'unconfigured') {
      message = 'Adaption run recorded as unconfigured (ADAPTION_API_KEY missing).';
    } else if (run.status === 'blocked_confirmation_required') {
      message = run.errorMessage || 'Explicit confirmation required before launching paid run.';
    }

    res.status(statusCode).json({
      success: run.status !== 'failed',
      message,
      data: run,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start Adaption run';
    if (err instanceof NoFeedbackError) {
      res.status(422).json({ error: 'NoFeedback', message });
      return;
    }
    console.error('[AdaptionRoute] Run failed:', err);
    res.status(500).json({
      error: 'ExecutionError',
      message,
    });
  }
});

/**
 * POST /api/adaption/runs/:id/sync
 * Syncs latest status and quality evaluation from Adaption API.
 */
router.post('/runs/:id/sync', async (req: Request, res: Response) => {
  try {
    const run = await adaptionService.syncRun(req.params.id);
    res.status(200).json({
      success: true,
      data: run,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sync run';
    res.status(404).json({
      error: 'SyncError',
      message,
    });
  }
});

/**
 * GET /api/adaption/runs/:id/export
 * Downloads the prepared/adapted dataset in JSONL or CSV format.
 */
router.get('/runs/:id/export', (req: Request, res: Response) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'jsonl';
    const { content, mimeType, filename } = adaptionService.exportDataset(req.params.id, format);

    res.setHeader('Content-Type', `${mimeType}; charset=utf-8`);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export dataset';
    res.status(404).json({
      error: 'ExportError',
      message,
    });
  }
});

/**
 * GET /api/adaption/exemplars
 * Retrieves high-quality evaluated few-shot exemplars to enhance InsightFlow's prompts.
 */
router.get('/exemplars', (_req: Request, res: Response) => {
  const exemplars = adaptionService.getFewShotExemplars();
  const metadata = adaptionService.getExemplarLibraryMetadata();
  res.status(200).json({
    data: exemplars,
    count: exemplars.length,
    metadata,
    description: 'High-quality evaluated exemplars from completed Adaption runs for model few-shot prompting.',
  });
});

/**
 * GET /api/adaption/exemplars/metadata
 * Retrieves active exemplar library status, version, and enabled flag.
 */
router.get('/exemplars/metadata', (_req: Request, res: Response) => {
  const metadata = adaptionService.getExemplarLibraryMetadata();
  res.status(200).json({ success: true, data: metadata });
});

/**
 * POST /api/adaption/exemplars/toggle
 * Enables or disables Adaption exemplars in downstream AI prompts.
 */
router.post('/exemplars/toggle', (req: Request, res: Response) => {
  const { enabled } = req.body || {};
  const metadata = adaptionService.toggleExemplars(Boolean(enabled));
  res.status(200).json({
    success: true,
    data: metadata,
    message: `Adaption few-shot exemplars ${metadata.isEnabled ? 'enabled' : 'disabled'} for analysis pipeline.`,
  });
});

/**
 * POST /api/adaption/evaluate
 * Runs repeatable, empirical comparison between baseline and Adaption-enhanced analysis.
 */
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { sampleSize, datasetType } = req.body || {};
    const comparison = await adaptionService.evaluateComparison({
      sampleSize: sampleSize ? Number(sampleSize) : undefined,
      datasetType,
    });
    res.status(200).json({
      success: true,
      data: comparison,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Evaluation run failed';
    res.status(400).json({
      error: 'EvaluationError',
      message,
    });
  }
});

/**
 * GET /api/adaption/evaluation
 * Retrieves the most recent evaluation comparison.
 */
router.get('/evaluation', (_req: Request, res: Response) => {
  const evaluation = adaptionService.getLatestEvaluation();
  res.status(200).json({
    data: evaluation,
    available: Boolean(evaluation),
  });
});

export default router;
