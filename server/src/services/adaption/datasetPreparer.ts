import type { RawFeedbackRecord } from '../../types/import.js';
import type { FeedbackAnalysisRecord } from '../analysis/types.js';
import type { AdaptionPromptPair, AdaptionColumnMapping } from './types.js';

export interface PreparedDatasetResult {
  pairs: AdaptionPromptPair[];
  columnMapping: AdaptionColumnMapping;
  datasetVersion: string;
  recordsCount: number;
  totalSourceRecords: number;
  skippedCount: number;
  categoryBreakdown: Record<string, number>;
  sentimentBreakdown: Record<string, number>;
}

export class DatasetPreparer {
  /**
   * Prepares a representative customer feedback dataset formatted as instruction prompt-completion pairs.
   * Strictly preserves the original source feedback records without any mutation.
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
    const categoryBreakdown: Record<string, number> = {};
    const sentimentBreakdown: Record<string, number> = {};
    let skippedCount = 0;

    for (const record of records) {
      if (options.maxRows && pairs.length >= options.maxRows) {
        break;
      }

      // Input validation: ensure review text is substantive
      const cleanReview = (record.review || '').trim();
      if (cleanReview.length < 5) {
        skippedCount++;
        continue;
      }

      const analysis = analysisLookup(record.id);
      if (options.requireAnalyzed && !analysis) {
        skippedCount++;
        continue;
      }

      // Determine ground-truth or inferred values
      const category = record.category || 'General Feedback';
      const sentiment = analysis?.sentiment || 'neutral';
      const urgencyScore = analysis?.urgencyScore ?? 0.5;
      const primaryTopic = analysis?.primaryTopic || 'General Inquiry';
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

      pairs.push({
        originalId: record.id,
        prompt,
        completion,
        category,
        sentiment,
        urgencyScore,
        primaryTopic,
        context: {
          source: record.source || 'Customer Review',
          rowNumber: record.rowNumber,
          datasetType: record.datasetType || 'genuine_import',
        },
      });

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
      skippedCount,
      categoryBreakdown,
      sentimentBreakdown,
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
          sentiment: p.sentiment,
          urgency_score: p.urgencyScore,
          primary_topic: p.primaryTopic,
          source_id: p.originalId,
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

    const headers = ['prompt', 'completion', 'category', 'sentiment', 'urgencyScore', 'primaryTopic', 'sourceId'];
    const rows = pairs.map((p) =>
      [
        escapeCsv(p.prompt),
        escapeCsv(p.completion),
        escapeCsv(p.category),
        escapeCsv(p.sentiment),
        escapeCsv(p.urgencyScore),
        escapeCsv(p.primaryTopic),
        escapeCsv(p.originalId),
      ].join(',')
    );

    return [headers.join(','), ...rows].join('\r\n');
  }
}
