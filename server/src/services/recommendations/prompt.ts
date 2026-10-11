import type {
  MeasuredFacts,
  ResponsibleTeam,
} from './types.js';
import type { IssueClusterData } from '../clustering/types.js';

export const RECOMMENDATION_PROMPT_VERSION = 'rec-v1.0.0';

export const RECOMMENDATION_SYSTEM_PROMPT = `You are InsightFlow's Senior Product & Operations Strategy Engine.
Your task is to analyze real customer feedback data for a high-priority customer issue cluster and produce evidence-backed recommendations for cross-functional product and engineering teams.

CRITICAL INVARIANTS:
1. STRICT EVIDENCE GROUNDING:
   - You are provided with a curated list of candidate reviews with real feedback IDs and verbatim review text.
   - You MUST ONLY select evidence feedback IDs from the provided candidate list in "evidence_feedback_ids".
   - NEVER invent, fabricate, or hallucinate feedback IDs or quotes.
2. ZERO SPECULATION:
   - Do NOT invent specific financial losses (e.g., "$50,000 lost"), fraudulent schemes, causal links, or facts absent from the customer feedback.
   - Ground "why_it_matters" strictly on the measured customer sentiment, friction, and severity observed in the feedback.
3. STRUCTURED ACTIONABILITY:
   - Provide 2 to 4 concrete, actionable steps.
   - For each action, state what must be done, why it helps, expected impact, and an appropriate timeframe ('immediate', 'short_term', or 'medium_term').
   - Assign an appropriate responsible team from: 'Product', 'Engineering', 'Customer Support', 'Operations', 'Trust & Safety', 'Billing & Finance'.

Output MUST be strictly valid JSON conforming to the requested schema.`;

export interface CandidateReview {
  id: string;
  review: string;
  category: string;
  sentiment?: string;
  severity?: number;
}

export function buildRecommendationPrompt(
  issue: IssueClusterData,
  facts: MeasuredFacts,
  candidateReviews: CandidateReview[]
): string {
  const reviewsList = candidateReviews
    .slice(0, 10)
    .map(
      (r, idx) =>
        `[Feedback #${idx + 1}] ID: "${r.id}" | Category: "${r.category}" | Severity: ${r.severity ?? 'N/A'} | Sentiment: ${r.sentiment ?? 'N/A'}\n"${r.review}"`
    )
    .join('\n\n');

  return `### ISSUE METADATA & MEASURED FACTS
- Issue Code: ${issue.issueCode}
- Title: ${issue.title}
- Primary Category: ${issue.category}
- Priority Tier: ${issue.priority.toUpperCase()} (Score: ${facts.priorityScore}/100)
- Total Mentions: ${facts.totalFrequency} (Unique Inquiries: ${facts.uniqueReports}, Duplicate Ratio: ${(facts.duplicateRatio * 100).toFixed(1)}%)
- Average Severity: ${facts.averageSeverity.toFixed(2)} / 5.0
- Severity Breakdown: Sev 5: ${facts.severityBreakdown.sev5}, Sev 4: ${facts.severityBreakdown.sev4}, Sev 3: ${facts.severityBreakdown.sev3}, Sev 2: ${facts.severityBreakdown.sev2}, Sev 1: ${facts.severityBreakdown.sev1}
- Sentiment Profile: Negative: ${facts.sentimentDistribution.negative}, Mixed: ${facts.sentimentDistribution.mixed}, Neutral: ${facts.sentimentDistribution.neutral}, Positive: ${facts.sentimentDistribution.positive}

### CANDIDATE CUSTOMER REVIEWS (CHOOSE EVIDENCE FROM HERE ONLY)
${reviewsList}

### REQUIRED JSON SCHEMA:
{
  "issue_summary": "Concise 1-2 sentence description of what customers are experiencing",
  "why_it_matters": "Clear explanation of customer impact and business urgency grounded in the measured facts above",
  "suggested_team": "One of: Product | Engineering | Customer Support | Operations | Trust & Safety | Billing & Finance",
  "recommended_actions": [
    {
      "title": "Actionable imperative title (e.g. Implement rate limiting on checkout button)",
      "description": "Specific implementation or operational step to take",
      "expected_impact": "Direct benefit to customers and error reduction",
      "timeframe": "immediate | short_term | medium_term",
      "suggested_owner_team": "Product | Engineering | Customer Support | Operations | Trust & Safety | Billing & Finance"
    }
  ],
  "evidence_feedback_ids": ["Exact feedback IDs chosen from Candidate Reviews above (1 to 4 IDs)"],
  "confidence": 0.95
}`;
}
