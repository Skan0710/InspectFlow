import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDatabaseConfig } from './db/config.js';
import { checkDatabaseHealth } from './db/health.js';
import { DatabaseNotConfiguredError } from './db/client.js';
import { getAIStatus } from './services/ai/index.js';
import feedbackRoutes from './routes/feedback.js';
import datasetRoutes from './routes/dataset.js';
import analysisRoutes from './routes/analysis.js';
import clusterRoutes from './routes/clusters.js';
import scoringRoutes from './routes/scoring.js';
import analyticsRoutes from './routes/analytics.js';
import recommendationRoutes from './routes/recommendations.js';
import issueRoutes from './routes/issues.js';
import adaptionRoutes from './routes/adaption.js';
import reportRoutes from './routes/reports.js';
import chatRoutes from './routes/chat.js';
import authRoutes from './routes/auth.js';
import path from 'path';

// Load root project .env — try both possible cwd locations (running from server/ or from root)
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

// A stray rejected promise (e.g. a failed database write) must not take the whole API down,
// otherwise every in-flight and later request fails until the process is restarted.
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err);
});

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      (process.env.VERCEL_URL && origin.includes(process.env.VERCEL_URL)) ||
      (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// General Health Check Endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  const dbConfig = getDatabaseConfig();
  const aiStatus = getAIStatus();

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
    ai: {
      configured: aiStatus.configured,
      provider: aiStatus.provider,
      model: aiStatus.model,
    },
  });
});

// Dedicated AI Health / Capability Check Endpoint
app.get('/api/health/ai', async (_req: Request, res: Response) => {
  const aiStatus = getAIStatus();

  res.status(200).json({
    status: aiStatus.configured ? 'ready' : 'unconfigured',
    configured: aiStatus.configured,
    provider: aiStatus.provider,
    model: aiStatus.model,
    timeoutMs: aiStatus.timeoutMs,
    maxRetries: aiStatus.maxRetries,
    timestamp: new Date().toISOString(),
    message: aiStatus.configured
      ? `AI provider '${aiStatus.provider}' initialized and ready.`
      : 'AI provider is unconfigured. Set AI_PROVIDER and corresponding API key (e.g. GEMINI_API_KEY, OPENAI_API_KEY).',
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

// Batch Feedback Analysis Pipeline Routes
app.use('/api/analysis', analysisRoutes);

// Issue Clustering Routes
app.use('/api/clusters', clusterRoutes);

// Deterministic Issue Priority Scoring Routes
app.use('/api/scoring', scoringRoutes);

// Customer Intelligence and Feedback Analytics Routes
app.use('/api/analytics', analyticsRoutes);

// Evidence-Backed AI Recommendations Routes
app.use('/api/recommendations', recommendationRoutes);

// Action Center & Persistent Issue Tracking Routes
app.use('/api/issues', issueRoutes);

// Adaption Labs Workflow Integration Routes
app.use('/api/adaption', adaptionRoutes);

// Business Insight Reports & Intelligence Digests Routes
app.use('/api/reports', reportRoutes);

// Grounded AI Copilot Chat Route
app.use('/api/chat', chatRoutes);

// Google OAuth Authentication Route
app.use('/api/auth', authRoutes);

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

  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Origin not allowed by CORS policy.',
    });
    return;
  }

  // body-parser failures (malformed JSON, oversized payload) are client errors, not server faults
  const bodyErr = err as Error & { type?: string; status?: number };
  if (bodyErr.type === 'entity.parse.failed') {
    res.status(400).json({
      error: 'BadRequest',
      message: 'Request body contains malformed JSON.',
    });
    return;
  }
  if (bodyErr.type === 'entity.too.large') {
    res.status(413).json({
      error: 'PayloadTooLarge',
      message: 'Request body exceeds the maximum allowed size.',
    });
    return;
  }

  if (err.name === 'MulterError') {
    const multerErr = err as unknown as { code: string };
    if (multerErr.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'PayloadTooLarge',
        message: 'File exceeds maximum upload limit of 50MB.',
      });
      return;
    }
    res.status(400).json({
      error: 'UploadError',
      message: err.message,
    });
    return;
  }

  // Prevent leaking sensitive internal data in production logs and response bodies
  if (process.env.NODE_ENV === 'production') {
    console.error(`[ServerError] ${err.name}: ${err.message}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected internal server error occurred.',
    });
  } else {
    console.error('[ServerError]', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred.',
    });
  }
});

// Start Server (only listen when running outside Vercel serverless functions)
if (!process.env.VERCEL) {
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

    const aiStatus = getAIStatus();
    console.log(`📡 AI health check available at http://localhost:${PORT}/api/health/ai`);
    if (!aiStatus.configured) {
      console.log(`⚠️  AI Provider is unconfigured (${aiStatus.provider}). Real model analysis will report unconfigured until credentials are supplied.`);
    } else {
      console.log(`🤖 AI Provider configured: ${aiStatus.provider} (model: ${aiStatus.model})`);
    }
  });
}

export default app;
