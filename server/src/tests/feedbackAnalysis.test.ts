import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FeedbackAnalyzer } from '../services/analysis/feedbackAnalyzer.js';
import { PROMPT_VERSION } from '../services/analysis/prompt.js';
import {
  validateFeedbackAnalysisOutput,
  calculateSentimentScore,
  calculateUrgency,
} from '../services/analysis/validator.js';
import { TestAIProvider } from '../services/ai/providers/testProvider.js';
import { FeedbackStore } from '../services/feedbackStore.js';
import type { RawFeedbackRecord } from '../types/import.js';

describe('InsightFlow Structured Customer Feedback Analysis', () => {
  const store = FeedbackStore.getInstance();
  let testProvider: TestAIProvider;
  let analyzer: FeedbackAnalyzer;

  beforeEach(async () => {
    testProvider = new TestAIProvider();
    analyzer = new FeedbackAnalyzer(testProvider, store);
    await store.resetStore('all');
  });

  test('1. Positive Review: assigns positive sentiment with grounded evidence and low severity', async () => {
    const reviewText = 'The dashboard loads in under a second now, incredible performance improvement!';
    testProvider.enqueueResponse({
      sentiment: 'positive',
      primary_topic: 'Dashboard Performance Improvement',
      secondary_topics: ['Page Load Speed'],
      severity: 1,
      confidence: 0.95,
      explanation: 'Customer enthusiastically commends the sub-second dashboard loading speed.',
      evidence_phrases: ['loads in under a second now', 'incredible performance improvement'],
    });

    const result = await analyzer.analyzeReview({
      feedbackId: 'fb-pos-1',
      review: reviewText,
      category: 'Product Feedback',
    });

    assert.strictEqual(result.sentiment, 'positive');
    assert.ok(result.sentimentScore > 0.8);
    assert.strictEqual(result.severity, 1);
    assert.strictEqual(result.urgency, 'low');
    assert.strictEqual(result.confidence, 0.95);
    assert.strictEqual(result.primaryTopic, 'Dashboard Performance Improvement');
    assert.deepStrictEqual(result.secondaryTopics, ['Page Load Speed']);
    assert.ok(result.evidencePhrases.includes('loads in under a second now'));
    assert.strictEqual(result.promptVersion, PROMPT_VERSION);
  });

  test('2. Negative Review: assigns negative sentiment, high severity, and extracts exact failure phrases', async () => {
    const reviewText = 'Payment failed three times and my card was still debited $150. Nobody is answering my tickets.';
    testProvider.enqueueResponse({
      sentiment: 'negative',
      primary_topic: 'Failed Payment & Double Charge',
      secondary_topics: ['Customer Support Unresponsive'],
      severity: 4,
      confidence: 0.92,
      explanation: 'Customer experienced repeated payment failures, unauthorized debit, and lack of ticket responses.',
      evidence_phrases: ['Payment failed three times', 'card was still debited $150', 'Nobody is answering my tickets'],
    });

    const result = await analyzer.analyzeReview({
      feedbackId: 'fb-neg-1',
      review: reviewText,
      category: 'Customer Service',
    });

    assert.strictEqual(result.sentiment, 'negative');
    assert.ok(result.sentimentScore < -0.8);
    assert.strictEqual(result.severity, 4);
    assert.strictEqual(result.urgency, 'high');
    assert.strictEqual(result.confidence, 0.92);
    assert.ok(result.evidencePhrases.includes('Payment failed three times'));
  });

  test('3. Neutral Review: handles informational updates without artificial sentiment bias', async () => {
    const reviewText = 'Received scheduled maintenance notification for Sunday between 2:00 AM and 4:00 AM UTC.';
    testProvider.enqueueResponse({
      sentiment: 'neutral',
      primary_topic: 'Maintenance Window Notification',
      secondary_topics: [],
      severity: 1,
      confidence: 0.88,
      explanation: 'Customer simply relays receipt of a routine scheduled maintenance notification.',
      evidence_phrases: ['scheduled maintenance notification for Sunday'],
    });

    const result = await analyzer.analyzeReview({
      feedbackId: 'fb-neut-1',
      review: reviewText,
      category: 'Operational Issues',
    });

    assert.strictEqual(result.sentiment, 'neutral');
    assert.strictEqual(result.sentimentScore, 0.0);
    assert.strictEqual(result.severity, 1);
    assert.strictEqual(result.urgency, 'low');
    assert.strictEqual(result.primaryTopic, 'Maintenance Window Notification');
  });

  test('4. Mixed Sentiment Review: recognizes simultaneous praise and critical defects', async () => {
    const reviewText = 'The visual redesign is sleek and beautiful, but the export feature takes 15 minutes and frequently crashes.';
    testProvider.enqueueResponse({
      sentiment: 'mixed',
      primary_topic: 'Export Latency & Crash Defects',
      secondary_topics: ['UI Visual Design'],
      severity: 3,
      confidence: 0.90,
      explanation: 'Customer praises the new UI aesthetics but criticizes long export times and crash instability.',
      evidence_phrases: [
        'visual redesign is sleek and beautiful',
        'export feature takes 15 minutes and frequently crashes',
      ],
    });

    const result = await analyzer.analyzeReview({
      feedbackId: 'fb-mixed-1',
      review: reviewText,
      category: 'Product Feedback',
    });

    assert.strictEqual(result.sentiment, 'mixed');
    assert.strictEqual(result.severity, 3);
    assert.strictEqual(result.urgency, 'normal');
    assert.ok(result.secondaryTopics.includes('UI Visual Design'));
    assert.ok(result.explanation.includes('praises') && result.explanation.includes('criticizes'));
  });

  test('5. Ambiguous Review: supports uncertainty with lowered confidence score', async () => {
    const reviewText = 'I accessed the platform yesterday afternoon.';
    testProvider.enqueueResponse({
      sentiment: 'neutral',
      primary_topic: 'General Access Inquiry',
      secondary_topics: [],
      severity: 1,
      confidence: 0.50, // Reflects ambiguity and uncertainty
      explanation: 'Vague statement indicating login without expressing any positive or negative experience.',
      evidence_phrases: ['accessed the platform yesterday afternoon'],
    });

    const result = await analyzer.analyzeReview({
      feedbackId: 'fb-ambig-1',
      review: reviewText,
      category: 'Product Feedback',
    });

    assert.strictEqual(result.sentiment, 'neutral');
    assert.ok(result.confidence <= 0.65, 'Confidence should reflect uncertainty for ambiguous statements');
    assert.strictEqual(result.severity, 1);
  });

  test('6. Scam Complaint: flags severity 5 critical emergency for active fraud attempts', async () => {
    const reviewText = 'Someone impersonated account support asking for my OTP code. This is an active phishing scam!';
    testProvider.enqueueResponse({
      sentiment: 'negative',
      primary_topic: 'Impersonation & Phishing Attempt',
      secondary_topics: ['OTP Security Compromise'],
      severity: 5,
      confidence: 0.98,
      explanation: 'Severe report of an attacker attempting to harvest customer OTP credentials.',
      evidence_phrases: ['impersonated account support', 'asking for my OTP code', 'active phishing scam'],
    });

    const result = await analyzer.analyzeReview({
      feedbackId: 'fb-scam-1',
      review: reviewText,
      category: 'Fraud and Scam',
    });

    assert.strictEqual(result.sentiment, 'negative');
    assert.strictEqual(result.severity, 5);
    assert.strictEqual(result.urgency, 'critical');
    assert.strictEqual(result.urgencyScore, 1.0);
  });

  test('7. Category as Context, NOT Sentiment: praise in "Fraud and Scam" category is classified as POSITIVE', async () => {
    const reviewText = 'Huge thanks to the security team! They flagged the fraudulent transaction immediately and returned my money within an hour.';
    testProvider.enqueueResponse({
      sentiment: 'positive',
      primary_topic: 'Rapid Fraud Interception & Reimbursement',
      secondary_topics: ['Customer Satisfaction'],
      severity: 1,
      confidence: 0.95,
      explanation: 'Customer commends fraud protection for quickly detecting an unauthorized transaction and issuing a refund.',
      evidence_phrases: ['Huge thanks to the security team', 'returned my money within an hour'],
    });

    const result = await analyzer.analyzeReview({
      feedbackId: 'fb-scam-pos',
      review: reviewText,
      category: 'Fraud and Scam', // Category is Fraud and Scam, but review is POSITIVE
    });

    assert.strictEqual(result.sentiment, 'positive');
    assert.strictEqual(result.severity, 1);
    assert.ok(result.sentimentScore > 0);
  });

  test('8. Grounding Invariant: never infers dates or customer identities absent from source', async () => {
    const reviewText = 'My account was locked without any notification.';
    testProvider.enqueueResponse({
      sentiment: 'negative',
      primary_topic: 'Unexpected Account Lockout',
      secondary_topics: [],
      severity: 4,
      confidence: 0.90,
      explanation: 'Customer states their account was locked without prior notification.',
      evidence_phrases: ['account was locked without any notification'],
    });

    const result = await analyzer.analyzeReview({
      feedbackId: 'fb-lockout',
      review: reviewText,
      category: 'Customer Service',
    });

    // Verification: explanation and evidence phrases do not hallucinate dates or customer names
    assert.ok(!result.explanation.includes('2024') && !result.explanation.includes('2025'));
    assert.ok(!result.explanation.includes('John') && !result.explanation.includes('Alice'));
    assert.ok(result.evidencePhrases.every((p) => reviewText.toLowerCase().includes(p.toLowerCase())));
  });

  test('9. Strict Schema Validation Rejection: rejects invalid severity, out-of-bounds confidence, and bad enums', () => {
    const review = 'Good service';

    // Invalid severity (must be integer 1 to 5)
    const badSeverityRes = validateFeedbackAnalysisOutput(
      {
        sentiment: 'positive',
        primary_topic: 'Service',
        severity: 6, // out of range
        confidence: 0.9,
        explanation: 'Good service provided',
        evidence_phrases: ['Good service'],
      },
      { originalReview: review }
    );
    assert.strictEqual(badSeverityRes.success, false);
    assert.ok(badSeverityRes.errors?.some((e) => e.includes('severity')));

    // Non-integer severity
    const floatSeverityRes = validateFeedbackAnalysisOutput(
      {
        sentiment: 'positive',
        primary_topic: 'Service',
        severity: 3.5, // not an integer
        confidence: 0.9,
        explanation: 'Good service provided',
        evidence_phrases: ['Good service'],
      },
      { originalReview: review }
    );
    assert.strictEqual(floatSeverityRes.success, false);

    // Invalid confidence (must be 0.0 to 1.0)
    const badConfRes = validateFeedbackAnalysisOutput(
      {
        sentiment: 'positive',
        primary_topic: 'Service',
        severity: 2,
        confidence: 1.5, // > 1.0
        explanation: 'Good service provided',
        evidence_phrases: ['Good service'],
      },
      { originalReview: review }
    );
    assert.strictEqual(badConfRes.success, false);
    assert.ok(badConfRes.errors?.some((e) => e.includes('confidence')));

    // Invalid sentiment enum
    const badSentimentRes = validateFeedbackAnalysisOutput(
      {
        sentiment: 'ecstatic', // not in enum
        primary_topic: 'Service',
        severity: 1,
        confidence: 0.9,
        explanation: 'Good service provided',
        evidence_phrases: ['Good service'],
      },
      { originalReview: review }
    );
    assert.strictEqual(badSentimentRes.success, false);
    assert.ok(badSentimentRes.errors?.some((e) => e.includes('sentiment')));
  });

  test('10. Store Results in feedback_analysis without modifying original feedback record', async () => {
    const originalRecord: RawFeedbackRecord = {
      id: 'fb-target-001',
      review: 'Great interface but slow database queries on reports.',
      category: 'Product Feedback',
      contentHash: 'hash-001',
      source: 'CSV Import',
      rowNumber: 1,
      batchId: 'batch-001',
      importedAt: '2026-03-01T10:00:00.000Z',
      isSample: false,
      datasetType: 'genuine_import',
    };

    // Save initial feedback into store
    await store.saveRecordsChunk([originalRecord]);

    // Snapshot original record
    const snapshotBefore = JSON.stringify(store.getRecordById('fb-target-001'));

    testProvider.enqueueResponse({
      sentiment: 'mixed',
      primary_topic: 'Slow Database Queries on Reports',
      secondary_topics: ['Great Interface'],
      severity: 3,
      confidence: 0.92,
      explanation: 'Customer praises the UI interface while reporting slow database queries on reports.',
      evidence_phrases: ['Great interface', 'slow database queries on reports'],
    });

    // Analyze and store
    const storedAnalysis = await analyzer.analyzeAndStore({
      feedbackId: originalRecord.id,
      review: originalRecord.review,
      category: originalRecord.category,
    });

    // Invariant 1: The original feedback record MUST be completely identical (unmodified)
    const snapshotAfter = JSON.stringify(store.getRecordById('fb-target-001'));
    assert.strictEqual(snapshotBefore, snapshotAfter, 'Original feedback record must never be modified by analysis');

    // Invariant 2: Result is stored in feedback_analysis and retrievable by feedbackId
    const retrievedAnalysis = store.getAnalysisByFeedbackId('fb-target-001');
    assert.ok(retrievedAnalysis !== null);
    assert.strictEqual(retrievedAnalysis.id, storedAnalysis.id);
    assert.strictEqual(retrievedAnalysis.sentiment, 'mixed');
    assert.strictEqual(retrievedAnalysis.primaryTopic, 'Slow Database Queries on Reports');
    assert.strictEqual(retrievedAnalysis.severity, 3);
    assert.strictEqual(retrievedAnalysis.urgency, 'normal');
    assert.ok(retrievedAnalysis.modelVersion.includes(testProvider.model));
    assert.strictEqual(retrievedAnalysis.promptVersion, PROMPT_VERSION);
  });
});
