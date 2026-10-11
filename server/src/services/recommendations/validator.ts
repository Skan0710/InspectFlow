import type { SchemaValidationResult } from '../ai/types.js';
import type {
  RawRecommendationModelOutput,
  ResponsibleTeam,
  ActionTimeframe,
  RecommendationAction,
} from './types.js';

const VALID_TEAMS = new Set<ResponsibleTeam>([
  'Product',
  'Engineering',
  'Customer Support',
  'Operations',
  'Trust & Safety',
  'Billing & Finance',
]);

const VALID_TIMEFRAMES = new Set<ActionTimeframe>([
  'immediate',
  'short_term',
  'medium_term',
]);

export interface ValidationOptions {
  validFeedbackIds: Set<string>;
  requireEvidence?: boolean;
}

export function validateRecommendationOutput(
  data: unknown,
  options: ValidationOptions
): SchemaValidationResult<RawRecommendationModelOutput> {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { success: false, errors: ['Recommendation output must be a valid JSON object.'] };
  }

  const obj = data as Record<string, unknown>;

  // 1. Issue summary
  if (typeof obj.issue_summary !== 'string' || obj.issue_summary.trim().length < 5) {
    errors.push('Missing or too short issue_summary: must be at least 5 characters.');
  }

  // 2. Why it matters
  if (typeof obj.why_it_matters !== 'string' || obj.why_it_matters.trim().length < 10) {
    errors.push('Missing or too short why_it_matters: must explain operational/customer impact.');
  }

  // 3. Suggested team
  let suggestedTeam: ResponsibleTeam = 'Product';
  if (typeof obj.suggested_team !== 'string' || !VALID_TEAMS.has(obj.suggested_team as ResponsibleTeam)) {
    // Normalization attempt: case-insensitive match
    const matched = Array.from(VALID_TEAMS).find(
      (t) => t.toLowerCase() === String(obj.suggested_team).toLowerCase().trim()
    );
    if (matched) {
      suggestedTeam = matched;
    } else {
      errors.push(
        `Invalid suggested_team '${obj.suggested_team}'. Must be one of: ${Array.from(VALID_TEAMS).join(', ')}`
      );
    }
  } else {
    suggestedTeam = obj.suggested_team as ResponsibleTeam;
  }

  // 4. Recommended actions
  if (!Array.isArray(obj.recommended_actions) || obj.recommended_actions.length === 0) {
    errors.push('recommended_actions must be a non-empty array of action objects.');
  }

  const validatedActions: RecommendationAction[] = [];
  if (Array.isArray(obj.recommended_actions)) {
    for (let i = 0; i < obj.recommended_actions.length; i++) {
      const act = obj.recommended_actions[i];
      if (!act || typeof act !== 'object') {
        errors.push(`Action #${i + 1} must be an object.`);
        continue;
      }

      const title = String(act.title || '').trim();
      const description = String(act.description || '').trim();
      const expectedImpact = String(act.expected_impact || '').trim();
      let timeframe: ActionTimeframe = 'short_term';

      if (!title) errors.push(`Action #${i + 1} is missing a title.`);
      if (!description) errors.push(`Action #${i + 1} is missing a description.`);
      if (!expectedImpact) errors.push(`Action #${i + 1} is missing expected_impact.`);

      const rawTimeframe = String(act.timeframe || '').toLowerCase().trim();
      if (VALID_TIMEFRAMES.has(rawTimeframe as ActionTimeframe)) {
        timeframe = rawTimeframe as ActionTimeframe;
      } else {
        timeframe = 'short_term'; // Safe default if omitted or slightly varied
      }

      let ownerTeam = suggestedTeam;
      if (act.suggested_owner_team) {
        const rawOwner = String(act.suggested_owner_team).trim();
        const matched = Array.from(VALID_TEAMS).find(
          (t) => t.toLowerCase() === rawOwner.toLowerCase()
        );
        if (matched) ownerTeam = matched;
      }

      validatedActions.push({
        title,
        description,
        expectedImpact,
        timeframe,
        suggestedOwnerTeam: ownerTeam,
      });
    }
  }

  // 5. Evidence feedback IDs: Strict Verification
  const validIds = options.validFeedbackIds;
  const verifiedFeedbackIds: string[] = [];

  if (Array.isArray(obj.evidence_feedback_ids)) {
    for (const rawId of obj.evidence_feedback_ids) {
      const id = String(rawId).trim();
      if (validIds.has(id)) {
        if (!verifiedFeedbackIds.includes(id)) {
          verifiedFeedbackIds.push(id);
        }
      } else {
        // Hallucinated or unrelated feedback ID detected!
        errors.push(`Referenced feedback ID "${id}" does not exist or does not belong to this issue.`);
      }
    }
  }

  if (options.requireEvidence && validIds.size > 0 && verifiedFeedbackIds.length === 0) {
    errors.push('At least one verified feedback ID must be referenced from candidate reviews.');
  }

  // 6. Confidence validation
  let confidence = 0.9;
  if (typeof obj.confidence === 'number' && !isNaN(obj.confidence)) {
    confidence = Math.max(0, Math.min(1, obj.confidence));
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      issue_summary: String(obj.issue_summary).trim(),
      why_it_matters: String(obj.why_it_matters).trim(),
      suggested_team: suggestedTeam,
      recommended_actions: validatedActions.map((a) => ({
        title: a.title,
        description: a.description,
        expected_impact: a.expectedImpact,
        timeframe: a.timeframe,
        suggested_owner_team: a.suggestedOwnerTeam,
      })),
      evidence_feedback_ids: verifiedFeedbackIds,
      confidence,
    },
  };
}
