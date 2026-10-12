import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  Database,
  Sparkles,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { AnalysisProgressCard } from '../components/feedback/AnalysisProgressCard';
import { fetchAnalyticsMetrics, fetchDatasetStatus, seedSampleDataset } from '../api/client';
import type { AnalyticsMetricsResponse, DatasetStatus } from '../types/analytics';
import { gsap, useGsapContext, prefersReducedMotion } from '../lib/animations/gsap';
import { ProductStorySection } from '../components/landing/ProductStorySection';
import { WorkflowFeatureBento } from '../components/landing/WorkflowFeatureBento';
import { StatsCounter } from '../components/ui/stats-counter';
import { ShareSheet } from '../components/ui/share-sheet';
import { LineHoverLink } from '../components/ui/line-hover-link';

const SENTIMENT_COLORS = {
  positive: '#10b981', // Emerald
  neutral: '#64748b',  // Slate
  negative: '#ef4444', // Rose
  mixed: '#f59e0b',    // Amber
};

const CATEGORY_COLORS = [
  '#4338ca', // Indigo 700
  '#6366f1', // Indigo 500
  '#8b5cf6', // Violet 500
  '#a5b4fc', // Indigo 300
];

const TIER_BADGE_VARIANTS: Record<string, 'danger' | 'warning' | 'indigo' | 'neutral'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'indigo',
  low: 'neutral',
};

const CATEGORY_BADGE_VARIANTS: Record<string, 'indigo' | 'neutral' | 'warning' | 'danger'> = {
  'Product Feedback': 'indigo',
  'Customer Service': 'neutral',
  'Operational Issues': 'warning',
  'Fraud and Scam': 'danger',
};

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<AnalyticsMetricsResponse | null>(null);
  const [datasetStatus, setDatasetStatus] = useState<DatasetStatus | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDatasetType, setSelectedDatasetType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeedingSample, setIsSeedingSample] = useState<boolean>(false);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  useGsapContext(
    pageContainerRef,
    () => {
      if (prefersReducedMotion() || isLoading) return;

      // 1. Entrance for top header
      gsap.from('.overview-header', {
        opacity: 0,
        y: 18,
        duration: 0.65,
        ease: 'power3.out',
      });

      // 2. Staggered reveal for KPI cards
      gsap.from('.overview-kpi-card', {
        opacity: 0,
        y: 22,
        stagger: 0.08,
        duration: 0.6,
        ease: 'power2.out',
        delay: 0.05,
      });

      // 3. ScrollTrigger reveal for charts section
      gsap.from('.overview-charts-section', {
        scrollTrigger: {
          trigger: '.overview-charts-section',
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        opacity: 0,
        y: 26,
        duration: 0.75,
        ease: 'power3.out',
      });

      // 4. ScrollTrigger reveal for priority issues queue
      gsap.from('.overview-priority-section', {
        scrollTrigger: {
          trigger: '.overview-priority-section',
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        opacity: 0,
        y: 26,
        duration: 0.75,
        ease: 'power3.out',
      });
    },
    [isLoading]
  );

  const latestLoadRef = useRef(0);

  const loadData = useCallback(async () => {
    const requestId = ++latestLoadRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const [metricsData, statusData] = await Promise.all([
        fetchAnalyticsMetrics({
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          datasetType: selectedDatasetType !== 'all' ? (selectedDatasetType as any) : undefined,
        }),
        fetchDatasetStatus(),
      ]);
      if (requestId !== latestLoadRef.current) return;
      setMetrics(metricsData);
      setDatasetStatus(statusData);
    } catch (err: unknown) {
      if (requestId !== latestLoadRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to retrieve overview analytics.';
      setError(message);
      console.error('[OverviewPage] Data loading error:', err);
    } finally {
      if (requestId === latestLoadRef.current) {
        setIsLoading(false);
      }
    }
  }, [selectedCategory, selectedDatasetType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSeedDemo = async () => {
    setIsSeedingSample(true);
    try {
      await seedSampleDataset(false);
      await loadData();
    } catch (err) {
      console.error('Failed to seed sample:', err);
    } finally {
      setIsSeedingSample(false);
    }
  };

  // Prepare Sentiment Donut Chart Data
  const sentimentChartData = metrics && metrics.sentiment.denominator > 0 ? [
    {
      name: 'Positive',
      sentimentKey: 'positive',
      value: metrics.sentiment.counts.positive,
      percentage: metrics.sentiment.percentages.positive,
      color: SENTIMENT_COLORS.positive,
    },
    {
      name: 'Neutral',
      sentimentKey: 'neutral',
      value: metrics.sentiment.counts.neutral,
      percentage: metrics.sentiment.percentages.neutral,
      color: SENTIMENT_COLORS.neutral,
    },
    {
      name: 'Negative',
      sentimentKey: 'negative',
      value: metrics.sentiment.counts.negative,
      percentage: metrics.sentiment.percentages.negative,
      color: SENTIMENT_COLORS.negative,
    },
    {
      name: 'Mixed',
      sentimentKey: 'mixed',
      value: metrics.sentiment.counts.mixed,
      percentage: metrics.sentiment.percentages.mixed,
      color: SENTIMENT_COLORS.mixed,
    },
  ].filter((item) => item.value > 0) : [];

  // Prepare Category Bar Chart Data
  const categoryChartData = metrics ? metrics.categories.map((c, idx) => ({
    category: c.category,
    count: c.count,
    percentage: c.percentage,
    analyzedCount: c.analyzedCount,
    positiveCount: c.sentimentBreakdown.positive,
    negativeCount: c.sentimentBreakdown.negative,
    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
  })) : [];

  return (
    <div ref={pageContainerRef}>
      {/* Hero: full-bleed indigo shader atmosphere */}
      <section className="overview-hero-surface relative isolate overflow-hidden text-white">
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/30 bg-indigo-400/15 px-3 py-1 text-xs font-medium text-indigo-100 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
              Customer feedback intelligence
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Hear every customer.{' '}
              <span className="bg-gradient-to-r from-indigo-200 to-violet-300 bg-clip-text text-transparent">
                Fix what matters first.
              </span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-indigo-100/90 sm:text-base">
              Turn raw reviews into a ranked, evidence-backed action queue: sentiment, clustered issues, and
              deterministic priority scores in one place.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/feedback"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-indigo-900 shadow-lg shadow-indigo-950/30 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
              >
                <Database className="h-4 w-4" />
                Explore feedback
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                to="/actions"
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-300/40 bg-indigo-950/40 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-indigo-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
              >
                <Layers className="h-4 w-4 text-indigo-300" />
                View action queue
              </Link>
              <ShareSheet
                url={typeof window !== 'undefined' ? window.location.href : 'https://insightflow.local'}
                title="InsightFlow Intelligence Dashboard"
                variant="compact"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-3 pb-8 sm:px-6 lg:px-8">
      <div className="space-y-6 rounded-3xl border border-white/50 bg-white/90 p-4 shadow-2xl shadow-indigo-950/30 backdrop-blur-md sm:p-6 lg:p-8">
      {/* Page Header with Scope Controls */}
      <div className="overview-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Intelligence Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real customer feedback volume, AI sentiment classification, and triage priority queue.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs h-8.5 py-1"
            >
              <option value="all">All Categories</option>
              <option value="Product Feedback">Product Feedback</option>
              <option value="Customer Service">Customer Service</option>
              <option value="Fraud and Scam">Fraud and Scam</option>
              <option value="Operational Issues">Operational Issues</option>
            </Select>

            <Select
              value={selectedDatasetType}
              onChange={(e) => setSelectedDatasetType(e.target.value)}
              className="text-xs h-8.5 py-1"
            >
              <option value="all">All Provenance</option>
              <option value="genuine_import">Genuine CSV Only</option>
              <option value="demo_sample">Demo Sample Only</option>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            title="Refresh dashboard metrics"
          >
            Refresh
          </Button>

          <Link to="/feedback">
            <Button variant="primary" size="sm" leftIcon={<FileSpreadsheet className="h-3.5 w-3.5" />}>
              Feedback Explorer
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Error Alert */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-3 text-xs text-red-900 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold text-red-950">Error Loading Dashboard Analytics</p>
              <p className="text-red-800 mt-0.5">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state: nothing ingested yet */}
      {metrics?.summary.isEmpty && !isLoading && (
        <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 p-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">No customer feedback ingested yet</h3>
              <p className="mt-0.5 text-xs text-slate-600">
                Import a CSV of reviews or load the 20-row demo fixture to populate the charts and priority queue.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSeedDemo} isLoading={isSeedingSample}>
              Load 20 demo rows
            </Button>
            <Link to="/feedback">
              <Button variant="primary" size="sm" leftIcon={<FileSpreadsheet className="h-3.5 w-3.5" />}>
                Ingest CSV
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* 1. KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Total Feedback Records */}
        <Card className="overview-kpi-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Total Feedback</span>
              <Database className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {metrics ? <StatsCounter value={metrics.summary.totalFeedback} /> : '0'}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              {datasetStatus?.activeDatasetType === 'genuine' ? (
                <Badge variant="indigo" size="sm" dot>
                  Genuine CSV Dataset
                </Badge>
              ) : datasetStatus?.activeDatasetType === 'sample' ? (
                <Badge variant="warning" size="sm" dot>
                  Demo Sample Fixture
                </Badge>
              ) : datasetStatus?.activeDatasetType === 'mixed' ? (
                <Badge variant="neutral" size="sm">
                  {datasetStatus.genuineCount} Genuine • {datasetStatus.sampleCount} Demo
                </Badge>
              ) : (
                <span className="text-slate-400">Empty Database</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Analyzed Feedback */}
        <Card className="overview-kpi-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>AI Analyzed Volume</span>
              <Sparkles className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {metrics ? <StatsCounter value={metrics.summary.analyzedFeedback} /> : '0'}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              {metrics && metrics.summary.totalFeedback > 0 ? (
                <>
                  <span className="font-semibold text-slate-700">
                    {metrics.summary.analysisCoveragePercent}%
                  </span>
                  <span>coverage ({metrics.summary.pendingAnalysis} pending)</span>
                </>
              ) : (
                <span className="text-slate-400">No records to analyze</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Negative Feedback */}
        <Card className="overview-kpi-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Negative Friction</span>
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {metrics && metrics.sentiment.denominator > 0 ? (
                <span className="inline-flex items-center">
                  <StatsCounter value={metrics.sentiment.counts.negative} />
                  <span className="text-sm font-semibold text-rose-600 ml-1.5 inline-flex items-center">
                    (<StatsCounter value={metrics.sentiment.percentages.negative} suffix="%" decimals={1} />)
                  </span>
                </span>
              ) : (
                <span className="text-slate-400 text-xl">Awaiting Run</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              {metrics && metrics.sentiment.denominator > 0 ? (
                <span>Denominator: {metrics.sentiment.denominator.toLocaleString()} analyzed</span>
              ) : (
                <span className="text-slate-400">0 analyzed records</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Open Priority Issues */}
        <Card className="overview-kpi-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Triage Queue</span>
              <Layers className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              <Link to="/actions" className="hover:text-indigo-600 transition-colors inline-flex items-center gap-1.5">
                {metrics ? (
                  <>
                    <StatsCounter value={metrics.priorityRankings.openIssuesCount !== undefined ? metrics.priorityRankings.openIssuesCount : metrics.priorityRankings.issues.length} />
                    <span>Issues</span>
                  </>
                ) : (
                  '0 Issues'
                )}
              </Link>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              {metrics && metrics.priorityRankings.tierSummary.critical > 0 ? (
                <Badge variant="danger" size="sm">
                  {metrics.priorityRankings.tierSummary.critical} Critical
                </Badge>
              ) : null}
              {metrics && metrics.priorityRankings.tierSummary.high > 0 ? (
                <Badge variant="warning" size="sm">
                  {metrics.priorityRankings.tierSummary.high} High
                </Badge>
              ) : null}
              {metrics && metrics.priorityRankings.issues.length === 0 ? (
                <span className="text-slate-400">Queue empty</span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compact ingestion + analysis coverage status */}
      {metrics && !metrics.summary.isEmpty && (
        <div className="flex flex-col gap-4 rounded-xl border border-indigo-100 bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Database className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {metrics.summary.totalFeedback.toLocaleString()} records ingested
              </p>
              <p className="truncate text-xs text-slate-500">
                {datasetStatus
                  ? `${datasetStatus.genuineCount.toLocaleString()} genuine · ${datasetStatus.sampleCount.toLocaleString()} demo`
                  : 'Dataset provenance loading'}
                {datasetStatus?.lastImportAt
                  ? ` · last import ${new Date(datasetStatus.lastImportAt).toLocaleString()}`
                  : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-4 lg:max-w-md">
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600">Analysis coverage</span>
                <span className="font-semibold text-slate-900">
                  {metrics.summary.analyzedFeedback.toLocaleString()} / {metrics.summary.totalFeedback.toLocaleString()}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-indigo-100"
                role="progressbar"
                aria-label="Analysis coverage"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={metrics.summary.analysisCoveragePercent}
              >
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, metrics.summary.analysisCoveragePercent)}%` }}
                />
              </div>
            </div>
            {!metrics.summary.hasAnalysisRun ? (
              <Badge variant="warning" size="sm" dot>
                Awaiting first run
              </Badge>
            ) : metrics.summary.pendingAnalysis > 0 ? (
              <Badge variant="indigo" size="sm" dot>
                {metrics.summary.pendingAnalysis.toLocaleString()} pending
              </Badge>
            ) : (
              <Badge variant="success" size="sm" dot>
                Fully analyzed
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Batch Pipeline Control Card */}
      <AnalysisProgressCard onAnalysisComplete={loadData} />

      {/* 2 & 3. Visual Charts Section: Sentiment Donut & Category Distribution */}
      <div className="overview-charts-section grid gap-6 lg:grid-cols-12">
        {/* Sentiment Distribution Chart (Donut) */}
        <Card className="lg:col-span-5 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Sentiment Distribution
                </CardTitle>
                <CardDescription className="text-xs">
                  Proportion of analyzed feedback. Click slice to filter feed.
                </CardDescription>
              </div>
              <Badge variant="neutral" size="sm">
                N = {metrics?.sentiment.denominator || 0}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-2 flex-1 flex flex-col justify-center">
            {metrics && metrics.sentiment.denominator > 0 ? (
              <div className="h-64 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      className="cursor-pointer focus:outline-none"
                      onClick={(entry: any) => {
                        if (entry?.sentimentKey) {
                          navigate(`/feedback?sentiment=${entry.sentimentKey}`);
                        }
                      }}
                    >
                      {sentimentChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg bg-slate-900 p-2.5 text-xs text-white shadow-xl border border-slate-700">
                              <p className="font-bold flex items-center gap-1.5">
                                <span
                                  className="h-2.5 w-2.5 rounded-full inline-block"
                                  style={{ backgroundColor: data.color }}
                                />
                                {data.name} Sentiment
                              </p>
                              <p className="mt-1 text-slate-300">
                                <strong>{data.value.toLocaleString()}</strong> mentions ({data.percentage}%)
                              </p>
                              <p className="text-[10px] text-indigo-300 mt-1 italic">
                                Click to filter Feedback Explorer
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    {metrics.sentiment.denominator.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Analyzed
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Sentiment Analysis Computed</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Verbatim feedback is loaded, but AI analysis has not executed yet. Trigger batch processing to view sentiment breakdowns.
                </p>
              </div>
            )}

            {/* Interactive Sentiment Legend */}
            {metrics && metrics.sentiment.denominator > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 mt-2">
                {[
                  { label: 'Positive', key: 'positive', count: metrics.sentiment.counts.positive, pct: metrics.sentiment.percentages.positive, color: 'bg-emerald-500' },
                  { label: 'Neutral', key: 'neutral', count: metrics.sentiment.counts.neutral, pct: metrics.sentiment.percentages.neutral, color: 'bg-slate-400' },
                  { label: 'Negative', key: 'negative', count: metrics.sentiment.counts.negative, pct: metrics.sentiment.percentages.negative, color: 'bg-rose-500' },
                  { label: 'Mixed', key: 'mixed', count: metrics.sentiment.counts.mixed, pct: metrics.sentiment.percentages.mixed, color: 'bg-amber-500' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigate(`/feedback?sentiment=${item.key}`)}
                    className="p-2 rounded-lg text-left hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                    title={`Click to view all ${item.label.toLowerCase()} feedback`}
                  >
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <span className={`h-2 w-2 rounded-full ${item.color}`} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between text-xs">
                      <span className="font-bold text-slate-900">{item.count}</span>
                      <span className="text-[11px] text-slate-400">{item.pct}%</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feedback Category Distribution Chart */}
        <Card className="lg:col-span-7 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Feedback Category Breakdown
                </CardTitle>
                <CardDescription className="text-xs">
                  Volume distribution across supplied business categories. Click bar to explore.
                </CardDescription>
              </div>
              <Badge variant="indigo" size="sm">
                {metrics ? metrics.categories.length : 0} Categories
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-2 flex-1 flex flex-col justify-center">
            {metrics && metrics.categories.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                  >
                    <XAxis
                      dataKey="category"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      interval={0}
                      tickFormatter={(val) => {
                        const words = val.split(' ');
                        return words.length > 1 ? `${words[0]} ${words[1][0]}.` : val;
                      }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg bg-slate-900 p-2.5 text-xs text-white shadow-xl border border-slate-700">
                              <p className="font-bold text-slate-100">{data.category}</p>
                              <p className="mt-1 text-slate-300">
                                Total: <strong>{data.count.toLocaleString()}</strong> ({data.percentage}%)
                              </p>
                              <p className="text-slate-400">
                                Analyzed: <strong>{data.analyzedCount}</strong> records
                              </p>
                              <p className="text-[10px] text-indigo-300 mt-1 italic">
                                Click bar to filter Feedback Explorer
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      className="cursor-pointer"
                      onClick={(entry: any) => {
                        if (entry?.category) {
                          navigate(`/feedback?category=${encodeURIComponent(entry.category)}`);
                        }
                      }}
                    >
                      {categoryChartData.map((entry) => (
                        <Cell key={entry.category} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <FileSpreadsheet className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Categories Detected</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Ingest customer feedback dataset to analyze category distributions.
                </p>
              </div>
            )}

            {/* Category Summary List */}
            {metrics && metrics.categories.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 mt-2">
                {metrics.categories.map((c, idx) => (
                  <button
                    key={c.category}
                    type="button"
                    onClick={() => navigate(`/feedback?category=${encodeURIComponent(c.category)}`)}
                    className="p-2 rounded-lg text-left hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                    title={`Click to filter by ${c.category}`}
                  >
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 truncate">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                      />
                      <span className="font-medium truncate">{c.category}</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between text-xs">
                      <span className="font-bold text-slate-900">{c.count}</span>
                      <span className="text-[11px] text-slate-400">{c.percentage}%</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4 & 5. Frequently Reported Issues and Priority Queue Section */}
      <div className="overview-priority-section grid gap-6 lg:grid-cols-12">
        {/* 4. Frequently Reported Issues Ranked by Actual Counts */}
        <Card className="lg:col-span-6">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Top Issue Topics
                </CardTitle>
                <CardDescription className="text-xs">
                  Most cited friction points extracted by AI, ranked by frequency.
                </CardDescription>
              </div>
              <Badge variant="neutral" size="sm">
                Ranked by Mentions
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {metrics && metrics.issueFrequencies.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {metrics.issueFrequencies.slice(0, 5).map((item, index) => (
                  <div
                    key={item.topic}
                    className="p-4 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 font-mono">
                          {index + 1}
                        </span>
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                          {item.topic}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pl-7">
                        <span className="font-semibold text-slate-800">
                          {item.count} mentions
                        </span>
                        <span>•</span>
                        <span>{item.percentage}% of analyzed</span>
                        {item.negativePercentage > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-rose-600 font-medium">
                              {item.negativePercentage}% negative
                            </span>
                          </>
                        )}
                        {item.averageSeverity && (
                          <>
                            <span>•</span>
                            <span>Sev {item.averageSeverity}/5</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/feedback?topic=${encodeURIComponent(item.topic)}`)}
                      className="shrink-0 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                      title="Filter feed by this topic"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <AlertCircle className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No Issue Topics Extracted Yet</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                  Run batch analysis to extract grounded primary topics from customer feedback.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Priority Queue showing Deterministic Score, Tier & Summary */}
        <Card className="lg:col-span-6">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Priority Triage Queue
                </CardTitle>
                <CardDescription className="text-xs">
                  Deterministic ranking: 100 × (0.40F + 0.35S + 0.25N).
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <LineHoverLink
                  variant="slide"
                  href="/actions"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Action Center →
                </LineHoverLink>
                <LineHoverLink
                  variant="slide"
                  href="/insights"
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  AI Insights →
                </LineHoverLink>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {metrics && metrics.priorityRankings.issues.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {metrics.priorityRankings.issues.slice(0, 5).map((issue) => (
                  <div
                    key={issue.issueId}
                    className="p-4 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={TIER_BADGE_VARIANTS[issue.priorityTier.toLowerCase()] || 'neutral'}
                          size="sm"
                        >
                          {issue.priorityTier.toUpperCase()}
                        </Badge>
                        <span className="font-mono text-xs text-slate-400">
                          {issue.issueCode}
                        </span>
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                          {issue.title}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge
                          variant={CATEGORY_BADGE_VARIANTS[issue.category] || 'neutral'}
                          size="sm"
                        >
                          {issue.category}
                        </Badge>
                        <span>•</span>
                        <span>{issue.totalMentions} mentions</span>
                        <span>•</span>
                        <span>{issue.uniqueReports} unique</span>
                        {issue.duplicateRatio > 0 && (
                          <span className="text-amber-600 font-medium">
                            ({issue.duplicateRatio}% dupes)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Priority Score Gauge */}
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-lg font-bold font-mono text-slate-900">
                          {issue.priorityScore.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">/100</span>
                      </div>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full ${
                            issue.priorityTier === 'critical'
                              ? 'bg-rose-500'
                              : issue.priorityTier === 'high'
                              ? 'bg-amber-500'
                              : issue.priorityTier === 'medium'
                              ? 'bg-indigo-500'
                              : 'bg-slate-400'
                          }`}
                          style={{ width: `${Math.min(100, issue.priorityScore)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Layers className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No Priority Issues Generated</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                  Run issue clustering in the AI Insights page to populate deterministic triage queues.
                </p>
              </div>
            )}

            {/* Non-financial risk disclaimer */}
            <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
              <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{metrics?.priorityRankings.disclaimer || 'Deterministic Priority = 100 × (0.40F + 0.35S + 0.25N). Scores represent triage urgency, not financial risk.'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Duplicate-Text Telemetry Card */}
      {metrics && metrics.duplicateStats.duplicateFeedbackCount > 0 && (
        <Card className="border-amber-200/80 bg-amber-50/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Duplicate Complaint Telemetry
                </CardTitle>
              </div>
              <Badge variant="warning" size="sm">
                {metrics.duplicateStats.duplicateRatio}% Repeated Text Ratio
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-600">
              {metrics.duplicateStats.duplicateFeedbackCount.toLocaleString()} identical verbatim reviews detected across {metrics.duplicateStats.uniqueReviewTexts.toLocaleString()} unique complaint texts.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {metrics.duplicateStats.topRepeatedReviews.slice(0, 4).map((dup, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white p-3 border border-amber-200/60 shadow-xs flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="text-slate-800 font-normal italic truncate">
                      "{dup.textSnippet}"
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <Badge variant="neutral" size="sm">
                        {dup.category}
                      </Badge>
                      <span>•</span>
                      <span><strong>{dup.count}</strong> total instances</span>
                    </div>
                  </div>
                  <Badge variant="warning" size="sm">
                    {dup.duplicateCount} dupes
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 21st.dev & Mintlify Inspired Architectural Workflow Bento */}
      <WorkflowFeatureBento />

      {/* End-to-End Product Storytelling Journey Section */}
      <ProductStorySection />
      </div>
      </div>
    </div>
  );
};

export default OverviewPage;
