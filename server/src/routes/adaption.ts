import { Router, type Request, type Response } from 'express';
import { AdaptionService } from '../services/adaption/adaptionService.js';

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
 */
router.post('/runs', async (req: Request, res: Response) => {
  try {
    const { datasetName, datasetType, maxRows, estimateOnly, simulateRun } = req.body || {};
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
    });

    const statusCode = run.status === 'unconfigured' ? 200 : 201;
    res.status(statusCode).json({
      success: true,
      message: run.status === 'unconfigured'
        ? 'Adaption run recorded as unconfigured (ADAPTION_API_KEY missing).'
        : `Adaption run '${run.name}' initiated with ${run.recordsCount} records.`,
      data: run,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start Adaption run';
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
  res.status(200).json({
    data: exemplars,
    count: exemplars.length,
    description: 'High-quality evaluated exemplars from completed Adaption runs for model few-shot prompting.',
  });
});

export default router;
