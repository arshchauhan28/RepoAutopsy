import React from 'react'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ReactNode
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs font-mono ${className}`}>
      <ol className="flex items-center flex-wrap gap-1.5 text-[#9ca3af]">
        <li className="flex items-center">
          <Link
            href="/"
            className="hover:text-white transition-colors flex items-center gap-1 text-[#6b7280]"
            aria-label="Home"
          >
            <Home size={12} />
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={index} className="flex items-center gap-1.5">
              <ChevronRight size={12} className="text-[#4b5563] shrink-0" aria-hidden="true" />
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-white transition-colors flex items-center gap-1 max-w-[160px] sm:max-w-[200px] truncate"
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </Link>
              ) : (
                <span
                  className={`flex items-center gap-1 max-w-[200px] sm:max-w-[280px] truncate ${
                    isLast ? 'text-white font-medium' : ''
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
