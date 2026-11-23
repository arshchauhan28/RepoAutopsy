import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './Button'

export interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`rounded-lg border border-rose-500/30 bg-rose-500/[.04] p-5 sm:p-6 text-center max-w-lg mx-auto space-y-3 ${className}`}
    >
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-rose-500/10 text-rose-400">
        <AlertTriangle size={20} />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-rose-300">{title}</h4>
        <p className="text-xs text-[#9ca3af] leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <div className="pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            leftIcon={<RefreshCw size={13} />}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}
