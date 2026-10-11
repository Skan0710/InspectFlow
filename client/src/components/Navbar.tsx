import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, ShieldCheck, Wifi, WifiOff, Terminal, Compass } from 'lucide-react';
import type { HealthResponse } from '../types/api';

export const Navbar: React.FC = () => {
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data: HealthResponse = await res.json();
          setBackendHealthy(data.status === 'ok');
        } else {
          setBackendHealthy(false);
        }
      } catch {
        setBackendHealthy(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/25">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">InsightFlow</span>
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-400 border border-indigo-500/20">
                2026
              </span>
            </div>
            <p className="text-xs text-slate-400">Build Battle Starter</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`
            }
          >
            <Compass className="h-4 w-4" />
            <span>Overview</span>
          </NavLink>

          <NavLink
            to="/status"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`
            }
          >
            <Terminal className="h-4 w-4" />
            <span>API Status</span>
          </NavLink>
        </nav>

        {/* Backend health pill */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
          {backendHealthy === null ? (
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
              Connecting...
            </span>
          ) : backendHealthy ? (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Wifi className="h-3.5 w-3.5" />
              Backend Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-400">
              <WifiOff className="h-3.5 w-3.5" />
              Backend Offline
            </span>
          )}
          <span className="h-3 w-px bg-slate-700" />
          <span className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
            Dev Mode
          </span>
        </div>
      </div>
    </header>
  );
};
