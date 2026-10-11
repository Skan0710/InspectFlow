import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RecommendationService } from '../services/recommendations/recommendationService.js';
import { validateRecommendationOutput } from '../services/recommendations/validator.js';
import { generateDeterministicFallback } from '../services/recommendations/fallbackGenerator.js';
import { FeedbackStore } from '../services/feedbackStore.js';
import { TestAIProvider } from '../services/ai/providers/testProvider.js';
import { UnconfiguredAIProvider } from '../services/ai/providers/unconfiguredProvider.js';
import type { IssueClusterData } from '../services/clustering/types.js';
import type { RawFeedbackRecord } from '../types/import.js';
import type { FeedbackAnalysisRecord } from '../services/analysis/types.js';

describe('InsightFlow Evidence-Backed AI Recommendations', () => {
  const store = FeedbackStore.getInstance();
  let testProvider: TestAIProvider;
  let service: RecommendationService;

  const mockFeedback: RawFeedbackRecord[] = [
    {
      id: 'fb-001',
      review: 'Unable to withdraw funds due to unexplained 403 error during checkout.',
      category: 'Operational Issues',
      contentHash: 'hash-001',
      source: 'Support Portal',
      rowNumber: 1,
      batchId: 'b-01',
      importedAt: new Date().toISOString(),
      isSample: false,
      datasetType: 'genuine_import',
    },
    {
      id: 'fb-002',
      review: 'Withdrawal endpoint fails intermittently with timeout on mobile network.',
      category: 'Operational Issues',
      contentHash: 'hash-002',
      source: 'Support Portal',
      rowNumber: 2,
      batchId: 'b-01',
      importedAt: new Date().toISOString(),
      isSample: false,
      datasetType: 'genuine_import',
    },
    {
      id: 'fb-003',
      review: 'Transactions hang indefinitely while waiting for SMS confirmation.',
      category: 'Operational Issues',
      contentHash: 'hash-003',
      source: 'Support Portal',
      rowNumber: 3,
      batchId: 'b-01',
      importedAt: new Date().toISOString(),
      isSample: false,
      datasetType: 'genuine_import',
    },
  ];

  const mockAnalyses: FeedbackAnalysisRecord[] = [
    {
      id: 'an-001',
      feedbackId: 'fb-001',
      sentiment: 'negative',
      sentimentScore: -0.85,
      urgency: 'critical',
      urgencyScore: 0.95,
      primaryTopic: 'Withdrawal Failure',
      topics: ['Checkout', '403 Error'],
      keyPhrases: ['unexplained 403 error', 'unable to withdraw'],
      summary: 'Customer blocked from withdrawing funds with HTTP 403.',
      severity: 5,
      confidenceScore: 0.96,
      modelVersion: 'test-model:rec-v1.0.0',
      promptVersion: 'rec-v1.0.0',
      analyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'an-002',
      feedbackId: 'fb-002',
      sentiment: 'negative',
      sentimentScore: -0.75,
      urgency: 'high',
      urgencyScore: 0.8,
      primaryTopic: 'Mobile Timeout',
      topics: ['Timeout', 'Mobile'],
      keyPhrases: ['fails intermittently', 'timeout on mobile'],
      summary: 'Intermittent mobile network timeout during withdrawal.',
      severity: 4,
      confidenceScore: 0.91,
      modelVersion: 'test-model:rec-v1.0.0',
      promptVersion: 'rec-v1.0.0',
      analyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'an-003',
      feedbackId: 'fb-003',
      sentiment: 'mixed',
      sentimentScore: -0.3,
      urgency: 'normal',
      urgencyScore: 0.6,
      primaryTopic: 'SMS Delay',
      topics: ['SMS', 'Transactions'],
      keyPhrases: ['hang indefinitely', 'SMS confirmation'],
      summary: 'Customer reports transaction hang during SMS authentication.',
      severity: 3,
      confidenceScore: 0.88,
      modelVersion: 'test-model:rec-v1.0.0',
      promptVersion: 'rec-v1.0.0',
      analyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockIssue: IssueClusterData = {
    id: 'issue-crit-101',
    issueCode: 'ISS-101',
    title: 'Intermittent Withdrawal and Checkout Gateway Timeouts',
    description: 'Systemic HTTP 403 and timeout errors blocking customer withdrawal transactions.',
    category: 'Operational Issues',
    status: 'in_progress',
    priority: 'critical',
    impactSummary: 'Severe operational friction halting money movement.',
    feedbackCount: 3,
    uniqueTextCount: 3,
    representativeExamples: [
      {
        feedbackId: 'fb-001',
        quote: 'Unable to withdraw funds due to unexplained 403 error during checkout.',
        relevanceScore: 0.98,
        category: 'Operational Issues',
        source: 'Support Portal',
      },
    ],
    sentimentBreakdown: {
      positive: 0,
      neutral: 0,
      negative: 2,
      mixed: 1,
    },
    avgConfidence: 0.92,
    memberFeedbackIds: ['fb-001', 'fb-002', 'fb-003'],
    metadata: {
      priorityScore: 88,
      priorityTier: 'critical',
      totalMentions: 3,
      uniqueReports: 3,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    testProvider = new TestAIProvider();
    service = new RecommendationService(testProvider, store);
    await store.resetStore('all');

    // Populate store with test feedback, analyses, and issue cluster
    await store.saveRecordsChunk(mockFeedback);
    for (const an of mockAnalyses) {
      await store.saveAnalysis(an);
    }
    await store.saveClustersAndLinks(
      {
        runId: 'test-run-1',
        totalFeedbackEvaluated: 3,
        uniqueTextsEvaluated: 3,
        clusteredFeedbackCount: 3,
        unmatchedFeedbackCount: 0,
        clustersCount: 1,
        clusters: [mockIssue],
        unmatched: [],
        executionDurationMs: 15,
        parameters: {},
        createdAt: new Date().toISOString(),
      },
      mockFeedback.map((fb) => ({
        id: `link-${fb.id}`,
        issueId: mockIssue.id,
        feedbackId: fb.id,
        relevanceScore: 0.9,
        citationQuote: fb.review,
        addedBy: 'test_harness',
        createdAt: fb.importedAt,
      }))
    );
  });

  test('1. Normal Results: Generates structured recommendation with summary, why it matters, actions, team, and evidence', async () => {
    testProvider.enqueueResponse({
      issue_summary: 'Customers are blocked from completing withdrawal transactions due to gateway timeouts and authorization failures.',
      why_it_matters: 'Halting fund withdrawals directly harms user trust, creates severe support ticket surges, and represents a P0 operational blocker.',
      suggested_team: 'Engineering',
      recommended_actions: [
        {
          title: 'Implement Gateway Circuit Breaker & Health Check',
          description: 'Deploy defensive failover logic on the payment gateway adapter with active latency health checks.',
          expected_impact: 'Eliminates cascading 403 gateway lockups during peak withdrawal hours.',
          timeframe: 'immediate',
          suggested_owner_team: 'Engineering',
        },
        {
          title: 'Add Contextual Error Recovery Dialog',
          description: 'Provide users with retry guidance and transparent status messages instead of generic failure screens.',
          expected_impact: 'Decreases repeat panic inquiries to customer service.',
          timeframe: 'short_term',
          suggested_owner_team: 'Product',
        },
      ],
      evidence_feedback_ids: ['fb-001', 'fb-002'],
      confidence: 0.96,
    });

    const recommendation = await service.generateRecommendation(mockIssue.id);

    assert.strictEqual(recommendation.issueId, mockIssue.id);
    assert.strictEqual(recommendation.issueCode, 'ISS-101');
    assert.strictEqual(recommendation.suggestedTeam, 'Engineering');
    assert.strictEqual(recommendation.isFallback, false);
    assert.strictEqual(recommendation.recommendedActions.length, 2);
    assert.strictEqual(recommendation.recommendedActions[0].timeframe, 'immediate');

    // Evidence excerpts must be strictly populated from real feedback
    assert.strictEqual(recommendation.evidenceExcerpts.length, 2);
    assert.strictEqual(recommendation.evidenceExcerpts[0].feedbackId, 'fb-001');
    assert.ok(recommendation.evidenceExcerpts[0].quote.includes('403 error'));
    assert.strictEqual(recommendation.evidenceExcerpts[1].feedbackId, 'fb-002');

    // Timestamps and model/prompt audit metadata
    assert.ok(recommendation.generatedAt);
    assert.ok(recommendation.modelVersion.length > 0);
    assert.strictEqual(recommendation.promptVersion, 'rec-v1.0.0');

    // Check store persistence
    const saved = store.getRecommendationByIssueId(mockIssue.id);
    assert.ok(saved !== null);
    assert.strictEqual(saved.id, recommendation.id);
  });

  test('2. Measured Facts Accuracy: Computes verified frequency, unique count, sentiment, and severity breakdown', () => {
    const facts = service.computeMeasuredFacts(mockIssue);

    assert.strictEqual(facts.totalFrequency, 3);
    assert.strictEqual(facts.uniqueReports, 3);
    assert.strictEqual(facts.duplicateRatio, 0);

    // Severity breakdown from analyses: fb-001 is sev 5, fb-002 is sev 4, fb-003 is sev 3
    assert.strictEqual(facts.severityBreakdown.sev5, 1);
    assert.strictEqual(facts.severityBreakdown.sev4, 1);
    assert.strictEqual(facts.severityBreakdown.sev3, 1);
    assert.strictEqual(facts.severityBreakdown.sev2, 0);
    assert.strictEqual(facts.severityBreakdown.sev1, 0);

    // Average severity: (5 + 4 + 3) / 3 = 4.00
    assert.strictEqual(facts.averageSeverity, 4.0);

    // Sentiment breakdown: 2 negative, 1 mixed, 0 positive, 0 neutral
    assert.strictEqual(facts.sentimentDistribution.negative, 2);
    assert.strictEqual(facts.sentimentDistribution.mixed, 1);
    assert.strictEqual(facts.sentimentDistribution.positive, 0);
    assert.strictEqual(facts.sentimentDistribution.neutral, 0);

    assert.strictEqual(facts.priorityTier, 'critical');
    assert.strictEqual(facts.priorityScore, 82.9);
  });

  test('3. Strict Evidence Grounding & Invalid ID Rejection: Rejects hallucinated feedback IDs', () => {
    const validIds = new Set(['fb-001', 'fb-002', 'fb-003']);

    // Model attempts to reference a fabricated/unrelated ID
    const invalidData = {
      issue_summary: 'Gateway errors are occurring.',
      why_it_matters: 'Affects user experience.',
      suggested_team: 'Engineering',
      recommended_actions: [
        {
          title: 'Fix Gateway',
          description: 'Repair adapter.',
          expected_impact: 'Better performance.',
          timeframe: 'immediate',
        },
      ],
      evidence_feedback_ids: ['fb-001', 'FABRICATED-ID-999'],
    };

    const validation = validateRecommendationOutput(invalidData, { validFeedbackIds: validIds });
    assert.strictEqual(validation.success, false);
    assert.ok(validation.errors);
    assert.ok(
      validation.errors.some((err) =>
        err.includes('FABRICATED-ID-999') && err.includes('does not belong to this issue')
      )
    );
  });

  test('4. Schema Validation: Rejects malformed output, invalid teams, and missing actions', () => {
    const validIds = new Set(['fb-001']);

    // Invalid team & empty actions
    const malformedData = {
      issue_summary: 'Test summary',
      why_it_matters: 'Important impact statement',
      suggested_team: 'FakeNonexistentTeam',
      recommended_actions: [],
      evidence_feedback_ids: ['fb-001'],
    };

    const result = validateRecommendationOutput(malformedData, { validFeedbackIds: validIds });
    assert.strictEqual(result.success, false);
    assert.ok(result.errors);
    assert.ok(result.errors.some((e) => e.includes('Invalid suggested_team')));
    assert.ok(result.errors.some((e) => e.includes('recommended_actions must be a non-empty array')));
  });

  test('5. Graceful Recovery & Deterministic Fallback: When AI provider fails, produces grounded deterministic recommendation', async () => {
    // Simulate AI Provider failure (e.g. rate limit exhaustion or timeout)
    testProvider.enqueueError(new Error('Persistent 429 RateLimitError from upstream provider'));

    const recommendation = await service.generateRecommendation(mockIssue.id, { forceRefresh: true });

    assert.strictEqual(recommendation.issueId, mockIssue.id);
    assert.strictEqual(recommendation.isFallback, true);
    assert.strictEqual(recommendation.modelVersion, 'deterministic-heuristic');
    assert.strictEqual(recommendation.promptVersion, 'fallback-v1.0.0');

    // Fallback recommendation must be grounded in real issue data
    assert.ok(recommendation.issueSummary.includes(mockIssue.title));
    assert.ok(recommendation.whyItMatters.includes('CRITICAL'));
    assert.ok(recommendation.whyItMatters.includes('4.00/5'));
    assert.ok(recommendation.recommendedActions.length >= 2);
    assert.ok(recommendation.evidenceExcerpts.length > 0);
    assert.ok(recommendation.evidenceExcerpts.every((ex) => mockIssue.memberFeedbackIds.includes(ex.feedbackId)));
  });

  test('6. Unconfigured Provider: Generates grounded fallback without throwing or halting', async () => {
    const unconfiguredService = new RecommendationService(new UnconfiguredAIProvider(), store);
    const recommendation = await unconfiguredService.generateRecommendation(mockIssue.id, { forceRefresh: true });

    assert.strictEqual(recommendation.isFallback, true);
    assert.strictEqual(recommendation.issueCode, 'ISS-101');
    assert.strictEqual(recommendation.measuredFacts.totalFrequency, 3);
    assert.ok(recommendation.recommendedActions.length > 0);
  });

  test('7. Batch High-Priority Generation: Generates recommendations for all Critical & High priority issues', async () => {
    // Add a secondary High priority issue
    const highIssue: IssueClusterData = {
      id: 'issue-high-202',
      issueCode: 'ISS-202',
      title: 'Scam Phishing SMS Impersonating Company Alerts',
      description: 'Fraudulent SMS messages attempting credential harvesting.',
      category: 'Fraud and Scam',
      status: 'backlog',
      priority: 'high',
      impactSummary: 'Severe trust and safety vector.',
      feedbackCount: 1,
      uniqueTextCount: 1,
      representativeExamples: [],
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 1, mixed: 0 },
      avgConfidence: 0.95,
      memberFeedbackIds: ['fb-001'],
      metadata: { priorityScore: 78, priorityTier: 'high' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save low-severity feedback record and analysis
    const fbLow = {
      id: 'fb-low',
      review: 'Table footer looks okay.',
      category: 'Product Feedback',
      contentHash: 'hash-low',
      source: 'Support',
      rowNumber: 4,
      batchId: 'b-01',
      importedAt: new Date().toISOString(),
      isSample: false,
      datasetType: 'genuine_import' as const,
    };
    const anLow = {
      id: 'an-low',
      feedbackId: 'fb-low',
      sentiment: 'positive' as const,
      sentimentScore: 0.8,
      urgency: 'low' as const,
      urgencyScore: 0.1,
      primaryTopic: 'Contrast',
      topics: [],
      keyPhrases: [],
      summary: 'Looks okay',
      severity: 1,
      confidenceScore: 0.9,
      modelVersion: 'test',
      promptVersion: 'test',
      analyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.saveRecordsChunk([fbLow]);
    await store.saveAnalysis(anLow);

    // Low priority issue (should NOT be included in high-priority batch)
    const lowIssue: IssueClusterData = {
      id: 'issue-low-303',
      issueCode: 'ISS-303',
      title: 'Dark Mode Contrast in Table Footer',
      description: 'Minor cosmetic styling.',
      category: 'Product Feedback',
      status: 'backlog',
      priority: 'low',
      impactSummary: 'Cosmetic enhancement.',
      feedbackCount: 1,
      uniqueTextCount: 1,
      representativeExamples: [],
      sentimentBreakdown: { positive: 1, neutral: 0, negative: 0, mixed: 0 },
      avgConfidence: 0.8,
      memberFeedbackIds: ['fb-low'],
      metadata: { priorityScore: 10, priorityTier: 'low' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.saveClustersAndLinks(
      {
        runId: 'test-run-2',
        totalFeedbackEvaluated: 5,
        uniqueTextsEvaluated: 5,
        clusteredFeedbackCount: 5,
        unmatchedFeedbackCount: 0,
        clustersCount: 3,
        clusters: [mockIssue, highIssue, lowIssue],
        unmatched: [],
        executionDurationMs: 10,
        parameters: {},
        createdAt: new Date().toISOString(),
      },
      []
    );

    const recs = await service.generateRecommendationsForHighPriority();

    // Must generate for ISS-101 (critical) and ISS-202 (high), but NOT ISS-303 (low)
    assert.strictEqual(recs.length, 2);
    const codes = recs.map((r) => r.issueCode);
    assert.ok(codes.includes('ISS-101'));
    assert.ok(codes.includes('ISS-202'));
    assert.ok(!codes.includes('ISS-303'));
  });
});
