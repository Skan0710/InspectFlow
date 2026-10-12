import React from 'react';
import { Link } from 'react-router-dom';

export const ProductFooter: React.FC = () => (
  <footer className="relative mt-12 border-t border-white/10 bg-indigo-950/60 py-6 pb-24 text-sm text-indigo-50 backdrop-blur-md">
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 lg:px-8">
      <p className="flex items-center gap-2 font-semibold text-white">
        InsightFlow
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Pipeline active
        </span>
      </p>
      <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <Link to="/feedback" className="hover:text-white">Feedback</Link>
        <Link to="/insights" className="hover:text-white">Insights</Link>
        <Link to="/actions" className="hover:text-white">Actions</Link>
        <Link to="/reports" className="hover:text-white">Reports</Link>
      </nav>
    </div>
  </footer>
);
