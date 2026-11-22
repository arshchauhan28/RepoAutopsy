'use client'

import React, { useState, useEffect } from 'react'
import { Users, ArrowRight, Sparkles, Check, CheckCircle2, ShieldAlert } from 'lucide-react'
import type { TeamInviteInfo } from '@/lib/api'
import { getTeamInviteInfo, joinTeamSession } from '@/lib/api'

interface TeamInviteJoinProps {
  inviteToken: string
  onJoined: (sessionData: {
    team_session_id: string
    member_id: string
    assessment_session_id: string
  }) => void
}

export function TeamInviteJoin({ inviteToken, onJoined }: TeamInviteJoinProps) {
  const [inviteInfo, setInviteInfo] = useState<TeamInviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!inviteToken) return
    getTeamInviteInfo(inviteToken)
      .then(info => {
        setInviteInfo(info)
        if (info.available_slots && info.available_slots.length > 0) {
          setSelectedSlotId(info.available_slots[0].id)
          setDisplayName(info.available_slots[0].display_name)
        }
      })
      .catch(e => setError(e?.message || 'Invalid or expired invitation.'))
      .finally(() => setLoading(false))
  }, [inviteToken])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('Please enter your name.')
      return
    }

    setJoining(true)
    setError('')

    try {
      const res = await joinTeamSession(inviteToken, {
        display_name: displayName.trim(),
        member_id: selectedSlotId || undefined,
      })
      if (typeof window !== 'undefined') {
        localStorage.setItem(`repoautopsy-team-inv-${res.team_session_id}`, inviteToken)
        if (res.session_token) {
          localStorage.setItem(`repoautopsy-session-token-${res.assessment_session_id}`, res.session_token)
        }
      }
      onJoined(res)
    } catch (err: any) {
      setError(err?.message || 'Failed to join team session.')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="card max-w-lg mx-auto p-10 text-center text-xs text-[#77736c] reveal">
        Validating team invitation link…
      </div>
    )
  }

  if (error || !inviteInfo) {
    return (
      <div className="card max-w-lg mx-auto p-6 border-rose-400/20 bg-rose-400/[.05] text-rose-300 reveal text-center">
        <h2 className="text-base font-bold">Invitation Unavailable</h2>
        <p className="mt-2 text-xs text-rose-300/80">{error || 'This link is invalid or expired.'}</p>
      </div>
    )
  }

  return (
    <div className="card max-w-lg mx-auto p-6 sm:p-8 reveal space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-400/10 text-purple-400 border border-purple-400/20">
          <Users size={24} />
        </div>
        <div className="mt-4 flex items-center justify-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-purple-400 font-bold">
            Team Assessment Invitation
          </span>
          {inviteInfo.is_hackathon_mode && (
            <span className="rounded bg-purple-500/15 px-1.5 py-0.2 font-mono text-[9px] text-purple-300 border border-purple-500/30">
              Hackathon
            </span>
          )}
        </div>
        <h1 className="mt-1 text-2xl font-bold text-white">{inviteInfo.team_name}</h1>
        <p className="mt-1 font-mono text-xs text-amber-300/90">{inviteInfo.repo_name}</p>
        {inviteInfo.description && (
          <p className="mt-2 text-xs text-[#aaa69e]">{inviteInfo.description}</p>
        )}
      </div>

      <form onSubmit={handleJoin} className="space-y-5 border-t border-white/[.08] pt-5">
        {/* Available Assigned Slots */}
        {inviteInfo.available_slots && inviteInfo.available_slots.length > 0 && (
          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[#8e8a82]">
              Choose Your Assigned Slot:
            </label>
            <div className="space-y-2">
              {inviteInfo.available_slots.map(slot => {
                const isSelected = selectedSlotId === slot.id
                return (
                  <div
                    key={slot.id}
                    onClick={() => {
                      setSelectedSlotId(slot.id)
                      setDisplayName(slot.display_name)
                    }}
                    className={`card p-3 border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-purple-400 bg-purple-400/[.06] ring-1 ring-purple-400/40'
                        : 'border-white/[.08] hover:border-white/[.2]'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-white text-xs">{slot.display_name}</div>
                      <div className="text-[11px] text-[#8e8a82]">
                        Role: <span className="text-purple-300">{slot.assigned_role || 'Developer'}</span> · Scope:{' '}
                        <span className="text-[#c8c4bc]">
                          {slot.assigned_components.includes('complete')
                            ? 'Complete Codebase'
                            : slot.assigned_components.join(', ')}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-purple-400 shrink-0" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Display Name Input */}
        <div className="space-y-1.5">
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#8e8a82]">
            Your Display Name *
          </label>
          <input
            type="text"
            required
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Jordan Smith"
            className="w-full rounded-lg border border-white/[.12] bg-black/40 px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={joining || !displayName.trim()}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-purple-400/40 bg-purple-400 px-6 py-2.5 text-xs font-bold text-black transition hover:bg-purple-300 disabled:opacity-50"
        >
          <span>{joining ? 'Joining & Preparing Assessment…' : 'Start Assigned Assessment'}</span>
          <ArrowRight size={14} />
        </button>
      </form>
    </div>
  )
}

