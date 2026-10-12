import type { RawFeedbackRecord } from '../../types/import.js';
import type { FeedbackAnalysisRecord } from '../analysis/types.js';
import type { AdaptionPromptPair, AdaptionColumnMapping } from './types.js';

export interface DatasetExclusions {
  tooShort: number;
  duplicateReview: number;
  unanalyzed: number;
}

export interface PreparedDatasetResult {
  pairs: AdaptionPromptPair[];
  columnMapping: AdaptionColumnMapping;
  datasetVersion: string;
  recordsCount: number;
  totalSourceRecords: number;
  uniqueReviewsCount: number;
  duplicatesExcluded: number;
  skippedCount: number;
  exclusions: DatasetExclusions;
  categoryBreakdown: Record<string, number>;
  sentimentBreakdown: Record<string, number>;
  sourceLabelNotice: string;
}

export interface ValidationOutputResult {
  valid: boolean;
  validatedPairs: AdaptionPromptPair[];
  rejectedCount: number;
  errors: string[];
}

export class DatasetPreparer {
  /**
   * Prepares an adaptation-ready customer feedback dataset formatted as instruction prompt-completion pairs.
   * - Deduplicates exact repeated review texts while preserving all original feedback IDs.
   * - Preserves the entire original customer feedback database without alteration.
   * - Documents that category is a source-provided context label, not ground truth.
   */
  public prepareFeedbackDataset(
    records: RawFeedbackRecord[],
    analysisLookup: (feedbackId: string) => FeedbackAnalysisRecord | null,
    options: {
      maxRows?: number;
      requireAnalyzed?: boolean;
    } = {}
  ): PreparedDatasetResult {
    const pairs: AdaptionPromptPair[] = [];
    const seenReviews = new Map<string, AdaptionPromptPair>();
    const categoryBreakdown: Record<string, number> = {};
    const sentimentBreakdown: Record<string, number> = {};
    const exclusions: DatasetExclusions = {
      tooShort: 0,
      duplicateReview: 0,
      unanalyzed: 0,
    };
    let skippedCount = 0;
    let duplicatesExcluded = 0;

    for (const record of records) {
      // 1. Input validation & normalization: ensure review text is substantive
      const cleanReview = (record.review || '').trim();
      if (cleanReview.length < 5) {
        skippedCount++;
        exclusions.tooShort++;
        continue;
      }

      // 2. Identify exact duplicate review texts across dataset
      const normalizedText = cleanReview.toLowerCase().replace(/\s+/g, ' ');
      if (seenReviews.has(normalizedText)) {
        const canonical = seenReviews.get(normalizedText)!;
        if (!canonical.originalIds) {
          canonical.originalIds = [canonical.originalId];
        }
        canonical.originalIds.push(record.id);
        canonical.duplicateCount = (canonical.duplicateCount || 1) + 1;
        duplicatesExcluded++;
        exclusions.duplicateReview++;
        skippedCount++;
        continue;
      }

      // Check maxRows limit for unique adaptation pairs
      if (options.maxRows && pairs.length >= options.maxRows) {
        break;
      }

      const analysis = analysisLookup(record.id);
      if (options.requireAnalyzed && !analysis) {
        skippedCount++;
        exclusions.unanalyzed++;
        continue;
      }

      // 3. Preserve source category as context label (never fabricate verified ground truth)
      const category = record.category || 'General Feedback';
      const sentiment = analysis?.sentiment || 'neutral';
      const urgencyScore = analysis?.urgencyScore ?? 0.5;
      const primaryTopic = analysis?.primaryTopic || category;
      const keyPhrases = analysis?.keyPhrases || [];

      // SFT Instruction Prompt
      const prompt = `Classify the following customer feedback into category, sentiment, primary topic, and urgency score:\n\nReview: "${cleanReview}"`;

      // Expected Output Completion
      const completionObj = {
        category,
        sentiment,
        primaryTopic,
        urgencyScore: Number(urgencyScore.toFixed(2)),
        keyPhrases: keyPhrases.slice(0, 4),
      };
      const completion = JSON.stringify(completionObj, null, 2);

      const pair: AdaptionPromptPair = {
        originalId: record.id,
        originalIds: [record.id],
        duplicateCount: 1,
        prompt,
        completion,
        category,
        isSourceCategory: true,
        sentiment,
        urgencyScore,
        primaryTopic,
        context: {
          source: record.source || 'Customer Review',
          rowNumber: record.rowNumber,
          datasetType: record.datasetType || 'genuine_import',
        },
      };

      pairs.push(pair);
      seenReviews.set(normalizedText, pair);

      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
      sentimentBreakdown[sentiment] = (sentimentBreakdown[sentiment] || 0) + 1;
    }

    const columnMapping: AdaptionColumnMapping = {
      prompt: 'prompt',
      completion: 'completion',
      context: ['source', 'rowNumber', 'datasetType'],
    };

    return {
      pairs,
      columnMapping,
      datasetVersion: `v1.0.0-${new Date().toISOString().slice(0, 10)}`,
      recordsCount: pairs.length,
      totalSourceRecords: records.length,
      uniqueReviewsCount: seenReviews.size,
      duplicatesExcluded,
      skippedCount,
      exclusions,
      categoryBreakdown,
      sentimentBreakdown,
      sourceLabelNotice:
        'Category labels represent source-provided metadata from feedback import, not independently verified ground truth.',
    };
  }

  /**
   * Validates downloaded or adapted prompt-completion pairs before accepting into exemplar library.
   */
  public validateAdaptedOutput(pairs: AdaptionPromptPair[]): ValidationOutputResult {
    const validatedPairs: AdaptionPromptPair[] = [];
    const errors: string[] = [];
    let rejectedCount = 0;

    for (const pair of pairs) {
      if (!pair.prompt || typeof pair.prompt !== 'string' || pair.prompt.trim().length < 5) {
        rejectedCount++;
        errors.push(`Pair for ID '${pair.originalId}' rejected: Prompt missing or too short.`);
        continue;
      }

      if (!pair.completion || typeof pair.completion !== 'string') {
        rejectedCount++;
        errors.push(`Pair for ID '${pair.originalId}' rejected: Missing completion.`);
        continue;
      }

      try {
        const parsed = JSON.parse(pair.completion);
        if (!parsed.category || !parsed.sentiment || !parsed.primaryTopic) {
          rejectedCount++;
          errors.push(`Pair for ID '${pair.originalId}' rejected: Completion missing required fields.`);
          continue;
        }
        validatedPairs.push(pair);
      } catch {
        rejectedCount++;
        errors.push(`Pair for ID '${pair.originalId}' rejected: Completion is not valid JSON.`);
      }
    }

    return {
      valid: rejectedCount === 0 && validatedPairs.length > 0,
      validatedPairs,
      rejectedCount,
      errors,
    };
  }

  /**
   * Serializes prompt-completion pairs to JSONL format.
   */
  public toJSONL(pairs: AdaptionPromptPair[]): string {
    return pairs
      .map((p) =>
        JSON.stringify({
          prompt: p.prompt,
          completion: p.completion,
          category: p.category,
          is_source_category: p.isSourceCategory ?? true,
          sentiment: p.sentiment,
          urgency_score: p.urgencyScore,
          primary_topic: p.primaryTopic,
          source_id: p.originalId,
          source_ids: p.originalIds || [p.originalId],
          duplicate_count: p.duplicateCount || 1,
          ...(p.context || {}),
        })
      )
      .join('\n');
  }

  /**
   * Serializes prompt-completion pairs to RFC 4180 CSV format.
   */
  public toCSV(pairs: AdaptionPromptPair[]): string {
    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      'prompt',
      'completion',
      'category',
      'sentiment',
      'urgencyScore',
      'primaryTopic',
      'sourceId',
      'duplicateCount',
    ];
    const rows = pairs.map((p) =>
      [
        escapeCsv(p.prompt),
        escapeCsv(p.completion),
        escapeCsv(p.category),
        escapeCsv(p.sentiment),
        escapeCsv(p.urgencyScore),
        escapeCsv(p.primaryTopic),
        escapeCsv(p.originalId),
        escapeCsv(p.duplicateCount || 1),
      ].join(',')
    );

    return [headers.join(','), ...rows].join('\r\n');
  }
}

