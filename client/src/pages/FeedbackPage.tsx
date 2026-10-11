import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Upload, 
  Download, 
  MoreHorizontal, 
  CheckSquare, 
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';

const mockFeedbackItems = [
  {
    id: 'FB-1049',
    account: 'Datadog EMEA',
    tier: 'Tier 1 Enterprise',
    source: 'Zendesk Ticket #5821',
    sentiment: 'danger' as const,
    sentimentLabel: 'Negative',
    topic: 'Webhook Retries',
    content: 'Webhook notifications are dropping silent without exponential backoff during maintenance windows.',
    date: 'Oct 11, 2026',
    status: 'Needs Triage',
  },
  {
    id: 'FB-1048',
    account: 'Figma Design Ops',
    tier: 'Tier 1 Enterprise',
    source: 'Gong Call',
    sentiment: 'success' as const,
    sentimentLabel: 'Positive',
    topic: 'Dashboard Performance',
    content: 'The new telemetry filtering is instantaneous across our 50k design project assets. Tremendous improvement.',
    date: 'Oct 11, 2026',
    status: 'Archived',
  },
  {
    id: 'FB-1047',
    account: 'Notion Technologies',
    tier: 'Mid-Market',
    source: 'Salesforce Case',
    sentiment: 'warning' as const,
    sentimentLabel: 'Neutral',
    topic: 'Audit Export',
    content: 'Would appreciate automatic scheduled CSV uploads to our AWS S3 bucket instead of manual dashboard exports.',
    date: 'Oct 10, 2026',
    status: 'Under Review',
  },
  {
    id: 'FB-1046',
    account: 'Canva Systems',
    tier: 'Tier 1 Enterprise',
    source: 'In-App CSAT',
    sentiment: 'success' as const,
    sentimentLabel: 'Positive',
    topic: 'API Usability',
    content: 'SDK typings are crisp and well documented. Team integrated the client library in less than 2 hours.',
    date: 'Oct 09, 2026',
    status: 'Logged',
  },
  {
    id: 'FB-1045',
    account: 'Snowflake Analytics',
    tier: 'Tier 1 Enterprise',
    source: 'G2 Review',
    sentiment: 'warning' as const,
    sentimentLabel: 'Neutral',
    topic: 'Permission Scopes',
    content: 'Need more granular role delegation for regional compliance managers without granting full tenant admin.',
    date: 'Oct 09, 2026',
    status: 'Action Created',
  },
];

export const FeedbackPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Customer Feedback Repository
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Centralized intake across support tickets, customer success calls, CSAT surveys, and reviews.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" leftIcon={<Download className="h-4 w-4" />}>
            Export CSV
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Upload className="h-4 w-4" />}>
            Ingest Feedback
          </Button>
        </div>
      </div>

      {/* Filter and Query Bar */}
      <Card className="p-4 bg-white">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Search accounts, keywords, text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
          <Select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="all">All Sources (All Channels)</option>
            <option value="zendesk">Zendesk Tickets</option>
            <option value="gong">Gong Calls</option>
            <option value="salesforce">Salesforce Cases</option>
            <option value="in-app">In-App Surveys</option>
          </Select>
          <Select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
          >
            <option value="all">All Sentiments</option>
            <option value="positive">Positive (+)</option>
            <option value="neutral">Neutral (0)</option>
            <option value="negative">Negative (-)</option>
          </Select>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" className="w-full" leftIcon={<Filter className="h-4 w-4" />}>
              More Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Structured Feedback Table Shell */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Account & Tier</th>
                <th className="py-3 px-4">Source & ID</th>
                <th className="py-3 px-4">Feedback Excerpt</th>
                <th className="py-3 px-4">Topic Cluster</th>
                <th className="py-3 px-4">Sentiment</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {mockFeedbackItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{item.account}</div>
                    <div className="text-[11px] text-slate-400">{item.tier}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                    <div>{item.source}</div>
                    <div className="text-[10px] text-slate-400">{item.id}</div>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                    <p className="line-clamp-2 text-slate-600 leading-snug">
                      "{item.content}"
                    </p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      <Sparkles className="h-3 w-3 text-indigo-500" />
                      {item.topic}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant={item.sentiment} size="sm" dot>
                      {item.sentimentLabel}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                    {item.date}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Promote to action item">
                        <CheckSquare className="h-3.5 w-3.5 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Options">
                        <MoreHorizontal className="h-3.5 w-3.5 text-slate-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination Scaffolding */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50/50 text-xs text-slate-500 gap-2">
          <div>
            Showing <span className="font-semibold text-slate-800">5</span> of{' '}
            <span className="font-semibold text-slate-800">18</span> items
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
