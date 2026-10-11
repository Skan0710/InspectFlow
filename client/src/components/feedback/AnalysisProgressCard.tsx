import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Play,
  RotateCcw,
  Square,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

export interface AnalysisRunRecord {
  id: string;
  runType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  itemsTotal: number;
  itemsQueued: number;
  itemsProcessing: number;
  itemsCompleted: number;
  itemsFailed: number;
  failedRecords: Array<{
    feedbackId: string;
    rowNumber?: number;
    category?: string;
    reviewSnippet?: string;
    error: string;
    failedAt: string;
  }>;
  modelName: string;
  startedAt: string;
  completedAt?: string;
  executionDurationMs?: number;
  parameters: Record<string, unknown>;
}

export interface AnalysisStatusResponse {
  run: AnalysisRunRecord | null;
  isRunning: boolean;
  progressPercentage: number;
  dataset: {
    totalRecords: number;
    unanalyzedCount: number;
    analyzedCount: number;
  };
}

interface AnalysisProgressCardProps {
  onAnalysisComplete?: () => void;
  className?: string;
}

export const AnalysisProgressCard: React.FC<AnalysisProgressCardProps> = ({
  onAnalysisComplete,
  className = '',
}) => {
  const [statusData, setStatusData] = useState<AnalysisStatusResponse | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [showFailures, setShowFailures] = useState<boolean>(false);
  const [batchSize, setBatchSize] = useState<number>(10);
  const [concurrency, setConcurrency] = useState<number>(2);
  const [rateLimitDelayMs, setRateLimitDelayMs] = useState<number>(100);
  const [limitScope, setLimitScope] = useState<'all' | 'sample20'>('all');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/analysis/status');
      if (res.ok) {
        const json = await res.json();
        const data: AnalysisStatusResponse = json.data;
        setStatusData(data);

        // If completed or failed and was running, signal parent
        if (data.run?.status === 'completed' && onAnalysisComplete) {
          onAnalysisComplete();
        }
      }
    } catch (err) {
      console.warn('Failed to fetch analysis status:', err);
    }
  }, [onAnalysisComplete]);

  // Initial load
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling effect: poll every 1.5 seconds if running, every 10 seconds otherwise
  useEffect(() => {
    const isRunning = statusData?.isRunning;
    const intervalTime = isRunning ? 1500 : 10000;

    const timer = setInterval(() => {
      fetchStatus();
    }, intervalTime);

    return () => clearInterval(timer);
  }, [statusData?.isRunning, fetchStatus]);

  const handleStartAnalysis = async () => {
    setIsActionLoading(true);
    try {
      const limit = limitScope === 'sample20' ? 20 : undefined;
      const res = await fetch('/api/analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchSize,
          concurrency,
          rateLimitDelayMs,
          limit,
        }),
      });

      if (res.ok || res.status === 202) {
        setShowConfig(false);
        await fetchStatus();
      } else {
        const errJson = await res.json();
        alert(errJson.message || 'Failed to start analysis run');
      }
    } catch (err) {
      console.error('Failed to start analysis:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancelRun = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/analysis/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: statusData?.run?.id }),
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Failed to cancel analysis run:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResumeRun = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/analysis/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchSize,
          concurrency,
          rateLimitDelayMs,
        }),
      });
      if (res.ok || res.status === 202) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Failed to resume analysis run:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const run = statusData?.run;
  const isRunning = Boolean(statusData?.isRunning);
  const progressPercentage = statusData?.progressPercentage || 0;
  const unanalyzedCount = statusData?.dataset?.unanalyzedCount ?? 0;
  const totalDatasetCount = statusData?.dataset?.totalRecords ?? 0;

  const getStatusBadge = () => {
    if (!run) {
      return (
        <Badge variant="neutral">
          <Clock className="w-3 h-3 mr-1" />
          Awaiting Execution
        </Badge>
      );
    }
    switch (run.status) {
      case 'running':
        return (
          <Badge variant="indigo" className="animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-500 mr-1.5 animate-ping" />
            Analyzing Batch...
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="success">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="danger">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="warning">
            <Square className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="neutral">{run.status}</Badge>;
    }
  };

  return (
    <Card className={`border border-slate-200/90 shadow-sm overflow-hidden ${className}`}>
      {/* Top Banner & Title */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-600/30 border border-indigo-400/30 text-indigo-300">
              <Sparkles className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base tracking-tight text-white">
                  AI Structured Batch Analysis Pipeline
                </h3>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Multi-pass classification, grounded evidence extraction, and zero-hallucination sentiment engine.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelRun}
                isLoading={isActionLoading}
                className="bg-red-500/10 border-red-400/40 text-red-200 hover:bg-red-500/20"
                leftIcon={<Square className="w-3.5 h-3.5" />}
              >
                Stop Run
              </Button>
            ) : unanalyzedCount > 0 ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfig(!showConfig)}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                >
                  Tune Params
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={
                    run?.status === 'cancelled' || run?.status === 'failed'
                      ? handleResumeRun
                      : handleStartAnalysis
                  }
                  isLoading={isActionLoading}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-900/40"
                  leftIcon={
                    run?.status === 'cancelled' || run?.status === 'failed' ? (
                      <RotateCcw className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {run?.status === 'cancelled' || run?.status === 'failed'
                    ? `Resume Pipeline (${unanalyzedCount})`
                    : `Start Analysis (${unanalyzedCount})`}
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                All {totalDatasetCount} Reviews Analyzed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tunable Pipeline Configuration Drawer */}
      {showConfig && !isRunning && (
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs animate-in slide-in-from-top-2">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Batch Size (Reviews)</label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="w-full rounded-md border-slate-300 text-xs py-1.5 px-2 bg-white"
            >
              <option value={5}>5 reviews / batch</option>
              <option value={10}>10 reviews / batch (Recommended)</option>
              <option value={20}>20 reviews / batch</option>
            </select>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Bounded batch ingestion</span>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Worker Concurrency</label>
            <select
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full rounded-md border-slate-300 text-xs py-1.5 px-2 bg-white"
            >
              <option value={1}>1 worker (Strict sequential)</option>
              <option value={2}>2 workers (Recommended)</option>
              <option value={4}>4 workers (High throughput)</option>
            </select>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Simultaneous requests</span>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Rate-Limit Backoff Delay</label>
            <select
              value={rateLimitDelayMs}
              onChange={(e) => setRateLimitDelayMs(Number(e.target.value))}
              className="w-full rounded-md border-slate-300 text-xs py-1.5 px-2 bg-white"
            >
              <option value={0}>0ms (Immediate)</option>
              <option value={100}>100ms (Safe)</option>
              <option value={300}>300ms (Conservative quota)</option>
            </select>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Interval between batches</span>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Scope Limit</label>
            <select
              value={limitScope}
              onChange={(e) => setLimitScope(e.target.value as 'all' | 'sample20')}
              className="w-full rounded-md border-slate-300 text-xs py-1.5 px-2 bg-white"
            >
              <option value="all">All unanalyzed ({unanalyzedCount})</option>
              <option value="sample20">Test batch (Next 20 items)</option>
            </select>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Quick test or full run</span>
          </div>
        </div>
      )}

      {/* Progress & Live Metrics Section */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-medium text-slate-700 flex items-center gap-1.5">
              <span>Analysis Progress</span>
              {isRunning && <span className="text-indigo-600 font-semibold animate-pulse">· Live Polling (2s)</span>}
            </span>
            <span className="font-semibold text-slate-900">{progressPercentage}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 shadow-inner">
            <div
              className={`h-full transition-all duration-500 ease-out ${
                run?.status === 'completed'
                  ? 'bg-emerald-500'
                  : run?.status === 'failed'
                  ? 'bg-red-500'
                  : run?.status === 'cancelled'
                  ? 'bg-amber-500'
                  : 'bg-indigo-600'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Counts Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Total in Job</span>
            <span className="text-base font-bold text-slate-800">{run?.itemsTotal ?? 0}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100">
            <span className="text-indigo-700 block text-[11px]">Queued</span>
            <span className="text-base font-bold text-indigo-900">{run?.itemsQueued ?? 0}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-100">
            <span className="text-blue-700 block text-[11px]">Processing</span>
            <span className="text-base font-bold text-blue-900">{run?.itemsProcessing ?? 0}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
            <span className="text-emerald-700 block text-[11px]">Completed</span>
            <span className="text-base font-bold text-emerald-900">{run?.itemsCompleted ?? 0}</span>
          </div>

          <div className={`p-2.5 rounded-lg border ${
            (run?.itemsFailed ?? 0) > 0 ? 'bg-red-50/80 border-red-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className={((run?.itemsFailed ?? 0) > 0) ? 'text-red-700 font-medium block text-[11px]' : 'text-slate-500 block text-[11px]'}>
              Failed
            </span>
            <span className={`text-base font-bold ${(run?.itemsFailed ?? 0) > 0 ? 'text-red-900' : 'text-slate-800'}`}>
              {run?.itemsFailed ?? 0}
            </span>
          </div>
        </div>

        {/* Run Details & Metadata Info Footer */}
        {run && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <span>
                Model: <strong className="text-slate-700 font-mono">{run.modelName}</strong>
              </span>
              <span>·</span>
              <span>
                Run ID: <span className="font-mono">{run.id.slice(0, 8)}...</span>
              </span>
              {run.executionDurationMs !== undefined && (
                <>
                  <span>·</span>
                  <span>Duration: {(run.executionDurationMs / 1000).toFixed(1)}s</span>
                </>
              )}
            </div>

            {run.failedRecords && run.failedRecords.length > 0 && (
              <button
                onClick={() => setShowFailures(!showFailures)}
                className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1 transition-colors"
              >
                <span>View {run.failedRecords.length} Failure Details</span>
                {showFailures ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        )}

        {/* Expandable Failure Details Drawer */}
        {showFailures && run?.failedRecords && run.failedRecords.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center gap-1.5 text-red-800 font-semibold">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Items That Failed During Analysis:</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {run.failedRecords.map((fail, idx) => (
                <div key={idx} className="p-2 rounded bg-white border border-red-200 text-slate-700">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
                    <span>Feedback ID: <span className="font-mono">{fail.feedbackId.slice(0, 8)}...</span></span>
                    <span className="text-red-600 font-semibold">{fail.error}</span>
                  </div>
                  {fail.reviewSnippet && (
                    <p className="text-[11px] text-slate-600 italic">"{fail.reviewSnippet}..."</p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
              <Info className="w-3 h-3 text-slate-400" />
              Failed items are left unanalyzed so clicking "Resume Pipeline" will automatically retry them safely.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
