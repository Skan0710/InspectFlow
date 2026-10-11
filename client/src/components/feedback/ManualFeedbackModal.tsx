import React, { useState } from 'react';
import {
  MessageSquarePlus,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Clock,
  ArrowRight,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { submitManualFeedback, type ManualFeedbackResponse } from '../../api/client';

export interface ManualFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (newRecord: any) => void;
}

const CATEGORY_OPTIONS = [
  { value: 'General Feedback', label: 'General Feedback (Default)' },
  { value: 'Product Feedback', label: 'Product Feedback' },
  { value: 'Customer Service', label: 'Customer Service' },
  { value: 'Operational Issues', label: 'Operational Issues' },
  { value: 'Fraud and Scam', label: 'Fraud and Scam' },
];

const SENTIMENT_BADGE_VARIANTS: Record<string, 'success' | 'neutral' | 'danger' | 'warning'> = {
  positive: 'success',
  neutral: 'neutral',
  negative: 'danger',
  mixed: 'warning',
};

export const ManualFeedbackModal: React.FC<ManualFeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmitSuccess,
}) => {
  const [review, setReview] = useState<string>('');
  const [category, setCategory] = useState<string>('General Feedback');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<ManualFeedbackResponse | null>(null);

  if (!isOpen) return null;

  const trimmedLength = review.trim().length;
  const isTooShort = trimmedLength > 0 && trimmedLength < 5;
  const isTooLong = trimmedLength > 2000;
  const isSubmitDisabled = isSubmitting || trimmedLength < 5 || isTooLong;

  const handleResetForm = () => {
    setReview('');
    setCategory('General Feedback');
    setValidationError(null);
    setDuplicateError(null);
    setGeneralError(null);
    setSubmissionResult(null);
  };

  const handleClose = () => {
    handleResetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setDuplicateError(null);
    setGeneralError(null);

    if (trimmedLength < 5) {
      setValidationError('Review text must be at least 5 characters long.');
      return;
    }

    if (trimmedLength > 2000) {
      setValidationError('Review text must not exceed 2000 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await submitManualFeedback({
        review: review.trim(),
        category,
      });

      setSubmissionResult(response);
    } catch (err: any) {
      if (err.status === 409 || err.errorType === 'DuplicateFeedbackError') {
        setDuplicateError(
          err.message ||
            'Duplicate submission prevented: An identical customer review already exists in the system.'
        );
      } else if (err.status === 400 || err.errorType === 'ValidationError') {
        setValidationError(err.message || 'Validation error. Please verify input fields.');
      } else {
        setGeneralError(
          err.message || 'Failed to submit feedback. Please check server connectivity.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewInExplorer = () => {
    if (submissionResult) {
      onSubmitSuccess(submissionResult.data);
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 sm:p-7 shadow-2xl border border-slate-200 transition-all">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 ring-1 ring-indigo-100">
              <MessageSquarePlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Submit Customer Feedback
              </h3>
              <p className="text-xs text-slate-500">
                Record customer verbatim reviews for immediate analysis & exploration
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success View */}
        {submissionResult ? (
          <div className="py-5 space-y-5 animate-in fade-in">
            <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-4 text-emerald-950">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-emerald-900">
                    Feedback Recorded Successfully
                  </h4>
                  <p className="text-xs text-emerald-700">
                    {submissionResult.message}
                  </p>
                </div>
              </div>
            </div>

            {/* Record Status Details */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-medium text-slate-500">Feedback Record ID:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {submissionResult.data.id}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Submission Status:</span>
                <Badge variant="success" size="sm">
                  ✓ {submissionResult.submissionStatus}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Category:</span>
                <Badge variant="neutral" size="sm">
                  {submissionResult.data.category}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">AI Analysis Status:</span>
                {submissionResult.analysisStatus === 'analyzed' ? (
                  <Badge variant="success" size="sm">
                    <Sparkles className="h-3 w-3 inline mr-1" />
                    Analyzed
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Pending / Queued
                  </Badge>
                )}
              </div>

              {/* Show structured analysis if completed */}
              {submissionResult.data.analysis && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-500">Inferred Sentiment:</span>
                    <Badge
                      variant={
                        SENTIMENT_BADGE_VARIANTS[
                          submissionResult.data.analysis.sentiment.toLowerCase()
                        ] || 'neutral'
                      }
                      size="sm"
                    >
                      {submissionResult.data.analysis.sentiment.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-500">Primary Topic:</span>
                    <span className="font-semibold text-slate-800">
                      {submissionResult.data.analysis.primaryTopic}
                    </span>
                  </div>
                  {submissionResult.data.analysis.summary && (
                    <div className="pt-1 text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 italic">
                      "{submissionResult.data.analysis.summary}"
                    </div>
                  )}
                </div>
              )}

              {/* Notice if analysis was queued or delayed */}
              {submissionResult.analysisStatus !== 'analyzed' && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 mt-2">
                  Feedback record is safely persisted to database and queued for pipeline analysis. You can also analyze it on-demand from the Feedback Explorer drawer.
                </p>
              )}
            </div>

            {/* Success Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetForm}
                leftIcon={<RotateCcw className="h-4 w-4" />}
                className="w-full sm:w-auto"
              >
                Submit Another
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleViewInExplorer}
                rightIcon={<ArrowRight className="h-4 w-4" />}
                className="w-full sm:w-auto"
              >
                View in Feedback Explorer
              </Button>
            </div>
          </div>
        ) : (
          /* Submission Form */
          <form onSubmit={handleSubmit} className="py-5 space-y-4">
            {/* Duplicate Prevention Alert */}
            {duplicateError && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 flex items-start gap-2.5 animate-in fade-in">
                <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-bold">Duplicate Submission Prevented</span>
                  <p>{duplicateError}</p>
                </div>
              </div>
            )}

            {/* General Error Alert */}
            {generalError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900 flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-bold">Submission Error</span>
                  <p>{generalError}</p>
                </div>
              </div>
            )}

            {/* Review Text Field */}
            <div className="space-y-1">
              <Textarea
                label="Review Text *"
                id="manual-review-input"
                placeholder="Paste verbatim customer review, support transcript, or user feedback (e.g., 'Export to CSV is failing on large datasets')..."
                value={review}
                onChange={(e) => {
                  setReview(e.target.value);
                  if (validationError) setValidationError(null);
                  if (duplicateError) setDuplicateError(null);
                }}
                disabled={isSubmitting}
                rows={4}
                error={
                  validationError ||
                  (isTooShort ? 'Review must be at least 5 characters long' : undefined) ||
                  (isTooLong ? 'Review exceeds maximum length of 2000 characters' : undefined)
                }
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                <span>Minimum 5 characters</span>
                <span
                  className={
                    trimmedLength > 2000
                      ? 'text-rose-600 font-semibold'
                      : trimmedLength >= 5
                      ? 'text-emerald-600'
                      : 'text-slate-400'
                  }
                >
                  {trimmedLength} / 2000 characters
                </span>
              </div>
            </div>

            {/* Category Field */}
            <div>
              <Select
                label="Category (Optional)"
                id="manual-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isSubmitting}
                helperText="Select domain context or leave as General Feedback"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Information Notice */}
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">InsightFlow Processing: </span>
              Original review text is strictly preserved verbatim. Upon submission, it is automatically persisted and submitted to the AI analysis pipeline.
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                disabled={isSubmitDisabled}
                leftIcon={<MessageSquarePlus className="h-4 w-4" />}
              >
                {isSubmitting ? 'Submitting & Analyzing...' : 'Submit Feedback'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
