import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FeedbackStore } from '../services/feedbackStore.js';
import { AnalyticsService } from '../services/analytics/analyticsService.js';
import { validateAnalyticsFilters } from '../routes/analytics.js';
import type { RawFeedbackRecord } from '../types/import.js';
import type { FeedbackAnalysisRecord } from '../services/analysis/types.js';

describe('InsightFlow Analytics Engine & Metrics API', () => {
  let store: FeedbackStore;
  let service: AnalyticsService;

  beforeEach(async () => {
    store = FeedbackStore.getInstance();
    await store.resetStore('all');
    service = new AnalyticsService();
  });

  test('1. Empty Dataset: returns meaningful empty state with 0 counts and 0 denominator', async () => {
    const metrics = await service.getMetrics({});

    assert.equal(metrics.summary.isEmpty, true);
    assert.equal(metrics.summary.totalFeedback, 0);
    assert.equal(metrics.summary.analyzedFeedback, 0);
    assert.equal(metrics.summary.pendingAnalysis, 0);
    assert.equal(metrics.summary.hasAnalysisRun, false);
    assert.equal(metrics.summary.analysisCoveragePercent, 0);
    assert.match(metrics.summary.statusMessage, /No feedback records found/i);

    // Sentiment denominator must be 0 and all percentages 0
    assert.equal(metrics.sentiment.denominator, 0);
    assert.equal(metrics.sentiment.counts.positive, 0);
    assert.equal(metrics.sentiment.percentages.positive, 0);
    assert.equal(metrics.sentiment.averageSentimentScore, null);
    assert.equal(metrics.sentiment.averageSeverity, null);

    // Categories and issue frequencies empty
    assert.equal(metrics.categories.length, 0);
    assert.equal(metrics.issueFrequencies.length, 0);

    // Duplicate statistics safely 0
    assert.equal(metrics.duplicateStats.totalFeedback, 0);
    assert.equal(metrics.duplicateStats.uniqueReviewTexts, 0);
    assert.equal(metrics.duplicateStats.duplicateFeedbackCount, 0);
    assert.equal(metrics.duplicateStats.duplicateRatio, 0);
    assert.equal(metrics.duplicateStats.topRepeatedReviews.length, 0);
  });

  test('2. Unanalyzed Dataset: reports pending status and excludes unanalyzed from sentiment denominator', async () => {
    // Ingest 5 raw unanalyzed records
    const sampleRecords: RawFeedbackRecord[] = [
      {
        id: 'rec-001',
        review: 'The export button fails to download reports.',
        category: 'Product Feedback',
        contentHash: 'hash-001',
        source: 'support_ticket',
        rowNumber: 1,
        batchId: 'batch-test-1',
        importedAt: new Date().toISOString(),
        isSample: true,
        datasetType: 'demo_sample',
      },
      {
        id: 'rec-002',
        review: 'Account manager was extremely responsive.',
        category: 'Customer Service',
        contentHash: 'hash-002',
        source: 'support_ticket',
        rowNumber: 2,
        batchId: 'batch-test-1',
        importedAt: new Date().toISOString(),
        isSample: true,
        datasetType: 'demo_sample',
      },
      {
        id: 'rec-003',
        review: 'API latency is fluctuating wildly.',
        category: 'Operational Issues',
        contentHash: 'hash-003',
        source: 'support_ticket',
        rowNumber: 3,
        batchId: 'batch-test-1',
        importedAt: new Date().toISOString(),
        isSample: true,
        datasetType: 'demo_sample',
      },
    ];

    await store.saveRecordsChunk(sampleRecords);

    const metrics = await service.getMetrics({});

    assert.equal(metrics.summary.isEmpty, false);
    assert.equal(metrics.summary.totalFeedback, 3);
    assert.equal(metrics.summary.analyzedFeedback, 0);
    assert.equal(metrics.summary.pendingAnalysis, 3);
    assert.equal(metrics.summary.hasAnalysisRun, false);
    assert.equal(metrics.summary.analysisCoveragePercent, 0);
    assert.match(metrics.summary.statusMessage, /AI analysis has not yet been executed/i);

    // Sentiment denominator MUST be 0 and NOT 3
    assert.equal(metrics.sentiment.denominator, 0);
    assert.equal(metrics.sentiment.counts.positive, 0);
    assert.equal(metrics.sentiment.counts.negative, 0);
    assert.equal(metrics.sentiment.percentages.positive, 0);
    assert.equal(metrics.sentiment.percentages.negative, 0);

    // Category distribution should reflect total records
    assert.equal(metrics.categories.length, 3);
    const prodCat = metrics.categories.find((c) => c.category === 'Product Feedback');
    assert.ok(prodCat);
    assert.equal(prodCat.count, 1);
    assert.equal(prodCat.analyzedCount, 0);
    assert.equal(prodCat.percentage, 33.33);
  });

  test('3. Exact Sentiment Denominator & Percentage Calculations with Mixed Analyzed/Unanalyzed Data', async () => {
    // Ingest 6 records: 4 analyzed, 2 unanalyzed
    const records: RawFeedbackRecord[] = [
      {
        id: 'fb-1',
        review: 'Fantastic software, speeds up my daily workflow!',
        category: 'Product Feedback',
        contentHash: 'h-1',
        source: 'portal',
        rowNumber: 1,
        batchId: 'b-1',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
      {
        id: 'fb-2',
        review: 'Unbelievably good customer support team.',
        category: 'Customer Service',
        contentHash: 'h-2',
        source: 'portal',
        rowNumber: 2,
        batchId: 'b-1',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
      {
        id: 'fb-3',
        review: 'The dashboard crashes every time I load the overview.',
        category: 'Operational Issues',
        contentHash: 'h-3',
        source: 'portal',
        rowNumber: 3,
        batchId: 'b-1',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
      {
        id: 'fb-4',
        review: 'Standard update, features are okay nothing special.',
        category: 'Product Feedback',
        contentHash: 'h-4',
        source: 'portal',
        rowNumber: 4,
        batchId: 'b-1',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
      {
        id: 'fb-5',
        review: 'Awaiting triage item number one.',
        category: 'Product Feedback',
        contentHash: 'h-5',
        source: 'portal',
        rowNumber: 5,
        batchId: 'b-1',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
      {
        id: 'fb-6',
        review: 'Awaiting triage item number two.',
        category: 'Operational Issues',
        contentHash: 'h-6',
        source: 'portal',
        rowNumber: 6,
        batchId: 'b-1',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
    ];

    await store.saveRecordsChunk(records);

    const now = new Date().toISOString();
    const analyses: FeedbackAnalysisRecord[] = [
      {
        id: 'an-1',
        feedbackId: 'fb-1',
        sentiment: 'positive',
        sentimentScore: 0.9,
        urgency: 'low',
        urgencyScore: 0.2,
        primaryTopic: 'Workflow Speed',
        topics: ['Efficiency', 'Speed'],
        keyPhrases: ['speeds up workflow'],
        summary: 'Customer pleased with speed',
        severity: 1,
        modelVersion: 'gemini-1.5-flash',
        promptVersion: 'v1.0.0',
        confidenceScore: 0.95,
        analyzedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'an-2',
        feedbackId: 'fb-2',
        sentiment: 'positive',
        sentimentScore: 0.85,
        urgency: 'low',
        urgencyScore: 0.1,
        primaryTopic: 'Support Quality',
        topics: ['Support', 'Team'],
        keyPhrases: ['good support team'],
        summary: 'Praise for customer support',
        severity: 1,
        modelVersion: 'gemini-1.5-flash',
        promptVersion: 'v1.0.0',
        confidenceScore: 0.92,
        analyzedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'an-3',
        feedbackId: 'fb-3',
        sentiment: 'negative',
        sentimentScore: -0.8,
        urgency: 'high',
        urgencyScore: 0.8,
        primaryTopic: 'Dashboard Crash',
        topics: ['Crash', 'Stability'],
        keyPhrases: ['crashes every time'],
        summary: 'Critical dashboard stability failure',
        severity: 4,
        modelVersion: 'gemini-1.5-flash',
        promptVersion: 'v1.0.0',
        confidenceScore: 0.98,
        analyzedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'an-4',
        feedbackId: 'fb-4',
        sentiment: 'neutral',
        sentimentScore: 0.05,
        urgency: 'normal',
        urgencyScore: 0.4,
        primaryTopic: 'Feature Releases',
        topics: ['Features'],
        keyPhrases: ['features are okay'],
        summary: 'Neutral reaction to release',
        severity: 2,
        modelVersion: 'gemini-1.5-flash',
        promptVersion: 'v1.0.0',
        confidenceScore: 0.85,
        analyzedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const an of analyses) {
      await store.saveAnalysis(an);
    }

    const metrics = await service.getMetrics({});

    assert.equal(metrics.summary.totalFeedback, 6);
    assert.equal(metrics.summary.analyzedFeedback, 4);
    assert.equal(metrics.summary.pendingAnalysis, 2);
    assert.equal(metrics.summary.hasAnalysisRun, true);
    assert.equal(metrics.summary.analysisCoveragePercent, 66.67);

    // CRITICAL: Sentiment denominator must strictly be 4 (not 6)
    assert.equal(metrics.sentiment.denominator, 4);
    assert.equal(metrics.sentiment.counts.positive, 2);
    assert.equal(metrics.sentiment.counts.negative, 1);
    assert.equal(metrics.sentiment.counts.neutral, 1);
    assert.equal(metrics.sentiment.counts.mixed, 0);

    // Percentages calculated on denominator of 4:
    // Positive: 2/4 = 50.00%
    // Negative: 1/4 = 25.00%
    // Neutral:  1/4 = 25.00%
    assert.equal(metrics.sentiment.percentages.positive, 50.0);
    assert.equal(metrics.sentiment.percentages.negative, 25.0);
    assert.equal(metrics.sentiment.percentages.neutral, 25.0);
    assert.equal(metrics.sentiment.percentages.mixed, 0.0);

    // Sum of percentages must equal 100%
    const sumPercentages =
      metrics.sentiment.percentages.positive +
      metrics.sentiment.percentages.negative +
      metrics.sentiment.percentages.neutral +
      metrics.sentiment.percentages.mixed;
    assert.equal(sumPercentages, 100);

    // Average sentiment score = (0.9 + 0.85 - 0.8 + 0.05) / 4 = 1.0 / 4 = 0.250
    assert.equal(metrics.sentiment.averageSentimentScore, 0.25);
  });

  test('4. Consistent Filter Semantics between Analytics Metrics and Feedback Pagination', async () => {
    // Ingest mixed category and sentiment records
    const records: RawFeedbackRecord[] = [
      {
        id: 'c-1',
        review: 'Checkout fails with 500 error.',
        category: 'Product Feedback',
        contentHash: 'ch-1',
        source: 'web',
        rowNumber: 1,
        batchId: 'b-2',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
      {
        id: 'c-2',
        review: 'Checkout is super fast now.',
        category: 'Product Feedback',
        contentHash: 'ch-2',
        source: 'web',
        rowNumber: 2,
        batchId: 'b-2',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
      {
        id: 'c-3',
        review: 'Fraudulent transaction attempt detected.',
        category: 'Fraud and Scam',
        contentHash: 'ch-3',
        source: 'web',
        rowNumber: 3,
        batchId: 'b-2',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
    ];

    await store.saveRecordsChunk(records);

    const analysisNow = new Date().toISOString();
    await store.saveAnalysis({
      id: 'a-1',
      feedbackId: 'c-1',
      sentiment: 'negative',
      sentimentScore: -0.7,
      urgency: 'high',
      urgencyScore: 0.8,
      primaryTopic: 'Checkout Failure',
      topics: ['Checkout', 'Payment'],
      keyPhrases: ['fails with 500'],
      summary: 'Checkout HTTP 500 error',
      severity: 4,
      modelVersion: 'gemini-1.5-flash',
      promptVersion: 'v1.0.0',
      confidenceScore: 0.95,
      analyzedAt: analysisNow,
      createdAt: analysisNow,
      updatedAt: analysisNow,
    });

    await store.saveAnalysis({
      id: 'a-2',
      feedbackId: 'c-2',
      sentiment: 'positive',
      sentimentScore: 0.8,
      urgency: 'low',
      urgencyScore: 0.2,
      primaryTopic: 'Checkout Speed',
      topics: ['Checkout', 'Speed'],
      keyPhrases: ['super fast'],
      summary: 'Fast checkout praise',
      severity: 1,
      modelVersion: 'gemini-1.5-flash',
      promptVersion: 'v1.0.0',
      confidenceScore: 0.9,
      analyzedAt: analysisNow,
      createdAt: analysisNow,
      updatedAt: analysisNow,
    });

    // Case A: Filter by category = 'Product Feedback'
    const catMetrics = await service.getMetrics({ category: 'Product Feedback' });
    const catRecords = store.getRecords({ category: 'Product Feedback' });
    assert.equal(catMetrics.summary.totalFeedback, 2);
    assert.equal(catRecords.pagination.total, 2);
    assert.equal(catMetrics.sentiment.denominator, 2);

    // Case B: Filter by sentiment = 'negative'
    const negMetrics = await service.getMetrics({ sentiment: 'negative' });
    const negRecords = store.getRecords({ sentiment: 'negative' });
    assert.equal(negMetrics.summary.totalFeedback, 1);
    assert.equal(negRecords.pagination.total, 1);
    assert.equal(negRecords.data[0].id, 'c-1');

    // Case C: Filter by topic = 'Checkout'
    const topicMetrics = await service.getMetrics({ topic: 'Checkout' });
    const topicRecords = store.getRecords({ topic: 'Checkout' });
    assert.equal(topicMetrics.summary.totalFeedback, 2);
    assert.equal(topicRecords.pagination.total, 2);

    // Case D: Filter by analysisStatus = 'pending'
    const pendingMetrics = await service.getMetrics({ analysisStatus: 'pending' });
    const pendingRecords = store.getRecords({ analysisStatus: 'pending' });
    assert.equal(pendingMetrics.summary.totalFeedback, 1);
    assert.equal(pendingRecords.pagination.total, 1);
    assert.equal(pendingRecords.data[0].id, 'c-3');
  });

  test('5. Duplicate Text Statistics: detects identical complaints and computes accurate repetition metrics', async () => {
    // Ingest 8 records containing 3 duplicates of text A, 2 duplicates of text B, and 3 unique
    const duplicateRecords: RawFeedbackRecord[] = [
      // 3 identical instances of Review A
      {
        id: 'dup-1',
        review: 'Login screen hangs indefinitely on Safari.',
        category: 'Operational Issues',
        contentHash: 'dh-1',
        source: 'app',
        rowNumber: 1,
        batchId: 'b-dup',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
      {
        id: 'dup-2',
        review: 'Login screen hangs indefinitely on Safari.',
        category: 'Operational Issues',
        contentHash: 'dh-2',
        source: 'app',
        rowNumber: 2,
        batchId: 'b-dup',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
      {
        id: 'dup-3',
        review: '  Login screen hangs indefinitely on Safari.  ', // whitespace variance
        category: 'Operational Issues',
        contentHash: 'dh-3',
        source: 'app',
        rowNumber: 3,
        batchId: 'b-dup',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
      // 2 identical instances of Review B
      {
        id: 'dup-4',
        review: 'Customer support refused refund request.',
        category: 'Customer Service',
        contentHash: 'dh-4',
        source: 'app',
        rowNumber: 4,
        batchId: 'b-dup',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
      {
        id: 'dup-5',
        review: 'Customer support refused refund request.',
        category: 'Customer Service',
        contentHash: 'dh-5',
        source: 'app',
        rowNumber: 5,
        batchId: 'b-dup',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
      // Unique Review C
      {
        id: 'dup-6',
        review: 'Love the new dark mode theme.',
        category: 'Product Feedback',
        contentHash: 'dh-6',
        source: 'app',
        rowNumber: 6,
        batchId: 'b-dup',
        importedAt: new Date().toISOString(),
        isSample: false,
        datasetType: 'genuine_import',
      },
    ];

    await store.saveRecordsChunk(duplicateRecords);

    const metrics = await service.getMetrics({});
    const dupStats = metrics.duplicateStats;

    assert.equal(dupStats.totalFeedback, 6);
    // Unique reviews: Review A (1), Review B (1), Review C (1) = 3 unique texts
    assert.equal(dupStats.uniqueReviewTexts, 3);
    // Duplicate records: 6 total - 3 unique = 3 duplicate rows
    assert.equal(dupStats.duplicateFeedbackCount, 3);
    // Duplicate ratio: 3 / 6 = 50.00%
    assert.equal(dupStats.duplicateRatio, 50.0);

    // Top repeated reviews list
    assert.equal(dupStats.topRepeatedReviews.length, 2);
    assert.equal(dupStats.topRepeatedReviews[0].count, 3);
    assert.equal(dupStats.topRepeatedReviews[0].duplicateCount, 2);
    assert.match(dupStats.topRepeatedReviews[0].textSnippet, /Login screen hangs/i);

    assert.equal(dupStats.topRepeatedReviews[1].count, 2);
    assert.equal(dupStats.topRepeatedReviews[1].duplicateCount, 1);
    assert.match(dupStats.topRepeatedReviews[1].textSnippet, /Customer support refused/i);
  });

  test('6. Query Validation: rejects invalid sentiment, analysisStatus, and datasetType with consistent 400 error', () => {
    // Valid query
    const valid = validateAnalyticsFilters({
      sentiment: 'negative',
      analysisStatus: 'analyzed',
      datasetType: 'genuine_import',
      category: 'Product Feedback',
    });
    assert.equal(valid.error, undefined);
    assert.equal(valid.filters.sentiment, 'negative');
    assert.equal(valid.filters.analysisStatus, 'analyzed');

    // Invalid sentiment
    const badSentiment = validateAnalyticsFilters({ sentiment: 'ecstatic' });
    assert.ok(badSentiment.error);
    assert.match(badSentiment.error, /Invalid sentiment filter 'ecstatic'/);

    // Invalid analysisStatus
    const badStatus = validateAnalyticsFilters({ analysisStatus: 'in_progress' });
    assert.ok(badStatus.error);
    assert.match(badStatus.error, /Invalid analysisStatus filter 'in_progress'/);

    // Invalid datasetType
    const badDataset = validateAnalyticsFilters({ datasetType: 'fake_fixture' });
    assert.ok(badDataset.error);
    assert.match(badDataset.error, /Invalid datasetType filter 'fake_fixture'/);

    // Invalid severity
    const badSeverity = validateAnalyticsFilters({ severity: '99' as any });
    assert.ok(badSeverity.error);
    assert.match(badSeverity.error, /Invalid severity filter '99'/);
  });

  test('7. Severity Filtering & Multi-Field Sorting: validates sorting and filtering on analyzed records', async () => {
    const records: RawFeedbackRecord[] = [
      {
        id: 'sort-1',
        review: 'Minor cosmetic typo on button.',
        category: 'Product Feedback',
        contentHash: 'sh-1',
        source: 'app',
        rowNumber: 1,
        batchId: 'b-s',
        importedAt: '2026-10-10T10:00:00Z',
        isSample: false,
        datasetType: 'genuine_import',
      },
      {
        id: 'sort-2',
        review: 'Critical database deadlock on checkout.',
        category: 'Operational Issues',
        contentHash: 'sh-2',
        source: 'app',
        rowNumber: 2,
        batchId: 'b-s',
        importedAt: '2026-10-10T12:00:00Z',
        isSample: false,
        datasetType: 'genuine_import',
      },
      {
        id: 'sort-3',
        review: 'Average response time could be faster.',
        category: 'Customer Service',
        contentHash: 'sh-3',
        source: 'app',
        rowNumber: 3,
        batchId: 'b-s',
        importedAt: '2026-10-10T11:00:00Z',
        isSample: false,
        datasetType: 'genuine_import',
      },
    ];

    await store.saveRecordsChunk(records);

    const now = new Date().toISOString();
    await store.saveAnalysis({
      id: 'an-s1',
      feedbackId: 'sort-1',
      sentiment: 'neutral',
      sentimentScore: 0.1,
      urgency: 'low',
      urgencyScore: 0.2,
      primaryTopic: 'Button Typo',
      topics: ['UI'],
      keyPhrases: ['typo'],
      summary: 'Cosmetic typo',
      severity: 1,
      confidenceScore: 0.99,
      modelVersion: 'gemini-1.5-flash',
      promptVersion: 'v1.0.0',
      analyzedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await store.saveAnalysis({
      id: 'an-s2',
      feedbackId: 'sort-2',
      sentiment: 'negative',
      sentimentScore: -0.9,
      urgency: 'critical',
      urgencyScore: 1.0,
      primaryTopic: 'Checkout Deadlock',
      topics: ['Checkout', 'Deadlock'],
      keyPhrases: ['deadlock'],
      summary: 'Critical deadlock',
      severity: 5,
      confidenceScore: 0.65, // low confidence
      modelVersion: 'gemini-1.5-flash',
      promptVersion: 'v1.0.0',
      analyzedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await store.saveAnalysis({
      id: 'an-s3',
      feedbackId: 'sort-3',
      sentiment: 'negative',
      sentimentScore: -0.3,
      urgency: 'normal',
      urgencyScore: 0.6,
      primaryTopic: 'Response Time',
      topics: ['Speed'],
      keyPhrases: ['faster'],
      summary: 'Response time issue',
      severity: 3,
      confidenceScore: 0.92,
      modelVersion: 'gemini-1.5-flash',
      promptVersion: 'v1.0.0',
      analyzedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // 1. Severity filter = 5 (critical)
    const sev5Records = store.getRecords({ severity: 5 });
    assert.equal(sev5Records.data.length, 1);
    assert.equal(sev5Records.data[0].id, 'sort-2');

    // 2. Sort by severity desc
    const sortedSevDesc = store.getRecords({ sortBy: 'severity', sortOrder: 'desc' });
    assert.equal(sortedSevDesc.data[0].id, 'sort-2'); // severity 5
    assert.equal(sortedSevDesc.data[1].id, 'sort-3'); // severity 3
    assert.equal(sortedSevDesc.data[2].id, 'sort-1'); // severity 1

    // 3. Sort by confidence asc (finding low confidence reviews)
    const sortedConfAsc = store.getRecords({ sortBy: 'confidence', sortOrder: 'asc' });
    assert.equal(sortedConfAsc.data[0].id, 'sort-2'); // 0.65 confidence
    assert.equal(sortedConfAsc.data[1].id, 'sort-3'); // 0.92 confidence
    assert.equal(sortedConfAsc.data[2].id, 'sort-1'); // 0.99 confidence
  });
});
