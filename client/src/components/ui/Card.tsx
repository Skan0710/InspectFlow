import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-900/60 via-indigo-950/80 to-indigo-950/90 shadow-lg shadow-black/20 transition-[border-color,box-shadow] duration-300 hover:border-indigo-300/30 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`p-5 sm:p-6 pb-0 flex flex-col gap-1.5 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <h3
      className={`text-base sm:text-lg font-semibold tracking-tight text-slate-900 ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <p className={`text-xs sm:text-sm text-slate-500 leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`p-5 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`px-5 sm:p-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-xl flex items-center justify-between text-xs text-slate-500 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
