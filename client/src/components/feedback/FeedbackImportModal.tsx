import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  RefreshCw, 
  FileSpreadsheet,
  Sparkles,
  Info,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface ImportSummary {
  batchId: string;
  fileName: string;
  fileSizeBytes: number;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  categoryBreakdown: Record<string, number>;
  errors: Array<{
    rowNumber: number;
    errorType: string;
    message: string;
    rawPreview?: string;
  }>;
  importedAt: string;
  status: 'completed' | 'partial' | 'failed';
  isSample?: boolean;
  datasetType?: string;
}

interface FeedbackImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (summary: ImportSummary) => void;
  onStartAnalysis?: (importedCount: number) => void;
}

export const FeedbackImportModal: React.FC<FeedbackImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onStartAnalysis,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [resultSummary, setResultSummary] = useState<ImportSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setErrorMessage('Please select a valid CSV file (.csv)');
      return;
    }
    setFile(selectedFile);
    setErrorMessage(null);
    setResultSummary(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleStartImport = async () => {
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    setProgressStep('Streaming dataset to server...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('skipDuplicates', String(skipDuplicates));

    try {
      setProgressStep('Validating headers & streaming rows...');

      const res = await fetch('/api/feedback/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Import failed with server error');
      }

      setProgressStep('Finalizing batch metrics...');
      setResultSummary(data.summary);
      onImportSuccess(data.summary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import CSV';
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
      setProgressStep('');
    }
  };

  const handleReset = () => {
    setFile(null);
    setResultSummary(null);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                CSV Customer Feedback Ingestion
              </h3>
              <p className="text-xs text-slate-500">
                Streamed batch intake with schema validation and duplicate handling
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-semibold">Import Error</p>
                <p className="mt-0.5 text-rose-700">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Success Summary View */}
          {resultSummary ? (
            <div className="space-y-5 animate-in fade-in">
              <div className={`rounded-xl border p-5 ${
                resultSummary.status === 'failed'
                  ? 'border-rose-200 bg-rose-50/80 text-rose-800'
                  : resultSummary.status === 'partial'
                  ? 'border-amber-200 bg-amber-50/80 text-amber-800'
                  : 'border-emerald-200 bg-emerald-50/80 text-emerald-800'
              }`}>
                <div className="flex items-center gap-2 font-semibold text-sm">
                  {resultSummary.status === 'failed' ? (
                    <>
                      <AlertCircle className="h-5 w-5 text-rose-600" />
                      <span>Ingestion Failed — No Valid Records Imported</span>
                    </>
                  ) : resultSummary.status === 'partial' ? (
                    <>
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <span>Partial Ingestion — Some Rows Failed Validation</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span>Batch Processed Successfully</span>
                    </>
                  )}
                </div>
                <p className="text-xs mt-1">
                  Batch ID: <strong className="font-mono">{resultSummary.batchId}</strong>
                </p>
              </div>

              {/* Duplicate Notice Banner when all rows were skipped */}
              {resultSummary.importedCount === 0 && resultSummary.skippedCount > 0 && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-xs text-indigo-900 flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Idempotent Deduplication: </span>
                    <span>
                      All {resultSummary.skippedCount.toLocaleString()} rows in this file match existing records in the database.
                      Duplicate rows were safely skipped, and all previously stored customer reviews and AI analyses were preserved intact.
                    </span>
                  </div>
                </div>
              )}

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-center">
                  <span className="text-xs text-slate-500 font-medium">Total Rows</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {resultSummary.totalRows.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-center">
                  <span className="text-xs text-emerald-700 font-medium">Imported</span>
                  <div className="text-xl font-bold text-emerald-700 mt-1">
                    {resultSummary.importedCount.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 text-center">
                  <span className="text-xs text-amber-700 font-medium">Skipped</span>
                  <div className="text-xl font-bold text-amber-700 mt-1">
                    {resultSummary.skippedCount.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-center">
                  <span className="text-xs text-slate-500 font-medium">Failed</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {resultSummary.failedCount}
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-2.5">
                <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                  Supplied Category Breakdown
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(resultSummary.categoryBreakdown).map(([cat, count]) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs border border-slate-200/60"
                    >
                      <span className="font-medium text-slate-700">{cat}</span>
                      <Badge variant="indigo" size="sm">
                        {count.toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row-level errors if any */}
              {resultSummary.errors.length > 0 && (
                <div className="rounded-xl border border-rose-200 p-4 bg-rose-50/40 space-y-2">
                  <span className="text-xs font-semibold text-rose-900 uppercase tracking-wider">
                    Row-Level Errors ({resultSummary.errors.length})
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-xs">
                    {resultSummary.errors.map((err, i) => (
                      <div key={i} className="text-rose-700 font-mono text-[11px]">
                        Row {err.rowNumber}: [{err.errorType}] {err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* File Dropzone */}
              {!file ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-600 bg-indigo-50/50'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-3 ring-8 ring-indigo-50/50">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <h4 className="font-semibold text-sm text-slate-900">
                    Click to browse or drop your CSV file here
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    Accepts <code>BuildBattle_2026_Customer_Feedback_Dataset.csv</code> with <code>review</code> and <code>category</code> headers.
                  </p>
                </div>
              ) : (
                /* Selected File Card */
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 truncate max-w-xs sm:max-w-md">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {(file.size / 1024).toFixed(1)} KB • text/csv
                      </p>
                    </div>
                  </div>
                  {!isUploading && (
                    <Button variant="ghost" size="sm" onClick={handleReset}>
                      Change
                    </Button>
                  )}
                </div>
              )}

              {/* Ingestion Settings Checklist */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-3">
                <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                  Validation & Schema Specifications
                </span>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Dynamic column headers inspected (<code>review</code>, <code>category</code>)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Validated categories: Product Feedback, Customer Service, Fraud and Scam, Operational Issues</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Original verbatim review text preserved without artificial scoring</span>
                  </li>
                </ul>

                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      disabled={isUploading}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="font-medium">
                      Enable Idempotent Deduplication (Skip identical re-imported records)
                    </span>
                  </label>
                </div>
              </div>

              {/* Progress State */}
              {isUploading && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                      {progressStep}
                    </span>
                    <span>Processing stream</span>
                  </div>
                  <div className="h-1.5 w-full bg-indigo-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full animate-pulse w-3/4" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-6 py-4 bg-slate-50/70">
          {resultSummary ? (
            <>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Import Another File
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Done & View Feed
                </Button>
                {resultSummary.importedCount > 0 && onStartAnalysis && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onStartAnalysis(resultSummary.importedCount);
                    }}
                    leftIcon={<Sparkles className="h-4 w-4" />}
                    className="bg-indigo-600 hover:bg-indigo-500 shadow-sm"
                  >
                    Start AI Analysis ({resultSummary.importedCount.toLocaleString()} new)
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={onClose} disabled={isUploading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartImport}
                disabled={!file || isUploading}
                isLoading={isUploading}
                leftIcon={<UploadCloud className="h-4 w-4" />}
              >
                Start Ingestion Stream
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
