import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import { 
  Sparkles, 
  RotateCw, 
  Layers, 
  Search, 
  Quote, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  HelpCircle, 
  Hash, 
  Calculator,
  Copy,
  Info,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Link } from 'react-router-dom';
import { RecommendationModal } from '../components/recommendations/RecommendationModal';
import { FlipText } from '../components/ui/flip-text';
import { StatsCounter } from '../components/ui/stats-counter';
import type { IssueRecommendation } from '../types/recommendations';

interface RepresentativeExample {
  feedbackId: string;
  quote: string;
  relevanceScore: number;
  category: string;
  source?: string;
}

interface PriorityComponents {
  frequencyScore: number;
  frequencyWeight: number;
  frequencyPoints: number;
  totalMentions: number;
  uniqueReports: number;
  duplicateCount: number;
  duplicateRatio: number;

  severityScore: number;
  severityWeight: number;
  severityPoints: number;
  rawAverageSeverity: number;
  severityCount: number;

  negativeSentimentRatio: number;
  negativeSentimentWeight: number;
  negativeSentimentPoints: number;
  negativeCount: number;
  analyzedCount: number;
}

interface ScoreBreakdown {
  score: number;
  tier: 'critical' | 'high' | 'medium' | 'low';
  components: PriorityComponents;
  formula: string;
  algorithmVersion: string;
  summary: string;
  disclaimer: string;
  calculatedAt: string;
}

interface IssueCluster {
  id: string;
  issueCode: string;
  title: string;
  description: string;
  category: string;
  status: 'backlog' | 'in_progress' | 'in_review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  impactSummary: string;
  feedbackCount: number;
  uniqueTextCount: number;
  representativeExamples: RepresentativeExample[];
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  avgConfidence: number;
  memberFeedbackIds: string[];
  metadata?: {
    priorityScore?: number;
    priorityTier?: string;
    scoreBreakdown?: ScoreBreakdown;
    algorithmVersion?: string;
    disclaimer?: string;
    totalMentions?: number;
    uniqueReports?: number;
    duplicateRatio?: number;
  };
  createdAt: string;
}

interface ClusteringStats {
  totalClusters: number;
  totalFeedbackClustered: number;
  unmatchedCount: number;
  evaluatedTotal: number;
  uniqueTextsCount: number;
}

interface MemberDetail {
  feedback: {
    id: string;
    review: string;
    category: string;
    source: string;
    importedAt: string;
  };
  link: {
    relevanceScore: number;
    citationQuote: string;
  };
}

export const InsightsPage: React.FC = () => {
  const [clusters, setClusters] = useState<IssueCluster[]>([]);
  const [stats, setStats] = useState<ClusteringStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isClustering, setIsClustering] = useState<boolean>(false);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Expanded cluster members & score breakdown state
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const [expandedScoreId, setExpandedScoreId] = useState<string | null>(null);
  const [clusterMembers, setClusterMembers] = useState<Record<string, MemberDetail[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<string | null>(null);

  // Unmatched modal / view toggle
  const [showUnmatched, setShowUnmatched] = useState<boolean>(false);
  const [unmatchedReviews, setUnmatchedReviews] = useState<any[]>([]);
  const [loadingUnmatched, setLoadingUnmatched] = useState<boolean>(false);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<Record<string, IssueRecommendation>>({});
  const [selectedRecommendation, setSelectedRecommendation] = useState<IssueRecommendation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [generatingRecIds, setGeneratingRecIds] = useState<Record<string, boolean>>({});
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);

  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const latestClusterRequestRef = useRef(0);

  const fetchClusters = useCallback(async () => {
    const requestId = ++latestClusterRequestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());

      const res = await fetch(`/api/clusters?${params.toString()}`);
      if (requestId !== latestClusterRequestRef.current) return;
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Failed to load clusters (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (requestId !== latestClusterRequestRef.current) return;
      if (data.success) {
        setClusters(data.clusters || []);
        setStats(data.stats || null);
      }
    } catch (err: any) {
      if (requestId !== latestClusterRequestRef.current) return;
      console.error('Failed to fetch clusters:', err);
      setError(err.message || 'Failed to connect to clustering service.');
    } finally {
      if (requestId === latestClusterRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [categoryFilter, priorityFilter, debouncedSearch]);

  const fetchRecommendations = useCallback(async () => {
    try {
      const res = await fetch('/api/recommendations');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.recommendations)) {
          const map: Record<string, IssueRecommendation> = {};
          for (const rec of data.recommendations) {
            map[rec.issueId] = rec;
          }
          setRecommendations(map);
        }
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    }
  }, []);

  useEffect(() => {
    fetchClusters();
    fetchRecommendations();
  }, [fetchClusters, fetchRecommendations]);

  const handleRunClustering = async () => {
    setIsClustering(true);
    setError(null);
    try {
      const res = await fetch('/api/clusters/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          similarityThreshold: 0.35,
          minClusterSize: 2,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Clustering failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (data.success) {
        // Previous run's members / unmatched list no longer describe the current issues
        setClusterMembers({});
        setUnmatchedReviews([]);
        setExpandedClusterId(null);
        await fetchClusters();
        await fetchRecommendations();
      }
    } catch (err: any) {
      console.error('Error triggering clustering:', err);
      setError(err.message || 'Error occurred while clustering reviews.');
    } finally {
      setIsClustering(false);
    }
  };

  const handleRecalculateScores = async () => {
    setIsRecalculating(true);
    setError(null);
    try {
      const res = await fetch('/api/scoring/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Recalculation failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (data.success) {
        await fetchClusters();
      }
    } catch (err: any) {
      console.error('Error recalculating scores:', err);
      setError(err.message || 'Error occurred while recalculating priority scores.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleGenerateRecommendation = async (issueId: string) => {
    setGeneratingRecIds((prev) => ({ ...prev, [issueId]: true }));
    try {
      const res = await fetch(`/api/recommendations/generate/${issueId}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `Generation failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.success && data.recommendation) {
        setRecommendations((prev) => ({
          ...prev,
          [issueId]: data.recommendation,
        }));
        setSelectedRecommendation(data.recommendation);
        setIsModalOpen(true);
      }
    } catch (err: any) {
      console.error('Error generating recommendation:', err);
      alert(err.message || 'Failed to generate recommendation.');
    } finally {
      setGeneratingRecIds((prev) => ({ ...prev, [issueId]: false }));
    }
  };

  const handleGenerateAllHighPriority = async () => {
    setIsBatchGenerating(true);
    try {
      const res = await fetch('/api/recommendations/generate-all', {
        method: 'POST',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `Batch generation failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.recommendations)) {
        setRecommendations((prev) => {
          const map: Record<string, IssueRecommendation> = { ...prev };
          for (const rec of data.recommendations) {
            map[rec.issueId] = rec;
          }
          return map;
        });
      }
    } catch (err: any) {
      console.error('Error generating recommendations for high-priority issues:', err);
      alert(err.message || 'Failed to generate recommendations for high-priority issues.');
    } finally {
      setIsBatchGenerating(false);
    }
  };

  const toggleExpandCluster = async (clusterId: string) => {
    if (expandedClusterId === clusterId) {
      setExpandedClusterId(null);
      return;
    }

    setExpandedClusterId(clusterId);
    if (!clusterMembers[clusterId]) {
      setLoadingMembers(clusterId);
      try {
        const res = await fetch(`/api/clusters/${clusterId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.members) {
            setClusterMembers((prev) => ({ ...prev, [clusterId]: data.members }));
          }
        }
      } catch (err) {
        console.error('Failed to load cluster members:', err);
      } finally {
        setLoadingMembers(null);
      }
    }
  };

  const toggleExpandScore = (clusterId: string) => {
    setExpandedScoreId(expandedScoreId === clusterId ? null : clusterId);
  };

  const handleLoadUnmatched = async () => {
    setShowUnmatched(!showUnmatched);
    if (!showUnmatched && unmatchedReviews.length === 0) {
      setLoadingUnmatched(true);
      try {
        const res = await fetch('/api/clusters/unmatched/list');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setUnmatchedReviews(data.unmatched || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch unmatched reviews:', err);
      } finally {
        setLoadingUnmatched(false);
      }
    }
  };

  const getPriorityBadgeVariant = (priority: string): 'danger' | 'warning' | 'indigo' | 'neutral' => {
    switch (priority) {
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

  const getCategoryBadgeVariant = (category: string): 'indigo' | 'neutral' | 'warning' | 'danger' => {
    switch (category) {
      case 'Product Feedback':
        return 'indigo';
      case 'Customer Service':
        return 'neutral';
      case 'Operational Issues':
        return 'warning';
      case 'Fraud and Scam':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 page-header">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Customer</span>
            <FlipText className="text-indigo-300">
              AI Insights Radar
            </FlipText>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Deterministic issue-priority scoring calculated from actual frequency, severity, and negative sentiment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button 
            variant="outline" 
            size="sm" 
            leftIcon={<Calculator className={`h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />}
            onClick={handleRecalculateScores}
            disabled={isRecalculating || isClustering}
          >
            {isRecalculating ? 'Recalculating...' : 'Recalculate Scores'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            leftIcon={<RotateCw className={`h-4 w-4 ${isClustering ? 'animate-spin' : ''}`} />}
            onClick={handleRunClustering}
            disabled={isClustering || isRecalculating}
          >
            {isClustering ? 'Clustering...' : 'Re-run Clustering'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Sparkles className={`h-4 w-4 text-indigo-600 ${isBatchGenerating ? 'animate-spin' : ''}`} />}
            onClick={handleGenerateAllHighPriority}
            disabled={isBatchGenerating || isClustering || isRecalculating}
          >
            {isBatchGenerating ? 'Generating Recs...' : 'Generate High-Priority Recommendations'}
          </Button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span>Issue Clusters</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              <StatsCounter value={stats.totalClusters} />
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Semantically distinct topics</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Layers className="h-4 w-4 text-emerald-600" />
              <span>Total Feedback Volume</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              <StatsCounter value={stats.totalFeedbackClustered} />
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Reviews assigned to clusters</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Hash className="h-4 w-4 text-blue-600" />
              <span>Unique Inquiries</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              <StatsCounter value={stats.uniqueTextsCount} />
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Deduplicated reports (exposing repeats)</div>
          </div>
          <div 
            className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs cursor-pointer hover:border-slate-300 transition-colors"
            onClick={handleLoadUnmatched}
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-amber-500" />
                <span>Unmatched Outliers</span>
              </div>
              <span className="text-[11px] text-indigo-600 hover:underline">
                {showUnmatched ? 'Hide' : 'View'}
              </span>
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              <StatsCounter value={stats.unmatchedCount} />
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Isolated singletons / outliers</div>
          </div>
        </div>
      )}

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calculator className="h-4 w-4 text-indigo-600 shrink-0" />
          <span>Priority Model: <strong>Priority = 100 × (0.40 × F + 0.35 × S + 0.25 × N)</strong></span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="w-full sm:w-56">
            <Input 
              type="text" 
              placeholder="Search cluster topics..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4 text-slate-400" />}
            />
          </div>
          <div className="w-36">
            <Select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="Product Feedback">Product Feedback</option>
              <option value="Customer Service">Customer Service</option>
              <option value="Operational Issues">Operational Issues</option>
              <option value="Fraud and Scam">Fraud and Scam</option>
            </Select>
          </div>
          <div className="w-32">
            <Select 
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priority</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Unmatched Outliers Panel (if toggled) */}
      {showUnmatched && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-base text-amber-900">
                  Unmatched Reviews & Low-Confidence Assignments ({unmatchedReviews.length})
                </CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowUnmatched(false)}>
                Close
              </Button>
            </div>
            <CardDescription className="text-amber-800 text-xs">
              These customer feedback items did not meet the similarity threshold with other reviews. They are isolated as singletons to prevent inaccurate cluster associations.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {loadingUnmatched ? (
              <div className="py-6 text-center text-xs text-amber-700">Loading unmatched items...</div>
            ) : unmatchedReviews.length === 0 ? (
              <div className="py-4 text-center text-xs text-amber-700">No unmatched outliers present.</div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {unmatchedReviews.slice(0, 15).map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-white border border-amber-200 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="neutral" size="sm">{item.category}</Badge>
                      <span className="text-[11px] font-mono text-slate-400">Score: {item.bestSimilarityScore} ({item.reason})</span>
                    </div>
                    <p className="text-slate-700 italic">"{item.text}"</p>
                  </div>
                ))}
                {unmatchedReviews.length > 15 && (
                  <p className="text-center text-xs text-slate-500 py-1">
                    + {unmatchedReviews.length - 15} more isolated outliers
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchClusters}>
            Retry
          </Button>
        </div>
      )}

      {/* Main Content: Clusters List or Empty State */}
      {isLoading ? (
        <div className="py-16 text-center">
          <RotateCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm font-medium text-slate-600 mt-3">Loading discovered issue clusters...</p>
        </div>
      ) : clusters.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-10 w-10 text-indigo-500" />}
          title="No Issue Clusters Discovered Yet"
          description="Group customer feedback into semantic clusters to identify systemic friction, trends, and product initiatives."
          action={
            <Button 
              variant="primary" 
              leftIcon={<RotateCw className={`h-4 w-4 ${isClustering ? 'animate-spin' : ''}`} />}
              onClick={handleRunClustering}
              disabled={isClustering}
            >
              {isClustering ? 'Clustering in progress...' : 'Run Issue Clustering'}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {clusters.map((cluster) => {
            const isExpanded = expandedClusterId === cluster.id;
            const isScoreExpanded = expandedScoreId === cluster.id;
            const members = clusterMembers[cluster.id] || [];
            const breakdown = cluster.metadata?.scoreBreakdown;
            const priorityScore = cluster.metadata?.priorityScore !== undefined 
              ? cluster.metadata.priorityScore 
              : null;
            
            const duplicateRatio = cluster.metadata?.duplicateRatio ?? 
              (cluster.feedbackCount > 0 ? (cluster.feedbackCount - cluster.uniqueTextCount) / cluster.feedbackCount : 0);

            return (
              <Card key={cluster.id} className="transition-all hover:border-slate-300">
                <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getPriorityBadgeVariant(cluster.priority)} size="sm" dot>
                        {cluster.priority.toUpperCase()} PRIORITY
                      </Badge>
                      {priorityScore !== null && (
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Score: {priorityScore} / 100
                        </span>
                      )}
                      <Badge variant={getCategoryBadgeVariant(cluster.category)} size="sm">
                        {cluster.category}
                      </Badge>
                      <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {cluster.issueCode}
                      </span>
                      {duplicateRatio > 0.4 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          <Copy className="h-3 w-3" />
                          {Math.round(duplicateRatio * 100)}% duplicate text
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                      {cluster.title}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-slate-600">
                      {cluster.description}
                    </CardDescription>
                  </div>

                  <div className="flex sm:flex-col items-end gap-1.5 shrink-0 text-right">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                      <Layers className="h-3.5 w-3.5 text-indigo-600" />
                      {cluster.feedbackCount} total mentions
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {cluster.uniqueTextCount} unique inquiries
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-1">
                  {/* Score Breakdown Section Toggle */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-xs">
                    <div 
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => toggleExpandScore(cluster.id)}
                    >
                      <div className="flex items-center gap-1.5 font-medium text-slate-700">
                        <Calculator className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Score Breakdown: <strong>{priorityScore !== null ? `${priorityScore} pts` : 'Calculated on demand'}</strong></span>
                        <span className="text-slate-400 text-[11px]">(Formula: 100 × [0.40×F + 0.35×S + 0.25×N])</span>
                      </div>
                      <span className="text-indigo-600 font-semibold inline-flex items-center gap-1">
                        {isScoreExpanded ? <>Hide Details <ChevronUp className="h-3 w-3" /></> : <>Inspect Formula <ChevronDown className="h-3 w-3" /></>}
                      </span>
                    </div>

                    {isScoreExpanded && breakdown && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2.5 text-slate-700">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="rounded-md bg-white p-2 border border-slate-200">
                            <div className="font-semibold text-slate-900">Frequency (F = 40%)</div>
                            <div className="text-lg font-bold text-indigo-600">+{breakdown.components.frequencyPoints} pts</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              F = {breakdown.components.frequencyScore} ({breakdown.components.totalMentions} mentions, {breakdown.components.uniqueReports} unique)
                            </div>
                          </div>
                          <div className="rounded-md bg-white p-2 border border-slate-200">
                            <div className="font-semibold text-slate-900">Severity (S = 35%)</div>
                            <div className="text-lg font-bold text-indigo-600">+{breakdown.components.severityPoints} pts</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              S = {breakdown.components.severityScore} (avg {breakdown.components.rawAverageSeverity} / 5 scale)
                            </div>
                          </div>
                          <div className="rounded-md bg-white p-2 border border-slate-200">
                            <div className="font-semibold text-slate-900">Negative Sentiment (N = 25%)</div>
                            <div className="text-lg font-bold text-indigo-600">+{breakdown.components.negativeSentimentPoints} pts</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              N = {breakdown.components.negativeSentimentRatio} ({Math.round(breakdown.components.negativeSentimentRatio * 100)}% negative)
                            </div>
                          </div>
                        </div>

                        {/* Explicit Non-Financial Risk Disclaimer */}
                        <div className="rounded-md bg-blue-50/70 border border-blue-200 p-2 text-[11px] text-blue-900 flex items-start gap-1.5">
                          <Info className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Operational Heuristic Disclaimer: </strong>
                            {breakdown.disclaimer}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Representative Feedback Citations */}
                  {cluster.representativeExamples && cluster.representativeExamples.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Quote className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Representative Evidence:</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {cluster.representativeExamples.map((example, idx) => (
                          <div 
                            key={idx}
                            className="rounded-lg border-l-2 border-indigo-500 bg-slate-50 p-3 text-xs text-slate-700 flex flex-col justify-between"
                          >
                            <p className="italic">"{example.quote}"</p>
                            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                              <span>Source: {example.source || 'Customer Support'}</span>
                              <span className="font-mono font-medium text-indigo-600">
                                Match: {Math.round(example.relevanceScore * 100)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Impact Summary Banner */}
                  <div className="rounded-lg bg-indigo-50/50 border border-indigo-100 p-2.5 text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-indigo-900">Impact Assessment: </span>
                      <span>{cluster.impactSummary}</span>
                    </div>
                    <Link to="/actions">
                      <Button variant="primary" size="sm" className="shrink-0 text-xs py-1 px-3">
                        Convert to Initiative
                      </Button>
                    </Link>
                  </div>

                  {/* Evidence-Backed AI Recommendations Section */}
                  <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-900">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            <span>Evidence-Backed Recommendations</span>
                          </div>
                          {recommendations[cluster.id] ? (
                            <Badge variant={recommendations[cluster.id].isFallback ? 'neutral' : 'indigo'} size="sm">
                              {recommendations[cluster.id].isFallback ? 'Deterministic Fallback' : 'AI Grounded'}
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              Not Generated
                            </Badge>
                          )}
                          {recommendations[cluster.id]?.suggestedTeam && (
                            <span className="text-[11px] font-medium text-slate-500">
                              Lead: <strong className="text-slate-700">{recommendations[cluster.id].suggestedTeam}</strong>
                            </span>
                          )}
                        </div>
                        {recommendations[cluster.id] ? (
                          <p className="text-xs text-slate-600 line-clamp-1">
                            <strong className="text-slate-800">{recommendations[cluster.id].recommendedActions.length} actions:</strong>{' '}
                            {recommendations[cluster.id].issueSummary}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Synthesize grounded next steps, root-cause context, and verbatim citations for this issue.
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {recommendations[cluster.id] ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8 font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                              onClick={() => {
                                setSelectedRecommendation(recommendations[cluster.id]);
                                setIsModalOpen(true);
                              }}
                            >
                              Inspect Recommendations ({recommendations[cluster.id].recommendedActions.length})
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-8 text-slate-500 hover:text-indigo-600"
                              disabled={generatingRecIds[cluster.id]}
                              onClick={() => handleGenerateRecommendation(cluster.id)}
                              title="Regenerate recommendation"
                            >
                              <RotateCw className={`h-3.5 w-3.5 ${generatingRecIds[cluster.id] ? 'animate-spin' : ''}`} />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-xs h-8"
                            leftIcon={<Sparkles className={`h-3.5 w-3.5 ${generatingRecIds[cluster.id] ? 'animate-spin' : ''}`} />}
                            disabled={generatingRecIds[cluster.id]}
                            onClick={() => handleGenerateRecommendation(cluster.id)}
                          >
                            {generatingRecIds[cluster.id] ? 'Analyzing Evidence...' : 'Generate Recommendation'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Member Feedback Drawer */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                        <span>All Linked Feedback Members ({cluster.feedbackCount}):</span>
                        <span className="font-mono text-[11px] text-slate-400">Stable IDs linked in issue_feedback</span>
                      </div>

                      {loadingMembers === cluster.id ? (
                        <div className="py-4 text-center text-xs text-slate-500">Loading member reviews...</div>
                      ) : members.length === 0 ? (
                        <div className="py-2 text-center text-xs text-slate-500">No member details loaded.</div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                          {members.map((m, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs space-y-1">
                              <div className="flex items-center justify-between text-[11px] text-slate-400">
                                <span className="font-mono">ID: {m.feedback.id.slice(0, 8)}...</span>
                                <Badge variant="neutral" size="sm">{m.feedback.category}</Badge>
                              </div>
                              <p className="text-slate-800">{m.feedback.review}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <span>
                      Confidence: <strong>{Math.round(cluster.avgConfidence * 100)}%</strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      Sentiment Profile:{' '}
                      <strong>
                        {cluster.sentimentBreakdown.negative > 0
                          ? `${cluster.sentimentBreakdown.negative} Negative`
                          : 'Neutral / General'}
                      </strong>
                    </span>
                  </div>
                  <div>
                    <button 
                      onClick={() => toggleExpandCluster(cluster.id)}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer inline-flex items-center gap-1"
                    >
                      {isExpanded ? (
                        <>Hide Member Reviews <ChevronUp className="h-3.5 w-3.5" /></>
                      ) : (
                        <>Inspect All {cluster.feedbackCount} Linked Reviews <ChevronDown className="h-3.5 w-3.5" /></>
                      )}
                    </button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Evidence-Backed Recommendations Modal */}
      <RecommendationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        recommendation={selectedRecommendation}
        onRegenerate={async (issueId) => {
          await handleGenerateRecommendation(issueId);
        }}
        isRegenerating={selectedRecommendation ? Boolean(generatingRecIds[selectedRecommendation.issueId]) : false}
      />
    </div>
  );
};
