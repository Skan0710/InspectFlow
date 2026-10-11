export type DatasetOriginType = 'genuine_import' | 'demo_sample';

export interface RawFeedbackRecord {
  id: string;
  review: string;
  category: string;
  contentHash: string;
  source: string;
  rowNumber: number;
  batchId: string;
  importedAt: string;
  isSample: boolean;
  datasetType: DatasetOriginType;
}

export interface ImportRowError {
  rowNumber: number;
  errorType: 'EMPTY_REVIEW' | 'INVALID_CATEGORY' | 'MALFORMED_ROW' | 'MISSING_COLUMNS';
  message: string;
  rawPreview?: string;
}

export interface ImportSummary {
  batchId: string;
  fileName: string;
  fileSizeBytes: number;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  categoryBreakdown: Record<string, number>;
  errors: ImportRowError[];
  importedAt: string;
  status: 'completed' | 'partial' | 'failed';
  isSample: boolean;
  datasetType: DatasetOriginType;
}

export interface DatasetStatus {
  totalRecords: number;
  genuineCount: number;
  sampleCount: number;
  categories: Record<string, number>;
  activeDatasetType: 'empty' | 'genuine' | 'sample' | 'mixed';
  lastImportAt: string | null;
  lastBatchId: string | null;
  analysisStatus: 'not_started' | 'running' | 'completed';
  hasAnalysisRun: boolean;
}

export const VALID_CATEGORIES = new Set([
  'Product Feedback',
  'Customer Service',
  'Fraud and Scam',
  'Operational Issues',
]);
