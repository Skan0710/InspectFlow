import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Plus,
  Clock,
  RotateCw,
  FileText,
  Trash2,
  Eye,
  AlertCircle,
  X,
  Sparkles,
  BarChart3,
  Layers,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { EmptyState } from '../components/ui/EmptyState';
import { FlipText } from '../components/ui/flip-text';
import { StatsCounter } from '../components/ui/stats-counter';
import {
  fetchReports,
  fetchReportById,
  generateReport,
  deleteReport,
} from '../api/client';
import type {
  ReportRecord,
  ReportType,
  ReportFormat,
  CreateReportRequest,
} from '../types/reports';

export const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedReport, setSelectedReport] = useState<ReportRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Form state
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formType, setFormType] = useState<ReportType>('executive_summary');
  const [formFormat, setFormFormat] = useState<ReportFormat>('both');
  const [formDatasetType, setFormDatasetType] = useState<string>('all');
  const [formCategory, setFormCategory] = useState<string>('all');

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchReports({ type: typeFilter });
      setReports(data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setModalError(null);

    try {
      const payload: CreateReportRequest = {
        title: formTitle.trim() || undefined,
        description: formDescription.trim() || undefined,
        reportType: formType,
        format: formFormat,
        scope: {
          datasetType: formDatasetType !== 'all' ? (formDatasetType as any) : undefined,
          category: formCategory !== 'all' ? formCategory : undefined,
        },
      };

      const newReport = await generateReport(payload);
      setIsCreateModalOpen(false);
      setFormTitle('');
      setFormDescription('');
      await loadReports();
      setSelectedReport(newReport);
      setIsDetailModalOpen(true);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this generated report?')) {
      return;
    }
    try {
      await deleteReport(id);
      if (selectedReport?.id === id) {
        setSelectedReport(null);
        setIsDetailModalOpen(false);
      }
      await loadReports();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete report');
    }
  };

  const handleViewDetail = async (report: ReportRecord) => {
    try {
      const detailed = await fetchReportById(report.id);
      setSelectedReport(detailed);
      setIsDetailModalOpen(true);
    } catch {
      setSelectedReport(report);
      setIsDetailModalOpen(true);
    }
  };

  const handleDownload = (id: string, format: 'pdf' | 'csv', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    window.open(`/api/reports/${id}/${format}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 page-header">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span>Executive</span>
              <FlipText className="text-indigo-300">
                Reports & Digests
              </FlipText>
            </h2>
            <Badge variant="indigo" size="sm" className="font-mono">
              <StatsCounter value={reports.length} /> Reports
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Generate executive briefings, downloadable PDF audits, and structured CSV intelligence digests calculated from actual feedback records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadReports}
            isLoading={isLoading}
            leftIcon={<RotateCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Generate Custom Report
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Filter Type:</span>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-48 text-xs py-1"
          >
            <option value="all">All Report Types</option>
            <option value="executive_summary">Executive Summary</option>
            <option value="full_audit">Full Audit</option>
            <option value="issue_digest">High-Priority Issue Digest</option>
            <option value="sentiment_overview">Sentiment Overview</option>
          </Select>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          {reports.length} {reports.length === 1 ? 'Report' : 'Reports'} available
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button size="sm" variant="outline" onClick={loadReports}>
            Retry
          </Button>
        </div>
      )}

      {/* Reports List */}
      {reports.length === 0 && !isLoading ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No Reports Generated Yet"
          description="Create your first executive business intelligence report to download verified PDF briefings and CSV digests."
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Generate First Report
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {reports.map((report) => {
            const p = report.contentPayload;
            return (
              <Card
                key={report.id}
                className="hover:border-indigo-200 hover:shadow-xs transition-all cursor-pointer bg-white"
                onClick={() => handleViewDetail(report)}
              >
                <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="indigo" size="sm">
                        {report.format === 'both' ? 'PDF + CSV' : report.format.toUpperCase()}
                      </Badge>
                      <span className="font-mono text-xs text-slate-500 font-bold">
                        {report.reportCode}
                      </span>
                      <Badge variant="neutral" size="sm">
                        {report.reportType.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                      <span className="text-slate-400">•</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {new Date(report.generatedAt).toLocaleDateString()} at{' '}
                        {new Date(report.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <CardTitle className="text-base sm:text-lg text-slate-900 pt-1">
                      {report.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-slate-600 text-xs">
                      {report.description || p.executiveSummary}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="success" size="sm" dot>
                      Generated
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-1 pb-3 text-xs">
                  {/* Executive Metric Highlights */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-lg bg-slate-50 p-3 border border-slate-100">
                    <div className="space-y-0.5">
                      <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                        Dataset Scope
                      </div>
                      <div className="font-bold text-slate-800 text-sm">
                        {p.datasetScope.totalFeedback.toLocaleString()} Reviews
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {p.datasetScope.analysisCoveragePercent}% analyzed
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                        Net Sentiment
                      </div>
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-1">
                        {p.sentimentDistribution.netSentimentScore >= 0 ? (
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                        )}
                        <span className={p.sentimentDistribution.netSentimentScore >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                          {p.sentimentDistribution.netSentimentScore > 0 ? '+' : ''}
                          {p.sentimentDistribution.netSentimentScore}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {p.sentimentDistribution.positive.percentage}% pos • {p.sentimentDistribution.negative.percentage}% neg
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                        Top Operational Issue
                      </div>
                      <div className="font-bold text-slate-800 text-sm truncate">
                        {p.topPriorityIssues[0]?.title || 'No issues identified'}
                      </div>
                      <div className="text-[11px] text-indigo-600 font-medium">
                        {p.topPriorityIssues[0]
                          ? `Priority ${p.topPriorityIssues[0].priorityScore}/100 • ${p.topPriorityIssues[0].frequency} mentions`
                          : 'Zero open issues'}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                        Action Center
                      </div>
                      <div className="font-bold text-slate-800 text-sm">
                        {p.issueStatusSummary.open} Open / {p.issueStatusSummary.resolved} Resolved
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {p.issueStatusSummary.in_progress} in progress
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="py-2.5 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400 font-mono">
                    {p.metadata.applicableDateRange.isSnapshot ? (
                      <span className="flex items-center gap-1 text-amber-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Current Snapshot (Imported Dataset)
                      </span>
                    ) : (
                      <span>Discrete observation window: {p.metadata.applicableDateRange.note}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Eye className="h-3.5 w-3.5" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetail(report);
                      }}
                    >
                      View Details
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Download className="h-3.5 w-3.5 text-indigo-600" />}
                      onClick={(e) => handleDownload(report.id, 'pdf', e)}
                      title="Download Executive PDF"
                    >
                      PDF
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Download className="h-3.5 w-3.5 text-emerald-600" />}
                      onClick={(e) => handleDownload(report.id, 'csv', e)}
                      title="Download Intelligence CSV"
                    >
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:border-red-200"
                      onClick={(e) => handleDelete(report.id, e)}
                      title="Delete Report"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Generate Custom Report Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Generate Business Intelligence Report</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateReport} className="space-y-4 pt-4">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Report Title (Optional)</label>
                <Input
                  placeholder="e.g. Q4 Executive Customer Sentiment & Issue Audit"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Report Type</label>
                  <Select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as ReportType)}
                  >
                    <option value="executive_summary">Executive Summary</option>
                    <option value="full_audit">Comprehensive Audit</option>
                    <option value="issue_digest">High-Priority Issue Digest</option>
                    <option value="sentiment_overview">Sentiment Overview</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Export Format</label>
                  <Select
                    value={formFormat}
                    onChange={(e) => setFormFormat(e.target.value as ReportFormat)}
                  >
                    <option value="both">Both (PDF + CSV)</option>
                    <option value="pdf">PDF Executive Briefing</option>
                    <option value="csv">Structured CSV Dataset</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Dataset Scope</label>
                  <Select
                    value={formDatasetType}
                    onChange={(e) => setFormDatasetType(e.target.value)}
                  >
                    <option value="all">All Feedback Records</option>
                    <option value="genuine_import">Genuine Production CSV</option>
                    <option value="demo_sample">Demo Sample Fixture</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Category Filter</label>
                  <Select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    <option value="Product Feedback">Product Feedback</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Order Issues">Order Issues</option>
                    <option value="Shipping & Delivery">Shipping & Delivery</option>
                    <option value="Website & App Feedback">Website & App Feedback</option>
                    <option value="Returns & Refunds">Returns & Refunds</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Contextual Description (Optional)</label>
                <Textarea
                  placeholder="Additional context or audience scope notes..."
                  value={formDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-[11px] text-indigo-900 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                  Strictly Verified Metrics Invariant
                </div>
                <p className="text-indigo-800 leading-relaxed">
                  All calculations derive strictly from current database records. If timestamp variance is negligible, the report preserves integrity as a Current Snapshot without fabricated historical trends.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isGenerating}
                  leftIcon={<Sparkles className="h-4 w-4" />}
                >
                  Generate Report
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {isDetailModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/50 rounded-t-2xl shrink-0">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="indigo" size="sm">
                    {selectedReport.reportCode}
                  </Badge>
                  <span className="text-xs font-mono text-slate-500">
                    Generated on {new Date(selectedReport.generatedAt).toUTCString()}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  {selectedReport.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedReport.description || selectedReport.contentPayload.metadata.applicableDateRange.note}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Download className="h-4 w-4" />}
                  onClick={() => handleDownload(selectedReport.id, 'pdf')}
                >
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Download className="h-4 w-4" />}
                  onClick={() => handleDownload(selectedReport.id, 'csv')}
                >
                  CSV
                </Button>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
              {/* Executive Summary */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Executive Summary
                </div>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                  {selectedReport.contentPayload.executiveSummary}
                </p>
              </div>

              {/* KPI Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Total Volume</div>
                  <div className="text-lg font-bold text-slate-900">
                    {selectedReport.contentPayload.datasetScope.totalFeedback.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {selectedReport.contentPayload.datasetScope.analysisCoveragePercent}% coverage
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Net Sentiment</div>
                  <div className="text-lg font-bold text-slate-900">
                    {selectedReport.contentPayload.sentimentDistribution.netSentimentScore > 0 ? '+' : ''}
                    {selectedReport.contentPayload.sentimentDistribution.netSentimentScore}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {selectedReport.contentPayload.sentimentDistribution.positive.percentage}% Pos •{' '}
                    {selectedReport.contentPayload.sentimentDistribution.negative.percentage}% Neg
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Unique Inquiry Rate</div>
                  <div className="text-lg font-bold text-slate-900">
                    {100 - selectedReport.contentPayload.datasetScope.duplicateRatePercent}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {selectedReport.contentPayload.datasetScope.uniqueCount} distinct review texts
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Action Center</div>
                  <div className="text-lg font-bold text-slate-900">
                    {selectedReport.contentPayload.issueStatusSummary.open} Open
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {selectedReport.contentPayload.issueStatusSummary.resolved} tickets resolved
                  </div>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-indigo-600" />
                  Category Breakdown & Dominant Sentiment
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3 text-right">Volume</th>
                        <th className="py-2 px-3 text-right">Proportion</th>
                        <th className="py-2 px-3 text-center">Dominant Sentiment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedReport.contentPayload.categoryBreakdown.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-medium text-slate-800">{c.category}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {c.count.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">{c.percentage}%</td>
                          <td className="py-2 px-3 text-center">
                            <Badge
                              variant={
                                c.dominantSentiment === 'positive'
                                  ? 'success'
                                  : c.dominantSentiment === 'negative'
                                  ? 'danger'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              {c.dominantSentiment}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Priority Issues & Score Components */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  Top Priority Issues & Multi-Factor Score Components
                </div>
                <div className="space-y-3">
                  {selectedReport.contentPayload.topPriorityIssues.map((iss) => (
                    <div
                      key={iss.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500">{iss.code}</span>
                          <span className="font-semibold text-xs sm:text-sm text-slate-900">{iss.title}</span>
                          <Badge variant="neutral" size="sm">{iss.category}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              iss.priority === 'critical'
                                ? 'danger'
                                : iss.priority === 'high'
                                ? 'warning'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {iss.priority.toUpperCase()} ({iss.priorityScore}/100)
                          </Badge>
                          <Badge variant="indigo" size="sm">
                            {(iss.status || 'open').toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      {/* Score Breakdown Pills */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500">
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                          Frequency: <strong>{iss.scoreBreakdown.frequencyPoints} pts</strong> ({iss.frequency} mentions)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                          Severity: <strong>{iss.scoreBreakdown.severityPoints} pts</strong>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                          Negativity: <strong>{iss.scoreBreakdown.negativeSentimentPoints} pts</strong>
                        </span>
                      </div>

                      {/* Traceable Excerpts */}
                      {iss.representativeExcerpts.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <div className="text-[10px] font-mono uppercase text-slate-400">
                            Traceable Excerpt Citations:
                          </div>
                          <div className="space-y-1">
                            {iss.representativeExcerpts.slice(0, 2).map((exc, idx) => (
                              <div
                                key={idx}
                                className="p-2 rounded bg-white border border-slate-200 text-xs text-slate-700 font-sans"
                              >
                                <span className="font-mono text-[10px] text-indigo-600 font-bold mr-1.5">
                                  [{exc.feedbackId}]
                                </span>
                                "{exc.quote}"
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommendation */}
                      {iss.recommendation && (
                        <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-950 space-y-1">
                          <div className="font-bold flex items-center justify-between">
                            <span>Recommended Action: {iss.recommendation.responsibleTeam} Team</span>
                          </div>
                          <p className="text-[11px] text-indigo-800 leading-relaxed">
                            {iss.recommendation.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 rounded-b-2xl flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span className="font-mono">
                InsightFlow Analytical Engine • Strictly Non-Financial Risk Intelligence
              </span>
              <Button size="sm" variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
