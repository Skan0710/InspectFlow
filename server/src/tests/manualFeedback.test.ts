import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import feedbackRoutes from '../routes/feedback.js';
import { FeedbackStore } from '../services/feedbackStore.js';
import { resetDatabase } from '../db/seed.js';

describe('InsightFlow Manual Feedback Submission', () => {
  let server: Server;
  let baseUrl: string;
  const store = FeedbackStore.getInstance();

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/feedback', feedbackRoutes);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api/feedback`;
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

  test('1. Valid submission with category: saves record, preserves text, returns submitted status', async () => {
    const reviewText = 'The automated invoice matching feature saved us hours of manual reconciliations.';
    const category = 'Product Feedback';

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review: reviewText, category }),
    });

    assert.strictEqual(res.status, 201);
    const body: any = await res.json();

    assert.strictEqual(body.success, true);
    assert.strictEqual(body.submissionStatus, 'submitted');
    assert.ok(['analyzed', 'failed', 'pending'].includes(body.analysisStatus));
    assert.ok(body.data);
    assert.ok(body.data.id);
    assert.strictEqual(body.data.review, reviewText, 'Original review text must be strictly preserved');
    assert.strictEqual(body.data.category, category);
    assert.strictEqual(body.data.source, 'Manual Submission');
    assert.strictEqual(body.data.datasetType, 'genuine_import');
    assert.strictEqual(body.data.isSample, false);

    // Verify record in store
    const stored = store.getRecordById(body.data.id);
    assert.ok(stored, 'Record must exist in FeedbackStore');
    assert.strictEqual(stored.review, reviewText);
    assert.strictEqual(stored.category, category);
  });

  test('2. Valid submission without category: defaults to General Feedback', async () => {
    const reviewText = 'Support staff was polite and explained the transaction verification process.';

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review: reviewText }),
    });

    assert.strictEqual(res.status, 201);
    const body: any = await res.json();

    assert.strictEqual(body.submissionStatus, 'submitted');
    assert.strictEqual(body.data.category, 'General Feedback');

    const stored = store.getRecordById(body.data.id);
    assert.ok(stored);
    assert.strictEqual(stored.category, 'General Feedback');
  });

  test('3. Text length validation: rejects empty, too short (<5 chars), and overly long (>2000 chars) review text', async () => {
    // Missing review
    const resMissing = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'Product Feedback' }),
    });
    assert.strictEqual(resMissing.status, 400);
    const bodyMissing: any = await resMissing.json();
    assert.strictEqual(bodyMissing.error, 'ValidationError');
    assert.ok(bodyMissing.message.includes('required'));

    // Too short (3 characters)
    const resShort = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review: 'Bad' }),
    });
    assert.strictEqual(resShort.status, 400);
    const bodyShort: any = await resShort.json();
    assert.strictEqual(bodyShort.error, 'ValidationError');
    assert.ok(bodyShort.message.includes('at least 5 characters'));

    // Overly long (>2000 characters)
    const longText = 'a'.repeat(2005);
    const resLong = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review: longText }),
    });
    assert.strictEqual(resLong.status, 400);
    const bodyLong: any = await resLong.json();
    assert.strictEqual(bodyLong.error, 'ValidationError');
    assert.ok(bodyLong.message.includes('2000 characters'));
  });

  test('4. Category validation: rejects invalid categories with actionable list of allowed values', async () => {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        review: 'Valid feedback text describing an issue.',
        category: 'NonExistentCategory123',
      }),
    });

    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.strictEqual(body.error, 'ValidationError');
    assert.ok(body.message.includes('Invalid category'));
    assert.ok(body.message.includes('Product Feedback'));
  });

  test('5. Duplicate submission prevention: rejects identical repeated submissions with 409 Conflict', async () => {
    const review = 'The session timeout warning triggered 10 seconds before logging out.';
    const category = 'Operational Issues';

    // First submission
    const res1 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review, category }),
    });
    assert.strictEqual(res1.status, 201);
    const initialCount = store.getTotalRecordsCount();

    // Duplicate submission attempt
    const res2 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review, category }),
    });
    assert.strictEqual(res2.status, 409);
    const body2: any = await res2.json();
    assert.strictEqual(body2.error, 'DuplicateFeedbackError');
    assert.ok(body2.message.includes('already exists'));

    // Verify count did not increment
    assert.strictEqual(store.getTotalRecordsCount(), initialCount);
  });

  test('6. Resilience during AI provider outage: preserves record with failed analysis status', async () => {
    // When environment AI provider is unconfigured or encounters an outage,
    // the submitted record must NEVER be dropped or lost.
    const review = 'Security alert received regarding anomalous API token usage.';

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review, category: 'Fraud and Scam' }),
    });

    assert.strictEqual(res.status, 201);
    const body: any = await res.json();

    assert.strictEqual(body.submissionStatus, 'submitted');
    assert.ok(body.data.id);

    // Record is persisted in store regardless of analysis outcome
    const stored = store.getRecordById(body.data.id);
    assert.ok(stored, 'Record must be safely stored');
    assert.strictEqual(stored.review, review);

    // If analysis failed or was pending, it is queued in unanalyzed records
    if (body.analysisStatus === 'failed' || body.analysisStatus === 'pending') {
      const unanalyzed = store.getUnanalyzedRecords();
      assert.ok(unanalyzed.some((r) => r.id === body.data.id));
    }
  });

  test('7. Feedback Explorer visibility: submitted feedback appears in paginated explorer queries', async () => {
    const review = 'Mobile banking dashboard takes more than 15 seconds to populate.';
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review, category: 'Operational Issues' }),
    });
    assert.strictEqual(res.status, 201);
    const submitted: any = await res.json();

    // Query explorer
    const explorerRes = await fetch(`${baseUrl}?search=banking+dashboard`);
    assert.strictEqual(explorerRes.status, 200);
    const explorerBody: any = await explorerRes.json();

    assert.ok(explorerBody.data.length >= 1);
    const found = explorerBody.data.find((item: any) => item.id === submitted.data.id);
    assert.ok(found, 'Submitted feedback must be retrievable from explorer API');
    assert.strictEqual(found.review, review);
  });

  test('8. Configured AI provider: automatically analyzes feedback and attaches structured analysis', async () => {
    const { resetAIProvider } = await import('../services/ai/index.js');
    process.env.AI_PROVIDER = 'test';
    resetAIProvider();

    try {
      const review = 'The new payment checkout flow is amazingly fast and completely intuitive.';
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review, category: 'Product Feedback' }),
      });

      assert.strictEqual(res.status, 201);
      const body: any = await res.json();

      assert.strictEqual(body.submissionStatus, 'submitted');
      assert.strictEqual(body.analysisStatus, 'analyzed');
      assert.ok(body.data.analysis);
      assert.strictEqual(body.data.analysis.sentiment, 'negative');
      assert.ok(body.data.analysis.primaryTopic);
      assert.ok(body.data.analysis.confidenceScore > 0);

      // Verify analysis is persisted in store
      const analysisInStore = store.getAnalysisByFeedbackId(body.data.id);
      assert.ok(analysisInStore);
      assert.strictEqual(analysisInStore.sentiment, 'negative');
    } finally {
      delete process.env.AI_PROVIDER;
      resetAIProvider();
    }
  });
});
