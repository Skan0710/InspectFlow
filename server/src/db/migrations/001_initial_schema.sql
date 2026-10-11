-- ========================================================================
-- InsightFlow: Initial PostgreSQL Schema Migration
-- Designed for Supabase PostgreSQL
-- ========================================================================

-- Enable standard UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------
-- 1. dataset_versions
-- Immutable snapshots of customer feedback datasets for reproducible clustering
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dataset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_tag VARCHAR(64) UNIQUE NOT NULL,
  description TEXT,
  total_records INTEGER NOT NULL DEFAULT 0,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  checksum VARCHAR(128),
  storage_uri VARCHAR(512),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dataset_versions_created_at 
  ON dataset_versions(created_at DESC);

-- ------------------------------------------------------------------------
-- 2. analysis_runs
-- Tracking of batch and streaming AI clustering/sentiment analysis execution
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  items_processed INTEGER NOT NULL DEFAULT 0,
  items_failed INTEGER NOT NULL DEFAULT 0,
  model_name VARCHAR(64) NOT NULL,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  execution_duration_ms INTEGER,
  error_message TEXT,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_status 
  ON analysis_runs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_created_at 
  ON analysis_runs(created_at DESC);

-- ------------------------------------------------------------------------
-- 3. feedback
-- Raw customer feedback records ingested across support and CRM channels
-- Kept strictly separate from downstream AI analyses
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(64) NOT NULL,
  external_id VARCHAR(255),
  account_id VARCHAR(128),
  account_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_name VARCHAR(255),
  channel VARCHAR(64) NOT NULL DEFAULT 'support_ticket',
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deduplication index: prevents identical records from being re-ingested
CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_source_external_id 
  ON feedback(source, external_id) 
  WHERE external_id IS NOT NULL;

-- High-performance query indexes
CREATE INDEX IF NOT EXISTS idx_feedback_created_at 
  ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_account_name 
  ON feedback(account_name);
CREATE INDEX IF NOT EXISTS idx_feedback_source_created 
  ON feedback(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_metadata 
  ON feedback USING gin(metadata);

CREATE TRIGGER trg_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

-- ------------------------------------------------------------------------
-- 4. feedback_analysis
-- AI-generated sentiment, urgency, semantic topics and summaries
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  analysis_run_id UUID REFERENCES analysis_runs(id) ON DELETE SET NULL,
  sentiment VARCHAR(32) NOT NULL 
    CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score NUMERIC(4, 3) NOT NULL 
    CHECK (sentiment_score BETWEEN -1.000 AND 1.000),
  urgency VARCHAR(32) NOT NULL DEFAULT 'normal' 
    CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  urgency_score NUMERIC(3, 2) 
    CHECK (urgency_score BETWEEN 0.00 AND 1.00),
  intent VARCHAR(64),
  primary_topic VARCHAR(128),
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_phrases JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  model_version VARCHAR(64) NOT NULL,
  confidence_score NUMERIC(3, 2) 
    CHECK (confidence_score BETWEEN 0.00 AND 1.00),
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_feedback_model_version UNIQUE (feedback_id, model_version)
);

CREATE INDEX IF NOT EXISTS idx_feedback_analysis_feedback_id 
  ON feedback_analysis(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_sentiment 
  ON feedback_analysis(sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_urgency 
  ON feedback_analysis(urgency);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_primary_topic 
  ON feedback_analysis(primary_topic);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_topics 
  ON feedback_analysis USING gin(topics);

CREATE TRIGGER trg_feedback_analysis_updated_at
  BEFORE UPDATE ON feedback_analysis
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

-- ------------------------------------------------------------------------
-- 5. issues
-- Actionable initiatives and product tickets distilled from customer feedback
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_code VARCHAR(32) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog', 'in_progress', 'in_review', 'completed', 'cancelled')),
  priority VARCHAR(32) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assignee VARCHAR(255),
  assignee_email VARCHAR(255),
  due_date DATE,
  category VARCHAR(64),
  impact_summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_status_priority 
  ON issues(status, priority);
CREATE INDEX IF NOT EXISTS idx_issues_due_date 
  ON issues(due_date);

CREATE TRIGGER trg_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

-- ------------------------------------------------------------------------
-- 6. issue_feedback
-- Junction table linking issues to citing raw feedback items
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  relevance_score NUMERIC(3, 2) 
    CHECK (relevance_score BETWEEN 0.00 AND 1.00),
  citation_quote TEXT,
  added_by VARCHAR(64) NOT NULL DEFAULT 'ai_clustering',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_issue_feedback UNIQUE (issue_id, feedback_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_feedback_issue 
  ON issue_feedback(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_feedback_feedback 
  ON issue_feedback(feedback_id);

-- ------------------------------------------------------------------------
-- 7. reports
-- Automated executive briefings, churn radars, and custom digest exports
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code VARCHAR(32) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  report_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'generated'
    CHECK (status IN ('draft', 'scheduled', 'generating', 'generated', 'failed')),
  cadence VARCHAR(64),
  format VARCHAR(32) NOT NULL DEFAULT 'pdf',
  content_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_path VARCHAR(512),
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_type_status 
  ON reports(report_type, status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at 
  ON reports(created_at DESC);

CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();
