/* eslint-disable @next/next/no-img-element */
'use client'

import { saveAndConfirmPrediction } from '@/actions/predictions'
import { formatMatchDate, formatMatchTime } from '@/lib/datetime'
import { flagUrl } from '@/lib/flags'
import { formatPredictionLockWindow } from '@/lib/league-settings'
import {
  ANULADO_LIVE_STAGES,
  calcPredictionPoints,
  getPredictionLockState,
  getScoringScore,
  PENDING_LIVE_STAGES,
} from '@/lib/predictions'
import type { MatchLiveState, PredictionLockMode } from '@/lib/types'
import { MatchStatusStrip } from '@/components/matches/MatchStatusStrip'
import { PredictionCountdown } from '@/components/predictions/PredictionCountdown'
import { type RefObject, useActionState, useEffect, useRef, useState } from 'react'

const AUTO_SAVE_DEBOUNCE_MS = 300

type TeamData = { id: string; name: string; code: string; flag_emoji: string }

interface Match {
  id: string
  match_number: number
  phase: string
  group_letter: string | null
  starts_at: string
  venue: string | null
  label: string | null
  status: string
  home_score: number | null
  away_score: number | null
  home_team: TeamData | TeamData[] | null
  away_team: TeamData | TeamData[] | null
}

interface Props {
  allowPredictionEdits: boolean
  match: Match
  prediction: { id: string; home_score: number; away_score: number; confirmed: boolean; created_at: string } | null
  leagueId: string
  predictionLockMode: PredictionLockMode
  totalPredictions: number
  predictionLockMinutes: number
  tournamentStartsAt: string | null
  phaseStartsAt: string | null
  liveState?: MatchLiveState | null
}

export default function PredictionCard({
  allowPredictionEdits,
  match,
  prediction,
  leagueId,
  predictionLockMode,
  totalPredictions,
  predictionLockMinutes,
  tournamentStartsAt,
  phaseStartsAt,
  liveState,
}: Props) {
  const homeTeam = Array.isArray(match.home_team) ? match.home_team[0] : match.home_team
  const awayTeam = Array.isArray(match.away_team) ? match.away_team[0] : match.away_team
  const hasBothTeams = Boolean(homeTeam && awayTeam)
  const effectiveLockMode =
    (predictionLockMode === 'tournament_start' || predictionLockMode === 'phase_start') && !hasBothTeams
      ? 'per_match'
      : predictionLockMode

  const lockState = getPredictionLockState({
    startsAt: match.starts_at,
    status: match.status,
    lockMinutes: predictionLockMinutes,
    lockMode: predictionLockMode,
    tournamentStartsAt,
    phaseStartsAt,
    hasBothTeams,
  })

  const isLocked = lockState.locked
  const isFinished = match.status === 'finished'
  const isConfirmed = prediction?.confirmed ?? false
  // Un cruce a medio definir (un equipo clasificado, rival por definir) se MUESTRA
  // pero no acepta pronostico: no se puede pronosticar un marcador sin saber el rival.
  const canEdit = !isLocked && hasBothTeams && (!isConfirmed || allowPredictionEdits)
  const usesAutoSave = allowPredictionEdits && canEdit

  const homeFlagUrl = homeTeam?.code ? flagUrl(homeTeam.code) : null
  const awayFlagUrl = awayTeam?.code ? flagUrl(awayTeam.code) : null

  const [homeScore, setHomeScore] = useState(prediction?.home_score?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(prediction?.away_score?.toString() ?? '')
  const [lastRequestedPair, setLastRequestedPair] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const homeRef = useRef<HTMLInputElement>(null)
  const awayRef = useRef<HTMLInputElement>(null)

  function handleScoreInput(
    value: string,
    setter: (v: string) => void,
    nextRef: RefObject<HTMLInputElement | null> | null
  ) {
    const digits = value.replace(/\D/g, '').slice(0, 2)
    setter(digits)
    if (digits.length >= 1 && nextRef?.current) {
      nextRef.current.focus()
      nextRef.current.select()
    }
  }

  function handleScoreKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    currentValue: string,
    prevRef: RefObject<HTMLInputElement | null> | null
  ) {
    if (e.key === 'Backspace' && currentValue === '' && prevRef?.current) {
      prevRef.current.focus()
      prevRef.current.select()
    }
  }
  const initialSubmittedPair = prediction ? `${prediction.home_score}-${prediction.away_score}` : null

  const [state, formAction, pending] = useActionState(
    (
      _prev: { error?: string; savedPair?: string; success?: boolean } | undefined,
      formData: FormData
    ) =>
      saveAndConfirmPrediction(formData),
    undefined
  )
  const currentPair = homeScore !== '' && awayScore !== '' ? `${homeScore}-${awayScore}` : null
  const lastSubmittedPair = state?.success ? state.savedPair ?? initialSubmittedPair : initialSubmittedPair
  const isCurrentPairSaved = currentPair !== null && currentPair === lastSubmittedPair
  const canAutoSaveCurrentPair =
    usesAutoSave &&
    currentPair !== null &&
    currentPair !== lastSubmittedPair &&
    currentPair !== lastRequestedPair

  useEffect(() => {
    if (!canAutoSaveCurrentPair || pending) return

    const timeoutId = window.setTimeout(() => {
      if (!formRef.current) return

      setLastRequestedPair(currentPair)
      formRef.current.requestSubmit()
    }, AUTO_SAVE_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [canAutoSaveCurrentPair, currentPair, pending])

  // Marcador con el que se puntúa: el definitivo si el partido finalizó, o el de
  // los 90' (congelado) una vez pasa a descanso/prórroga/penales. calcPrediction-
  // Points se evalua siempre sobre este, nunca sobre el marcador en vivo con goles
  // de tiempo extra.
  const scoringScore = getScoringScore(match, liveState)

  const points =
    isFinished && isConfirmed && prediction &&
    scoringScore.home_score !== null && scoringScore.away_score !== null
      ? calcPredictionPoints(prediction, scoringScore)
      : null

  // Stage families that suspend point projection (mirrors FS_STAGE codes)
  const liveStageCode = liveState?.stage_code ?? null
  const ANULADO_STAGES = ANULADO_LIVE_STAGES
  const PENDING_STAGES = PENDING_LIVE_STAGES

  // Puntos que va sumando el pick con el marcador que cuenta (provisional). En
  // prórroga/penales scoringScore ya es el de los 90', asi que quedan congelados
  // y no cambian con los goles del tiempo extra.
  const provisionalPoints =
    match.status === 'in_progress' &&
    isConfirmed &&
    prediction &&
    !PENDING_STAGES.includes(liveStageCode ?? -1) &&
    !ANULADO_STAGES.includes(liveStageCode ?? -1) &&
    scoringScore.home_score !== null &&
    scoringScore.away_score !== null
      ? calcPredictionPoints(prediction, scoringScore)
      : null

  const CHIP_TONES = {
    green: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    gold: 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    zero: 'border border-red-500/25 bg-red-500/10 text-red-500 dark:text-red-400',
    neutral: 'border border-brand-line bg-brand-panel text-muted',
  }

  const pickChip = ANULADO_STAGES.includes(liveStageCode ?? -1)
    ? { label: '— Anulado', className: CHIP_TONES.neutral }
    : !isConfirmed
      ? { label: 'Sin pick', className: CHIP_TONES.neutral }
      : points !== null
        ? points === 3
          ? { label: '✓ +3 pts', className: CHIP_TONES.green }
          : points === 1
            ? { label: '✓ +1 pt', className: CHIP_TONES.gold }
            : { label: '✗ 0 pts', className: CHIP_TONES.zero }
        : provisionalPoints !== null
          ? provisionalPoints === 3
            ? { label: '✓ +3', className: CHIP_TONES.green }
            : provisionalPoints === 1
              ? { label: '✓ +1', className: CHIP_TONES.gold }
              : { label: '✗ 0', className: CHIP_TONES.zero }
          : { label: '● Pendiente', className: CHIP_TONES.neutral }

  const dateStr = formatMatchDate(match.starts_at, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const timeStr = formatMatchTime(match.starts_at)

  const lockMessage =
    match.status === 'in_progress'
      ? 'Partido en juego.'
      : match.status === 'finished'
        ? 'Partido finalizado.'
        : !hasBothTeams
          ? 'Esperando al rival para habilitar el pronostico.'
        : isConfirmed && canEdit
          ? `Tu pronostico sigue editable hasta que cierre ${formatPredictionLockWindow(
              predictionLockMinutes,
              effectiveLockMode
            )}.`
        : lockState.reason === 'open'
          ? `Cierra ${formatPredictionLockWindow(predictionLockMinutes, effectiveLockMode)}.`
          : lockState.reason === 'window' ||
              lockState.reason === 'tournament_window' ||
              lockState.reason === 'phase_window'
            ? `Cerrado ${formatPredictionLockWindow(predictionLockMinutes, effectiveLockMode)}.`
            : lockState.reason === 'tournament_started'
              ? 'Todos los pronosticos del mundial ya estan cerrados.'
            : lockState.reason === 'phase_started'
              ? 'Los pronosticos de esta fase ya estan cerrados.'
            : 'Pronosticos cerrados.'

  return (
    <div
      className={`brand-card rounded-3xl px-3 py-3 transition-colors ${
        isConfirmed ? 'border-brand-green/34' : ''
      }`}
    >
      {!canEdit && (
        <div className="relative mb-2 flex h-6 items-center justify-center">
          <span className="brand-kicker text-kicker-2xs tracking-brand-wide">Tu pick</span>
          <span
            className={`absolute right-0 rounded-full px-2 py-0.5 text-2xs font-bold ${pickChip.className}`}
          >
            {pickChip.label}
          </span>
        </div>
      )}

      {!homeTeam && !awayTeam && match.label ? (
        <p className="py-1 text-center text-sm font-semibold text-muted">{match.label}</p>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
            <span className="min-w-0 truncate text-right text-sm font-bold text-foreground">
              {homeTeam?.name ?? 'Por definir'}
            </span>
            {homeFlagUrl ? (
              <img
                alt={homeTeam?.name ?? ''}
                className="h-5 w-7 shrink-0 rounded-sm object-cover"
                height={20}
                src={homeFlagUrl}
                width={28}
              />
            ) : (
              <span className="shrink-0 text-xl">-</span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {canEdit ? (
              <>
                <input
                  ref={homeRef}
                  className="brand-input h-10 w-10 rounded-xl text-center text-base font-black"
                  inputMode="numeric"
                  maxLength={2}
                  onChange={e => handleScoreInput(e.target.value, setHomeScore, awayRef)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => handleScoreKeyDown(e, homeScore, null)}
                  pattern="[0-9]*"
                  placeholder="-"
                  type="text"
                  value={homeScore}
                />
                <span className="text-sm font-black text-muted">:</span>
                <input
                  ref={awayRef}
                  className="brand-input h-10 w-10 rounded-xl text-center text-base font-black"
                  inputMode="numeric"
                  maxLength={2}
                  onChange={e => handleScoreInput(e.target.value, setAwayScore, null)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => handleScoreKeyDown(e, awayScore, homeRef)}
                  pattern="[0-9]*"
                  placeholder="-"
                  type="text"
                  value={awayScore}
                />
              </>
            ) : isConfirmed && prediction ? (
              <>
                <span className="brand-chip-admin flex h-9 w-9 items-center justify-center rounded-xl border border-brand-green/24 text-base font-black">
                  {prediction.home_score}
                </span>
                <span className="text-sm font-black text-muted">:</span>
                <span className="brand-chip-admin flex h-9 w-9 items-center justify-center rounded-xl border border-brand-green/24 text-base font-black">
                  {prediction.away_score}
                </span>
              </>
            ) : (
              <span className="px-2 text-xs font-bold text-muted">VS</span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {awayFlagUrl ? (
              <img
                alt={awayTeam?.name ?? ''}
                className="h-5 w-7 shrink-0 rounded-sm object-cover"
                height={20}
                src={awayFlagUrl}
                width={28}
              />
            ) : (
              <span className="shrink-0 text-xl">-</span>
            )}
            <span className="min-w-0 truncate text-sm font-bold text-foreground">
              {awayTeam?.name ?? 'Por definir'}
            </span>
          </div>
        </div>
      )}

      {canEdit && (
        <form
          action={formAction}
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"
          onSubmit={() => {
            if (currentPair) {
              setLastRequestedPair(currentPair)
            }
          }}
          ref={formRef}
        >
          <input name="match_id" type="hidden" value={match.id} />
          <input name="league_id" type="hidden" value={leagueId} />
          <input name="home_score" type="hidden" value={homeScore} />
          <input name="away_score" type="hidden" value={awayScore} />

          {usesAutoSave ? (
            <p className="text-right text-xs text-muted">
              {pending
                ? 'Guardando...'
                : currentPair === null
                  ? 'Ingresa ambos marcadores para guardar.'
                  : isCurrentPairSaved
                    ? 'Guardado automaticamente.'
                    : 'Se guardara automaticamente.'}
            </p>
          ) : (
            <button
              className="brand-button-primary w-full rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 sm:w-auto"
              disabled={pending || homeScore === '' || awayScore === ''}
              type="submit"
            >
              {pending ? 'Guardando...' : isConfirmed ? 'Actualizar resultado' : 'Guardar resultado'}
            </button>
          )}
        </form>
      )}

      {!canEdit && (
        <div className="mt-3 flex justify-center">
          <MatchStatusStrip
            status={match.status}
            phase={liveState?.phase ?? null}
            stageCode={liveStageCode}
            stageStartedAtMs={
              liveState?.stage_started_at ? new Date(liveState.stage_started_at).getTime() : null
            }
            homeScore={match.home_score}
            awayScore={match.away_score}
            etHomeScore={liveState?.home_score ?? null}
            etAwayScore={liveState?.away_score ?? null}
            penHomeScore={liveState?.pen_home_score ?? null}
            penAwayScore={liveState?.pen_away_score ?? null}
          />
        </div>
      )}

      <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <p className="text-xs text-muted">
          {match.group_letter && `Gr. ${match.group_letter} · `}
          {dateStr} · {timeStr}
          {match.venue ? ` · ${match.venue}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {!isConfirmed && totalPredictions > 0 && (
            <span className="text-xs text-muted">
              {totalPredictions} {totalPredictions === 1 ? 'pronostico' : 'pronosticos'}
            </span>
          )}
        </div>
      </div>

      {!canEdit && isConfirmed && prediction?.created_at && (
        <p className="mt-1 text-2xs text-muted/78">
          Pronosticado: {formatMatchDate(prediction.created_at)} · {formatMatchTime(prediction.created_at)}
        </p>
      )}

      {(!isConfirmed || canEdit) && (
        <>
          <p className="mt-2 text-xs text-muted">{lockMessage}</p>
          {!lockState.locked && hasBothTeams && (
            <PredictionCountdown lockAtMs={lockState.lockAt.getTime()} />
          )}
        </>
      )}

      {state?.error && (
        <p className="mt-2 rounded-xl bg-red-50 px-2 py-1.5 text-xs text-red-600">{state.error}</p>
      )}
    </div>
  )
}
