'use client'

import React, { FormEvent, useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Github, Loader2, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createAnalysis } from '@/lib/api'

function AnalyzeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<'idle' | 'validating' | 'starting'>('idle')

  useEffect(() => {
    const queryUrl = searchParams.get('url')
    if (queryUrl) {
      setUrl(queryUrl)
    }
  }, [searchParams])

  const validateUrl = (input: string): boolean => {
    const githubRegex = /^https?:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?.*$/
    return githubRegex.test(input.trim())
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const cleanUrl = url.trim()

    if (!cleanUrl) {
      setError('Please provide a GitHub repository URL.')
      return
    }

    if (!validateUrl(cleanUrl)) {
      setError('Invalid format. Please enter a valid GitHub URL, e.g. https://github.com/owner/repository')
      return
    }

    setLoading(true)
    setStage('starting')

    try {
      const result = await createAnalysis(cleanUrl)
      router.push(`/repositories/${result.id}`)
    } catch (err: any) {
      setError(err?.message || 'Unable to start analysis. The repository might be private, not found, or rate-limited.')
      setStage('idle')
    } finally {
      setLoading(false)
    }
  }

  const sampleRepositories = [
    { label: 'fastapi/fastapi', url: 'https://github.com/fastapi/fastapi' },
    { label: 'pallets/flask', url: 'https://github.com/pallets/flask' },
    { label: 'expressjs/express', url: 'https://github.com/expressjs/express' },
  ]

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f3f4f6]">
      <Nav />
      <main className="mx-auto flex min-h-[calc(100vh-56px)] max-w-3xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-amber-400">
              New Repository Analysis
            </span>
            <h1 className="mt-2 text-2xl xs:text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              Inspect any GitHub repository
            </h1>
            <p className="mt-2 sm:mt-3 text-xs xs:text-sm text-[#9ca3af] leading-relaxed">
              RepoAutopsy fetches the codebase safely, builds an interactive anatomy graph of subsystems, evaluates quality findings, and prepares a Case Report.
            </p>
          </div>

          <form
            onSubmit={submit}
            className="rounded-xl border border-white/[.1] bg-[#0d0f12] p-4 sm:p-8 space-y-5 shadow-2xl"
          >
            <div>
              <Input
                label="GitHub Repository URL"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (error) setError('')
                }}
                placeholder="https://github.com/owner/repository"
                leftIcon={<Github size={16} />}
                disabled={loading}
                autoFocus
                required
                className="h-12 bg-black/40 text-sm"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-rose-500/30 bg-rose-500/[.06] p-3.5 text-xs text-rose-300 flex items-start gap-2"
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                <div className="space-y-1">
                  <p className="font-medium">Analysis couldn't be started</p>
                  <p className="text-rose-300/80 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              className="w-full h-12"
            >
              {loading ? 'Queuing Analysis…' : 'Start Codebase Analysis'}
            </Button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/[.06] text-xs text-[#9ca3af]">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck size={14} className="shrink-0" />
                <span>Deterministic AST Inspection</span>
              </span>
              <span className="text-[#6b7280] text-[11px] sm:text-xs">Supports TypeScript, Python, JavaScript, Go</span>
            </div>
          </form>

          {/* QUICK SAMPLES */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-mono text-[#6b7280] uppercase tracking-wider block">
              Or explore popular open-source repositories:
            </span>
            <div className="flex flex-wrap gap-2">
              {sampleRepositories.map((sample) => (
                <button
                  key={sample.url}
                  type="button"
                  onClick={() => setUrl(sample.url)}
                  className="rounded-md border border-white/[.08] bg-white/[.02] px-3 py-2 font-mono text-xs text-[#9ca3af] hover:border-amber-400/40 hover:text-white transition-colors min-h-[38px] truncate max-w-full"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#08090b]">
          <Nav />
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  )
}
