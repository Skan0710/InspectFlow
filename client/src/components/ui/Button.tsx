import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { AnimatedButton } from './animated-button';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-400 hover:via-indigo-500 hover:to-purple-500 active:from-indigo-700 active:to-purple-700 border-2 border-white shadow-xl shadow-indigo-950/50 hover:shadow-indigo-500/35 hover:ring-2 hover:ring-indigo-300 transition-all cursor-pointer',
  secondary:
    'bg-[#1e1b4b] text-white font-semibold hover:bg-[#282463] active:bg-[#161338] border-2 border-white shadow-lg shadow-black/40 cursor-pointer',
  outline:
    'bg-[#1e1b4b] text-white font-semibold border-2 border-white hover:bg-[#282463] active:bg-[#161338] shadow-md shadow-black/30 transition-all cursor-pointer',
  ghost:
    'bg-[#1e1b4b] text-white font-semibold hover:bg-indigo-900 active:bg-indigo-950 border-2 border-white shadow-sm cursor-pointer',
  danger:
    'bg-rose-600 text-white font-semibold hover:bg-rose-500 active:bg-rose-700 border-2 border-white shadow-lg shadow-rose-950/40 cursor-pointer',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm font-medium gap-2 rounded-xl',
  md: 'px-4.5 py-2.5 text-base font-semibold gap-2.5 rounded-xl',
  lg: 'px-6 py-3.5 text-lg font-semibold gap-3 rounded-2xl',
  xl: 'px-8 py-4 text-xl font-bold gap-3.5 rounded-2xl shadow-2xl shadow-indigo-500/30 ring-2 ring-white/20',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <AnimatedButton
        ref={ref}
        disabled={disabled || isLoading}
        className={`gap-2 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...(props as Record<string, unknown>)}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </AnimatedButton>
    );
  }
);

Button.displayName = 'Button';
