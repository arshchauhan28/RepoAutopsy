'use client'

import { useState } from 'react'
import { GitPullRequest, X, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import { analyzePullRequest, type PullRequestAnalysis } from '@/lib/api'

interface AnalyzePRModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (pr: PullRequestAnalysis) => void
  repositoryId?: string
  defaultOwner?: string
  defaultRepo?: string
}

export function AnalyzePRModal({
  isOpen,
  onClose,
  onSuccess,
  repositoryId,
  defaultOwner,
  defaultRepo,
}: AnalyzePRModalProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const defaultPlaceholder = defaultOwner && defaultRepo
    ? `https://github.com/${defaultOwner}/${defaultRepo}/pull/1`
    : 'https://github.com/owner/repository/pull/123'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please provide a GitHub pull request URL.')
      return
    }

    if (!trimmed.includes('github.com/') || !trimmed.includes('/pull/')) {
      setError('Invalid URL. Expected format: https://github.com/owner/repository/pull/123')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const pr = await analyzePullRequest(trimmed, repositoryId)
      onSuccess(pr)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to analyze pull request. Check that the repository and PR number are public.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl border border-white/[.15] bg-[#0c0f13] p-6 shadow-2xl">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 text-[#77736c] hover:text-white transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-400">
            <GitPullRequest size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-white">Pull Request Autopsy</h3>
            <p className="text-xs text-[#77736c]">Analyze code change impact, regressions & architecture delta</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-[#aaa69e]">
              GitHub Pull Request URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={defaultPlaceholder}
              disabled={loading}
              className="mt-1.5 w-full rounded-lg border border-white/[.12] bg-white/[.03] px-3.5 py-2.5 text-xs text-white placeholder-[#55524c] focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/[.04] p-3 text-xs text-amber-300/90 flex items-center gap-2.5">
              <Loader2 size={15} className="animate-spin text-amber-400" />
              <span>Ingesting changed files, extracting AST diffs, and evaluating dependency impact...</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-white/[.1] px-4 py-2 text-xs font-medium text-[#aaa69e] hover:bg-white/[.04] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-amber-400 px-4 py-2 text-xs font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <span>Run Autopsy</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
