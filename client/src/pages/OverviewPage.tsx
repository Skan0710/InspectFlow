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
import { StatsCounter } from '../components/ui/stats-counter';

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
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="space-y-6">
      {/* Page Header with Scope Controls */}
      <div className="overview-header flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between pb-4 page-header">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Executive Overview
          </h1>
          <p className="mt-1.5 text-base sm:text-lg text-indigo-100/90 font-normal">
            Customer feedback intelligence & priority triage at a glance
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 justify-start sm:justify-end">
          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-10 py-1.5 px-3 text-sm font-medium rounded-xl border-white/20 bg-white/10 text-white min-w-[145px]"
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
              className="h-10 py-1.5 px-3 text-sm font-medium rounded-xl border-white/20 bg-white/10 text-white min-w-[140px]"
            >
              <option value="all">All Provenance</option>
              <option value="genuine_import">Genuine CSV Only</option>
              <option value="demo_sample">Demo Sample Only</option>
            </Select>
          </div>

          <Button
            variant="outline"
            size="md"
            onClick={loadData}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="h-4 w-4" />}
            title="Refresh dashboard metrics"
            className="text-sm font-semibold px-3.5 h-10 border-white/20 text-white hover:bg-white/10"
          >
            Refresh
          </Button>

          <Link to="/feedback" className="shrink-0">
            <Button
              variant="primary"
              size="md"
              leftIcon={<FileSpreadsheet className="h-4 w-4" />}
              className="cta-focus-glow text-sm font-bold px-4 h-10 shadow-lg shadow-indigo-500/35 ring-1 ring-white/30"
            >
              Feedback Explorer
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Error Alert */}
      {error && (
        <div className="rounded-2xl border border-red-200/50 bg-red-950/60 p-5 flex items-center justify-between gap-4 text-sm text-red-100 animate-in fade-in shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-400 shrink-0" />
            <div>
              <p className="font-bold text-base text-white">Error Loading Dashboard Analytics</p>
              <p className="text-red-200/90 text-sm mt-0.5">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state: nothing ingested yet */}
      {metrics?.summary.isEmpty && !isLoading && (
        <div className="flex flex-col gap-5 rounded-3xl border border-indigo-400/30 bg-gradient-to-r from-indigo-900/50 via-indigo-950/70 to-purple-950/50 p-7 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-950/50">
              <Database className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-xl font-bold text-white">No customer feedback ingested yet</h3>
              <p className="mt-1 text-base text-indigo-100/90">
                Import a CSV of reviews or load the 20-row demo fixture to populate the charts and priority queue.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Button variant="outline" size="md" onClick={handleSeedDemo} isLoading={isSeedingSample} className="text-base font-semibold">
              Load 20 demo rows
            </Button>
            <Link to="/feedback">
              <Button variant="primary" size="md" leftIcon={<FileSpreadsheet className="h-4 w-4" />} className="cta-focus-glow text-base font-bold px-5">
                Ingest CSV
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* 1. KPI Cards Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Total Feedback Records */}
        <Card className="kpi-tile">
          <CardContent className="p-6">
            <div className="flex items-center justify-between text-sm font-bold text-indigo-200 tracking-wide">
              <span>Total Feedback</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/25 text-indigo-200 ring-1 ring-indigo-400/40"><Database className="h-6 w-6" /></span>
            </div>
            <div className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-white">
              {metrics ? <StatsCounter value={metrics.summary.totalFeedback} /> : '0'}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
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
        <Card className="kpi-tile">
          <CardContent className="p-6">
            <div className="flex items-center justify-between text-sm font-bold text-indigo-200 tracking-wide">
              <span>AI Analyzed Volume</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-400/40"><Sparkles className="h-6 w-6" /></span>
            </div>
            <div className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-white">
              {metrics ? <StatsCounter value={metrics.summary.analyzedFeedback} /> : '0'}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
              {metrics && metrics.summary.totalFeedback > 0 ? (
                <>
                  <span className="font-bold text-emerald-300">
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
        <Card className="kpi-tile">
          <CardContent className="p-6">
            <div className="flex items-center justify-between text-sm font-bold text-indigo-200 tracking-wide">
              <span>Negative Friction</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/25 text-rose-300 ring-1 ring-rose-400/40"><AlertTriangle className="h-6 w-6" /></span>
            </div>
            <div className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-white">
              {metrics && metrics.sentiment.denominator > 0 ? (
                <span className="inline-flex items-center">
                  <StatsCounter value={metrics.sentiment.counts.negative} />
                  <span className="text-base font-bold text-rose-400 ml-2 inline-flex items-center">
                    (<StatsCounter value={metrics.sentiment.percentages.negative} suffix="%" decimals={1} />)
                  </span>
                </span>
              ) : (
                <span className="text-slate-400 text-xl font-bold">Awaiting Run</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-300">
              {metrics && metrics.sentiment.denominator > 0 ? (
                <span>Denominator: {metrics.sentiment.denominator.toLocaleString()} analyzed</span>
              ) : (
                <span className="text-slate-400">0 analyzed records</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Open Priority Issues */}
        <Card className="kpi-tile">
          <CardContent className="p-6">
            <div className="flex items-center justify-between text-sm font-bold text-indigo-200 tracking-wide">
              <span>Triage Queue</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/25 text-violet-300 ring-1 ring-violet-400/40"><Layers className="h-6 w-6" /></span>
            </div>
            <div className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-white">
              <Link to="/actions" className="hover:text-indigo-300 transition-colors inline-flex items-center gap-2">
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
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
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

      {/* Batch Pipeline Control Card */}
      <AnalysisProgressCard onAnalysisComplete={loadData} />

      {/* 2 & 3. Visual Charts Section: Sentiment Donut & Category Distribution */}
      <div className="overview-charts-section grid gap-6 lg:grid-cols-12">
        {/* Sentiment Distribution Chart (Donut) */}
        <Card className="lg:col-span-5 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-white">
                  Sentiment Distribution
                </CardTitle>
                <CardDescription className="text-sm text-indigo-100/80">
                  Select a slice to filter the feedback feed.
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
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl ">
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
                <CardTitle className="text-lg sm:text-xl font-bold text-white">
                  Feedback Category Breakdown
                </CardTitle>
                <CardDescription className="text-sm text-indigo-100/80">
                  Select a category bar to filter related customer reviews.
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
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl ">
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
                <CardTitle className="text-lg font-bold text-slate-900">
                  Top Issue Topics
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Most cited by customers across all feedback sources.
                </CardDescription>
              </div>
              <Badge variant="neutral" size="sm" className="text-xs font-semibold">
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
                    className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 font-mono">
                          {index + 1}
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {item.topic}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600 pl-8">
                        <span className="font-bold text-slate-900">
                          {item.count} mentions
                        </span>
                        <span>•</span>
                        <span>{item.percentage}% of analyzed</span>
                        {item.negativePercentage > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-rose-600 font-semibold">
                              {item.negativePercentage}% negative
                            </span>
                          </>
                        )}
                        {item.averageSeverity && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-slate-700">Sev {item.averageSeverity}/5</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/feedback?topic=${encodeURIComponent(item.topic)}`)}
                      className="shrink-0 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Filter feed by this topic"
                    >
                      <ArrowUpRight className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No Issue Topics Extracted Yet</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
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
                <CardTitle className="text-lg font-bold text-slate-900">
                  Priority Triage Queue
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Highest priority first based on severity and volume.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {metrics && metrics.priorityRankings.issues.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {metrics.priorityRankings.issues.slice(0, 5).map((issue) => (
                  <div
                    key={issue.issueId}
                    className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={TIER_BADGE_VARIANTS[issue.priorityTier.toLowerCase()] || 'neutral'}
                          size="sm"
                          className="font-bold text-xs"
                        >
                          {issue.priorityTier.toUpperCase()}
                        </Badge>
                        <span className="font-mono text-xs text-slate-500 font-semibold">
                          {issue.issueCode}
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {issue.title}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600">
                        <Badge
                          variant={CATEGORY_BADGE_VARIANTS[issue.category] || 'neutral'}
                          size="sm"
                          className="text-xs"
                        >
                          {issue.category}
                        </Badge>
                        <span>•</span>
                        <span className="font-semibold text-slate-800">{issue.totalMentions} mentions</span>
                        <span>•</span>
                        <span>{issue.uniqueReports} unique</span>
                        {issue.duplicateRatio > 0 && (
                          <span className="text-amber-600 font-semibold">
                            ({issue.duplicateRatio}% dupes)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Priority Score Gauge */}
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-xl font-black font-mono text-slate-900">
                          {issue.priorityScore.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-500 font-mono font-medium">/100</span>
                      </div>
                      <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden mt-1.5">
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
                <Layers className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No Priority Issues Generated</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                  Run issue clustering in the AI Insights page to populate deterministic triage queues.
                </p>
              </div>
            )}

            {/* Non-financial risk disclaimer */}
            <div className="p-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-600">
              <Info className="h-4 w-4 text-slate-400 shrink-0" />
              <span>{metrics?.priorityRankings.disclaimer || 'Deterministic Priority = 100 × (0.40F + 0.35S + 0.25N). Scores represent triage urgency, not financial risk.'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* End-to-End Product Storytelling Journey Section */}
      <ProductStorySection />
      </div>
      </div>
    </div>
  );
};

export default OverviewPage;
