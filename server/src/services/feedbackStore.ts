import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RawFeedbackRecord, ImportSummary, DatasetStatus, DatasetOriginType } from '../types/import.js';
import type { FeedbackAnalysisRecord, AnalysisRunRecord } from './analysis/types.js';
import { getDatabaseConfig } from '../db/config.js';
import { getPgPool } from '../db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data/imports');
const BATCHES_FILE = path.join(DATA_DIR, 'batches.json');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const ANALYSES_FILE = path.join(DATA_DIR, 'analyses.json');
const RUNS_FILE = path.join(DATA_DIR, 'analysis_runs.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class FeedbackStore {
  private static instance: FeedbackStore;
  private batches: Map<string, ImportSummary> = new Map();
  private recordHashes: Set<string> = new Set();
  private records: RawFeedbackRecord[] = [];
  private analyses: Map<string, FeedbackAnalysisRecord> = new Map();
  private analysisRuns: Map<string, AnalysisRunRecord> = new Map();

  private constructor() {
    this.loadStateFromDisk();
  }

  public static getInstance(): FeedbackStore {
    if (!FeedbackStore.instance) {
      FeedbackStore.instance = new FeedbackStore();
    }
    return FeedbackStore.instance;
  }

  private loadStateFromDisk(): void {
    try {
      if (fs.existsSync(BATCHES_FILE)) {
        const data = fs.readFileSync(BATCHES_FILE, 'utf8');
        const list: ImportSummary[] = JSON.parse(data);
        for (const item of list) {
          this.batches.set(item.batchId, item);
        }
      }

      if (fs.existsSync(RECORDS_FILE)) {
        const data = fs.readFileSync(RECORDS_FILE, 'utf8');
        const list: RawFeedbackRecord[] = JSON.parse(data);
        this.records = list.map((r) => ({
          ...r,
          isSample: Boolean(r.isSample),
          datasetType: r.datasetType || (r.isSample ? 'demo_sample' : 'genuine_import'),
        }));
        for (const rec of this.records) {
          this.recordHashes.add(rec.contentHash);
        }
      }

      if (fs.existsSync(ANALYSES_FILE)) {
        const data = fs.readFileSync(ANALYSES_FILE, 'utf8');
        const list: FeedbackAnalysisRecord[] = JSON.parse(data);
        for (const item of list) {
          this.analyses.set(item.feedbackId, item);
        }
      }

      if (fs.existsSync(RUNS_FILE)) {
        const data = fs.readFileSync(RUNS_FILE, 'utf8');
        const list: AnalysisRunRecord[] = JSON.parse(data);
        for (const item of list) {
          this.analysisRuns.set(item.id, item);
        }
      }
    } catch (err) {
      console.warn('[FeedbackStore] Failed to load state from disk:', err);
    }
  }

  private flushToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(
        BATCHES_FILE,
        JSON.stringify(Array.from(this.batches.values()), null, 2),
        'utf8'
      );
      fs.writeFileSync(
        RECORDS_FILE,
        JSON.stringify(this.records, null, 2),
        'utf8'
      );
      fs.writeFileSync(
        ANALYSES_FILE,
        JSON.stringify(Array.from(this.analyses.values()), null, 2),
        'utf8'
      );
      fs.writeFileSync(
        RUNS_FILE,
        JSON.stringify(Array.from(this.analysisRuns.values()), null, 2),
        'utf8'
      );
    } catch (err) {
      console.error('[FeedbackStore] Failed to persist data to disk:', err);
    }
  }

  public hasContentHash(hash: string): boolean {
    return this.recordHashes.has(hash);
  }

  public getRecordById(id: string): RawFeedbackRecord | null {
    return this.records.find((r) => r.id === id) || null;
  }

  public getUnanalyzedRecords(datasetType?: string): RawFeedbackRecord[] {
    return this.records.filter((r) => {
      if (this.analyses.has(r.id)) return false;
      if (datasetType && datasetType !== 'all') {
        return r.datasetType === datasetType;
      }
      return true;
    });
  }

  public async saveAnalysis(record: FeedbackAnalysisRecord): Promise<void> {
    this.analyses.set(record.feedbackId, record);
    this.flushToDisk();

    // If PostgreSQL configured, write to feedback_analysis table
    const dbConfig = getDatabaseConfig();
    if (dbConfig.isConfigured && dbConfig.databaseUrl) {
      try {
        const pool = getPgPool();
        const sql = `
          INSERT INTO feedback_analysis (
            id, feedback_id, analysis_run_id, sentiment, sentiment_score, urgency, urgency_score,
            primary_topic, topics, key_phrases, summary, model_version, confidence_score, analyzed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (feedback_id, model_version) DO UPDATE SET
            analysis_run_id = EXCLUDED.analysis_run_id,
            sentiment = EXCLUDED.sentiment,
            sentiment_score = EXCLUDED.sentiment_score,
            urgency = EXCLUDED.urgency,
            urgency_score = EXCLUDED.urgency_score,
            primary_topic = EXCLUDED.primary_topic,
            topics = EXCLUDED.topics,
            key_phrases = EXCLUDED.key_phrases,
            summary = EXCLUDED.summary,
            confidence_score = EXCLUDED.confidence_score,
            analyzed_at = EXCLUDED.analyzed_at;
        `;
        await pool.query(sql, [
          record.id,
          record.feedbackId,
          record.analysisRunId || null,
          record.sentiment,
          record.sentimentScore,
          record.urgency,
          record.urgencyScore,
          record.primaryTopic,
          JSON.stringify(record.topics),
          JSON.stringify(record.keyPhrases),
          record.summary,
          record.modelVersion,
          record.confidenceScore,
          record.analyzedAt,
        ]);
      } catch (err) {
        console.warn('[FeedbackStore] DB persistence for analysis skipped/failed:', err);
      }
    }
  }

  public getAnalysisByFeedbackId(feedbackId: string): FeedbackAnalysisRecord | null {
    return this.analyses.get(feedbackId) || null;
  }

  public getAllAnalyses(): FeedbackAnalysisRecord[] {
    return Array.from(this.analyses.values());
  }

  public async saveAnalysisRun(run: AnalysisRunRecord): Promise<void> {
    this.analysisRuns.set(run.id, run);
    this.flushToDisk();

    const dbConfig = getDatabaseConfig();
    if (dbConfig.isConfigured && dbConfig.databaseUrl) {
      try {
        const pool = getPgPool();
        const sql = `
          INSERT INTO analysis_runs (
            id, run_type, status, items_processed, items_failed, model_name,
            execution_duration_ms, error_message, parameters, started_at, completed_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            items_processed = EXCLUDED.items_processed,
            items_failed = EXCLUDED.items_failed,
            execution_duration_ms = EXCLUDED.execution_duration_ms,
            error_message = EXCLUDED.error_message,
            completed_at = EXCLUDED.completed_at;
        `;
        await pool.query(sql, [
          run.id,
          run.runType,
          run.status,
          run.itemsCompleted,
          run.itemsFailed,
          run.modelName,
          run.executionDurationMs || null,
          run.failedRecords.length > 0 ? run.failedRecords[0].error : null,
          JSON.stringify({ ...run.parameters, failedRecords: run.failedRecords }),
          run.startedAt,
          run.completedAt || null,
          run.createdAt,
        ]);
      } catch (err) {
        console.warn('[FeedbackStore] DB persistence for analysis_runs skipped/failed:', err);
      }
    }
  }

  public getAnalysisRunById(id: string): AnalysisRunRecord | null {
    return this.analysisRuns.get(id) || null;
  }

  public getLatestAnalysisRun(): AnalysisRunRecord | null {
    const runs = Array.from(this.analysisRuns.values());
    if (runs.length === 0) return null;
    runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return runs[0];
  }

  public getAllAnalysisRuns(): AnalysisRunRecord[] {
    const runs = Array.from(this.analysisRuns.values());
    return runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  public async saveBatchRecord(summary: ImportSummary): Promise<void> {
    this.batches.set(summary.batchId, summary);
    this.flushToDisk();
  }

  public async saveRecordsChunk(chunk: RawFeedbackRecord[]): Promise<void> {
    if (chunk.length === 0) return;

    for (const rec of chunk) {
      this.records.push(rec);
      this.recordHashes.add(rec.contentHash);
    }
    this.flushToDisk();

    // If PostgreSQL is configured, also persist directly to database table
    const dbConfig = getDatabaseConfig();
    if (dbConfig.isConfigured && dbConfig.databaseUrl) {
      try {
        const pool = getPgPool();
        const values: any[] = [];
        const placeholders: string[] = [];

        chunk.forEach((rec, idx) => {
          const offset = idx * 6;
          placeholders.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`
          );
          values.push(
            rec.source,
            rec.contentHash,
            rec.isSample ? 'Demo Fixture Account' : 'BuildBattle Dataset',
            rec.review,
            JSON.stringify({
              category: rec.category,
              batchId: rec.batchId,
              originalReview: rec.review,
              rowNumber: rec.rowNumber,
              isSample: rec.isSample,
              datasetType: rec.datasetType,
            }),
            rec.importedAt
          );
        });

        const sql = `
          INSERT INTO feedback (source, external_id, account_name, content, metadata, created_at)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (source, external_id) DO NOTHING
        `;

        await pool.query(sql, values);
      } catch (err) {
        console.warn('[FeedbackStore] DB persistence skipped or failed:', err);
      }
    }
  }

  public async resetStore(scope: 'all' | 'sample_only' | 'genuine_only' = 'all'): Promise<{ removedCount: number }> {
    let initialCount = this.records.length;
    let removedCount = 0;

    if (scope === 'all') {
      removedCount = this.records.length;
      this.records = [];
      this.recordHashes.clear();
      this.batches.clear();
      this.analyses.clear();
      this.analysisRuns.clear();
    } else if (scope === 'sample_only') {
      const remaining = this.records.filter((r) => !r.isSample);
      removedCount = initialCount - remaining.length;
      this.records = remaining;
      this.recordHashes = new Set(remaining.map((r) => r.contentHash));
      for (const [id, batch] of this.batches.entries()) {
        if (batch.isSample) this.batches.delete(id);
      }
    } else if (scope === 'genuine_only') {
      const remaining = this.records.filter((r) => r.isSample);
      removedCount = initialCount - remaining.length;
      this.records = remaining;
      this.recordHashes = new Set(remaining.map((r) => r.contentHash));
      for (const [id, batch] of this.batches.entries()) {
        if (!batch.isSample) this.batches.delete(id);
      }
    }

    this.flushToDisk();

    // If PostgreSQL configured and resetting all, truncate feedback, feedback_analysis, analysis_runs
    const dbConfig = getDatabaseConfig();
    if (scope === 'all' && dbConfig.isConfigured && dbConfig.databaseUrl) {
      try {
        const pool = getPgPool();
        await pool.query('TRUNCATE TABLE feedback_analysis CASCADE;');
        await pool.query('TRUNCATE TABLE analysis_runs CASCADE;');
        await pool.query('TRUNCATE TABLE feedback CASCADE;');
      } catch (err) {
        console.warn('[FeedbackStore] Failed to truncate DB table:', err);
      }
    }

    return { removedCount };
  }

  public getBatches(): ImportSummary[] {
    return Array.from(this.batches.values()).sort(
      (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    );
  }

  public getBatchById(id: string): ImportSummary | null {
    return this.batches.get(id) || null;
  }

  public getRecords(params: {
    page?: number;
    pageSize?: number;
    category?: string;
    search?: string;
    datasetType?: 'all' | DatasetOriginType;
  }) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 25));
    let filtered = this.records;

    // Filter by dataset origin type (distinguish genuine vs demo sample)
    if (params.datasetType && params.datasetType !== 'all') {
      filtered = filtered.filter((r) => r.datasetType === params.datasetType);
    }

    if (params.category && params.category !== 'all') {
      const targetCat = params.category.toLowerCase().trim();
      filtered = filtered.filter(
        (r) => r.category.toLowerCase().trim() === targetCat
      );
    }

    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.review.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.source.toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const data = filtered.slice(offset, offset + pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  public getDatasetStatus(): DatasetStatus {
    const totalRecords = this.records.length;
    let genuineCount = 0;
    let sampleCount = 0;
    const categories: Record<string, number> = {};

    for (const rec of this.records) {
      if (rec.isSample) {
        sampleCount++;
      } else {
        genuineCount++;
      }
      categories[rec.category] = (categories[rec.category] || 0) + 1;
    }

    let activeDatasetType: 'empty' | 'genuine' | 'sample' | 'mixed' = 'empty';
    if (totalRecords === 0) {
      activeDatasetType = 'empty';
    } else if (genuineCount > 0 && sampleCount === 0) {
      activeDatasetType = 'genuine';
    } else if (sampleCount > 0 && genuineCount === 0) {
      activeDatasetType = 'sample';
    } else {
      activeDatasetType = 'mixed';
    }

    const batches = this.getBatches();
    const lastBatch = batches[0] || null;
    const hasAnalysisRun = this.analyses.size > 0;
    const analysisStatus = hasAnalysisRun
      ? (this.analyses.size >= totalRecords && totalRecords > 0 ? 'completed' : 'running')
      : 'not_started';

    return {
      totalRecords,
      genuineCount,
      sampleCount,
      categories,
      activeDatasetType,
      lastImportAt: lastBatch ? lastBatch.importedAt : null,
      lastBatchId: lastBatch ? lastBatch.batchId : null,
      analysisStatus,
      hasAnalysisRun,
    };
  }

  public getTotalRecordsCount(): number {
    return this.records.length;
  }
}
