import crypto from 'node:crypto';
import type {
  IssueRecommendation,
  MeasuredFacts,
  ResponsibleTeam,
  RecommendationAction,
  EvidenceExcerpt,
} from './types.js';
import type { IssueClusterData } from '../clustering/types.js';
import type { CandidateReview } from './prompt.js';

export function inferResponsibleTeam(category: string, title: string, avgSeverity: number): ResponsibleTeam {
  const lowerCat = category.toLowerCase();
  const lowerTitle = title.toLowerCase();

  if (lowerCat.includes('fraud') || lowerCat.includes('scam') || lowerTitle.includes('scam') || lowerTitle.includes('fraud')) {
    return 'Trust & Safety';
  }

  if (lowerCat.includes('customer service') || lowerCat.includes('support') || lowerTitle.includes('support')) {
    return 'Customer Support';
  }

  if (
    lowerCat.includes('operational') ||
    lowerTitle.includes('sync') ||
    lowerTitle.includes('latency') ||
    lowerTitle.includes('downtime') ||
    avgSeverity >= 4.0
  ) {
    return 'Operations';
  }

  if (lowerTitle.includes('billing') || lowerTitle.includes('refund') || lowerTitle.includes('charge')) {
    return 'Billing & Finance';
  }

  if (lowerTitle.includes('bug') || lowerTitle.includes('crash') || lowerTitle.includes('api') || lowerTitle.includes('performance')) {
    return 'Engineering';
  }

  return 'Product';
}

export function generateDeterministicFallback(
  issue: IssueClusterData,
  facts: MeasuredFacts,
  candidateReviews: CandidateReview[]
): IssueRecommendation {
  const suggestedTeam = inferResponsibleTeam(issue.category, issue.title, facts.averageSeverity);
  const now = new Date().toISOString();

  // Ground whyItMatters on real measured metrics
  const negativePercent = facts.totalFrequency > 0 
    ? Math.round((facts.sentimentDistribution.negative / facts.totalFrequency) * 100) 
    : 0;

  const severityLabel = facts.averageSeverity >= 4 
    ? 'critical operational severity' 
    : facts.averageSeverity >= 2.5 
    ? 'moderate user friction' 
    : 'minor cosmetic impact';

  const issueSummary = `Customers are reporting recurring friction regarding "${issue.title}". With ${facts.totalFrequency} total mentions (${facts.uniqueReports} unique reports), this issue cluster represents a concentrated area of customer dissatisfaction within ${issue.category}.`;

  const whyItMatters = `This issue exhibits ${severityLabel} (average severity: ${facts.averageSeverity.toFixed(2)}/5) with ${negativePercent}% of recorded mentions classified as negative sentiment. A priority score of ${facts.priorityScore}/100 places this in the ${facts.priorityTier.toUpperCase()} triage queue, indicating that unresolved occurrences may drive avoidable customer attrition and support load.`;

  // Concrete grounded actions based on team and severity
  const recommendedActions: RecommendationAction[] = [];

  if (suggestedTeam === 'Trust & Safety') {
    recommendedActions.push({
      title: 'Flag Suspicious Vectors & Alert Support Queue',
      description: 'Audit reported scam vectors from customer feedback, deploy automated keyword filters, and brief support staff on immediate escalation protocols.',
      expectedImpact: 'Prevents repeat fraud attempts and mitigates customer account vulnerability.',
      timeframe: 'immediate',
      suggestedOwnerTeam: 'Trust & Safety',
    });
    recommendedActions.push({
      title: 'Enhance Verification & Warning Prompts',
      description: 'Implement contextual confirmation warnings before sensitive transactions to alert users to prevalent scam patterns.',
      expectedImpact: 'Reduces unauthorized transactions and builds proactive customer trust.',
      timeframe: 'short_term',
      suggestedOwnerTeam: 'Product',
    });
  } else if (suggestedTeam === 'Operations' || suggestedTeam === 'Engineering') {
    recommendedActions.push({
      title: 'Instrument Latency Telemetry & Error Tracking',
      description: 'Add diagnostic logs and error alerts around the specific workflow highlighted in customer feedback to isolate bottlenecks.',
      expectedImpact: 'Enables rapid root-cause diagnosis without relying on manual user bug reports.',
      timeframe: 'immediate',
      suggestedOwnerTeam: 'Engineering',
    });
    recommendedActions.push({
      title: 'Deploy Defensive Fallbacks & Status Messaging',
      description: 'Introduce graceful degraded states and clear in-app status messaging when operational latency occurs.',
      expectedImpact: 'Prevents repeated user retries and decreases perceived downtime.',
      timeframe: 'short_term',
      suggestedOwnerTeam: 'Operations',
    });
  } else if (suggestedTeam === 'Customer Support') {
    recommendedActions.push({
      title: 'Create Standardized Response & Escalation Macro',
      description: 'Develop dedicated troubleshooting macros and resolution playbooks for frontline agents handling this specific inquiry pattern.',
      expectedImpact: 'Reduces first-response time and eliminates inconsistent guidance across support shifts.',
      timeframe: 'immediate',
      suggestedOwnerTeam: 'Customer Support',
    });
    recommendedActions.push({
      title: 'Publish Self-Service Knowledge Base Guide',
      description: 'Document step-by-step resolution workflows in customer-facing help articles to deflect inbound support tickets.',
      expectedImpact: 'Deflects repetitive inquiries and empowers customers with immediate self-service answers.',
      timeframe: 'short_term',
      suggestedOwnerTeam: 'Customer Support',
    });
  } else {
    // Product / General
    recommendedActions.push({
      title: 'Review UX Friction Points & Clarify Onboarding Copy',
      description: 'Inspect the specific interaction steps detailed in customer feedback to identify confusing terminology, hidden buttons, or unexpected form validation errors.',
      expectedImpact: 'Immediately reduces user confusion and improves task completion rates.',
      timeframe: 'immediate',
      suggestedOwnerTeam: 'Product',
    });
    recommendedActions.push({
      title: 'Prioritize Workflow Redesign in Next Sprint',
      description: 'Incorporate user experience refinements into product backlog with acceptance criteria directly addressing verbatim customer citations.',
      expectedImpact: 'Permanently resolves underlying feature friction and boosts user satisfaction.',
      timeframe: 'short_term',
      suggestedOwnerTeam: 'Product',
    });
  }

  // Extract evidence excerpts strictly from real candidate reviews
  const evidenceExcerpts: EvidenceExcerpt[] = candidateReviews.slice(0, 3).map((r) => ({
    feedbackId: r.id,
    quote: r.review.length > 200 ? `${r.review.slice(0, 197)}...` : r.review,
    category: r.category,
    severity: r.severity,
    sentiment: r.sentiment,
  }));

  return {
    id: crypto.randomUUID(),
    issueId: issue.id,
    issueCode: issue.issueCode,
    title: issue.title,
    issueSummary,
    whyItMatters,
    suggestedTeam,
    recommendedActions,
    evidenceExcerpts,
    measuredFacts: facts,
    isFallback: true,
    confidenceScore: 0.85,
    generatedAt: now,
    modelVersion: 'deterministic-heuristic',
    promptVersion: 'fallback-v1.0.0',
  };
}
