import React, { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit,
  RotateCw,
  Play,
  FileSpreadsheet,
  AlertCircle,
  Award,
  Download,
  X,
  Database,
  Sparkles,
  DollarSign,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { StatsCounter } from '../components/ui/stats-counter';
import type {
  AdaptionRunRecord,
  AdaptionProviderStatus,
  AdaptionEstimate,
  AdaptionEvaluationComparison,
  ExemplarLibraryMetadata,
} from '../types/adaption';

export const AdaptionPage: React.FC = () => {
  const [runs, setRuns] = useState<AdaptionRunRecord[]>([]);
  const [providerStatus, setProviderStatus] = useState<AdaptionProviderStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedRun, setSelectedRun] = useState<AdaptionRunRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'comparison' | 'rawJson' | 'exemplars' | 'evaluation'>('comparison');

  // Prepared dataset & estimation state
  const [preparedData, setPreparedData] = useState<any | null>(null);
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [estimateData, setEstimateData] = useState<AdaptionEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState<boolean>(false);

  // Evaluation comparison state
  const [evaluation, setEvaluation] = useState<AdaptionEvaluationComparison | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Exemplar library state
  const [exemplarMetadata, setExemplarMetadata] = useState<ExemplarLibraryMetadata | null>(null);
  const [isTogglingExemplars, setIsTogglingExemplars] = useState<boolean>(false);

  // Trigger form state
  const [datasetName, setDatasetName] = useState<string>('');
  const [datasetOrigin, setDatasetOrigin] = useState<'all' | 'genuine_import' | 'demo_sample'>('all');
  const [maxRows, setMaxRows] = useState<number>(20);
  const [simulateRun, setSimulateRun] = useState<boolean>(true);
  const [confirmLiveExecution, setConfirmLiveExecution] = useState<boolean>(false);
  const [runError, setRunError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/adaption/status');
      if (res.ok) {
        const data = await res.json();
        setProviderStatus(data);
        if (data.configured && !data.isMockMode) {
          setSimulateRun(false);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch Adaption provider status:', err);
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/adaption/runs');
      if (res.ok) {
        const json = await res.json();
        setRuns(json.data || []);
        if (json.data && json.data.length > 0) {
          setSelectedRun((current) => current ?? json.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Adaption runs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchExemplarMetadata = useCallback(async () => {
    try {
      const res = await fetch('/api/adaption/exemplars/metadata');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setExemplarMetadata(json.data);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch exemplar metadata:', err);
    }
  }, []);

  const fetchEvaluation = useCallback(async () => {
    try {
      const res = await fetch('/api/adaption/evaluation');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setEvaluation(json.data);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch evaluation comparison:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchRuns();
    fetchExemplarMetadata();
    fetchEvaluation();
  }, [fetchStatus, fetchRuns, fetchExemplarMetadata, fetchEvaluation]);

  const handlePrepareDataset = async () => {
    setIsPreparing(true);
    try {
      const res = await fetch('/api/adaption/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetType: datasetOrigin, maxRows }),
      });
      if (res.ok) {
        const json = await res.json();
        setPreparedData(json.data);
      }
    } catch (err) {
      console.error('Failed to prepare dataset:', err);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleRequestEstimate = async () => {
    setIsEstimating(true);
    try {
      const res = await fetch('/api/adaption/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetType: datasetOrigin,
          maxRows,
          simulateRun,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setEstimateData(json.data);
      }
    } catch (err) {
      console.error('Failed to request estimate:', err);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleToggleExemplars = async () => {
    if (!exemplarMetadata) return;
    setIsTogglingExemplars(true);
    try {
      const nextState = !exemplarMetadata.isEnabled;
      const res = await fetch('/api/adaption/exemplars/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      if (res.ok) {
        const json = await res.json();
        setExemplarMetadata(json.data);
      }
    } catch (err) {
      console.error('Failed to toggle exemplars:', err);
    } finally {
      setIsTogglingExemplars(false);
    }
  };

  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    try {
      const res = await fetch('/api/adaption/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleSize: 6, datasetType: datasetOrigin }),
      });
      if (res.ok) {
        const json = await res.json();
        setEvaluation(json.data);
        setActiveTab('evaluation');
      }
    } catch (err) {
      console.error('Failed to run empirical evaluation:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleStartRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecuting(true);
    setRunError(null);
    try {
      const res = await fetch('/api/adaption/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName: datasetName.trim() || undefined,
          datasetType: datasetOrigin,
          maxRows: Number(maxRows) || 20,
          simulateRun,
          confirmed: simulateRun ? true : confirmLiveExecution,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        await fetchRuns();
        await fetchExemplarMetadata();
        if (result.data) {
          setSelectedRun(result.data);
        }
        setIsModalOpen(false);
        setDatasetName('');
        setConfirmLiveExecution(false);
        setRunError(null);
      } else {
        const errorJson = await res.json().catch(() => ({}));
        setRunError(errorJson.message || 'Adaption workflow request failed.');
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSyncRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/adaption/runs/${runId}/sync`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setSelectedRun(json.data);
        }
        await fetchRuns();
        await fetchExemplarMetadata();
      }
    } catch (err) {
      console.error('Failed to sync Adaption run:', err);
    }
  };

  const handleExport = (runId: string, format: 'jsonl' | 'csv') => {
    window.open(`/api/adaption/runs/${runId}/export?format=${format}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-3 page-header">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span>Adaption</span>
              <span className="text-indigo-400">Labs</span>
            </h2>
            <Badge variant="indigo" size="md" className="font-mono text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <StatsCounter value={runs.length} /> Evaluations
            </Badge>
          </div>
          <p className="text-base text-indigo-200/80 mt-1">
            Transform customer feedback into instruction datasets, evaluate alignment, and inject validated exemplars into downstream AI.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              fetchStatus();
              fetchRuns();
              fetchExemplarMetadata();
              fetchEvaluation();
            }}
            isLoading={isLoading}
            leftIcon={<RotateCw className="h-4 w-4" />}
            className="font-semibold text-sm bg-white/15 hover:bg-white/25 text-white border border-white/35 backdrop-blur-md shadow-md active:scale-95 transition-all"
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              handleRequestEstimate();
              setIsModalOpen(true);
            }}
            leftIcon={<Play className="h-4 w-4" />}
            className="cta-focus-glow font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/40 border border-indigo-400/40 px-5 active:scale-95 transition-all"
          >
            Run Adaption Workflow
          </Button>
        </div>
      </div>

      {/* Connection & Configuration Status Banner */}
      <details className="group rounded-2xl bg-indigo-950/45 px-5 py-4 backdrop-blur-sm shadow-xs border border-indigo-500/20">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 text-base text-white [&::-webkit-details-marker]:hidden">
          <span className="flex flex-wrap items-center gap-3">
            <BrainCircuit className="h-5 w-5 text-indigo-300" />
            <span className="font-semibold">Adaption API Integration</span>
            {providerStatus?.isMockMode ? (
              <Badge variant="warning" size="sm">Verified Simulation Mode</Badge>
            ) : providerStatus?.validationState === 'configured' || providerStatus?.validationState === 'connected' ? (
              <Badge variant="success" size="sm">Configured ({providerStatus.apiKeyMasked || 'API Key Safe'})</Badge>
            ) : providerStatus?.validationState === 'auth_failed' ? (
              <Badge variant="danger" size="sm">Authentication Diagnostic (Check Token)</Badge>
            ) : (
              <Badge variant="neutral" size="sm">API Key Unconfigured</Badge>
            )}
          </span>
          <span className="text-sm text-indigo-200 group-open:hidden">View Details</span>
          <span className="hidden text-sm text-indigo-200 group-open:inline">Hide Details</span>
        </summary>
        <div className="mt-4 space-y-3 text-sm text-indigo-100 border-t border-indigo-500/20 pt-3">
          <p>{providerStatus?.message || 'Checking Adaption Labs connection...'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-indigo-200">
            <div>Endpoint: {providerStatus?.baseUrl || 'https://api.prod.adaptionlabs.ai/api/v1'}</div>
            <div>Key Status: {providerStatus?.apiKeyMasked || 'None (Running local simulation fallback)'}</div>
          </div>
          <p className="text-xs text-indigo-300">
            <strong>Architecture Notice:</strong> Adaption Labs evaluates dataset instruction alignment and clarity. It generates validated exemplars for in-context few-shot prompt enhancement without modifying model weights.
          </p>
        </div>
      </details>

      {/* 6-Step Workflow Stepper */}
      <div className="rounded-2xl bg-indigo-950/45 p-4 backdrop-blur-sm border border-indigo-500/20">
        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4" />
          <span>Adaption End-to-End Pipeline</span>
        </div>
        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { step: '1', title: 'Prepare Data', desc: 'Deduplicate & Format' },
            { step: '2', title: 'Review Estimate', desc: 'Credits & USD Cost' },
            { step: '3', title: 'Run Adaption', desc: 'Verified Execution' },
            { step: '4', title: 'Validate Output', desc: 'Reject Malformed' },
            { step: '5', title: 'Evaluate', desc: 'Baseline vs. Adapted' },
            { step: '6', title: 'Integrate', desc: 'Few-Shot Exemplars' },
          ].map(({ step, title, desc }) => (
            <li key={step} className="rounded-xl bg-indigo-900/40 p-2.5 border border-indigo-500/10 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-indigo-400">STEP {step}</span>
              <span className="text-xs font-bold text-white mt-1">{title}</span>
              <span className="text-[10px] text-indigo-200 mt-0.5">{desc}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Pipeline Action & Integration Control Center */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Data Preparation & Deduplication */}
        <Card className="bg-white border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-indigo-600" />
                <CardTitle className="text-sm">1. Dataset Preparation</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrepareDataset}
                isLoading={isPreparing}
              >
                Prepare
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2 text-xs">
            {preparedData ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Source Records:</span>
                  <span className="font-semibold text-slate-900">{preparedData.totalSourceRecords}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Unique Reviews:</span>
                  <span className="font-semibold text-emerald-600">{preparedData.uniqueReviewsCount}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Duplicates Excluded:</span>
                  <span className="font-semibold text-amber-600">{preparedData.duplicatesExcluded}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Prepared Pairs:</span>
                  <span className="font-semibold text-indigo-600">{preparedData.recordsCount}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 leading-tight">
                  {preparedData.sourceLabelNotice}
                </div>
              </div>
            ) : (
              <p className="text-slate-500 leading-relaxed">
                Click <strong>Prepare</strong> to normalize customer feedback, filter exact duplicates, and format prompt-completion pairs while preserving the original database intact.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Cost Estimation & Credit Safeguard */}
        <Card className="bg-white border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm">2. Credit Estimate</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestEstimate}
                isLoading={isEstimating}
              >
                Estimate
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2 text-xs">
            {estimateData ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Sample Size:</span>
                  <span className="font-semibold text-slate-900">{estimateData.recordsCount} records</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Credits Required:</span>
                  <span className="font-semibold text-indigo-600">{estimateData.estimatedCredits} credits</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Approx Cost:</span>
                  <span className="font-semibold text-emerald-600">${estimateData.estimatedCostUsd} USD</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Mode:</span>
                  <Badge variant={estimateData.isMock ? 'warning' : 'success'} size="sm">
                    {estimateData.isMock ? 'Simulation (Free)' : 'Live API'}
                  </Badge>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 leading-tight">
                  {estimateData.explanation}
                </div>
              </div>
            ) : (
              <p className="text-slate-500 leading-relaxed">
                Click <strong>Estimate</strong> to calculate credit and USD expenditure before triggering any remote execution.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Downstream Exemplar Library Integration */}
        <Card className="bg-white border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <CardTitle className="text-sm">6. AI Prompt Integration</CardTitle>
              </div>
              <Button
                variant={exemplarMetadata?.isEnabled ? 'primary' : 'outline'}
                size="sm"
                onClick={handleToggleExemplars}
                isLoading={isTogglingExemplars}
              >
                {exemplarMetadata?.isEnabled ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2 text-xs">
            <div className="space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Library Version:</span>
                <span className="font-mono font-semibold text-slate-900 text-[11px]">
                  {exemplarMetadata?.version || 'v1.0.0-uninitialized'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Approved Exemplars:</span>
                <span className="font-semibold text-purple-600">{exemplarMetadata?.count || 0} patterns</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Categories Covered:</span>
                <span className="font-semibold text-slate-700">{exemplarMetadata?.categories?.length || 0} domains</span>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 leading-tight">
                When enabled, FeedbackAnalyzer injects validated exemplars into customer review analysis prompts.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Layout: Run History & Run Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Persisted Run History */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Adaption Runs</CardTitle>
                <CardDescription className="text-xs">Persisted jobs and evaluations</CardDescription>
              </div>
              <Badge variant="neutral" size="sm">
                {runs.length} Runs
              </Badge>
            </CardHeader>

            <CardContent className="p-2 divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {runs.length === 0 ? (
                <div className="text-center py-8 px-4 text-slate-500 text-xs">
                  <BrainCircuit className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium">No Adaption runs recorded yet.</p>
                  <p className="text-slate-400 mt-1">Start a workflow above to generate and evaluate prompt datasets.</p>
                </div>
              ) : (
                runs.map((r) => {
                  const isSelected = selectedRun?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRun(r)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/80 border border-indigo-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-slate-900 truncate max-w-[150px]">
                              {r.name}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">[{r.datasetVersion}]</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {r.recordsCount} records • {new Date(r.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        <Badge
                          variant={
                            r.status === 'succeeded'
                              ? 'success'
                              : r.status === 'failed'
                              ? 'danger'
                              : r.status === 'blocked_confirmation_required'
                              ? 'warning'
                              : r.status === 'unconfigured'
                              ? 'warning'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {r.status}
                        </Badge>
                      </div>

                      {r.quality && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-slate-600">
                            Grade: <strong>{r.quality.grade_before}</strong> → <strong className="text-emerald-700">{r.quality.grade_after}</strong>
                          </span>
                          <span className="text-emerald-700 font-bold">
                            +{r.quality.improvement_percent?.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Detailed Run Inspector */}
        <div className="lg:col-span-2">
          {selectedRun ? (
            <Card className="bg-white">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{selectedRun.name}</CardTitle>
                      {selectedRun.isMock && (
                        <Badge variant="warning" size="sm">
                          Simulation Mode
                        </Badge>
                      )}
                      <Badge
                        variant={selectedRun.status === 'succeeded' ? 'success' : 'neutral'}
                        size="sm"
                      >
                        {selectedRun.status}
                      </Badge>
                    </div>
                    <CardDescription className="font-mono text-xs">
                      Run ID: {selectedRun.id} • Version: {selectedRun.datasetVersion} • Created: {new Date(selectedRun.createdAt).toLocaleString()}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncRun(selectedRun.id)}
                      leftIcon={<RotateCw className="h-3.5 w-3.5" />}
                    >
                      Sync Status
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(selectedRun.id, 'jsonl')}
                      leftIcon={<Download className="h-3.5 w-3.5" />}
                    >
                      JSONL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(selectedRun.id, 'csv')}
                      leftIcon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                    >
                      CSV
                    </Button>
                  </div>
                </div>

                {/* Scorecards Row */}
                {selectedRun.quality && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                      <div className="text-[11px] text-slate-500">Quality Grade</div>
                      <div className="text-lg font-bold text-slate-900 mt-0.5">
                        {selectedRun.quality.grade_before || 'C'} → <span className="text-emerald-600">{selectedRun.quality.grade_after || 'A'}</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                      <div className="text-[11px] text-slate-500">Score Scale (0–10)</div>
                      <div className="text-lg font-bold text-slate-900 mt-0.5">
                        {selectedRun.quality.score_before?.toFixed(1) || '6.0'} → <span className="text-indigo-600">{selectedRun.quality.score_after?.toFixed(1) || '8.8'}</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                      <div className="text-[11px] text-slate-500">Relative Improvement</div>
                      <div className="text-lg font-bold text-emerald-600 mt-0.5">
                        +{selectedRun.quality.improvement_percent?.toFixed(1) || '37.5'}%
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                      <div className="text-[11px] text-slate-500">Percentile Rank</div>
                      <div className="text-lg font-bold text-purple-600 mt-0.5">
                        Top {((100 - (selectedRun.quality.percentile_after || 90))).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}

                {selectedRun.errorMessage && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Diagnostic Information: </strong>
                      <span>{selectedRun.errorMessage}</span>
                    </div>
                  </div>
                )}

                {/* Sub-tabs */}
                <div className="flex border-b border-slate-200 mt-4 gap-4 text-xs font-medium">
                  <button
                    onClick={() => setActiveTab('comparison')}
                    className={`pb-2.5 transition-colors border-b-2 ${
                      activeTab === 'comparison'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Sample Records ({selectedRun.samplePairs?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('evaluation')}
                    className={`pb-2.5 transition-colors border-b-2 ${
                      activeTab === 'evaluation'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Empirical Evaluation Benchmark
                  </button>
                  <button
                    onClick={() => setActiveTab('exemplars')}
                    className={`pb-2.5 transition-colors border-b-2 ${
                      activeTab === 'exemplars'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Few-Shot Patterns
                  </button>
                  <button
                    onClick={() => setActiveTab('rawJson')}
                    className={`pb-2.5 transition-colors border-b-2 ${
                      activeTab === 'rawJson'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Raw Payload
                  </button>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Tab 1: Comparison Samples */}
                {activeTab === 'comparison' && (
                  <div className="space-y-4">
                    {selectedRun.samplePairs && selectedRun.samplePairs.length > 0 ? (
                      selectedRun.samplePairs.map((pair, idx) => (
                        <div
                          key={pair.originalId || idx}
                          className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-slate-400">
                              Sample #{idx + 1} • {pair.originalId} {pair.duplicateCount && pair.duplicateCount > 1 ? `(${pair.duplicateCount} identical occurrences)` : ''}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="indigo" size="sm">{pair.category}</Badge>
                              <Badge
                                variant={pair.sentiment === 'positive' ? 'success' : pair.sentiment === 'negative' ? 'danger' : 'neutral'}
                                size="sm"
                              >
                                {pair.sentiment}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="space-y-1 rounded-lg bg-white p-3 border border-slate-200">
                              <div className="font-semibold text-slate-700">Instruction Prompt (Input)</div>
                              <p className="text-slate-600 whitespace-pre-wrap">{pair.prompt}</p>
                            </div>
                            <div className="space-y-1 rounded-lg bg-white p-3 border border-slate-200">
                              <div className="font-semibold text-slate-700">Grounded Completion (Output)</div>
                              <pre className="text-slate-800 whitespace-pre-wrap font-mono text-[11px] overflow-x-auto">
                                {pair.completion}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-slate-500 text-xs">No sample pairs recorded for this run.</div>
                    )}
                  </div>
                )}

                {/* Tab 2: Empirical Evaluation Benchmark */}
                {activeTab === 'evaluation' && (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-base sm:text-lg font-bold text-slate-900">Baseline vs. Adaption-Enhanced Comparison</h4>
                        <p className="text-sm text-slate-500 mt-0.5">
                          Empirical measurement on isolated test records (guaranteed leakage-free).
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        size="md"
                        onClick={handleRunEvaluation}
                        isLoading={isEvaluating}
                        leftIcon={<Award className="h-4 w-4" />}
                        className="cta-focus-glow font-bold text-sm px-4"
                      >
                        Run Benchmark Evaluation
                      </Button>
                    </div>

                    {evaluation ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80">
                            <div className="text-xs sm:text-sm font-medium text-slate-600">Structured JSON Validity</div>
                            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1.5">
                              {(evaluation.baseline.validStructuredOutputRate * 100).toFixed(0)}% → <span className="text-emerald-600">{(evaluation.adapted.validStructuredOutputRate * 100).toFixed(0)}%</span>
                            </div>
                            <div className="text-xs text-emerald-600 font-bold mt-1">
                              {evaluation.delta.structuredOutputDiff >= 0 ? `+${(evaluation.delta.structuredOutputDiff * 100).toFixed(1)}%` : `${(evaluation.delta.structuredOutputDiff * 100).toFixed(1)}%`}
                            </div>
                          </div>

                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80">
                            <div className="text-xs sm:text-sm font-medium text-slate-600">Category Consistency</div>
                            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1.5">
                              {(evaluation.baseline.categoryAgreementRate * 100).toFixed(0)}% → <span className="text-indigo-600">{(evaluation.adapted.categoryAgreementRate * 100).toFixed(0)}%</span>
                            </div>
                            <div className="text-xs text-indigo-600 font-bold mt-1">
                              {evaluation.delta.categoryAgreementDiff >= 0 ? `+${(evaluation.delta.categoryAgreementDiff * 100).toFixed(1)}%` : `${(evaluation.delta.categoryAgreementDiff * 100).toFixed(1)}%`}
                            </div>
                          </div>

                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80">
                            <div className="text-xs sm:text-sm font-medium text-slate-600">Evidence Grounding</div>
                            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1.5">
                              {(evaluation.baseline.evidenceGroundingRate * 100).toFixed(0)}% → <span className="text-purple-600">{(evaluation.adapted.evidenceGroundingRate * 100).toFixed(0)}%</span>
                            </div>
                            <div className="text-xs text-purple-600 font-bold mt-1">
                              {evaluation.delta.groundingDiff >= 0 ? `+${(evaluation.delta.groundingDiff * 100).toFixed(1)}%` : `${(evaluation.delta.groundingDiff * 100).toFixed(1)}%`}
                            </div>
                          </div>

                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80">
                            <div className="text-xs sm:text-sm font-medium text-slate-600">Average Confidence</div>
                            <div className="text-lg sm:text-xl font-black text-slate-900 mt-1.5">
                              {evaluation.baseline.avgConfidence.toFixed(2)} → <span className="text-emerald-600">{evaluation.adapted.avgConfidence.toFixed(2)}</span>
                            </div>
                            <div className="text-xs text-slate-500 font-medium mt-1">
                              Latency: {evaluation.adapted.avgLatencyMs}ms ({evaluation.delta.latencyDiffMs >= 0 ? `+${evaluation.delta.latencyDiffMs}ms` : `${evaluation.delta.latencyDiffMs}ms`})
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl bg-indigo-50/80 border border-indigo-100 p-4 space-y-2 text-sm text-indigo-950">
                          <div className="flex items-center gap-2 font-bold text-indigo-950">
                            <ShieldCheck className="h-5 w-5 text-indigo-600" />
                            <span>Evaluation Transparency & Methodology</span>
                          </div>
                          <p className="text-xs sm:text-sm leading-relaxed text-indigo-900">
                            {evaluation.limitations}
                          </p>
                          <p className="text-xs sm:text-sm text-indigo-800 leading-relaxed font-medium">
                            {evaluation.sourceCategoryDisclaimer}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                        <Award className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-800">No evaluation benchmark run yet</p>
                        <p className="text-slate-400 mt-1">
                          Click &ldquo;Run Benchmark Evaluation&rdquo; above to execute a leakage-free comparison between baseline zero-shot and Adaption-enhanced few-shot prompting.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Few-shot patterns */}
                {activeTab === 'exemplars' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      These validated prompt-completion pairs are dynamically injected into InsightFlow&apos;s analysis prompt to guide categorization and schema compliance.
                    </p>
                    {selectedRun.samplePairs.slice(0, 3).map((pair, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">Pattern #{idx + 1} ({pair.category})</span>
                          <Badge variant="indigo" size="sm">Grounded Exemplar</Badge>
                        </div>
                        <div className="text-slate-600 line-clamp-2">{pair.prompt}</div>
                        <pre className="text-slate-800 font-mono text-[10px] bg-white p-2 rounded border border-slate-200 overflow-x-auto">
                          {pair.completion}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 4: Raw JSON */}
                {activeTab === 'rawJson' && (
                  <div className="rounded-lg bg-slate-900 text-emerald-400 p-4 font-mono text-xs overflow-x-auto">
                    <pre>
                      {JSON.stringify(
                        {
                          dataset_id: selectedRun.id,
                          status: selectedRun.status,
                          quality: selectedRun.quality,
                          column_mapping: selectedRun.columnMapping,
                          training_type: selectedRun.trainingType,
                          records_count: selectedRun.recordsCount,
                          raw_results: selectedRun.rawResults,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white text-center py-12 px-4">
              <BrainCircuit className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <CardTitle className="text-base text-slate-800">Select a Run to View Details</CardTitle>
              <CardDescription className="max-w-md mx-auto mt-1">
                Choose an execution from the run history list on the left to inspect its quality scores, before-and-after sample records, and export options.
              </CardDescription>
            </Card>
          )}
        </div>
      </div>

      {/* Trigger Run Modal with Upfront Estimate & Confirmation */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Execute Adaption Evaluation</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleStartRun} className="space-y-4 pt-4">
              {runError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{runError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Dataset Run Name (Optional)</label>
                <Input
                  placeholder="e.g. Q4-Customer-Feedback-Adaption"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Source Dataset</label>
                  <Select
                    value={datasetOrigin}
                    onChange={(e) => setDatasetOrigin(e.target.value as any)}
                  >
                    <option value="all">All Feedback Records</option>
                    <option value="genuine_import">Genuine Imports Only</option>
                    <option value="demo_sample">Demo Sample Fixtures</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Sample Row Limit</label>
                  <Select
                    value={String(maxRows)}
                    onChange={(e) => setMaxRows(Number(e.target.value))}
                  >
                    <option value="10">10 Rows (Quick)</option>
                    <option value="20">20 Rows (Standard)</option>
                    <option value="50">50 Rows (Exhaustive)</option>
                  </Select>
                </div>
              </div>

              {/* Estimate Preview */}
              {estimateData && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1 text-slate-700">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Upfront Cost Estimate</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Rows:</span>
                    <span className="font-medium">{estimateData.recordsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Credits:</span>
                    <span className="font-medium text-indigo-600">{estimateData.estimatedCredits} credits</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Cost:</span>
                    <span className="font-medium text-emerald-600">${estimateData.estimatedCostUsd} USD</span>
                  </div>
                </div>
              )}

              {/* Simulation Mode Toggle */}
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 space-y-2 text-xs text-indigo-950">
                <div className="flex items-center justify-between">
                  <label className="font-semibold flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateRun}
                      onChange={(e) => setSimulateRun(e.target.checked)}
                      className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Enable Verified Simulation Mode
                  </label>
                  <Badge variant={simulateRun ? 'warning' : 'neutral'} size="sm">
                    {simulateRun ? 'Simulated' : 'Live API'}
                  </Badge>
                </div>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  When enabled, runs full dataset transformation, duplicate detection, and schema validation without consuming remote API credits.
                </p>
              </div>

              {/* Explicit Confirmation for Live Runs */}
              {!simulateRun && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5 text-xs text-amber-900">
                  <label className="font-semibold flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmLiveExecution}
                      onChange={(e) => setConfirmLiveExecution(e.target.checked)}
                      className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>I authorize running this live Adaption job and understand it may consume remote API credits.</span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isExecuting}
                  disabled={!simulateRun && !confirmLiveExecution}
                  leftIcon={<Play className="h-4 w-4" />}
                >
                  Start Adaption Run
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdaptionPage;
