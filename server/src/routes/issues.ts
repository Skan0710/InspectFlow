import { Router, type Request, type Response } from 'express';
import { FeedbackStore } from '../services/feedbackStore.js';
import {
  VALID_ISSUE_STATUSES,
  VALID_ISSUE_PRIORITIES,
  type IssueStatus,
  type IssuePriority,
} from '../types/issues.js';

const router = Router();
const store = FeedbackStore.getInstance();

/**
 * GET /api/issues
 * Returns a ranked queue of issues with priority scores, tiers, frequency, negative sentiment ratio,
 * status, assignee, and filter metrics.
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const {
      status,
      priority,
      category,
      search,
      savedOnly,
      assignee,
      sortBy,
      sortOrder,
    } = req.query as {
      status?: string;
      priority?: string;
      category?: string;
      search?: string;
      savedOnly?: string;
      assignee?: string;
      sortBy?: any;
      sortOrder?: any;
    };

    // Validate status parameter if provided
    if (status && status !== 'all') {
      const normalizedStatus = status.toLowerCase().trim();
      const allowed = [...VALID_ISSUE_STATUSES, 'backlog', 'completed', 'cancelled'];
      if (!allowed.includes(normalizedStatus as any)) {
        res.status(400).json({
          error: 'ValidationError',
          message: `Invalid status filter '${status}'. Must be one of: ${VALID_ISSUE_STATUSES.join(', ')}, all.`,
        });
        return;
      }
    }

    // Validate priority parameter if provided
    if (priority && priority !== 'all') {
      const normalizedPriority = priority.toLowerCase().trim();
      if (!VALID_ISSUE_PRIORITIES.includes(normalizedPriority as any)) {
        res.status(400).json({
          error: 'ValidationError',
          message: `Invalid priority filter '${priority}'. Must be one of: ${VALID_ISSUE_PRIORITIES.join(', ')}, all.`,
        });
        return;
      }
    }

    const issues = store.getAllIssues({
      status,
      priority,
      category,
      search,
      savedOnly: savedOnly === 'true' || savedOnly === '1',
      assignee,
      sortBy,
      sortOrder,
    });

    // Compute status counts across all issues
    const allIssues = store.getAllIssues();
    const statusSummary = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      dismissed: 0,
      saved: 0,
    };

    for (const issue of allIssues) {
      const st = (issue.status || 'open').toLowerCase();
      if (st === 'open' || st === 'backlog') statusSummary.open++;
      else if (st === 'in_progress' || st === 'in_review') statusSummary.in_progress++;
      else if (st === 'resolved' || st === 'completed') statusSummary.resolved++;
      else if (st === 'dismissed' || st === 'cancelled') statusSummary.dismissed++;
      else statusSummary.open++;

      if (issue.isSaved) {
        statusSummary.saved++;
      }
    }

    res.status(200).json({
      success: true,
      count: issues.length,
      issues,
      statusSummary,
      openIssuesCount: statusSummary.open + statusSummary.in_progress,
    });
  } catch (err: any) {
    console.error('[Issues API] Error listing issues:', err);
    res.status(500).json({
      error: 'RetrievalError',
      message: err.message || 'Failed to retrieve issues.',
    });
  }
});

/**
 * GET /api/issues/:id
 * Returns complete issue detail view including score breakdown, citations, status history, notes, and AI recommendation.
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const detail = store.getIssueDetail(id);

    if (!detail) {
      res.status(404).json({
        error: 'NotFound',
        message: `Issue with id '${id}' not found.`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      ...detail,
    });
  } catch (err: any) {
    console.error('[Issues API] Error getting issue detail:', err);
    res.status(500).json({
      error: 'RetrievalError',
      message: err.message || 'Failed to retrieve issue details.',
    });
  }
});

/**
 * PATCH /api/issues/:id/status
 * Updates an issue's status with history recording and status update timestamp.
 */
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, note, reason, changedBy } = req.body || {};

    if (!status || typeof status !== 'string') {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Status is required and must be a string.',
      });
      return;
    }

    const normalizedStatus = status.toLowerCase().trim() as IssueStatus;
    if (!VALID_ISSUE_STATUSES.includes(normalizedStatus)) {
      res.status(400).json({
        error: 'ValidationError',
        message: `Invalid status '${status}'. Must be one of: ${VALID_ISSUE_STATUSES.join(', ')}.`,
      });
      return;
    }

    const updated = await store.updateIssueStatus(id, normalizedStatus, {
      changedBy,
      reason,
      note,
    });

    res.status(200).json({
      success: true,
      message: `Issue status updated to '${normalizedStatus}'.`,
      issue: updated,
    });
  } catch (err: any) {
    console.error('[Issues API] Error updating status:', err);
    const statusCode = err.message?.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      error: 'StatusUpdateError',
      message: err.message || 'Failed to update issue status.',
    });
  }
});

/**
 * PATCH /api/issues/:id/assignee
 * Assigns an owner to an issue.
 */
router.patch('/:id/assignee', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assignee, assigneeEmail } = req.body || {};

    if (assignee !== null && assignee !== undefined && typeof assignee !== 'string') {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Assignee must be a string or null.',
      });
      return;
    }

    const updated = await store.updateIssueAssignee(id, assignee, assigneeEmail);

    res.status(200).json({
      success: true,
      message: assignee ? `Issue assigned to '${assignee}'.` : 'Issue unassigned.',
      issue: updated,
    });
  } catch (err: any) {
    console.error('[Issues API] Error updating assignee:', err);
    const statusCode = err.message?.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      error: 'AssigneeUpdateError',
      message: err.message || 'Failed to update issue assignee.',
    });
  }
});

/**
 * PATCH /api/issues/:id/save
 * Toggles or sets bookmark/saved state for an issue.
 */
router.patch('/:id/save', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isSaved } = req.body || {};

    if (isSaved !== undefined && typeof isSaved !== 'boolean') {
      res.status(400).json({
        error: 'ValidationError',
        message: 'isSaved must be a boolean.',
      });
      return;
    }

    const updated = await store.toggleIssueSaved(id, isSaved);

    res.status(200).json({
      success: true,
      message: updated.isSaved ? 'Issue marked as saved.' : 'Issue removed from saved.',
      issue: updated,
    });
  } catch (err: any) {
    console.error('[Issues API] Error toggling saved state:', err);
    const statusCode = err.message?.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      error: 'SaveUpdateError',
      message: err.message || 'Failed to toggle saved state.',
    });
  }
});

/**
 * POST /api/issues/:id/notes
 * Adds an internal note to an issue.
 */
router.post('/:id/notes', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, author } = req.body || {};

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Note content is required and cannot be empty.',
      });
      return;
    }

    const updated = await store.addIssueNote(id, { content, author });

    res.status(201).json({
      success: true,
      message: 'Internal note added successfully.',
      issue: updated,
      notes: updated.notes,
    });
  } catch (err: any) {
    console.error('[Issues API] Error adding note:', err);
    const statusCode = err.message?.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      error: 'NoteCreationError',
      message: err.message || 'Failed to add internal note.',
    });
  }
});

/**
 * PATCH /api/issues/:id
 * Performs an atomic batch update of multiple related issue properties.
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      status,
      assignee,
      assigneeEmail,
      isSaved,
      note,
      changedBy,
      reason,
    } = req.body || {};

    if (status !== undefined) {
      const normalizedStatus = String(status).toLowerCase().trim() as IssueStatus;
      if (!VALID_ISSUE_STATUSES.includes(normalizedStatus)) {
        res.status(400).json({
          error: 'ValidationError',
          message: `Invalid status '${status}'. Must be one of: ${VALID_ISSUE_STATUSES.join(', ')}.`,
        });
        return;
      }
    }

    if (isSaved !== undefined && typeof isSaved !== 'boolean') {
      res.status(400).json({
        error: 'ValidationError',
        message: 'isSaved must be a boolean.',
      });
      return;
    }

    // The store expects a structured note; accept a plain string for convenience
    const normalizedNote =
      typeof note === 'string'
        ? { content: note, author: changedBy }
        : note && typeof note === 'object'
          ? { content: String(note.content ?? ''), author: note.author ?? changedBy }
          : undefined;

    const updated = await store.updateIssue(id, {
      status: status !== undefined ? (String(status).toLowerCase().trim() as IssueStatus) : undefined,
      assignee,
      assigneeEmail,
      isSaved,
      note: normalizedNote,
      changedBy,
      reason,
    });

    res.status(200).json({
      success: true,
      message: 'Issue updated successfully.',
      issue: updated,
    });
  } catch (err: any) {
    console.error('[Issues API] Error updating issue:', err);
    const statusCode = err.message?.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      error: 'UpdateError',
      message: err.message || 'Failed to update issue.',
    });
  }
});

export default router;
