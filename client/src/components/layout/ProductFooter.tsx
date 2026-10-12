import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu } from 'lucide-react';

export const ProductFooter: React.FC = () => {
  return (
    <footer className="mt-16 border-t border-white/10 bg-indigo-950/60 backdrop-blur-md pt-8 pb-24 text-indigo-50 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white tracking-tight text-sm">
                InsightFlow
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Pipeline Active
              </span>
            </div>
            <p className="text-indigo-50 text-[11px] max-w-md">
              AI-powered customer feedback intelligence platform. Ingests raw reviews, identifies critical issues through deterministic priority scoring, and automates executive briefings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-indigo-100">
            <Link to="/" className="hover:text-white transition-colors">
              Overview
            </Link>
            <Link to="/feedback" className="hover:text-white transition-colors">
              Feedback Explorer
            </Link>
            <Link to="/actions" className="hover:text-white transition-colors">
              Action Center
            </Link>
            <Link to="/reports" className="hover:text-white transition-colors">
              Executive Reports
            </Link>
            <Link to="/adaption" className="hover:text-white transition-colors">
              Adaption Lab
            </Link>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-indigo-100">
          <p>
            © 2026 InsightFlow Intelligence. Operational triage and priority matrix metrics are calculated deterministically.
          </p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <Cpu className="h-3 w-3 text-indigo-100" />
              Engine: React 19 + GSAP + Lenis + WebGL
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
