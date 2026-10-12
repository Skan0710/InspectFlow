-- ========================================================================
-- InsightFlow: Adaption Labs Workflow Integration Migration
-- Migration: 004_adaption_workflow.sql
-- ========================================================================

CREATE TABLE IF NOT EXISTS adaption_runs (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  dataset_version VARCHAR(32) NOT NULL DEFAULT 'v1.0.0',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  records_count INT NOT NULL DEFAULT 0,
  training_type VARCHAR(64) NOT NULL DEFAULT 'instruction_dataset',
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  quality JSONB,
  sample_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,
  benchmark_integrated BOOLEAN NOT NULL DEFAULT FALSE,
  raw_results JSONB,
  error_message TEXT,
  is_mock BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_adaption_runs_status ON adaption_runs(status);
CREATE INDEX IF NOT EXISTS idx_adaption_runs_created_at ON adaption_runs(created_at DESC);
