import type { AnalyticsFilterParams, AnalyticsMetricsResponse, DatasetStatus } from '../types/analytics';

export async function fetchAnalyticsMetrics(
  filters: AnalyticsFilterParams = {}
): Promise<AnalyticsMetricsResponse> {
  const params = new URLSearchParams();

  if (filters.category && filters.category !== 'all') {
    params.append('category', filters.category);
  }
  if (filters.sentiment && filters.sentiment !== 'all') {
    params.append('sentiment', filters.sentiment);
  }
  if (filters.topic && filters.topic !== 'all') {
    params.append('topic', filters.topic);
  }
  if (filters.analysisStatus && filters.analysisStatus !== 'all') {
    params.append('analysisStatus', filters.analysisStatus);
  }
  if (filters.datasetType && filters.datasetType !== 'all') {
    params.append('datasetType', filters.datasetType);
  }
  if (filters.search && filters.search.trim()) {
    params.append('search', filters.search.trim());
  }

  const queryString = params.toString();
  const url = queryString ? `/api/analytics?${queryString}` : '/api/analytics';

  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch analytics metrics (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchDatasetStatus(): Promise<DatasetStatus> {
  const res = await fetch('/api/dataset/status');
  if (!res.ok) {
    throw new Error(`Failed to fetch dataset status (HTTP ${res.status})`);
  }
  return res.json();
}

export async function seedSampleDataset(reset: boolean = false): Promise<any> {
  const res = await fetch('/api/dataset/seed-sample', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reset }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to seed sample dataset');
  }
  return res.json();
}

export interface ManualFeedbackPayload {
  review: string;
  category?: string;
}

export interface ManualFeedbackResponse {
  success: boolean;
  message: string;
  submissionStatus: 'submitted';
  analysisStatus: 'analyzed' | 'pending' | 'failed';
  analysisError?: string | null;
  data: {
    id: string;
    review: string;
    category: string;
    contentHash: string;
    source: string;
    rowNumber: number;
    batchId: string;
    importedAt: string;
    isSample: boolean;
    datasetType: string;
    analysis?: {
      id: string;
      sentiment: string;
      sentimentScore: number;
      urgency: string;
      urgencyScore: number;
      primaryTopic: string;
      topics: string[];
      keyPhrases: string[];
      summary: string;
      severity: number;
      confidenceScore: number;
      analyzedAt: string;
    } | null;
  };
}

export async function submitManualFeedback(
  payload: ManualFeedbackPayload
): Promise<ManualFeedbackResponse> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Failed to submit feedback (HTTP ${res.status})`);
    (err as any).status = res.status;
    (err as any).errorType = data.error;
    throw err;
  }
  return data;
}
