import React from 'react'

interface CodePulseLogoProps {
  size?: number
  className?: string
  withContainer?: boolean
}

export function CodePulseLogo({
  size = 20,
  className = '',
  withContainer = false,
}: CodePulseLogoProps) {
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Left Code Bracket */}
      <path
        d="M15 18L7 32L15 46"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Diagnostic Pulse Waveform */}
      <path
        d="M18 32H22L25 35L30 15L35 49L39 27L42 32H46"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right Code Bracket */}
      <path
        d="M49 18L57 32L49 46"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  if (!withContainer) {
    return svg
  }

  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[.12] bg-[#111418] text-amber-400 transition-colors duration-200 group-hover:border-amber-400/40 group-hover:bg-[#15181d] shadow-sm">
      {svg}
    </span>
  )
}
