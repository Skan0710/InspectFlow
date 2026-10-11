import type { SchemaValidator, SchemaValidationResult } from './types.js';

export interface SentimentAnalysisOutput {
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentiment_score: number;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  urgency_score: number;
  primary_category: string;
  topics: string[];
  summary: string;
}

const VALID_SENTIMENTS = new Set(['positive', 'neutral', 'negative', 'mixed']);
const VALID_URGENCIES = new Set(['low', 'normal', 'high', 'critical']);

/**
 * Strict validator for customer feedback sentiment and urgency analysis output
 */
export const validateSentimentOutput: SchemaValidator<SentimentAnalysisOutput> = (data: unknown) => {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { success: false, errors: ['Expected output to be a JSON object'] };
  }

  const obj = data as Record<string, unknown>;

  // Validate sentiment
  if (typeof obj.sentiment !== 'string' || !VALID_SENTIMENTS.has(obj.sentiment)) {
    errors.push(`Invalid sentiment: expected one of ${Array.from(VALID_SENTIMENTS).join(', ')}`);
  }

  // Validate sentiment_score (-1.0 to 1.0)
  if (typeof obj.sentiment_score !== 'number' || isNaN(obj.sentiment_score) || obj.sentiment_score < -1 || obj.sentiment_score > 1) {
    errors.push('Invalid sentiment_score: must be a number between -1.0 and 1.0');
  }

  // Validate urgency
  if (typeof obj.urgency !== 'string' || !VALID_URGENCIES.has(obj.urgency)) {
    errors.push(`Invalid urgency: expected one of ${Array.from(VALID_URGENCIES).join(', ')}`);
  }

  // Validate urgency_score (0.0 to 1.0)
  if (typeof obj.urgency_score !== 'number' || isNaN(obj.urgency_score) || obj.urgency_score < 0 || obj.urgency_score > 1) {
    errors.push('Invalid urgency_score: must be a number between 0.0 and 1.0');
  }

  // Validate primary_category
  if (typeof obj.primary_category !== 'string' || obj.primary_category.trim().length === 0) {
    errors.push('Invalid primary_category: must be a non-empty string');
  }

  // Validate topics
  if (!Array.isArray(obj.topics) || obj.topics.some(t => typeof t !== 'string')) {
    errors.push('Invalid topics: must be an array of strings');
  }

  // Validate summary
  if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) {
    errors.push('Invalid summary: must be a non-empty string');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      sentiment: obj.sentiment as SentimentAnalysisOutput['sentiment'],
      sentiment_score: Number(obj.sentiment_score),
      urgency: obj.urgency as SentimentAnalysisOutput['urgency'],
      urgency_score: Number(obj.urgency_score),
      primary_category: String(obj.primary_category).trim(),
      topics: (obj.topics as string[]).map(t => String(t).trim()),
      summary: String(obj.summary).trim(),
    },
  };
};

/**
 * Creates a generic object validator with required field checks
 */
export function createObjectValidator<T extends object>(
  spec: {
    requiredFields: (keyof T)[];
    typeChecks?: Partial<Record<keyof T, (val: unknown) => boolean | string>>;
  }
): SchemaValidator<T> {
  return (data: unknown): SchemaValidationResult<T> => {
    if (!data || typeof data !== 'object') {
      return { success: false, errors: ['Expected an object'] };
    }

    const errors: string[] = [];
    const obj = data as Record<string, unknown>;

    for (const field of spec.requiredFields) {
      const strField = String(field);
      if (!(strField in obj) || obj[strField] === undefined || obj[strField] === null) {
        errors.push(`Missing required field: '${strField}'`);
        continue;
      }

      const checker = spec.typeChecks?.[field];
      if (checker) {
        const checkResult = checker(obj[strField]);
        if (checkResult === false) {
          errors.push(`Field '${strField}' failed validation check`);
        } else if (typeof checkResult === 'string') {
          errors.push(checkResult);
        }
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: obj as T };
  };
}
