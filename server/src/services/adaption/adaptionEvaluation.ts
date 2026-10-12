import crypto from 'node:crypto';
import type { RawFeedbackRecord } from '../../types/import.js';
import { FeedbackStore } from '../feedbackStore.js';
import { FeedbackAnalyzer } from '../analysis/feedbackAnalyzer.js';
import { ExemplarLibrary } from './exemplarLibrary.js';
import { getAIProvider, TestAIProvider } from '../ai/index.js';
import type { AdaptionEvaluationComparison, EvaluationMetrics } from './types.js';

export interface RunEvaluationOptions {
  sampleSize?: number;
  datasetType?: 'all' | 'genuine_import' | 'demo_sample';
}

export class AdaptionEvaluationService {
  private store: FeedbackStore;
  private analyzer: FeedbackAnalyzer;
  private exemplarLibrary: ExemplarLibrary;

  constructor(
    store?: FeedbackStore,
    analyzer?: FeedbackAnalyzer,
    exemplarLibrary?: ExemplarLibrary
  ) {
    this.store = store || FeedbackStore.getInstance();
    this.exemplarLibrary = exemplarLibrary || ExemplarLibrary.getInstance();
    if (analyzer) {
      this.analyzer = analyzer;
    } else {
      const provider = getAIProvider();
      const activeProvider = provider.isConfigured() ? provider : new TestAIProvider();
      this.analyzer = new FeedbackAnalyzer(activeProvider, this.store, this.exemplarLibrary);
    }
  }

  /**
   * Performs an honest, empirical comparison between:
   * 1. Baseline analysis (zero-shot prompt)
   * 2. Adaption-enhanced analysis (few-shot with validated exemplars)
   *
   * Invariant: Strictly filters test inputs to prevent leakage from the exemplar library.
   */
  public async evaluateComparison(options: RunEvaluationOptions = {}): Promise<AdaptionEvaluationComparison> {
    const sampleSize = Math.max(1, Math.min(options.sampleSize || 6, 20));
    const allRecords = this.store.getRecords({
      page: 1,
      pageSize: 10000,
      datasetType: options.datasetType || 'all',
    }).data;

    if (allRecords.length === 0) {
      throw new Error('No feedback records available in dataset for evaluation.');
    }

    const exemplars = this.exemplarLibrary.getApprovedExemplars();

    // Prevent data leakage: collect all exemplar source IDs and review substrings
    const exemplarIds = new Set<string>();
    const exemplarTexts = new Set<string>();

    for (const ex of exemplars) {
      exemplarIds.add(ex.originalId);
      if (ex.originalIds) {
        for (const id of ex.originalIds) {
          exemplarIds.add(id);
        }
      }
      const rawText = ex.prompt
        .replace(/^Classify the following customer feedback into category, sentiment, primary topic, and urgency score:\s*\n*\s*Review:\s*"?/is, '')
        .replace(/"?$/is, '')
        .trim()
        .toLowerCase();
      if (rawText) {
        exemplarTexts.add(rawText);
      }
    }

    // Filter test candidates: strictly non-overlapping with exemplar pool
    const testCandidates = allRecords.filter((rec) => {
      const clean = (rec.review || '').trim();
      if (clean.length < 10) return false;
      if (exemplarIds.has(rec.id)) return false;
      const normalized = clean.toLowerCase();
      if (exemplarTexts.has(normalized)) return false;
      return true;
    });

    if (testCandidates.length === 0) {
      throw new Error('No candidate reviews available outside the exemplar pool (leakage prevention prevented evaluation).');
    }

    const testSet = testCandidates.slice(0, sampleSize);

    // Run Baseline (zero-shot, no exemplars)
    const baselineResults: Array<{
      valid: boolean;
      agreesWithSourceCategory: boolean;
      groundingRate: number;
      confidence: number;
      latencyMs: number;
    }> = [];

    for (const rec of testSet) {
      const start = Date.now();
      try {
        const result = await this.analyzer.analyzeReview(
          {
            feedbackId: rec.id,
            review: rec.review,
            category: rec.category,
          },
          { useExemplars: false }
        );
        const latencyMs = Date.now() - start;

        const valid =
          result.severity >= 1 &&
          result.severity <= 5 &&
          result.confidence >= 0 &&
          result.confidence <= 1 &&
          Boolean(result.explanation && result.explanation.length >= 5) &&
          Boolean(result.primaryTopic && result.primaryTopic.length >= 2);

        const recCat = (rec.category || '').toLowerCase();
        const primary = (result.primaryTopic || '').toLowerCase();
        const agreesWithSourceCategory =
          recCat.length > 0 &&
          (primary.includes(recCat) ||
            recCat.includes(primary) ||
            (recCat.includes('product') && primary.includes('product')) ||
            (recCat.includes('service') && primary.includes('service')) ||
            (recCat.includes('billing') && primary.includes('billing')) ||
            (recCat.includes('security') && primary.includes('security')));

        // Check evidence grounding (exact verbatim match in review)
        let exactMatches = 0;
        const phrases = result.evidencePhrases || [];
        for (const phrase of phrases) {
          if (rec.review.includes(phrase)) {
            exactMatches++;
          }
        }
        const groundingRate = phrases.length > 0 ? exactMatches / phrases.length : 1.0;

        baselineResults.push({
          valid,
          agreesWithSourceCategory,
          groundingRate,
          confidence: result.confidence,
          latencyMs,
        });
      } catch {
        baselineResults.push({
          valid: false,
          agreesWithSourceCategory: false,
          groundingRate: 0,
          confidence: 0,
          latencyMs: Date.now() - start,
        });
      }
    }

    // Run Adapted (few-shot with exemplars)
    const adaptedResults: Array<{
      valid: boolean;
      agreesWithSourceCategory: boolean;
      groundingRate: number;
      confidence: number;
      latencyMs: number;
    }> = [];

    for (const rec of testSet) {
      const start = Date.now();
      try {
        const result = await this.analyzer.analyzeReview(
          {
            feedbackId: rec.id,
            review: rec.review,
            category: rec.category,
          },
          { useExemplars: true }
        );
        const latencyMs = Date.now() - start;

        const valid =
          result.severity >= 1 &&
          result.severity <= 5 &&
          result.confidence >= 0 &&
          result.confidence <= 1 &&
          Boolean(result.explanation && result.explanation.length >= 5) &&
          Boolean(result.primaryTopic && result.primaryTopic.length >= 2);

        const recCat = (rec.category || '').toLowerCase();
        const primary = (result.primaryTopic || '').toLowerCase();
        const agreesWithSourceCategory =
          recCat.length > 0 &&
          (primary.includes(recCat) ||
            recCat.includes(primary) ||
            (recCat.includes('product') && primary.includes('product')) ||
            (recCat.includes('service') && primary.includes('service')) ||
            (recCat.includes('billing') && primary.includes('billing')) ||
            (recCat.includes('security') && primary.includes('security')));

        let exactMatches = 0;
        const phrases = result.evidencePhrases || [];
        for (const phrase of phrases) {
          if (rec.review.includes(phrase)) {
            exactMatches++;
          }
        }
        const groundingRate = phrases.length > 0 ? exactMatches / phrases.length : 1.0;

        adaptedResults.push({
          valid,
          agreesWithSourceCategory,
          groundingRate,
          confidence: result.confidence,
          latencyMs,
        });
      } catch {
        adaptedResults.push({
          valid: false,
          agreesWithSourceCategory: false,
          groundingRate: 0,
          confidence: 0,
          latencyMs: Date.now() - start,
        });
      }
    }

    const calcMetrics = (arr: typeof baselineResults): EvaluationMetrics => {
      if (arr.length === 0) {
        return {
          validStructuredOutputRate: 0,
          categoryAgreementRate: 0,
          evidenceGroundingRate: 0,
          avgConfidence: 0,
          avgLatencyMs: 0,
        };
      }
      const validCount = arr.filter((r) => r.valid).length;
      const agreeCount = arr.filter((r) => r.agreesWithSourceCategory).length;
      const totalGrounding = arr.reduce((acc, r) => acc + r.groundingRate, 0);
      const totalConf = arr.reduce((acc, r) => acc + r.confidence, 0);
      const totalLatency = arr.reduce((acc, r) => acc + r.latencyMs, 0);

      return {
        validStructuredOutputRate: Number((validCount / arr.length).toFixed(4)),
        categoryAgreementRate: Number((agreeCount / arr.length).toFixed(4)),
        evidenceGroundingRate: Number((totalGrounding / arr.length).toFixed(4)),
        avgConfidence: Number((totalConf / arr.length).toFixed(4)),
        avgLatencyMs: Math.round(totalLatency / arr.length),
      };
    };

    const baseline = calcMetrics(baselineResults);
    const adapted = calcMetrics(adaptedResults);

    const comparison: AdaptionEvaluationComparison = {
      id: `eval_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      sampleSize: testSet.length,
      exemplarLibraryVersion: this.exemplarLibrary.getVersion(),
      exemplarsCount: exemplars.length,
      leakageFree: true,
      baseline,
      adapted,
      delta: {
        structuredOutputDiff: Number((adapted.validStructuredOutputRate - baseline.validStructuredOutputRate).toFixed(4)),
        categoryAgreementDiff: Number((adapted.categoryAgreementRate - baseline.categoryAgreementRate).toFixed(4)),
        groundingDiff: Number((adapted.evidenceGroundingRate - baseline.evidenceGroundingRate).toFixed(4)),
        confidenceDiff: Number((adapted.avgConfidence - baseline.avgConfidence).toFixed(4)),
        latencyDiffMs: adapted.avgLatencyMs - baseline.avgLatencyMs,
      },
      limitations: `Measured empirically across ${testSet.length} isolated customer feedback records. Demonstrates in-context exemplar calibration; does not claim LLM weight fine-tuning.`,
      sourceCategoryDisclaimer:
        'Category agreement measures consistency with source CSV metadata and is not an independently verified ground truth benchmark.',
      evaluatedAt: new Date().toISOString(),
    };

    await this.store.saveLatestEvaluation(comparison);
    return comparison;
  }

  public getLatestEvaluation(): AdaptionEvaluationComparison | null {
    return this.store.getLatestEvaluation();
  }
}
