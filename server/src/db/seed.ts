import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FeedbackStore } from '../services/feedbackStore.js';
import { processCsvImport } from '../services/csvImporter.js';
import { SAMPLE_FEEDBACK_FIXTURE } from '../fixtures/sampleFeedback.js';
import type { RawFeedbackRecord, ImportSummary } from '../types/import.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SeedOptions {
  reset?: boolean;
  sampleOnly?: boolean;
  csvPath?: string;
}

/**
 * Seeds a curated 20-row sample demonstration dataset.
 * Rapid local testing without loading all 7,000 rows.
 * Explicitly tagged with isSample: true and datasetType: 'demo_sample'.
 */
export async function seedSampleDataset(options: { reset?: boolean } = {}): Promise<ImportSummary> {
  const store = FeedbackStore.getInstance();

  if (options.reset) {
    await store.resetStore('sample_only');
  }

  const batchId = `SEED-SAMPLE-${Date.now()}`;
  const importedAt = new Date().toISOString();
  const summary: ImportSummary = {
    batchId,
    fileName: 'sample_feedback_fixture.json',
    fileSizeBytes: JSON.stringify(SAMPLE_FEEDBACK_FIXTURE).length,
    totalRows: SAMPLE_FEEDBACK_FIXTURE.length,
    importedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    categoryBreakdown: {},
    errors: [],
    importedAt,
    status: 'completed',
    isSample: true,
    datasetType: 'demo_sample',
  };

  const recordsToInsert: RawFeedbackRecord[] = [];

  for (let i = 0; i < SAMPLE_FEEDBACK_FIXTURE.length; i++) {
    const item = SAMPLE_FEEDBACK_FIXTURE[i];
    const contentHash = crypto
      .createHash('sha256')
      .update(`${item.review.toLowerCase()}:::${item.category.toLowerCase()}`)
      .digest('hex');

    // Idempotent: skip if already present
    if (store.hasContentHash(contentHash)) {
      summary.skippedCount++;
      continue;
    }

    const record: RawFeedbackRecord = {
      id: crypto.randomUUID(),
      review: item.review,
      category: item.category,
      contentHash,
      source: 'InsightFlow Sample Demo Fixture',
      rowNumber: i + 1,
      batchId,
      importedAt,
      isSample: true,
      datasetType: 'demo_sample',
    };

    recordsToInsert.push(record);
    summary.importedCount++;
    summary.categoryBreakdown[item.category] =
      (summary.categoryBreakdown[item.category] || 0) + 1;
  }

  if (recordsToInsert.length > 0) {
    await store.saveRecordsChunk(recordsToInsert);
  }

  await store.saveBatchRecord(summary);
  return summary;
}

/**
 * Seeds the full supplied customer feedback dataset from CSV into a clean/idempotent store.
 * Explicitly tagged with isSample: false and datasetType: 'genuine_import'.
 */
export async function seedFullCsvDataset(options: { reset?: boolean; csvPath?: string } = {}): Promise<ImportSummary> {
  const store = FeedbackStore.getInstance();

  if (options.reset) {
    await store.resetStore('all');
  }

  // Find dataset path
  const defaultPaths = [
    path.resolve(__dirname, '../../../BuildBattle_2026_Customer_Feedback_Dataset.csv'),
    path.resolve(process.cwd(), 'BuildBattle_2026_Customer_Feedback_Dataset.csv'),
    path.resolve(process.cwd(), '../BuildBattle_2026_Customer_Feedback_Dataset.csv'),
  ];

  let resolvedCsvPath = options.csvPath;
  if (!resolvedCsvPath) {
    for (const p of defaultPaths) {
      if (fs.existsSync(p)) {
        resolvedCsvPath = p;
        break;
      }
    }
  }

  if (!resolvedCsvPath || !fs.existsSync(resolvedCsvPath)) {
    throw new Error(
      'Cannot seed: BuildBattle_2026_Customer_Feedback_Dataset.csv was not found in project root.'
    );
  }

  const stat = fs.statSync(resolvedCsvPath);
  // Process through stream importer with isSample: false
  const summary = await processCsvImport({
    filePath: resolvedCsvPath,
    fileName: path.basename(resolvedCsvPath),
    fileSizeBytes: stat.size,
    skipDuplicates: true,
    isSample: false,
  });

  return summary;
}

/**
 * Resets all or a subset of stored feedback data.
 */
export async function resetDatabase(scope: 'all' | 'sample_only' | 'genuine_only' = 'all') {
  const store = FeedbackStore.getInstance();
  return store.resetStore(scope);
}

// CLI Execution Support
async function main() {
  const args = process.argv.slice(2);
  const isSample = args.includes('--sample');
  const isClean = args.includes('--clean') || args.includes('--reset');
  const isResetOnly = args.includes('--reset-only');

  if (isResetOnly) {
    console.log('🧹 Resetting all customer feedback data...');
    const res = await resetDatabase('all');
    console.log(`✅ Cleared ${res.removedCount} records.`);
    return;
  }

  if (isSample) {
    console.log(`🌱 Seeding demonstration sample dataset (20 rows)... [Clean: ${isClean}]`);
    const summary = await seedSampleDataset({ reset: isClean });
    console.log('✅ Sample Seed Complete:');
    console.log(`   - Total rows: ${summary.totalRows}`);
    console.log(`   - Imported: ${summary.importedCount}`);
    console.log(`   - Skipped (Duplicates): ${summary.skippedCount}`);
    console.log(`   - Failed: ${summary.failedCount}`);
    console.log(`   - Dataset Type: ${summary.datasetType} (isSample: ${summary.isSample})`);
    console.log('   - Category Breakdown:', summary.categoryBreakdown);
  } else {
    console.log(`🌱 Seeding genuine full CSV dataset... [Clean: ${isClean}]`);
    const summary = await seedFullCsvDataset({ reset: isClean });
    console.log('✅ Full CSV Seed Complete:');
    console.log(`   - Total rows: ${summary.totalRows}`);
    console.log(`   - Imported: ${summary.importedCount}`);
    console.log(`   - Skipped (Duplicates): ${summary.skippedCount}`);
    console.log(`   - Failed: ${summary.failedCount}`);
    console.log(`   - Dataset Type: ${summary.datasetType} (isSample: ${summary.isSample})`);
    console.log('   - Category Breakdown:', summary.categoryBreakdown);
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  main().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
}
