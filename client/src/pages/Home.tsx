import { Button } from '../components/ui/Button';
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Layers, 
  Server, 
  Zap, 
  ArrowRight, 
  Terminal, 
  Sparkles,
  BarChart3,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Link } from 'react-router-dom';
import type { HealthResponse } from '../types/api';
import { gsap, useGsapContext, prefersReducedMotion } from '../lib/animations/gsap';
import { HeroBackground } from '../components/canvas/HeroBackground';

const mockTelemetryData = [
  { time: '00:00', requests: 120, latency: 18 },
  { time: '04:00', requests: 240, latency: 22 },
  { time: '08:00', requests: 680, latency: 25 },
  { time: '12:00', requests: 950, latency: 31 },
  { time: '16:00', requests: 840, latency: 24 },
  { time: '20:00', requests: 590, latency: 19 },
  { time: '24:00', requests: 310, latency: 16 },
];

export const Home: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const homeRef = useRef<HTMLDivElement>(null);

  useGsapContext(homeRef, () => {
    if (prefersReducedMotion()) return;

    gsap.from(['.home-hero-badge', '.home-hero-title', '.home-hero-desc', '.home-hero-ctas'], {
      opacity: 0,
      y: 22,
      stagger: 0.1,
      duration: 0.7,
      ease: 'power3.out',
    });
  });

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data: HealthResponse = await res.json();
        setHealth(data);
      } else {
        setHealth(null);
      }
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div ref={homeRef} className="space-y-12 py-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-8 sm:p-12 shadow-2xl backdrop-blur-xl"
      >
        {/* Immersive 3D ShaderGradient Background Atmosphere */}
        <HeroBackground className="absolute inset-0 pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="home-hero-badge inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-medium text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            Build Battle 2026 Ready Scaffold
          </div>

          <h1 className="home-hero-title text-3xl font-extrabold tracking-tight text-white sm:text-5xl sm:leading-tight">
            Welcome to{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              InsightFlow
            </span>
          </h1>

          <p className="home-hero-desc text-base sm:text-lg leading-relaxed text-slate-300">
            A production-ready full-stack TypeScript scaffold. Equipped with React 19, Vite, Tailwind CSS, 
            Lucide Icons, Framer Motion, Recharts, and Express backend with hot reloading.
          </p>

          <div className="home-hero-ctas flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/status"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 hover:shadow-indigo-600/40"
            >
              <Terminal className="h-4 w-4" />
              Check API Health
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Button
          variant="outline"
          onClick={fetchHealth}
          disabled={loading}
          leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh Backend Ping
        </Button>
          </div>
        </div>
      </motion.div>

      {/* Stack Verification Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-400">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Frontend Core</h3>
              <p className="text-xs text-slate-400">React 19 + TypeScript + Vite</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Tailwind CSS configured & active
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              React Router DOM v7 client routing
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Lucide React icons & Framer Motion
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Backend Core</h3>
              <p className="text-xs text-slate-400">Node.js + Express + TS</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Express 4 + CORS + dotenv configured
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Hot reload powered by tsx watch
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Typed health check route (/api/health)
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Dev Orchestration</h3>
              <p className="text-xs text-slate-400">Unified Root CLI</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Single `npm run dev` starts both
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Safe `.env.example` configurations
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Independent client & server builds
            </li>
          </ul>
        </motion.div>
      </div>

      {/* Visual Component Verification: Recharts Preview */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8"
      >
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400">
              <BarChart3 className="h-4 w-4" />
              Recharts & Telemetry Preview
            </div>
            <h2 className="text-xl font-bold text-white">Synthetic System Throughput</h2>
            <p className="text-xs text-slate-400">
              Demonstrating Recharts data visualization configured for InsightFlow dashboards
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              Requests/min
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-pink-500" />
              Latency (ms)
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockTelemetryData}>
              <defs>
                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
              <Area 
                type="monotone" 
                dataKey="requests" 
                stroke="#6366f1" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorRequests)" 
              />
              <Area 
                type="monotone" 
                dataKey="latency" 
                stroke="#ec4899" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorLatency)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Backend Live Ping Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Live API Status</div>
              <div className="text-xs text-slate-400 font-mono">
                {health ? `Uptime: ${Math.round(health.uptime)}s | Env: ${health.environment}` : 'Waiting for connection...'}
              </div>
            </div>
          </div>
          <div className="text-xs font-mono">
            {health ? (
              <span className="rounded-md bg-emerald-500/10 px-3 py-1 text-emerald-400 border border-emerald-500/20">
                200 OK: {health.message}
              </span>
            ) : (
              <span className="rounded-md bg-amber-500/10 px-3 py-1 text-amber-400 border border-amber-500/20">
                Connecting to localhost:5000/api/health
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
