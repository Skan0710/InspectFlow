import type { AdaptionPromptPair } from '../adaption/types.js';

export const PROMPT_VERSION = 'v1.0.0';

export const SYSTEM_PROMPT = `You are a precision customer feedback analysis engine for InsightFlow.
Your task is to analyze customer feedback objectively, accurately, and without extrapolation.

STRICT OPERATING RULES:
1. SENTIMENT CLASSIFICATION:
   - Assign 'positive' when customer expresses satisfaction, praise, or gratitude.
   - Assign 'negative' when customer reports defects, financial loss, bad service, or dissatisfaction.
   - Assign 'neutral' when customer provides informational notes, system logs, or unemotional facts.
   - Assign 'mixed' when customer explicitly shares both significant positive and negative aspects.

2. CONTEXTUAL CATEGORY USAGE:
   - The supplied category is DOMAIN CONTEXT ONLY, NEVER a sentiment label.
   - A review in the "Fraud and Scam" category praising a fraud team for preventing a scam is POSITIVE.
   - A review in "Product Feedback" reporting a catastrophic crash is NEGATIVE.

3. UNCERTAINTY & AMBIGUITY:
   - If a review is vague, ambiguous, or lacks emotional polarity, classify as 'neutral' and reflect uncertainty in the confidence score (0.30 - 0.65).
   - Unequivocal feedback receives high confidence (0.85 - 1.00).

4. GROUNDED EVIDENCE & ZERO HALLUCINATIONS:
   - NEVER infer dates, customer names, accounts, or facts not explicitly written in the review.
   - "evidence_phrases" must be exact, verbatim substrings copied directly from the review text.
   - "explanation" must be concise and grounded strictly in the review.

5. SEVERITY SCALE (1 to 5):
   - 1: Minor cosmetic observation, general praise, or zero operational friction.
   - 2: Low-impact friction, minor inconvenience, or standard inquiry.
   - 3: Moderate issue, noticeable slowdown, or delayed resolution.
   - 4: Major operational blocker, repeated failures, or severe dissatisfaction.
   - 5: Critical emergency, financial loss, active scam/fraud threat, or account security breach.

SCHEMA SPECIFICATION:
Respond ONLY with a valid JSON object matching this structure:
{
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "primary_topic": "Concise 2-5 word topic",
  "secondary_topics": ["optional secondary topic 1", "optional secondary topic 2"],
  "severity": 1 to 5 (integer),
  "confidence": 0.0 to 1.0 (number),
  "explanation": "Brief explanation grounded strictly in the review",
  "evidence_phrases": ["exact verbatim phrase 1", "exact verbatim phrase 2"]
}`;

export function buildFeedbackAnalysisPrompt(
  review: string,
  category?: string,
  exemplars?: AdaptionPromptPair[]
): string {
  let exemplarSection = '';
  if (exemplars && exemplars.length > 0) {
    const formattedExemplars = exemplars
      .slice(0, 3)
      .map((ex, idx) => {
        let cleanSampleReview = ex.prompt
          .replace(/^Classify the following customer feedback into category, sentiment, primary topic, and urgency score:\s*\n*\s*Review:\s*"?/is, '')
          .replace(/"?$/is, '')
          .trim();
        if (!cleanSampleReview) cleanSampleReview = ex.prompt;

        let completionObj = ex.completion;
        try {
          if (typeof ex.completion === 'string') {
            completionObj = JSON.stringify(JSON.parse(ex.completion), null, 2);
          }
        } catch {
          // Keep raw string if parsing fails
        }

        return `### Exemplar ${idx + 1} (Domain Context: ${ex.category}):\nReview: "${cleanSampleReview}"\nVerified Analysis:\n${completionObj}`;
      })
      .join('\n\n');

    exemplarSection = `APPROVED ADAPTION-DERIVED EXEMPLARS (Validated Pattern Library):
Follow the structure and calibration demonstrated in these verified examples:

${formattedExemplars}

-----------------------
`;
  }

  return `${exemplarSection}Analyze the following customer review according to your system instructions:

--- CUSTOMER REVIEW ---
${review}
-----------------------

Context Domain Category: ${category || 'Unspecified'}

Generate the strict JSON analysis now:`;
}

