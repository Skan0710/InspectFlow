import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Sparkles, 
  RotateCw, 
  Calendar,
  Building2,
  Cpu,
  ShieldCheck,
  Users,
  BarChart2,
  FileText,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import { RecommendationModal } from '../components/recommendations/RecommendationModal';
import type { IssueRecommendation } from '../types/recommendations';

interface DynamicActionItem {
  id: string;
  actionIndex: number;
  title: string;
  description: string;
  expectedImpact: string;
  priority: 'danger' | 'warning' | 'indigo' | 'neutral';
  priorityLabel: string;
  status: 'Backlog' | 'In Progress' | 'In Review' | 'Completed';
  assignee: string;
  dueDate: string;
  linkedFeedbackCount: number;
  timeframe: string;
  recommendation: IssueRecommendation;
}

export const ActionCenterPage: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [recommendations, setRecommendations] = useState<IssueRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<IssueRecommendation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/recommendations');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.recommendations)) {
          setRecommendations(data.recommendations);
        }
      }
    } catch (err) {
      console.error('Failed to load recommendations in Action Center:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleGenerateAll = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/recommendations/generate-all', {
        method: 'POST',
      });
      if (res.ok) {
        await fetchRecommendations();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to generate recommendations.');
      }
    } catch (err: any) {
      console.error('Failed to trigger generation:', err);
      alert(err.message || 'Error occurred while generating recommendations.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getPriorityVariant = (tier: string): 'danger' | 'warning' | 'indigo' | 'neutral' => {
    switch (tier.toLowerCase()) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'indigo';
      default:
        return 'neutral';
    }
  };

  // Build dynamic list of action items from real recommendations
  const actionItems: DynamicActionItem[] = recommendations.flatMap((rec) => {
    return rec.recommendedActions.map((action, idx) => ({
      id: `${rec.issueCode}-ACT-${idx + 1}`,
      actionIndex: idx,
      title: action.title,
      description: action.description,
      expectedImpact: action.expectedImpact,
      priority: getPriorityVariant(rec.measuredFacts.priorityTier),
      priorityLabel: `${rec.measuredFacts.priorityTier.toUpperCase()} (${rec.measuredFacts.priorityScore} pts)`,
      status: (idx === 0 ? 'In Progress' : idx === 1 ? 'In Review' : 'Backlog') as any,
      assignee: action.suggestedOwnerTeam,
      dueDate: action.timeframe === 'immediate' ? 'Next Sprint' : action.timeframe === 'short_term' ? '30 Days' : 'Quarterly',
      linkedFeedbackCount: rec.measuredFacts.totalFrequency,
      timeframe: action.timeframe,
      recommendation: rec,
    }));
  });

  const filteredItems = filterStatus === 'all'
    ? actionItems
    : actionItems.filter((a) => a.status.toLowerCase().replace(/\s+/g, '') === filterStatus);

  const getTeamIcon = (team: string) => {
    switch (team) {
      case 'Engineering':
        return <Cpu className="h-3.5 w-3.5" />;
      case 'Trust & Safety':
        return <ShieldCheck className="h-3.5 w-3.5" />;
      case 'Customer Support':
        return <Users className="h-3.5 w-3.5" />;
      default:
        return <BarChart2 className="h-3.5 w-3.5" />;
    }
  };

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
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Sparkles className={`h-4 w-4 text-indigo-600 ${isGenerating ? 'animate-spin' : ''}`} />}
            onClick={handleGenerateAll}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating Initiatives...' : 'Synthesize from High Priority'}
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
            Create Action Item
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { label: 'All Items', value: 'all', count: actionItems.length },
          { label: 'In Progress', value: 'inprogress', count: actionItems.filter((a) => a.status === 'In Progress').length },
          { label: 'In Review', value: 'inreview', count: actionItems.filter((a) => a.status === 'In Review').length },
          { label: 'Backlog', value: 'backlog', count: actionItems.filter((a) => a.status === 'Backlog').length },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterStatus(tab.value)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
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
      {isLoading ? (
        <div className="py-16 text-center">
          <RotateCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm font-medium text-slate-600 mt-3">Loading action initiatives...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center bg-slate-50/50">
          <Sparkles className="h-10 w-10 text-indigo-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No Action Initiatives Found</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto mt-1 mb-4">
            Generate evidence-backed recommendations from your high-priority issue clusters to populate engineering and product work streams.
          </p>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Sparkles className="h-4 w-4" />}
            onClick={handleGenerateAll}
            disabled={isGenerating}
          >
            {isGenerating ? 'Synthesizing...' : 'Generate Recommendations from Issues'}
          </Button>
        </div>
      ) : (
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
                      <span className="font-mono text-xs font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {action.recommendation.issueCode}
                      </span>
                    </div>
                    <CardTitle className="text-base font-semibold text-slate-900">{action.title}</CardTitle>
                  </div>
                </div>

                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {action.description}
                </p>

                {action.expectedImpact && (
                  <div className="mt-2 rounded-md bg-slate-50 border border-slate-200 p-2 text-xs text-slate-700">
                    <span className="font-semibold text-slate-800">Target Outcome: </span>
                    <span>{action.expectedImpact}</span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="pt-2 pb-4">
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    {getTeamIcon(action.assignee)}
                    <span>{action.assignee}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Timeframe: <strong>{action.timeframe.replace('_', ' ')}</strong> ({action.dueDate})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{action.linkedFeedbackCount} customer citations</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="py-3 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase font-bold text-slate-400">Status:</span>
                  <Badge variant="neutral" size="sm">
                    {action.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                    leftIcon={<FileText className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setSelectedRecommendation(action.recommendation);
                      setIsModalOpen(true);
                    }}
                  >
                    Inspect Evidence & Facts
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Shared Evidence-Backed Recommendation Modal */}
      <RecommendationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        recommendation={selectedRecommendation}
      />
    </div>
  );
};
