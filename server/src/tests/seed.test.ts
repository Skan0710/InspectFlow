import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { seedSampleDataset, seedFullCsvDataset, resetDatabase } from '../db/seed.js';
import { FeedbackStore } from '../services/feedbackStore.js';

describe('InsightFlow Demonstration Data & Seeding Workflow', () => {
  const store = FeedbackStore.getInstance();

  test('1. seedSampleDataset imports exact 20 curated sample rows on clean reset', async () => {
    // Reset store
    await resetDatabase('all');
    assert.strictEqual(store.getTotalRecordsCount(), 0);

    const summary = await seedSampleDataset({ reset: true });
    assert.strictEqual(summary.totalRows, 20);
    assert.strictEqual(summary.importedCount, 20);
    assert.strictEqual(summary.skippedCount, 0);
    assert.strictEqual(summary.failedCount, 0);
    assert.strictEqual(summary.isSample, true);
    assert.strictEqual(summary.datasetType, 'demo_sample');

    // Verify record properties in store
    const { data } = store.getRecords({ datasetType: 'demo_sample' });
    assert.strictEqual(data.length, 20);
    assert.ok(data.every((r) => r.isSample === true));
    assert.ok(data.every((r) => r.datasetType === 'demo_sample'));
    assert.ok(data.every((r) => r.source === 'InsightFlow Sample Demo Fixture'));
  });

  test('2. repeated sample seeding is idempotent and does not create duplicate rows', async () => {
    // Re-run seed on existing store
    const summary = await seedSampleDataset({ reset: false });
    assert.strictEqual(summary.totalRows, 20);
    assert.strictEqual(summary.importedCount, 0);
    assert.strictEqual(summary.skippedCount, 20);
    assert.strictEqual(summary.failedCount, 0);

    // Record count must remain exactly 20
    assert.strictEqual(store.getTotalRecordsCount(), 20);
  });

  test('3. never silently mixes sample data with genuine production data', async () => {
    // Filter by genuine_import when only sample data exists
    const genuineOnly = store.getRecords({ datasetType: 'genuine_import' });
    assert.strictEqual(genuineOnly.data.length, 0);
    assert.strictEqual(genuineOnly.pagination.total, 0);

    // Check status reports sample active
    const status = store.getDatasetStatus();
    assert.strictEqual(status.sampleCount, 20);
    assert.strictEqual(status.genuineCount, 0);
    assert.strictEqual(status.activeDatasetType, 'sample');
    assert.strictEqual(status.hasAnalysisRun, false);
    assert.strictEqual(status.analysisStatus, 'not_started');
  });

  test('4. seedFullCsvDataset imports the 7,000-row CSV with 320 unique valid records', async () => {
    // Clean and seed genuine CSV
    const summary = await seedFullCsvDataset({ reset: true });
    assert.strictEqual(summary.totalRows, 7000);
    assert.strictEqual(summary.importedCount, 320);
    assert.strictEqual(summary.skippedCount, 6680);
    assert.strictEqual(summary.failedCount, 0);
    assert.strictEqual(summary.isSample, false);
    assert.strictEqual(summary.datasetType, 'genuine_import');

    const status = store.getDatasetStatus();
    assert.strictEqual(status.totalRecords, 320);
    assert.strictEqual(status.genuineCount, 320);
    assert.strictEqual(status.sampleCount, 0);
    assert.strictEqual(status.activeDatasetType, 'genuine');
  });

  test('5. repeated full CSV seed is idempotent without unintentional duplicates', async () => {
    const summary = await seedFullCsvDataset({ reset: false });
    assert.strictEqual(summary.totalRows, 7000);
    assert.strictEqual(summary.importedCount, 0);
    assert.strictEqual(summary.skippedCount, 7000);
    assert.strictEqual(summary.failedCount, 0);

    assert.strictEqual(store.getTotalRecordsCount(), 320);
  });

  test('6. resetDatabase cleanly wipes dataset state', async () => {
    const res = await resetDatabase('all');
    assert.strictEqual(res.removedCount, 320);
    assert.strictEqual(store.getTotalRecordsCount(), 0);

    const status = store.getDatasetStatus();
    assert.strictEqual(status.totalRecords, 0);
    assert.strictEqual(status.activeDatasetType, 'empty');
  });
});
