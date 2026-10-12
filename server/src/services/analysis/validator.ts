import type {
  FeedbackSentiment,
  RawAnalysisModelOutput,
  UrgencyLevel,
} from './types.js';
import type { SchemaValidationResult } from '../ai/types.js';

const VALID_SENTIMENTS = new Set<FeedbackSentiment>([
  'positive',
  'neutral',
  'negative',
  'mixed',
]);

export interface ValidationOptions {
  originalReview?: string;
  strictEvidenceGrounding?: boolean;
}

/**
 * Validates raw model output against the strict structured feedback schema.
 */
export function validateFeedbackAnalysisOutput(
  data: unknown,
  options: ValidationOptions = {}
): SchemaValidationResult<RawAnalysisModelOutput> {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { success: false, errors: ['Output must be a valid JSON object'] };
  }

  const obj = data as Record<string, unknown>;

  // 1. Sentiment validation
  if (typeof obj.sentiment !== 'string' || !VALID_SENTIMENTS.has(obj.sentiment as FeedbackSentiment)) {
    errors.push(
      `Invalid sentiment '${obj.sentiment}'. Must be one of: positive, neutral, negative, mixed`
    );
  }

  // 2. Primary topic validation
  if (typeof obj.primary_topic !== 'string' || obj.primary_topic.trim().length === 0) {
    errors.push('Missing or empty primary_topic: must be a concise non-empty string');
  } else if (obj.primary_topic.length > 128) {
    errors.push('primary_topic exceeds maximum length of 128 characters');
  }

  // 3. Secondary topics validation
  let secondaryTopics: string[] = [];
  if (obj.secondary_topics !== undefined && obj.secondary_topics !== null) {
    if (!Array.isArray(obj.secondary_topics)) {
      errors.push('secondary_topics must be an array of strings');
    } else {
      secondaryTopics = obj.secondary_topics
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .map((t) => String(t).trim());
    }
  }

  // 4. Severity validation (1 to 5 integer)
  const severity = Number(obj.severity);
  if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
    errors.push('Invalid severity: must be an integer between 1 and 5');
  }

  // 5. Confidence validation (0.0 to 1.0 number)
  const confidence = Number(obj.confidence);
  if (typeof obj.confidence !== 'number' || isNaN(confidence) || confidence < 0 || confidence > 1) {
    errors.push('Invalid confidence: must be a number between 0.0 and 1.0');
  }

  // 6. Explanation validation
  if (typeof obj.explanation !== 'string' || obj.explanation.trim().length < 3) {
    errors.push('Missing or too short explanation: must be grounded in review text');
  }

  // 7. Evidence phrases validation
  let evidencePhrases: string[] = [];
  if (!Array.isArray(obj.evidence_phrases)) {
    errors.push('evidence_phrases must be an array of strings');
  } else {
    evidencePhrases = obj.evidence_phrases
      .filter((p) => typeof p === 'string' && p.trim().length > 0)
      .map((p) => String(p).trim());

    // If original review is provided, verify evidence phrases actually exist in the review
    if (options.originalReview && options.strictEvidenceGrounding) {
      const lowerReview = options.originalReview.toLowerCase();
      for (const phrase of evidencePhrases) {
        if (!lowerReview.includes(phrase.toLowerCase())) {
          errors.push(
            `Evidence phrase "${phrase}" was not found in the original review text`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      sentiment: obj.sentiment as FeedbackSentiment,
      sentiment_score:
        typeof obj.sentiment_score === 'number' &&
        Number.isFinite(obj.sentiment_score) &&
        obj.sentiment_score >= -1 &&
        obj.sentiment_score <= 1
          ? obj.sentiment_score
          : undefined,
      primary_topic: String(obj.primary_topic).trim(),
      secondary_topics: secondaryTopics,
      severity,
      confidence,
      explanation: String(obj.explanation).trim(),
      evidence_phrases: evidencePhrases,
    },
  };
}

/**
 * Calculates standardized sentiment score between -1.000 and 1.000
 */
export function calculateSentimentScore(
  sentiment: FeedbackSentiment,
  confidence: number
): number {
  const conf = Math.max(0, Math.min(1, confidence));
  switch (sentiment) {
    case 'positive':
      return Number((0.5 + conf * 0.5).toFixed(3));
    case 'negative':
      return Number((-0.5 - conf * 0.5).toFixed(3));
    case 'mixed':
    case 'neutral':
    default:
      return 0.0;
  }
}

/**
 * Maps severity (1-5) to database urgency level and score
 */
export function calculateUrgency(severity: number): {
  urgency: UrgencyLevel;
  urgencyScore: number;
} {
  switch (severity) {
    case 1:
      return { urgency: 'low', urgencyScore: 0.2 };
    case 2:
      return { urgency: 'normal', urgencyScore: 0.4 };
    case 3:
      return { urgency: 'normal', urgencyScore: 0.6 };
    case 4:
      return { urgency: 'high', urgencyScore: 0.8 };
    case 5:
    default:
      return { urgency: 'critical', urgencyScore: 1.0 };
  }
}
