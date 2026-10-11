import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import feedbackRoutes from '../routes/feedback.js';
import analysisRoutes from '../routes/analysis.js';
import { FeedbackStore } from '../services/feedbackStore.js';
import { resetDatabase } from '../db/seed.js';
import { getDatabaseConfig } from '../db/config.js';
import { getAIStatus } from '../services/ai/index.js';

describe('Performance, Reliability and Security Hardening', () => {
  let server: Server;
  let baseUrl: string;
  const store = FeedbackStore.getInstance();

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/feedback', feedbackRoutes);
    app.use('/api/analysis', analysisRoutes);

    app.get('/api/health', (_req, res) => {
      const dbConfig = getDatabaseConfig();
      const aiStatus = getAIStatus();
      res.status(200).json({
        status: 'ok',
        database: {
          configured: dbConfig.isConfigured,
          missingVariables: dbConfig.missingVariables,
        },
        ai: {
          configured: aiStatus.configured,
          provider: aiStatus.provider,
          model: aiStatus.model,
        },
      });
    });

    app.get('/api/health/ai', (_req, res) => {
      const aiStatus = getAIStatus();
      res.status(200).json(aiStatus);
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
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

  describe('1. Streaming CSV Export & Formula Injection Prevention', () => {
    test('streams CSV with correct headers and escapes fields', async () => {
      await store.saveRecordsChunk([
        {
          id: 'test-exp-1',
          review: 'Great dashboard with "quotes" and, commas.',
          category: 'Product Feedback',
          source: 'User Survey',
          datasetType: 'genuine_import',
          contentHash: 'hash-exp-1',
          rowNumber: 1,
          batchId: 'batch-exp-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
        {
          id: 'test-exp-2',
          review: '=1+1 dangerous excel formula',
          category: 'Customer Service',
          source: 'Support Ticket',
          datasetType: 'genuine_import',
          contentHash: 'hash-exp-1',
          rowNumber: 1,
          batchId: 'batch-exp-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ]);

      const res = await fetch(`${baseUrl}/api/feedback/export`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/csv'));
      assert.ok(res.headers.get('content-disposition')?.includes('attachment; filename='));

      const csvContent = await res.text();
      const lines = csvContent.trim().split('\r\n');

      assert.ok(lines.length >= 3, 'Should contain header and at least two rows');
      assert.strictEqual(
        lines[0],
        'id,review,category,source,datasetType,importedAt,sentiment,topic,urgencyScore,confidence,status'
      );

      // Check formula injection neutralization
      const formulaLine = lines.find((l) => l.includes('dangerous excel formula'));
      assert.ok(formulaLine, 'Export should contain the formula test row');
      assert.ok(
        formulaLine.includes("'=1+1 dangerous excel formula"),
        'Leading formula character (=) must be neutralized with leading single quote'
      );

      // Check quotation escaping
      const quotesLine = lines.find((l) => l.includes('Great dashboard'));
      assert.ok(quotesLine, 'Export should contain the quotes test row');
      assert.ok(
        quotesLine.includes('""quotes""'),
        'Internal double quotes must be doubled for RFC 4180 CSV compliance'
      );
    });

    test('supports server-side category and sentiment filtering during export', async () => {
      await store.saveRecordsChunk([
        {
          id: 'test-filter-1',
          review: 'Product feature A is good.',
          category: 'Product Feedback',
          source: 'Survey',
          datasetType: 'genuine_import',
          contentHash: 'hash-exp-1',
          rowNumber: 1,
          batchId: 'batch-exp-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
        {
          id: 'test-filter-2',
          review: 'Support took too long.',
          category: 'Customer Service',
          source: 'Support',
          datasetType: 'genuine_import',
          contentHash: 'hash-exp-1',
          rowNumber: 1,
          batchId: 'batch-exp-1',
          isSample: false,
          importedAt: new Date().toISOString(),
        },
      ]);

      const res = await fetch(`${baseUrl}/api/feedback/export?category=Product+Feedback`);
      assert.strictEqual(res.status, 200);
      const csv = await res.text();

      assert.ok(csv.includes('Product feature A is good.'));
      assert.ok(!csv.includes('Support took too long.'));
    });
  });

  describe('2. Feedback Pagination & Validation', () => {
    test('enforces bounded pagination limits', async () => {
      const resInvalidPage = await fetch(`${baseUrl}/api/feedback?page=0`);
      assert.strictEqual(resInvalidPage.status, 400);

      const resInvalidPageSize = await fetch(`${baseUrl}/api/feedback?pageSize=500`);
      assert.strictEqual(resInvalidPageSize.status, 400);

      const resValid = await fetch(`${baseUrl}/api/feedback?page=1&pageSize=10`);
      assert.strictEqual(resValid.status, 200);
      const body: any = await resValid.json();
      assert.strictEqual(body.pagination.page, 1);
      assert.strictEqual(body.pagination.pageSize, 10);
      assert.ok(Array.isArray(body.data));
    });
  });

  describe('3. CSV Upload Restrictions & Security', () => {
    test('rejects missing upload with 400 BadRequest', async () => {
      const res = await fetch(`${baseUrl}/api/feedback/import`, {
        method: 'POST',
      });
      assert.strictEqual(res.status, 400);
      const body: any = await res.json();
      assert.strictEqual(body.error, 'BadRequest');
    });

    test('rejects non-csv files with 400 InvalidFileType', async () => {
      const formData = new FormData();
      const fakeBlob = new Blob(['malicious executable'], { type: 'application/octet-stream' });
      formData.append('file', fakeBlob, 'payload.exe');

      const res = await fetch(`${baseUrl}/api/feedback/import`, {
        method: 'POST',
        body: formData,
      });

      assert.strictEqual(res.status, 400);
      const body: any = await res.json();
      assert.strictEqual(body.error, 'InvalidFileType');
    });
  });

  describe('4. AI Concurrency & Batch Parameter Validation', () => {
    test('rejects excessive batchSize > 100', async () => {
      const res = await fetch(`${baseUrl}/api/analysis/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 500 }),
      });
      assert.strictEqual(res.status, 400);
      const body: any = await res.json();
      assert.strictEqual(body.error, 'ValidationError');
      assert.ok(body.message.includes('batchSize'));
    });

    test('rejects excessive concurrency > 10', async () => {
      const res = await fetch(`${baseUrl}/api/analysis/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concurrency: 25 }),
      });
      assert.strictEqual(res.status, 400);
      const body: any = await res.json();
      assert.strictEqual(body.error, 'ValidationError');
      assert.ok(body.message.includes('concurrency'));
    });

    test('rejects negative rateLimitDelayMs', async () => {
      const res = await fetch(`${baseUrl}/api/analysis/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rateLimitDelayMs: -50 }),
      });
      assert.strictEqual(res.status, 400);
      const body: any = await res.json();
      assert.strictEqual(body.error, 'ValidationError');
      assert.ok(body.message.includes('rateLimitDelayMs'));
    });
  });

  describe('5. Credential & Secret Protection', () => {
    test('health endpoint never leaks DB password or AI keys', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res.status, 200);
      const body: any = await res.json();

      const bodyStr = JSON.stringify(body);
      assert.ok(!bodyStr.includes('password'));
      assert.ok(!bodyStr.includes('postgres://'));
      assert.ok(!bodyStr.includes('apiKey'));
      assert.ok(!bodyStr.includes('GEMINI_API_KEY'));
      assert.ok(!bodyStr.includes('OPENAI_API_KEY'));
    });

    test('AI health endpoint returns safe operational metadata only', async () => {
      const res = await fetch(`${baseUrl}/api/health/ai`);
      assert.strictEqual(res.status, 200);
      const body: any = await res.json();

      assert.strictEqual(body.apiKey, undefined);
      assert.ok(!JSON.stringify(body).includes('apiKey'));
      assert.ok('configured' in body);
      assert.ok('provider' in body);
      assert.ok('timeoutMs' in body);
      assert.ok('maxRetries' in body);
    });
  });
});
