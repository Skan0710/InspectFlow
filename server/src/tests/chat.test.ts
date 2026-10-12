import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { FeedbackStore } from '../services/feedbackStore.js';
import { ChatService } from '../services/chat/chatService.js';
import { TestAIProvider } from '../services/ai/providers/testProvider.js';
import { UnconfiguredAIProvider } from '../services/ai/providers/unconfiguredProvider.js';
import { AIRateLimitError } from '../services/ai/errors.js';
import chatRoutes from '../routes/chat.js';
import type { RawFeedbackRecord } from '../types/import.js';
import type { FeedbackAnalysisRecord } from '../services/analysis/types.js';

const store = FeedbackStore.getInstance();

function makeRecord(review: string, idx: number): RawFeedbackRecord {
  return {
    id: crypto.randomUUID(),
    review,
    category: 'Product Feedback',
    contentHash: crypto.createHash('sha256').update(`${review}:${idx}`).digest('hex'),
    source: 'chat-fixture.csv',
    rowNumber: idx + 2,
    batchId: 'BATCH-CHAT',
    importedAt: '2026-01-15T10:00:00.000Z',
    isSample: false,
    datasetType: 'genuine_import',
  };
}

function makeAnalysis(feedbackId: string): FeedbackAnalysisRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    feedbackId,
    sentiment: 'negative',
    sentimentScore: -0.8,
    urgency: 'high',
    urgencyScore: 0.8,
    primaryTopic: 'Login Crash',
    topics: [],
    keyPhrases: [],
    summary: 'fixture',
    severity: 4,
    confidenceScore: 0.9,
    modelVersion: 'test-model:v1',
    promptVersion: 'v1',
    analyzedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

async function seedAnalyzed(): Promise<void> {
  const records = [0, 1, 2].map((i) => makeRecord(`The app crashes on login screen, attempt ${i}`, i));
  await store.saveRecordsChunk(records);
  for (const r of records) await store.saveAnalysis(makeAnalysis(r.id));
}

describe('Chat copilot', () => {
  beforeEach(async () => {
    await store.resetStore('all');
  });

  test('empty workspace answers honestly without calling the AI provider', async () => {
    const provider = new TestAIProvider();
    const reply = await new ChatService(provider).reply('What are the biggest pain points?');
    assert.strictEqual(reply.mode, 'empty');
    assert.match(reply.answer, /no customer feedback/i);
    assert.strictEqual(provider.getRecordedRequests().length, 0);
  });

  test('imported but unanalyzed data is reported as such, not guessed at', async () => {
    await store.saveRecordsChunk([makeRecord('Checkout is slow', 0)]);
    const provider = new TestAIProvider();
    const reply = await new ChatService(provider).reply('Summarise negative feedback');
    assert.strictEqual(reply.mode, 'data_summary');
    assert.match(reply.answer, /none have been analyzed/i);
    assert.strictEqual(provider.getRecordedRequests().length, 0);
  });

  test('configured provider receives bounded stored context and its answer is returned', async () => {
    await seedAnalyzed();
    const provider = new TestAIProvider().enqueueResponse('Login crashes dominate (3 mentions).');
    const reply = await new ChatService(provider).reply('What are the biggest pain points?', [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);

    assert.strictEqual(reply.mode, 'ai');
    assert.strictEqual(reply.answer, 'Login crashes dominate (3 mentions).');
    assert.strictEqual(reply.grounding.totalFeedback, 3);

    const [request] = provider.getRecordedRequests();
    assert.ok(request.prompt.includes('Login Crash'), 'prompt must carry real stored topics');
    assert.ok(request.prompt.includes('What are the biggest pain points?'));
    assert.ok(request.systemPrompt?.includes('ONLY from the CONTEXT'));
  });

  test('without a configured provider the reply is a labelled summary of real metrics', async () => {
    await seedAnalyzed();
    const reply = await new ChatService(new UnconfiguredAIProvider()).reply('Give me a negative feedback summary');
    assert.strictEqual(reply.mode, 'data_summary');
    assert.match(reply.answer, /Negative: 3 \(100%\)/);
    assert.match(reply.answer, /AI provider not configured/);
  });

  describe('POST /api/chat', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/chat', chatRoutes);
    const server = http.createServer(app);
    let base = '';

    const ready = new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        resolve();
      });
    });
    after(() => {
      server.close();
    });

    const post = async (body: unknown) => {
      await ready;
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: res.status, json: (await res.json()) as Record<string, any> };
    };

    test('rejects missing, blank and oversized messages', async () => {
      assert.strictEqual((await post({})).status, 400);
      assert.strictEqual((await post({ message: '   ' })).status, 400);
      assert.strictEqual((await post({ message: 'x'.repeat(1001) })).status, 400);
    });

    test('rejects malformed history', async () => {
      const res = await post({ message: 'hi', history: [{ role: 'system', content: 'x' }] });
      assert.strictEqual(res.status, 400);
    });

    test('returns a grounded reply for a valid question', async () => {
      const res = await post({ message: 'What are the biggest pain points?' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.success, true);
      assert.strictEqual(res.json.mode, 'empty');
    });
  });

  test('provider rate limiting surfaces as a typed error from the service', async () => {
    await seedAnalyzed();
    const provider = new TestAIProvider().enqueueError(new AIRateLimitError('test', 'slow down'));
    await assert.rejects(new ChatService(provider).reply('Anything'), AIRateLimitError);
  });
});
