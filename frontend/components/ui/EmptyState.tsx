import React from 'react'
import { FolderOpen } from 'lucide-react'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon = <FolderOpen size={32} className="text-[#6b7280]" />,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-lg border border-dashed border-white/[.12] bg-white/[.01] p-8 sm:p-12 text-center max-w-xl mx-auto flex flex-col items-center justify-center space-y-3.5 ${className}`}
    >
      <div className="grid h-12 w-12 place-items-center rounded-full bg-white/[.04] border border-white/[.08]">
        {icon}
      </div>
      <div className="space-y-1">
        <h4 className="text-sm sm:text-base font-semibold text-white">{title}</h4>
        <p className="text-xs sm:text-sm text-[#9ca3af] max-w-sm leading-relaxed">{description}</p>
      </div>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
