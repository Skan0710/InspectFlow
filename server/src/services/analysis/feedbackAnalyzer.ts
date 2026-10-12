import crypto from 'node:crypto';
import type { AIProvider } from '../ai/types.js';
import { getAIProvider } from '../ai/index.js';
import type {
  FeedbackAnalysisInput,
  FeedbackAnalysisResult,
  FeedbackAnalysisRecord,
  RawAnalysisModelOutput,
} from './types.js';
import { SYSTEM_PROMPT, PROMPT_VERSION, buildFeedbackAnalysisPrompt } from './prompt.js';
import {
  validateFeedbackAnalysisOutput,
  calculateSentimentScore,
  calculateUrgency,
} from './validator.js';
import { FeedbackStore } from '../feedbackStore.js';
import { ExemplarLibrary } from '../adaption/exemplarLibrary.js';

export class FeedbackAnalyzer {
  private provider: AIProvider;
  private store: FeedbackStore;
  private exemplarLibrary: ExemplarLibrary;

  constructor(
    provider?: AIProvider,
    store?: FeedbackStore,
    exemplarLibrary?: ExemplarLibrary
  ) {
    this.provider = provider || getAIProvider();
    this.store = store || FeedbackStore.getInstance();
    this.exemplarLibrary = exemplarLibrary || ExemplarLibrary.getInstance();
  }

  /**
   * Analyzes an individual feedback review without modifying the original feedback.
   * If approved Adaption exemplars are available and enabled, injects them as few-shot contextual patterns.
   * Seamlessly falls back to the baseline zero-shot prompt when no approved exemplars exist.
   */
  public async analyzeReview(
    input: FeedbackAnalysisInput,
    options?: { useExemplars?: boolean }
  ): Promise<FeedbackAnalysisResult> {
    const shouldUseExemplars =
      options?.useExemplars !== false &&
      this.exemplarLibrary.getMetadata().isEnabled;

    const exemplars = shouldUseExemplars
      ? this.exemplarLibrary.getApprovedExemplars(input.category)
      : [];

    const isAdaptionEnhanced = exemplars.length > 0;
    const exemplarLibraryVersion = isAdaptionEnhanced
      ? this.exemplarLibrary.getVersion()
      : undefined;

    const promptVersion = isAdaptionEnhanced
      ? `${PROMPT_VERSION}+adaption-${exemplarLibraryVersion}`
      : PROMPT_VERSION;

    const prompt = buildFeedbackAnalysisPrompt(input.review, input.category, exemplars);

    const response = await this.provider.generateStructured<RawAnalysisModelOutput>({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      validator: (data) =>
        validateFeedbackAnalysisOutput(data, {
          originalReview: input.review,
          strictEvidenceGrounding: false,
        }),
      temperature: 0.1,
    });

    const output = response.data;
    const sentimentScore =
      output.sentiment_score ??
      calculateSentimentScore(output.sentiment, output.confidence);

    const { urgency, urgencyScore } = calculateUrgency(output.severity);
    const analyzedAt = new Date().toISOString();

    return {
      feedbackId: input.feedbackId,
      sentiment: output.sentiment,
      sentimentScore,
      urgency,
      urgencyScore,
      primaryTopic: output.primary_topic,
      secondaryTopics: output.secondary_topics || [],
      severity: output.severity,
      confidence: output.confidence,
      explanation: output.explanation,
      evidencePhrases: output.evidence_phrases || [],
      modelVersion: this.provider.model,
      promptVersion,
      exemplarLibraryVersion,
      isAdaptionEnhanced,
      analyzedAt,
    };
  }

  /**
   * Analyzes feedback review and persists structured result to feedback_analysis store/table.
   * NEVER alters or modifies the original feedback record.
   */
  public async analyzeAndStore(
    input: FeedbackAnalysisInput,
    options?: { useExemplars?: boolean }
  ): Promise<FeedbackAnalysisRecord> {
    const result = await this.analyzeReview(input, options);

    const record: FeedbackAnalysisRecord = {
      id: crypto.randomUUID(),
      feedbackId: result.feedbackId,
      analysisRunId: input.analysisRunId,
      sentiment: result.sentiment,
      sentimentScore: result.sentimentScore,
      urgency: result.urgency,
      urgencyScore: result.urgencyScore,
      primaryTopic: result.primaryTopic,
      topics: result.secondaryTopics,
      keyPhrases: result.evidencePhrases,
      summary: result.explanation,
      severity: result.severity,
      confidenceScore: result.confidence,
      modelVersion: `${result.modelVersion}:${result.promptVersion}`,
      promptVersion: result.promptVersion,
      exemplarLibraryVersion: result.exemplarLibraryVersion,
      isAdaptionEnhanced: result.isAdaptionEnhanced,
      analyzedAt: result.analyzedAt,
      createdAt: result.analyzedAt,
      updatedAt: result.analyzedAt,
    };

    // Store in feedback_analysis without modifying raw feedback
    await this.store.saveAnalysis(record);

    return record;
  }
}

