import React, { useState, useEffect } from 'react';
import {
  X,
  Star,
  Sparkles,
  User,
  CheckCircle2,
  AlertCircle,
  Send,
  Info,
  Check,
  Copy,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { IssueDetailResponse, IssueStatus } from '../../types/issues';
import type { IssueRecommendation } from '../../types/recommendations';

interface IssueDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string | null;
  onIssueUpdated?: () => void;
  onOpenRecommendation?: (rec: IssueRecommendation) => void;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  isOpen,
  onClose,
  issueId,
  onIssueUpdated,
  onOpenRecommendation,
}) => {
  const [detail, setDetail] = useState<IssueDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Status transition state & confirmation modal
  const [pendingStatus, setPendingStatus] = useState<IssueStatus | null>(null);
  const [showStatusConfirm, setShowStatusConfirm] = useState<boolean>(false);
  const [statusNote, setStatusNote] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Assignee state
  const [isEditingAssignee, setIsEditingAssignee] = useState<boolean>(false);
  const [assigneeInput, setAssigneeInput] = useState<string>('');
  const [isUpdatingAssignee, setIsUpdatingAssignee] = useState<boolean>(false);

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [newNoteAuthor, setNewNoteAuthor] = useState<string>('Product Lead');
  const [isAddingNote, setIsAddingNote] = useState<boolean>(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'notes' | 'history'>('overview');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !issueId) {
      setDetail(null);
      return;
    }

    const fetchDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/issues/${issueId}`);
        if (!res.ok) {
          throw new Error(`Issue details are currently unavailable (HTTP ${res.status}).`);
        }
        const data = await res.json();
        if (data.success) {
          setDetail(data);
          setAssigneeInput(data.issue.assignee || '');
        } else {
          throw new Error(data.message || 'Issue details could not be retrieved.');
        }
      } catch (err: any) {
        console.warn('Issue details fetch note:', err);
        setError(err.message || 'Unable to retrieve issue details.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, issueId]);

  if (!isOpen || !issueId) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStatusChangeClick = (newStatus: IssueStatus) => {
    if (!detail) return;
    const current = detail.issue.status;
    if (current === newStatus) return;

    // Consequential action confirmation for Resolved or Dismissed
    if (newStatus === 'resolved' || newStatus === 'dismissed') {
      setPendingStatus(newStatus);
      setStatusNote('');
      setShowStatusConfirm(true);
    } else {
      executeStatusUpdate(newStatus);
    }
  };

  const executeStatusUpdate = async (statusToSet: IssueStatus, noteText?: string) => {
    if (!detail) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/issues/${detail.issue.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: statusToSet,
          note: noteText || undefined,
          changedBy: 'Current User',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update status.');
      }

      const resData = await res.json();
      if (resData.success) {
        setDetail((prev) => (prev ? {
          ...prev,
          issue: resData.issue,
          statusUpdatedAt: resData.issue.statusUpdatedAt || new Date().toISOString(),
          statusHistory: resData.issue.statusHistory || prev.statusHistory,
          notes: resData.issue.notes || prev.notes,
        } : null));
        setShowStatusConfirm(false);
        setPendingStatus(null);
        if (onIssueUpdated) onIssueUpdated();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update issue status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSaveAssignee = async () => {
    if (!detail) return;
    setIsUpdatingAssignee(true);
    try {
      const res = await fetch(`/api/issues/${detail.issue.id}/assignee`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignee: assigneeInput.trim() || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to assign owner.');
      }

      const resData = await res.json();
      if (resData.success) {
        setDetail((prev) => (prev ? { ...prev, issue: resData.issue } : null));
        setIsEditingAssignee(false);
        if (onIssueUpdated) onIssueUpdated();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update assignee.');
    } finally {
      setIsUpdatingAssignee(false);
    }
  };

  const handleToggleSaved = async () => {
    if (!detail) return;
    try {
      const res = await fetch(`/api/issues/${detail.issue.id}/save`, {
        method: 'PATCH',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDetail((prev) => (prev ? {
            ...prev,
            isSaved: data.issue.isSaved,
            issue: data.issue,
          } : null));
          if (onIssueUpdated) onIssueUpdated();
        }
      }
    } catch (err) {
      console.error('Failed to toggle saved state:', err);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    if (!newNoteContent.trim()) {
      setNoteError('Note content cannot be empty.');
      return;
    }

    setNoteError(null);
    setIsAddingNote(true);
    try {
      const res = await fetch(`/api/issues/${detail.issue.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newNoteContent.trim(),
          author: newNoteAuthor.trim() || 'Team Member',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to add note.');
      }

      const resData = await res.json();
      if (resData.success) {
        setDetail((prev) => (prev ? {
          ...prev,
          notes: resData.notes || prev.notes,
          issue: resData.issue || prev.issue,
        } : null));
        setNewNoteContent('');
        if (onIssueUpdated) onIssueUpdated();
      }
    } catch (err: any) {
      setNoteError(err.message || 'Failed to submit internal note.');
    } finally {
      setIsAddingNote(false);
    }
  };

  const getPriorityVariant = (tier: string): 'danger' | 'warning' | 'indigo' | 'neutral' => {
    switch (tier.toLowerCase()) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/20">
          <div className="space-y-1.5 min-w-0 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={detail ? getPriorityVariant(detail.priorityTier) : 'neutral'} size="sm" dot>
                {detail ? detail.priorityTier.toUpperCase() : '...'} PRIORITY
              </Badge>
              {detail && (
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {detail.priorityScore} / 100 pts
                </span>
              )}
              {detail && (
                <Badge variant="neutral" size="sm">
                  {detail.issue.category}
                </Badge>
              )}
              <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {detail?.issue.issueCode || '...'}
              </span>
              {detail && (
                <button
                  onClick={handleToggleSaved}
                  title={detail.isSaved ? 'Remove from saved' : 'Save / Bookmark issue'}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    detail.isSaved
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${detail.isSaved ? 'fill-amber-500 text-amber-600' : 'text-slate-400'}`} />
                  <span>{detail.isSaved ? 'Saved' : 'Save'}</span>
                </button>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 line-clamp-2">
              {detail ? detail.issue.title : 'Loading Issue Details...'}
            </h2>
            {detail && (
              <p className="text-xs text-slate-600 line-clamp-2">
                {detail.issue.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Status & Owner Quick Bar */}
        {detail && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs">
            {/* Status Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-600">Status:</span>
              {(['open', 'in_progress', 'resolved', 'dismissed'] as IssueStatus[]).map((st) => {
                const isActive = (detail.issue.status || 'open').toLowerCase() === st;
                return (
                  <button
                    key={st}
                    onClick={() => handleStatusChangeClick(st)}
                    disabled={isUpdatingStatus}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-100'
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

            {/* Owner / Assignee */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Assignee:</span>
              {isEditingAssignee ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={assigneeInput}
                    onChange={(e) => setAssigneeInput(e.target.value)}
                    placeholder="e.g. Sarah Lin, Engineering..."
                    className="h-7 text-xs px-2 rounded border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                    autoFocus
                  />
                  <Button size="sm" variant="primary" className="h-7 px-2 text-xs" onClick={handleSaveAssignee} disabled={isUpdatingAssignee}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setIsEditingAssignee(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div 
                  onClick={() => setIsEditingAssignee(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 cursor-pointer"
                  title="Click to assign owner"
                >
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium">{detail.issue.assignee || 'Unassigned'}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-4 px-5 border-b border-slate-200 bg-white text-xs font-semibold">
          {[
            { id: 'overview', label: 'Overview & Score Breakdown' },
            { id: 'reviews', label: `Supporting Reviews (${detail?.members.length || 0})` },
            { id: 'notes', label: `Internal Notes (${detail?.notes.length || 0})` },
            { id: 'history', label: `Status History (${detail?.statusHistory.length || 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-500">
              Loading issue tracking data...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : !detail ? null : (
            <>
              {/* Tab 1: Overview & Score Breakdown */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Verified Metric Facts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">Frequency</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{detail.frequency} mentions</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Assigned customer reviews</div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">Unique Inquiries</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">{detail.uniqueReports} unique</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{detail.duplicateRatio}% repeat copies</div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">Negative Sentiment</div>
                      <div className="mt-1 text-xl font-bold text-rose-600">{Math.round(detail.negativeSentimentRatio * 100)}%</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Proportion of critical feedback</div>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">Status Timestamp</div>
                      <div className="mt-1 text-xs font-semibold text-slate-800">
                        {new Date(detail.statusUpdatedAt).toLocaleDateString()}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(detail.statusUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  {/* Deterministic Priority Score Breakdown */}
                  {detail.scoreBreakdown && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 text-xs space-y-2.5">
                      <div className="flex items-center justify-between font-bold text-slate-900">
                        <span>Priority Score Breakdown</span>
                        <span className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {detail.scoreBreakdown.score} pts
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[11px] text-slate-500">Frequency (40% Weight)</span>
                          <div className="text-base font-bold text-slate-900 mt-0.5">
                            +{detail.scoreBreakdown.components.frequencyPoints} pts
                          </div>
                          <span className="text-[11px] text-slate-400">
                            F = {detail.scoreBreakdown.components.frequencyScore}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[11px] text-slate-500">Severity (35% Weight)</span>
                          <div className="text-base font-bold text-slate-900 mt-0.5">
                            +{detail.scoreBreakdown.components.severityPoints} pts
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Avg {detail.scoreBreakdown.components.rawAverageSeverity}/5 scale
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[11px] text-slate-500">Negative Sentiment (25% Weight)</span>
                          <div className="text-base font-bold text-slate-900 mt-0.5">
                            +{detail.scoreBreakdown.components.negativeSentimentPoints} pts
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {Math.round(detail.scoreBreakdown.components.negativeSentimentRatio * 100)}% negative
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-start gap-1.5 pt-1">
                        <Info className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <span>{detail.scoreBreakdown.disclaimer}</span>
                      </div>
                    </div>
                  )}

                  {/* AI Evidence-Backed Recommendations Banner */}
                  <div className="p-4 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/60 to-purple-50/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-950">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        <span>Evidence-Backed AI Recommendation</span>
                      </div>
                      {detail.recommendation ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-100"
                          onClick={() => {
                            if (onOpenRecommendation && detail.recommendation) {
                              onOpenRecommendation(detail.recommendation);
                            }
                          }}
                        >
                          View Full AI Recommendation
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Not generated yet</span>
                      )}
                    </div>
                    {detail.recommendation ? (
                      <div className="text-xs text-slate-700 space-y-1.5">
                        <p className="font-semibold text-slate-900">{detail.recommendation.issueSummary}</p>
                        <p className="text-slate-600 italic">"{detail.recommendation.whyItMatters}"</p>
                        <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                          <span>Responsible Team: <strong className="text-slate-800">{detail.recommendation.suggestedTeam}</strong></span>
                          <span>•</span>
                          <span>{detail.recommendation.recommendedActions.length} suggested actions</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Evidence-backed root cause summary and actions available in AI Insights tab.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Supporting Reviews */}
              {activeTab === 'reviews' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Customer reviews linked to this issue ({detail.members.length}):</span>
                    <span className="font-mono text-[11px]">Exact citations linked in issue_feedback</span>
                  </div>
                  {detail.members.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">No member reviews linked.</div>
                  ) : (
                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                      {detail.members.map((item, idx) => (
                        <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                              <span>ID: {item.feedback.id.slice(0, 8)}...</span>
                              <button
                                onClick={() => handleCopy(item.feedback.id, item.feedback.id)}
                                className="hover:text-indigo-600 p-0.5"
                                title="Copy feedback ID"
                              >
                                {copiedId === item.feedback.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.analysis?.sentiment && (
                                <Badge variant={item.analysis.sentiment === 'negative' ? 'danger' : 'neutral'} size="sm">
                                  {item.analysis.sentiment}
                                </Badge>
                              )}
                              {item.analysis?.severity && (
                                <span className="font-mono text-[11px] text-slate-500">
                                  Sev {item.analysis.severity}/5
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-slate-800 leading-relaxed italic">
                            "{item.feedback.review}"
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                            <span>Source: {item.feedback.source}</span>
                            <span>{new Date(item.feedback.importedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Internal Notes */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>Add Internal Note / Action Memo</span>
                      <div className="flex items-center gap-1.5 text-slate-500 font-normal">
                        <span>Author:</span>
                        <input
                          type="text"
                          value={newNoteAuthor}
                          onChange={(e) => setNewNoteAuthor(e.target.value)}
                          className="px-2 py-0.5 rounded border border-slate-300 bg-white text-xs"
                        />
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Add an internal observation, root-cause notes, or triage memo..."
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                    />
                    {noteError && (
                      <p className="text-[11px] text-rose-600 font-medium">{noteError}</p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        size="sm"
                        variant="primary"
                        leftIcon={<Send className="h-3.5 w-3.5" />}
                        disabled={isAddingNote || !newNoteContent.trim()}
                      >
                        {isAddingNote ? 'Saving Note...' : 'Add Note'}
                      </Button>
                    </div>
                  </form>

                  {/* Notes Timeline */}
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {detail.notes.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No internal notes recorded yet. Add the first note above.
                      </div>
                    ) : (
                      detail.notes.map((note) => (
                        <div key={note.id} className="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-800">{note.author}</span>
                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Status History Audit Trail */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500 font-semibold">
                    Complete status transition history with timestamps:
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {detail.statusHistory.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">No status transitions recorded.</div>
                    ) : (
                      detail.statusHistory.map((hist) => (
                        <div key={hist.id} className="p-3 rounded-xl border border-slate-200 bg-white text-xs flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">
                                {hist.fromStatus} → <strong>{hist.toStatus}</strong>
                              </span>
                              <Badge variant="neutral" size="sm">{hist.changedBy || 'System'}</Badge>
                            </div>
                            {hist.reason && (
                              <p className="text-slate-600 text-xs italic">Reason: {hist.reason}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right text-[11px] text-slate-400">
                            <div>{new Date(hist.changedAt).toLocaleDateString()}</div>
                            <div>{new Date(hist.changedAt).toLocaleTimeString()}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Consequential Action Confirmation Modal */}
        {showStatusConfirm && pendingStatus && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${pendingStatus === 'resolved' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                  {pendingStatus === 'resolved' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Confirm Marking Issue as {pendingStatus === 'resolved' ? 'Resolved' : 'Dismissed'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {pendingStatus === 'resolved'
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
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="e.g. Patch verified, or superseded by v2 auth service..."
                  className="w-full p-2 rounded-md border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowStatusConfirm(false);
                    setPendingStatus(null);
                  }}
                  disabled={isUpdatingStatus}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant={pendingStatus === 'resolved' ? 'primary' : 'outline'}
                  onClick={() => executeStatusUpdate(pendingStatus, statusNote)}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? 'Updating...' : `Confirm ${pendingStatus === 'resolved' ? 'Resolution' : 'Dismissal'}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
