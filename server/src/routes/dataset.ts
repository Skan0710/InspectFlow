import { Router, type Request, type Response } from 'express';
import { FeedbackStore } from '../services/feedbackStore.js';
import { seedSampleDataset, seedFullCsvDataset, resetDatabase } from '../db/seed.js';

const router = Router();
const store = FeedbackStore.getInstance();

/**
 * GET /api/dataset/status
 * Returns live dataset ingestion status, distinguishing genuine vs sample records,
 * and reporting that analysis has not yet run.
 */
router.get('/status', (_req: Request, res: Response) => {
  const status = store.getDatasetStatus();
  res.status(200).json(status);
});

/**
 * POST /api/dataset/seed-sample
 * Development endpoint to trigger quick 20-row sample demonstration dataset seeding.
 */
router.post('/seed-sample', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Forbidden', message: 'Seeding is disabled in production' });
    return;
  }

  try {
    const reset = req.body?.reset === true;
    const summary = await seedSampleDataset({ reset });
    res.status(200).json({
      success: true,
      message: 'Sample demonstration dataset seeded successfully',
      summary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to seed sample dataset';
    res.status(500).json({ error: 'SeedError', message: msg });
  }
});

/**
 * POST /api/dataset/reset
 * Development-only endpoint to reset demonstration or test feedback data.
 */
router.post('/reset', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Forbidden', message: 'Reset is disabled in production' });
    return;
  }

  const scope = req.body?.scope || 'all';
  if (!['all', 'sample_only', 'genuine_only'].includes(scope)) {
    res.status(400).json({
      error: 'ValidationError',
      message: `Invalid scope '${String(scope)}'. Must be one of: all, sample_only, genuine_only.`,
    });
    return;
  }

  try {
    const result = await resetDatabase(scope);
    res.status(200).json({
      success: true,
      message: `Reset complete. Removed ${result.removedCount} records.`,
      scope,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reset dataset';
    res.status(500).json({ error: 'ResetError', message: msg });
  }
});

export default router;
