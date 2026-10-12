import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import reportRoutes from '../routes/reports.js';
import feedbackRoutes from '../routes/feedback.js';
import { FeedbackStore } from '../services/feedbackStore.js';
import { ReportService } from '../services/reports/reportService.js';
import { generateReportPdf } from '../services/reports/pdfGenerator.js';
import { generateReportCsv } from '../services/reports/csvGenerator.js';
import { seedSampleDataset } from '../db/seed.js';

describe('InsightFlow Business Insight Reports & Intelligence Digests Workflow', () => {
  let server: Server;
  let baseUrl: string;
  let store: FeedbackStore;
  let reportService: ReportService;

  before(async () => {
    store = FeedbackStore.getInstance();
    reportService = new ReportService();

    // Seed standard 20-row sample dataset
    await seedSampleDataset({ reset: true });

    // Mount test express server
    const app = express();
    app.use(express.json());
    app.use('/api/feedback', feedbackRoutes);
    app.use('/api/reports', reportRoutes);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api/reports`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('Service & Calculation Invariants', () => {
    test('1. Metric Consistency: Generates report with metrics strictly matching verified database records', async () => {
      const report = await reportService.generateReport({
        title: 'Q4 Customer Intelligence Audit',
        reportType: 'executive_summary',
        format: 'both',
      });

      assert.ok(report.id, 'Report should have an ID');
      assert.match(
        report.reportCode,
        /^REP-\d{8}-[A-F0-9]{4}$/,
        'Report code should follow standard REP-YYYYMMDD-XXXX format'
      );
      assert.strictEqual(report.status, 'generated');
      assert.strictEqual(report.format, 'both');

      const p = report.contentPayload;
      const expectedTotal = store.getRecords().pagination.total;
      assert.strictEqual(p.datasetScope.totalFeedback, expectedTotal);
      assert.ok(p.datasetScope.analysisCoveragePercent >= 0 && p.datasetScope.analysisCoveragePercent <= 100);

      const sent = p.sentimentDistribution;
      assert.strictEqual(
        sent.positive.count + sent.neutral.count + sent.negative.count + sent.mixed.count,
        sent.denominator
      );

      if (sent.denominator > 0) {
        const expectedNet = Number(
          (((sent.positive.count - sent.negative.count) / sent.denominator) * 100).toFixed(1)
        );
        assert.strictEqual(sent.netSentimentScore, expectedNet);
      }

      assert.ok(Array.isArray(p.topPriorityIssues));
      if (p.topPriorityIssues.length > 0) {
        const top = p.topPriorityIssues[0];
        assert.ok(top.code, 'Issue must have an issue code');
        assert.ok(top.priorityScore >= 0 && top.priorityScore <= 100);
        assert.ok(top.scoreBreakdown.frequencyPoints >= 0);
        assert.ok(top.scoreBreakdown.severityPoints >= 0);
        assert.ok(top.scoreBreakdown.negativeSentimentPoints >= 0);

        for (const exc of top.representativeExcerpts) {
          assert.ok(exc.feedbackId, 'Excerpt must have feedback ID');
          const realRecord = store.getRecordById(exc.feedbackId);
          assert.ok(realRecord, `Feedback ID ${exc.feedbackId} must exist in feedback store`);
          assert.strictEqual(exc.quote, realRecord?.review, 'Quote must preserve exact customer review text');
        }
      }

      assert.ok(p.issueStatusSummary.total >= 0);
      assert.strictEqual(
        p.issueStatusSummary.open +
          p.issueStatusSummary.in_progress +
          p.issueStatusSummary.resolved +
          p.issueStatusSummary.dismissed,
        p.issueStatusSummary.total
      );
    });

    test('2. PDF Generation: Generates valid binary PDF buffer with proper headers and page range', async () => {
      const report = await reportService.generateReport({
        title: 'Executive PDF Briefing Test',
        reportType: 'executive_summary',
        format: 'pdf',
      });

      const pdfBuffer = await generateReportPdf(report);

      assert.ok(Buffer.isBuffer(pdfBuffer), 'Must return a Buffer');
      assert.ok(pdfBuffer.length > 2000, `PDF buffer length (${pdfBuffer.length}) must be substantial`);

      const header = pdfBuffer.subarray(0, 5).toString('ascii');
      assert.strictEqual(header, '%PDF-', 'PDF must begin with %PDF- magic bytes');
    });

    test('3. CSV Generation: Generates structured RFC-4180 CSV with formula injection escaping', async () => {
      const report = await reportService.generateReport({
        title: 'Structured CSV Intelligence Digest',
        reportType: 'full_audit',
        format: 'csv',
      });

      const csvContent = generateReportCsv(report);

      assert.ok(typeof csvContent === 'string', 'Must return a string');
      assert.ok(csvContent.includes('# SECTION: REPORT METADATA'), 'Must include metadata section');
      assert.ok(csvContent.includes('# SECTION: DATASET SCOPE & ANALYSIS STATUS'), 'Must include dataset scope section');
      assert.ok(csvContent.includes('# SECTION: CUSTOMER SENTIMENT DISTRIBUTION'), 'Must include sentiment section');
      assert.ok(csvContent.includes('# SECTION: CATEGORY DISTRIBUTION'), 'Must include category section');
      assert.ok(csvContent.includes('# SECTION: TOP PRIORITY ISSUES & SCORE BREAKDOWN'), 'Must include top priority issues table');

      const lines = csvContent.split('\r\n');
      for (const line of lines) {
        if (line.startsWith('=') || line.startsWith('+') || line.startsWith('@')) {
          assert.fail(`CSV contains unescaped spreadsheet formula injection risk: ${line}`);
        }
      }
    });

    test('4. Empty Dataset Handling: Gracefully processes scope with zero records without NaN or crash', async () => {
      const report = await reportService.generateReport({
        title: 'Empty Scope Report',
        scope: {
          category: 'NonExistentCategoryPlaceholder',
        },
      });

      assert.ok(report);
      const p = report.contentPayload;
      assert.strictEqual(p.datasetScope.totalFeedback, 0);
      assert.strictEqual(p.datasetScope.analyzedFeedback, 0);
      assert.strictEqual(p.datasetScope.analysisCoveragePercent, 0);
      assert.strictEqual(p.sentimentDistribution.denominator, 0);
      assert.strictEqual(p.sentimentDistribution.netSentimentScore, 0);
      assert.strictEqual(p.categoryBreakdown.length, 0);

      const pdfBuf = await generateReportPdf(report);
      assert.ok(pdfBuf.length > 1000);

      const csvStr = generateReportCsv(report);
      assert.ok(csvStr.includes('Total Feedback Items,"0"'));
    });

    test('5. Historical Trend & Snapshot Integrity: Flags single-import data as snapshot and omits false trends', async () => {
      const report = await reportService.generateReport({
        title: 'Snapshot Integrity Verification',
      });

      const range = report.contentPayload.metadata.applicableDateRange;
      assert.ok(typeof range.isSnapshot === 'boolean');
      if (range.isSnapshot) {
        assert.ok(
          range.note.includes('Current Snapshot'),
          'Snapshot report must explicitly state that historical trend comparisons are omitted'
        );
      }
    });

    test('6. Persistence Invariant: Persists report to store, retrieves by ID and Code, and supports deletion', async () => {
      const report = await reportService.generateReport({
        title: 'Persistence Test Report',
        cadence: 'Weekly Digest',
      });

      const retrievedById = store.getReportById(report.id);
      assert.ok(retrievedById);
      assert.strictEqual(retrievedById?.title, 'Persistence Test Report');
      assert.strictEqual(retrievedById?.cadence, 'Weekly Digest');

      const retrievedByCode = store.getReportByCode(report.reportCode);
      assert.ok(retrievedByCode);
      assert.strictEqual(retrievedByCode?.id, report.id);

      const list = store.getReports();
      const foundInList = list.some((r) => r.id === report.id);
      assert.ok(foundInList, 'Report should be in getReports() list');

      const deleted = await store.deleteReport(report.id);
      assert.strictEqual(deleted, true);
      assert.strictEqual(store.getReportById(report.id), null);
    });
  });

  describe('HTTP Endpoints & Validation', () => {
    test('POST /api/reports/generate with valid parameters returns 201 and persisted report', async () => {
      const res = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'API Generated Briefing',
          reportType: 'executive_summary',
          format: 'both',
          cadence: 'On-Demand',
        }),
      });

      assert.strictEqual(res.status, 201);
      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.ok(json.data.id);
      assert.strictEqual(json.data.title, 'API Generated Briefing');
    });

    test('POST /api/reports/generate rejects invalid reportType with 400 ValidationError', async () => {
      const res = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'invalid_super_type',
        }),
      });

      assert.strictEqual(res.status, 400);
      const json = (await res.json()) as any;
      assert.strictEqual(json.error, 'ValidationError');
      assert.ok(json.message.includes('Invalid reportType'));
    });

    test('POST /api/reports/generate rejects invalid format with 400 ValidationError', async () => {
      const res = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'invalid_format_xyz',
        }),
      });

      assert.strictEqual(res.status, 400);
      const json = (await res.json()) as any;
      assert.strictEqual(json.error, 'ValidationError');
      assert.ok(json.message.includes('Invalid format'));
    });

    test('GET /api/reports returns 200 with list of generated reports', async () => {
      const res = await fetch(`${baseUrl}`);
      assert.strictEqual(res.status, 200);
      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));
      assert.ok(json.data.length > 0);
    });

    test('GET /api/reports/:id/pdf streams valid PDF with correct headers', async () => {
      // First generate a report to export
      const genRes = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'PDF Export Test Report', format: 'pdf' }),
      });
      const genJson = (await genRes.json()) as any;
      const reportId = genJson.data.id;

      const pdfRes = await fetch(`${baseUrl}/${reportId}/pdf`);
      assert.strictEqual(pdfRes.status, 200);
      assert.strictEqual(pdfRes.headers.get('content-type'), 'application/pdf');
      assert.ok(pdfRes.headers.get('content-disposition')?.includes('attachment; filename='));

      const arrayBuf = await pdfRes.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      assert.strictEqual(buf.subarray(0, 5).toString('ascii'), '%PDF-');
    });

    test('GET /api/reports/:id/csv streams valid CSV with correct headers', async () => {
      const genRes = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'CSV Export Test Report', format: 'csv' }),
      });
      const genJson = (await genRes.json()) as any;
      const reportId = genJson.data.id;

      const csvRes = await fetch(`${baseUrl}/${reportId}/csv`);
      assert.strictEqual(csvRes.status, 200);
      assert.ok(csvRes.headers.get('content-type')?.includes('text/csv'));
      const text = await csvRes.text();
      assert.ok(text.includes('# SECTION: REPORT METADATA'));
    });

    test('DELETE /api/reports/:id deletes report and returns 404 on subsequent get', async () => {
      const genRes = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'To Be Deleted Report' }),
      });
      const genJson = (await genRes.json()) as any;
      const reportId = genJson.data.id;

      const delRes = await fetch(`${baseUrl}/${reportId}`, { method: 'DELETE' });
      assert.strictEqual(delRes.status, 200);

      const getRes = await fetch(`${baseUrl}/${reportId}`);
      assert.strictEqual(getRes.status, 404);
    });
  });
});
