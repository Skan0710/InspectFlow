import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BatchAnalysisPipeline } from '../services/analysis/batchPipeline.js';
import { FeedbackAnalyzer } from '../services/analysis/feedbackAnalyzer.js';
import { TestAIProvider } from '../services/ai/providers/testProvider.js';
import { FeedbackStore } from '../services/feedbackStore.js';
import type { RawFeedbackRecord } from '../types/import.js';

describe('InsightFlow Batch Analysis Pipeline', () => {
  const store = FeedbackStore.getInstance();
  let testProvider: TestAIProvider;
  let analyzer: FeedbackAnalyzer;
  let pipeline: BatchAnalysisPipeline;

  const createDummyRecord = (id: string, review: string, category = 'Product Feedback'): RawFeedbackRecord => ({
    id,
    review,
    category,
    contentHash: `hash-${id}`,
    source: 'Test Harness',
    rowNumber: 1,
    batchId: 'batch-test',
    importedAt: new Date().toISOString(),
    isSample: true,
    datasetType: 'demo_sample',
  });

  beforeEach(async () => {
    testProvider = new TestAIProvider();
    analyzer = new FeedbackAnalyzer(testProvider, store);
    pipeline = new BatchAnalysisPipeline(analyzer, store);
    pipeline.reset();
    await store.resetStore('all');
  });

  test('1. Small End-to-End Batch: processes unanalyzed records, tracks counts, and persists analyses', async () => {
    // Seed 4 records into store
    const records = [
      createDummyRecord('rec-1', 'App is fast and responsive'),
      createDummyRecord('rec-2', 'Slow checkout page on mobile'),
      createDummyRecord('rec-3', 'Great customer service representative'),
      createDummyRecord('rec-4', 'Confusing navigation tabs'),
    ];
    await store.saveRecordsChunk(records);

    testProvider.enqueueResponse({
      sentiment: 'positive',
      primary_topic: 'Speed & Responsiveness',
      severity: 1,
      confidence: 0.95,
      explanation: 'Customer notes the app is fast.',
      evidence_phrases: ['fast and responsive'],
    });
    testProvider.enqueueResponse({
      sentiment: 'negative',
      primary_topic: 'Slow Checkout',
      severity: 3,
      confidence: 0.90,
      explanation: 'Customer notes checkout is slow.',
      evidence_phrases: ['Slow checkout page'],
    });
    testProvider.enqueueResponse({
      sentiment: 'positive',
      primary_topic: 'Customer Service',
      severity: 1,
      confidence: 0.92,
      explanation: 'Representative was great.',
      evidence_phrases: ['Great customer service'],
    });
    testProvider.enqueueResponse({
      sentiment: 'negative',
      primary_topic: 'Navigation Confusion',
      severity: 2,
      confidence: 0.85,
      explanation: 'Navigation tabs are confusing.',
      evidence_phrases: ['Confusing navigation tabs'],
    });

    const run = await pipeline.startRun(
      { batchSize: 2, concurrency: 2, rateLimitDelayMs: 0 },
      { autoStartWorker: false }
    );

    assert.strictEqual(run.itemsTotal, 4);
    assert.strictEqual(run.status, 'running');

    // Wait for background worker execution
    const abortSignal = new AbortController().signal;
    await pipeline.executeWorker(run, records, 2, 2, 0, abortSignal);

    // Verify run completed
    assert.strictEqual(run.status, 'completed');
    assert.strictEqual(run.itemsCompleted, 4);
    assert.strictEqual(run.itemsFailed, 0);

    // Verify all 4 records have stored analyses linked to this run
    for (const r of records) {
      const saved = store.getAnalysisByFeedbackId(r.id);
      assert.ok(saved !== null, `Analysis for ${r.id} should be saved`);
      assert.strictEqual(saved.feedbackId, r.id);
      assert.strictEqual(saved.analysisRunId, run.id);
    }
  });

  test('2. Concurrency Lock: rejects simultaneous requests from starting uncontrolled duplicate jobs', async () => {
    const records = [createDummyRecord('rec-lock-1', 'Test concurrent lock')];
    await store.saveRecordsChunk(records);

    // Simulate active running job
    const run1 = await pipeline.startRun({ batchSize: 1, concurrency: 1 }, { autoStartWorker: false });
    assert.strictEqual(pipeline.getActiveRun()?.id, run1.id);

    // Attempting to start another run while one is running must reject
    await assert.rejects(
      async () => {
        await pipeline.startRun({ batchSize: 1, concurrency: 1 });
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.strictEqual((err as unknown as { code: string }).code, 'RUN_ALREADY_IN_PROGRESS');
        return true;
      }
    );
  });

  test('3. Partial Failures: records failure details while continuing successful items', async () => {
    const records = [
      createDummyRecord('rec-fail-1', 'Valid feedback 1'),
      createDummyRecord('rec-fail-2', 'Faulty feedback 2'),
      createDummyRecord('rec-fail-3', 'Valid feedback 3'),
    ];
    await store.saveRecordsChunk(records);

    // Configure test provider: item 1 succeeds, item 2 fails with upstream error, item 3 succeeds
    testProvider.enqueueResponse({
      sentiment: 'positive',
      primary_topic: 'Feature A',
      severity: 1,
      confidence: 0.9,
      explanation: 'Good feature',
      evidence_phrases: ['Valid feedback 1'],
    });
    testProvider.enqueueError(new Error('Simulated upstream model timeout on item 2'));
    testProvider.enqueueResponse({
      sentiment: 'positive',
      primary_topic: 'Feature B',
      severity: 1,
      confidence: 0.9,
      explanation: 'Good feature',
      evidence_phrases: ['Valid feedback 3'],
    });

    const run = await pipeline.startRun(
      { batchSize: 3, concurrency: 1, rateLimitDelayMs: 0 },
      { autoStartWorker: false }
    );

    const abortSignal = new AbortController().signal;
    await pipeline.executeWorker(run, records, 3, 1, 0, abortSignal);

    // Verify partial failure breakdown
    assert.strictEqual(run.itemsCompleted, 2);
    assert.strictEqual(run.itemsFailed, 1);
    assert.strictEqual(run.status, 'completed'); // Completed with partial errors
    assert.strictEqual(run.failedRecords.length, 1);
    assert.strictEqual(run.failedRecords[0].feedbackId, 'rec-fail-2');
    assert.ok(run.failedRecords[0].error.includes('Simulated upstream model timeout'));

    // Check database state: items 1 and 3 saved, item 2 not saved
    assert.ok(store.getAnalysisByFeedbackId('rec-fail-1') !== null);
    assert.strictEqual(store.getAnalysisByFeedbackId('rec-fail-2'), null);
    assert.ok(store.getAnalysisByFeedbackId('rec-fail-3') !== null);
  });

  test('4. Interrupted Runs & Resuming: resumes remaining items without duplicating successful analyses', async () => {
    const records = [
      createDummyRecord('rec-res-1', 'Review 1'),
      createDummyRecord('rec-res-2', 'Review 2'),
      createDummyRecord('rec-res-3', 'Review 3'),
      createDummyRecord('rec-res-4', 'Review 4'),
    ];
    await store.saveRecordsChunk(records);

    // Run 1: process only the first 2 items (e.g. limit: 2)
    const run1 = await pipeline.startRun(
      { limit: 2, batchSize: 2, concurrency: 1 },
      { autoStartWorker: false }
    );
    const abortSignal = new AbortController().signal;
    await pipeline.executeWorker(run1, records.slice(0, 2), 2, 1, 0, abortSignal);

    assert.strictEqual(run1.itemsCompleted, 2);
    assert.strictEqual(store.getAllAnalyses().length, 2);

    // Check remaining unanalyzed records
    const remainingUnanalyzed = store.getUnanalyzedRecords();
    assert.strictEqual(remainingUnanalyzed.length, 2);
    assert.deepStrictEqual(
      remainingUnanalyzed.map((r) => r.id),
      ['rec-res-3', 'rec-res-4']
    );

    // Run 2: Resume remaining unanalyzed items
    const run2 = await pipeline.startRun(
      { batchSize: 2, concurrency: 1 },
      { autoStartWorker: false }
    );
    assert.strictEqual(run2.itemsTotal, 2, 'Resumed run should only queue the 2 remaining unanalyzed items');

    await pipeline.executeWorker(run2, remainingUnanalyzed, 2, 1, 0, abortSignal);
    assert.strictEqual(run2.itemsCompleted, 2);

    // Total analyses in store must be exactly 4 (no duplicates)
    assert.strictEqual(store.getAllAnalyses().length, 4);
    assert.strictEqual(store.getUnanalyzedRecords().length, 0);
  });

  test('5. Cancellation: cleanly stops active run on signal abort', async () => {
    const records = [
      createDummyRecord('rec-cancel-1', 'Review A'),
      createDummyRecord('rec-cancel-2', 'Review B'),
    ];
    await store.saveRecordsChunk(records);

    const run = await pipeline.startRun(
      { batchSize: 1, concurrency: 1 },
      { autoStartWorker: false }
    );
    const controller = new AbortController();

    // Abort signal immediately before processing item 2
    controller.abort();
    await pipeline.executeWorker(run, records, 1, 1, 0, controller.signal);

    assert.strictEqual(run.status, 'cancelled');
  });
});
