import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FeedbackStore } from '../services/feedbackStore.js';
import { processCsvImport } from '../services/csvImporter.js';
import { seedFullCsvDataset, resetDatabase } from '../db/seed.js';
import { BatchAnalysisPipeline } from '../services/analysis/batchPipeline.js';
import { FeedbackAnalyzer } from '../services/analysis/feedbackAnalyzer.js';
import { TestAIProvider } from '../services/ai/providers/testProvider.js';
import { AnalyticsService } from '../services/analytics/analyticsService.js';

describe('InsightFlow End-to-End Workflow: Ingestion → Analysis → Analytics → Explorer', () => {
  const store = FeedbackStore.getInstance();
  const analyticsService = new AnalyticsService();
  let testProvider: TestAIProvider;
  let analyzer: FeedbackAnalyzer;
  let pipeline: BatchAnalysisPipeline;
  let tempDir: string;

  beforeEach(async () => {
    testProvider = new TestAIProvider();
    analyzer = new FeedbackAnalyzer(testProvider, store);
    pipeline = new BatchAnalysisPipeline(analyzer, store);
    pipeline.reset();
    await resetDatabase('all');
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insightflow-test-'));
  });

  test('1. Invalid CSV: rejects missing required headers with actionable error message', async () => {
    const invalidHeaderCsv = path.join(tempDir, 'invalid-headers.csv');
    fs.writeFileSync(invalidHeaderCsv, 'customer_name,email,comment\nJohn,john@example.com,Good app\n');

    await assert.rejects(
      async () => {
        await processCsvImport({
          filePath: invalidHeaderCsv,
          fileName: 'invalid-headers.csv',
          fileSizeBytes: 100,
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes('Missing required column headers'));
        assert.ok(err.message.includes("'review'"));
        assert.ok(err.message.includes("'category'"));
        return true;
      }
    );
  });

  test('2. Invalid CSV: flags row-level errors for invalid categories & empty reviews while importing valid rows', async () => {
    const mixedCsv = path.join(tempDir, 'mixed-quality.csv');
    const content = [
      'review,category',
      'The new dashboard is super fast,Product Feedback',
      '  ,Product Feedback', // empty review
      'Support agent helped solve billing,Customer Service',
      'Everything crashed,InvalidCustomCategory', // invalid category
    ].join('\n');
    fs.writeFileSync(mixedCsv, content);

    const summary = await processCsvImport({
      filePath: mixedCsv,
      fileName: 'mixed-quality.csv',
      fileSizeBytes: content.length,
      skipDuplicates: true,
    });

    assert.strictEqual(summary.totalRows, 4);
    assert.strictEqual(summary.importedCount, 2);
    assert.strictEqual(summary.failedCount, 2);
    assert.strictEqual(summary.status, 'partial');
    assert.strictEqual(summary.errors.length, 2);
    assert.strictEqual(summary.errors[0].errorType, 'EMPTY_REVIEW');
    assert.strictEqual(summary.errors[1].errorType, 'INVALID_CATEGORY');

    // Verify store only has the 2 valid records
    assert.strictEqual(store.getTotalRecordsCount(), 2);
  });

  test('3. Complete E2E Flow: Upload small valid CSV → Import → Batch Analyze → Explorer Verification', async () => {
    const validCsv = path.join(tempDir, 'valid-feedback.csv');
    const content = [
      'review,category',
      'Search filters respond immediately and look clean,Product Feedback',
      'Customer support refunded unauthorized charge within 20 minutes,Customer Service',
      'Transactions take too long to sync across devices,Operational Issues',
    ].join('\n');
    fs.writeFileSync(validCsv, content);

    // Step A: Import CSV
    const summary = await processCsvImport({
      filePath: validCsv,
      fileName: 'valid-feedback.csv',
      fileSizeBytes: content.length,
      skipDuplicates: true,
    });

    assert.strictEqual(summary.importedCount, 3);
    assert.strictEqual(summary.skippedCount, 0);
    assert.strictEqual(summary.failedCount, 0);
    assert.strictEqual(summary.status, 'completed');

    // Step B: Verify initial state in Feedback Explorer before analysis
    const initialRecords = store.getRecords();
    assert.strictEqual(initialRecords.pagination.total, 3);
    assert.ok(initialRecords.data.every((r) => r.analysis === undefined));

    // Step C: Prepare AI provider responses for batch pipeline
    testProvider.enqueueResponse({
      sentiment: 'positive',
      primary_topic: 'Search Performance',
      severity: 1,
      confidence: 0.96,
      explanation: 'User praised responsiveness of search filters.',
      evidence_phrases: ['respond immediately', 'look clean'],
    });
    testProvider.enqueueResponse({
      sentiment: 'positive',
      primary_topic: 'Refund Support',
      severity: 1,
      confidence: 0.94,
      explanation: 'User appreciated fast refund turnaround.',
      evidence_phrases: ['refunded unauthorized charge within 20 minutes'],
    });
    testProvider.enqueueResponse({
      sentiment: 'negative',
      primary_topic: 'Device Sync Latency',
      severity: 3,
      confidence: 0.89,
      explanation: 'User experienced slow synchronization across devices.',
      evidence_phrases: ['take too long to sync'],
    });

    // Step D: Start Batch Analysis
    const unanalyzed = store.getUnanalyzedRecords();
    assert.strictEqual(unanalyzed.length, 3);

    const run = await pipeline.startRun(
      { batchSize: 2, concurrency: 1, rateLimitDelayMs: 0 },
      { autoStartWorker: false }
    );
    assert.strictEqual(run.itemsTotal, 3);
    assert.strictEqual(run.status, 'running');

    // Execute pipeline worker
    await pipeline.executeWorker(run, unanalyzed, 2, 1, 0, new AbortController().signal);

    // Step E: Verify run finished with real backend counts
    assert.strictEqual(run.status, 'completed');
    assert.strictEqual(run.itemsCompleted, 3);
    assert.strictEqual(run.itemsFailed, 0);
    assert.strictEqual(store.getUnanalyzedRecords().length, 0);

    // Step F: Verify Feedback Explorer reflects AI analysis
    const analyzedRecords = store.getRecords({ analysisStatus: 'analyzed' });
    assert.strictEqual(analyzedRecords.pagination.total, 3);
    const firstAnalyzed = analyzedRecords.data[0];
    assert.ok(firstAnalyzed.analysis !== undefined);
    assert.ok(['positive', 'negative'].includes(firstAnalyzed.analysis!.sentiment));
    assert.ok(firstAnalyzed.analysis!.keyPhrases.length > 0);
    assert.ok(firstAnalyzed.analysis!.confidenceScore >= 0.8);

    // Original category is preserved separately from AI issue topic
    assert.ok(['Product Feedback', 'Customer Service', 'Operational Issues'].includes(firstAnalyzed.category));
    assert.ok(['Search Performance', 'Refund Support', 'Device Sync Latency'].includes(firstAnalyzed.analysis!.primaryTopic));

    // Step G: Verify Dashboard Analytics metrics are updated
    const metrics = await analyticsService.getMetrics();
    assert.strictEqual(metrics.summary.totalFeedback, 3);
    assert.strictEqual(metrics.summary.analyzedFeedback, 3);
    assert.strictEqual(metrics.summary.pendingAnalysis, 0);
    assert.strictEqual(metrics.summary.analysisCoveragePercent, 100);
    assert.strictEqual(metrics.sentiment.counts.positive, 2);
    assert.strictEqual(metrics.sentiment.counts.negative, 1);
  });

  test('4. Preservation Invariant: Re-importing identical CSV skips duplicates and preserves existing analyses', async () => {
    const csvPath = path.join(tempDir, 'dedup-test.csv');
    const content = 'review,category\nGreat experience with support,Customer Service\n';
    fs.writeFileSync(csvPath, content);

    // Initial Import
    const summary1 = await processCsvImport({
      filePath: csvPath,
      fileName: 'dedup-test.csv',
      fileSizeBytes: content.length,
      skipDuplicates: true,
    });
    assert.strictEqual(summary1.importedCount, 1);

    // Analyze record
    testProvider.enqueueResponse({
      sentiment: 'positive',
      primary_topic: 'Support Experience',
      severity: 1,
      confidence: 0.95,
      explanation: 'Customer had a great support experience.',
      evidence_phrases: ['Great experience with support'],
    });
    const run = await pipeline.startRun({ batchSize: 1, concurrency: 1 }, { autoStartWorker: false });
    await pipeline.executeWorker(run, store.getUnanalyzedRecords(), 1, 1, 0, new AbortController().signal);
    assert.strictEqual(store.getUnanalyzedRecords().length, 0);

    const analysisBefore = store.getRecords().data[0].analysis;
    assert.ok(analysisBefore !== undefined);

    // Re-import identical CSV
    const summary2 = await processCsvImport({
      filePath: csvPath,
      fileName: 'dedup-test.csv',
      fileSizeBytes: content.length,
      skipDuplicates: true,
    });
    assert.strictEqual(summary2.importedCount, 0);
    assert.strictEqual(summary2.skippedCount, 1);

    // Verify existing record and analysis were preserved untouched
    const recordsAfter = store.getRecords();
    assert.strictEqual(recordsAfter.pagination.total, 1);
    assert.strictEqual(recordsAfter.data[0].analysis?.id, analysisBefore.id);
  });

  test('5. Concurrency Protection: Rejects duplicate start requests while a run is active', async () => {
    // Seed 2 unanalyzed records
    const records = [
      {
        id: 'r-1',
        review: 'Sample review 1',
        category: 'Product Feedback',
        contentHash: 'h-1',
        source: 'Test',
        rowNumber: 1,
        batchId: 'b-1',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import' as const,
      },
      {
        id: 'r-2',
        review: 'Sample review 2',
        category: 'Product Feedback',
        contentHash: 'h-2',
        source: 'Test',
        rowNumber: 2,
        batchId: 'b-1',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import' as const,
      },
    ];
    await store.saveRecordsChunk(records);

    // Start first run
    await pipeline.startRun({ batchSize: 1, concurrency: 1 }, { autoStartWorker: false });
    assert.strictEqual(pipeline.getActiveRun()?.status, 'running');

    // Attempt second simultaneous start
    await assert.rejects(
      async () => {
        await pipeline.startRun({ batchSize: 1, concurrency: 1 }, { autoStartWorker: false });
      },
      (err: Error) => {
        assert.strictEqual((err as unknown as { code: string }).code, 'RUN_ALREADY_IN_PROGRESS');
        return true;
      }
    );
  });

  test('6. Retry Failed Work: Unanalyzed and failed items are retried without duplicating completed items', async () => {
    const records = [
      {
        id: 'item-pass',
        review: 'Good app review',
        category: 'Product Feedback',
        contentHash: 'h-pass',
        source: 'Test',
        rowNumber: 1,
        batchId: 'b-test',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import' as const,
      },
      {
        id: 'item-fail',
        review: 'Failing review on first try',
        category: 'Product Feedback',
        contentHash: 'h-fail',
        source: 'Test',
        rowNumber: 2,
        batchId: 'b-test',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import' as const,
      },
    ];
    await store.saveRecordsChunk(records);

    // First run: item-pass succeeds, item-fail errors
    testProvider.enqueueResponse({
      sentiment: 'positive',
      primary_topic: 'App Quality',
      severity: 1,
      confidence: 0.9,
      explanation: 'Positive review',
      evidence_phrases: ['Good app'],
    });
    testProvider.enqueueError(new Error('Transient AI network failure'));

    const run1 = await pipeline.startRun({ batchSize: 1, concurrency: 1 }, { autoStartWorker: false });
    await pipeline.executeWorker(run1, records, 1, 1, 0, new AbortController().signal);

    assert.strictEqual(run1.itemsCompleted, 1);
    assert.strictEqual(run1.itemsFailed, 1);
    assert.strictEqual(run1.failedRecords.length, 1);
    assert.strictEqual(run1.failedRecords[0].feedbackId, 'item-fail');

    // Store now has 1 unanalyzed record remaining (item-fail was left unanalyzed)
    const remainingUnanalyzed = store.getUnanalyzedRecords();
    assert.strictEqual(remainingUnanalyzed.length, 1);
    assert.strictEqual(remainingUnanalyzed[0].id, 'item-fail');

    // Retry / resume: provide successful response for item-fail
    testProvider.enqueueResponse({
      sentiment: 'negative',
      primary_topic: 'Error Handling',
      severity: 3,
      confidence: 0.88,
      explanation: 'Customer noted recurring failure',
      evidence_phrases: ['Failing review'],
    });

    const run2 = await pipeline.startRun({ batchSize: 1, concurrency: 1 }, { autoStartWorker: false });
    assert.strictEqual(run2.itemsTotal, 1); // Only item-fail queued!
    await pipeline.executeWorker(run2, remainingUnanalyzed, 1, 1, 0, new AbortController().signal);

    assert.strictEqual(run2.status, 'completed');
    assert.strictEqual(run2.itemsCompleted, 1);
    assert.strictEqual(store.getUnanalyzedRecords().length, 0);

    // Both records now have valid analysis in store
    assert.strictEqual(store.getRecords({ analysisStatus: 'analyzed' }).pagination.total, 2);
  });

  test('7. Supplied 7,000-Row Dataset: Ingests 320 unique records, preserves unanalyzed state, runs bounded analysis', async () => {
    // Import the supplied 7,000-row CSV
    const summary = await seedFullCsvDataset({ reset: true });
    assert.strictEqual(summary.totalRows, 7000);
    assert.strictEqual(summary.importedCount, 320);
    assert.strictEqual(summary.skippedCount, 6680);
    assert.strictEqual(summary.failedCount, 0);
    assert.strictEqual(summary.isSample, false);

    // Verify dataset status
    const status = store.getDatasetStatus();
    assert.strictEqual(status.totalRecords, 320);
    assert.strictEqual(status.hasAnalysisRun, false);

    // Run a small bounded batch (limit: 3) to test partial dataset analysis without full 7000 calls
    testProvider.enqueueResponse({
      sentiment: 'negative',
      primary_topic: 'Payment Processing Delay',
      severity: 4,
      confidence: 0.92,
      explanation: 'Customer reports delayed payments.',
      evidence_phrases: ['delayed payment'],
    });
    testProvider.enqueueResponse({
      sentiment: 'positive',
      primary_topic: 'UI Design',
      severity: 1,
      confidence: 0.95,
      explanation: 'Clean interface.',
      evidence_phrases: ['Clean interface'],
    });
    testProvider.enqueueResponse({
      sentiment: 'neutral',
      primary_topic: 'Account Settings',
      severity: 2,
      confidence: 0.87,
      explanation: 'Informational question about settings.',
      evidence_phrases: ['settings'],
    });

    const unanalyzedSlice = store.getUnanalyzedRecords().slice(0, 3);
    const run = await pipeline.startRun({ limit: 3, batchSize: 3, concurrency: 1 }, { autoStartWorker: false });
    assert.strictEqual(run.itemsTotal, 3);
    await pipeline.executeWorker(run, unanalyzedSlice, 3, 1, 0, new AbortController().signal);

    assert.strictEqual(run.status, 'completed');
    assert.strictEqual(run.itemsCompleted, 3);

    // Check overview metrics on partially analyzed 320-record dataset
    const metrics = await analyticsService.getMetrics();
    assert.strictEqual(metrics.summary.totalFeedback, 320);
    assert.strictEqual(metrics.summary.analyzedFeedback, 3);
    assert.strictEqual(metrics.summary.pendingAnalysis, 317);
    assert.strictEqual(metrics.summary.hasAnalysisRun, true);
    assert.strictEqual(metrics.summary.analysisCoveragePercent, 0.94); // 3 / 320 * 100 = 0.9375 => 0.94%

    // Sentiment denominator is strictly the 3 analyzed records
    assert.strictEqual(metrics.sentiment.denominator, 3);
    assert.strictEqual(metrics.sentiment.counts.negative, 1);
    assert.strictEqual(metrics.sentiment.counts.positive, 1);
    assert.strictEqual(metrics.sentiment.counts.neutral, 1);
  });
});
