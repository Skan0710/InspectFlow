import type { IssueClusterData, RepresentativeExample, IssueFeedbackLink } from '../services/clustering/types.js';
import type { RawFeedbackRecord } from './import.js';
import type { IssueRecommendation } from '../services/recommendations/types.js';
import type { PriorityScoreBreakdown } from '../services/scoring/types.js';

export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';

export const VALID_ISSUE_STATUSES: IssueStatus[] = ['open', 'in_progress', 'resolved', 'dismissed'];
export const VALID_ISSUE_PRIORITIES: IssuePriority[] = ['critical', 'high', 'medium', 'low'];

export interface IssueNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: string;
  toStatus: IssueStatus | string;
  changedAt: string;
  changedBy?: string;
  reason?: string;
}

export interface IssueQueryFilters {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  savedOnly?: boolean;
  assignee?: string;
  sortBy?: 'priorityScore' | 'feedbackCount' | 'statusUpdatedAt' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface IssueTrackingRecord extends IssueClusterData {
  status: IssueStatus | 'backlog' | 'in_review' | 'completed' | 'cancelled';
  assignee?: string;
  assigneeEmail?: string;
  isSaved?: boolean;
  statusUpdatedAt?: string;
  notes?: IssueNote[];
  statusHistory?: StatusHistoryEntry[];
}

export interface IssueMemberDetail {
  feedback: RawFeedbackRecord;
  link: IssueFeedbackLink;
}

export interface IssueDetailResponse {
  issue: IssueTrackingRecord;
  scoreBreakdown: PriorityScoreBreakdown | null;
  priorityScore: number;
  priorityTier: IssuePriority;
  frequency: number;
  uniqueReports: number;
  duplicateRatio: number;
  negativeSentimentRatio: number;
  members: IssueMemberDetail[];
  recommendation: IssueRecommendation | null;
  notes: IssueNote[];
  statusHistory: StatusHistoryEntry[];
  isSaved: boolean;
  statusUpdatedAt: string;
}
