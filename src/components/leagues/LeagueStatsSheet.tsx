'use client'

import Link from 'next/link'
import { useState } from 'react'
import LeaderboardBoard from '@/components/leagues/LeaderboardBoard'
import { GENERAL_SCORING_RULE, type LeaderboardEntry } from '@/lib/predictions'

interface Props {
  leaderboard: LeaderboardEntry[]
  hasFinishedMatches: boolean
  isAdmin: boolean
  currentUserId: string
  leagueId: string
  prizes: string | null
  rules: string | null
  predictionEditText: string
  predictionLockText: string
  predictionVisibilityText: string
  tieBreakerText: string
}

export default function LeagueStatsSheet({
  leaderboard,
  hasFinishedMatches,
  isAdmin,
  currentUserId,
  leagueId,
  prizes,
  rules,
  predictionEditText,
  predictionLockText,
  predictionVisibilityText,
  tieBreakerText,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        type="button"
        className="brand-button-secondary flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold"
      >
        Tabla y reglas
      </button>

      <div
        className={`fixed inset-0 z-60 flex flex-col bg-[#0b1726]/95 backdrop-blur-xl transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="brand-display text-lg font-black text-white">Tabla y reglas</h2>
          <button
            onClick={() => setIsOpen(false)}
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            X
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-5 pb-10 pt-5">
          <LeaderboardBoard
            entries={leaderboard}
            currentUserId={currentUserId}
            hasFinishedMatches={hasFinishedMatches}
          />

          <div className="mx-auto w-full max-w-105 rounded-panel border border-white/5 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="brand-display text-xl font-black text-white">Premios y reglas</h2>
              {isAdmin && (
                <Link
                  className="text-xs font-bold text-brand-green-accent"
                  href={`/leagues/${leagueId}/admin`}
                  onClick={() => setIsOpen(false)}
                >
                  Editar
                </Link>
              )}
            </div>
            <p className="mt-2 text-sm text-white/70">{predictionLockText}</p>
            <p className="mt-1 text-sm text-white/70">{predictionEditText}</p>
            <p className="mt-1 text-sm text-white/70">{predictionVisibilityText}</p>
            <p className="mt-1 text-sm text-white/70">{tieBreakerText}</p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="brand-kicker text-kicker-sm tracking-brand">Premios</p>
                <p className="mt-2 whitespace-pre-line text-sm text-white/70">
                  {prizes?.trim() || 'Aun no hay premios definidos.'}
                </p>
              </div>
              <div>
                <p className="brand-kicker text-kicker-sm tracking-brand">Regla general</p>
                <p className="mt-2 whitespace-pre-line text-sm text-white/70">{GENERAL_SCORING_RULE}</p>
              </div>
              <div>
                <p className="brand-kicker text-kicker-sm tracking-brand">Reglas adicionales</p>
                <p className="mt-2 whitespace-pre-line text-sm text-white/70">
                  {rules?.trim() || 'Esta liga no tiene reglas adicionales.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
