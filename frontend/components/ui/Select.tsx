'use client'

import React, { useState, useRef, useEffect, useId, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  description?: string
  badge?: string
  disabled?: boolean
}

export interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  menuClassName?: string
  accentColor?: 'amber' | 'purple'
  ariaLabel?: string
  name?: string
  id?: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  menuClassName = '',
  accentColor = 'amber',
  ariaLabel,
  name,
  id,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const [menuPosition, setMenuPosition] = useState<{
    top: number
    left: number
    width: number
    openUpward: boolean
    maxHeight: number
  }>({
    top: 0,
    left: 0,
    width: 0,
    openUpward: false,
    maxHeight: 280,
  })

  const generatedId = useId()
  const selectId = id || generatedId
  const listboxId = `${selectId}-listbox`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const selectedOption = options.find(o => o.value === value)

  // Calculate portal positioning based on trigger bounding box and viewport bounds
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const estimatedHeight = Math.min(options.length * 44 + 16, 280)

    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow
    const maxHeight = Math.max(140, Math.min(280, openUpward ? spaceAbove - 8 : spaceBelow - 8))

    setMenuPosition({
      top: openUpward ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
      openUpward,
      maxHeight,
    })
  }, [options.length])

  const openMenu = () => {
    if (disabled) return
    updatePosition()
    const currentIndex = options.findIndex(o => o.value === value && !o.disabled)
    setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0)
    setIsOpen(true)
  }

  const closeMenu = (restoreFocus = true) => {
    setIsOpen(false)
    setHighlightedIndex(-1)
    if (restoreFocus && triggerRef.current) {
      triggerRef.current.focus()
    }
  }

  // Handle position recalculation on scroll/resize when open
  useEffect(() => {
    if (!isOpen) return

    const handleScrollOrResize = () => {
      updatePosition()
    }

    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('scroll', handleScrollOrResize, true)

    return () => {
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    }
  }, [isOpen, updatePosition])

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        closeMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  // Scroll active item into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !menuRef.current) return
    const activeEl = menuRef.current.querySelector(`[data-index="${highlightedIndex}"]`) as HTMLElement | null
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex, isOpen])

  // Keyboard navigation on trigger button
  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openMenu()
    }
  }

  // Keyboard navigation in listbox
  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeMenu(true)
      return
    }

    if (e.key === 'Tab') {
      closeMenu(false)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      let nextIndex = highlightedIndex + 1
      while (nextIndex < options.length && options[nextIndex].disabled) {
        nextIndex++
      }
      if (nextIndex < options.length) {
        setHighlightedIndex(nextIndex)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      let prevIndex = highlightedIndex - 1
      while (prevIndex >= 0 && options[prevIndex].disabled) {
        prevIndex--
      }
      if (prevIndex >= 0) {
        setHighlightedIndex(prevIndex)
      }
      return
    }

    if (e.key === 'Home') {
      e.preventDefault()
      const firstEnabled = options.findIndex(o => !o.disabled)
      if (firstEnabled >= 0) setHighlightedIndex(firstEnabled)
      return
    }

    if (e.key === 'End') {
      e.preventDefault()
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) {
          setHighlightedIndex(i)
          break
        }
      }
      return
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        const option = options[highlightedIndex]
        if (!option.disabled) {
          onChange(option.value)
          closeMenu(true)
        }
      }
    }
  }

  const isPurple = accentColor === 'purple'
  const ringAccent = isPurple ? 'focus:ring-purple-400/40 focus:border-purple-400' : 'focus:ring-amber-400/40 focus:border-amber-400'
  const hoverBorder = isPurple ? 'hover:border-purple-400/40' : 'hover:border-amber-400/40'
  const selectedAccentText = isPurple ? 'text-purple-300' : 'text-amber-300'
  const activeBg = isPurple ? 'bg-purple-500/15 text-white' : 'bg-amber-500/15 text-white'

  const menu = isOpen && mounted && (
    <div
      ref={menuRef}
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel || placeholder}
      tabIndex={-1}
      onKeyDown={handleMenuKeyDown}
      style={{
        position: 'fixed',
        top: menuPosition.openUpward ? undefined : `${menuPosition.top}px`,
        bottom: menuPosition.openUpward ? `${window.innerHeight - menuPosition.top}px` : undefined,
        left: `${menuPosition.left}px`,
        width: `${Math.max(menuPosition.width, 180)}px`,
        maxHeight: `${menuPosition.maxHeight}px`,
        zIndex: 9999,
      }}
      className={`overflow-y-auto rounded-lg border border-[#27272A] bg-[#111318] p-1.5 shadow-2xl backdrop-blur-md transition-all duration-150 animate-in fade-in-0 zoom-in-95 ${menuClassName}`}
    >
      {options.map((opt, idx) => {
        const isSelected = opt.value === value
        const isHighlighted = idx === highlightedIndex

        return (
          <div
            key={opt.value}
            id={`${selectId}-opt-${idx}`}
            role="option"
            data-index={idx}
            aria-selected={isSelected}
            aria-disabled={opt.disabled}
            onClick={() => {
              if (opt.disabled) return
              onChange(opt.value)
              closeMenu(true)
            }}
            onMouseEnter={() => {
              if (!opt.disabled) setHighlightedIndex(idx)
            }}
            className={`group relative flex min-h-[38px] cursor-pointer select-none items-center justify-between gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors duration-100 ${
              opt.disabled
                ? 'cursor-not-allowed opacity-40'
                : isHighlighted
                ? activeBg
                : isSelected
                ? 'bg-white/[.04] text-white'
                : 'text-[#c8c4bc] hover:bg-white/[.04] hover:text-white'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`truncate font-medium ${isSelected ? selectedAccentText : ''}`}>
                  {opt.label}
                </span>
                {opt.badge && (
                  <span className="shrink-0 rounded bg-white/[.06] border border-white/[.08] px-1.5 py-0.2 font-mono text-[10px] text-[#8e8a82]">
                    {opt.badge}
                  </span>
                )}
              </div>
              {opt.description && (
                <div className="truncate text-[10px] text-[#71717A] mt-0.5">
                  {opt.description}
                </div>
              )}
            </div>

            {isSelected && (
              <Check size={14} className={`shrink-0 ${selectedAccentText}`} />
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="relative inline-block w-full">
      {/* Hidden native input for form compatibility */}
      {name && <input type="hidden" name={name} value={value} />}

      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => (isOpen ? closeMenu(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[#27272A] bg-[#0B0D10] px-3 py-1.5 text-xs text-[#F4F4F5] transition duration-150 ${hoverBorder} ${ringAccent} focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-[#A1A1AA] transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {mounted && typeof document !== 'undefined' && createPortal(menu, document.body)}
    </div>
  )
}
