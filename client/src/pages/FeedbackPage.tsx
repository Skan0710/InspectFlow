import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Upload, 
  RefreshCw, 
  FileSpreadsheet, 
  CheckCircle2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { FeedbackImportModal, type ImportSummary } from '../components/feedback/FeedbackImportModal';

interface FeedbackItem {
  id: string;
  review: string;
  category: string;
  source: string;
  rowNumber: number;
  importedAt: string;
}

const CATEGORY_BADGE_VARIANTS: Record<string, 'indigo' | 'neutral' | 'warning' | 'danger'> = {
  'Product Feedback': 'indigo',
  'Customer Service': 'neutral',
  'Operational Issues': 'warning',
  'Fraud and Scam': 'danger',
};

export const FeedbackPage: React.FC = () => {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(15);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [lastImportSummary, setLastImportSummary] = useState<ImportSummary | null>(null);

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const res = await fetch(`/api/feedback?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.data || []);
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load feedback:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, categoryFilter, search]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleImportSuccess = (summary: ImportSummary) => {
    setLastImportSummary(summary);
    setPage(1);
    fetchFeedback();
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Customer Feedback Repository
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Raw verbatim customer signals and supplied categories ingested via CSV streaming pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
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
            variant="primary"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            leftIcon={<Upload className="h-4 w-4" />}
          >
            Ingest Feedback CSV
          </Button>
        </div>
      </div>

      {/* Latest Batch Notification Banner if available */}
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
            </div>
          </div>
          <span className="font-mono text-[11px] text-indigo-600 bg-white/60 px-2 py-0.5 rounded border border-indigo-200">
            {lastImportSummary.batchId}
          </span>
        </div>
      )}

      {/* Filter and Query Toolbar */}
      <Card className="p-4 bg-white">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search verbatim review text or keywords..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          <Select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Supplied Categories</option>
            <option value="Product Feedback">Product Feedback</option>
            <option value="Customer Service">Customer Service</option>
            <option value="Fraud and Scam">Fraud and Scam</option>
            <option value="Operational Issues">Operational Issues</option>
          </Select>
        </div>
      </Card>

      {/* Feedback Feed Table or Empty State */}
      {totalCount === 0 && !isLoading ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-6 w-6 text-indigo-600" />}
          title="No customer feedback imported yet"
          description="Upload BuildBattle_2026_Customer_Feedback_Dataset.csv to stream, validate, and index customer feedback records."
          action={
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsImportModalOpen(true)}
              leftIcon={<Upload className="h-4 w-4" />}
            >
              Ingest Customer Feedback CSV
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 w-16">Row</th>
                  <th className="py-3 px-4">Verbatim Review Text</th>
                  <th className="py-3 px-4 whitespace-nowrap">Supplied Category</th>
                  <th className="py-3 px-4 whitespace-nowrap">Source Dataset</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">Ingested At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                      #{item.rowNumber || '—'}
                    </td>
                    <td className="py-3.5 px-4 max-w-xl">
                      <p className="text-slate-800 leading-relaxed font-normal text-xs sm:text-sm">
                        "{item.review}"
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Badge
                        variant={CATEGORY_BADGE_VARIANTS[item.category] || 'neutral'}
                        size="sm"
                        dot
                      >
                        {item.category}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {item.source}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400 text-right whitespace-nowrap">
                      {new Date(item.importedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50/50 text-xs text-slate-500 gap-3">
            <div>
              Showing <span className="font-semibold text-slate-800">{items.length}</span> of{' '}
              <span className="font-semibold text-slate-800">{totalCount.toLocaleString()}</span> records
              {categoryFilter !== 'all' && ` in "${categoryFilter}"`}
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
      )}

      {/* CSV Import Modal */}
      <FeedbackImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
};
