import React from 'react';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-900/50 via-indigo-950/70 to-violet-950/60 p-8 sm:p-12 text-center ${className}`}
    >
      <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 text-white shadow-lg shadow-indigo-950/50">
        {icon}
      </div>
      <h3 className="relative text-lg font-semibold text-white">{title}</h3>
      <p className="relative mt-1.5 max-w-sm text-sm text-indigo-100 leading-relaxed">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
};
