import React, { useState } from 'react';
import { 
  Plus, 
  User, 
  MoreVertical, 
  Calendar,
  Building2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';

interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'danger' | 'warning' | 'indigo' | 'neutral';
  priorityLabel: string;
  status: 'Backlog' | 'In Progress' | 'In Review' | 'Completed';
  assignee: string;
  dueDate: string;
  linkedFeedbackCount: number;
}

const mockActions: ActionItem[] = [
  {
    id: 'ACT-301',
    title: 'Audit Log Export Automation via S3 Bucket',
    description: 'Build backend lambda scheduled task to dump daily encrypted audit logs to customer storage.',
    priority: 'danger',
    priorityLabel: 'P0 - Blocker',
    status: 'In Progress',
    assignee: 'Sarah Lin',
    dueDate: 'Oct 18, 2026',
    linkedFeedbackCount: 14,
  },
  {
    id: 'ACT-302',
    title: 'Patch SCIM v2 Group Reconciliation Endpoint',
    description: 'Ensure group memberships are updated idempotently without revoking directory security claims.',
    priority: 'warning',
    priorityLabel: 'P1 - Urgent',
    status: 'In Progress',
    assignee: 'Marcus Vance',
    dueDate: 'Oct 22, 2026',
    linkedFeedbackCount: 9,
  },
  {
    id: 'ACT-303',
    title: 'Itemized Invoice Telemetry Breakdown in Portal',
    description: 'Expose monthly line items per workspace to eliminate enterprise procurement friction.',
    priority: 'indigo',
    priorityLabel: 'P2 - High',
    status: 'In Review',
    assignee: 'Elena Rostova',
    dueDate: 'Oct 25, 2026',
    linkedFeedbackCount: 22,
  },
  {
    id: 'ACT-304',
    title: 'Customer Success CSAT Follow-up Workflow',
    description: 'Trigger automatic Slack alert to CS manager when an enterprise score dips below 7/10.',
    priority: 'neutral',
    priorityLabel: 'P3 - Normal',
    status: 'Backlog',
    assignee: 'Devon Miles',
    dueDate: 'Nov 02, 2026',
    linkedFeedbackCount: 5,
  },
];

export const ActionCenterPage: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredItems = filterStatus === 'all'
    ? mockActions
    : mockActions.filter((a) => a.status.toLowerCase().replace(/\s+/g, '') === filterStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Action Center & Initiatives
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Turn customer feedback into structured engineering and product initiatives with traceable citations.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
            Create Action Item
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { label: 'All Items', value: 'all', count: mockActions.length },
          { label: 'In Progress', value: 'inprogress', count: 2 },
          { label: 'In Review', value: 'inreview', count: 1 },
          { label: 'Backlog', value: 'backlog', count: 1 },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterStatus(tab.value)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filterStatus === tab.value
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                filterStatus === tab.value
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Action Item Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredItems.map((action) => (
          <Card key={action.id} className="flex flex-col justify-between hover:border-slate-300 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={action.priority} size="sm">
                      {action.priorityLabel}
                    </Badge>
                    <span className="font-mono text-xs text-slate-400">{action.id}</span>
                  </div>
                  <CardTitle className="text-base font-semibold">{action.title}</CardTitle>
                </div>
                <button
                  aria-label="Action options"
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                {action.description}
              </p>
            </CardHeader>

            <CardContent className="pt-2 pb-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium text-slate-700">{action.assignee}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Due {action.dueDate}</span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{action.linkedFeedbackCount} customer citations</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="py-3 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase font-bold text-slate-400">Status:</span>
                <span className="font-semibold text-slate-800 text-xs">{action.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  Update State
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};
