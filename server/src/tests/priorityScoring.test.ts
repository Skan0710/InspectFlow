import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PriorityScoringService } from '../services/scoring/priorityScoringService.js';
import { FeedbackStore } from '../services/feedbackStore.js';
import type { IssueClusterData } from '../services/clustering/types.js';
import type { FeedbackAnalysisRecord } from '../services/analysis/types.js';
import type { RawFeedbackRecord } from '../types/import.js';

describe('InsightFlow Deterministic Issue-Priority Scoring Service', () => {
  const store = FeedbackStore.getInstance();
  let scoringService: PriorityScoringService;

  const createDummyIssue = (
    id: string,
    issueCode: string,
    title: string,
    feedbackCount: number,
    uniqueTextCount: number,
    memberFeedbackIds: string[],
    category = 'Product Feedback'
  ): IssueClusterData => ({
    id,
    issueCode,
    title,
    description: `Description for ${title}`,
    category,
    status: 'backlog',
    priority: 'medium',
    impactSummary: `Impact for ${title}`,
    feedbackCount,
    uniqueTextCount,
    representativeExamples: [],
    sentimentBreakdown: { positive: 0, neutral: 0, negative: 0, mixed: 0 },
    avgConfidence: 0.9,
    memberFeedbackIds,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const createDummyAnalysis = (
    feedbackId: string,
    severity: number,
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
  ): FeedbackAnalysisRecord => ({
    id: `analysis-${feedbackId}`,
    feedbackId,
    sentiment,
    sentimentScore: sentiment === 'negative' ? -0.8 : 0.8,
    urgency: severity >= 4 ? 'high' : 'normal',
    urgencyScore: 0.8,
    primaryTopic: 'Test Topic',
    topics: ['Test Topic'],
    keyPhrases: ['phrase'],
    summary: 'Summary',
    severity,
    confidenceScore: 0.95,
    modelVersion: 'gemini-1.5-flash',
    promptVersion: 'v1.0',
    analyzedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const createDummyRawRecord = (id: string, review: string): RawFeedbackRecord => ({
    id,
    review,
    category: 'Product Feedback',
    contentHash: `hash-${id}`,
    source: 'Support Ticket',
    rowNumber: 1,
    batchId: 'batch-test',
    importedAt: new Date().toISOString(),
    isSample: true,
    datasetType: 'demo_sample',
  });

  beforeEach(async () => {
    scoringService = new PriorityScoringService();
    await store.resetStore('all');
  });

  test('1. Boundary Values: verifies formula bounds and extreme component inputs', () => {
    // Priority = 100 * (0.40 * F + 0.35 * S + 0.25 * N)
    
    // Minimum boundary: F=0, S=0, N=0 -> Score = 0.0
    const minResult = scoringService.evaluateSingleScore(0.0, 0.0, 0.0);
    assert.equal(minResult.score, 0.0);
    assert.equal(minResult.tier, 'low');
    assert.equal(minResult.frequencyPoints, 0.0);
    assert.equal(minResult.severityPoints, 0.0);
    assert.equal(minResult.negativePoints, 0.0);

    // Maximum boundary: F=1, S=1, N=1 -> Score = 100.0
    const maxResult = scoringService.evaluateSingleScore(1.0, 1.0, 1.0);
    assert.equal(maxResult.score, 100.0);
    assert.equal(maxResult.tier, 'critical');
    assert.equal(maxResult.frequencyPoints, 40.0);
    assert.equal(maxResult.severityPoints, 35.0);
    assert.equal(maxResult.negativePoints, 25.0);

    // Midpoint boundary: F=0.5, S=0.5, N=0.5 -> Score = 50.0
    const midResult = scoringService.evaluateSingleScore(0.5, 0.5, 0.5);
    assert.equal(midResult.score, 50.0);
    assert.equal(midResult.tier, 'high');
    assert.equal(midResult.frequencyPoints, 20.0);
    assert.equal(midResult.severityPoints, 17.5);
    assert.equal(midResult.negativePoints, 12.5);

    // Clamping boundary: out-of-range inputs (<0 or >1) must be clamped safely
    const overResult = scoringService.evaluateSingleScore(1.5, 2.0, 10.0);
    assert.equal(overResult.score, 100.0, 'Should clamp to 100.0');

    const underResult = scoringService.evaluateSingleScore(-0.5, -2.0, -10.0);
    assert.equal(underResult.score, 0.0, 'Should clamp to 0.0');
  });

  test('2. Severity Normalization: maps 1-5 scale accurately to 0-1 range', () => {
    // S = (rawAvgSeverity - 1) / 4
    // Severity 1 -> S = 0.0 -> Points = 0.0
    const s1 = scoringService.evaluateSingleScore(0.0, (1 - 1) / 4, 0.0);
    assert.equal(s1.severityPoints, 0.0);

    // Severity 3 -> S = 0.5 -> Points = 17.5
    const s3 = scoringService.evaluateSingleScore(0.0, (3 - 1) / 4, 0.0);
    assert.equal(s3.severityPoints, 17.5);

    // Severity 5 -> S = 1.0 -> Points = 35.0
    const s5 = scoringService.evaluateSingleScore(0.0, (5 - 1) / 4, 0.0);
    assert.equal(s5.severityPoints, 35.0);
  });

  test('3. Missing Data & Empty Dataset: handles empty lists and unanalyzed records safely', () => {
    // Empty issues array
    const emptyResult = scoringService.scoreIssues([], new Map());
    assert.equal(emptyResult.issues.length, 0);
    assert.equal(emptyResult.summary.totalIssuesScored, 0);
    assert.equal(emptyResult.summary.averageScore, 0);
    assert.equal(emptyResult.summary.highestScoredIssue, null);
    assert.ok(emptyResult.summary.disclaimer.includes('heuristic'));

    // Issues with unanalyzed records (empty analysesMap)
    const issueWithoutAnalysis = createDummyIssue(
      'iss-empty',
      'ISS-001',
      'Unanalyzed Issue',
      10,
      10,
      ['fb-1', 'fb-2']
    );

    const result = scoringService.scoreIssues([issueWithoutAnalysis], new Map());
    assert.equal(result.issues.length, 1);
    const scored = result.issues[0];
    assert.ok(!Number.isNaN(scored.score), 'Score must not be NaN');
    assert.ok(scored.score >= 0 && scored.score <= 100);
    // When unanalyzed: F=1.0 (only issue), S=0.5 (default 3/5), N=0.0 (no negative)
    // Score = 100 * (0.40 * 1.0 + 0.35 * 0.5 + 0.25 * 0.0) = 40 + 17.5 = 57.5 [HIGH]
    assert.equal(scored.score, 57.5);
    assert.equal(scored.tier, 'high');
  });

  test('4. Duplicate Feedback Detection: exposes total mentions vs unique review text counts', () => {
    // 50 copies of identical review text
    const dupMemberIds = Array.from({ length: 50 }, (_, i) => `fb-dup-${i}`);
    const dupIssue = createDummyIssue(
      'iss-dup',
      'ISS-DUP',
      'Duplicate Phishing Reports',
      50,
      1, // Only 1 unique review text!
      dupMemberIds,
      'Fraud and Scam'
    );

    // 50 unique diverse reviews
    const uniqueMemberIds = Array.from({ length: 50 }, (_, i) => `fb-uniq-${i}`);
    const uniqueIssue = createDummyIssue(
      'iss-uniq',
      'ISS-UNIQ',
      'Diverse Checkout Glitches',
      50,
      50, // 50 unique texts!
      uniqueMemberIds,
      'Operational Issues'
    );

    const analysesMap = new Map();
    // Both have severity 4 and negative sentiment
    for (const id of [...dupMemberIds, ...uniqueMemberIds]) {
      analysesMap.set(id, createDummyAnalysis(id, 4, 'negative'));
    }

    const result = scoringService.scoreIssues([dupIssue, uniqueIssue], analysesMap);
    assert.equal(result.issues.length, 2);

    const scoredDup = result.issues.find((i) => i.issueId === 'iss-dup')!;
    const scoredUniq = result.issues.find((i) => i.issueId === 'iss-uniq')!;

    // Duplicate exposure metrics
    assert.equal(scoredDup.totalMentions, 50);
    assert.equal(scoredDup.uniqueReports, 1);
    assert.equal(scoredDup.breakdown.components.duplicateCount, 49);
    assert.equal(scoredDup.duplicateRatio, 0.98, 'Duplicate ratio should be 98%');

    assert.equal(scoredUniq.totalMentions, 50);
    assert.equal(scoredUniq.uniqueReports, 50);
    assert.equal(scoredUniq.breakdown.components.duplicateCount, 0);
    assert.equal(scoredUniq.duplicateRatio, 0.0, 'Duplicate ratio should be 0%');

    // Both get the same raw frequency F=1.0 since mentions=50, but duplicateRatio clearly exposes the duplicate nature
    assert.equal(scoredDup.score, scoredUniq.score);
  });

  test('5. Ranking Consistency: higher frequency, severity, and negativity strictly ranks higher', () => {
    const issueA = createDummyIssue('iss-a', 'ISS-001', 'Critical Outage', 100, 40, ['a1', 'a2']);
    const issueB = createDummyIssue('iss-b', 'ISS-002', 'Minor Typo', 10, 8, ['b1', 'b2']);

    const analysesMap = new Map();
    // Issue A: severity 5, negative sentiment
    analysesMap.set('a1', createDummyAnalysis('a1', 5, 'negative'));
    analysesMap.set('a2', createDummyAnalysis('a2', 5, 'negative'));

    // Issue B: severity 1, positive/neutral sentiment
    analysesMap.set('b1', createDummyAnalysis('b1', 1, 'neutral'));
    analysesMap.set('b2', createDummyAnalysis('b2', 1, 'positive'));

    const result = scoringService.scoreIssues([issueB, issueA], analysesMap);

    // Issue A must rank first despite being passed second
    assert.equal(result.issues[0].issueId, 'iss-a');
    assert.equal(result.issues[1].issueId, 'iss-b');

    // Issue A: F=1.0 (100/100), S=1.0 ((5-1)/4), N=1.0 (2/2) -> Score = 100.0 [CRITICAL]
    assert.equal(result.issues[0].score, 100.0);
    assert.equal(result.issues[0].tier, 'critical');

    // Issue B: F=0.1 (10/100), S=0.0 ((1-1)/4), N=0.0 (0/2) -> Score = 4.0 [LOW]
    assert.equal(result.issues[1].score, 4.0);
    assert.equal(result.issues[1].tier, 'low');
  });

  test('6. Configurable Priority Tiers: accurately respects custom tier thresholds', () => {
    const customThresholds = {
      critical: 85.0, // High bar for critical
      high: 65.0,
      medium: 45.0,
    };

    // A score of 75.0 is normally "critical" (under default 70 threshold),
    // but under custom 85 threshold it should be classified as "high"
    const score75 = scoringService.evaluateSingleScore(
      0.8, // 32 pts
      0.8, // 28 pts
      0.6, // 15 pts -> Total 75.0
      customThresholds
    );

    assert.equal(score75.score, 75.0);
    assert.equal(score75.tier, 'high', 'Should be High tier under custom 85 critical threshold');

    const score90 = scoringService.evaluateSingleScore(1.0, 1.0, 0.6, customThresholds);
    assert.equal(score90.score, 90.0);
    assert.equal(score90.tier, 'critical', '90.0 meets 85 critical threshold');
  });

  test('7. Recalculation on Analysis Change: updates score and tier when analysis is updated', async () => {
    const issue = createDummyIssue('iss-dynamic', 'ISS-DYN', 'Dynamic Feedback Ticket', 20, 10, ['fb-d1', 'fb-d2']);

    const rawRecords = [
      createDummyRawRecord('fb-d1', 'Checkout is slow'),
      createDummyRawRecord('fb-d2', 'Checkout has errors'),
    ];

    await store.saveRecordsChunk(rawRecords);
    await store.saveClustersAndLinks(
      {
        runId: 'run-1',
        totalFeedbackEvaluated: 2,
        uniqueTextsEvaluated: 2,
        clusteredFeedbackCount: 2,
        unmatchedFeedbackCount: 0,
        clustersCount: 1,
        clusters: [issue],
        unmatched: [],
        executionDurationMs: 10,
        parameters: {},
        createdAt: new Date().toISOString(),
      },
      []
    );

    // Initial state: analyses are mild (severity 2, neutral sentiment)
    const initialAnalysis1 = createDummyAnalysis('fb-d1', 2, 'neutral');
    const initialAnalysis2 = createDummyAnalysis('fb-d2', 2, 'neutral');
    await store.saveAnalysis(initialAnalysis1);
    await store.saveAnalysis(initialAnalysis2);

    const initialStored = store.getIssueById('iss-dynamic');
    assert.ok(initialStored);
    const initialScore = initialStored.metadata?.priorityScore as number;
    assert.ok(initialScore < 60, `Initial score should be moderate (got ${initialScore})`);

    // Now update analyses to emergency state (severity 5, negative sentiment)
    const updatedAnalysis1 = createDummyAnalysis('fb-d1', 5, 'negative');
    const updatedAnalysis2 = createDummyAnalysis('fb-d2', 5, 'negative');
    await store.saveAnalysis(updatedAnalysis1);
    await store.saveAnalysis(updatedAnalysis2);

    const recalculatedStored = store.getIssueById('iss-dynamic');
    assert.ok(recalculatedStored);
    const recalculatedScore = recalculatedStored.metadata?.priorityScore as number;
    
    // Score must have increased significantly to 100.0 [CRITICAL]
    assert.ok(
      recalculatedScore > initialScore,
      `Recalculated score (${recalculatedScore}) must be higher than initial (${initialScore})`
    );
    assert.equal(recalculatedStored.priority, 'critical');
    assert.equal(recalculatedScore, 100.0);
  });

  test('8. Disclaimer Invariant: ensures non-financial risk disclaimer is present in every result', () => {
    const issue = createDummyIssue('iss-disc', 'ISS-DISC', 'Disclaimer Check', 5, 5, ['fb-x']);
    const result = scoringService.scoreIssues([issue], new Map());

    // Check summary disclaimer
    assert.ok(
      result.summary.disclaimer.includes('heuristic') &&
      result.summary.disclaimer.includes('financial risk'),
      'Summary must explicitly state score is an operational heuristic and not a financial risk measure'
    );

    // Check issue breakdown disclaimer
    const issueBreakdown = result.issues[0].breakdown;
    assert.ok(
      issueBreakdown.disclaimer.includes('heuristic') &&
      issueBreakdown.disclaimer.includes('financial risk'),
      'Issue breakdown must carry the disclaimer'
    );
  });
});
