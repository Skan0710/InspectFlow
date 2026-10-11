import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDatabaseConfig } from './db/config.js';
import { checkDatabaseHealth } from './db/health.js';
import {
  getPgPool,
  getSupabaseClient,
  parsePaginationParams,
  DatabaseNotConfiguredError,
} from './db/client.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// General Health Check Endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  const dbConfig = getDatabaseConfig();

  res.status(200).json({
    status: 'ok',
    message: 'InsightFlow API is running smoothly',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      configured: dbConfig.isConfigured,
      missingVariables: dbConfig.missingVariables,
    },
  });
});

// Dedicated Database Health Check Endpoint
app.get('/api/health/db', async (_req: Request, res: Response) => {
  const report = await checkDatabaseHealth();

  if (!report.configured) {
    res.status(503).json({
      status: 'unconfigured',
      error: 'Database Configuration Required',
      message: report.message,
      missingVariables: report.missingVariables,
      timestamp: report.timestamp,
    });
    return;
  }

  if (!report.reachable) {
    res.status(503).json({
      status: 'unreachable',
      error: 'Database Unreachable',
      message: report.message,
      provider: report.provider,
      details: report.error,
      latencyMs: report.latencyMs,
      timestamp: report.timestamp,
    });
    return;
  }

  res.status(200).json({
    status: 'connected',
    message: report.message,
    provider: report.provider,
    database: report.database,
    latencyMs: report.latencyMs,
    timestamp: report.timestamp,
  });
});

// Database-dependent Endpoint: Read Feedback with Keyset/Offset Pagination
// Avoids loading all rows into memory unnecessarily
app.get('/api/feedback', async (req: Request, res: Response, next: NextFunction) => {
  const dbConfig = getDatabaseConfig();

  if (!dbConfig.isConfigured) {
    res.status(503).json({
      error: 'DatabaseNotConfigured',
      message:
        'Database configuration is required to query feedback records. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL in server/.env.',
      missingVariables: dbConfig.missingVariables,
    });
    return;
  }

  try {
    const { page, pageSize, offset } = parsePaginationParams({
      page: Number(req.query.page),
      pageSize: Number(req.query.pageSize),
    });

    if (dbConfig.databaseUrl) {
      const pool = getPgPool();
      const countResult = await pool.query('SELECT COUNT(*) as total FROM feedback');
      const total = Number(countResult.rows[0]?.total || 0);

      const itemsResult = await pool.query(
        `SELECT id, source, external_id, account_name, customer_email, channel, content, metadata, feedback_timestamp, created_at
         FROM feedback
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      );

      res.status(200).json({
        data: itemsResult.rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
      return;
    }

    // PostgREST Pathway via Supabase Client
    const supabase = getSupabaseClient();
    const { data, count, error } = await supabase
      .from('feedback')
      .select('id, source, external_id, account_name, customer_email, channel, content, metadata, feedback_timestamp, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    res.status(200).json({
      data: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (err) {
    next(err);
  }
});

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested route does not exist.',
  });
});

// Error Handling Middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof DatabaseNotConfiguredError) {
    res.status(503).json({
      error: 'DatabaseNotConfigured',
      message: err.message,
      missingVariables: err.missingVariables,
    });
    return;
  }

  console.error('[ServerError]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.',
  });
});

// Start Server
app.listen(PORT, () => {
  const dbConfig = getDatabaseConfig();
  console.log(`🚀 InsightFlow server running on http://localhost:${PORT}`);
  console.log(`📡 Health check available at http://localhost:${PORT}/api/health`);
  console.log(`📡 DB health check available at http://localhost:${PORT}/api/health/db`);

  if (!dbConfig.isConfigured) {
    console.log(
      `⚠️  Database is unconfigured. Missing: ${dbConfig.missingVariables.join(
        ', '
      )}. Database endpoints will report 503 until configured.`
    );
  } else {
    console.log('✅ Database configuration detected in environment.');
  }
});

export default app;
