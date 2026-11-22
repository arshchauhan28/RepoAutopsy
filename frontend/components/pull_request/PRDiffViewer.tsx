'use client'

import { useState, useMemo } from 'react'
import {
  FileText,
  Copy,
  Check,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FileCode,
} from 'lucide-react'
import type { PRChangedFile } from '@/lib/api'

interface PRDiffViewerProps {
  files: PRChangedFile[]
}

export function PRDiffViewer({ files }: PRDiffViewerProps) {
  const [search, setSearch] = useState('')
  const [selectedFilename, setSelectedFilename] = useState<string>(files[0]?.filename || '')
  const [copiedFile, setCopiedFile] = useState<string | null>(null)

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return files
    const query = search.toLowerCase()
    return files.filter(
      (f) =>
        f.filename.toLowerCase().includes(query) ||
        (f.previous_filename && f.previous_filename.toLowerCase().includes(query))
    )
  }, [files, search])

  const currentFile = useMemo(() => {
    return files.find((f) => f.filename === selectedFilename) || filteredFiles[0] || files[0]
  }, [files, selectedFilename, filteredFiles])

  const handleCopyPatch = (patch: string | null | undefined, filename: string) => {
    if (!patch) return
    navigator.clipboard.writeText(patch)
    setCopiedFile(filename)
    setTimeout(() => setCopiedFile(null), 2000)
  }

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'added':
        return <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold font-mono text-emerald-400">ADDED</span>
      case 'removed':
        return <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold font-mono text-rose-400">REMOVED</span>
      case 'renamed':
        return <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold font-mono text-blue-400">RENAMED</span>
      default:
        return <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold font-mono text-amber-300">MODIFIED</span>
    }
  }

  const renderPatchLines = (patch: string) => {
    const lines = patch.split('\n')
    return (
      <div className="font-mono text-[11px] leading-5">
        {lines.map((line, idx) => {
          let bgClass = 'text-[#c8c4bc]'
          let prefixSign = ' '

          if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
            bgClass = 'bg-blue-500/10 text-blue-300 select-none py-0.5'
          } else if (line.startsWith('+')) {
            bgClass = 'bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-500'
            prefixSign = '+'
          } else if (line.startsWith('-')) {
            bgClass = 'bg-rose-500/10 text-rose-300 border-l-2 border-rose-500'
            prefixSign = '-'
          }

          return (
            <div key={idx} className={`flex px-2 py-0.2 hover:bg-white/[.02] ${bgClass}`}>
              <span className="w-8 select-none text-right pr-2 text-[#55524c]">{idx + 1}</span>
              <pre className="overflow-x-auto whitespace-pre font-mono">{line}</pre>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* File Sidebar (4 cols) */}
      <div className="card p-3 lg:col-span-4 flex flex-col h-[650px]">
        <div className="relative mb-2">
          <Search size={13} className="absolute left-2.5 top-2.5 text-[#55524c]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter changed files..."
            className="w-full rounded-md border border-white/[.08] bg-white/[.02] pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#55524c] focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {filteredFiles.map((f) => {
            const isSelected = f.filename === currentFile?.filename
            return (
              <button
                key={f.filename}
                onClick={() => setSelectedFilename(f.filename)}
                className={`w-full text-left rounded-lg p-2.5 transition flex items-start justify-between gap-2 ${
                  isSelected
                    ? 'border border-amber-400/40 bg-amber-400/10 text-white'
                    : 'border border-transparent hover:border-white/[.08] hover:bg-white/[.03] text-[#aaa69e]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {renderStatusBadge(f.status)}
                    <span className="truncate text-xs font-mono font-medium">{f.filename.split('/').pop()}</span>
                  </div>
                  <div className="mt-1 truncate font-mono text-[10px] text-[#77736c]">{f.filename}</div>
                </div>

                <div className="shrink-0 text-right font-mono text-[10px]">
                  <span className="text-emerald-400">+{f.additions}</span>{' '}
                  <span className="text-rose-400">-{f.deletions}</span>
                </div>
              </button>
            )
          })}

          {filteredFiles.length === 0 && (
            <div className="p-4 text-center text-xs text-[#77736c]">No matching files found.</div>
          )}
        </div>
      </div>

      {/* Diff Code Inspector (8 cols) */}
      <div className="card p-4 lg:col-span-8 flex flex-col h-[650px]">
        {currentFile ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] pb-3 mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileCode size={16} className="text-amber-400 shrink-0" />
                  <span className="truncate font-mono text-xs font-semibold text-white">
                    {currentFile.filename}
                  </span>
                  {renderStatusBadge(currentFile.status)}
                </div>
                {currentFile.previous_filename && (
                  <div className="text-[10px] font-mono text-[#77736c] mt-0.5">
                    Renamed from: {currentFile.previous_filename}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="font-mono text-xs">
                  <span className="text-emerald-400 font-semibold">+{currentFile.additions}</span>{' '}
                  <span className="text-rose-400 font-semibold">-{currentFile.deletions}</span>
                </div>
                {currentFile.patch && (
                  <button
                    onClick={() => handleCopyPatch(currentFile.patch, currentFile.filename)}
                    className="inline-flex items-center gap-1 rounded border border-white/[.1] bg-white/[.03] px-2.5 py-1 text-[11px] text-[#aaa69e] hover:text-white transition"
                    title="Copy diff patch"
                  >
                    {copiedFile === currentFile.filename ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy Patch</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {currentFile.is_truncated && (
              <div className="mb-3 flex items-center gap-2 rounded border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-300">
                <AlertTriangle size={13} className="shrink-0" />
                <span>Large diff patch was truncated to preserve browser responsiveness.</span>
              </div>
            )}

            {currentFile.is_binary ? (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-[#77736c]">
                Binary file change. Diffs are not text-rendered.
              </div>
            ) : currentFile.patch ? (
              <div className="flex-1 overflow-auto rounded border border-white/[.06] bg-[#080a0d] custom-scrollbar">
                {renderPatchLines(currentFile.patch)}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-[#77736c]">
                No textual patch available for this file.
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-[#77736c]">
            Select a file to view its code changes.
          </div>
        )}
      </div>
    </div>
  )
}
