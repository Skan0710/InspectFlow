export interface RawFeedbackRecord {
  id: string;
  review: string;
  category: string;
  contentHash: string;
  source: string;
  rowNumber: number;
  batchId: string;
  importedAt: string;
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
}

export const VALID_CATEGORIES = new Set([
  'Product Feedback',
  'Customer Service',
  'Fraud and Scam',
  'Operational Issues',
]);
