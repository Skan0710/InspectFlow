import type { ReportRecord } from '../../types/reports.js';

/**
 * Escapes CSV values and protects against spreadsheet formula injection attacks
 * by prepending a single quote if the field begins with =, +, -, @, \t, or \r.
 */
function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Generates an executive, RFC-4180 compliant CSV intelligence report with all
 * metric dimensions, score components, traceable excerpts, and recommendations.
 */
export function generateReportCsv(report: ReportRecord): string {
  const p = report.contentPayload;
  const m = p.metadata;
  const rows: string[] = [];

  // 1. Report Metadata Section
  rows.push(['# SECTION: REPORT METADATA'].join(','));
  rows.push(['Field', 'Value'].join(','));
  rows.push(['Report Code', escapeCsv(m.reportCode)].join(','));
  rows.push(['Title', escapeCsv(m.title)].join(','));
  rows.push(['Report Type', escapeCsv(m.reportType)].join(','));
  rows.push(['Generated At', escapeCsv(m.generatedAt)].join(','));
  rows.push(['Date Range Note', escapeCsv(m.applicableDateRange.note)].join(','));
  rows.push(['Is Snapshot Only', escapeCsv(String(m.applicableDateRange.isSnapshot))].join(','));
  rows.push(['Executive Summary', escapeCsv(p.executiveSummary)].join(','));
  rows.push('');

  // 2. Dataset Scope Section
  rows.push('# SECTION: DATASET SCOPE & ANALYSIS STATUS');
  rows.push(['Metric', 'Count / Value'].join(','));
  rows.push(['Total Feedback Items', escapeCsv(p.datasetScope.totalFeedback)].join(','));
  rows.push(['Analyzed Feedback Items', escapeCsv(p.datasetScope.analyzedFeedback)].join(','));
  rows.push(['Pending Feedback Items', escapeCsv(p.datasetScope.pendingAnalysis)].join(','));
  rows.push(['Analysis Coverage Percent', escapeCsv(`${p.datasetScope.analysisCoveragePercent}%`)].join(','));
  rows.push(['Dataset Origin', escapeCsv(p.datasetScope.datasetOrigin)].join(','));
  rows.push(['Unique Customer Texts', escapeCsv(p.datasetScope.uniqueCount)].join(','));
  rows.push(['Duplicate Reviews Count', escapeCsv(p.datasetScope.duplicateCount)].join(','));
  rows.push(['Duplicate Rate Percent', escapeCsv(`${p.datasetScope.duplicateRatePercent}%`)].join(','));
  rows.push('');

  // 3. Sentiment Distribution Section
  rows.push('# SECTION: CUSTOMER SENTIMENT DISTRIBUTION');
  rows.push(['Sentiment', 'Count', 'Percentage', 'Denominator'].join(','));
  rows.push([
    'Positive',
    escapeCsv(p.sentimentDistribution.positive.count),
    escapeCsv(`${p.sentimentDistribution.positive.percentage}%`),
    escapeCsv(p.sentimentDistribution.denominator),
  ].join(','));
  rows.push([
    'Neutral',
    escapeCsv(p.sentimentDistribution.neutral.count),
    escapeCsv(`${p.sentimentDistribution.neutral.percentage}%`),
    escapeCsv(p.sentimentDistribution.denominator),
  ].join(','));
  rows.push([
    'Negative',
    escapeCsv(p.sentimentDistribution.negative.count),
    escapeCsv(`${p.sentimentDistribution.negative.percentage}%`),
    escapeCsv(p.sentimentDistribution.denominator),
  ].join(','));
  rows.push([
    'Mixed',
    escapeCsv(p.sentimentDistribution.mixed.count),
    escapeCsv(`${p.sentimentDistribution.mixed.percentage}%`),
    escapeCsv(p.sentimentDistribution.denominator),
  ].join(','));
  rows.push(['Net Sentiment Score', escapeCsv(p.sentimentDistribution.netSentimentScore), '', ''].join(','));
  rows.push('');

  // 4. Category Breakdown Section
  rows.push('# SECTION: CATEGORY DISTRIBUTION');
  rows.push(['Category', 'Volume', 'Proportion Percentage', 'Dominant Sentiment'].join(','));
  for (const cat of p.categoryBreakdown) {
    rows.push([
      escapeCsv(cat.category),
      escapeCsv(cat.count),
      escapeCsv(`${cat.percentage}%`),
      escapeCsv(cat.dominantSentiment),
    ].join(','));
  }
  rows.push('');

  // 5. Action Center Status Section
  rows.push('# SECTION: ACTION CENTER STATUS SUMMARY');
  rows.push(['Status Category', 'Issue Count'].join(','));
  rows.push(['Open Issues', escapeCsv(p.issueStatusSummary.open)].join(','));
  rows.push(['In Progress Issues', escapeCsv(p.issueStatusSummary.in_progress)].join(','));
  rows.push(['Resolved Issues', escapeCsv(p.issueStatusSummary.resolved)].join(','));
  rows.push(['Dismissed Issues', escapeCsv(p.issueStatusSummary.dismissed)].join(','));
  rows.push(['Total Issues', escapeCsv(p.issueStatusSummary.total)].join(','));
  rows.push('');

  // 6. Top Priority Issues Table
  rows.push('# SECTION: TOP PRIORITY ISSUES & SCORE BREAKDOWN');
  rows.push([
    'Issue Code',
    'Title',
    'Category',
    'Priority Tier',
    'Total Priority Score',
    'Frequency Points',
    'Severity Points',
    'Negativity Points',
    'Mentions Frequency',
    'Unique Reports',
    'Negative Sentiment Ratio',
    'Status',
    'Responsible Team',
    'Recommendation Summary',
    'Traceable Feedback Excerpts',
  ].join(','));

  for (const iss of p.topPriorityIssues) {
    const excerptsStr = iss.representativeExcerpts
      .map((e) => `[ID: ${e.feedbackId}] "${e.quote}"`)
      .join(' | ');

    rows.push([
      escapeCsv(iss.code),
      escapeCsv(iss.title),
      escapeCsv(iss.category),
      escapeCsv(iss.priority),
      escapeCsv(iss.priorityScore),
      escapeCsv(iss.scoreBreakdown.frequencyPoints),
      escapeCsv(iss.scoreBreakdown.severityPoints),
      escapeCsv(iss.scoreBreakdown.negativeSentimentPoints),
      escapeCsv(iss.frequency),
      escapeCsv(iss.uniqueReports),
      escapeCsv(`${Math.round(iss.negativeSentimentRatio * 100)}%`),
      escapeCsv(iss.status),
      escapeCsv(iss.recommendation?.responsibleTeam || 'Unassigned'),
      escapeCsv(iss.recommendation?.summary || 'None'),
      escapeCsv(excerptsStr),
    ].join(','));
  }

  return rows.join('\r\n');
}
