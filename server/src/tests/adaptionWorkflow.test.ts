import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import adaptionRoutes from '../routes/adaption.js';
import feedbackRoutes from '../routes/feedback.js';
import { FeedbackStore } from '../services/feedbackStore.js';
import { AdaptionService } from '../services/adaption/adaptionService.js';
import { AdaptionApiClient } from '../services/adaption/adaptionClient.js';
import { DatasetPreparer } from '../services/adaption/datasetPreparer.js';
import { resetDatabase } from '../db/seed.js';

describe('InsightFlow Adaption Labs Integration & Evaluation Workflow', () => {
  let server: Server;
  let baseUrl: string;
  const store = FeedbackStore.getInstance();

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/feedback', feedbackRoutes);
    app.use('/api/adaption', adaptionRoutes);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api/adaption`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(async () => {
    await resetDatabase('all');
  });

  describe('1. Dataset Preparation & Source Preservation', () => {
    test('prepares instruction prompt-completion pairs and preserves original source records', async () => {
      const originalRecord = {
        id: 'fb-adapt-101',
        review: 'The batch invoice processing is exceptionally smooth and saves our accounting team 4 hours weekly.',
        category: 'Product Feedback',
        source: 'User Survey',
        datasetType: 'genuine_import' as const,
        contentHash: 'hash-adapt-101',
        rowNumber: 1,
        batchId: 'batch-adapt-1',
        isSample: false,
        importedAt: new Date().toISOString(),
      };

      await store.saveRecordsChunk([originalRecord]);

      const preparer = new DatasetPreparer();
      const recordsBefore = store.getRecords().data;
      assert.strictEqual(recordsBefore.length, 1);

      const result = preparer.prepareFeedbackDataset(
        recordsBefore,
        () => null
      );

      // Verify dataset preparation
      assert.strictEqual(result.recordsCount, 1);
      assert.strictEqual(result.skippedCount, 0);
      assert.strictEqual(result.columnMapping.prompt, 'prompt');
      assert.strictEqual(result.columnMapping.completion, 'completion');

      const pair = result.pairs[0];
      assert.strictEqual(pair.originalId, 'fb-adapt-101');
      assert.ok(pair.prompt.includes('Classify the following customer feedback'));
      assert.ok(pair.prompt.includes(originalRecord.review));

      const parsedCompletion = JSON.parse(pair.completion);
      assert.strictEqual(parsedCompletion.category, 'Product Feedback');
      assert.strictEqual(parsedCompletion.sentiment, 'neutral');

      // Invariant: original record in store is preserved completely unchanged
      const recordsAfter = store.getRecords().data;
      assert.strictEqual(recordsAfter.length, 1);
      assert.strictEqual(recordsAfter[0].id, originalRecord.id);
      assert.strictEqual(recordsAfter[0].review, originalRecord.review);
    });

    test('validates input and skips records with empty or malformed reviews', async () => {
      const records = [
        {
          id: 'fb-short-1',
          review: 'hi', // too short (<5 chars)
          category: 'General Feedback',
          source: 'Web',
          datasetType: 'genuine_import' as const,
          contentHash: 'hash-short-1',
          rowNumber: 1,
          batchId: 'batch-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
        {
          id: 'fb-valid-1',
          review: 'Legitimate detailed customer review describing an operational bottleneck in onboarding.',
          category: 'Operational Issues',
          source: 'Zendesk',
          datasetType: 'genuine_import' as const,
          contentHash: 'hash-valid-1',
          rowNumber: 2,
          batchId: 'batch-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ];

      const preparer = new DatasetPreparer();
      const result = preparer.prepareFeedbackDataset(records, () => null);

      assert.strictEqual(result.recordsCount, 1, 'Only valid record should be included');
      assert.strictEqual(result.skippedCount, 1, 'Short review should be safely skipped');
      assert.strictEqual(result.pairs[0].originalId, 'fb-valid-1');
    });
  });

  describe('2. Adaption Workflow Execution & Quality Metrics', () => {
    test('executes adaptation in verified simulation mode and returns structured quality metrics', async () => {
      await store.saveRecordsChunk([
        {
          id: 'fb-eval-1',
          review: 'Critical authentication failure occurred during two-factor SMS verification flow.',
          category: 'Fraud and Scam',
          source: 'Support Escalation',
          datasetType: 'genuine_import',
          contentHash: 'hash-eval-1',
          rowNumber: 1,
          batchId: 'batch-eval',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ]);

      const res = await fetch(`${baseUrl}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName: 'Test-Customer-Feedback-Evaluation',
          simulateRun: true,
        }),
      });

      assert.strictEqual(res.status, 201);
      const body: any = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.data);

      const run = body.data;
      assert.strictEqual(run.status, 'succeeded');
      assert.strictEqual(run.isMock, true);
      assert.strictEqual(run.trainingType, 'instruction_dataset');
      assert.ok(run.id.startsWith('ds_'));

      // Check official Adaption quality schema
      assert.ok(run.quality);
      assert.strictEqual(run.quality.grade_before, 'C');
      assert.strictEqual(run.quality.grade_after, 'A');
      assert.ok(typeof run.quality.score_before === 'number');
      assert.ok(typeof run.quality.score_after === 'number');
      assert.ok(run.quality.score_after > run.quality.score_before);
      assert.ok(run.quality.improvement_percent > 0);

      // Verify persistence in store
      const persisted = store.getAdaptionRunById(run.id);
      assert.ok(persisted);
      assert.strictEqual(persisted.id, run.id);
    });

    test('syncs run status and updates evaluation results', async () => {
      const mockClient = new AdaptionApiClient({ isMock: true });
      const service = new AdaptionService(mockClient, store);

      await store.saveRecordsChunk([
        {
          id: 'fb-sync-1',
          review: 'Customer reporting swift payment processing experience.',
          category: 'Product Feedback',
          source: 'Survey',
          datasetType: 'genuine_import',
          contentHash: 'hash-sync-1',
          rowNumber: 1,
          batchId: 'batch-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ]);

      const run = await service.runAdaption({ simulateRun: true });
      const synced = await service.syncRun(run.id);

      assert.strictEqual(synced.id, run.id);
      assert.strictEqual(synced.status, 'succeeded');
      assert.strictEqual(synced.benchmarkIntegrated, true);
    });
  });

  describe('3. Missing Configuration & Graceful Non-Blocking Degradation', () => {
    test('when ADAPTION_API_KEY is missing, records run as unconfigured without throwing or crashing', async () => {
      // Client explicitly without apiKey and not in mock mode
      const unconfiguredClient = new AdaptionApiClient({ apiKey: '', isMock: false });
      const service = new AdaptionService(unconfiguredClient, store);

      await store.saveRecordsChunk([
        {
          id: 'fb-unconf-1',
          review: 'Legitimate customer review awaiting evaluation.',
          category: 'Customer Service',
          source: 'Email',
          datasetType: 'genuine_import',
          contentHash: 'hash-unconf-1',
          rowNumber: 1,
          batchId: 'batch-unconf',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ]);

      // Execution must complete without throwing an unhandled exception
      const run = await service.runAdaption({ simulateRun: false });

      assert.strictEqual(run.status, 'unconfigured');
      assert.strictEqual(run.isMock, false);
      assert.ok(run.errorMessage?.includes('ADAPTION_API_KEY'));

      // Main feedback analysis store remains completely intact
      const records = store.getRecords().data;
      assert.strictEqual(records.length, 1);
      assert.strictEqual(records[0].id, 'fb-unconf-1');
    });

    test('GET /api/adaption/status reports accurate configuration state without exposing secrets', async () => {
      const res = await fetch(`${baseUrl}/status`);
      assert.strictEqual(res.status, 200);
      const body: any = await res.json();

      assert.ok('configured' in body);
      assert.ok('baseUrl' in body);
      assert.ok('hasApiKey' in body);
      assert.ok('isMockMode' in body);
      assert.ok('message' in body);

      // Secret invariant: raw API key is never exposed
      const bodyString = JSON.stringify(body);
      assert.ok(!bodyString.includes('sk-'));
      assert.ok(!bodyString.includes('bearer'));
    });
  });

  describe('4. Upstream API Errors & Fault Tolerance', () => {
    test('records run as failed when upstream Adaption API returns an error', async () => {
      // Simulate client that fails on createDataset
      const failingClient = new AdaptionApiClient({ apiKey: 'fake-key', isMock: false });
      failingClient.createDataset = async () => {
        throw new Error('Adaption authentication failed: HTTP 401 Unauthorized.');
      };

      const service = new AdaptionService(failingClient, store);

      await store.saveRecordsChunk([
        {
          id: 'fb-fail-1',
          review: 'Great product features but customer support took 3 days.',
          category: 'Customer Service',
          source: 'Survey',
          datasetType: 'genuine_import',
          contentHash: 'hash-fail-1',
          rowNumber: 1,
          batchId: 'batch-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ]);

      const run = await service.runAdaption({ simulateRun: false, confirmed: true });

      assert.strictEqual(run.status, 'failed');
      assert.ok(run.errorMessage?.includes('401 Unauthorized'));

      // Verify persisted state reflects failure accurately
      const persisted = store.getAdaptionRunById(run.id);
      assert.ok(persisted);
      assert.strictEqual(persisted.status, 'failed');
    });

    test('sanitizes upstream error messages to prevent secret or token leakage', async () => {
      const secretKey = 'pt_live_super_secret_token_12345';
      const leakyClient = new AdaptionApiClient({ apiKey: secretKey, isMock: false });
      leakyClient.createDataset = async () => {
        throw new Error(`Upstream failed for bearer Bearer ${secretKey}`);
      };

      const service = new AdaptionService(leakyClient, store);

      await store.saveRecordsChunk([
        {
          id: 'fb-leak-1',
          review: 'Testing secret sanitization and redaction invariant in Adaption workflow.',
          category: 'Customer Service',
          source: 'Survey',
          datasetType: 'genuine_import',
          contentHash: 'hash-leak-1',
          rowNumber: 1,
          batchId: 'batch-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ]);

      const run = await service.runAdaption({ simulateRun: false, confirmed: true });

      assert.strictEqual(run.status, 'failed');
      assert.ok(!run.errorMessage?.includes(secretKey), 'API key must never appear in errorMessage');
      assert.ok(run.errorMessage?.includes('[REDACTED]'), 'Secret must be sanitized to [REDACTED]');
    });
  });

  describe('5. Export & Model Few-Shot Integration', () => {
    test('exports dataset to JSONL and CSV with formula injection neutralization', async () => {
      await store.saveRecordsChunk([
        {
          id: 'fb-formula-1',
          review: '=1+1 dangerous excel formula in feedback',
          category: 'Product Feedback',
          source: 'Survey',
          datasetType: 'genuine_import',
          contentHash: 'hash-form-1',
          rowNumber: 1,
          batchId: 'batch-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ]);

      const resRun = await fetch(`${baseUrl}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulateRun: true }),
      });
      const runBody: any = await resRun.json();
      const runId = runBody.data.id;

      // Test JSONL Export
      const resJsonl = await fetch(`${baseUrl}/runs/${runId}/export?format=jsonl`);
      assert.strictEqual(resJsonl.status, 200);
      assert.ok(resJsonl.headers.get('content-type')?.includes('application/x-ndjson'));
      const jsonlText = await resJsonl.text();
      assert.ok(jsonlText.includes('Classify the following customer feedback'));

      // Test CSV Export
      const resCsv = await fetch(`${baseUrl}/runs/${runId}/export?format=csv`);
      assert.strictEqual(resCsv.status, 200);
      assert.ok(resCsv.headers.get('content-type')?.includes('text/csv'));
      const csvText = await resCsv.text();
      assert.ok(csvText.includes('prompt,completion,category'));
      // Invariant: formula is neutralized
      assert.ok(csvText.includes("''=1+1") || csvText.includes("'=1+1") || csvText.includes('"=1+1'));
    });

    test('provides high-quality exemplars for InsightFlow few-shot prompt enhancement', async () => {
      await store.saveRecordsChunk([
        {
          id: 'fb-exemplar-1',
          review: 'Stripe webhook sync latency is causing duplicate transaction notices.',
          category: 'Operational Issues',
          source: 'Zendesk',
          datasetType: 'genuine_import',
          contentHash: 'hash-ex-1',
          rowNumber: 1,
          batchId: 'batch-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ]);

      await fetch(`${baseUrl}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulateRun: true }),
      });

      const resExemplars = await fetch(`${baseUrl}/exemplars`);
      assert.strictEqual(resExemplars.status, 200);
      const body: any = await resExemplars.json();

      assert.ok(body.count >= 1);
      assert.ok(Array.isArray(body.data));
      assert.strictEqual(body.data[0].category, 'Operational Issues');
      assert.ok(body.data[0].prompt.includes('Stripe webhook sync latency'));
    });
  });

  describe('6. Upfront Cost Estimation, Confirmation & Idempotency', () => {
    test('POST /api/adaption/estimate calculates credit consumption and dollars upfront', async () => {
      await store.saveRecordsChunk([
        {
          id: 'fb-est-1',
          review: 'Product checkout flow needs responsive redesign on iPad browsers.',
          category: 'Product Feedback',
          source: 'Survey',
          datasetType: 'genuine_import',
          contentHash: 'hash-est-1',
          rowNumber: 1,
          batchId: 'batch-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ]);

      const res = await fetch(`${baseUrl}/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxRows: 10, simulateRun: true }),
      });

      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.recordsCount, 1);
      assert.ok(json.data.estimatedCredits >= 1);
      assert.ok(typeof json.data.estimatedCostUsd === 'number');
      assert.ok(json.data.explanation.includes('Simulation Mode'));
    });

    test('requires explicit confirmation before starting live credit-consuming run', async () => {
      const liveClient = new AdaptionApiClient({ apiKey: 'pt_live_dummy_test', isMock: false });
      const service = new AdaptionService(liveClient, store);

      await store.saveRecordsChunk([
        {
          id: 'fb-confirm-1',
          review: 'Critical bug in ledger export during monthly reconciliation.',
          category: 'Operational Issues',
          source: 'Survey',
          datasetType: 'genuine_import',
          contentHash: 'hash-conf-1',
          rowNumber: 1,
          batchId: 'batch-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ]);

      // Trigger without confirmed: true
      const run = await service.runAdaption({ simulateRun: false, confirmed: false });
      assert.strictEqual(run.status, 'blocked_confirmation_required');
      assert.strictEqual(run.confirmed, false);
      assert.ok(run.estimate);
      assert.ok(run.errorMessage?.includes('Confirmation required'));
    });

    test('enforces idempotency and prevents duplicate concurrent runs', async () => {
      await store.saveRecordsChunk([
        {
          id: 'fb-idemp-1',
          review: 'Fast response times observed on cloud compute clusters.',
          category: 'Product Feedback',
          source: 'Survey',
          datasetType: 'genuine_import',
          contentHash: 'hash-idemp-1',
          rowNumber: 1,
          batchId: 'batch-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ]);

      const key = 'idem-unique-key-999';
      const res1 = await fetch(`${baseUrl}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({ simulateRun: true }),
      });
      const body1: any = await res1.json();
      assert.strictEqual(res1.status, 201);

      // Repeat identical request with same idempotency key
      const res2 = await fetch(`${baseUrl}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({ simulateRun: true }),
      });
      const body2: any = await res2.json();

      assert.strictEqual(body2.data.id, body1.data.id, 'Must return same run ID for repeated request');
    });
  });
});
