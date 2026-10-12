import type {
  AdaptionConfig,
  AdaptionColumnMapping,
  AdaptionQualityMetrics,
  AdaptionRunStatus,
  AdaptionTrainingType,
  AdaptionEstimate,
} from './types.js';

export interface DatasetCreateResponse {
  dataset_id: string;
  name: string;
  status: string;
}

export interface DatasetAdaptResponse {
  dataset_id: string;
  status: string;
  message?: string;
  estimated_cost?: number;
  estimated_credits?: number;
  row_count?: number;
  multimodalPricingApplied?: boolean;
}

export interface DatasetStatusResponse {
  dataset_id: string;
  status: AdaptionRunStatus;
  progress?: number;
  message?: string;
}

export interface DatasetEvaluationResponse {
  dataset_id: string;
  status: string;
  quality?: AdaptionQualityMetrics;
  raw_results?: Record<string, unknown>;
}

export class AdaptionApiClient {
  private apiKey: string;
  private baseUrl: string;
  private isMock: boolean;
  private timeoutMs: number;

  constructor(config?: Partial<AdaptionConfig>) {
    this.apiKey = (config?.apiKey ?? process.env.ADAPTION_API_KEY ?? '').trim();
    this.baseUrl = (config?.baseUrl ?? process.env.ADAPTION_BASE_URL ?? 'https://api.prod.adaptionlabs.ai/api/v1').replace(/\/+$/, '');
    this.isMock = Boolean(config?.isMock ?? process.env.ADAPTION_MOCK === 'true');
    this.timeoutMs = config?.timeoutMs ?? 15000;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0) || this.isMock;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public isMockMode(): boolean {
    return this.isMock;
  }

  /**
   * Safely returns a masked preview of the configured API key without leaking the secret.
   */
  public getMaskedApiKey(): string | undefined {
    if (!this.apiKey) return undefined;
    if (this.apiKey.length <= 8) return '********';
    return `${this.apiKey.slice(0, 6)}...${this.apiKey.slice(-4)}`;
  }

  /**
   * Sanitizes error messages to prevent accidental credential or bearer token leakage in logs and API responses.
   */
  public sanitizeErrorMessage(rawMessage: string): string {
    if (!rawMessage) return 'Unknown error';
    let sanitized = String(rawMessage);
    if (this.apiKey) {
      sanitized = sanitized.split(this.apiKey).join('[REDACTED]');
    }
    // Redact any bearer tokens
    sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
    return sanitized;
  }

  /**
   * Performs an authenticated live ping against the Adaption API to verify credentials.
   */
  public async testConnection(): Promise<{ ok: boolean; status: number; message: string }> {
    if (this.isMock) {
      return {
        ok: true,
        status: 200,
        message: 'Verified simulation mode (ADAPTION_MOCK=true). Local execution enabled.',
      };
    }

    if (!this.apiKey) {
      return {
        ok: false,
        status: 400,
        message: 'ADAPTION_API_KEY is not configured in server environment variables.',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/datasets`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          message: 'Adaption Labs API authenticated successfully.',
        };
      }

      let detail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const json = await response.json() as Record<string, unknown>;
        if (json && typeof json === 'object') {
          detail = (json.message || json.error || JSON.stringify(json)) as string;
        }
      } catch {
        // Non-JSON response
      }

      const sanitizedDetail = this.sanitizeErrorMessage(detail);

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          status: response.status,
          message: `Adaption API credential rejected (${sanitizedDetail}). Please verify your token in your Adaption Labs dashboard.`,
        };
      }

      return {
        ok: false,
        status: response.status,
        message: `Adaption API check returned HTTP ${response.status}: ${sanitizedDetail}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        status: 0,
        message: `Failed to connect to Adaption Labs (${this.sanitizeErrorMessage(msg)})`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Helper to execute authenticated requests against official Adaption Labs REST API.
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      headers?: Record<string, string>;
      timeoutMs?: number;
    } = {}
  ): Promise<T> {
    if (!this.apiKey && !this.isMock) {
      throw new Error(
        'Adaption API key is missing. Set ADAPTION_API_KEY in server environment variables or enable mock mode.'
      );
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const timeout = options.timeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...options.headers,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorDetails = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errJson = (await response.json()) as Record<string, unknown>;
          if (errJson && typeof errJson === 'object') {
            errorDetails = (errJson.message || errJson.error || JSON.stringify(errJson)) as string;
          }
        } catch {
          // If non-JSON response
        }

        const safeDetails = this.sanitizeErrorMessage(errorDetails);

        if (response.status === 401) {
          throw new Error(`Adaption authentication failed (401 Unauthorized): ${safeDetails}. Please verify ADAPTION_API_KEY.`);
        }
        if (response.status === 403) {
          throw new Error(`Adaption access forbidden (403 Forbidden): ${safeDetails}. The provided API key was rejected by Adaption Labs.`);
        }
        if (response.status === 404) {
          throw new Error(`Adaption resource not found at ${endpoint}: ${safeDetails}`);
        }
        if (response.status === 429) {
          throw new Error(`Adaption rate limit exceeded (429 Too Many Requests): ${safeDetails}`);
        }

        throw new Error(`Adaption API error [${response.status}]: ${safeDetails}`);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Adaption API request timed out after ${timeout}ms.`);
      }
      if (err instanceof Error) {
        err.message = this.sanitizeErrorMessage(err.message);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Ingest/Create dataset on Adaption Labs platform
   * POST /api/v1/datasets
   */
  public async createDataset(params: {
    name: string;
    description?: string;
    records?: Array<Record<string, unknown>>;
  }): Promise<DatasetCreateResponse> {
    if (this.isMock) {
      return {
        dataset_id: `ds_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: params.name,
        status: 'created',
      };
    }

    return this.request<DatasetCreateResponse>('/datasets', {
      method: 'POST',
      body: {
        name: params.name,
        description: params.description || 'Customer feedback instruction dataset from InsightFlow',
        data: params.records || [],
      },
    });
  }

  /**
   * Start dataset adaptation on Adaption Labs platform
   * POST /api/v1/datasets/{dataset_id}/adapt
   */
  public async adaptDataset(params: {
    datasetId: string;
    columnMapping: AdaptionColumnMapping;
    trainingType?: AdaptionTrainingType;
    estimate?: boolean;
    maxRows?: number;
  }): Promise<DatasetAdaptResponse> {
    if (this.isMock) {
      const rows = params.maxRows || 20;
      return {
        dataset_id: params.datasetId,
        status: params.estimate ? 'estimated' : 'running',
        estimated_cost: Number((rows * 0.005).toFixed(3)),
        estimated_credits: Math.max(1, Math.ceil(rows / 10)),
        row_count: rows,
        message: params.estimate
          ? `Estimated ${Math.max(1, Math.ceil(rows / 10))} credits for ${rows} prompt-completion rows.`
          : 'Mock adaptation run initiated successfully.',
      };
    }

    const body: Record<string, unknown> = {
      column_mapping: params.columnMapping,
      training_type: params.trainingType || 'instruction_dataset',
    };

    if (params.estimate !== undefined) {
      body.estimate = params.estimate;
    }

    if (params.maxRows !== undefined) {
      body.job_specification = { max_rows: params.maxRows };
    }

    return this.request<DatasetAdaptResponse>(`/datasets/${encodeURIComponent(params.datasetId)}/adapt`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Checks status of dataset processing
   * GET /api/v1/datasets/{dataset_id}/status
   */
  public async getDatasetStatus(datasetId: string): Promise<DatasetStatusResponse> {
    if (this.isMock) {
      return {
        dataset_id: datasetId,
        status: 'succeeded',
        progress: 100,
        message: 'Mock dataset adaptation completed successfully.',
      };
    }

    return this.request<DatasetStatusResponse>(`/datasets/${encodeURIComponent(datasetId)}/status`, {
      method: 'GET',
    });
  }

  /**
   * Retrieve structured evaluation metrics
   * GET /api/v1/datasets/{dataset_id}/evaluation
   */
  public async getEvaluation(datasetId: string): Promise<DatasetEvaluationResponse> {
    if (this.isMock) {
      return {
        dataset_id: datasetId,
        status: 'succeeded',
        quality: {
          grade_before: 'C',
          grade_after: 'A',
          score_before: 6.4,
          score_after: 8.8,
          percentile_after: 94.2,
          improvement_percent: 37.5,
        },
        raw_results: {
          source: 'InsightFlow Customer Feedback Instruction Corpus',
          evaluated_samples: 20,
          diversity_score: 0.91,
          clarity_score: 0.89,
          task_relevance: 0.96,
        },
      };
    }

    return this.request<DatasetEvaluationResponse>(`/datasets/${encodeURIComponent(datasetId)}/evaluation`, {
      method: 'GET',
    });
  }

  /**
   * Download/Export dataset in specified format
   * GET /api/v1/datasets/{dataset_id}/download
   */
  public async downloadDataset(datasetId: string, format: 'jsonl' | 'csv' | 'json' = 'jsonl'): Promise<string> {
    if (this.isMock) {
      return JSON.stringify({
        mock_download: true,
        dataset_id: datasetId,
        format,
        note: 'Mock exported dataset representation',
      });
    }

    const response = await fetch(`${this.baseUrl}/datasets/${encodeURIComponent(datasetId)}/download?format=${format}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const safeText = this.sanitizeErrorMessage(response.statusText);
      throw new Error(`Failed to download Adaption dataset [HTTP ${response.status}]: ${safeText}`);
    }

    return response.text();
  }
}
