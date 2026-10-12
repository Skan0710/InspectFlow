import type {
  AdaptionConfig,
  AdaptionColumnMapping,
  AdaptionQualityMetrics,
  AdaptionRunStatus,
  AdaptionTrainingType,
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

  constructor(config?: Partial<AdaptionConfig>) {
    this.apiKey = (config?.apiKey || process.env.ADAPTION_API_KEY || '').trim();
    this.baseUrl = (config?.baseUrl || process.env.ADAPTION_BASE_URL || 'https://api.prod.adaptionlabs.ai/api/v1').replace(/\/+$/, '');
    this.isMock = Boolean(config?.isMock || process.env.ADAPTION_MOCK === 'true');
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
    const timeout = options.timeoutMs ?? 15000;
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
          const errJson = await response.json() as Record<string, unknown>;
          if (errJson && typeof errJson === 'object') {
            errorDetails = (errJson.message || errJson.error || JSON.stringify(errJson)) as string;
          }
        } catch {
          // If non-JSON response
        }

        if (response.status === 401) {
          throw new Error(`Adaption authentication failed: ${errorDetails}. Please verify ADAPTION_API_KEY.`);
        }
        if (response.status === 404) {
          throw new Error(`Adaption resource not found at ${endpoint}: ${errorDetails}`);
        }
        if (response.status === 429) {
          throw new Error(`Adaption rate limit exceeded (429): ${errorDetails}`);
        }

        throw new Error(`Adaption API error [${response.status}]: ${errorDetails}`);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Adaption API request timed out after ${timeout}ms.`);
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
      return {
        dataset_id: params.datasetId,
        status: 'running',
        message: 'Mock adaptation run initiated successfully.',
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
   * Check status of dataset processing
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
      throw new Error(`Failed to download Adaption dataset [HTTP ${response.status}]: ${response.statusText}`);
    }

    return response.text();
  }
}
