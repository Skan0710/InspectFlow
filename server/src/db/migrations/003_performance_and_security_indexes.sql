-- ========================================================================
-- InsightFlow: Performance & Security Indexes Migration
-- Migration: 003_performance_and_security_indexes.sql
-- ========================================================================

-- 1. Feedback table: Metadata expression indexes for frequent filter patterns
-- Justified by: Category and datasetType filtering in feedback explorer and analytics metrics
CREATE INDEX IF NOT EXISTS idx_feedback_category_expr 
  ON feedback ((metadata->>'category')) 
  WHERE (metadata->>'category') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_dataset_type_expr 
  ON feedback ((metadata->>'datasetType')) 
  WHERE (metadata->>'datasetType') IS NOT NULL;

-- 2. Feedback Analysis table: Foreign key & severity indexes
-- Justified by: Batch run progress queries and cascading lookups
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_run_id 
  ON feedback_analysis (analysis_run_id) 
  WHERE analysis_run_id IS NOT NULL;

-- Justified by: Severity filtering in Feedback Explorer and scoring recalculation
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_severity 
  ON feedback_analysis (urgency_score DESC);

-- 3. Issue Feedback Junction: Reverse foreign key lookup
-- Justified by: Feedback deletion cascading and finding issues associated with specific feedback items
CREATE INDEX IF NOT EXISTS idx_issue_feedback_feedback_id 
  ON issue_feedback (feedback_id);
