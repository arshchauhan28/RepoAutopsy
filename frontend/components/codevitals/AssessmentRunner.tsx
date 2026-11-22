'use client'

import React, { useState, useEffect } from 'react'
import {
  BrainCircuit,
  ArrowLeft,
  ArrowRight,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Code2,
  FileCode,
  Shield,
  Layers,
  HelpCircle,
  Radio,
} from 'lucide-react'
import type { AssessmentSession, AssessmentTurn } from '@/lib/api'
import { answerAssessmentTurn } from '@/lib/api'

interface AssessmentRunnerProps {
  session: AssessmentSession
  onCompleted: (updatedSession: AssessmentSession) => void
  onExit: () => void
}

export function AssessmentRunner({ session: initialSession, onCompleted, onExit }: AssessmentRunnerProps) {
  const [session, setSession] = useState<AssessmentSession>(initialSession)
  const [currentIndex, setCurrentIndex] = useState<number>(initialSession.current_index || 0)

  // Local state for answers map: { [turnIndex]: { answer: string, selectedOption: number | null } }
  const [userAnswers, setUserAnswers] = useState<
    Record<number, { answer: string; selectedOption: number | null }>
  >(() => {
    const initMap: Record<number, { answer: string; selectedOption: number | null }> = {}
    ;(initialSession.turns || []).forEach((t, i) => {
      initMap[i] = {
        answer: t.answer || '',
        selectedOption: t.selected_option !== undefined && t.selected_option !== null ? t.selected_option : null,
      }
    })
    return initMap
  })

  const [submitting, setSubmitting] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [error, setError] = useState('')

  const turns = session.turns || []
  const currentTurn = turns[currentIndex]

  // Track answer updates for current turn
  const currentAnswer = userAnswers[currentIndex]?.answer || ''
  const currentSelectedOption = userAnswers[currentIndex]?.selectedOption ?? null

  const handleTextChange = (text: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentIndex]: {
        ...(prev[currentIndex] || { selectedOption: null }),
        answer: text,
      },
    }))
  }

  const handleOptionSelect = (optIdx: number) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentIndex]: {
        ...(prev[currentIndex] || { answer: '' }),
        selectedOption: optIdx,
      },
    }))
  }

  const isCurrentAnswered =
    currentTurn?.question_type === 'multiple_choice'
      ? currentSelectedOption !== null
      : currentAnswer.trim().length > 0

  const answeredCount = turns.filter((t, i) => {
    const a = userAnswers[i]
    if (!a) return false
    return t.question_type === 'multiple_choice'
      ? a.selectedOption !== null
      : a.answer.trim().length > 0
  }).length

  // Submit all answers to backend for final evaluation
  const handleFinalSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      let activeSession = session
      // Submit each turn sequentially to backend
      for (let i = 0; i < turns.length; i++) {
        const ansData = userAnswers[i] || { answer: '', selectedOption: null }
        activeSession = await answerAssessmentTurn(activeSession.id, {
          question_index: i,
          answer: ansData.answer.trim() || undefined,
          selected_option: ansData.selectedOption !== null ? ansData.selectedOption : undefined,
        })
      }
      setSession(activeSession)
      onCompleted(activeSession)
    } catch (err: any) {
      setError(err?.message || 'Failed to submit assessment answers.')
      setSubmitting(false)
    }
  }

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'frontend':
        return 'text-amber-400 bg-amber-400/10 border-amber-400/30'
      case 'backend':
        return 'text-sky-400 bg-sky-400/10 border-sky-400/30'
      case 'database':
        return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
      case 'security':
        return 'text-rose-400 bg-rose-400/10 border-rose-400/30'
      case 'reliability':
        return 'text-orange-400 bg-orange-400/10 border-orange-400/30'
      case 'hackathon':
        return 'text-purple-400 bg-purple-400/10 border-purple-400/30'
      default:
        return 'text-slate-300 bg-white/[.05] border-white/[.1]'
    }
  }

  if (submitting) {
    return (
      <div className="card max-w-2xl mx-auto p-12 text-center reveal space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
          <Loader2 size={26} className="animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-white">Evaluating Codebase Assessment</h2>
        <p className="text-xs text-[#aaa69e] max-w-md mx-auto leading-relaxed">
          Evaluating your responses against repository evidence, rubric concepts, and architecture patterns…
        </p>
      </div>
    )
  }

  if (!currentTurn) {
    return null
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 reveal">
      {/* TOP HEADER: NAVIGATION & PROGRESS */}
      <div className="flex items-center justify-between border-b border-white/[.08] pb-3 text-xs">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-[#8e8a82] hover:text-white transition"
        >
          <ArrowLeft size={14} />
          <span>Exit Assessment</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-[#8e8a82]">
            Answered: <strong className="text-white">{answeredCount}</strong> / {turns.length}
          </span>
          <button
            onClick={() => setShowReviewModal(true)}
            className="rounded border border-amber-400/40 bg-amber-400/15 px-3 py-1 font-mono text-[10px] font-bold text-amber-300 hover:bg-amber-400/25 transition"
          >
            Review & Submit
          </button>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[.06]">
        <div
          className="h-full bg-amber-400 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / turns.length) * 100}%` }}
        />
      </div>

      {error && (
        <div className="border border-rose-400/20 bg-rose-400/[.05] p-3 text-xs text-rose-300 rounded">
          {error}
        </div>
      )}

      {/* MAIN QUESTION CARD */}
      <div className="card p-5 sm:p-7 space-y-5 border-white/[.12]">
        {/* QUESTION METADATA */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.06] pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-amber-400">
              Question {currentIndex + 1} of {turns.length}
            </span>
            <span
              className={`rounded-full border px-2 py-0.2 font-mono text-[9px] uppercase font-bold ${getCategoryColor(
                currentTurn.category
              )}`}
            >
              {currentTurn.category}
            </span>
          </div>

          <span className="font-mono text-[9px] uppercase text-[#77736c]">
            {currentTurn.question_type.replace('_', ' ')} · {currentTurn.difficulty}
          </span>
        </div>

        {/* QUESTION TEXT */}
        <h2 className="text-base sm:text-lg font-semibold text-white leading-relaxed">
          {currentTurn.question}
        </h2>

        {/* CODE SNIPPET (IF PRESENT) */}
        {currentTurn.code_snippet && (
          <div className="rounded-lg border border-white/[.08] bg-black/50 p-3 font-mono text-[11px] text-amber-200/90 overflow-x-auto leading-5">
            <div className="font-mono text-[9px] uppercase text-[#77736c] mb-1">Source Snippet:</div>
            <code>{currentTurn.code_snippet}</code>
          </div>
        )}

        {/* QUESTION FORMAT: MULTIPLE CHOICE */}
        {currentTurn.question_type === 'multiple_choice' && currentTurn.options && (
          <div className="space-y-2.5 pt-2">
            {currentTurn.options.map((opt, optIdx) => {
              const isSelected = currentSelectedOption === optIdx
              const optionLetters = ['A', 'B', 'C', 'D']
              return (
                <div
                  key={optIdx}
                  onClick={() => handleOptionSelect(optIdx)}
                  className={`card p-3.5 border transition cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'border-amber-400 bg-amber-400/[.08] ring-1 ring-amber-400/40 text-white'
                      : 'border-white/[.08] hover:border-white/[.25] text-[#c8c4bc]'
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-bold shrink-0 border ${
                      isSelected
                        ? 'bg-amber-400 text-black border-amber-400'
                        : 'bg-white/[.04] text-[#8e8a82] border-white/[.1]'
                    }`}
                  >
                    {optionLetters[optIdx] || optIdx + 1}
                  </div>
                  <span className="text-xs font-medium leading-relaxed">{opt}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* QUESTION FORMAT: SHORT ANSWER / SCENARIO / CODE INTERPRETATION */}
        {currentTurn.question_type !== 'multiple_choice' && (
          <div className="space-y-2 pt-1">
            <textarea
              rows={5}
              value={currentAnswer}
              onChange={e => handleTextChange(e.target.value)}
              placeholder="Explain your technical reasoning, citing repository architecture, files, or tradeoff decisions…"
              className="w-full rounded-xl border border-white/[.1] bg-black/30 p-3.5 text-xs text-slate-100 placeholder:text-[#55514b] leading-relaxed focus:border-amber-400 focus:outline-none transition"
            />
            <div className="flex items-center justify-between font-mono text-[10px] text-[#77736c]">
              <span>Ground your answer in real repository evidence</span>
              <span>{currentAnswer.length} characters</span>
            </div>
          </div>
        )}

        {/* RELEVANT FILES HINT */}
        {currentTurn.relevant_files && currentTurn.relevant_files.length > 0 && (
          <div className="border-t border-white/[.06] pt-3 text-[11px] font-mono text-[#77736c] flex items-center gap-1.5 truncate">
            <FileCode size={13} className="text-[#8e8a82] shrink-0" />
            <span>Referenced module:</span>
            <span className="text-[#c8c4bc] truncate">{currentTurn.relevant_files[0]}</span>
          </div>
        )}

        {/* PREV / NEXT NAVIGATION CONTROLS */}
        <div className="border-t border-white/[.08] pt-4 flex items-center justify-between">
          <button
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 rounded-lg border border-white/[.1] bg-white/[.03] px-3.5 py-2 text-xs font-semibold text-[#c8c4bc] hover:bg-white/[.06] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={13} />
            <span>Previous</span>
          </button>

          {currentIndex < turns.length - 1 ? (
            <button
              onClick={() => setCurrentIndex(i => Math.min(turns.length - 1, i + 1))}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400 px-4 py-2 text-xs font-bold text-black hover:bg-amber-300 transition"
            >
              <span>Next Question</span>
              <ArrowRight size={13} />
            </button>
          ) : (
            <button
              onClick={() => setShowReviewModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400 transition"
            >
              <span>Review & Submit</span>
              <Send size={13} />
            </button>
          )}
        </div>
      </div>

      {/* QUESTION JUMP PALETTE */}
      <div className="card p-3 border-white/[.08] bg-black/30">
        <div className="flex items-center justify-between text-[10px] font-mono text-[#77736c] mb-2">
          <span>Question Palette (Tap to jump)</span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Answered
            <span className="inline-block h-2 w-2 rounded-full bg-white/[.2] ml-2" /> Pending
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {turns.map((t, idx) => {
            const isAns =
              t.question_type === 'multiple_choice'
                ? userAnswers[idx]?.selectedOption !== null && userAnswers[idx]?.selectedOption !== undefined
                : (userAnswers[idx]?.answer || '').trim().length > 0
            const isCurr = currentIndex === idx

            return (
              <button
                key={t.id}
                onClick={() => setCurrentIndex(idx)}
                className={`h-7 w-7 rounded font-mono text-[10px] font-bold transition flex items-center justify-center ${
                  isCurr
                    ? 'border border-amber-400 bg-amber-400 text-black'
                    : isAns
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/[.04] text-[#8e8a82] border border-white/[.08] hover:text-white'
                }`}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>
      </div>

      {/* CONFIRMATION / REVIEW MODAL BEFORE SUBMISSION */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="card max-w-md w-full p-6 space-y-4 border-amber-400/40 shadow-2xl reveal">
            <div className="flex items-center gap-2 text-amber-400">
              <CheckCircle2 size={20} />
              <h3 className="text-base font-bold text-white">Submit Assessment for Evaluation?</h3>
            </div>

            <p className="text-xs text-[#aaa69e] leading-relaxed">
              You have answered <strong className="text-white">{answeredCount}</strong> of{' '}
              <strong className="text-white">{turns.length}</strong> questions.
              {answeredCount < turns.length && (
                <span className="block mt-1 text-amber-300">
                  Note: Unanswered questions will receive 0 points.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 border-t border-white/[.08] pt-4">
              <button
                onClick={() => setShowReviewModal(false)}
                className="rounded-lg border border-white/[.15] bg-white/[.04] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[.08]"
              >
                Keep Answering
              </button>
              <button
                onClick={() => {
                  setShowReviewModal(false)
                  handleFinalSubmit()
                }}
                className="rounded-lg border border-amber-400/40 bg-amber-400 px-5 py-2 text-xs font-bold text-black hover:bg-amber-300 transition"
              >
                Confirm Submission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

