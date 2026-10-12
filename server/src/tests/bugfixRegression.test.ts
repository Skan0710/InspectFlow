import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FeedbackStore } from '../services/feedbackStore.js';
import { IssueClusteringService } from '../services/clustering/clusteringService.js';
import { ReportService } from '../services/reports/reportService.js';
import { generateReportPdf } from '../services/reports/pdfGenerator.js';
import { AnalyticsService } from '../services/analytics/analyticsService.js';
import { validateAnalyticsFilters } from '../routes/analytics.js';
import { processCsvImport } from '../services/csvImporter.js';
import { validateFeedbackAnalysisOutput } from '../services/analysis/validator.js';
import { sanitizeErrorMessage } from '../services/ai/errors.js';
import { createAIProvider, AnthropicProvider } from '../services/ai/index.js';
import type { RawFeedbackRecord } from '../types/import.js';
import type { FeedbackAnalysisRecord } from '../services/analysis/types.js';

const store = FeedbackStore.getInstance();
const clustering = new IssueClusteringService();

const CRASH = 'The mobile app crashes every time I open the login screen';
const REFUND = 'Refund took weeks and support never answered my emails';

function makeRecord(review: string, category: string, idx: number, extra: Partial<RawFeedbackRecord> = {}): RawFeedbackRecord {
  return {
    id: crypto.randomUUID(),
    review,
    category,
    contentHash: crypto.createHash('sha256').update(`${review}:::${category}:::${idx}`).digest('hex'),
    source: 'regression-fixture.csv',
    rowNumber: idx + 2,
    batchId: 'BATCH-REGRESSION',
    importedAt: '2026-01-15T10:00:00.000Z',
    isSample: false,
    datasetType: 'genuine_import',
    ...extra,
  };
}

function makeAnalysis(feedbackId: string, severity: number, sentiment: 'negative' | 'positive' = 'negative'): FeedbackAnalysisRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    feedbackId,
    sentiment,
    sentimentScore: sentiment === 'negative' ? -0.8 : 0.8,
    urgency: severity >= 4 ? 'high' : 'normal',
    urgencyScore: severity * 0.2,
    primaryTopic: 'Login Crash',
    topics: [],
    keyPhrases: [],
    summary: 'fixture',
    severity,
    confidenceScore: 0.9,
    modelVersion: 'test-model:v1',
    promptVersion: 'v1',
    analyzedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

async function seedFixtureAndCluster(): Promise<RawFeedbackRecord[]> {
  const records = [
    ...[0, 1, 2].map((i) => makeRecord(CRASH, 'Product Feedback', i)),
    ...[3, 4].map((i) => makeRecord(REFUND, 'Customer Service', i)),
    makeRecord('Absolutely love the new colour palette', 'Product Feedback', 5),
  ];
  await store.saveRecordsChunk(records);
  for (const r of records.slice(0, 3)) {
    await store.saveAnalysis(makeAnalysis(r.id, 5));
  }
  for (const r of records.slice(3, 5)) {
    await store.saveAnalysis(makeAnalysis(r.id, 3));
  }
  await runClusteringLikeRoute();
  return records;
}

async function runClusteringLikeRoute() {
  const records = store.getRecords({ page: 1, pageSize: 100000 }).data;
  const analysesMap = new Map<string, any>();
  for (const a of store.getAllAnalyses()) analysesMap.set(a.feedbackId, a);
  const result = await clustering.clusterFeedback(records, analysesMap, {});
  const links = result.clusters.flatMap((c) => clustering.generateIssueFeedbackLinks(c));
  await store.saveClustersAndLinks(result, links);
  return result;
}

describe('Regression: bugs found during codebase audit', () => {
  const tempFiles: string[] = [];

  beforeEach(async () => {
    await store.resetStore('all');
  });

  after(() => {
    for (const f of tempFiles) {
      try {
        fs.unlinkSync(f);
      } catch {
        /* already removed */
      }
    }
  });

  describe('Re-clustering', () => {
    test('replaces the previous run instead of accumulating duplicate issues', async () => {
      await seedFixtureAndCluster();
      const firstCount = store.getAllIssues().length;
      assert.ok(firstCount >= 2, 'fixture should yield at least two clusters');

      await runClusteringLikeRoute();
      await runClusteringLikeRoute();

      const issues = store.getAllIssues();
      assert.strictEqual(issues.length, firstCount, 'issue count must be stable across re-runs');
      const codes = issues.map((i) => i.issueCode);
      assert.strictEqual(new Set(codes).size, codes.length, 'issue codes must stay unique');

      for (const issue of issues) {
        assert.strictEqual(
          store.getIssueFeedbackLinks(issue.id).length,
          issue.memberFeedbackIds.length,
          'links must not be duplicated per run'
        );
      }
    });

    test('preserves status, assignee and notes for clusters whose members did not change', async () => {
      await seedFixtureAndCluster();
      const target = store.getAllIssues().find((i) => i.feedbackCount === 3)!;
      assert.ok(target);

      await store.updateIssueStatus(target.id, 'in_progress', { changedBy: 'QA' });
      await store.updateIssueAssignee(target.id, 'Dana');
      await store.addIssueNote(target.id, { content: 'Investigating login crash', author: 'QA' });

      await runClusteringLikeRoute();

      const after = store.getIssueById(target.id);
      assert.ok(after, 'issue identity should be reused');
      assert.strictEqual(after.status, 'in_progress');
      assert.strictEqual(after.assignee, 'Dana');
      assert.strictEqual(after.notes?.[0]?.content, 'Investigating login crash');
      assert.strictEqual(store.getFeedbackForIssue(target.id).length, 3);
    });
  });

  describe('Partial dataset resets', () => {
    test('sample_only reset removes analyses and issues that depended on removed records', async () => {
      const sample = [0, 1, 2].map((i) => makeRecord(CRASH, 'Product Feedback', i, { isSample: true, datasetType: 'demo_sample' }));
      const genuine = [3, 4].map((i) => makeRecord(REFUND, 'Customer Service', i));
      await store.saveRecordsChunk([...sample, ...genuine]);
      for (const r of [...sample, ...genuine]) await store.saveAnalysis(makeAnalysis(r.id, 4));
      await runClusteringLikeRoute();
      assert.ok(store.getAllIssues().length > 0);

      await store.resetStore('sample_only');

      const remainingIds = new Set(store.getRecords({ page: 1, pageSize: 1000 }).data.map((r) => r.id));
      assert.strictEqual(remainingIds.size, genuine.length);
      for (const a of store.getAllAnalyses()) {
        assert.ok(remainingIds.has(a.feedbackId), 'no analysis may reference a deleted record');
      }
      for (const issue of store.getAllIssues()) {
        for (const fid of issue.memberFeedbackIds) {
          assert.ok(remainingIds.has(fid), 'no issue may reference a deleted record');
        }
      }
      assert.strictEqual(store.getDatasetStatus().analysisStatus, 'completed');
    });
  });

  describe('Reports', () => {
    test('report issue rows carry real score components and sane duplicate rate', async () => {
      await seedFixtureAndCluster();
      const report = await new ReportService().generateReport({ reportType: 'executive_summary' });
      const p = report.contentPayload;

      assert.ok(p.topPriorityIssues.length > 0);
      for (const issue of p.topPriorityIssues) {
        const { frequencyPoints, severityPoints, negativeSentimentPoints } = issue.scoreBreakdown;
        const total = frequencyPoints + severityPoints + negativeSentimentPoints;
        assert.ok(total > 0, 'score components must not collapse to zero');
        assert.ok(Math.abs(total - issue.priorityScore) <= 1.5, `components (${total}) should sum to score (${issue.priorityScore})`);
        for (const ex of issue.representativeExcerpts) {
          assert.ok(
            ['positive', 'neutral', 'negative', 'mixed', 'unanalyzed'].includes(ex.sentiment),
            `excerpt sentiment must be a sentiment label, got "${ex.sentiment}"`
          );
        }
      }

      // 6 records / 3 unique texts -> 50% duplicates (stored as a percentage, not x100)
      assert.strictEqual(p.datasetScope.duplicateRatePercent, 50);
      assert.ok(p.datasetScope.duplicateRatePercent <= 100);
    });

    test('PDF export does not spill the footer onto extra blank pages', async () => {
      await seedFixtureAndCluster();
      const report = await new ReportService().generateReport({ reportType: 'executive_summary' });
      const buf = await generateReportPdf(report);
      const pageObjects = (buf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) || []).length;
      // Header + sections of this fixture fit on at most two pages; the bug produced one extra per page.
      assert.ok(pageObjects >= 1 && pageObjects <= 2, `expected 1-2 pages, got ${pageObjects}`);
    });
  });

  describe('Analytics severity filter', () => {
    test('metrics honour the severity filter consistently with the feedback feed', async () => {
      await seedFixtureAndCluster();
      const svc = new AnalyticsService();

      const sev5 = svc.getMetricsFromStore({ severity: 5 });
      const feed5 = store.getRecords({ page: 1, pageSize: 1000, severity: 5 });
      assert.strictEqual(sev5.summary.totalFeedback, feed5.pagination.total);
      assert.strictEqual(sev5.summary.totalFeedback, 3);
      assert.strictEqual(sev5.filtersApplied.severity, 5);

      const all = svc.getMetricsFromStore({});
      assert.strictEqual(all.summary.totalFeedback, 6);
    });

    test('severity validator accepts numeric JSON values and rejects fractions', () => {
      const ok = validateAnalyticsFilters({ severity: 4 } as any);
      assert.strictEqual(ok.error, undefined);
      assert.strictEqual(ok.filters.severity, 4);

      const bad = validateAnalyticsFilters({ severity: '2.5' } as any);
      assert.ok(bad.error);
    });
  });

  describe('CSV import atomicity', () => {
    test('a malformed row mid-stream rolls back already-streamed chunks', async () => {
      const lines = ['review,category'];
      for (let i = 0; i < 620; i++) {
        lines.push(`"Unique customer comment number ${i} about checkout",Product Feedback`);
      }
      lines.push('"this quote is never closed,Product Feedback');
      const file = path.join(os.tmpdir(), `if-regression-${Date.now()}.csv`);
      fs.writeFileSync(file, lines.join('\n'), 'utf8');
      tempFiles.push(file);

      await assert.rejects(
        processCsvImport({
          filePath: file,
          fileName: 'broken.csv',
          fileSizeBytes: fs.statSync(file).size,
          isTemporary: false,
        })
      );

      assert.strictEqual(store.getTotalRecordsCount(), 0, 'no orphaned records may remain');
      assert.strictEqual(store.getBatches().length, 0);
    });
  });

  describe('AI layer', () => {
    test('model-supplied sentiment_score outside [-1, 1] is discarded', () => {
      const base = {
        sentiment: 'negative',
        primary_topic: 'Login',
        severity: 4,
        confidence: 0.9,
        explanation: 'Customer reports crashes',
        evidence_phrases: ['crashes'],
      };
      const wild = validateFeedbackAnalysisOutput({ ...base, sentiment_score: 7 });
      assert.ok(wild.success);
      assert.strictEqual(wild.data?.sentiment_score, undefined);

      const fine = validateFeedbackAnalysisOutput({ ...base, sentiment_score: -0.6 });
      assert.strictEqual(fine.data?.sentiment_score, -0.6);
    });

    test('anthropic provider is constructed (not silently unconfigured) and keys are redacted', () => {
      const provider = createAIProvider({ provider: 'anthropic', apiKey: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz' });
      assert.ok(provider instanceof AnthropicProvider);
      assert.strictEqual(provider.name, 'anthropic');
      assert.strictEqual(provider.isConfigured(), true);

      const cleaned = sanitizeErrorMessage('boom sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234 leaked');
      assert.ok(!cleaned.includes('abcdefghijklmnop'));
    });
  });
});
