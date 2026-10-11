import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Sparkles,
  Quote,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface FeedbackDetailItem {
  id: string;
  review: string;
  category: string;
  source: string;
  rowNumber: number;
  isSample: boolean;
  datasetType: 'genuine_import' | 'demo_sample';
  importedAt: string;
  analysis?: {
    id: string;
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    sentimentScore: number;
    urgency: 'low' | 'normal' | 'high' | 'critical';
    urgencyScore: number;
    primaryTopic: string;
    topics: string[];
    keyPhrases?: string[];
    evidencePhrases?: string[];
    summary: string;
    explanation?: string;
    severity?: number;
    confidenceScore?: number;
    confidence?: number;
    modelVersion: string;
    promptVersion?: string;
    analyzedAt: string;
  } | null;
}

interface FeedbackDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  feedback: FeedbackDetailItem | null;
  onAnalyzeSuccess?: (updatedItem: FeedbackDetailItem) => void;
}

const CATEGORY_BADGE_VARIANTS: Record<string, 'indigo' | 'neutral' | 'warning' | 'danger'> = {
  'Product Feedback': 'indigo',
  'Customer Service': 'neutral',
  'Operational Issues': 'warning',
  'Fraud and Scam': 'danger',
};

const SENTIMENT_BADGE_VARIANTS: Record<string, 'success' | 'neutral' | 'danger' | 'warning'> = {
  positive: 'success',
  neutral: 'neutral',
  negative: 'danger',
  mixed: 'warning',
};

const SEVERITY_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  5: { bg: 'bg-rose-100 text-rose-800 border-rose-200', text: 'text-rose-600', label: 'Critical Emergency' },
  4: { bg: 'bg-orange-100 text-orange-800 border-orange-200', text: 'text-orange-600', label: 'High Urgency' },
  3: { bg: 'bg-amber-100 text-amber-800 border-amber-200', text: 'text-amber-600', label: 'Moderate Friction' },
  2: { bg: 'bg-blue-100 text-blue-800 border-blue-200', text: 'text-blue-600', label: 'Minor Impact' },
  1: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'text-emerald-600', label: 'Trivial / Praise' },
};

export const FeedbackDetailDrawer: React.FC<FeedbackDetailDrawerProps> = ({
  isOpen,
  onClose,
  feedback,
  onAnalyzeSuccess,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  if (!isOpen || !feedback) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(feedback.review);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAnalyzeNow = async () => {
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch(`/api/feedback/${feedback.id}/analyze`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Analysis failed');
      }
      const data = await res.json();
      if (data.data) {
        const updated: FeedbackDetailItem = {
          ...feedback,
          analysis: data.data,
        };
        if (onAnalyzeSuccess) {
          onAnalyzeSuccess(updated);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze feedback';
      setAnalyzeError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analysis = feedback.analysis;
  const confidence = analysis?.confidenceScore ?? analysis?.confidence ?? 0;
  const isLowConfidence = analysis ? confidence < 0.70 : false;
  const severityVal = analysis?.severity ?? (analysis?.urgencyScore ? Math.round(analysis.urgencyScore * 5) : 3);
  const severityMeta = SEVERITY_COLORS[severityVal] || SEVERITY_COLORS[3];
  const evidenceList = analysis?.evidencePhrases || analysis?.keyPhrases || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                #{feedback.rowNumber || '—'}
              </span>
              <Badge variant={feedback.isSample ? 'warning' : 'indigo'} size="sm">
                {feedback.isSample ? 'Demo Sample' : 'Genuine Import'}
              </Badge>
              <span className="text-xs text-slate-400 font-mono">
                ID: {feedback.id.slice(0, 8)}...
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200/50 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800">
            {/* Section 1: Verbatim Review Text */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Verbatim Customer Signal
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 text-xs text-slate-500 hover:text-indigo-600"
                  leftIcon={copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                >
                  {copied ? 'Copied' : 'Copy Text'}
                </Button>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80 relative">
                <Quote className="h-5 w-5 text-slate-300 absolute top-3 left-3 -scale-x-100" />
                <p className="text-sm text-slate-900 leading-relaxed pl-6 italic font-serif font-normal">
                  "{feedback.review}"
                </p>
              </div>

              {/* Supplied Category vs Inferred Topic distinction */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-slate-500">Supplied Category:</span>
                <Badge
                  variant={CATEGORY_BADGE_VARIANTS[feedback.category] || 'neutral'}
                  size="sm"
                  dot
                >
                  {feedback.category}
                </Badge>
                <span className="text-[11px] text-slate-400 italic">
                  (Supplied from source dataset, independent of AI classification)
                </span>
              </div>
            </div>

            {/* Section 2: AI Analysis Intelligence */}
            {analysis ? (
              <div className="space-y-5 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      AI Customer Intelligence
                    </h3>
                  </div>

                  {isLowConfidence ? (
                    <Badge variant="warning" size="sm" dot>
                      Low Confidence ({(confidence * 100).toFixed(0)}%)
                    </Badge>
                  ) : (
                    <Badge variant="success" size="sm" dot>
                      {(confidence * 100).toFixed(0)}% Confidence
                    </Badge>
                  )}
                </div>

                {/* KPI Metrics Strip */}
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Sentiment Metric */}
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Sentiment
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge
                        variant={SENTIMENT_BADGE_VARIANTS[analysis.sentiment] || 'neutral'}
                        size="sm"
                      >
                        {analysis.sentiment.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-slate-500">
                      Score: {analysis.sentimentScore > 0 ? `+${analysis.sentimentScore}` : analysis.sentimentScore}
                    </div>
                  </div>

                  {/* Severity Metric */}
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Severity
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <span className={`text-base font-bold font-mono ${severityMeta.text}`}>
                        {severityVal}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">/5</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                      {severityMeta.label}
                    </div>
                  </div>

                  {/* Urgency Classification */}
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Urgency
                    </div>
                    <div className="mt-1">
                      <span className="text-xs font-bold text-slate-800 capitalize">
                        {analysis.urgency}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      Weight: {analysis.urgencyScore ? `${(analysis.urgencyScore * 100).toFixed(0)}%` : '—'}
                    </div>
                  </div>
                </div>

                {/* Primary & Secondary Topics */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-500">Primary Inferred Topic:</span>
                  <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-indigo-950">
                      {analysis.primaryTopic || 'General Feedback'}
                    </span>
                    <Badge variant="indigo" size="sm">
                      Core Topic
                    </Badge>
                  </div>

                  {analysis.topics && analysis.topics.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                      <span className="text-xs text-slate-400">Secondary topics:</span>
                      {analysis.topics.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Explanation Paragraph */}
                {(analysis.explanation || analysis.summary) && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-500">Grounded Reasoning & Summary:</span>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                      {analysis.explanation || analysis.summary}
                    </div>
                  </div>
                )}

                {/* Evidence Phrases Copied Verbatim from Review */}
                {evidenceList.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <Quote className="h-3.5 w-3.5 text-indigo-500" />
                      Grounded Evidence Phrases:
                    </span>
                    <div className="space-y-1.5">
                      {evidenceList.map((phrase, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200/80 text-xs text-emerald-950 flex items-start gap-2"
                        >
                          <span className="text-emerald-500 font-bold">•</span>
                          <span className="italic font-serif">"{phrase}"</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata & Audit Trail */}
                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Model: {analysis.modelVersion}</span>
                    {analysis.promptVersion && <span>Prompt: {analysis.promptVersion}</span>}
                  </div>
                  <div>
                    Analyzed at: {new Date(analysis.analyzedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              /* Unanalyzed State in Drawer */
              <div className="p-6 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 text-center space-y-3">
                <AlertCircle className="h-8 w-8 text-amber-600 mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-amber-950">Awaiting AI Analysis</h4>
                  <p className="text-xs text-amber-800 max-w-sm mx-auto mt-1">
                    This customer feedback has been ingested in its original verbatim form, but has not yet been processed by the structured analysis pipeline.
                  </p>
                </div>

                {analyzeError && (
                  <div className="p-2 rounded bg-red-100 border border-red-200 text-red-800 text-xs text-left">
                    {analyzeError}
                  </div>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAnalyzeNow}
                  isLoading={isAnalyzing}
                  leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                >
                  Analyze Feedback Now
                </Button>
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Ingested via CSV: {new Date(feedback.importedAt).toLocaleDateString()}
            </span>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
