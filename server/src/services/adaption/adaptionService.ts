import crypto from 'node:crypto';
import { AdaptionApiClient } from './adaptionClient.js';
import { DatasetPreparer } from './datasetPreparer.js';
import { FeedbackStore } from '../feedbackStore.js';
import type {
  AdaptionProviderStatus,
  AdaptionRunRecord,
  PrepareDatasetOptions,
  RunAdaptionOptions,
  AdaptionPromptPair,
} from './types.js';

export class AdaptionService {
  private client: AdaptionApiClient;
  private preparer: DatasetPreparer;
  private store: FeedbackStore;

  constructor(client?: AdaptionApiClient, store?: FeedbackStore) {
    this.client = client || new AdaptionApiClient();
    this.preparer = new DatasetPreparer();
    this.store = store || FeedbackStore.getInstance();
  }

  /**
   * Retrieves live Adaption Labs provider configuration status without leaking secrets.
   */
  public getStatus(): AdaptionProviderStatus {
    const configured = this.client.isConfigured();
    const isMock = this.client.isMockMode();
    const hasApiKey = configured && !isMock;

    let message = 'Adaption Labs API ready.';
    if (!configured) {
      message = 'ADAPTION_API_KEY is not configured in server environment variables. Set ADAPTION_API_KEY or enable ADAPTION_MOCK=true for verified local evaluation.';
    } else if (isMock) {
      message = 'Adaption Labs running in verified local simulation mode (ADAPTION_MOCK=true).';
    }

    return {
      configured,
      baseUrl: this.client.getBaseUrl(),
      hasApiKey,
      isMockMode: isMock,
      message,
    };
  }

  /**
   * Prepares a representative customer-feedback dataset with validated input-output pairs.
   * Strictly preserves the original source feedback records.
   */
  public prepareDataset(options: PrepareDatasetOptions = {}) {
    const rawRecords = this.store.getRecords({
      page: 1,
      pageSize: 100000,
      datasetType: options.datasetType || 'all',
    }).data;

    return this.preparer.prepareFeedbackDataset(
      rawRecords,
      (id) => this.store.getAnalysisByFeedbackId(id),
      {
        maxRows: options.maxRows,
        requireAnalyzed: options.requireAnalyzed ?? false,
      }
    );
  }

  /**
   * Initiates an Adaption workflow run.
   * If unconfigured and not in simulation mode, cleanly records an unconfigured run without blocking or throwing.
   */
  public async runAdaption(options: RunAdaptionOptions = {}): Promise<AdaptionRunRecord> {
    const status = this.getStatus();
    const now = new Date().toISOString();

    // 1. Prepare representative customer-feedback instruction dataset
    const prepared = this.prepareDataset({
      datasetType: options.datasetType || 'all',
      maxRows: options.maxRows || 25,
      requireAnalyzed: false,
    });

    if (prepared.pairs.length === 0) {
      throw new Error('No valid customer feedback records available to prepare for Adaption.');
    }

    const runName = options.datasetName?.trim() || `InsightFlow-Feedback-Eval-${Date.now()}`;
    const runId = `ds_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // Handle missing configuration without blocking the platform
    if (!status.configured && !options.simulateRun) {
      const unconfiguredRun: AdaptionRunRecord = {
        id: runId,
        name: runName,
        datasetVersion: prepared.datasetVersion,
        status: 'unconfigured',
        recordsCount: prepared.pairs.length,
        trainingType: 'instruction_dataset',
        columnMapping: prepared.columnMapping,
        samplePairs: prepared.pairs.slice(0, 5),
        benchmarkIntegrated: false,
        errorMessage: 'Adaption API credentials (ADAPTION_API_KEY) are missing in server environment.',
        isMock: false,
        createdAt: now,
        updatedAt: now,
      };

      await this.store.saveAdaptionRun(unconfiguredRun);
      return unconfiguredRun;
    }

    // Use mock client if simulateRun is explicitly requested
    const activeClient = options.simulateRun ? new AdaptionApiClient({ isMock: true }) : this.client;
    const isMockRun = activeClient.isMockMode() || Boolean(options.simulateRun);

    try {
      // 2. Ingest dataset
      const createRes = await activeClient.createDataset({
        name: runName,
        records: prepared.pairs.map((p) => ({
          prompt: p.prompt,
          completion: p.completion,
          source_id: p.originalId,
          category: p.category,
          sentiment: p.sentiment,
        })),
      });

      const actualDatasetId = createRes.dataset_id || runId;

      // 3. Initiate dataset adaptation
      await activeClient.adaptDataset({
        datasetId: actualDatasetId,
        columnMapping: prepared.columnMapping,
        trainingType: 'instruction_dataset',
        estimate: options.estimateOnly ?? false,
        maxRows: options.maxRows,
      });

      // 4. Retrieve evaluation metrics
      let qualityMetrics = undefined;
      let rawResults = undefined;
      let runStatus: AdaptionRunRecord['status'] = 'running';

      try {
        const evalRes = await activeClient.getEvaluation(actualDatasetId);
        if (evalRes && evalRes.quality) {
          qualityMetrics = evalRes.quality;
          rawResults = evalRes.raw_results;
          runStatus = 'succeeded';
        }
      } catch (evalErr) {
        // If evaluation is still in progress on remote API
        console.warn(`[AdaptionService] Evaluation for ${actualDatasetId} not yet ready:`, evalErr);
      }

      const runRecord: AdaptionRunRecord = {
        id: actualDatasetId,
        name: runName,
        datasetVersion: prepared.datasetVersion,
        status: runStatus,
        recordsCount: prepared.pairs.length,
        trainingType: 'instruction_dataset',
        columnMapping: prepared.columnMapping,
        quality: qualityMetrics,
        samplePairs: prepared.pairs.slice(0, 6),
        benchmarkIntegrated: runStatus === 'succeeded',
        rawResults,
        isMock: isMockRun,
        createdAt: now,
        updatedAt: now,
        completedAt: runStatus === 'succeeded' ? now : undefined,
      };

      await this.store.saveAdaptionRun(runRecord);
      return runRecord;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown Adaption execution error';
      console.error('[AdaptionService] Adaption run failed:', errorMessage);

      const failedRecord: AdaptionRunRecord = {
        id: runId,
        name: runName,
        datasetVersion: prepared.datasetVersion,
        status: 'failed',
        recordsCount: prepared.pairs.length,
        trainingType: 'instruction_dataset',
        columnMapping: prepared.columnMapping,
        samplePairs: prepared.pairs.slice(0, 5),
        benchmarkIntegrated: false,
        errorMessage,
        isMock: isMockRun,
        createdAt: now,
        updatedAt: now,
      };

      await this.store.saveAdaptionRun(failedRecord);
      return failedRecord;
    }
  }

  /**
   * Syncs status and quality evaluation for a specific run.
   */
  public async syncRun(runId: string): Promise<AdaptionRunRecord> {
    const existing = this.store.getAdaptionRunById(runId);
    if (!existing) {
      throw new Error(`Adaption run '${runId}' not found.`);
    }

    if (existing.status === 'unconfigured') {
      return existing;
    }

    const activeClient = existing.isMock ? new AdaptionApiClient({ isMock: true }) : this.client;
    const now = new Date().toISOString();

    try {
      const statusRes = await activeClient.getDatasetStatus(runId);
      const evalRes = await activeClient.getEvaluation(runId);

      existing.status = statusRes.status || 'succeeded';
      if (evalRes && evalRes.quality) {
        existing.quality = evalRes.quality;
        existing.rawResults = evalRes.raw_results;
        existing.benchmarkIntegrated = true;
      }
      existing.updatedAt = now;
      if (existing.status === 'succeeded' && !existing.completedAt) {
        existing.completedAt = now;
      }

      await this.store.saveAdaptionRun(existing);
      return existing;
    } catch (err: unknown) {
      existing.errorMessage = err instanceof Error ? err.message : 'Failed to sync with Adaption API';
      existing.updatedAt = now;
      await this.store.saveAdaptionRun(existing);
      return existing;
    }
  }

  /**
   * Returns high-quality evaluated exemplars from completed Adaption runs.
   * Feeds directly into InsightFlow's few-shot classification and evaluation benchmark.
   */
  public getFewShotExemplars(): AdaptionPromptPair[] {
    const runs = this.store.getAdaptionRuns();
    const successfulRuns = runs.filter((r) => r.status === 'succeeded' && r.samplePairs && r.samplePairs.length > 0);

    const exemplars: AdaptionPromptPair[] = [];
    const seenCategories = new Set<string>();

    for (const run of successfulRuns) {
      for (const pair of run.samplePairs) {
        if (!seenCategories.has(pair.category)) {
          exemplars.push(pair);
          seenCategories.add(pair.category);
        }
      }
    }

    return exemplars;
  }

  /**
   * Exports an adapted dataset to JSONL or CSV.
   */
  public exportDataset(runId: string, format: 'jsonl' | 'csv' = 'jsonl'): { content: string; mimeType: string; filename: string } {
    const run = this.store.getAdaptionRunById(runId);
    if (!run) {
      throw new Error(`Adaption run '${runId}' not found.`);
    }

    const content = format === 'csv'
      ? this.preparer.toCSV(run.samplePairs)
      : this.preparer.toJSONL(run.samplePairs);

    const mimeType = format === 'csv' ? 'text/csv' : 'application/x-ndjson';
    const filename = `${run.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${run.datasetVersion}.${format}`;

    return { content, mimeType, filename };
  }

  public getRuns(): AdaptionRunRecord[] {
    return this.store.getAdaptionRuns();
  }

  public getRunById(id: string): AdaptionRunRecord | null {
    return this.store.getAdaptionRunById(id);
  }
}
