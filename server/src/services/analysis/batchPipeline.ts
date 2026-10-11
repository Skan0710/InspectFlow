import crypto from 'node:crypto';
import { FeedbackStore } from '../feedbackStore.js';
import { FeedbackAnalyzer } from './feedbackAnalyzer.js';
import type {
  AnalysisRunConfig,
  AnalysisRunRecord,
} from './types.js';
import { sleep } from '../ai/retryHandler.js';
import type { RawFeedbackRecord } from '../../types/import.js';

export class BatchAnalysisPipeline {
  private static instance: BatchAnalysisPipeline;
  private store: FeedbackStore;
  private analyzer: FeedbackAnalyzer;
  private activeRun: AnalysisRunRecord | null = null;
  private activeAbortController: AbortController | null = null;

  constructor(analyzer?: FeedbackAnalyzer, store?: FeedbackStore) {
    this.analyzer = analyzer || new FeedbackAnalyzer();
    this.store = store || FeedbackStore.getInstance();
  }

  public static getInstance(): BatchAnalysisPipeline {
    if (!BatchAnalysisPipeline.instance) {
      BatchAnalysisPipeline.instance = new BatchAnalysisPipeline();
    }
    return BatchAnalysisPipeline.instance;
  }

  public getActiveRun(): AnalysisRunRecord | null {
    return this.activeRun;
  }

  public reset(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.activeRun = null;
    this.activeAbortController = null;
  }

  /**
   * Starts batch analysis for unanalyzed feedback.
   * Runs non-blockingly in background and enforces a single active run at a time.
   */
  public async startRun(
    config: AnalysisRunConfig = {},
    options: { autoStartWorker?: boolean } = {}
  ): Promise<AnalysisRunRecord> {
    const autoStart = options.autoStartWorker ?? true;

    // 1. Concurrency control: prevent duplicate simultaneous analysis jobs
    if (this.activeRun && this.activeRun.status === 'running') {
      const err = new Error('An analysis run is already in progress');
      (err as unknown as { code: string }).code = 'RUN_ALREADY_IN_PROGRESS';
      throw err;
    }

    // 2. Query only unanalyzed feedback (ensures resume & rerun idempotency)
    const unanalyzed = this.store.getUnanalyzedRecords(config.datasetType);
    const limit = config.limit && config.limit > 0 ? config.limit : unanalyzed.length;
    const recordsToProcess = unanalyzed.slice(0, limit);

    const now = new Date().toISOString();

    // If no unanalyzed records remain, return a completed run summary immediately
    if (recordsToProcess.length === 0) {
      const emptyRun: AnalysisRunRecord = {
        id: crypto.randomUUID(),
        runType: 'batch_feedback',
        status: 'completed',
        itemsTotal: 0,
        itemsQueued: 0,
        itemsProcessing: 0,
        itemsCompleted: 0,
        itemsFailed: 0,
        failedRecords: [],
        modelName: (this.analyzer as unknown as { provider?: { model: string } }).provider?.model || 'ai-model',
        startedAt: now,
        completedAt: now,
        executionDurationMs: 0,
        parameters: { ...config, note: 'All records were already analyzed' },
        createdAt: now,
        updatedAt: now,
      };
      await this.store.saveAnalysisRun(emptyRun);
      return emptyRun;
    }

    const batchSize = Math.max(1, Math.min(100, config.batchSize ?? 10));
    const concurrency = Math.max(1, Math.min(5, config.concurrency ?? 2));
    const rateLimitDelayMs = Math.max(0, config.rateLimitDelayMs ?? 100);

    const runRecord: AnalysisRunRecord = {
      id: crypto.randomUUID(),
      runType: 'batch_feedback',
      status: 'running',
      itemsTotal: recordsToProcess.length,
      itemsQueued: recordsToProcess.length,
      itemsProcessing: 0,
      itemsCompleted: 0,
      itemsFailed: 0,
      failedRecords: [],
      modelName: (this.analyzer as unknown as { provider?: { model: string } }).provider?.model || 'ai-model',
      startedAt: now,
      parameters: {
        batchSize,
        concurrency,
        rateLimitDelayMs,
        datasetType: config.datasetType || 'all',
        limit: config.limit,
      },
      createdAt: now,
      updatedAt: now,
    };

    // Save initial status to store and memory
    const controller = new AbortController();
    this.activeRun = runRecord;
    this.activeAbortController = controller;
    await this.store.saveAnalysisRun(runRecord);

    // Launch background asynchronous worker without blocking the HTTP request if requested
    if (autoStart) {
      setImmediate(() => {
        this.executeWorker(
          runRecord,
          recordsToProcess,
          batchSize,
          concurrency,
          rateLimitDelayMs,
          controller.signal
        ).catch((workerErr) => {
          console.error('[BatchAnalysisPipeline] Fatal unhandled error in worker:', workerErr);
        });
      });
    }

    return runRecord;
  }

  /**
   * Background bounded batch worker with worker pool concurrency and rate limiting.
   */
  public async executeWorker(
    run: AnalysisRunRecord,
    records: RawFeedbackRecord[],
    batchSize: number,
    concurrency: number,
    rateLimitDelayMs: number,
    signal: AbortSignal
  ): Promise<void> {
    const totalRecords = records.length;

    // Process reviews in bounded chunks
    for (let i = 0; i < totalRecords; i += batchSize) {
      if (signal.aborted) {
        break;
      }

      const chunk = records.slice(i, i + batchSize);

      // Process chunk with worker pool concurrency
      let itemIdx = 0;
      const poolSize = Math.min(concurrency, chunk.length);

      const workerPromises = Array.from({ length: poolSize }, async () => {
        while (itemIdx < chunk.length && !signal.aborted) {
          const currentIndex = itemIdx++;
          const item = chunk[currentIndex];

          run.itemsQueued = Math.max(0, run.itemsQueued - 1);
          run.itemsProcessing++;

          try {
            await this.analyzer.analyzeAndStore({
              feedbackId: item.id,
              review: item.review,
              category: item.category,
              source: item.source,
              analysisRunId: run.id,
            });
            run.itemsCompleted++;
          } catch (err) {
            run.itemsFailed++;
            const errorMessage = err instanceof Error ? err.message : 'Unknown error during review analysis';
            run.failedRecords.push({
              feedbackId: item.id,
              rowNumber: item.rowNumber,
              category: item.category,
              reviewSnippet: item.review.slice(0, 100),
              error: errorMessage,
              failedAt: new Date().toISOString(),
            });
          } finally {
            run.itemsProcessing = Math.max(0, run.itemsProcessing - 1);
            run.updatedAt = new Date().toISOString();
          }
        }
      });

      await Promise.all(workerPromises);

      // Persist incremental batch progress
      await this.store.saveAnalysisRun(run);

      // Configurable rate limit delay between batches
      if (rateLimitDelayMs > 0 && i + batchSize < totalRecords && !signal.aborted) {
        try {
          await sleep(rateLimitDelayMs, signal);
        } catch {
          break;
        }
      }
    }

    // Finalize run
    const finalizedTime = new Date().toISOString();
    run.completedAt = finalizedTime;
    run.updatedAt = finalizedTime;
    run.executionDurationMs = Date.now() - new Date(run.startedAt).getTime();
    run.itemsProcessing = 0;
    run.itemsQueued = 0;

    if (signal.aborted) {
      run.status = 'cancelled';
    } else if (run.itemsFailed === run.itemsTotal && run.itemsTotal > 0) {
      run.status = 'failed';
    } else {
      run.status = 'completed';
    }

    await this.store.saveAnalysisRun(run);

    if (this.activeRun?.id === run.id) {
      this.activeRun = null;
      this.activeAbortController = null;
    }
  }

  /**
   * Cancels the active analysis run cleanly.
   */
  public async cancelActiveRun(runId?: string): Promise<AnalysisRunRecord | null> {
    if (!this.activeRun) {
      if (runId) {
        const stored = this.store.getAnalysisRunById(runId);
        if (stored && (stored.status === 'running' || stored.status === 'pending')) {
          stored.status = 'cancelled';
          stored.completedAt = new Date().toISOString();
          await this.store.saveAnalysisRun(stored);
          return stored;
        }
      }
      return null;
    }

    if (runId && this.activeRun.id !== runId) {
      return null;
    }

    this.activeAbortController?.abort();
    this.activeRun.status = 'cancelled';
    this.activeRun.completedAt = new Date().toISOString();
    this.activeRun.executionDurationMs = Date.now() - new Date(this.activeRun.startedAt).getTime();
    this.activeRun.itemsProcessing = 0;
    this.activeRun.itemsQueued = 0;

    const cancelledRun = this.activeRun;
    await this.store.saveAnalysisRun(cancelledRun);

    this.activeRun = null;
    this.activeAbortController = null;

    return cancelledRun;
  }

  /**
   * Retrieves status of current active run or latest past run.
   */
  public getStatus(runId?: string): {
    run: AnalysisRunRecord | null;
    isRunning: boolean;
    progressPercentage: number;
  } {
    let run: AnalysisRunRecord | null = null;

    if (runId) {
      run = (this.activeRun && this.activeRun.id === runId)
        ? this.activeRun
        : this.store.getAnalysisRunById(runId);
    } else {
      run = this.activeRun || this.store.getLatestAnalysisRun();
    }

    if (!run) {
      return { run: null, isRunning: false, progressPercentage: 0 };
    }

    const processed = run.itemsCompleted + run.itemsFailed;
    const progressPercentage = run.itemsTotal > 0
      ? Math.min(100, Math.round((processed / run.itemsTotal) * 100))
      : (run.status === 'completed' ? 100 : 0);

    return {
      run,
      isRunning: run.status === 'running',
      progressPercentage,
    };
  }
}
