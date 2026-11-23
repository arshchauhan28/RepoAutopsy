import React from 'react'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'text'
}

export function Skeleton({
  variant = 'rectangular',
  className = '',
  ...props
}: SkeletonProps) {
  const variantStyles = {
    rectangular: 'rounded-md',
    circular: 'rounded-full',
    text: 'rounded h-4 w-full',
  }

  return (
    <div
      className={`animate-pulse bg-white/[.06] ${variantStyles[variant]} ${className}`}
      {...props}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-white/[.08] bg-[#0d0f12] p-5 space-y-3.5">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  )
}
