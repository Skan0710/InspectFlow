import React from 'react';
import { Cpu, Heart, Code2 } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/50 py-6 text-xs text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-indigo-400" />
          <span>InsightFlow • Build Battle 2026 Ready</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Engineered with</span>
          <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500/20" />
          <span>using Vite, React, Express & Tailwind CSS</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-slate-400">
          <Code2 className="h-3.5 w-3.5 text-slate-500" />
          <span>client: 5173 / server: 5000</span>
        </div>
      </div>
    </footer>
  );
};
