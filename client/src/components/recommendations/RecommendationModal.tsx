import React, { useState } from 'react';
import {
  X,
  Sparkles,
  RotateCw,
  Copy,
  Check,
  Clock,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Cpu,
  BarChart2,
  Users,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { IssueRecommendation } from '../../types/recommendations';
import { Link } from 'react-router-dom';

interface RecommendationModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: IssueRecommendation | null;
  onRegenerate?: (issueId: string) => Promise<void>;
  isRegenerating?: boolean;
}

export const RecommendationModal: React.FC<RecommendationModalProps> = ({
  isOpen,
  onClose,
  recommendation,
  onRegenerate,
  isRegenerating = false,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen || !recommendation) return null;

  const {
    issueCode,
    title,
    issueSummary,
    whyItMatters,
    suggestedTeam,
    recommendedActions,
    evidenceExcerpts,
    measuredFacts,
    isFallback,
    confidenceScore,
    generatedAt,
    modelVersion,
    promptVersion,
    issueId,
  } = recommendation;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPriorityBadgeVariant = (tier: string): 'danger' | 'warning' | 'indigo' | 'neutral' => {
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

  const getTimeframeBadgeVariant = (timeframe: string): 'danger' | 'warning' | 'indigo' | 'neutral' => {
    switch (timeframe) {
      case 'immediate':
        return 'danger';
      case 'short_term':
        return 'warning';
      default:
        return 'indigo';
    }
  };

  const getTeamIcon = (team: string) => {
    switch (team) {
      case 'Engineering':
        return <Cpu className="h-3.5 w-3.5" />;
      case 'Trust & Safety':
        return <ShieldCheck className="h-3.5 w-3.5" />;
      case 'Customer Support':
        return <Users className="h-3.5 w-3.5" />;
      default:
        return <BarChart2 className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl my-auto rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="space-y-1.5 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getPriorityBadgeVariant(measuredFacts.priorityTier)} size="sm" dot>
                {measuredFacts.priorityTier.toUpperCase()} PRIORITY
              </Badge>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Score: {measuredFacts.priorityScore}/100
              </span>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white/10 text-slate-300">
                {issueCode}
              </span>
              <Badge variant="indigo" size="sm" className="bg-indigo-400/20 text-indigo-200 border-indigo-400/30">
                <span className="flex items-center gap-1">
                  {getTeamIcon(suggestedTeam)}
                  Team: {suggestedTeam}
                </span>
              </Badge>
              {isFallback && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Deterministic Heuristic
                </span>
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-1">
              {title}
            </h3>
            <p className="text-xs text-slate-300">
              Evidence-backed strategic resolution plan synthesized from verbatim customer reports.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Fact vs Suggestion Provenance Distinction Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-800">Verified Facts:</span>
            <span>Measured directly from raw database records.</span>
            <span className="mx-1 text-slate-300">•</span>
            <span className="flex h-2 w-2 rounded-full bg-indigo-500" />
            <span className="font-semibold text-slate-800">AI Suggestions:</span>
            <span>Synthesized strategic next steps.</span>
          </div>
          <span className="text-slate-400 font-mono text-[10px]">
            Model: {modelVersion} • {promptVersion}
          </span>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          
          {/* SECTION 1: MEASURED CUSTOMER FACTS (Verified Telemetry) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 className="h-4 w-4 text-emerald-600" />
                1. Measured Customer Signals & Facts
              </span>
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                Verified Ground Truth
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-center">
                <span className="text-xs text-slate-500 font-medium block">Total Mentions</span>
                <div className="text-xl font-bold text-slate-900 mt-0.5">
                  {measuredFacts.totalFrequency.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {measuredFacts.uniqueReports} unique ({Math.round(measuredFacts.duplicateRatio * 100)}% duplicates)
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 text-center">
                <span className="text-xs text-rose-700 font-medium block">Average Severity</span>
                <div className="text-xl font-bold text-rose-800 mt-0.5">
                  {measuredFacts.averageSeverity.toFixed(2)} <span className="text-xs font-normal text-rose-600">/ 5.0</span>
                </div>
                <span className="text-[10px] text-rose-600 mt-0.5 block">
                  Sev 5: {measuredFacts.severityBreakdown.sev5} • Sev 4: {measuredFacts.severityBreakdown.sev4}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/60 text-center">
                <span className="text-xs text-indigo-700 font-medium block">Negative Proportion</span>
                <div className="text-xl font-bold text-indigo-900 mt-0.5">
                  {measuredFacts.totalFrequency > 0 
                    ? Math.round((measuredFacts.sentimentDistribution.negative / measuredFacts.totalFrequency) * 100)
                    : 0}%
                </div>
                <span className="text-[10px] text-indigo-600 mt-0.5 block">
                  {measuredFacts.sentimentDistribution.negative} neg • {measuredFacts.sentimentDistribution.mixed} mix
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-center">
                <span className="text-xs text-slate-500 font-medium block">Priority Metric</span>
                <div className="text-xl font-bold text-slate-900 mt-0.5">
                  {measuredFacts.priorityScore}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block uppercase font-semibold">
                  {measuredFacts.priorityTier} TIER
                </span>
              </div>
            </div>

            {/* Severity Distribution Breakdown Pills */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-600">Severity Tier Breakdown:</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
                  Sev 5 (Critical): {measuredFacts.severityBreakdown.sev5}
                </span>
                <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold">
                  Sev 4: {measuredFacts.severityBreakdown.sev4}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                  Sev 3: {measuredFacts.severityBreakdown.sev3}
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  Sev 2: {measuredFacts.severityBreakdown.sev2}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Sev 1: {measuredFacts.severityBreakdown.sev1}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: AI STRATEGIC ANALYSIS */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              2. AI Strategic Summary & Root-Cause Analysis
            </span>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-2xs">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Issue Summary
                </span>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                  {issueSummary}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-1.5 shadow-2xs">
                <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">
                  Why It Matters & Urgency
                </span>
                <p className="text-xs sm:text-sm text-indigo-950 leading-relaxed">
                  {whyItMatters}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: RECOMMENDED ACTION INITIATIVES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowRight className="h-4 w-4 text-indigo-600" />
                3. Concrete Recommended Actions ({recommendedActions.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Lead Team: <strong className="text-slate-800">{suggestedTeam}</strong>
              </span>
            </div>

            <div className="space-y-3">
              {recommendedActions.map((action, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white shrink-0">
                        {idx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {action.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={getTimeframeBadgeVariant(action.timeframe)} size="sm">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {action.timeframe.replace('_', ' ').toUpperCase()}
                        </span>
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {action.suggestedOwnerTeam}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pl-7">
                    {action.description}
                  </p>

                  <div className="pl-7 pt-1">
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 border border-emerald-200/70">
                      <span className="font-semibold text-emerald-900">Expected Impact:</span>
                      <span>{action.expectedImpact}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: EVIDENCE EXCERPTS & CITATIONS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                4. Supporting Customer Evidence Excerpts ({evidenceExcerpts.length})
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Real Feedback Citations
              </span>
            </div>

            {evidenceExcerpts.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                No individual review excerpts attached.
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {evidenceExcerpts.map((ex, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-2 text-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-600 font-medium">
                            ID: {ex.feedbackId.slice(0, 8)}...
                          </span>
                          <button
                            onClick={() => handleCopy(ex.feedbackId, ex.feedbackId)}
                            className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                            title="Copy Feedback UUID"
                          >
                            {copiedId === ex.feedbackId ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        <Badge variant="neutral" size="sm">
                          {ex.category}
                        </Badge>
                      </div>

                      <p className="text-slate-800 italic leading-snug">
                        "{ex.quote}"
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {ex.severity ? `Sev ${ex.severity}` : 'Severity Analyzed'}
                        {ex.sentiment ? ` • ${ex.sentiment}` : ''}
                      </span>
                      <Link
                        to={`/feedback?search=${encodeURIComponent(ex.quote.slice(0, 30))}`}
                        className="text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-0.5 font-medium"
                      >
                        Inspect <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 bg-slate-50">
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>Generated: {new Date(generatedAt).toLocaleString()}</span>
            <span>•</span>
            <span>Confidence: {Math.round(confidenceScore * 100)}%</span>
          </div>

          <div className="flex items-center gap-2.5">
            {onRegenerate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRegenerate(issueId)}
                isLoading={isRegenerating}
                leftIcon={<RotateCw className={`h-3.5 w-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />}
              >
                Regenerate AI Plan
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
