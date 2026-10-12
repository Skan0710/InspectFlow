import crypto from 'node:crypto';
import { AdaptionApiClient } from './adaptionClient.js';
import { DatasetPreparer } from './datasetPreparer.js';
import { FeedbackStore } from '../feedbackStore.js';
import { ExemplarLibrary } from './exemplarLibrary.js';
import { AdaptionEvaluationService, type RunEvaluationOptions } from './adaptionEvaluation.js';
import type {
  AdaptionProviderStatus,
  AdaptionRunRecord,
  PrepareDatasetOptions,
  RunAdaptionOptions,
  AdaptionPromptPair,
  AdaptionEstimate,
  AdaptionEvaluationComparison,
  ExemplarLibraryMetadata,
} from './types.js';

/** Raised when a run is requested but no feedback matches the chosen source. A client error, not a server fault. */
export class NoFeedbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoFeedbackError';
  }
}

export class AdaptionService {
  private client: AdaptionApiClient;
  private preparer: DatasetPreparer;
  private store: FeedbackStore;
  private exemplarLibrary: ExemplarLibrary;
  private evaluationService: AdaptionEvaluationService;
  private recentIdempotencyMap = new Map<string, { runId: string; timestamp: number }>();

  constructor(client?: AdaptionApiClient, store?: FeedbackStore) {
    this.client = client || new AdaptionApiClient();
    this.preparer = new DatasetPreparer();
    this.store = store || FeedbackStore.getInstance();
    this.exemplarLibrary = ExemplarLibrary.getInstance();
    this.exemplarLibrary.syncFromRuns(this.store.getAdaptionRuns());
    this.evaluationService = new AdaptionEvaluationService(this.store, undefined, this.exemplarLibrary);
  }

  /**
   * Retrieves live Adaption Labs provider configuration status without leaking secrets.
   */
  public getStatus(): AdaptionProviderStatus {
    const configured = this.client.isConfigured();
    const isMock = this.client.isMockMode();
    const hasApiKey = configured && !isMock;
    const apiKeyMasked = this.client.getMaskedApiKey();

    let validationState: AdaptionProviderStatus['validationState'] = 'unconfigured';
    let message = 'Adaption Labs API ready.';

    if (!configured) {
      validationState = 'unconfigured';
      message = 'ADAPTION_API_KEY is not configured in server environment variables. Set ADAPTION_API_KEY or enable ADAPTION_MOCK=true for verified local evaluation.';
    } else if (isMock) {
      validationState = 'simulation';
      message = 'Adaption Labs running in verified local simulation mode (ADAPTION_MOCK=true).';
    } else {
      validationState = 'configured';
      message = `Adaption Labs credentials configured (${apiKeyMasked}). Live remote execution available.`;
    }

    return {
      configured,
      baseUrl: this.client.getBaseUrl(),
      hasApiKey,
      isMockMode: isMock,
      apiKeyMasked,
      validationState,
      message,
    };
  }

  /**
   * Performs live API ping against Adaption Labs to verify upstream credentials.
   */
  public async testConnection(): Promise<{ ok: boolean; status: number; message: string }> {
    return this.client.testConnection();
  }

  /**
   * Calculates an upfront estimate of credits and costs before launching a live Adaption run.
   */
  public getEstimate(options: {
    datasetType?: 'all' | 'genuine_import' | 'demo_sample';
    maxRows?: number;
    simulateRun?: boolean;
  } = {}): AdaptionEstimate {
    const prepared = this.prepareDataset({
      datasetType: options.datasetType || 'all',
      maxRows: options.maxRows || 25,
      requireAnalyzed: false,
    });

    const isMock = Boolean(options.simulateRun || this.client.isMockMode() || !this.client.isConfigured());
    const count = prepared.pairs.length;
    // Standard Adaption Labs pricing guideline: ~1 credit per 10 rows (min 1 credit)
    const estimatedCredits = Math.max(1, Math.ceil(count / 10));
    const estimatedCostUsd = Number((count * 0.005).toFixed(3));

    return {
      recordsCount: count,
      estimatedCredits,
      estimatedCostUsd,
      isMock,
      requiresConfirmation: !isMock,
      explanation: isMock
        ? `Simulation Mode: 0 real credits consumed. Transforms ${count} feedback rows into prompt-completion pairs.`
        : `Live Adaption Run: Requires estimated ${estimatedCredits} credits (~$${estimatedCostUsd} USD) for ${count} prompt-completion rows. Explicit confirmation is required.`,
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
   * Enforces duplicate run protection, credit cost estimation, and confirmation requirements.
   */
  public async runAdaption(options: RunAdaptionOptions = {}): Promise<AdaptionRunRecord> {
    const status = this.getStatus();
    const now = new Date().toISOString();

    // 0. Idempotency Check: protect against double-clicks and repeated requests
    if (options.idempotencyKey) {
      const existingKey = this.recentIdempotencyMap.get(options.idempotencyKey);
      if (existingKey && Date.now() - existingKey.timestamp < 300000) {
        const cached = this.store.getAdaptionRunById(existingKey.runId);
        if (cached) {
          return cached;
        }
      }
      const existingPersisted = this.store.getAdaptionRuns().find(
        (r) => r.idempotencyKey === options.idempotencyKey
      );
      if (existingPersisted) {
        return existingPersisted;
      }
    }

    const runName = options.datasetName?.trim() || `InsightFlow-Feedback-Eval-${Date.now()}`;

    // Concurrent run protection: if a run with the exact same name is currently running, return it
    const activeRuns = this.store.getAdaptionRuns();
    const inFlight = activeRuns.find(
      (r) => (r.status === 'running' || r.status === 'pending') && r.name === runName
    );
    if (inFlight) {
      return inFlight;
    }

    // 1. Prepare representative customer-feedback instruction dataset
    const prepared = this.prepareDataset({
      datasetType: options.datasetType || 'all',
      maxRows: options.maxRows || 25,
      requireAnalyzed: false,
    });

    if (prepared.pairs.length === 0) {
      const source = options.datasetType || 'all';
      throw new NoFeedbackError(
        source === 'all'
          ? 'There is no feedback to adapt yet. Import a CSV on the Feedback page first.'
          : `No feedback records match the "${source}" source. Import a CSV on the Feedback page, or pick "All Feedback Records".`
      );
    }

    const runId = `ds_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const isExplicitSimulate = Boolean(options.simulateRun);
    const isMockRun = isExplicitSimulate || this.client.isMockMode();
    const estimate = this.getEstimate({
      datasetType: options.datasetType,
      maxRows: options.maxRows,
      simulateRun: isMockRun,
    });

    // 2. Handle missing configuration without blocking the platform
    if (!status.configured && !isExplicitSimulate) {
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
        estimate,
        confirmed: false,
        idempotencyKey: options.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      };

      await this.store.saveAdaptionRun(unconfiguredRun);
      if (options.idempotencyKey) {
        this.recentIdempotencyMap.set(options.idempotencyKey, { runId: unconfiguredRun.id, timestamp: Date.now() });
      }
      return unconfiguredRun;
    }

    // 3. Estimate-only request
    if (options.estimateOnly) {
      const estimateRecord: AdaptionRunRecord = {
        id: runId,
        name: runName,
        datasetVersion: prepared.datasetVersion,
        status: 'pending',
        recordsCount: prepared.pairs.length,
        trainingType: 'instruction_dataset',
        columnMapping: prepared.columnMapping,
        samplePairs: prepared.pairs.slice(0, 5),
        benchmarkIntegrated: false,
        isMock: isMockRun,
        estimate,
        confirmed: false,
        idempotencyKey: options.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      };
      await this.store.saveAdaptionRun(estimateRecord);
      if (options.idempotencyKey) {
        this.recentIdempotencyMap.set(options.idempotencyKey, { runId: estimateRecord.id, timestamp: Date.now() });
      }
      return estimateRecord;
    }

    // 4. Paid/Credit Protection: Require explicit confirmation for live non-mock runs
    if (!isMockRun && options.confirmed !== true) {
      const blockedRecord: AdaptionRunRecord = {
        id: runId,
        name: runName,
        datasetVersion: prepared.datasetVersion,
        status: 'blocked_confirmation_required',
        recordsCount: prepared.pairs.length,
        trainingType: 'instruction_dataset',
        columnMapping: prepared.columnMapping,
        samplePairs: prepared.pairs.slice(0, 5),
        benchmarkIntegrated: false,
        errorMessage: `Confirmation required before starting live run. Estimated cost: ${estimate.estimatedCredits} credits. Please confirm to proceed.`,
        isMock: false,
        estimate,
        confirmed: false,
        idempotencyKey: options.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      };

      await this.store.saveAdaptionRun(blockedRecord);
      if (options.idempotencyKey) {
        this.recentIdempotencyMap.set(options.idempotencyKey, { runId: blockedRecord.id, timestamp: Date.now() });
      }
      return blockedRecord;
    }

    // Use active client
    const activeClient = isExplicitSimulate ? new AdaptionApiClient({ isMock: true }) : this.client;

    try {
      // 5. Ingest dataset
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

      // 6. Initiate dataset adaptation
      await activeClient.adaptDataset({
        datasetId: actualDatasetId,
        columnMapping: prepared.columnMapping,
        trainingType: 'instruction_dataset',
        estimate: false,
        maxRows: options.maxRows,
      });

      // 7. Retrieve evaluation metrics
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
        console.warn(`[AdaptionService] Evaluation for ${actualDatasetId} not yet ready:`, activeClient.sanitizeErrorMessage(String(evalErr)));
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
        estimate,
        confirmed: Boolean(options.confirmed),
        idempotencyKey: options.idempotencyKey,
        createdAt: now,
        updatedAt: now,
        completedAt: runStatus === 'succeeded' ? now : undefined,
      };

      await this.store.saveAdaptionRun(runRecord);
      if (runRecord.status === 'succeeded') {
        this.exemplarLibrary.syncFromRuns(this.store.getAdaptionRuns());
      }
      if (options.idempotencyKey) {
        this.recentIdempotencyMap.set(options.idempotencyKey, { runId: runRecord.id, timestamp: Date.now() });
      }
      return runRecord;
    } catch (err: unknown) {
      const rawError = err instanceof Error ? err.message : 'Unknown Adaption execution error';
      const errorMessage = activeClient.sanitizeErrorMessage(rawError);
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
        estimate,
        confirmed: Boolean(options.confirmed),
        idempotencyKey: options.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      };

      await this.store.saveAdaptionRun(failedRecord);
      if (options.idempotencyKey) {
        this.recentIdempotencyMap.set(options.idempotencyKey, { runId: failedRecord.id, timestamp: Date.now() });
      }
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
      if (existing.status === 'succeeded') {
        this.exemplarLibrary.syncFromRuns(this.store.getAdaptionRuns());
      }
      return existing;
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Failed to sync with Adaption API';
      existing.errorMessage = activeClient.sanitizeErrorMessage(raw);
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
    const fromLibrary = this.exemplarLibrary.getApprovedExemplars();
    if (fromLibrary.length > 0) {
      return fromLibrary;
    }
    this.exemplarLibrary.syncFromRuns(this.store.getAdaptionRuns());
    return this.exemplarLibrary.getApprovedExemplars();
  }

  /**
   * Returns metadata about the active exemplar library.
   */
  public getExemplarLibraryMetadata(): ExemplarLibraryMetadata {
    return this.exemplarLibrary.getMetadata();
  }

  /**
   * Toggles whether Adaption approved exemplars are actively injected into the analysis prompt.
   */
  public toggleExemplars(enabled: boolean): ExemplarLibraryMetadata {
    this.exemplarLibrary.setEnabled(enabled);
    return this.exemplarLibrary.getMetadata();
  }

  /**
   * Runs an honest, empirical comparison between baseline and Adaption-enhanced analysis.
   */
  public async evaluateComparison(options: RunEvaluationOptions = {}): Promise<AdaptionEvaluationComparison> {
    return this.evaluationService.evaluateComparison(options);
  }

  /**
   * Returns the most recent persisted evaluation comparison.
   */
  public getLatestEvaluation(): AdaptionEvaluationComparison | null {
    return this.evaluationService.getLatestEvaluation();
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
