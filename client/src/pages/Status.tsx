import { Button } from '../components/ui/Button';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Server, 
  Clock, 
  Terminal, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Globe,
  Radio
} from 'lucide-react';
import type { HealthResponse } from '../types/api';

export const Status: React.FC = () => {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [rawResponse, setRawResponse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const checkEndpoint = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      const time = Math.round(performance.now() - start);
      setResponseTime(time);

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setRawResponse(JSON.stringify(json, null, 2));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reach API endpoint';
      setError(errorMessage);
      setData(null);
      setRawResponse('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkEndpoint();
  }, []);

  return (
    <div className="space-y-8 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Radio className="h-7 w-7 text-indigo-400" />
            Backend Diagnostics & Health
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time ping verification of the Node.js Express server at <code className="text-slate-300">/api/health</code>
          </p>
        </div>

        <Button
          variant="outline"
          onClick={checkEndpoint}
          disabled={loading}
          leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
        >
          Run Health Check
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Endpoint Status</span>
            {data?.status === 'ok' ? (
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-400" />
            )}
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {loading ? 'Checking...' : data?.status === 'ok' ? 'HEALTHY' : 'UNREACHABLE'}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            HTTP GET /api/health
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Roundtrip Latency</span>
            <Clock className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {responseTime !== null ? `${responseTime} ms` : '--'}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Client-to-backend transit
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Node Process Uptime</span>
            <Server className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {data ? `${Math.floor(data.uptime)}s` : '--'}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Continuous runtime
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Environment</span>
            <Globe className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white uppercase font-mono text-base">
            {data ? data.environment : 'unknown'}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            NODE_ENV setting
          </div>
        </motion.div>
      </div>

      {/* Raw Payload Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Terminal className="h-4 w-4 text-indigo-400" />
            Payload Inspection
          </div>
          <span className="text-xs text-slate-400 font-mono">application/json</span>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-900/50 bg-rose-950/20 p-4 text-xs font-mono text-rose-300">
            Error: {error}
            <br />
            Make sure the backend is running with `npm run dev:server` on port 5000.
          </div>
        ) : (
          <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs font-mono text-emerald-400">
            {rawResponse || 'No response data yet.'}
          </pre>
        )}
      </div>
    </div>
  );
};
