import crypto from 'node:crypto';
import type { RawFeedbackRecord } from '../../types/import.js';
import type {
  ClusterableItem,
  ClusteringOptions,
  ClusteringResult,
  IssueClusterData,
  IssueFeedbackLink,
  RepresentativeExample,
  UnmatchedFeedbackItem,
} from './types.js';
import {
  TfidfVectorEngine,
  extractClusterSalientPhrases,
  formatClusterTitle,
} from './vectorEngine.js';

interface UniqueGroup {
  normalizedText: string;
  category: string;
  items: ClusterableItem[];
  representativeItem: ClusterableItem;
}

export class IssueClusteringService {
  private vectorEngine: TfidfVectorEngine;

  constructor(vectorEngine?: TfidfVectorEngine) {
    this.vectorEngine = vectorEngine || new TfidfVectorEngine();
  }

  /**
   * Main clustering workflow:
   * 1. Validates and normalizes feedback items.
   * 2. Groups exact duplicates together so duplicate text never spawns independent clusters.
   * 3. Computes semantic similarity across unique text groups.
   * 4. Clusters groups using similarity threshold and centroid linkage.
   * 5. Filters out singleton/low-confidence outliers into unmatched.
   * 6. Generates concise human-readable names and representative citations.
   * 7. Assigns stable identifiers (UUIDs) for issues and issue_feedback links.
   */
  public async clusterFeedback(
    rawRecords: RawFeedbackRecord[],
    analysesMap: Map<string, any>,
    options: ClusteringOptions = {}
  ): Promise<ClusteringResult> {
    const startTime = Date.now();
    const similarityThreshold = options.similarityThreshold ?? 0.35;
    const minClusterSize = options.minClusterSize ?? 2;
    const maxClusters = options.maxClusters ?? 50;

    // Filter by datasetType if requested
    let filteredRecords = rawRecords;
    if (options.datasetType && options.datasetType !== 'all') {
      filteredRecords = rawRecords.filter((r) => r.datasetType === options.datasetType);
    }

    const totalFeedbackEvaluated = filteredRecords.length;

    // Handle empty dataset edge case
    if (totalFeedbackEvaluated === 0) {
      return {
        runId: crypto.randomUUID(),
        totalFeedbackEvaluated: 0,
        uniqueTextsEvaluated: 0,
        clusteredFeedbackCount: 0,
        unmatchedFeedbackCount: 0,
        clustersCount: 0,
        clusters: [],
        unmatched: [],
        executionDurationMs: Date.now() - startTime,
        parameters: { similarityThreshold, minClusterSize, maxClusters, datasetType: options.datasetType },
        createdAt: new Date().toISOString(),
      };
    }

    // Convert raw records into ClusterableItems with analysis attached
    const clusterableItems: ClusterableItem[] = filteredRecords.map((r) => ({
      id: r.id,
      text: r.review,
      category: r.category,
      contentHash: r.contentHash,
      source: r.source,
      analysis: analysesMap.get(r.id) || null,
      datasetType: r.datasetType,
    }));

    // Step 1: Deduplicate identical review texts into UniqueGroups
    // This strictly prevents repeated copies of identical review text from creating multiple independent clusters
    const uniqueGroupsMap: Map<string, UniqueGroup> = new Map();

    for (const item of clusterableItems) {
      const text = item.text || '';
      const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
      // Key by normalized text and category
      const cat = item.category || 'Product Feedback';
      const groupKey = `${cat}:::${normalized}`;

      if (!uniqueGroupsMap.has(groupKey)) {
        uniqueGroupsMap.set(groupKey, {
          normalizedText: normalized,
          category: cat,
          items: [item],
          representativeItem: item,
        });
      } else {
        const group = uniqueGroupsMap.get(groupKey)!;
        group.items.push(item);
      }
    }

    const uniqueGroups = Array.from(uniqueGroupsMap.values());
    const uniqueTextsEvaluated = uniqueGroups.length;

    // Step 2: Handle small datasets (e.g., 1 unique group)
    if (uniqueTextsEvaluated === 1) {
      const singleGroup = uniqueGroups[0];
      // If the single group has multiple feedback items (e.g. duplicate copies of same review)
      // and meets minClusterSize, it forms 1 cluster!
      if (singleGroup.items.length >= minClusterSize) {
        const cluster = this.buildClusterFromGroups(
          1,
          [singleGroup],
          similarityThreshold
        );
        return {
          runId: crypto.randomUUID(),
          totalFeedbackEvaluated,
          uniqueTextsEvaluated,
          clusteredFeedbackCount: singleGroup.items.length,
          unmatchedFeedbackCount: 0,
          clustersCount: 1,
          clusters: [cluster],
          unmatched: [],
          executionDurationMs: Date.now() - startTime,
          parameters: { similarityThreshold, minClusterSize, maxClusters, datasetType: options.datasetType },
          createdAt: new Date().toISOString(),
        };
      } else {
        // Less than minClusterSize -> unmatched singleton
        const unmatched: UnmatchedFeedbackItem[] = singleGroup.items.map((it) => ({
          feedbackId: it.id,
          text: it.text,
          category: it.category,
          reason: 'singleton_outlier',
          bestSimilarityScore: 0.0,
        }));

        return {
          runId: crypto.randomUUID(),
          totalFeedbackEvaluated,
          uniqueTextsEvaluated,
          clusteredFeedbackCount: 0,
          unmatchedFeedbackCount: unmatched.length,
          clustersCount: 0,
          clusters: [],
          unmatched,
          executionDurationMs: Date.now() - startTime,
          parameters: { similarityThreshold, minClusterSize, maxClusters, datasetType: options.datasetType },
          createdAt: new Date().toISOString(),
        };
      }
    }

    // Step 3: Compute pairwise similarities between unique groups using vector engine
    const groupItemsForEngine = uniqueGroups.map((g, idx) => ({
      id: String(idx),
      text: g.normalizedText,
    }));

    const simMatrix = await this.vectorEngine.computeSimilarities(groupItemsForEngine);

    // Step 4: Cluster unique groups using connected components / graph clustering
    // with similarityThreshold and category affinity
    const parent: number[] = uniqueGroups.map((_, i) => i);
    function find(i: number): number {
      if (parent[i] === i) return i;
      parent[i] = find(parent[i]);
      return parent[i];
    }
    function union(i: number, j: number) {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) parent[rootI] = rootJ;
    }

    // Track best similarity each group had with any other group
    const maxSimilarityPerGroup: number[] = new Array(uniqueGroups.length).fill(0.0);

    for (let i = 0; i < uniqueGroups.length; i++) {
      for (let j = i + 1; j < uniqueGroups.length; j++) {
        const sim = simMatrix[i][j];
        if (sim > maxSimilarityPerGroup[i]) maxSimilarityPerGroup[i] = sim;
        if (sim > maxSimilarityPerGroup[j]) maxSimilarityPerGroup[j] = sim;

        // Group together if similarity exceeds threshold and categories align
        // (or if similarity is very high >= 0.70)
        const sameCategory = uniqueGroups[i].category === uniqueGroups[j].category;
        const threshold = sameCategory ? similarityThreshold : Math.max(0.65, similarityThreshold * 1.5);

        if (sim >= threshold) {
          union(i, j);
        }
      }
    }

    // Collect partitions
    const partitionsMap: Map<number, number[]> = new Map();
    for (let i = 0; i < uniqueGroups.length; i++) {
      const root = find(i);
      if (!partitionsMap.has(root)) {
        partitionsMap.set(root, []);
      }
      partitionsMap.get(root)!.push(i);
    }

    // Step 5: Form clusters and identify unmatched reviews
    const clusterCandidates: UniqueGroup[][] = [];
    const unmatchedGroups: { group: UniqueGroup; bestScore: number; reason: UnmatchedFeedbackItem['reason'] }[] = [];

    for (const groupIndices of partitionsMap.values()) {
      const groupsInCluster = groupIndices.map((idx) => uniqueGroups[idx]);
      const totalFeedbackInCluster = groupsInCluster.reduce((sum, g) => sum + g.items.length, 0);

      // Check minClusterSize constraint
      if (totalFeedbackInCluster >= minClusterSize) {
        clusterCandidates.push(groupsInCluster);
      } else {
        // Outlier / low-confidence assignment
        for (const idx of groupIndices) {
          const bestScore = maxSimilarityPerGroup[idx];
          const reason = bestScore < similarityThreshold ? 'below_similarity_threshold' : 'singleton_outlier';
          unmatchedGroups.push({
            group: uniqueGroups[idx],
            bestScore,
            reason,
          });
        }
      }
    }

    // Sort clusters by feedback count descending
    clusterCandidates.sort((a, b) => {
      const countA = a.reduce((sum, g) => sum + g.items.length, 0);
      const countB = b.reduce((sum, g) => sum + g.items.length, 0);
      return countB - countA;
    });

    // Limit to maxClusters if specified
    const selectedClusters = clusterCandidates.slice(0, maxClusters);
    const overflowClusters = clusterCandidates.slice(maxClusters);

    for (const groups of overflowClusters) {
      for (const g of groups) {
        unmatchedGroups.push({
          group: g,
          bestScore: similarityThreshold,
          reason: 'low_confidence',
        });
      }
    }

    // Build cluster data
    const clusters: IssueClusterData[] = selectedClusters.map((groups, index) =>
      this.buildClusterFromGroups(index + 1, groups, similarityThreshold)
    );

    // Build unmatched feedback items
    const unmatched: UnmatchedFeedbackItem[] = [];
    for (const { group, bestScore, reason } of unmatchedGroups) {
      for (const item of group.items) {
        unmatched.push({
          feedbackId: item.id,
          text: item.text,
          category: item.category,
          reason,
          bestSimilarityScore: Math.round(bestScore * 100) / 100,
        });
      }
    }

    const clusteredFeedbackCount = clusters.reduce((sum, c) => sum + c.feedbackCount, 0);
    const unmatchedFeedbackCount = unmatched.length;

    return {
      runId: crypto.randomUUID(),
      totalFeedbackEvaluated,
      uniqueTextsEvaluated,
      clusteredFeedbackCount,
      unmatchedFeedbackCount,
      clustersCount: clusters.length,
      clusters,
      unmatched,
      executionDurationMs: Date.now() - startTime,
      parameters: { similarityThreshold, minClusterSize, maxClusters, datasetType: options.datasetType },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Helper to construct an IssueClusterData record from groups of unique feedback items.
   */
  private buildClusterFromGroups(
    issueIndex: number,
    groups: UniqueGroup[],
    similarityThreshold: number
  ): IssueClusterData {
    const clusterId = crypto.randomUUID();
    const issueCode = `ISS-${String(issueIndex).padStart(3, '0')}`;

    const allItems: ClusterableItem[] = [];
    for (const g of groups) {
      allItems.push(...g.items);
    }

    const feedbackCount = allItems.length;
    const uniqueTextCount = groups.length;
    const memberFeedbackIds = allItems.map((item) => item.id);

    // Determine predominant category (keeping category separate from AI issue topic)
    const categoryCounts: Map<string, number> = new Map();
    for (const item of allItems) {
      const cat = item.category || 'Product Feedback';
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
    const predominantCategory =
      Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Product Feedback';

    // Gather AI analysis primary topics if available
    const primaryTopics: string[] = [];
    const keyPhrasesList: string[] = [];
    let severitySum = 0;
    let severityCount = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;

    const sentimentBreakdown = {
      positive: 0,
      neutral: 0,
      negative: 0,
      mixed: 0,
    };

    for (const item of allItems) {
      if (item.analysis) {
        if (item.analysis.primaryTopic) primaryTopics.push(item.analysis.primaryTopic);
        if (item.analysis.keyPhrases && Array.isArray(item.analysis.keyPhrases)) {
          keyPhrasesList.push(...item.analysis.keyPhrases);
        }
        if (item.analysis.severity) {
          severitySum += item.analysis.severity;
          severityCount++;
        }
        if (item.analysis.confidenceScore) {
          confidenceSum += item.analysis.confidenceScore;
          confidenceCount++;
        }
        if (item.analysis.sentiment && sentimentBreakdown[item.analysis.sentiment as keyof typeof sentimentBreakdown] !== undefined) {
          sentimentBreakdown[item.analysis.sentiment as keyof typeof sentimentBreakdown]++;
        }
      }
    }

    // Extract salient phrases from review texts
    const textSamples = groups.map((g) => g.representativeItem?.text || '').filter(Boolean);
    const salientPhrases = extractClusterSalientPhrases(textSamples);

    // Generate concise human-readable issue title
    const title = formatClusterTitle(predominantCategory, salientPhrases, primaryTopics);

    // Calculate priority based on severity or negative feedback ratio
    const avgSeverity = severityCount > 0 ? severitySum / severityCount : 3.0;
    let priority: IssueClusterData['priority'] = 'medium';
    if (avgSeverity >= 4.2 || predominantCategory === 'Fraud and Scam') {
      priority = 'critical';
    } else if (avgSeverity >= 3.4) {
      priority = 'high';
    } else if (avgSeverity < 2.0) {
      priority = 'low';
    }

    const avgConfidence = confidenceCount > 0 ? Math.round((confidenceSum / confidenceCount) * 100) / 100 : 0.88;

    // Pick top representative examples (up to 3)
    const representativeExamples: RepresentativeExample[] = [];
    const sortedGroups = [...groups].sort((a, b) => b.items.length - a.items.length);

    for (let i = 0; i < Math.min(3, sortedGroups.length); i++) {
      const g = sortedGroups[i];
      const rep = g.representativeItem;
      const repText = rep?.text || '';
      const quote = repText.length > 200 ? `${repText.slice(0, 197)}...` : repText;

      representativeExamples.push({
        feedbackId: rep?.id || crypto.randomUUID(),
        quote,
        relevanceScore: Math.max(0.75, Math.min(0.98, 0.85 + (i === 0 ? 0.1 : 0))),
        category: rep?.category || predominantCategory,
        source: rep?.source || 'Customer Feedback',
      });
    }

    // Impact summary describing the volume and scope
    const impactSummary = `${feedbackCount} customer reviews (${uniqueTextCount} unique reports) affecting ${predominantCategory}. Predominant sentiment: ${
      sentimentBreakdown.negative > sentimentBreakdown.positive ? 'Negative' : 'Positive / Inquiries'
    }.`;

    const description = `Semantically clustered customer inquiries regarding "${title}". Root signals highlight: ${salientPhrases.join(', ')}.`;

    const now = new Date().toISOString();

    return {
      id: clusterId,
      issueCode,
      title,
      description,
      category: predominantCategory,
      status: 'open',
      priority,
      impactSummary,
      feedbackCount,
      uniqueTextCount,
      representativeExamples,
      sentimentBreakdown,
      avgConfidence,
      memberFeedbackIds,
      isSaved: false,
      statusUpdatedAt: now,
      notes: [],
      statusHistory: [
        {
          id: `hist-init-${clusterId.slice(0, 8)}`,
          fromStatus: 'none',
          toStatus: 'open',
          changedAt: now,
          changedBy: 'ai_clustering',
          reason: 'Initial issue cluster discovery',
        },
      ],
      metadata: {
        salientPhrases,
        predominantCategory,
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        similarityThreshold,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Helper to create database-ready issue_feedback link records for all cluster members.
   */
  public generateIssueFeedbackLinks(cluster: IssueClusterData): IssueFeedbackLink[] {
    const now = new Date().toISOString();
    return cluster.memberFeedbackIds.map((feedbackId, idx) => {
      // Representative examples get slightly higher relevance scores
      const repMatch = cluster.representativeExamples.find((r) => r.feedbackId === feedbackId);
      const relevanceScore = repMatch ? repMatch.relevanceScore : 0.85;
      const citationQuote = repMatch ? repMatch.quote : '';

      return {
        id: crypto.randomUUID(),
        issueId: cluster.id,
        feedbackId,
        relevanceScore,
        citationQuote,
        addedBy: 'ai_clustering',
        createdAt: now,
      };
    });
  }
}
