import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { AnimatedButton } from './animated-button';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-500 text-white hover:bg-indigo-400 active:bg-indigo-600 border border-white/20 shadow-lg shadow-indigo-950/40',
  secondary:
    'bg-indigo-950 text-white hover:bg-indigo-900 active:bg-black border border-white/20 shadow-lg shadow-black/30',
  outline:
    'bg-white/10 text-white border border-white/30 hover:bg-white/20 active:bg-white/25 backdrop-blur-sm',
  ghost:
    'bg-transparent text-white hover:bg-white/15 active:bg-white/20 border border-transparent',
  danger:
    'bg-rose-500 text-white hover:bg-rose-400 active:bg-rose-600 border border-white/20 shadow-lg shadow-rose-950/40',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs font-medium gap-1.5 rounded-lg',
  md: 'px-3.5 py-2 text-sm font-medium gap-2 rounded-lg',
  lg: 'px-4.5 py-2.5 text-base font-medium gap-2.5 rounded-xl',
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
