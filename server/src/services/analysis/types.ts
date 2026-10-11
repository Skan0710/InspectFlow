export type FeedbackSentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

export type UrgencyLevel = 'low' | 'normal' | 'high' | 'critical';

export interface FeedbackAnalysisInput {
  feedbackId: string;
  review: string;
  category?: string;
  source?: string;
}

/**
 * Raw structured model output expected from the LLM
 */
export interface RawAnalysisModelOutput {
  sentiment: FeedbackSentiment;
  sentiment_score?: number;
  primary_topic: string;
  secondary_topics?: string[];
  severity: number;
  confidence: number;
  explanation: string;
  evidence_phrases: string[];
}

/**
 * Validated, grounded analysis result returned by the service
 */
export interface FeedbackAnalysisResult {
  feedbackId: string;
  sentiment: FeedbackSentiment;
  sentimentScore: number;
  urgency: UrgencyLevel;
  urgencyScore: number;
  primaryTopic: string;
  secondaryTopics: string[];
  severity: number; // 1 to 5
  confidence: number; // 0.0 to 1.0
  explanation: string;
  evidencePhrases: string[];
  modelVersion: string;
  promptVersion: string;
  analyzedAt: string;
}

/**
 * Stored database record matching feedback_analysis table
 */
export interface FeedbackAnalysisRecord {
  id: string;
  feedbackId: string;
  sentiment: FeedbackSentiment;
  sentimentScore: number;
  urgency: UrgencyLevel;
  urgencyScore: number;
  primaryTopic: string;
  topics: string[];
  keyPhrases: string[];
  summary: string;
  severity: number;
  confidenceScore: number;
  modelVersion: string;
  promptVersion: string;
  analyzedAt: string;
  createdAt: string;
  updatedAt: string;
}
