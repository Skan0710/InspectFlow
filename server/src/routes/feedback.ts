import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processCsvImport } from '../services/csvImporter.js';
import { FeedbackStore } from '../services/feedbackStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const store = FeedbackStore.getInstance();

// Configure Multer storage to stream file to disk before processing
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/temp');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB maximum file size
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV files (.csv) are supported.'));
    }
  },
});

/**
 * POST /api/feedback/import
 * Streaming CSV feedback ingestion endpoint with validation and duplicate prevention.
 */
router.post(
  '/import',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'No CSV file was uploaded. Please provide a file with field name "file".',
      });
      return;
    }

    try {
      const skipDuplicates = req.body.skipDuplicates !== 'false';
      const summary = await processCsvImport({
        filePath: req.file.path,
        fileName: req.file.originalname,
        fileSizeBytes: req.file.size,
        skipDuplicates,
        isTemporary: true,
      });

      res.status(200).json({
        success: true,
        message: `Import processed: ${summary.importedCount} imported, ${summary.skippedCount} skipped, ${summary.failedCount} failed.`,
        summary,
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to process CSV file';
      res.status(422).json({
        error: 'CsvProcessingError',
        message: errorMessage,
      });
    }
  }
);

/**
 * GET /api/feedback/import/batches
 * Returns list of all executed import batches with counts and status.
 */
router.get('/import/batches', (_req: Request, res: Response) => {
  const batches = store.getBatches();
  res.status(200).json({
    data: batches,
    total: batches.length,
  });
});

/**
 * GET /api/feedback/import/batches/:id
 * Returns detailed summary and sample errors for a single batch.
 */
router.get('/import/batches/:id', (req: Request, res: Response) => {
  const batch = store.getBatchById(req.params.id);
  if (!batch) {
    res.status(404).json({
      error: 'NotFound',
      message: `Import batch "${req.params.id}" not found.`,
    });
    return;
  }
  res.status(200).json({ data: batch });
});

/**
 * GET /api/feedback
 * Returns paginated feedback records with filtering by category or search term.
 */
router.get('/', (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 25;
  const category = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;

  const datasetType = req.query.datasetType as any;

  const result = store.getRecords({
    page,
    pageSize,
    category,
    search,
    datasetType,
  });

  // Attach analysis to records if present
  const dataWithAnalysis = result.data.map((r) => ({
    ...r,
    analysis: store.getAnalysisByFeedbackId(r.id),
  }));

  res.status(200).json({
    ...result,
    data: dataWithAnalysis,
  });
});

/**
 * POST /api/feedback/:id/analyze
 * Analyzes a specific customer review using the AI provider and saves the result in feedback_analysis.
 * The original feedback record is NEVER altered or mutated.
 */
router.post('/:id/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feedbackRecord = store.getRecordById(req.params.id);
    if (!feedbackRecord) {
      res.status(404).json({
        error: 'NotFound',
        message: `Feedback record with ID "${req.params.id}" not found.`,
      });
      return;
    }

    const { FeedbackAnalyzer } = await import('../services/analysis/feedbackAnalyzer.js');
    const analyzer = new FeedbackAnalyzer();

    const analysis = await analyzer.analyzeAndStore({
      feedbackId: feedbackRecord.id,
      review: feedbackRecord.review,
      category: feedbackRecord.category,
      source: feedbackRecord.source,
    });

    res.status(200).json({
      success: true,
      data: analysis,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/feedback/:id/analysis
 * Retrieves existing structured analysis for a given feedback item.
 */
router.get('/:id/analysis', (req: Request, res: Response) => {
  const feedbackRecord = store.getRecordById(req.params.id);
  if (!feedbackRecord) {
    res.status(404).json({
      error: 'NotFound',
      message: `Feedback record with ID "${req.params.id}" not found.`,
    });
    return;
  }

  const analysis = store.getAnalysisByFeedbackId(req.params.id);
  if (!analysis) {
    res.status(404).json({
      error: 'NotAnalyzed',
      message: `Analysis has not yet run for feedback record "${req.params.id}".`,
      feedbackId: req.params.id,
    });
    return;
  }

  res.status(200).json({ data: analysis });
});

export default router;
