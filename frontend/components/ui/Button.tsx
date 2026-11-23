import React from 'react'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors duration-150 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090b] disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.99]'

    const sizeStyles = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5 min-h-[30px]',
      md: 'text-xs sm:text-sm px-3.5 py-2 gap-2 min-h-[38px]',
      lg: 'text-sm sm:text-base px-5 py-2.5 gap-2.5 min-h-[46px]',
    }

    const variantStyles = {
      primary:
        'bg-amber-400 text-black hover:bg-amber-300 border border-amber-400/40 font-semibold shadow-sm',
      secondary:
        'bg-white/[.05] text-[#e8e6e1] hover:bg-white/[.08] hover:text-white border border-white/[.12]',
      outline:
        'bg-transparent text-[#aaa69e] hover:text-white hover:border-amber-400/40 border border-white/[.14]',
      ghost:
        'bg-transparent text-[#aaa69e] hover:text-white hover:bg-white/[.04] border border-transparent',
      danger:
        'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 border border-rose-500/30',
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="animate-spin shrink-0 h-4 w-4" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
