'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, BrainCircuit, Loader2, Send, Trophy, CheckCircle2, ShieldAlert } from 'lucide-react'
import { useParams } from 'next/navigation'
import { Nav } from '@/components/Nav'
import {
  answerInterview,
  getInterview,
  getAnalysis,
  startInterview,
  type Analysis,
  type Interview,
} from '@/lib/api'

export function CodeVitalsView() {
  const params = useParams<{ id: string }>()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [interview, setInterview] = useState<Interview | null>(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const a = await getAnalysis(params.id)
        setAnalysis(a)
        const stored =
          typeof window !== 'undefined'
            ? localStorage.getItem(`repoautopsy-codevitals-${params.id}`) ||
              localStorage.getItem(`repolens-interview-${params.id}`)
            : null
        if (stored) {
          const iv = await getInterview(stored)
          setInterview(iv)
        }
      } catch (e: any) {
        setError(e?.message || 'Unable to load CodeVitals session')
      } finally {
        setLoading(false)
      }
    })()
  }, [params.id])

  async function begin() {
    setError('')
    try {
      const i = await startInterview(params.id, 8)
      setInterview(i)
      if (typeof window !== 'undefined') {
        localStorage.setItem(`repoautopsy-codevitals-${params.id}`, i.id)
        localStorage.setItem(`repolens-interview-${params.id}`, i.id)
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to start CodeVitals')
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!interview || !answer.trim()) return
    setSending(true)
    setError('')
    try {
      const next = await answerInterview(interview.id, answer.trim())
      setInterview(next)
      setAnswer('')
    } catch (e: any) {
      setError(e?.message || 'Failed to submit response')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-4xl px-4 py-16 text-sm text-[#77736c] sm:px-6">
          Loading CodeVitals session…
        </main>
      </div>
    )
  }

  const current = interview?.turns?.[interview.current_index]

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-7 pb-16 sm:px-6 sm:py-10 sm:pb-20">
        <Link
          href={`/repositories/${params.id}`}
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#66625b] transition hover:text-white"
        >
          <ArrowLeft size={14} /> Back to repository
        </Link>

        {/* PAGE HEADER */}
        <div className="mt-7 flex flex-col gap-5 border-b border-white/[.08] pb-6 sm:flex-row sm:items-end sm:justify-between reveal">
          <div>
            <div className="flex items-center gap-2 text-amber-300">
              <BrainCircuit size={18} />
              <span className="font-mono text-[10px] uppercase tracking-[.16em]">CodeVitals Assessment</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl text-white">
              How well do you know your codebase?
            </h1>
            <p className="mt-2 truncate font-mono text-[11px] text-[#8a867f]">
              {analysis?.owner}/{analysis?.repo_name}
            </p>
          </div>

          {interview && (
            <div className="sm:text-right">
              <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">Progress</div>
              <div className="mt-1 font-mono text-lg text-white">
                {Math.min(interview.current_index + 1, interview.turns.length)} / {interview.turns.length}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-5 border border-rose-400/20 bg-rose-400/[.05] p-3 text-sm text-rose-300 reveal">
            {error}
          </div>
        )}

        {/* PRE-ASSESSMENT SCREEN */}
        {!interview && (
          <div className="card mt-7 p-5 sm:p-7 reveal">
            <div className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-400">
              / CodeVitals Questions
            </div>
            <h2 className="mt-3 text-xl font-semibold text-white">CodeVitals Questions</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#aaa69e]">
              Test your understanding of the repository through personalized technical questions and discover areas where your knowledge can improve. Questions evaluate your architectural decisions, data flow, failure modes, and technical tradeoffs.
            </p>
            <button
              onClick={begin}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-amber-400/40 bg-amber-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 sm:w-auto"
            >
              Start CodeVitals <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ACTIVE QUESTION ASSESSMENT FORM */}
        {interview?.status === 'active' && current && (
          <form onSubmit={submit} className="card relative mt-7 overflow-hidden p-5 sm:p-7 reveal">
            <div className="scan-overlay opacity-30" />
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <div className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-400">
                  CodeVitals Question {current.question_index + 1}
                </div>
                <div className="h-1.5 flex-1 max-w-36 overflow-hidden bg-white/[.06] sm:max-w-52">
                  <div
                    className="h-full bg-amber-400 transition-all duration-500"
                    style={{
                      width: `${((current.question_index + 1) / interview.turns.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <h2 className="mt-4 text-lg font-medium leading-7 text-white sm:text-xl sm:leading-8">
                {current.question}
              </h2>

              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Explain your reasoning, reference the implementation, and mention tradeoffs…"
                className="mt-6 min-h-48 w-full resize-y border border-white/[.1] bg-black/20 p-4 text-sm leading-6 text-slate-200 outline-none placeholder:text-[#55514b] transition focus:border-amber-400/40 sm:min-h-52"
              />

              <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">
                  Use evidence from the repository
                </span>
                <button
                  disabled={sending || !answer.trim()}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-amber-400/40 bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Submit answer
                </button>
              </div>
            </div>
          </form>
        )}

        {/* COMPLETED ASSESSMENT RESULTS */}
        {interview?.status === 'completed' && (
          <div className="mt-7 space-y-4">
            <div className="card p-6 text-center sm:p-8 reveal">
              <div className="mx-auto grid h-14 w-14 place-items-center border border-emerald-400/20 bg-emerald-400/[.06] text-emerald-300">
                <Trophy size={24} />
              </div>

              <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                Assessment Completed
              </div>
              <h2 className="mt-1 text-2xl font-semibold text-white">CodeVitals Results</h2>

              <div className="mt-4 inline-block rounded-xl border border-white/[.08] bg-white/[.02] px-6 py-3">
                <div className="font-mono text-[9px] uppercase tracking-[.16em] text-[#77736c]">
                  CodeVitals Score
                </div>
                <div className="mt-1 text-5xl font-semibold text-white">
                  {interview.score ?? 0}
                  <span className="text-2xl text-[#77736c]">/100</span>
                </div>
              </div>

              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#aaa69e]">
                {interview.feedback?.summary}
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={`/repositories/${params.id}/report`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-amber-400/40 bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-300"
                >
                  <span>View Case Report</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href={`/repositories/${params.id}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/[.12] bg-white/[.03] px-5 py-3 text-sm font-medium text-[#c8c4bc] hover:bg-white/[.07] hover:text-white"
                >
                  <span>Back to Overview</span>
                </Link>
              </div>
            </div>

            {/* Turn-by-turn evaluations */}
            <div className="space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#77736c]">
                Evaluation Breakdown
              </div>
              {interview.turns.map((t, i) => (
                <div
                  key={t.id}
                  className="card p-4 reveal"
                  style={{ animationDelay: `${Math.min(i, 7) * 45}ms` }}
                >
                  <div className="flex gap-3">
                    <span className="font-mono text-[10px] text-amber-400">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white">{t.question}</div>
                      <div className="mt-3 border border-white/[.06] bg-white/[.02] p-3 text-sm leading-6 text-[#aaa69e]">
                        <span className="font-mono text-[10px] uppercase text-[#77736c] block mb-1">Your Answer:</span>
                        {t.answer}
                      </div>
                      {t.evaluation && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="border border-emerald-400/10 bg-emerald-400/[.04] p-3 text-xs text-[#aaa69e]">
                            <span className="block font-mono text-[9px] uppercase text-emerald-300">
                              Turn Score
                            </span>
                            <b className="mt-1 block text-lg text-white">
                              {t.evaluation.score}/100
                            </b>
                          </div>
                          <div className="border border-white/[.06] bg-white/[.02] p-3 text-xs text-[#aaa69e] sm:col-span-2">
                            <span className="block font-mono text-[9px] uppercase text-amber-300">
                              Verdict
                            </span>
                            <span className="mt-1 block">{t.evaluation.verdict}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

