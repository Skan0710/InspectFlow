import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDatabaseConfig } from './db/config.js';
import { checkDatabaseHealth } from './db/health.js';
import { DatabaseNotConfiguredError } from './db/client.js';
import feedbackRoutes from './routes/feedback.js';
import datasetRoutes from './routes/dataset.js';

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

// Customer Feedback and CSV Ingestion Routes
app.use('/api/feedback', feedbackRoutes);

// Dataset Ingestion Status and Demonstration Seed Routes
app.use('/api/dataset', datasetRoutes);

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
      )}. Direct DB endpoints will report 503 until configured.`
    );
  } else {
    console.log('✅ Database configuration detected in environment.');
  }
});

export default app;
