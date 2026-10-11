import React from 'react';
import { 
  Download, 
  Calendar, 
  Send, 
  Plus, 
  Clock, 
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';

const mockReports = [
  {
    id: 'REP-2026-W41',
    title: 'Weekly Executive Voice-of-Customer Digest',
    description: 'Executive overview summarizing major shifts in net sentiment, top 3 friction topics, and resolution speed.',
    cadence: 'Every Monday at 08:00 UTC',
    format: 'Executive PDF + Slack Channel',
    lastRun: 'Oct 06, 2026',
    status: 'Scheduled',
    recipients: 'leadership-team@acme.corp',
  },
  {
    id: 'REP-2026-Q3',
    title: 'Q3 Enterprise Product Friction Root-Cause Analysis',
    description: 'Comprehensive thematic audit across 1,200+ Zendesk tickets and Gong sales calls detailing security requirements.',
    cadence: 'Quarterly Audit',
    format: 'Markdown + Raw CSV Dataset',
    lastRun: 'Oct 01, 2026',
    status: 'Generated',
    recipients: 'product-ops@acme.corp',
  },
  {
    id: 'REP-2026-CHURN',
    title: 'Early Warning Churn Risk Radar',
    description: 'Real-time alert digest flagging accounts with a net negative sentiment drop exceeding 20 points over 14 days.',
    cadence: 'Real-time Event Trigger',
    format: 'Webhook Event to Salesforce',
    lastRun: 'Oct 10, 2026',
    status: 'Active Monitoring',
    recipients: 'cs-leaders@acme.corp',
  },
];

export const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Reports & Intelligence Digests
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Automated executive briefings, custom cross-channel summaries, and scheduled data exports.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
            Generate Custom Report
          </Button>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {mockReports.map((report) => (
          <Card key={report.id} className="hover:border-slate-300 transition-colors">
            <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="indigo" size="sm">
                    {report.format}
                  </Badge>
                  <span className="font-mono text-xs text-slate-400">{report.id}</span>
                </div>
                <CardTitle className="text-base sm:text-lg">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </div>

              <Badge variant="neutral" size="sm" dot>
                {report.status}
              </Badge>
            </CardHeader>

            <CardContent className="pt-1 pb-3 text-xs text-slate-600">
              <div className="grid gap-2 sm:grid-cols-3 rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Cadence: <strong>{report.cadence}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Last Generated: <strong>{report.lastRun}</strong></span>
                </div>
                <div className="flex items-center gap-2 truncate">
                  <Send className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Recipients: <strong>{report.recipients}</strong></span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="py-3">
              <span className="text-xs text-slate-400 font-mono">SOC2 Compliant Delivery</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}>
                  Download Asset
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<Send className="h-3.5 w-3.5" />}>
                  Dispatch Now
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};
