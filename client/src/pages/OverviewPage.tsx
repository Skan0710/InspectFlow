import React, { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  MessageSquare,
  Sparkles,
  Database,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Link } from 'react-router-dom';
import { AnalysisProgressCard } from '../components/feedback/AnalysisProgressCard';

interface DatasetStatus {
  totalRecords: number;
  genuineCount: number;
  sampleCount: number;
  categories: Record<string, number>;
  activeDatasetType: 'empty' | 'genuine' | 'sample' | 'mixed';
  lastImportAt: string | null;
  analysisStatus: 'not_started' | 'running' | 'completed';
  hasAnalysisRun: boolean;
}

interface FeedbackItem {
  id: string;
  review: string;
  category: string;
  source: string;
  rowNumber: number;
  isSample: boolean;
  datasetType: 'genuine_import' | 'demo_sample';
  importedAt: string;
}

const CATEGORY_BADGE_VARIANTS: Record<string, 'indigo' | 'neutral' | 'warning' | 'danger'> = {
  'Product Feedback': 'indigo',
  'Customer Service': 'neutral',
  'Operational Issues': 'warning',
  'Fraud and Scam': 'danger',
};

export const OverviewPage: React.FC = () => {
  const [datasetStatus, setDatasetStatus] = useState<DatasetStatus | null>(null);
  const [recentRecords, setRecentRecords] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadOverviewData = async () => {
      setIsLoading(true);
      try {
        const [statusRes, recordsRes] = await Promise.all([
          fetch('/api/dataset/status'),
          fetch('/api/feedback?pageSize=5'),
        ]);

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setDatasetStatus(statusData);
        }

        if (recordsRes.ok) {
          const recordsData = await recordsRes.json();
          setRecentRecords(recordsData.data || []);
        }
      } catch (err) {
        console.error('Failed to load overview data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadOverviewData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Intelligence Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real customer feedback ingestion status, dataset provenance, and AI pipeline readiness.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/feedback">
            <Button variant="outline" size="sm" leftIcon={<MessageSquare className="h-4 w-4" />}>
              Browse Full Feed
            </Button>
          </Link>
          <Link to="/feedback">
            <Button variant="primary" size="sm" leftIcon={<FileSpreadsheet className="h-4 w-4" />}>
              Ingest More Data
            </Button>
          </Link>
        </div>
      </div>

      {/* Prominent Analysis Status Banner */}
      <div className="rounded-xl border border-amber-200/90 bg-amber-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
        <div className="flex items-start sm:items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <div className="font-semibold text-amber-950 flex items-center gap-2">
              <span>AI Analysis Pipeline: Not Yet Executed</span>
              <span className="rounded bg-amber-200/60 px-2 py-0.2 font-mono text-[10px] text-amber-800">
                PENDING
              </span>
            </div>
            <p className="text-amber-800 mt-0.5">
              {datasetStatus?.totalRecords
                ? `${datasetStatus.totalRecords.toLocaleString()} verbatim customer records are indexed. Sentiment scores and topic clusters will be generated when the analysis pipeline runs.`
                : 'No customer feedback ingested yet. Seed or import dataset to begin.'}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <Badge variant="warning" size="sm" dot>
            Raw Ingestion Ready
          </Badge>
        </div>
      </div>

      {/* Batch Analysis Progress Pipeline Card */}
      <AnalysisProgressCard />

      {/* Real Ingestion KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Ingested Feedback */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Total Feedback Records</span>
              <Database className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {datasetStatus ? datasetStatus.totalRecords.toLocaleString() : '0'}
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
                  {datasetStatus.genuineCount} Genuine + {datasetStatus.sampleCount} Demo
                </Badge>
              ) : (
                <span className="text-slate-400">Awaiting Dataset</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Sentiment Status */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>AI Sentiment Score</span>
              <Clock className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-slate-400">
              Awaiting Run
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Badge variant="neutral" size="sm">
                0 / 100 Analyzed
              </Badge>
              <span>No fabricated metrics</span>
            </div>
          </CardContent>
        </Card>

        {/* Action Initiatives */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Action Initiatives</span>
              <Layers className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-slate-400">
              0 Active
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Badge variant="neutral" size="sm">
                Queue Empty
              </Badge>
              <span>Awaiting topic extraction</span>
            </div>
          </CardContent>
        </Card>

        {/* Dataset Provenance */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Dataset Provenance</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-base font-bold tracking-tight text-slate-900 truncate">
              {datasetStatus?.activeDatasetType === 'genuine'
                ? 'BuildBattle 2026'
                : datasetStatus?.activeDatasetType === 'sample'
                ? 'Demo Sample (20)'
                : datasetStatus?.activeDatasetType === 'mixed'
                ? 'Mixed Repositories'
                : 'Unseeded'}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span>4 Valid Categories</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout: Real Ingested Feedback Stream & Topic Extraction Status */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 spans): Actual Verbatim Customer Records */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle>Recent Customer Signals Ingested</CardTitle>
                <CardDescription>
                  Verbatim customer feedback records parsed and stored without altered scoring
                </CardDescription>
              </div>
              <Link to="/feedback" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                View All {datasetStatus ? `(${datasetStatus.totalRecords})` : ''} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {recentRecords.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {isLoading ? 'Loading records...' : 'No customer records imported yet.'}
                </div>
              ) : (
                recentRecords.map((item) => (
                  <div key={item.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={CATEGORY_BADGE_VARIANTS[item.category] || 'neutral'}
                          size="sm"
                          dot
                        >
                          {item.category}
                        </Badge>
                        <span className="text-xs text-slate-400 font-mono">Row #{item.rowNumber}</span>
                      </div>
                      <Badge
                        variant={item.isSample ? 'warning' : 'indigo'}
                        size="sm"
                      >
                        {item.isSample ? 'Demo Sample' : 'Genuine Import'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
                      "{item.review}"
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono text-[11px] truncate max-w-xs">{item.source}</span>
                      <span>{new Date(item.importedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: AI Analysis Readiness & Category Distribution */}
        <div className="space-y-4">
          {/* Category Distribution Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Supplied Category Distribution</CardTitle>
              <CardDescription>Exact count of ingested records by validated category</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-1">
              {datasetStatus?.categories && Object.keys(datasetStatus.categories).length > 0 ? (
                Object.entries(datasetStatus.categories).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs border border-slate-100">
                    <span className="font-medium text-slate-700">{cat}</span>
                    <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {count.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">Awaiting dataset ingestion.</p>
              )}
            </CardContent>
          </Card>

          {/* AI Clustering Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Sparkles className="h-4 w-4 text-slate-400" />
                <span>AI Topic Clusters</span>
              </div>
              <CardTitle className="text-base">Analysis Pipeline Status</CardTitle>
              <CardDescription>Semantic topic extraction has not yet been executed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-1 text-xs text-slate-600">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/80 space-y-1.5">
                <div className="font-semibold text-slate-800">No Synthesized Topics Yet</div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  InsightFlow avoids fabricating artificial cluster metrics. Once the LLM clustering pipeline is executed, semantic clusters will populate here with traceable citations.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Raw feedback repository indexed & ready</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
