import { Router, type Request, type Response } from 'express';
import { FeedbackStore } from '../services/feedbackStore.js';
import { IssueClusteringService } from '../services/clustering/clusteringService.js';
import type { ClusteringOptions } from '../services/clustering/types.js';
import type { IssueTrackingRecord } from '../types/issues.js';

const router = Router();
const store = FeedbackStore.getInstance();
const clusteringService = new IssueClusteringService();

/**
 * POST /api/clusters/run
 * Runs issue clustering over stored customer feedback records.
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const {
      datasetType,
      similarityThreshold,
      minClusterSize,
      maxClusters,
    } = req.body || {};

    const options: ClusteringOptions = {};
    if (datasetType && ['all', 'genuine_import', 'demo_sample'].includes(datasetType)) {
      options.datasetType = datasetType;
    }
    if (typeof similarityThreshold === 'number' && similarityThreshold > 0 && similarityThreshold <= 1) {
      options.similarityThreshold = similarityThreshold;
    }
    if (typeof minClusterSize === 'number' && minClusterSize >= 1) {
      options.minClusterSize = minClusterSize;
    }
    if (typeof maxClusters === 'number' && maxClusters >= 1) {
      options.maxClusters = maxClusters;
    }

    // Get feedback records from store
    const records = store.getRecords({
      page: 1,
      pageSize: 100000,
      datasetType: options.datasetType,
    }).data;

    if (records.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No feedback records available to cluster.',
        result: {
          totalFeedbackEvaluated: 0,
          clusteredFeedbackCount: 0,
          unmatchedFeedbackCount: 0,
          clustersCount: 0,
          clusters: [],
          unmatched: [],
        },
      });
      return;
    }

    // Build analyses map
    const analyses = store.getAllAnalyses();
    const analysesMap = new Map<string, any>();
    for (const a of analyses) {
      analysesMap.set(a.feedbackId, a);
    }

    // Execute clustering
    const result = await clusteringService.clusterFeedback(records, analysesMap, options);

    // Generate links for all clusters
    const allLinks = result.clusters.flatMap((cluster) =>
      clusteringService.generateIssueFeedbackLinks(cluster)
    );

    // Save to store (memory, disk, and DB if configured)
    await store.saveClustersAndLinks(result, allLinks);

    res.status(200).json({
      success: true,
      message: `Clustering completed. Discovered ${result.clustersCount} issue clusters from ${result.totalFeedbackEvaluated} reviews (${result.uniqueTextsEvaluated} unique).`,
      result,
    });
  } catch (err: any) {
    console.error('[Clusters API] Error running clustering:', err);
    res.status(500).json({
      error: 'ClusteringError',
      message: err.message || 'Failed to complete issue clustering.',
    });
  }
});

/**
 * GET /api/clusters
 * Returns all discovered clusters, counts, sentiment breakdowns, and representative review citations.
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { category, priority, search } = req.query as {
      category?: string;
      priority?: string;
      search?: string;
    };

    let clusters: IssueTrackingRecord[] = [];
    try {
      clusters = store.getAllIssues({ category, priority, search }) || [];
    } catch (storeErr) {
      console.warn('[Clusters API] Error retrieving clusters from store, defaulting to empty:', storeErr);
      clusters = [];
    }

    const latestRun = store.getLatestClusteringResult();
    const totalClusteredFeedback = clusters.reduce((sum, c) => sum + (Number(c?.feedbackCount) || 0), 0);

    res.status(200).json({
      success: true,
      count: clusters.length,
      clusters,
      stats: {
        totalClusters: clusters.length,
        totalFeedbackClustered: totalClusteredFeedback,
        unmatchedCount: latestRun ? (Number(latestRun.unmatchedFeedbackCount) || 0) : 0,
        evaluatedTotal: latestRun ? (Number(latestRun.totalFeedbackEvaluated) || totalClusteredFeedback) : totalClusteredFeedback,
        uniqueTextsCount: latestRun ? (Number(latestRun.uniqueTextsEvaluated) || 0) : 0,
      },
      latestRun: latestRun
        ? {
            runId: latestRun.runId,
            createdAt: latestRun.createdAt,
            executionDurationMs: latestRun.executionDurationMs,
            parameters: latestRun.parameters,
          }
        : null,
    });
  } catch (err: any) {
    console.error('[Clusters API] Error retrieving clusters:', err);
    res.status(200).json({
      success: true,
      count: 0,
      clusters: [],
      stats: {
        totalClusters: 0,
        totalFeedbackClustered: 0,
        unmatchedCount: 0,
        evaluatedTotal: 0,
        uniqueTextsCount: 0,
      },
      latestRun: null,
    });
  }
});

/**
 * GET /api/clusters/unmatched/list
 * Returns unmatched feedback items and outlier assignments from the latest clustering run.
 */
router.get('/unmatched/list', (_req: Request, res: Response) => {
  try {
    const latestRun = store.getLatestClusteringResult();
    const unmatched = latestRun ? latestRun.unmatched : [];

    res.status(200).json({
      success: true,
      count: unmatched.length,
      unmatched,
    });
  } catch (err: any) {
    console.error('[Clusters API] Error retrieving unmatched reviews:', err);
    res.status(500).json({
      error: 'RetrievalError',
      message: err.message || 'Failed to retrieve unmatched reviews.',
    });
  }
});

/**
 * GET /api/clusters/:id
 * Returns a specific cluster by ID with linked feedback member details and citations.
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cluster = store.getIssueById(id);

    if (!cluster) {
      res.status(404).json({
        error: 'NotFound',
        message: `Issue cluster with id '${id}' not found.`,
      });
      return;
    }

    const memberFeedback = store.getFeedbackForIssue(id);

    res.status(200).json({
      success: true,
      cluster,
      members: memberFeedback,
    });
  } catch (err: any) {
    console.error('[Clusters API] Error retrieving cluster details:', err);
    res.status(500).json({
      error: 'RetrievalError',
      message: err.message || 'Failed to retrieve cluster details.',
    });
  }
});

export default router;
