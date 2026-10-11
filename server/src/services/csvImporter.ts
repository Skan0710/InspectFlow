import fs from 'node:fs';
import crypto from 'node:crypto';
import { parse } from 'csv-parse';
import {
  type RawFeedbackRecord,
  type ImportRowError,
  type ImportSummary,
  VALID_CATEGORIES,
} from '../types/import.js';
import { FeedbackStore } from './feedbackStore.js';

export interface CsvImportOptions {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  skipDuplicates?: boolean;
  isSample?: boolean;
  isTemporary?: boolean;
}

export async function processCsvImport(
  options: CsvImportOptions
): Promise<ImportSummary> {
  const store = FeedbackStore.getInstance();
  const batchId = `BATCH-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const importedAt = new Date().toISOString();
  const skipDuplicates = options.skipDuplicates !== false; // default true
  const isSample = Boolean(options.isSample);
  const datasetType = isSample ? 'demo_sample' : 'genuine_import';

  const summary: ImportSummary = {
    batchId,
    fileName: options.fileName,
    fileSizeBytes: options.fileSizeBytes,
    totalRows: 0,
    importedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    categoryBreakdown: {},
    errors: [],
    importedAt,
    status: 'completed',
    isSample,
    datasetType,
  };

  const currentBatchHashes = new Set<string>();
  const CHUNK_SIZE = 500;
  let currentChunk: RawFeedbackRecord[] = [];

  const stream = fs.createReadStream(options.filePath);
  const parser = stream.pipe(
    parse({
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true, // Handle potential UTF-8 BOM
    })
  );

  let headerIndices: { reviewIdx: number; categoryIdx: number } | null = null;
  let rowNumber = 0;

  try {
    for await (const record of parser) {
      rowNumber++;

      // First non-empty row: inspect headers dynamically
      if (!headerIndices) {
        if (!Array.isArray(record) || record.length < 2) {
          throw new Error(
            'Malformed CSV header. At least two columns are required.'
          );
        }

        const normalizedHeaders = record.map((h: string) =>
          h.toLowerCase().trim()
        );

        // Find review column (supports "review", "feedback", "text", "content")
        const reviewIdx = normalizedHeaders.findIndex((h) =>
          ['review', 'feedback', 'text', 'content', 'customer_review'].includes(h)
        );

        // Find category column (supports "category", "topic", "type")
        const categoryIdx = normalizedHeaders.findIndex((h) =>
          ['category', 'topic', 'type', 'feedback_category'].includes(h)
        );

        if (reviewIdx === -1 || categoryIdx === -1) {
          const missing: string[] = [];
          if (reviewIdx === -1) missing.push("'review'");
          if (categoryIdx === -1) missing.push("'category'");
          throw new Error(
            `Missing required column headers: ${missing.join(
              ', '
            )}. Found headers: [${record.join(', ')}].`
          );
        }

        headerIndices = { reviewIdx, categoryIdx };
        continue; // Header row processed, move to data rows
      }

      // Process Data Row
      summary.totalRows++;
      const rawReview = record[headerIndices.reviewIdx];
      const rawCategory = record[headerIndices.categoryIdx];

      // 1. Validate empty review
      if (rawReview === undefined || rawReview === null || String(rawReview).trim() === '') {
        summary.failedCount++;
        if (summary.errors.length < 50) {
          summary.errors.push({
            rowNumber,
            errorType: 'EMPTY_REVIEW',
            message: 'Review content is empty or whitespace.',
            rawPreview: String(record.slice(0, 3).join(', ')),
          });
        }
        continue;
      }

      const review = String(rawReview).trim();

      // 2. Validate category
      if (rawCategory === undefined || rawCategory === null || String(rawCategory).trim() === '') {
        summary.failedCount++;
        if (summary.errors.length < 50) {
          summary.errors.push({
            rowNumber,
            errorType: 'INVALID_CATEGORY',
            message: 'Category is missing.',
            rawPreview: `review: "${review.substring(0, 40)}..."`,
          });
        }
        continue;
      }

      const category = String(rawCategory).trim();
      if (!VALID_CATEGORIES.has(category)) {
        summary.failedCount++;
        if (summary.errors.length < 50) {
          summary.errors.push({
            rowNumber,
            errorType: 'INVALID_CATEGORY',
            message: `Invalid category "${category}". Must be one of: ${Array.from(
              VALID_CATEGORIES
            ).join(', ')}.`,
            rawPreview: `category: "${category}"`,
          });
        }
        continue;
      }

      // 3. Duplicate detection & idempotent re-import handling
      const contentHash = crypto
        .createHash('sha256')
        .update(`${review.toLowerCase()}:::${category.toLowerCase()}`)
        .digest('hex');

      const isAlreadyImported =
        store.hasContentHash(contentHash) || currentBatchHashes.has(contentHash);

      if (isAlreadyImported && skipDuplicates) {
        summary.skippedCount++;
        continue;
      }

      // 4. Valid record: preserve original review and supplied category
      currentBatchHashes.add(contentHash);

      const feedbackRecord: RawFeedbackRecord = {
        id: crypto.randomUUID(),
        review,
        category,
        contentHash,
        source: options.fileName,
        rowNumber,
        batchId,
        importedAt,
        isSample,
        datasetType,
      };

      currentChunk.push(feedbackRecord);
      summary.importedCount++;
      summary.categoryBreakdown[category] =
        (summary.categoryBreakdown[category] || 0) + 1;

      // Flush in streaming chunks to keep memory footprint bounded
      if (currentChunk.length >= CHUNK_SIZE) {
        await store.saveRecordsChunk(currentChunk);
        currentChunk = [];
      }
    }

    // Flush any remaining records in final chunk
    if (currentChunk.length > 0) {
      await store.saveRecordsChunk(currentChunk);
      currentChunk = [];
    }

    if (summary.failedCount > 0 && summary.importedCount === 0) {
      summary.status = 'failed';
    } else if (summary.failedCount > 0) {
      summary.status = 'partial';
    } else {
      summary.status = 'completed';
    }

    // Persist batch summary to store
    await store.saveBatchRecord(summary);

    return summary;
  } finally {
    // Only clean up temporary uploaded files (e.g. from Multer)
    if (options.isTemporary) {
      try {
        if (fs.existsSync(options.filePath)) {
          fs.unlinkSync(options.filePath);
        }
      } catch (cleanupErr) {
        console.warn('[CsvImporter] Temporary file cleanup warning:', cleanupErr);
      }
    }
  }
}
