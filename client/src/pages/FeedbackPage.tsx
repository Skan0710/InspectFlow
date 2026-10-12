import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Upload, 
  RefreshCw, 
  FileSpreadsheet, 
  CheckCircle2,
  FlaskConical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  ChevronRight,
  MessageSquarePlus,
  Download,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { FeedbackImportModal, type ImportSummary } from '../components/feedback/FeedbackImportModal';
import { ManualFeedbackModal } from '../components/feedback/ManualFeedbackModal';
import { AnalysisProgressCard } from '../components/feedback/AnalysisProgressCard';
import { FeedbackDetailDrawer, type FeedbackDetailItem } from '../components/feedback/FeedbackDetailDrawer';

const CATEGORY_BADGE_VARIANTS: Record<string, 'indigo' | 'neutral' | 'warning' | 'danger'> = {
  'Product Feedback': 'indigo',
  'Customer Service': 'neutral',
  'Operational Issues': 'warning',
  'Fraud and Scam': 'danger',
  'General Feedback': 'neutral',
};

const SENTIMENT_BADGE_VARIANTS: Record<string, 'success' | 'neutral' | 'danger' | 'warning'> = {
  positive: 'success',
  neutral: 'neutral',
  negative: 'danger',
  mixed: 'warning',
};

const SEVERITY_BADGE_COLORS: Record<number, string> = {
  5: 'bg-rose-100 text-rose-700 border-rose-200',
  4: 'bg-orange-100 text-orange-700 border-orange-200',
  3: 'bg-amber-100 text-amber-700 border-amber-200',
  2: 'bg-blue-100 text-blue-700 border-blue-200',
  1: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

type SortField = 'rowNumber' | 'severity' | 'confidence' | 'sentimentScore' | 'category' | 'importedAt';

export const FeedbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Read URL query params on initial mount
  const initialCategory = searchParams.get('category') || 'all';
  const initialSentiment = searchParams.get('sentiment') || 'all';
  const initialTopic = searchParams.get('topic') || '';
  const initialSeverity = searchParams.get('severity') || 'all';
  const initialSearch = searchParams.get('search') || '';

  const [items, setItems] = useState<FeedbackDetailItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Filter States
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  const [sentimentFilter, setSentimentFilter] = useState<string>(initialSentiment);
  const [severityFilter, setSeverityFilter] = useState<string>(initialSeverity);
  const [analysisStatusFilter, setAnalysisStatusFilter] = useState<string>('all');
  const [datasetTypeFilter, setDatasetTypeFilter] = useState<string>('all');
  const [topicFilter, setTopicFilter] = useState<string>(initialTopic);
  const [search, setSearch] = useState<string>(initialSearch);

  // Sorting State
  const [sortBy, setSortBy] = useState<SortField>('rowNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // UI States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [lastSubmittedRecord, setLastSubmittedRecord] = useState<FeedbackDetailItem | null>(null);
  const [lastImportSummary, setLastImportSummary] = useState<ImportSummary | null>(null);
  const [isSeedingSample, setIsSeedingSample] = useState<boolean>(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackDetailItem | null>(null);

  // Synchronize state when URL parameters change externally
  useEffect(() => {
    const urlCat = searchParams.get('category') || 'all';
    const urlSent = searchParams.get('sentiment') || 'all';
    const urlTopic = searchParams.get('topic') || '';
    const urlSev = searchParams.get('severity') || 'all';
    const urlSearch = searchParams.get('search') || '';

    setCategoryFilter(urlCat);
    setSentimentFilter(urlSent);
    setTopicFilter(urlTopic);
    setSeverityFilter(urlSev);
    setSearch(urlSearch);
    setPage(1);
  }, [searchParams]);

  // Debounce typing so each keystroke does not fire a request; guard against out-of-order responses
  const debouncedSearch = useDebouncedValue(search, 300);
  const latestRequestRef = useRef(0);

  const fetchFeedback = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortOrder,
      });

      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (sentimentFilter !== 'all') params.append('sentiment', sentimentFilter);
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      if (analysisStatusFilter !== 'all') params.append('analysisStatus', analysisStatusFilter);
      if (datasetTypeFilter !== 'all') params.append('datasetType', datasetTypeFilter);
      if (topicFilter.trim()) params.append('topic', topicFilter.trim());
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());

      const res = await fetch(`/api/feedback?${params.toString()}`);
      if (requestId !== latestRequestRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (requestId !== latestRequestRef.current) return;
        setItems(data.data || []);
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (err) {
      if (requestId === latestRequestRef.current) {
        console.error('Failed to load feedback feed:', err);
      }
    } finally {
      if (requestId === latestRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    page,
    pageSize,
    categoryFilter,
    sentimentFilter,
    severityFilter,
    analysisStatusFilter,
    datasetTypeFilter,
    topicFilter,
    debouncedSearch,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-300 group-hover:text-slate-500 inline-block ml-1" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-indigo-600 inline-block ml-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-indigo-600 inline-block ml-1" />
    );
  };

  const handleImportSuccess = (summary: ImportSummary) => {
    setLastImportSummary(summary);
    setPage(1);
    fetchFeedback();
  };

  const handleStartAnalysisFromImport = async (_importedCount: number) => {
    setIsImportModalOpen(false);
    try {
      await fetch('/api/analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 10, concurrency: 2 }),
      });
      fetchFeedback();
    } catch (err) {
      console.error('Failed to trigger analysis from import:', err);
    }
  };

  const handleSeedSample = async () => {
    setIsSeedingSample(true);
    try {
      const res = await fetch('/api/dataset/seed-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: false }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastImportSummary(data.summary);
        setPage(1);
        fetchFeedback();
      }
    } catch (err) {
      console.error('Failed to seed sample dataset:', err);
    } finally {
      setIsSeedingSample(false);
    }
  };

  const handleDrawerAnalyzeSuccess = (updatedItem: FeedbackDetailItem) => {
    setSelectedFeedback(updatedItem);
    setItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
  };

  const handleManualSubmitSuccess = (newRecord: FeedbackDetailItem) => {
    setLastSubmittedRecord(newRecord);
    setSortBy('importedAt');
    setSortOrder('desc');
    setPage(1);
    fetchFeedback();
    if (newRecord) {
      setSelectedFeedback(newRecord);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const hasActiveFilters =
    categoryFilter !== 'all' ||
    sentimentFilter !== 'all' ||
    severityFilter !== 'all' ||
    analysisStatusFilter !== 'all' ||
    datasetTypeFilter !== 'all' ||
    topicFilter.trim() !== '' ||
    search.trim() !== '';

  const clearAllFilters = () => {
    setCategoryFilter('all');
    setSentimentFilter('all');
    setSeverityFilter('all');
    setAnalysisStatusFilter('all');
    setDatasetTypeFilter('all');
    setTopicFilter('');
    setSearch('');
    setPage(1);
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (sentimentFilter !== 'all') params.set('sentiment', sentimentFilter);
    if (severityFilter !== 'all') params.set('severity', severityFilter);
    if (analysisStatusFilter !== 'all') params.set('analysisStatus', analysisStatusFilter);
    if (datasetTypeFilter !== 'all') params.set('datasetType', datasetTypeFilter);
    if (topicFilter.trim()) params.set('topic', topicFilter.trim());
    if (search.trim()) params.set('search', search.trim());
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);

    const exportUrl = `/api/feedback/export?${params.toString()}`;
    window.open(exportUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Customer Feedback Explorer
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Search, filter, and inspect verbatim customer reviews with AI sentiment, primary topics, severity, and grounding citations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedSample}
            isLoading={isSeedingSample}
            leftIcon={<FlaskConical className="h-4 w-4 text-amber-600" />}
            title="Load small 20-row sample dataset for rapid local testing"
          >
            Load 20 Demo Rows
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchFeedback}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh Feed
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            leftIcon={<Download className="h-4 w-4" />}
            title="Export filtered feedback records as CSV"
          >
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsManualModalOpen(true)}
            leftIcon={<MessageSquarePlus className="h-4 w-4 text-indigo-600" />}
          >
            Submit Feedback
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            leftIcon={<Upload className="h-4 w-4" />}
          >
            Ingest Feedback CSV
          </Button>
        </div>
      </div>

      {/* Latest Submitted Feedback Notification Banner */}
      {lastSubmittedRecord && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Manual Feedback Recorded: </span>
              <span className="italic">
                "{lastSubmittedRecord.review.length > 70
                  ? `${lastSubmittedRecord.review.slice(0, 70)}...`
                  : lastSubmittedRecord.review}"
              </span>
              <span className="ml-2 font-mono text-[11px] text-emerald-700">[{lastSubmittedRecord.id}]</span>
              <Badge variant="success" size="sm" className="ml-2">
                {lastSubmittedRecord.analysis ? 'AI Analyzed' : 'Pending Analysis'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFeedback(lastSubmittedRecord)}
              className="text-emerald-800 border-emerald-300 hover:bg-emerald-100/60"
            >
              Inspect Details
            </Button>
            <button
              onClick={() => setLastSubmittedRecord(null)}
              className="p-1 text-emerald-500 hover:text-emerald-700 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Latest Batch Notification Banner */}
      {lastImportSummary && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-900 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
            <div>
              <span className="font-bold">Latest Batch Ingested: </span>
              <span>{lastImportSummary.fileName}</span>
              <span className="mx-2 text-indigo-400">•</span>
              <span>
                <strong>{lastImportSummary.importedCount.toLocaleString()}</strong> unique records imported,{' '}
                <strong>{lastImportSummary.skippedCount.toLocaleString()}</strong> duplicate records skipped.
              </span>
              <span className="ml-2">
                <Badge variant={lastImportSummary.isSample ? 'warning' : 'indigo'} size="sm">
                  {lastImportSummary.isSample ? 'Demo Sample' : 'Genuine Import'}
                </Badge>
              </span>
            </div>
          </div>
          <span className="font-mono text-[11px] text-indigo-600 bg-white/60 px-2 py-0.5 rounded border border-indigo-200">
            {lastImportSummary.batchId}
          </span>
        </div>
      )}

      {/* Batch Analysis Progress Pipeline Card */}
      <AnalysisProgressCard onAnalysisComplete={fetchFeedback} />

      {/* Multi-Dimensional Filter Toolbar */}
      <Card className="p-4 bg-white space-y-3">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
          {/* Search Input */}
          <div className="sm:col-span-2">
            <Input
              placeholder="Search verbatim review text or keywords..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4 text-slate-400" />}
            />
          </div>

          {/* Category Filter */}
          <Select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Categories</option>
            <option value="Product Feedback">Product Feedback</option>
            <option value="Customer Service">Customer Service</option>
            <option value="Fraud and Scam">Fraud and Scam</option>
            <option value="Operational Issues">Operational Issues</option>
          </Select>

          {/* Sentiment Filter */}
          <Select
            value={sentimentFilter}
            onChange={(e) => {
              setSentimentFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
            <option value="mixed">Mixed</option>
          </Select>

          {/* Severity Filter */}
          <Select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Severities</option>
            <option value="5">Sev 5 - Critical</option>
            <option value="4">Sev 4 - High Urgency</option>
            <option value="3">Sev 3 - Moderate</option>
            <option value="2">Sev 2 - Low Impact</option>
            <option value="1">Sev 1 - Minimal</option>
          </Select>

          {/* Analysis Status Filter */}
          <Select
            value={analysisStatusFilter}
            onChange={(e) => {
              setAnalysisStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="analyzed">Analyzed Only</option>
            <option value="pending">Pending Analysis</option>
          </Select>
        </div>

        {/* Secondary Filter & Active Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Provenance Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Origin:</span>
              <select
                value={datasetTypeFilter}
                onChange={(e) => {
                  setDatasetTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
              >
                <option value="all">All Sources</option>
                <option value="genuine_import">Genuine CSV Only</option>
                <option value="demo_sample">Demo Sample Only</option>
              </select>
            </div>

            {/* Topic Filter Pill */}
            {topicFilter && (
              <Badge variant="indigo" size="sm">
                Topic: "{topicFilter}"
                <button
                  type="button"
                  onClick={() => setTopicFilter('')}
                  className="ml-1 hover:text-indigo-900"
                >
                  <X className="h-3 w-3 inline" />
                </button>
              </Badge>
            )}

            {/* Category Filter Pill */}
            {categoryFilter !== 'all' && (
              <Badge variant="neutral" size="sm">
                {categoryFilter}
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className="ml-1 hover:text-slate-900"
                >
                  <X className="h-3 w-3 inline" />
                </button>
              </Badge>
            )}

            {/* Sentiment Filter Pill */}
            {sentimentFilter !== 'all' && (
              <Badge variant="warning" size="sm">
                {sentimentFilter.toUpperCase()}
                <button
                  type="button"
                  onClick={() => setSentimentFilter('all')}
                  className="ml-1 hover:text-amber-900"
                >
                  <X className="h-3 w-3 inline" />
                </button>
              </Badge>
            )}

            {/* Severity Filter Pill */}
            {severityFilter !== 'all' && (
              <Badge variant="danger" size="sm">
                Sev {severityFilter}/5
                <button
                  type="button"
                  onClick={() => setSeverityFilter('all')}
                  className="ml-1 hover:text-rose-900"
                >
                  <X className="h-3 w-3 inline" />
                </button>
              </Badge>
            )}

            {/* Clear All Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline ml-1"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
            >
              <option value="15">15 rows</option>
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Feedback Content Area */}
      {totalCount === 0 && !isLoading ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-6 w-6 text-indigo-600" />}
          title="No customer feedback found"
          description={
            hasActiveFilters
              ? 'No feedback records match the selected filters. Try broadening your criteria or reset filters.'
              : 'The repository is currently empty. Upload the BuildBattle dataset or seed demo records to begin.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearAllFilters}>
                Clear All Filters
              </Button>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setIsManualModalOpen(true)}
                  leftIcon={<MessageSquarePlus className="h-4 w-4 text-indigo-600" />}
                >
                  Submit Feedback
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setIsImportModalOpen(true)}
                  leftIcon={<Upload className="h-4 w-4" />}
                >
                  Ingest Feedback CSV
                </Button>
              </div>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <Card className="overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold text-[11px] uppercase tracking-wider select-none">
                    <th
                      className="py-3 px-4 w-16 cursor-pointer hover:bg-slate-100/80 transition-colors group"
                      onClick={() => handleSort('rowNumber')}
                    >
                      Row {renderSortIndicator('rowNumber')}
                    </th>
                    <th className="py-3 px-4">
                      Verbatim Review Text
                    </th>
                    <th
                      className="py-3 px-4 whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors group"
                      onClick={() => handleSort('category')}
                    >
                      Supplied Category {renderSortIndicator('category')}
                    </th>
                    <th
                      className="py-3 px-4 whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors group"
                      onClick={() => handleSort('sentimentScore')}
                    >
                      AI Sentiment {renderSortIndicator('sentimentScore')}
                    </th>
                    <th
                      className="py-3 px-4 whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors group"
                      onClick={() => handleSort('severity')}
                    >
                      Severity {renderSortIndicator('severity')}
                    </th>
                    <th
                      className="py-3 px-4 whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors group"
                      onClick={() => handleSort('confidence')}
                    >
                      Confidence {renderSortIndicator('confidence')}
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {items.map((item) => {
                    const an = item.analysis;
                    const sev = an?.severity ?? (an?.urgencyScore ? Math.round(an.urgencyScore * 5) : 3);
                    const conf = an?.confidenceScore ?? an?.confidence ?? 0;
                    const isLowConf = an ? conf < 0.70 : false;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedFeedback(item)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                      >
                        {/* Row Number */}
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-400 group-hover:text-indigo-600 font-bold">
                          #{item.rowNumber || '—'}
                        </td>

                        {/* Verbatim Text + Primary Topic */}
                        <td className="py-3.5 px-4 max-w-md">
                          <p className="text-slate-800 leading-relaxed font-normal text-xs sm:text-sm line-clamp-2">
                            "{item.review}"
                          </p>
                          {an?.primaryTopic && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded font-medium">
                                Topic: {an.primaryTopic}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Supplied Category */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge
                            variant={CATEGORY_BADGE_VARIANTS[item.category] || 'neutral'}
                            size="sm"
                            dot
                          >
                            {item.category}
                          </Badge>
                        </td>

                        {/* Sentiment */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {an ? (
                            <Badge
                              variant={SENTIMENT_BADGE_VARIANTS[an.sentiment] || 'neutral'}
                              size="sm"
                            >
                              {an.sentiment.toUpperCase()}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              PENDING
                            </span>
                          )}
                        </td>

                        {/* Severity */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {an ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                                SEVERITY_BADGE_COLORS[sev] || SEVERITY_BADGE_COLORS[3]
                              }`}
                            >
                              Sev {sev}/5
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Confidence */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {an ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono text-slate-700">
                                {(conf * 100).toFixed(0)}%
                              </span>
                              {isLowConf && (
                                <Badge variant="warning" size="sm">
                                  Low
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <span className="text-xs text-indigo-600 font-semibold group-hover:underline inline-flex items-center gap-1">
                            Inspect <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50/50 text-xs text-slate-500 gap-3">
              <div>
                Showing <span className="font-semibold text-slate-800">{items.length}</span> of{' '}
                <span className="font-semibold text-slate-800">{totalCount.toLocaleString()}</span> records
                {categoryFilter !== 'all' && ` in "${categoryFilter}"`}
                {sentimentFilter !== 'all' && ` [${sentimentFilter}]`}
              </div>

              <div className="flex items-center gap-2">
                <span className="mr-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>

          {/* Mobile Responsive Cards Layout */}
          <div className="md:hidden space-y-3">
            {items.map((item) => {
              const an = item.analysis;
              const sev = an?.severity ?? (an?.urgencyScore ? Math.round(an.urgencyScore * 5) : 3);
              const conf = an?.confidenceScore ?? an?.confidence ?? 0;
              const isLowConf = an ? conf < 0.70 : false;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedFeedback(item)}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 cursor-pointer hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      #{item.rowNumber || '—'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={CATEGORY_BADGE_VARIANTS[item.category] || 'neutral'}
                        size="sm"
                        dot
                      >
                        {item.category}
                      </Badge>
                      {an ? (
                        <Badge
                          variant={SENTIMENT_BADGE_VARIANTS[an.sentiment] || 'neutral'}
                          size="sm"
                        >
                          {an.sentiment.toUpperCase()}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-mono">
                          PENDING
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-800 leading-relaxed font-normal">
                    "{item.review}"
                  </p>

                  {an?.primaryTopic && (
                    <div className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-medium">
                      Topic: {an.primaryTopic}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500">
                    <div className="flex items-center gap-2">
                      {an && (
                        <span
                          className={`px-1.5 py-0.2 rounded font-mono font-bold text-[11px] border ${
                            SEVERITY_BADGE_COLORS[sev] || SEVERITY_BADGE_COLORS[3]
                          }`}
                        >
                          Sev {sev}/5
                        </span>
                      )}
                      {an && isLowConf && (
                        <Badge variant="warning" size="sm">
                          Low Conf
                        </Badge>
                      )}
                    </div>
                    <span className="text-indigo-600 font-semibold text-xs inline-flex items-center gap-1">
                      View Detail <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Mobile Pagination */}
            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 text-xs">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Ingestion Modal */}
      <FeedbackImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        onStartAnalysis={handleStartAnalysisFromImport}
      />

      {/* Manual Feedback Submission Modal */}
      <ManualFeedbackModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmitSuccess={handleManualSubmitSuccess}
      />

      {/* Verbatim Feedback Review Detail Drawer */}
      <FeedbackDetailDrawer
        isOpen={Boolean(selectedFeedback)}
        onClose={() => setSelectedFeedback(null)}
        feedback={selectedFeedback}
        onAnalyzeSuccess={handleDrawerAnalyzeSuccess}
      />
    </div>
  );
};

export default FeedbackPage;
