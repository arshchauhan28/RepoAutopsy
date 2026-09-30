'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Loader2,
  Send,
  Trophy,
} from 'lucide-react'
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

export default function InterviewPage() {
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
            ? localStorage.getItem(`repolens-interview-${params.id}`)
            : null

        if (stored) {
          setInterview(await getInterview(stored))
        }
      } catch (e: any) {
        setError(e?.message)
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
      localStorage.setItem(`repolens-interview-${params.id}`, i.id)
    } catch (e: any) {
      setError(e?.message)
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
      setError(e?.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />

        <main className="mx-auto max-w-4xl px-5 py-20 text-slate-400">
          Loading interview…
        </main>
      </div>
    )
  }

  const current = interview?.turns?.[interview.current_index]

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="mx-auto max-w-4xl px-5 py-10 pb-20">
        <Link
          href={`/repositories/${params.id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-white"
        >
          <ArrowLeft size={15} />
          Back to repository
        </Link>

        <div className="mt-8 flex items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-violet-300">
              <BrainCircuit size={19} />
              AI Interviewer
            </div>

            <h1 className="mt-2 text-3xl font-semibold">
              Defend your implementation.
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {analysis?.owner}/{analysis?.repo_name}
            </p>
          </div>

          {interview && (
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-slate-600">
                Progress
              </div>

              <div className="mt-1 text-xl font-semibold">
                {Math.min(
                  interview.current_index + 1,
                  interview.turns.length
                )}{' '}
                / {interview.turns.length}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {!interview && (
          <div className="card mt-8 p-7">
            <h2 className="text-xl font-semibold">
              Project-specific questions
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Questions are generated from the repository architecture,
              languages, metrics, findings and AI review. With no AI key
              configured, RepoAutopsy uses a deterministic fallback set.
            </p>

            <button
              onClick={begin}
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/10 transition-all duration-200 hover:from-violet-500 hover:to-cyan-400 hover:shadow-violet-500/20"
            >
              Start interview
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {interview?.status === 'active' && current && (
          <form
            onSubmit={submit}
            className="card mt-8 p-6 sm:p-8"
          >
            <div className="text-xs uppercase tracking-wider text-slate-600">
              Question {current.question_index + 1}
            </div>

            <h2 className="mt-3 text-xl font-medium leading-8 text-white">
              {current.question}
            </h2>

            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Explain your reasoning, reference the implementation, and mention tradeoffs…"
              className="mt-7 min-h-44 w-full resize-y rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-200 outline-none placeholder:text-slate-600 focus:border-violet-400/40"
            />

            <div className="mt-4 flex justify-end">
              <button
                disabled={sending || !answer.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/10 transition-all duration-200 hover:from-violet-500 hover:to-cyan-400 hover:shadow-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-violet-600 disabled:hover:to-cyan-500"
              >
                {sending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}

                Submit answer
              </button>
            </div>
          </form>
        )}

        {interview?.status === 'completed' && (
          <div className="mt-8 space-y-5">
            <div className="card p-8 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-400/10 text-emerald-300">
                <Trophy size={24} />
              </div>

              <div className="mt-5 text-xs uppercase tracking-wider text-slate-500">
                Interview score
              </div>

              <div className="mt-1 text-5xl font-semibold">
                {interview.score ?? 0}
                <span className="text-2xl text-slate-600">/100</span>
              </div>

              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
                {interview.feedback?.summary}
              </p>

              <Link
                href={`/repositories/${params.id}/report`}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/10 transition-all duration-200 hover:from-violet-500 hover:to-cyan-400 hover:shadow-violet-500/20"
              >
                View developer report
                <ArrowRight size={16} />
              </Link>
            </div>

            {interview.turns.map((t) => (
              <div key={t.id} className="card p-5">
                <div className="text-sm font-medium text-white">
                  {t.question}
                </div>

                <div className="mt-3 rounded-xl bg-white/[.03] p-4 text-sm leading-6 text-slate-400">
                  {t.answer}
                </div>

                {t.evaluation && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-emerald-400/5 p-3 text-xs text-slate-400">
                      <span className="block text-emerald-300">
                        Score
                      </span>

                      <b className="mt-1 block text-lg text-white">
                        {t.evaluation.score}/100
                      </b>
                    </div>

                    <div className="rounded-xl bg-white/[.03] p-3 text-xs text-slate-400 sm:col-span-2">
                      <span className="block text-violet-300">
                        Verdict
                      </span>

                      <span className="mt-1 block">
                        {t.evaluation.verdict}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}