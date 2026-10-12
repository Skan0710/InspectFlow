import type { AnalyticsFilterParams, AnalyticsMetricsResponse, DatasetStatus } from '../types/analytics';
import type { ChatHistoryTurn, ChatResponse } from '../types/chat';

export const fallbackAnalyticsMetrics: AnalyticsMetricsResponse = {
  filtersApplied: {
    category: 'all',
    sentiment: 'all',
    topic: 'all',
    analysisStatus: 'all',
    severity: 'all',
    datasetType: 'all',
    search: '',
  },
  summary: {
    totalFeedback: 0,
    analyzedFeedback: 0,
    pendingAnalysis: 0,
    analysisCoveragePercent: 0,
    hasAnalysisRun: false,
    isEmpty: true,
    statusMessage: 'Ready to load and analyze feedback dataset.',
  },
  sentiment: {
    denominator: 0,
    counts: { positive: 0, neutral: 0, negative: 0, mixed: 0 },
    percentages: { positive: 0, neutral: 0, negative: 0, mixed: 0 },
    averageSentimentScore: null,
    averageSeverity: null,
  },
  categories: [],
  issueFrequencies: [],
  priorityRankings: {
    issues: [],
    tierSummary: { critical: 0, high: 0, medium: 0, low: 0 },
    openIssuesCount: 0,
    statusSummary: { open: 0, in_progress: 0, resolved: 0, dismissed: 0 },
    hasScoredIssues: false,
    disclaimer: 'Deterministic priority ranking heuristic based on volume, urgency, and customer impact.',
  },
  duplicateStats: {
    totalFeedback: 0,
    uniqueReviewTexts: 0,
    duplicateFeedbackCount: 0,
    duplicateRatio: 0,
    topRepeatedReviews: [],
  },
  calculatedAt: new Date().toISOString(),
};

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
  if (filters.severity !== undefined && filters.severity !== 'all') {
    params.append('severity', String(filters.severity));
  }
  if (filters.datasetType && filters.datasetType !== 'all') {
    params.append('datasetType', filters.datasetType);
  }
  if (filters.search && filters.search.trim()) {
    params.append('search', filters.search.trim());
  }

  const queryString = params.toString();
  const url = queryString ? `/api/analytics?${queryString}` : '/api/analytics';

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[API] /api/analytics returned HTTP ${res.status}. Falling back to default metrics.`);
      return fallbackAnalyticsMetrics;
    }
    return await res.json();
  } catch (err) {
    console.warn('[API] /api/analytics network error. Using fallback metrics:', err);
    return fallbackAnalyticsMetrics;
  }
}

export async function fetchDatasetStatus(): Promise<DatasetStatus> {
  const fallbackStatus: DatasetStatus = {
    totalRecords: 0,
    genuineCount: 0,
    sampleCount: 0,
    categories: {},
    activeDatasetType: 'empty',
    lastImportAt: null,
    lastBatchId: null,
    analysisStatus: 'not_started',
    hasAnalysisRun: false,
  };

  try {
    const res = await fetch('/api/dataset/status');
    if (!res.ok) {
      console.warn(`[API] /api/dataset/status returned HTTP ${res.status}, using fallback.`);
      return fallbackStatus;
    }
    return await res.json();
  } catch (err) {
    console.warn('[API] /api/dataset/status network error, using fallback:', err);
    return fallbackStatus;
  }
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

import type { ReportRecord, CreateReportRequest } from '../types/reports';

export async function fetchReports(options: { type?: string; status?: string } = {}): Promise<ReportRecord[]> {
  try {
    const params = new URLSearchParams();
    if (options.type && options.type !== 'all') params.append('type', options.type);
    if (options.status && options.status !== 'all') params.append('status', options.status);
    const url = params.toString() ? `/api/reports?${params.toString()}` : '/api/reports';
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[API] /api/reports returned HTTP ${res.status}. Falling back to empty reports list.`);
      return [];
    }
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.warn('[API] /api/reports network error. Using fallback empty list:', err);
    return [];
  }
}

export async function fetchReportById(id: string): Promise<ReportRecord> {
  const res = await fetch(`/api/reports/${id}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Failed to fetch report (HTTP ${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

export async function generateReport(payload: CreateReportRequest): Promise<ReportRecord> {
  const res = await fetch('/api/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Failed to generate report (HTTP ${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

export async function deleteReport(id: string): Promise<void> {
  const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Failed to delete report (HTTP ${res.status})`);
  }
}

export async function sendChatMessage(
  message: string,
  history: ChatHistoryTurn[],
  signal?: AbortSignal
): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `The assistant could not respond (HTTP ${res.status})`);
  }
  return res.json();
}
