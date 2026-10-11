import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  RotateCw, 
  ArrowRight, 
  Layers, 
  Search, 
  Quote, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  HelpCircle, 
  Hash, 
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Link } from 'react-router-dom';

interface RepresentativeExample {
  feedbackId: string;
  quote: string;
  relevanceScore: number;
  category: string;
  source?: string;
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
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Expanded cluster members state
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const [clusterMembers, setClusterMembers] = useState<Record<string, MemberDetail[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<string | null>(null);

  // Unmatched modal / view toggle
  const [showUnmatched, setShowUnmatched] = useState<boolean>(false);
  const [unmatchedReviews, setUnmatchedReviews] = useState<any[]>([]);
  const [loadingUnmatched, setLoadingUnmatched] = useState<boolean>(false);

  const fetchClusters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/clusters?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load clusters: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success) {
        setClusters(data.clusters || []);
        setStats(data.stats || null);
      }
    } catch (err: any) {
      console.error('Failed to fetch clusters:', err);
      setError(err.message || 'Failed to connect to clustering service.');
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

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
        throw new Error(`Clustering failed: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.success) {
        await fetchClusters();
      }
    } catch (err: any) {
      console.error('Error triggering clustering:', err);
      setError(err.message || 'Error occurred while clustering reviews.');
    } finally {
      setIsClustering(false);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            AI Insights & Issue Clustering
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Semantic vector clustering groups similar reviews into distinct issues while preserving raw feedback categories.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline" 
            size="sm" 
            leftIcon={<RotateCw className={`h-4 w-4 ${isClustering ? 'animate-spin' : ''}`} />}
            onClick={handleRunClustering}
            disabled={isClustering}
          >
            {isClustering ? 'Clustering...' : 'Re-run Clustering'}
          </Button>
          <Link to="/actions">
            <Button variant="primary" size="sm" leftIcon={<ArrowRight className="h-4 w-4" />}>
              Review Action Queue
            </Button>
          </Link>
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
            <div className="mt-1 text-2xl font-bold text-slate-900">{stats.totalClusters}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Semantically distinct topics</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Layers className="h-4 w-4 text-emerald-600" />
              <span>Clustered Feedback</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{stats.totalFeedbackClustered}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Reviews assigned to clusters</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Hash className="h-4 w-4 text-blue-600" />
              <span>Unique Reports</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{stats.uniqueTextsCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Deduplicated inquiries</div>
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
            <div className="mt-1 text-2xl font-bold text-slate-900">{stats.unmatchedCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Isolated singletons / outliers</div>
          </div>
        </div>
      )}

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
          <span>Vector Engine: <strong>TF-IDF & N-Gram Cosine Clustering</strong></span>
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
            const members = clusterMembers[cluster.id] || [];

            return (
              <Card key={cluster.id} className="transition-all hover:border-slate-300">
                <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getPriorityBadgeVariant(cluster.priority)} size="sm" dot>
                        {cluster.priority.toUpperCase()} PRIORITY
                      </Badge>
                      <Badge variant={getCategoryBadgeVariant(cluster.category)} size="sm">
                        {cluster.category}
                      </Badge>
                      <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {cluster.issueCode}
                      </span>
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
                      {cluster.feedbackCount} feedback items
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {cluster.uniqueTextCount} unique reports
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-1">
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
    </div>
  );
};
