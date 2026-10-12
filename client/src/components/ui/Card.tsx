import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`rounded-2xl border border-white/15 bg-indigo-950/60 shadow-xl shadow-black/20 backdrop-blur-md transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-950/75 ${className}`}
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
      className={`text-lg sm:text-xl font-bold tracking-tight text-white ${className}`}
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
    <p className={`text-sm sm:text-base text-indigo-100/80 leading-relaxed ${className}`} {...props}>
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
      className={`px-5 sm:p-6 py-4 border-t border-white/10 rounded-b-2xl flex items-center justify-between text-xs text-indigo-200/80 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
