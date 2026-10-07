/* eslint-disable @next/next/no-img-element */
'use client'

import { saveMatchResult } from '@/actions/matches'
import { formatMatchDate, formatMatchTime } from '@/lib/datetime'
import { flagUrl } from '@/lib/flags'
import { PHASE_LABELS, type MatchStatus } from '@/lib/types'
import { useActionState } from 'react'

type TeamData = {
  name: string
  code: string
  flag_emoji: string
}

interface MatchData {
  id: string
  match_number: number
  phase: keyof typeof PHASE_LABELS
  group_letter: string | null
  starts_at: string
  venue: string | null
  label: string | null
  status: MatchStatus
  home_score: number | null
  away_score: number | null
  home_team: TeamData | TeamData[] | null
  away_team: TeamData | TeamData[] | null
}

interface Props {
  canEditFinishedResults: boolean
  leagueId: string
  match: MatchData
}

const STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'Programado',
  in_progress: 'En juego',
  finished: 'Finalizado',
}

const STATUS_STYLES: Record<MatchStatus, string> = {
  scheduled: 'brand-chip-member',
  in_progress: 'brand-chip-admin',
  finished: 'brand-score-pill',
}

function TeamRow({
  align = 'left',
  team,
}: {
  align?: 'left' | 'right'
  team: TeamData | null
}) {
  const imageUrl = team?.code ? flagUrl(team.code) : null
  const isRight = align === 'right'

  return (
    <div className={`flex items-center gap-2 ${isRight ? 'justify-end text-right' : ''}`}>
      {!isRight && (
        imageUrl ? (
          <img
            alt={team?.name ?? ''}
            className="h-5 w-7 shrink-0 rounded-sm object-cover"
            height={20}
            src={imageUrl}
            width={28}
          />
        ) : (
          <span className="brand-panel-soft flex h-5 w-7 shrink-0 items-center justify-center rounded-sm text-xs font-bold text-muted">
            -
          </span>
        )
      )}
      <span className="min-w-0 truncate text-sm font-bold text-foreground">
        {team?.name ?? 'Por definir'}
      </span>
      {isRight && (
        imageUrl ? (
          <img
            alt={team?.name ?? ''}
            className="h-5 w-7 shrink-0 rounded-sm object-cover"
            height={20}
            src={imageUrl}
            width={28}
          />
        ) : (
          <span className="brand-panel-soft flex h-5 w-7 shrink-0 items-center justify-center rounded-sm text-xs font-bold text-muted">
            -
          </span>
        )
      )}
    </div>
  )
}

export default function MatchResultForm({ canEditFinishedResults, leagueId, match }: Props) {
  const [state, formAction, pending] = useActionState(
    (_prev: { error?: string; success?: boolean } | undefined, formData: FormData) =>
      saveMatchResult(formData),
    undefined
  )

  const homeTeam = Array.isArray(match.home_team) ? match.home_team[0] : match.home_team
  const awayTeam = Array.isArray(match.away_team) ? match.away_team[0] : match.away_team
  const isFinished = match.status === 'finished'
  const isEditLocked = isFinished && !canEditFinishedResults

  const phaseLabel =
    match.phase === 'group' && match.group_letter
      ? `Grupo ${match.group_letter}`
      : PHASE_LABELS[match.phase] ?? match.phase

  const dateStr = formatMatchDate(match.starts_at, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const timeStr = formatMatchTime(match.starts_at)

  return (
    <form action={formAction} className="brand-panel-soft space-y-4 rounded-3xl p-4 shadow-sm">
      <input name="league_id" type="hidden" value={leagueId} />
      <input name="match_id" type="hidden" value={match.id} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="brand-kicker text-kicker-sm tracking-brand">
            Partido {match.match_number} | {phaseLabel}
          </p>
          <p className="mt-1 text-sm text-muted">
            {dateStr} | {timeStr}
            {match.venue ? ` | ${match.venue}` : ''}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[match.status]}`}>
          {STATUS_LABELS[match.status]}
        </span>
      </div>

      {match.label && !homeTeam && !awayTeam ? (
        <p className="brand-panel rounded-xl px-3 py-3 text-center text-sm font-semibold text-muted">
          {match.label}
        </p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <TeamRow align="right" team={homeTeam ?? null} />
          <div className="brand-panel rounded-xl px-3 py-2 text-center text-xs font-black text-muted">VS</div>
          <TeamRow team={awayTeam ?? null} />
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <label className="space-y-2">
          <span className="brand-kicker text-kicker-sm tracking-brand">Local</span>
          <input
            className="brand-input h-11 w-full rounded-xl px-4 text-center text-lg font-black"
            defaultValue={match.home_score ?? ''}
            disabled={isEditLocked}
            inputMode="numeric"
            max={30}
            min={0}
            name="home_score"
            required
            type="number"
          />
        </label>

        <span className="pb-3 text-lg font-black text-muted">:</span>

        <label className="space-y-2">
          <span className="brand-kicker text-kicker-sm tracking-brand">Visita</span>
          <input
            className="brand-input h-11 w-full rounded-xl px-4 text-center text-lg font-black"
            defaultValue={match.away_score ?? ''}
            disabled={isEditLocked}
            inputMode="numeric"
            max={30}
            min={0}
            name="away_score"
            required
            type="number"
          />
        </label>
      </div>

      {match.phase !== 'group' && (
        <p className="text-2xs text-brand-gold-strong">
          Eliminatoria: ingresa el marcador de los 90&apos; (sin prorroga ni penales) — asi se puntua.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {isEditLocked
            ? 'Este resultado ya esta aplicado y la correccion de resultados finalizados esta deshabilitada.'
            : isFinished
              ? 'Este resultado ya esta aplicado. Puedes corregirlo si hubo un error.'
              : 'Al guardar, el partido quedara finalizado y el ranking se actualizara.'}
        </p>
        <button
          className="brand-button-primary inline-flex shrink-0 items-center rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
          disabled={pending || isEditLocked}
          type="submit"
        >
          {pending
            ? (isFinished ? 'Actualizando...' : 'Cerrando...')
            : isEditLocked
              ? 'Edicion bloqueada'
              : (isFinished ? 'Actualizar resultado' : 'Cerrar partido')}
        </button>
      </div>

      {state?.success && (
        <p className="rounded-xl bg-brand-green-soft px-3 py-2 text-sm text-brand-green-strong">
          Resultado guardado. Este cambio ya impacta los puntajes.
        </p>
      )}

      {state?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
    </form>
  )
}
