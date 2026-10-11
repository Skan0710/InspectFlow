-- ========================================================================
-- InsightFlow: Action Center & Persistent Issue Tracking Migration
-- Migration: 002_action_center_issue_tracking.sql
-- ========================================================================

-- 1. Expand status constraint to explicitly support 'open', 'in_progress', 'resolved', 'dismissed'
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;

ALTER TABLE issues ADD CONSTRAINT issues_status_check CHECK (
  status IN ('open', 'in_progress', 'resolved', 'dismissed', 'backlog', 'in_review', 'completed', 'cancelled')
);

-- Set default status to 'open'
ALTER TABLE issues ALTER COLUMN status SET DEFAULT 'open';

-- Normalize existing status values
UPDATE issues SET status = 'open' WHERE status = 'backlog';
UPDATE issues SET status = 'resolved' WHERE status = 'completed';
UPDATE issues SET status = 'dismissed' WHERE status = 'cancelled';

-- 2. Add issue tracking columns for Action Center
ALTER TABLE issues ADD COLUMN IF NOT EXISTS is_saved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE issues ADD COLUMN IF NOT EXISTS notes JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Performance & filtering indexes
CREATE INDEX IF NOT EXISTS idx_issues_is_saved ON issues(is_saved);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_status_updated_at ON issues(status_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee);
