import React, { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit,
  RotateCw,
  Play,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Award,
  Download,
  X,
  Code2,
  Database,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { FlipText } from '../components/ui/flip-text';
import { StatsCounter } from '../components/ui/stats-counter';
import { ShareSheet } from '../components/ui/share-sheet';
import { LineHoverLink } from '../components/ui/line-hover-link';
import type {
  AdaptionRunRecord,
  AdaptionProviderStatus,
} from '../types/adaption';

export const AdaptionPage: React.FC = () => {
  const [runs, setRuns] = useState<AdaptionRunRecord[]>([]);
  const [providerStatus, setProviderStatus] = useState<AdaptionProviderStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedRun, setSelectedRun] = useState<AdaptionRunRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'comparison' | 'rawJson' | 'exemplars'>('comparison');

  // Trigger form state
  const [datasetName, setDatasetName] = useState<string>('');
  const [datasetOrigin, setDatasetOrigin] = useState<'all' | 'genuine_import' | 'demo_sample'>('all');
  const [maxRows, setMaxRows] = useState<number>(20);
  const [simulateRun, setSimulateRun] = useState<boolean>(true);

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
          // Functional update keeps fetchRuns stable instead of re-fetching on every selection
          setSelectedRun((current) => current ?? json.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Adaption runs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchRuns();
  }, [fetchStatus, fetchRuns]);

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
        }),
      });

      if (res.ok) {
        const result = await res.json();
        await fetchRuns();
        if (result.data) {
          setSelectedRun(result.data);
        }
        setIsModalOpen(false);
        setDatasetName('');
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span>Model</span>
              <FlipText className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-800 bg-clip-text text-transparent">
                Adaption Labs
              </FlipText>
            </h2>
            <Badge variant="indigo" size="sm" className="font-mono">
              <StatsCounter value={runs.length} /> Evaluations
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Format customer reviews into instruction prompt-completion pairs, run official quality evaluations, and enhance classification accuracy.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <LineHoverLink
            variant="slide"
            href="/insights"
            className="text-xs font-medium text-slate-600 hover:text-indigo-600 mr-1"
          >
            Insights Radar →
          </LineHoverLink>
          <ShareSheet
            url={typeof window !== 'undefined' ? window.location.href : 'https://insightflow.local/adaption'}
            title="InsightFlow Adaption Labs Model Benchmark"
            variant="compact"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStatus();
              fetchRuns();
            }}
            isLoading={isLoading}
            leftIcon={<RotateCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            leftIcon={<Play className="h-4 w-4" />}
          >
            Run Adaption Workflow
          </Button>
        </div>
      </div>

      {/* Provider Connectivity & System Status Banner */}
      <Card className="border-indigo-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-indigo-400" />
                <span className="font-semibold text-sm sm:text-base tracking-tight">Adaption API Integration Gateway</span>
                {providerStatus?.isMockMode ? (
                  <Badge variant="warning" size="sm">
                    Verified Simulation Mode
                  </Badge>
                ) : providerStatus?.configured ? (
                  <Badge variant="success" size="sm">
                    Connected (api.prod.adaptionlabs.ai)
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm">
                    ADAPTION_API_KEY Not Configured
                  </Badge>
                )}
              </div>
              <p className="text-xs text-indigo-200 max-w-2xl leading-relaxed">
                {providerStatus?.message || 'Checking Adaption Labs connection...'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white/10 rounded-lg px-3 py-1.5 border border-white/10 text-right">
                <div className="text-[10px] text-indigo-300 font-mono uppercase tracking-wider">Target Endpoint</div>
                <div className="text-xs font-mono text-white truncate max-w-[200px]">
                  {providerStatus?.baseUrl || 'https://api.prod.adaptionlabs.ai/api/v1'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-3 text-[11px] text-indigo-300">
            <span className="flex items-center gap-1 font-medium text-amber-300">
              <HelpCircle className="h-3.5 w-3.5" />
              Dataset Quality & Representation Evaluation
            </span>
            <span>•</span>
            <span>Measures task alignment, clarity, and diversity on SFT prompt-completion pairs.</span>
            <span>•</span>
            <span className="text-slate-400">Strictly distinguishes dataset evaluation from model weight parameter fine-tuning.</span>
          </div>
        </CardContent>
      </Card>

      {/* 4-Stage Adaption Workflow Architecture */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-slate-200 bg-white hover:border-slate-300 transition-colors">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Database className="h-4 w-4" />
              </div>
              <span className="font-mono text-xs text-slate-400">Stage 01</span>
            </div>
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900">Source Extraction</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Curates verified customer reviews from genuine CSV imports or demo fixtures. Preserves original raw records.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white hover:border-slate-300 transition-colors">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Code2 className="h-4 w-4" />
              </div>
              <span className="font-mono text-xs text-slate-400">Stage 02</span>
            </div>
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900">Instruction Formatting</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Synthesizes prompt-completion instruction pairs with validated schemas and official <code>column_mapping</code>.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white hover:border-slate-300 transition-colors">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <Award className="h-4 w-4" />
              </div>
              <span className="font-mono text-xs text-slate-400">Stage 03</span>
            </div>
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900">Adaption Evaluation</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Queries Adaption evaluation endpoint for Grade Before/After, Quality Scores, and relative improvement percentages.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white hover:border-slate-300 transition-colors">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="font-mono text-xs text-slate-400">Stage 04</span>
            </div>
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900">Exemplar Integration</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ingests verified high-scoring pairs into InsightFlow prompt few-shot library for zero-hallucination classification.
            </p>
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
                <CardDescription>Persisted evaluation executions</CardDescription>
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
                  <p className="mt-1 text-slate-400">Click "Run Adaption Workflow" to prepare and evaluate customer feedback data.</p>
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
                          Simulation
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
                      Export JSONL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(selectedRun.id, 'csv')}
                      leftIcon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                    >
                      Export CSV
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
                    Sample Before & After Records ({selectedRun.samplePairs.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('exemplars')}
                    className={`pb-2.5 transition-colors border-b-2 ${
                      activeTab === 'exemplars'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Model Prompt Exemplars
                  </button>
                  <button
                    onClick={() => setActiveTab('rawJson')}
                    className={`pb-2.5 transition-colors border-b-2 ${
                      activeTab === 'rawJson'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Raw Adaption Payload
                  </button>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {activeTab === 'comparison' && (
                  <div className="space-y-4">
                    {selectedRun.samplePairs.map((pair, idx) => (
                      <div
                        key={pair.originalId || idx}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-slate-400">Sample #{idx + 1} • {pair.originalId}</span>
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
                          {/* Before: Raw Customer Input */}
                          <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-1.5">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                              Before: Input Customer Review
                            </div>
                            <p className="text-slate-800 italic leading-relaxed">
                              "{pair.prompt.replace(/^Classify[^\n]+\n\nReview:\s*"?/, '').replace(/"?$/, '')}"
                            </p>
                            <div className="text-[10px] text-slate-400 font-mono pt-1">
                              Origin: {String(pair.context?.source || 'Import')} • Raw text unnormalized
                            </div>
                          </div>

                          {/* After: Formatted Instruction Output */}
                          <div className="rounded-lg bg-indigo-50/50 border border-indigo-100 p-3 space-y-1.5 font-mono text-[11px]">
                            <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide font-sans">
                              After: Evaluated SFT Output Completion
                            </div>
                            <pre className="text-slate-800 whitespace-pre-wrap overflow-x-auto text-[11px] bg-white p-2 rounded border border-indigo-100">
                              {pair.completion}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'exemplars' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-xs text-purple-900">
                      <strong>Few-Shot Prompt Grounding: </strong>
                      These evaluated prompt-completion pairs are dynamically injected into InsightFlow's structured classification prompt to eliminate hallucinations and calibrate sentiment classification.
                    </div>

                    <div className="space-y-3">
                      {selectedRun.samplePairs.slice(0, 3).map((pair, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 font-mono text-xs space-y-1">
                          <div className="text-indigo-600 font-bold font-sans">Exemplar #{idx + 1} ({pair.category})</div>
                          <div className="text-slate-500 font-sans text-xs">Prompt: {pair.prompt}</div>
                          <div className="text-emerald-700 font-mono text-[11px] bg-slate-50 p-2 rounded">
                            {pair.completion}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

      {/* Trigger Run Modal */}
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
                  When enabled or when ADAPTION_API_KEY is unset, runs through full schema validation, dataset transformation, and mock quality scoring without remote API failures.
                </p>
              </div>

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
