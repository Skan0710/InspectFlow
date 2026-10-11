import React from 'react';
import { 
  Plus, 
  ArrowUpRight, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Building2, 
  MessageSquare,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Link } from 'react-router-dom';

export const OverviewPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Intelligence Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Aggregated cross-channel customer signals, sentiment distribution, and priority triage items.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/feedback">
            <Button variant="outline" size="sm" leftIcon={<MessageSquare className="h-4 w-4" />}>
              Browse Feed
            </Button>
          </Link>
          <Link to="/actions">
            <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
              New Action Item
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards (Scaffolding Metrics without fake charts) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Total Feedback</span>
              <MessageSquare className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              1,482
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Badge variant="indigo" size="sm" dot>
                +12% this week
              </Badge>
              <span>Across 6 integrations</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Net Sentiment Score</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">
              +68 <span className="text-sm font-normal text-slate-500">/ 100</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Badge variant="success" size="sm">
                Positive Index
              </Badge>
              <span>74% satisfaction rating</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Open Action Items</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              4
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Badge variant="warning" size="sm" dot>
                2 High Priority
              </Badge>
              <span>Assigned across teams</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Tracked Accounts</span>
              <Building2 className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              214
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Badge variant="neutral" size="sm">
                Enterprise & Mid-Market
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Section: Key Drivers & Recent Feedback Stream */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 spans): Feed Stream Scaffolding */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle>Recent Customer Signals</CardTitle>
                <CardDescription>Live intake stream from connected support and CRM channels</CardDescription>
              </div>
              <Link to="/feedback" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                View All <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {[
                {
                  account: 'Acme Global Corp',
                  source: 'Zendesk Ticket #4912',
                  topic: 'SSO SAML Auto-Provisioning',
                  sentiment: 'warning',
                  sentimentLabel: 'Neutral Friction',
                  time: '12m ago',
                  excerpt: 'Provisioning fails intermittently for users syncing via Azure AD SCIM connector.',
                },
                {
                  account: 'Stripe Partners',
                  source: 'G2 Review',
                  topic: 'Webhook Latency',
                  sentiment: 'success',
                  sentimentLabel: 'Positive Feedback',
                  time: '45m ago',
                  excerpt: 'The migration to v2 endpoints reduced our telemetry sync delays down to under 200ms.',
                },
                {
                  account: 'Northstar Financial',
                  source: 'Gong Call Transcript',
                  topic: 'Role-Based Access Controls',
                  sentiment: 'danger',
                  sentimentLabel: 'Negative / Risk',
                  time: '2h ago',
                  excerpt: 'Compliance team is requesting granular read-only auditor permissions prior to contract renewal.',
                },
              ].map((item, idx) => (
                <div key={idx} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">{item.account}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500 font-mono">{item.source}</span>
                    </div>
                    <Badge variant={item.sentiment as 'success' | 'warning' | 'danger'} size="sm" dot>
                      {item.sentimentLabel}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    "{item.excerpt}"
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                      Topic: {item.topic}
                    </span>
                    <span>{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: AI Topic Clusters & Focus */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                <Sparkles className="h-4 w-4" />
                <span>AI Detected Themes</span>
              </div>
              <CardTitle>Emerging Clusters</CardTitle>
              <CardDescription>Top detected discussion clusters this week</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {[
                { title: 'Billing Line Item Transparency', count: '42 mentions', badge: 'High Urgency', variant: 'danger' as const },
                { title: 'Audit Log Retention API', count: '28 mentions', badge: 'Compliance', variant: 'warning' as const },
                { title: 'Export to Parquet Format', count: '19 mentions', badge: 'Feature Request', variant: 'indigo' as const },
              ].map((theme, i) => (
                <div key={i} className="rounded-lg border border-slate-200/80 p-3 bg-slate-50/50">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-900">{theme.title}</h4>
                    <Badge variant={theme.variant} size="sm">
                      {theme.badge}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{theme.count} cross-channel</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Data pipeline connectors healthy</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Sentiment analysis model v3.2 active</span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-500 shrink-0" />
                <span>Weekly digest scheduled for Monday</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
