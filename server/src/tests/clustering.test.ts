import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IssueClusteringService } from '../services/clustering/clusteringService.js';
import { TfidfVectorEngine } from '../services/clustering/vectorEngine.js';
import { FeedbackStore } from '../services/feedbackStore.js';
import type { RawFeedbackRecord } from '../types/import.js';
import { seedSampleDataset } from '../db/seed.js';

describe('InsightFlow Issue Clustering Service', () => {
  const store = FeedbackStore.getInstance();
  let clusteringService: IssueClusteringService;

  const createDummyRecord = (
    id: string,
    review: string,
    category = 'Product Feedback',
    contentHash?: string
  ): RawFeedbackRecord => ({
    id,
    review,
    category,
    contentHash: contentHash || `hash-${id}`,
    source: 'Support Portal',
    rowNumber: 1,
    batchId: 'batch-clustering-test',
    importedAt: new Date().toISOString(),
    isSample: true,
    datasetType: 'demo_sample',
  });

  beforeEach(async () => {
    clusteringService = new IssueClusteringService(new TfidfVectorEngine());
    await store.resetStore('all');
  });

  test('1. Duplicate Text Invariant: repeated copies of identical text form 1 cluster, not multiple independent clusters', async () => {
    // 10 identical reviews with the same text
    const identicalText = 'Payment failed during checkout and credit card was debited twice without confirmation';
    const records: RawFeedbackRecord[] = Array.from({ length: 10 }, (_, i) =>
      createDummyRecord(`rec-dup-${i}`, identicalText, 'Operational Issues', 'hash-dup')
    );

    const result = await clusteringService.clusterFeedback(records, new Map(), {
      minClusterSize: 2,
      similarityThreshold: 0.35,
    });

    assert.equal(result.totalFeedbackEvaluated, 10, 'Should evaluate all 10 feedback records');
    assert.equal(result.uniqueTextsEvaluated, 1, 'Should recognize exactly 1 unique text');
    assert.equal(result.clustersCount, 1, 'MUST form exactly 1 cluster instead of 10 independent clusters');
    assert.equal(result.clusteredFeedbackCount, 10, 'All 10 copies must be members of the cluster');
    assert.equal(result.unmatchedFeedbackCount, 0, 'Zero unmatched reviews');

    const cluster = result.clusters[0];
    assert.equal(cluster.feedbackCount, 10);
    assert.equal(cluster.uniqueTextCount, 1);
    assert.equal(cluster.memberFeedbackIds.length, 10);
    // Every record ID must be in the cluster
    for (let i = 0; i < 10; i++) {
      assert.ok(cluster.memberFeedbackIds.includes(`rec-dup-${i}`));
    }
  });

  test('2. Similar Wording: differently phrased reviews on the same underlying issue group into the same cluster', async () => {
    const records: RawFeedbackRecord[] = [
      createDummyRecord('rec-s1', 'The mobile app crashes every time I tap on the account settings screen', 'Product Feedback'),
      createDummyRecord('rec-s2', 'Whenever I click account settings the application crashes unexpectedly', 'Product Feedback'),
      createDummyRecord('rec-s3', 'App crash happens immediately upon opening account settings page', 'Product Feedback'),
    ];

    const result = await clusteringService.clusterFeedback(records, new Map(), {
      minClusterSize: 2,
      similarityThreshold: 0.30,
    });

    assert.equal(result.clustersCount, 1, 'Should group all 3 similar wording reviews into 1 issue cluster');
    assert.equal(result.clusteredFeedbackCount, 3);
    assert.equal(result.unmatchedFeedbackCount, 0);

    const cluster = result.clusters[0];
    assert.match(cluster.title.toLowerCase(), /settings|crash|account/, 'Title should reflect common salient terms');
    assert.equal(cluster.category, 'Product Feedback', 'Category should remain Product Feedback');
  });

  test('3. Unrelated Reviews: distinct disparate topics do not artificially merge into the same cluster', async () => {
    const records: RawFeedbackRecord[] = [
      // Cluster A topic: Delivery delays (2 items)
      createDummyRecord('rec-u1', 'Delivery driver was 5 hours late and courier damaged package exterior', 'Operational Issues'),
      createDummyRecord('rec-u2', 'Late delivery by courier driver and damaged shipment box', 'Operational Issues'),

      // Cluster B topic: Phishing security scams (2 items)
      createDummyRecord('rec-u3', 'Received fraudulent phishing email demanding account password and security pin', 'Fraud and Scam'),
      createDummyRecord('rec-u4', 'Fake phishing email asking for login password and two factor verification', 'Fraud and Scam'),
    ];

    const result = await clusteringService.clusterFeedback(records, new Map(), {
      minClusterSize: 2,
      similarityThreshold: 0.35,
    });

    assert.equal(result.clustersCount, 2, 'Should create 2 separate distinct clusters for unrelated topics');
    
    // One cluster should be Operational Issues, the other Fraud and Scam
    const categories = result.clusters.map((c) => c.category).sort();
    assert.deepEqual(categories, ['Fraud and Scam', 'Operational Issues']);

    // Ensure member IDs are properly partitioned
    const opCluster = result.clusters.find((c) => c.category === 'Operational Issues')!;
    const fraudCluster = result.clusters.find((c) => c.category === 'Fraud and Scam')!;

    assert.ok(opCluster.memberFeedbackIds.includes('rec-u1'));
    assert.ok(opCluster.memberFeedbackIds.includes('rec-u2'));
    assert.ok(!opCluster.memberFeedbackIds.includes('rec-u3'));

    assert.ok(fraudCluster.memberFeedbackIds.includes('rec-u3'));
    assert.ok(fraudCluster.memberFeedbackIds.includes('rec-u4'));
    assert.ok(!fraudCluster.memberFeedbackIds.includes('rec-u1'));
  });

  test('4. Support Unmatched Reviews and Low-Confidence Outliers without forcing false associations', async () => {
    const records: RawFeedbackRecord[] = [
      // 2 reviews on login issues
      createDummyRecord('rec-m1', 'Unable to login with two factor SMS authentication code', 'Customer Service'),
      createDummyRecord('rec-m2', 'Two factor authentication SMS code login failing repeatedly', 'Customer Service'),

      // 1 isolated outlier review that is completely unique
      createDummyRecord('rec-outlier', 'The green color theme of the receipt pdf is pleasing', 'Product Feedback'),
    ];

    const result = await clusteringService.clusterFeedback(records, new Map(), {
      minClusterSize: 2,
      similarityThreshold: 0.35,
    });

    assert.equal(result.clustersCount, 1, 'Only the 2 similar reviews form a cluster');
    assert.equal(result.clusteredFeedbackCount, 2);
    assert.equal(result.unmatchedFeedbackCount, 1, 'Outlier should be isolated into unmatched');

    const unmatched = result.unmatched[0];
    assert.equal(unmatched.feedbackId, 'rec-outlier');
    assert.ok(
      unmatched.reason === 'singleton_outlier' || unmatched.reason === 'below_similarity_threshold',
      'Should document outlier reason'
    );
  });

  test('5. Small Datasets: runs safely and gracefully for 0, 1, 2, and 3 reviews', async () => {
    // 0 reviews
    const emptyResult = await clusteringService.clusterFeedback([], new Map());
    assert.equal(emptyResult.clustersCount, 0);
    assert.equal(emptyResult.totalFeedbackEvaluated, 0);
    assert.equal(emptyResult.unmatchedFeedbackCount, 0);

    // 1 review
    const singleRecord = [createDummyRecord('rec-single', 'Solo customer thought', 'Customer Service')];
    const singleResult = await clusteringService.clusterFeedback(singleRecord, new Map(), {
      minClusterSize: 2,
    });
    assert.equal(singleResult.clustersCount, 0, 'Single review cannot meet minClusterSize 2');
    assert.equal(singleResult.unmatchedFeedbackCount, 1, 'Marked as unmatched singleton');

    // 2 reviews (different topics)
    const twoDifferent = [
      createDummyRecord('rec-a', 'Invoice export pdf issue', 'Product Feedback'),
      createDummyRecord('rec-b', 'Rude phone support agent', 'Customer Service'),
    ];
    const twoResult = await clusteringService.clusterFeedback(twoDifferent, new Map(), {
      minClusterSize: 2,
    });
    assert.equal(twoResult.clustersCount, 0, 'Two completely different items should not merge');
    assert.equal(twoResult.unmatchedFeedbackCount, 2);

    // 2 reviews (similar topic)
    const twoSimilar = [
      createDummyRecord('rec-x', 'Invoice export pdf calculation error', 'Product Feedback'),
      createDummyRecord('rec-y', 'PDF invoice export totals calculation wrong', 'Product Feedback'),
    ];
    const twoSimilarResult = await clusteringService.clusterFeedback(twoSimilar, new Map(), {
      minClusterSize: 2,
      similarityThreshold: 0.25,
    });
    assert.equal(twoSimilarResult.clustersCount, 1, 'Two similar items form 1 cluster');
    assert.equal(twoSimilarResult.clusteredFeedbackCount, 2);
  });

  test('6. Category Separation Invariant: preserves supplied category separate from AI issue topic title', async () => {
    const records: RawFeedbackRecord[] = [
      createDummyRecord('rec-cat1', 'Spam call pretending to be fraud department asking for credit card CVV', 'Fraud and Scam'),
      createDummyRecord('rec-cat2', 'Fraud department impersonation phone scam requesting credit card CVV', 'Fraud and Scam'),
    ];

    const analysesMap = new Map();
    analysesMap.set('rec-cat1', {
      feedbackId: 'rec-cat1',
      primaryTopic: 'Fraud Department Impersonation',
      severity: 5,
      confidenceScore: 0.95,
      sentiment: 'negative',
    });

    const result = await clusteringService.clusterFeedback(records, analysesMap, {
      minClusterSize: 2,
    });

    assert.equal(result.clustersCount, 1);
    const cluster = result.clusters[0];

    // Category MUST be the supplied category
    assert.equal(cluster.category, 'Fraud and Scam');

    // Title MUST be the concise human-readable issue topic, NOT the raw category
    assert.notEqual(cluster.title, 'Fraud and Scam');
    assert.ok(cluster.title.length > 0 && cluster.title.length < 80);
    assert.match(cluster.title, /Fraud Department|Impersonation|Phone Scam|Credit Card/i);
  });

  test('7. Stable Identifiers & Junction Membership: generates valid issue and issue_feedback records', async () => {
    const records: RawFeedbackRecord[] = [
      createDummyRecord('rec-link1', 'Broken link on terms of service webpage footer', 'Product Feedback'),
      createDummyRecord('rec-link2', 'Terms of service link gives 404 not found on footer', 'Product Feedback'),
    ];

    const result = await clusteringService.clusterFeedback(records, new Map(), {
      minClusterSize: 2,
      similarityThreshold: 0.30,
    });

    assert.equal(result.clustersCount, 1);
    const cluster = result.clusters[0];

    // Verify issue identifiers
    assert.match(cluster.id, /^[0-9a-f-]{36}$/i, 'Cluster ID must be a valid UUID');
    assert.match(cluster.issueCode, /^ISS-\d{3}$/, 'Issue code must match ISS-001 pattern');

    // Generate feedback links
    const links = clusteringService.generateIssueFeedbackLinks(cluster);
    assert.equal(links.length, 2, 'Must generate exactly 2 link records');

    for (const link of links) {
      assert.match(link.id, /^[0-9a-f-]{36}$/i, 'Link ID must be a valid UUID');
      assert.equal(link.issueId, cluster.id, 'Link must point to cluster ID');
      assert.ok(['rec-link1', 'rec-link2'].includes(link.feedbackId));
      assert.ok(link.relevanceScore >= 0.0 && link.relevanceScore <= 1.0);
      assert.equal(link.addedBy, 'ai_clustering');
    }

    // Persist in FeedbackStore and verify retrieval
    await store.saveRecordsChunk(records);
    await store.saveClustersAndLinks(result, links);

    const storedCluster = store.getIssueById(cluster.id);
    assert.ok(storedCluster);
    assert.equal(storedCluster.issueCode, cluster.issueCode);

    const storedLinks = store.getIssueFeedbackLinks(cluster.id);
    assert.equal(storedLinks.length, 2);

    const detailedFeedback = store.getFeedbackForIssue(cluster.id);
    assert.equal(detailedFeedback.length, 2);
    assert.equal(detailedFeedback[0].feedback.id, 'rec-link1');
  });

  test('8. Representative Examples & Citations: extracts salient quotes with relevance scores', async () => {
    const records: RawFeedbackRecord[] = [
      createDummyRecord('rec-rep1', 'The latency on API response times increased by 400 percent after maintenance', 'Operational Issues'),
      createDummyRecord('rec-rep2', 'High API latency and sluggish endpoint response after scheduled maintenance window', 'Operational Issues'),
    ];

    const result = await clusteringService.clusterFeedback(records, new Map(), {
      minClusterSize: 2,
      similarityThreshold: 0.25,
    });

    assert.equal(result.clustersCount, 1);
    const cluster = result.clusters[0];

    assert.ok(cluster.representativeExamples.length > 0, 'Cluster must have representative examples');
    const example = cluster.representativeExamples[0];
    assert.ok(example.quote.length > 10);
    assert.ok(example.relevanceScore >= 0.70);
    assert.equal(example.category, 'Operational Issues');
  });

  test('9. Real Curated Sample Dataset: groups real customer feedback into meaningful issue clusters', async () => {
    // Seed the 20 curated sample rows
    await seedSampleDataset({ reset: true });
    const records = store.getRecords({ page: 1, pageSize: 100 }).data;
    assert.equal(records.length, 20);

    const result = await clusteringService.clusterFeedback(records, new Map(), {
      minClusterSize: 2,
      similarityThreshold: 0.25,
    });

    assert.equal(result.totalFeedbackEvaluated, 20);
    assert.ok(result.clustersCount >= 1, `Should discover valid clusters (found: ${result.clustersCount})`);
    assert.ok(result.clusteredFeedbackCount > 0);
    assert.ok(result.unmatchedFeedbackCount > 0, 'Outliers must be recorded as unmatched');

    // Verify all clusters have concise titles and preserved categories
    for (const cluster of result.clusters) {
      assert.ok(cluster.title.length > 0 && cluster.title.length < 100);
      assert.ok(['Product Feedback', 'Customer Service', 'Operational Issues', 'Fraud and Scam'].includes(cluster.category));
      assert.ok(cluster.feedbackCount >= 2);
      assert.ok(cluster.representativeExamples.length > 0);
    }
  });

  test('10. Mass Duplicate Scaling: 200 copies of identical review text form exactly 1 cluster with count 200', async () => {
    const text = 'Fraudulent credit card transaction occurred without any two factor SMS verification';
    const massRecords: RawFeedbackRecord[] = Array.from({ length: 200 }, (_, i) =>
      createDummyRecord(`mass-rec-${i}`, text, 'Fraud and Scam', 'mass-hash-01')
    );

    const result = await clusteringService.clusterFeedback(massRecords, new Map(), {
      minClusterSize: 2,
    });

    assert.equal(result.totalFeedbackEvaluated, 200);
    assert.equal(result.uniqueTextsEvaluated, 1);
    assert.equal(result.clustersCount, 1);
    assert.equal(result.clusters[0].feedbackCount, 200);
    assert.equal(result.clusters[0].memberFeedbackIds.length, 200);
    assert.equal(result.unmatchedFeedbackCount, 0);
  });
});
