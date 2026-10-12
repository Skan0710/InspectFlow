import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import type { RawFeedbackRecord } from '../types/import.js';
import type { FeedbackAnalysisRecord } from '../services/analysis/types.js';
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

const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'PayloadTooLarge',
            message: 'File exceeds maximum upload limit of 50MB.',
          });
        }
        return res.status(400).json({
          error: 'UploadError',
          message: err.message,
        });
      }
      if (err instanceof Error && err.message.includes('Invalid file type')) {
        return res.status(400).json({
          error: 'InvalidFileType',
          message: err.message,
        });
      }
      return next(err);
    }
    next();
  });
};

/**
 * POST /api/feedback/import
 * Streaming CSV feedback ingestion endpoint with validation and duplicate prevention.
 */
router.post(
  '/import',
  handleUpload,
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
 * GET /api/feedback/metrics
 * GET /api/feedback/stats
 * Dedicated metrics aggregation endpoint matching analytics specifications.
 */
async function handleFeedbackMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { validateAnalyticsFilters } = await import('./analytics.js');
    const { AnalyticsService } = await import('../services/analytics/analyticsService.js');
    const { filters, error } = validateAnalyticsFilters(req.query);
    if (error) {
      res.status(400).json({ error: 'ValidationError', message: error });
      return;
    }
    const analyticsService = new AnalyticsService();
    const metrics = await analyticsService.getMetrics(filters);
    res.status(200).json(metrics);
  } catch (err) {
    next(err);
  }
}

router.get('/metrics', handleFeedbackMetrics);
router.get('/stats', handleFeedbackMetrics);

export const ALLOWED_MANUAL_CATEGORIES = new Set([
  'Product Feedback',
  'Customer Service',
  'Fraud and Scam',
  'Operational Issues',
  'General Feedback',
]);

/**
 * POST /api/feedback
 * POST /api/feedback/submit
 * Manual feedback submission endpoint.
 * Validates review text and optional category, prevents accidental duplicates,
 * persists record using existing feedback store & model, and queues/executes AI analysis.
 */
async function handleManualFeedbackSubmission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { review: rawReview, category: rawCategory } = req.body || {};

    // 1. Validate review text
    if (rawReview === undefined || rawReview === null || typeof rawReview !== 'string') {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Review text is required and must be a string.',
      });
      return;
    }

    const review = rawReview.trim();
    if (review.length < 5) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Review text must be at least 5 characters long.',
      });
      return;
    }

    if (review.length > 2000) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Review text exceeds maximum allowed length of 2000 characters.',
      });
      return;
    }

    // 2. Validate optional category (defaults to 'General Feedback' if not provided)
    let category = 'General Feedback';
    if (rawCategory !== undefined && rawCategory !== null && String(rawCategory).trim() !== '') {
      const trimmedCategory = String(rawCategory).trim();
      if (!ALLOWED_MANUAL_CATEGORIES.has(trimmedCategory)) {
        res.status(400).json({
          error: 'ValidationError',
          message: `Invalid category "${trimmedCategory}". Must be one of: ${Array.from(
            ALLOWED_MANUAL_CATEGORIES
          ).join(', ')}.`,
        });
        return;
      }
      category = trimmedCategory;
    }

    // 3. Prevent accidental duplicate submissions
    const contentHash = crypto
      .createHash('sha256')
      .update(`${review.toLowerCase()}:::${category.toLowerCase()}`)
      .digest('hex');

    if (store.hasContentHash(contentHash)) {
      res.status(409).json({
        error: 'DuplicateFeedbackError',
        message: 'A feedback record with identical content already exists. Accidental duplicate submission prevented.',
        contentHash,
      });
      return;
    }

    // 4. Persistence using existing feedback model
    // Original review text is strictly preserved
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const record: RawFeedbackRecord = {
      id,
      review, // Exact verbatim text preserved
      category,
      contentHash,
      source: 'Manual Submission',
      rowNumber: store.getTotalRecordsCount() + 1,
      batchId: `MANUAL-${now.slice(0, 10)}`,
      importedAt: now,
      isSample: false,
      datasetType: 'genuine_import',
    };

    // Safely persist to feedback store and database
    await store.saveRecordsChunk([record]);

    // 5. Automatic queueing / execution for analysis pipeline
    // Separate submission and analysis statuses
    let analysisStatus: 'analyzed' | 'pending' | 'failed' = 'pending';
    let analysisRecord: FeedbackAnalysisRecord | null = null;
    let analysisError: string | null = null;

    try {
      const { FeedbackAnalyzer } = await import('../services/analysis/feedbackAnalyzer.js');
      const analyzer = new FeedbackAnalyzer();
      analysisRecord = await analyzer.analyzeAndStore({
        feedbackId: record.id,
        review: record.review,
        category: record.category,
        source: record.source,
      });
      analysisStatus = 'analyzed';
    } catch (analysisErr: unknown) {
      // Outage or unconfigured provider: submitted feedback remains safely preserved
      analysisStatus = 'failed';
      analysisError =
        analysisErr instanceof Error ? analysisErr.message : 'AI analysis failed';
      console.warn(
        `[FeedbackRoute] Analysis for manual record ${record.id} failed, record safely preserved:`,
        analysisError
      );
    }

    res.status(201).json({
      success: true,
      message:
        analysisStatus === 'analyzed'
          ? 'Feedback submitted and analyzed successfully.'
          : 'Feedback submitted successfully. Analysis status is recorded as failed/pending due to AI provider status.',
      submissionStatus: 'submitted',
      analysisStatus,
      analysisError,
      data: {
        ...record,
        analysis: analysisRecord,
      },
    });
  } catch (err) {
    next(err);
  }
}

router.post('/', handleManualFeedbackSubmission);
router.post('/submit', handleManualFeedbackSubmission);

/**
 * GET /api/feedback
 * Returns paginated feedback records with filtering by category, sentiment, topic, analysisStatus, or search term.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
  const page = req.query.page !== undefined ? Number(req.query.page) : 1;
  const pageSize = req.query.pageSize !== undefined ? Number(req.query.pageSize) : 25;

  if (isNaN(page) || !Number.isInteger(page) || page < 1) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Query parameter "page" must be a positive integer greater than or equal to 1.',
    });
    return;
  }

  if (isNaN(pageSize) || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Query parameter "pageSize" must be a positive integer between 1 and 100.',
    });
    return;
  }

  const { validateAnalyticsFilters } = await import('./analytics.js');
  const { filters, error } = validateAnalyticsFilters(req.query);
  if (error) {
    res.status(400).json({ error: 'ValidationError', message: error });
    return;
  }

  const result = await store.getPaginatedRecords({
    page,
    pageSize,
    category: filters.category,
    search: filters.search,
    datasetType: filters.datasetType,
    sentiment: filters.sentiment,
    topic: filters.topic,
    severity: filters.severity,
    analysisStatus: filters.analysisStatus,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  res.status(200).json({
    ...result,
    filtersApplied: filters,
  });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/feedback/export
 * Streaming CSV feedback export endpoint supporting server-side filtering.
 * Uses bounded chunks and res.write drain backpressure handling.
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { validateAnalyticsFilters } = await import('./analytics.js');
    const { filters, error } = validateAnalyticsFilters(req.query);
    if (error) {
      res.status(400).json({ error: 'ValidationError', message: error });
      return;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="insightflow-feedback-export-${Date.now()}.csv"`
    );

    // CSV escaping helper to safely quote fields and neutralize spreadsheet formula injection
    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    // Header row
    const headers = [
      'id',
      'review',
      'category',
      'source',
      'datasetType',
      'importedAt',
      'sentiment',
      'topic',
      'urgencyScore',
      'confidence',
      'status',
    ];
    res.write(headers.join(',') + '\r\n');

    // Bounded streaming: fetch records in chunks of 500 to keep memory flat
    const EXPORT_CHUNK_SIZE = 500;
    let page = 1;
    let hasMore = true;
    let clientClosed = false;
    res.on('close', () => {
      clientClosed = true;
    });

    while (hasMore && !clientClosed) {
      const pageResult = await store.getPaginatedRecords({
        page,
        pageSize: EXPORT_CHUNK_SIZE,
        category: filters.category,
        search: filters.search,
        datasetType: filters.datasetType,
        sentiment: filters.sentiment,
        topic: filters.topic,
        severity: filters.severity,
        analysisStatus: filters.analysisStatus,
        sortBy: (filters.sortBy as any) || 'importedAt',
        sortOrder: filters.sortOrder || 'desc',
      });

      if (!pageResult.data || pageResult.data.length === 0) {
        break;
      }

      for (const item of pageResult.data) {
        const row = [
          escapeCsv(item.id),
          escapeCsv(item.review),
          escapeCsv(item.category),
          escapeCsv(item.source),
          escapeCsv(item.datasetType || 'genuine'),
          escapeCsv(item.importedAt),
          escapeCsv(item.analysis?.sentiment || 'unanalyzed'),
          escapeCsv(item.analysis?.primaryTopic || ''),
          escapeCsv(item.analysis?.urgencyScore ?? ''),
          escapeCsv(item.analysis?.confidenceScore ?? ''),
          escapeCsv(item.analysis ? 'analyzed' : 'pending'),
        ].join(',');

        if (clientClosed) break;
        const canContinue = res.write(row + '\r\n');
        if (!canContinue && !clientClosed) {
          // Resolve on 'close' too so a disconnected client cannot leave this loop awaiting forever
          await new Promise<void>((resolve) => {
            res.once('drain', resolve);
            res.once('close', resolve);
          });
        }
      }

      if (page >= pageResult.pagination.totalPages || pageResult.data.length < EXPORT_CHUNK_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }

    res.end();
  } catch (err: unknown) {
    console.error('[FeedbackExport] Error during CSV export streaming:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'ExportError',
        message: 'Failed to stream feedback export',
      });
    } else {
      res.end();
    }
  }
});

/**
 * GET /api/feedback/:id
 * Retrieves a single feedback record with full analysis details.
 */
router.get('/:id', (req: Request, res: Response) => {
  const feedbackRecord = store.getRecordById(req.params.id);
  if (!feedbackRecord) {
    res.status(404).json({
      error: 'NotFound',
      message: `Feedback record with ID "${req.params.id}" not found.`,
    });
    return;
  }

  const analysis = store.getAnalysisByFeedbackId(feedbackRecord.id);
  res.status(200).json({
    data: {
      ...feedbackRecord,
      analysis,
    },
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
