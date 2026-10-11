import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RawFeedbackRecord, ImportSummary, DatasetStatus, DatasetOriginType } from '../types/import.js';
import type { FeedbackAnalysisRecord, AnalysisRunRecord } from './analysis/types.js';
import type { IssueClusterData, IssueFeedbackLink, ClusteringResult, UnmatchedFeedbackItem } from './clustering/types.js';
import { PriorityScoringService } from './scoring/priorityScoringService.js';
import type { ScoringOptions, IssueScoringRecord, ScoringResultSummary } from './scoring/types.js';
import type { IssueRecommendation } from './recommendations/types.js';
import { getDatabaseConfig } from '../db/config.js';
import { getPgPool } from '../db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data/imports');
const BATCHES_FILE = path.join(DATA_DIR, 'batches.json');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const ANALYSES_FILE = path.join(DATA_DIR, 'analyses.json');
const RUNS_FILE = path.join(DATA_DIR, 'analysis_runs.json');
const ISSUES_FILE = path.join(DATA_DIR, 'issues.json');
const ISSUE_FEEDBACK_FILE = path.join(DATA_DIR, 'issue_feedback.json');
const CLUSTERING_RUNS_FILE = path.join(DATA_DIR, 'clustering_runs.json');

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
  private issues: Map<string, IssueClusterData> = new Map();
  private issueFeedback: Map<string, IssueFeedbackLink[]> = new Map();
  private clusteringRuns: ClusteringResult[] = [];
  private recommendations: Map<string, IssueRecommendation> = new Map();
  private scoringService = new PriorityScoringService();

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
      const safeParse = <T>(filePath: string): T | null => {
        if (!fs.existsSync(filePath)) return null;
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (!content || !content.trim()) return null;
          return JSON.parse(content) as T;
        } catch {
          return null;
        }
      };

      const batchesList = safeParse<ImportSummary[]>(BATCHES_FILE);
      if (batchesList) {
        for (const item of batchesList) {
          this.batches.set(item.batchId, item);
        }
      }

      const recordsList = safeParse<RawFeedbackRecord[]>(RECORDS_FILE);
      if (recordsList) {
        this.records = recordsList.map((r) => ({
          ...r,
          isSample: Boolean(r.isSample),
          datasetType: r.datasetType || (r.isSample ? 'demo_sample' : 'genuine_import'),
        }));
        for (const rec of this.records) {
          this.recordHashes.add(rec.contentHash);
        }
      }

      const analysesList = safeParse<FeedbackAnalysisRecord[]>(ANALYSES_FILE);
      if (analysesList) {
        for (const item of analysesList) {
          this.analyses.set(item.feedbackId, item);
        }
      }

      const runsList = safeParse<AnalysisRunRecord[]>(RUNS_FILE);
      if (runsList) {
        for (const item of runsList) {
          this.analysisRuns.set(item.id, item);
        }
      }

      const issuesList = safeParse<IssueClusterData[]>(ISSUES_FILE);
      if (issuesList) {
        for (const item of issuesList) {
          this.issues.set(item.id, item);
          if (item.metadata && (item.metadata as any).recommendation) {
            this.recommendations.set(item.id, (item.metadata as any).recommendation);
          }
        }
      }

      const linksList = safeParse<IssueFeedbackLink[]>(ISSUE_FEEDBACK_FILE);
      if (linksList) {
        this.issueFeedback.clear();
        for (const item of linksList) {
          const arr = this.issueFeedback.get(item.issueId) || [];
          arr.push(item);
          this.issueFeedback.set(item.issueId, arr);
        }
      }

      const clusteringRunsList = safeParse<ClusteringResult[]>(CLUSTERING_RUNS_FILE);
      if (clusteringRunsList) {
        this.clusteringRuns = clusteringRunsList;
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
      fs.writeFileSync(
        ISSUES_FILE,
        JSON.stringify(Array.from(this.issues.values()), null, 2),
        'utf8'
      );
      const allLinks: IssueFeedbackLink[] = [];
      for (const links of this.issueFeedback.values()) {
        allLinks.push(...links);
      }
      fs.writeFileSync(
        ISSUE_FEEDBACK_FILE,
        JSON.stringify(allLinks, null, 2),
        'utf8'
      );
      fs.writeFileSync(
        CLUSTERING_RUNS_FILE,
        JSON.stringify(this.clusteringRuns, null, 2),
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

    // If issues already exist, recalculate priority scores to reflect updated analysis
    if (this.issues.size > 0) {
      await this.recalculateIssuePriorityScores();
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
      this.issues.clear();
      this.issueFeedback.clear();
      this.clusteringRuns = [];
      this.recommendations.clear();
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

    // If PostgreSQL configured and resetting all, truncate tables
    const dbConfig = getDatabaseConfig();
    if (scope === 'all' && dbConfig.isConfigured && dbConfig.databaseUrl) {
      try {
        const pool = getPgPool();
        await pool.query('TRUNCATE TABLE issue_feedback CASCADE;');
        await pool.query('TRUNCATE TABLE issues CASCADE;');
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
    sentiment?: string;
    topic?: string;
    severity?: number | 'all';
    analysisStatus?: 'analyzed' | 'pending' | 'all';
    sortBy?: 'rowNumber' | 'severity' | 'confidence' | 'sentimentScore' | 'category' | 'importedAt';
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, params.pageSize || 25);
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

    // Filter by analysis status
    if (params.analysisStatus && params.analysisStatus !== 'all') {
      if (params.analysisStatus === 'analyzed') {
        filtered = filtered.filter((r) => this.analyses.has(r.id));
      } else if (params.analysisStatus === 'pending') {
        filtered = filtered.filter((r) => !this.analyses.has(r.id));
      }
    }

    // Filter by sentiment (only matches analyzed records with that sentiment)
    if (params.sentiment && params.sentiment !== 'all') {
      const targetSentiment = params.sentiment.toLowerCase().trim();
      filtered = filtered.filter((r) => {
        const analysis = this.analyses.get(r.id);
        return Boolean(analysis && analysis.sentiment.toLowerCase().trim() === targetSentiment);
      });
    }

    // Filter by severity
    if (params.severity !== undefined && params.severity !== 'all') {
      const targetSev = Number(params.severity);
      filtered = filtered.filter((r) => {
        const analysis = this.analyses.get(r.id);
        if (!analysis) return false;
        const sev = analysis.severity || (analysis.urgencyScore ? Math.round(analysis.urgencyScore * 5) : 3);
        return sev === targetSev;
      });
    }

    // Filter by topic (matches primary topic or secondary topics)
    if (params.topic && params.topic.trim() && params.topic !== 'all') {
      const targetTopic = params.topic.toLowerCase().trim();
      filtered = filtered.filter((r) => {
        const analysis = this.analyses.get(r.id);
        if (!analysis) return false;
        if (analysis.primaryTopic && analysis.primaryTopic.toLowerCase().includes(targetTopic)) {
          return true;
        }
        if (Array.isArray(analysis.topics)) {
          return analysis.topics.some((t) => t.toLowerCase().includes(targetTopic));
        }
        return false;
      });
    }

    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter((r) => {
        if (
          r.review.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.source.toLowerCase().includes(q)
        ) {
          return true;
        }
        const analysis = this.analyses.get(r.id);
        if (analysis) {
          if (analysis.summary && analysis.summary.toLowerCase().includes(q)) return true;
          if (analysis.primaryTopic && analysis.primaryTopic.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }

    // Sorting
    const sortBy = params.sortBy || 'rowNumber';
    const sortOrder = params.sortOrder === 'desc' ? -1 : 1;

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'rowNumber') {
        return ((a.rowNumber || 0) - (b.rowNumber || 0)) * sortOrder;
      }
      if (sortBy === 'importedAt') {
        return (new Date(a.importedAt).getTime() - new Date(b.importedAt).getTime()) * sortOrder;
      }
      if (sortBy === 'category') {
        return a.category.localeCompare(b.category) * sortOrder;
      }
      if (sortBy === 'severity') {
        const anA = this.analyses.get(a.id);
        const anB = this.analyses.get(b.id);
        const sevA = anA ? (anA.severity || (anA.urgencyScore ? Math.round(anA.urgencyScore * 5) : 3)) : -1;
        const sevB = anB ? (anB.severity || (anB.urgencyScore ? Math.round(anB.urgencyScore * 5) : 3)) : -1;
        return (sevA - sevB) * sortOrder;
      }
      if (sortBy === 'confidence') {
        const anA = this.analyses.get(a.id);
        const anB = this.analyses.get(b.id);
        const confA = anA ? anA.confidenceScore : -1;
        const confB = anB ? anB.confidenceScore : -1;
        return (confA - confB) * sortOrder;
      }
      if (sortBy === 'sentimentScore') {
        const anA = this.analyses.get(a.id);
        const anB = this.analyses.get(b.id);
        const scoreA = anA ? anA.sentimentScore : -99;
        const scoreB = anB ? anB.sentimentScore : -99;
        return (scoreA - scoreB) * sortOrder;
      }
      return 0;
    });

    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const data = filtered.slice(offset, offset + pageSize).map((r) => ({
      ...r,
      analysis: this.analyses.get(r.id) || undefined,
    }));

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

  public async saveClustersAndLinks(
    result: ClusteringResult,
    links: IssueFeedbackLink[]
  ): Promise<void> {
    this.clusteringRuns.unshift(result);
    if (this.clusteringRuns.length > 10) {
      this.clusteringRuns = this.clusteringRuns.slice(0, 10);
    }

    for (const cluster of result.clusters) {
      this.issues.set(cluster.id, cluster);
    }

    for (const link of links) {
      const arr = this.issueFeedback.get(link.issueId) || [];
      arr.push(link);
      this.issueFeedback.set(link.issueId, arr);
    }

    this.flushToDisk();

    // Automatically calculate priority scores for the newly saved clusters
    await this.recalculateIssuePriorityScores();

    const dbConfig = getDatabaseConfig();
    if (dbConfig.isConfigured && dbConfig.databaseUrl) {
      try {
        const pool = getPgPool();
        for (const cluster of result.clusters) {
          const sqlIssue = `
            INSERT INTO issues (
              id, issue_code, title, description, status, priority, category, impact_summary, metadata, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              status = EXCLUDED.status,
              priority = EXCLUDED.priority,
              category = EXCLUDED.category,
              impact_summary = EXCLUDED.impact_summary,
              metadata = EXCLUDED.metadata,
              updated_at = EXCLUDED.updated_at;
          `;
          await pool.query(sqlIssue, [
            cluster.id,
            cluster.issueCode,
            cluster.title,
            cluster.description,
            cluster.status,
            cluster.priority,
            cluster.category,
            cluster.impactSummary,
            JSON.stringify(cluster.metadata),
            cluster.createdAt,
            cluster.updatedAt,
          ]);
        }

        if (links.length > 0) {
          const chunkSize = 200;
          for (let i = 0; i < links.length; i += chunkSize) {
            const chunk = links.slice(i, i + chunkSize);
            const placeholders: string[] = [];
            const values: any[] = [];
            chunk.forEach((l, idx) => {
              const base = idx * 6;
              placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
              values.push(l.id, l.issueId, l.feedbackId, l.relevanceScore, l.citationQuote, l.addedBy);
            });
            const sqlLinks = `
              INSERT INTO issue_feedback (id, issue_id, feedback_id, relevance_score, citation_quote, added_by)
              VALUES ${placeholders.join(', ')}
              ON CONFLICT (issue_id, feedback_id) DO UPDATE SET
                relevance_score = EXCLUDED.relevance_score,
                citation_quote = EXCLUDED.citation_quote;
            `;
            await pool.query(sqlLinks, values);
          }
        }
      } catch (err) {
        console.warn('[FeedbackStore] DB persistence for clusters skipped/failed:', err);
      }
    }
  }

  public getAllIssues(params?: {
    category?: string;
    priority?: string;
    search?: string;
  }): IssueClusterData[] {
    let list = Array.from(this.issues.values());

    if (params?.category && params.category !== 'all') {
      const cat = params.category.toLowerCase().trim();
      list = list.filter((c) => c.category.toLowerCase().trim() === cat);
    }

    if (params?.priority && params.priority !== 'all') {
      const prio = params.priority.toLowerCase().trim();
      list = list.filter((c) => c.priority.toLowerCase().trim() === prio);
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.issueCode.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => b.feedbackCount - a.feedbackCount);
  }

  public getIssueById(id: string): IssueClusterData | null {
    return this.issues.get(id) || null;
  }

  public getIssueFeedbackLinks(issueId: string): IssueFeedbackLink[] {
    return this.issueFeedback.get(issueId) || [];
  }

  public getFeedbackForIssue(issueId: string) {
    const issue = this.issues.get(issueId);
    if (!issue) return [];

    const links = this.issueFeedback.get(issueId) || [];
    const linkMap = new Map<string, IssueFeedbackLink>();
    for (const l of links) {
      linkMap.set(l.feedbackId, l);
    }

    const results = [];
    for (const fbId of issue.memberFeedbackIds) {
      const feedback = this.getRecordById(fbId);
      if (feedback) {
        const link = linkMap.get(fbId) || {
          id: fbId,
          issueId,
          feedbackId: fbId,
          relevanceScore: 0.85,
          citationQuote: '',
          addedBy: 'ai_clustering',
          createdAt: feedback.importedAt,
        };
        const analysis = this.getAnalysisByFeedbackId(fbId);
        results.push({
          feedback,
          link,
          analysis,
        });
      }
    }
    return results;
  }

  public getLatestClusteringResult(): ClusteringResult | null {
    return this.clusteringRuns[0] || null;
  }

  public getAllClusteringRuns(): ClusteringResult[] {
    return this.clusteringRuns;
  }

  /**
   * Recalculates deterministic priority scores across all stored issues.
   * Priority = 100 * (0.40 * F + 0.35 * S + 0.25 * N)
   */
  public async recalculateIssuePriorityScores(options?: ScoringOptions): Promise<{
    issues: IssueScoringRecord[];
    summary: ScoringResultSummary;
  }> {
    const rawFeedbackMap = new Map<string, RawFeedbackRecord>();
    for (const r of this.records) {
      rawFeedbackMap.set(r.id, r);
    }

    const issuesList = Array.from(this.issues.values());
    const scoringResult = this.scoringService.scoreIssues(
      issuesList,
      this.analyses,
      rawFeedbackMap,
      options
    );

    // Update in-memory issues
    for (const scored of scoringResult.issues) {
      const issue = this.issues.get(scored.issueId);
      if (issue) {
        issue.priority = scored.tier;
        issue.metadata = {
          ...issue.metadata,
          priorityScore: scored.score,
          priorityTier: scored.tier,
          scoreBreakdown: scored.breakdown,
          algorithmVersion: scored.algorithmVersion,
          disclaimer: scored.breakdown.disclaimer,
          totalMentions: scored.totalMentions,
          uniqueReports: scored.uniqueReports,
          duplicateRatio: scored.duplicateRatio,
        };
        issue.updatedAt = new Date().toISOString();
        this.issues.set(issue.id, issue);
      }
    }

    this.flushToDisk();

    // If PostgreSQL configured, update issues in DB
    const dbConfig = getDatabaseConfig();
    if (dbConfig.isConfigured && dbConfig.databaseUrl) {
      try {
        const pool = getPgPool();
        for (const scored of scoringResult.issues) {
          const issue = this.issues.get(scored.issueId);
          if (issue) {
            const sql = `
              UPDATE issues
              SET priority = $1, metadata = $2, updated_at = $3
              WHERE id = $4;
            `;
            await pool.query(sql, [
              issue.priority,
              JSON.stringify(issue.metadata),
              issue.updatedAt,
              issue.id,
            ]);
          }
        }
      } catch (err) {
        console.warn('[FeedbackStore] DB update for priority scores skipped/failed:', err);
      }
    }

    return scoringResult;
  }

  public async saveRecommendation(recommendation: IssueRecommendation): Promise<void> {
    this.recommendations.set(recommendation.issueId, recommendation);

    // Associate recommendation in issue metadata
    const issue = this.issues.get(recommendation.issueId);
    if (issue) {
      issue.metadata = {
        ...issue.metadata,
        recommendation,
      };
      issue.updatedAt = new Date().toISOString();
      this.issues.set(issue.id, issue);
    }

    this.flushToDisk();

    // If PostgreSQL configured, update issue metadata in DB
    const dbConfig = getDatabaseConfig();
    if (dbConfig.isConfigured && dbConfig.databaseUrl && issue) {
      try {
        const pool = getPgPool();
        const sql = `UPDATE issues SET metadata = $1, updated_at = $2 WHERE id = $3;`;
        await pool.query(sql, [JSON.stringify(issue.metadata), issue.updatedAt, issue.id]);
      } catch (err) {
        console.warn('[FeedbackStore] DB update for recommendation skipped/failed:', err);
      }
    }
  }

  public getRecommendationByIssueId(issueId: string): IssueRecommendation | null {
    if (this.recommendations.has(issueId)) {
      return this.recommendations.get(issueId)!;
    }
    const issue = this.issues.get(issueId);
    if (issue && issue.metadata && (issue.metadata as any).recommendation) {
      const rec = (issue.metadata as any).recommendation as IssueRecommendation;
      this.recommendations.set(issueId, rec);
      return rec;
    }
    return null;
  }

  public getAllRecommendations(): IssueRecommendation[] {
    return Array.from(this.recommendations.values());
  }
}
