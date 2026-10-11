import React from 'react';
import { 
  Sparkles, 
  RotateCw, 
  ArrowRight, 
  Layers, 
  SlidersHorizontal,
  Building,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { Link } from 'react-router-dom';

const mockInsights = [
  {
    id: 'TOPIC-01',
    title: 'Billing Clarity & Invoice Line Item Breakdowns',
    urgency: 'danger' as const,
    urgencyLabel: 'Critical Friction',
    sentiment: '64% Negative',
    mentions: '42 feedback items',
    accountsAffected: '14 Enterprise Accounts',
    summary:
      'Enterprise finance teams cannot reconcile monthly consumption spikes without granular API usage breakdowns attached to invoices.',
    recommendation:
      'Introduce itemized monthly consumption invoices and an exportable billing telemetry breakdown table.',
    quote: '"Our procurement audit team delayed our annual contract renewal due to opaque invoice line items."',
    source: 'Citadel Securities CFO Office',
  },
  {
    id: 'TOPIC-02',
    title: 'SSO SAML Auto-Provisioning & SCIM Sync Failures',
    urgency: 'warning' as const,
    urgencyLabel: 'Elevated Priority',
    sentiment: '48% Negative',
    mentions: '29 feedback items',
    accountsAffected: '9 Mid-Market Accounts',
    summary:
      'Okta and Azure AD user directory synchronization intermittently drops active user groups upon membership reassignment.',
    recommendation:
      'Upgrade the SCIM v2 schema handler to perform idempotent group reconciliation before firing state updates.',
    quote: '"Engineers lose workspace permissions whenever IT reassigns departmental security groups."',
    source: 'Datadog EMEA Ops',
  },
  {
    id: 'TOPIC-03',
    title: 'Audit Log Retention & SIEM Webhook Streaming',
    urgency: 'indigo' as const,
    urgencyLabel: 'Expansion Enabler',
    sentiment: '82% Positive Feature Interest',
    mentions: '21 feedback items',
    accountsAffected: '18 Security Teams',
    summary:
      'Security compliance officers actively request direct real-time audit log streaming to Splunk and Datadog Log Management.',
    recommendation:
      'Provide webhook endpoints for SOC audit events with HMAC SHA-256 signatures.',
    quote: '"Streaming audit events directly into our SIEM would fulfill our ISO 27001 requirement immediately."',
    source: 'Stripe Security Team',
  },
];

export const InsightsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            AI Insights & Topic Discovery
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Unsupervised topic modeling and semantic clustering applied across all ingested customer signals.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" leftIcon={<RotateCw className="h-4 w-4" />}>
            Re-run Clustering
          </Button>
          <Link to="/actions">
            <Button variant="primary" size="sm" leftIcon={<ArrowRight className="h-4 w-4" />}>
              Review Action Queue
            </Button>
          </Link>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <span>Model: <strong>InsightFlow-LLM-Clustering-v3.2</strong></span>
          <span className="text-slate-300">•</span>
          <span>Last updated: 14 mins ago</span>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-48">
            <Select defaultValue="all">
              <option value="all">All Customer Tiers</option>
              <option value="enterprise">Enterprise ($100k+ ARR)</option>
              <option value="midmarket">Mid-Market</option>
              <option value="atrisk">Accounts at Churn Risk</option>
            </Select>
          </div>
          <Button variant="ghost" size="sm" leftIcon={<SlidersHorizontal className="h-4 w-4" />}>
            Tune Thresholds
          </Button>
        </div>
      </div>

      {/* Structured Insights Cards List */}
      <div className="space-y-4">
        {mockInsights.map((insight) => (
          <Card key={insight.id} className="transition-all hover:border-slate-300">
            <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={insight.urgency} size="sm" dot>
                    {insight.urgencyLabel}
                  </Badge>
                  <span className="font-mono text-xs text-slate-400">{insight.id}</span>
                </div>
                <CardTitle className="text-base sm:text-lg">{insight.title}</CardTitle>
                <CardDescription>{insight.summary}</CardDescription>
              </div>

              <div className="flex sm:flex-col items-end gap-1.5 shrink-0 text-right">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Layers className="h-3.5 w-3.5 text-slate-400" />
                  {insight.mentions}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Building className="h-3.5 w-3.5 text-slate-400" />
                  {insight.accountsAffected}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3.5 pt-2">
              {/* Evidence Quote */}
              <div className="rounded-lg border-l-2 border-indigo-500 bg-slate-50 p-3 text-xs text-slate-700">
                <p className="italic">{insight.quote}</p>
                <p className="mt-1 font-semibold text-slate-500 text-[11px]">— {insight.source}</p>
              </div>

              {/* Recommended Action */}
              <div className="rounded-lg bg-indigo-50/50 border border-indigo-100 p-3 text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-indigo-900">Recommended Action: </span>
                  <span>{insight.recommendation}</span>
                </div>
                <Link to="/actions">
                  <Button variant="primary" size="sm" className="shrink-0 text-xs py-1 px-3">
                    Convert to Initiative
                  </Button>
                </Link>
              </div>
            </CardContent>

            <CardFooter className="text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Sentiment Profile: <strong>{insight.sentiment}</strong></span>
              </div>
              <div className="flex items-center gap-3">
                <button className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer">
                  Inspect Linked Citations →
                </button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};
