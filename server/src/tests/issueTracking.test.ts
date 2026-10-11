import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FeedbackStore } from '../services/feedbackStore.js';
import { AnalyticsService } from '../services/analytics/analyticsService.js';
import type { IssueClusterData } from '../services/clustering/types.js';
import type { RawFeedbackRecord } from '../types/import.js';
import type { FeedbackAnalysisRecord } from '../services/analysis/types.js';

describe('InsightFlow Persistent Issue Tracking & Action Center', () => {
  const store = FeedbackStore.getInstance();
  const analyticsService = new AnalyticsService();

  const mockFeedback: RawFeedbackRecord[] = [
    {
      id: 'fb-act-1',
      review: 'Withdrawal timeout during SMS 2FA verification.',
      category: 'Operational Issues',
      contentHash: 'hash-act-1',
      source: 'Support',
      rowNumber: 1,
      batchId: 'b-01',
      importedAt: new Date().toISOString(),
      isSample: false,
      datasetType: 'genuine_import',
    },
    {
      id: 'fb-act-2',
      review: 'Cannot export CSV report from workspace dashboard.',
      category: 'Product Feedback',
      contentHash: 'hash-act-2',
      source: 'Support',
      rowNumber: 2,
      batchId: 'b-01',
      importedAt: new Date().toISOString(),
      isSample: false,
      datasetType: 'genuine_import',
    },
  ];

  const mockAnalyses: FeedbackAnalysisRecord[] = [
    {
      id: 'an-act-1',
      feedbackId: 'fb-act-1',
      sentiment: 'negative',
      sentimentScore: -0.9,
      urgency: 'critical',
      urgencyScore: 0.95,
      primaryTopic: 'Withdrawal Timeout',
      topics: ['SMS', 'Checkout'],
      keyPhrases: ['withdrawal timeout', '2FA verification'],
      summary: 'SMS verification times out.',
      severity: 5,
      confidenceScore: 0.95,
      modelVersion: 'test',
      promptVersion: 'test',
      analyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'an-act-2',
      feedbackId: 'fb-act-2',
      sentiment: 'neutral',
      sentimentScore: 0.0,
      urgency: 'high',
      urgencyScore: 0.5,
      primaryTopic: 'Export Error',
      topics: ['Export', 'CSV'],
      keyPhrases: ['cannot export CSV'],
      summary: 'CSV export needs formatting adjust.',
      severity: 3,
      confidenceScore: 0.9,
      modelVersion: 'test',
      promptVersion: 'test',
      analyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const getMockIssues = (): [IssueClusterData, IssueClusterData] => [
    {
      id: 'issue-act-101',
      issueCode: 'ISS-101',
      title: 'SMS 2FA Gateway Timeouts During Withdrawal',
      description: 'Critical payment friction blocking user withdrawals.',
      category: 'Operational Issues',
      status: 'open',
      priority: 'critical',
      impactSummary: 'Blocks fund withdrawals.',
      feedbackCount: 1,
      uniqueTextCount: 1,
      representativeExamples: [],
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 1, mixed: 0 },
      avgConfidence: 0.95,
      memberFeedbackIds: ['fb-act-1'],
      isSaved: false,
      notes: [],
      statusHistory: [],
      metadata: { priorityScore: 92, priorityTier: 'critical' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'issue-act-102',
      issueCode: 'ISS-102',
      title: 'CSV Data Export Generation Failure',
      description: 'Reporting export generates 500 error.',
      category: 'Product Feedback',
      status: 'open',
      priority: 'high',
      impactSummary: 'Enterprise reporting friction.',
      feedbackCount: 1,
      uniqueTextCount: 1,
      representativeExamples: [],
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 1, mixed: 0 },
      avgConfidence: 0.9,
      memberFeedbackIds: ['fb-act-2'],
      isSaved: false,
      notes: [],
      statusHistory: [],
      metadata: { priorityScore: 74, priorityTier: 'high' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(async () => {
    await store.resetStore('all');
    await store.saveRecordsChunk(mockFeedback);
    for (const an of mockAnalyses) {
      await store.saveAnalysis(an);
    }
    const [iss1, iss2] = getMockIssues();
    await store.saveClustersAndLinks(
      {
        runId: 'act-run-1',
        totalFeedbackEvaluated: 2,
        uniqueTextsEvaluated: 2,
        clusteredFeedbackCount: 2,
        unmatchedFeedbackCount: 0,
        clustersCount: 2,
        clusters: [iss1, iss2],
        unmatched: [],
        executionDurationMs: 10,
        parameters: {},
        createdAt: new Date().toISOString(),
      },
      []
    );
  });

  test('1. Status Transitions: Updates status, records transition history, and maintains status update timestamp', async () => {
    // Initial status is 'open'
    const initial = store.getIssueById('issue-act-101');
    assert.ok(initial);
    assert.strictEqual(initial.status, 'open');

    // Move to 'in_progress'
    const inProgress = await store.updateIssueStatus('issue-act-101', 'in_progress', {
      changedBy: 'Sarah Lin',
      reason: 'Assigned to sprint backlog for immediate patch',
    });
    assert.strictEqual(inProgress.status, 'in_progress');
    assert.ok(inProgress.statusUpdatedAt);
    assert.ok(inProgress.statusHistory);
    assert.strictEqual(inProgress.statusHistory[0].fromStatus, 'open');
    assert.strictEqual(inProgress.statusHistory[0].toStatus, 'in_progress');
    assert.strictEqual(inProgress.statusHistory[0].changedBy, 'Sarah Lin');

    // Move to 'resolved'
    const resolved = await store.updateIssueStatus('issue-act-101', 'resolved', {
      changedBy: 'Sarah Lin',
      note: 'Patched gateway adapter and verified in staging',
    });
    assert.strictEqual(resolved.status, 'resolved');
    assert.ok(resolved.statusHistory);
    assert.strictEqual(resolved.statusHistory[0].fromStatus, 'in_progress');
    assert.strictEqual(resolved.statusHistory[0].toStatus, 'resolved');
    // Internal note should be appended as well
    assert.ok(resolved.notes);
    assert.ok(resolved.notes.some((n) => n.content.includes('Patched gateway adapter')));

    // Move to 'dismissed'
    const dismissed = await store.updateIssueStatus('issue-act-101', 'dismissed', {
      changedBy: 'Admin',
      reason: 'Root cause superseded by v2 auth service',
    });
    assert.strictEqual(dismissed.status, 'dismissed');
  });

  test('2. Owner Assignment: Assigns and reassigns owners accurately', async () => {
    const updated = await store.updateIssueAssignee('issue-act-101', 'Marcus Vance', 'marcus@insightflow.io');
    assert.strictEqual(updated.assignee, 'Marcus Vance');
    assert.strictEqual(updated.assigneeEmail, 'marcus@insightflow.io');

    // Unassign
    const unassigned = await store.updateIssueAssignee('issue-act-101', null);
    assert.strictEqual(unassigned.assignee, undefined);
  });

  test('3. Internal Notes: Adds notes with author and preserves chronological ordering', async () => {
    await store.addIssueNote('issue-act-101', {
      author: 'Devon Miles',
      content: 'Identified database connection pool exhaustion as contributing factor.',
    });

    await store.addIssueNote('issue-act-101', {
      author: 'Elena Rostova',
      content: 'Monitoring alert thresholds adjusted to 200ms.',
    });

    const issue = store.getIssueById('issue-act-101');
    assert.ok(issue);
    assert.ok(issue.notes);
    assert.strictEqual(issue.notes.length, 2);
    // Most recent note is first
    assert.ok(issue.notes[0].content.includes('Monitoring alert'));
    assert.strictEqual(issue.notes[0].author, 'Elena Rostova');
    assert.ok(issue.notes[1].content.includes('Identified database'));
  });

  test('4. Saved / Bookmark State: Toggles and sets saved issues', async () => {
    const issueBefore = store.getIssueById('issue-act-101');
    assert.strictEqual(issueBefore?.isSaved, false);

    // Toggle to saved
    const saved = await store.toggleIssueSaved('issue-act-101');
    assert.strictEqual(saved.isSaved, true);

    // Filter by savedOnly
    const savedList = store.getAllIssues({ savedOnly: true });
    assert.strictEqual(savedList.length, 1);
    assert.strictEqual(savedList[0].id, 'issue-act-101');

    // Toggle back
    const unsaved = await store.toggleIssueSaved('issue-act-101');
    assert.strictEqual(unsaved.isSaved, false);
    assert.strictEqual(store.getAllIssues({ savedOnly: true }).length, 0);
  });

  test('5. Invalid Requests: Rejects bad status enums, empty notes, and non-existent IDs', async () => {
    // Bad status
    await assert.rejects(
      async () => {
        await store.updateIssueStatus('issue-act-101', 'nonexistent_status' as any);
      },
      /Invalid issue status/
    );

    // Non-existent issue ID
    await assert.rejects(
      async () => {
        await store.updateIssueStatus('invalid-fake-id', 'in_progress');
      },
      /not found/
    );

    // Empty note content
    await assert.rejects(
      async () => {
        await store.addIssueNote('issue-act-101', { content: '   ' });
      },
      /Note content cannot be empty/
    );
  });

  test('6. Metrics Invariant: Resolved and dismissed issues correctly affect open-issue metrics', async () => {
    // Initially, both issues are open
    const initialMetrics = await analyticsService.getMetrics();
    assert.strictEqual(initialMetrics.priorityRankings.openIssuesCount, 2);
    assert.strictEqual(initialMetrics.priorityRankings.statusSummary?.open, 2);
    assert.strictEqual(initialMetrics.priorityRankings.statusSummary?.resolved, 0);
    assert.strictEqual(initialMetrics.priorityRankings.tierSummary.critical, 1);
    assert.strictEqual(initialMetrics.priorityRankings.tierSummary.high, 1);

    // Resolve the critical issue
    await store.updateIssueStatus('issue-act-101', 'resolved');

    const resolvedMetrics = await analyticsService.getMetrics();
    // Open issues count must decrease to 1
    assert.strictEqual(resolvedMetrics.priorityRankings.openIssuesCount, 1);
    assert.strictEqual(resolvedMetrics.priorityRankings.statusSummary?.resolved, 1);
    assert.strictEqual(resolvedMetrics.priorityRankings.statusSummary?.open, 1);
    // Open critical issues count drops to 0 because the critical issue is now resolved
    assert.strictEqual(resolvedMetrics.priorityRankings.tierSummary.critical, 0);
    assert.strictEqual(resolvedMetrics.priorityRankings.tierSummary.high, 1);

    // Dismiss the high issue
    await store.updateIssueStatus('issue-act-102', 'dismissed');

    const dismissedMetrics = await analyticsService.getMetrics();
    // Open issues count drops to 0
    assert.strictEqual(dismissedMetrics.priorityRankings.openIssuesCount, 0);
    assert.strictEqual(dismissedMetrics.priorityRankings.statusSummary?.dismissed, 1);
    assert.strictEqual(dismissedMetrics.priorityRankings.tierSummary.critical, 0);
    assert.strictEqual(dismissedMetrics.priorityRankings.tierSummary.high, 0);
  });

  test('7. Complete Issue Detail: Returns comprehensive breakdown, citations, notes, and status timestamps', () => {
    const detail = store.getIssueDetail('issue-act-101');
    assert.ok(detail);
    assert.strictEqual(detail.issue.id, 'issue-act-101');
    assert.strictEqual(detail.frequency, 1);
    assert.strictEqual(detail.priorityTier, 'critical');
    assert.ok(detail.members);
    assert.strictEqual(detail.members.length, 1);
    assert.strictEqual(detail.members[0].feedback.id, 'fb-act-1');
    assert.ok(detail.statusUpdatedAt);
    assert.ok(Array.isArray(detail.notes));
    assert.ok(Array.isArray(detail.statusHistory));
  });
});
