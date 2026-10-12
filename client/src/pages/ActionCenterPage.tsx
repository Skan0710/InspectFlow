import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import {
  RotateCw,
  Search,
  Star,
  User,
  Clock,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { IssueDetailModal } from '../components/issues/IssueDetailModal';
import { RecommendationModal } from '../components/recommendations/RecommendationModal';
import { StatsCounter } from '../components/ui/stats-counter';
import type { ActionIssue, IssueStatus, StatusSummary } from '../types/issues';
import type { IssueRecommendation } from '../types/recommendations';

export const ActionCenterPage: React.FC = () => {
  const [issues, setIssues] = useState<ActionIssue[]>([]);
  const [statusSummary, setStatusSummary] = useState<StatusSummary>({
    open: 0,
    in_progress: 0,
    resolved: 0,
    dismissed: 0,
    saved: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search state
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'priorityScore' | 'feedbackCount' | 'statusUpdatedAt' | 'createdAt'>('priorityScore');

  // Modals state
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<IssueRecommendation | null>(null);

  // Status update confirmation state
  const [pendingStatusChange, setPendingStatusChange] = useState<{ issueId: string; status: IssueStatus } | null>(null);
  const [statusConfirmationNote, setStatusConfirmationNote] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Quick assignee editing state
  const [editingAssigneeId, setEditingAssigneeId] = useState<string | null>(null);
  const [assigneeText, setAssigneeText] = useState<string>('');

  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const latestRequestRef = useRef(0);

  const fetchIssues = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter === 'saved') {
        params.append('savedOnly', 'true');
      } else if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      params.append('sortBy', sortBy);
      params.append('sortOrder', 'desc');

      const res = await fetch(`/api/issues?${params.toString()}`);
      if (requestId !== latestRequestRef.current) return;
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Failed to load issues (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (requestId !== latestRequestRef.current) return;
      if (data.success) {
        setIssues(data.issues || []);
        if (data.statusSummary) {
          setStatusSummary(data.statusSummary);
        }
      } else {
        throw new Error(data.message || 'Error loading issues.');
      }
    } catch (err: any) {
      if (requestId !== latestRequestRef.current) return;
      console.error('Failed to fetch issues:', err);
      setError(err.message || 'Failed to connect to issues service.');
    } finally {
      if (requestId === latestRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [statusFilter, priorityFilter, debouncedSearch, sortBy]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleStatusChangeClick = (issue: ActionIssue, newStatus: IssueStatus) => {
    if (issue.status === newStatus) return;
    if (newStatus === 'resolved' || newStatus === 'dismissed') {
      setPendingStatusChange({ issueId: issue.id, status: newStatus });
      setStatusConfirmationNote('');
    } else {
      executeStatusChange(issue.id, newStatus);
    }
  };

  const executeStatusChange = async (issueId: string, newStatus: IssueStatus, note?: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          note: note || undefined,
          changedBy: 'Current User',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update status.');
      }

      setPendingStatusChange(null);
      await fetchIssues();
    } catch (err: any) {
      alert(err.message || 'Error occurred while updating issue status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleToggleSaved = async (issueId: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/save`, {
        method: 'PATCH',
      });
      if (res.ok) {
        await fetchIssues();
      }
    } catch (err) {
      console.error('Failed to toggle save state:', err);
    }
  };

  const handleSaveAssignee = async (issueId: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/assignee`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignee: assigneeText.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingAssigneeId(null);
        await fetchIssues();
      }
    } catch (err) {
      console.error('Failed to update assignee:', err);
    }
  };

  const getPriorityBadgeVariant = (priority: string): 'danger' | 'warning' | 'indigo' | 'neutral' => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'indigo';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-3 page-header">
        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Action</span>
            <span className="text-indigo-400">Center</span>
          </h2>
          <p className="text-base text-indigo-200/80 mt-1">
            Track triage status, assign action items, and manage customer issue lifecycles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            leftIcon={<RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={fetchIssues}
            disabled={isLoading}
            className="font-semibold text-sm bg-white/15 hover:bg-white/25 text-white border border-white/35 backdrop-blur-md shadow-md active:scale-95 transition-all"
          >
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Status Overview */}
      <div className="flex items-center gap-2.5 border-b border-white/10 pb-3 overflow-x-auto">
        {[
          { label: 'Open Issues', value: 'open', count: statusSummary.open },
          { label: 'In Progress', value: 'in_progress', count: statusSummary.in_progress },
          { label: 'Resolved', value: 'resolved', count: statusSummary.resolved },
          { label: 'Dismissed', value: 'dismissed', count: statusSummary.dismissed },
          { label: 'Saved / Bookmarked', value: 'saved', count: statusSummary.saved },
          { label: 'All Issues', value: 'all', count: statusSummary.open + statusSummary.in_progress + statusSummary.resolved + statusSummary.dismissed },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`flex items-center gap-2.5 rounded-xl px-4 py-2 text-sm font-bold transition-all shrink-0 cursor-pointer ${
              statusFilter === tab.value
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/35 border border-indigo-400/40'
                : 'bg-white/10 text-indigo-200 hover:bg-white/20 hover:text-white border border-white/15'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-mono font-bold ${
                statusFilter === tab.value
                  ? 'bg-white/25 text-white'
                  : 'bg-white/10 text-indigo-300'
              }`}
            >
              <StatsCounter value={tab.count} />
            </span>
          </button>
        ))}
      </div>

      {/* Control Bar: Search & Priority Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-white/20 bg-indigo-950/60 backdrop-blur-xl p-3.5 shadow-xl text-white">
        <div className="w-full sm:w-72">
          <Input
            type="text"
            placeholder="Search issues"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4 text-indigo-300" />}
            className="h-10 text-sm bg-white/10 border-white/25 text-white placeholder:text-indigo-200/60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="w-36">
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-10 text-sm bg-white/10 border-white/25 text-white font-medium"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>
          <div className="w-48">
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-10 text-sm bg-white/10 border-white/25 text-white font-medium"
            >
              <option value="priorityScore">Highest Priority Score</option>
              <option value="feedbackCount">Highest Mentions</option>
              <option value="statusUpdatedAt">Recently Updated</option>
              <option value="createdAt">Newest Discovered</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-950/60 p-4 text-xs text-rose-200 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchIssues} className="bg-white/10 text-white border-white/20">
            Retry
          </Button>
        </div>
      )}

      {/* Issues Queue List */}
      {isLoading ? (
        <div className="py-20 text-center">
          <RotateCw className="h-8 w-8 animate-spin text-indigo-400 mx-auto" />
          <p className="text-sm font-medium text-indigo-200 mt-3">Loading prioritized issues queue...</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="rounded-2xl p-12 text-center bg-indigo-950/40 border border-white/15">
          <Layers className="h-10 w-10 text-indigo-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No Issues Match Current Filters</h3>
          <p className="text-sm text-indigo-200/80 max-w-md mx-auto mt-1">
            {statusFilter === 'resolved'
              ? 'No resolved issues found. Triage active items to track resolutions.'
              : statusFilter === 'saved'
              ? 'No saved issues. Click the bookmark star on any issue to save it here.'
              : 'All issues in this view have been triaged or no matching clusters were found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {issues.map((issue) => {
            const priorityScore = typeof issue.metadata?.priorityScore === 'number'
              ? issue.metadata.priorityScore
              : Number(issue.metadata?.priorityScore) || 0;
            const duplicateRatio = issue.metadata?.duplicateRatio !== undefined
              ? issue.metadata.duplicateRatio
              : issue.feedbackCount > 0
              ? (issue.feedbackCount - issue.uniqueTextCount) / issue.feedbackCount
              : 0;

            const negativeSentimentRatio = issue.feedbackCount > 0
              ? issue.sentimentBreakdown.negative / issue.feedbackCount
              : 0;

            const isSaved = Boolean(issue.isSaved);
            const recommendation = issue.metadata?.recommendation;

            return (
              <Card key={issue.id} className="transition-all rounded-2xl border border-white/20 bg-indigo-950/60 backdrop-blur-xl hover:border-indigo-400/50 shadow-lg text-white">
                <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getPriorityBadgeVariant(issue.priority)} size="sm" dot>
                        {issue.priority.toUpperCase()}
                      </Badge>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/35">
                        {priorityScore} / 100 pts
                      </span>
                      <span className="font-mono text-xs font-bold text-indigo-200 bg-white/10 border border-white/15 px-2 py-0.5 rounded">
                        {issue.issueCode}
                      </span>
                      <Badge variant="neutral" size="sm">
                        {issue.category}
                      </Badge>
                      <button
                        onClick={() => handleToggleSaved(issue.id)}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          isSaved
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-white/10 text-indigo-200 hover:bg-white/20 hover:text-white border border-white/15'
                        }`}
                        title={isSaved ? 'Remove from saved' : 'Save / Bookmark issue'}
                      >
                        <Star className={`h-3 w-3 ${isSaved ? 'fill-amber-400 text-amber-400' : 'text-indigo-300'}`} />
                        <span>{isSaved ? 'Saved' : 'Save'}</span>
                      </button>
                    </div>

                    <CardTitle className="text-base sm:text-lg font-bold text-white mt-1">
                      {issue.title}
                    </CardTitle>
                    <p className="text-xs sm:text-sm text-indigo-100/80 line-clamp-2 leading-relaxed">
                      {issue.description}
                    </p>
                  </div>

                  {/* Frequency & Sentiment Metrics */}
                  <div className="flex sm:flex-col items-end gap-1.5 shrink-0 text-right">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 px-2.5 py-1 rounded-lg border border-white/15">
                      <Layers className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{issue.feedbackCount} mentions</span>
                    </div>
                    <div className="text-[11px] text-indigo-200/80">
                      {issue.uniqueTextCount} unique inquiries ({Math.round(duplicateRatio * 100)}% dupes)
                    </div>
                    <div className="text-[11px] font-semibold text-rose-400">
                      {Math.round(negativeSentimentRatio * 100)}% negative sentiment
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2.5 border-t border-white/10">
                    {/* Status Switcher Buttons */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase text-indigo-300">Status:</span>
                      {(['open', 'in_progress', 'resolved', 'dismissed'] as IssueStatus[]).map((st) => {
                        const isActive = (issue.status || 'open').toLowerCase() === st;
                        return (
                          <button
                            key={st}
                            onClick={() => handleStatusChangeClick(issue, st)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/35 border border-indigo-400/40'
                                : 'bg-white/10 text-indigo-200 hover:bg-white/20 hover:text-white border border-white/15'
                            }`}
                          >
                            {st === 'open' && 'Open'}
                            {st === 'in_progress' && 'In Progress'}
                            {st === 'resolved' && 'Resolved'}
                            {st === 'dismissed' && 'Dismissed'}
                          </button>
                        );
                      })}
                    </div>

                    {/* Owner / Assignee pill */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase text-indigo-300">Owner:</span>
                      {editingAssigneeId === issue.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={assigneeText}
                            onChange={(e) => setAssigneeText(e.target.value)}
                            className="h-7 text-xs px-2 rounded-lg bg-indigo-950 border border-white/30 text-white"
                            placeholder="Name or team..."
                            autoFocus
                          />
                          <Button size="sm" variant="primary" className="h-7 px-2 text-xs font-semibold" onClick={() => handleSaveAssignee(issue.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs font-semibold" onClick={() => setEditingAssigneeId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingAssigneeId(issue.id);
                            setAssigneeText(issue.assignee || '');
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-100 border border-white/15 text-xs font-medium cursor-pointer transition-colors"
                          title="Click to change assignee"
                        >
                          <User className="h-3 w-3 text-indigo-300" />
                          <span>{issue.assignee || 'Unassigned'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="py-2.5 bg-black/20 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs rounded-b-2xl">
                  <div className="flex flex-wrap items-center gap-3 text-indigo-200/80 text-[11px]">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-indigo-300" />
                      <span>Updated: {new Date(issue.statusUpdatedAt || issue.updatedAt).toLocaleDateString()}</span>
                    </div>
                    {issue.notes && issue.notes.length > 0 && (
                      <span>• {issue.notes.length} internal notes</span>
                    )}
                    {recommendation && (
                      <span className="text-indigo-300 font-semibold">• AI Recommendation Available</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {recommendation && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/30"
                        leftIcon={<Sparkles className="h-3.5 w-3.5 text-indigo-300" />}
                        onClick={() => setSelectedRecommendation(recommendation)}
                      >
                        AI Recs
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/35 border border-indigo-400/40"
                      rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                      onClick={() => setSelectedIssueId(issue.id)}
                    >
                      View Details & Notes
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Consequential Action Confirmation Modal */}
      {pendingStatusChange && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg shrink-0 ${pendingStatusChange.status === 'resolved' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                {pendingStatusChange.status === 'resolved' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirm Marking as {pendingStatusChange.status === 'resolved' ? 'Resolved' : 'Dismissed'}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  {pendingStatusChange.status === 'resolved'
                    ? 'Resolving this issue marks it complete and removes it from the active open priority triage queue.'
                    : 'Dismissing this issue marks it closed/superseded and removes it from the active triage queue.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Optional Resolution Note / Reason:
              </label>
              <textarea
                rows={2}
                value={statusConfirmationNote}
                onChange={(e) => setStatusConfirmationNote(e.target.value)}
                placeholder="e.g. Patch verified in staging, or superseded by v2 auth service..."
                className="w-full p-2 rounded-md border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPendingStatusChange(null)}
                disabled={isUpdatingStatus}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant={pendingStatusChange.status === 'resolved' ? 'primary' : 'outline'}
                onClick={() => executeStatusChange(pendingStatusChange.issueId, pendingStatusChange.status, statusConfirmationNote)}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus ? 'Updating...' : `Confirm ${pendingStatusChange.status === 'resolved' ? 'Resolution' : 'Dismissal'}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Detail & Notes Modal */}
      <IssueDetailModal
        isOpen={Boolean(selectedIssueId)}
        onClose={() => setSelectedIssueId(null)}
        issueId={selectedIssueId}
        onIssueUpdated={fetchIssues}
        onOpenRecommendation={(rec) => {
          setSelectedIssueId(null);
          setSelectedRecommendation(rec);
        }}
      />

      {/* AI Recommendation Modal */}
      <RecommendationModal
        isOpen={Boolean(selectedRecommendation)}
        onClose={() => setSelectedRecommendation(null)}
        recommendation={selectedRecommendation}
      />
    </div>
  );
};
