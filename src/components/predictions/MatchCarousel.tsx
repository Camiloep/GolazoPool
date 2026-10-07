'use client'

/* eslint-disable @next/next/no-img-element */
import { formatMatchDate, formatMatchTime } from '@/lib/datetime'
import { flagUrl } from '@/lib/flags'
import {
  canViewerSeeMatchPicks,
  getPickResultTone,
  type PickDistributionEntry,
  type PickResultTone,
  shouldShowAggregatePickView,
  shouldShowParticipantOnlyPickView,
} from '@/lib/predictions'
import type {
  MatchLiveState,
  MemberPredictionViewMode,
  MemberPredictionVisibility,
  PredictionLockMode,
} from '@/lib/types'
import { useState } from 'react'
import PredictionCard from './PredictionCard'

type TeamData = { id: string; name: string; code: string; flag_emoji: string }

interface MatchData {
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

interface UserPrediction {
  id: string
  home_score: number
  away_score: number
  confirmed: boolean
  created_at: string
}

interface OtherPick {
  userId: string
  name: string
  homeScore: number
  awayScore: number
  createdAt: string
  isMine?: boolean
}

interface ParticipantPick {
  userId: string
  name: string
}

interface Props {
  allowPredictionEdits: boolean
  matches: MatchData[]
  initialMatchId: string
  leagueId: string
  memberPredictionViewMode: MemberPredictionViewMode
  memberPredictionVisibility: MemberPredictionVisibility
  pickDistributionByMatch: Record<string, PickDistributionEntry[]>
  predictionLockMode: PredictionLockMode
  predictionLockMinutes: number
  predictionsByMatch: Record<string, UserPrediction>
  requireMatchPredictionForPickVisibility: boolean
  totalPredictionsByMatch: Record<string, number>
  picksByMatch: Record<string, OtherPick[]>
  participantsByMatch: Record<string, ParticipantPick[]>
  tournamentStartsAt: string | null
  phaseStartsByMatchId: Record<string, string | null>
  liveStateByMatch?: Record<string, MatchLiveState>
}

const PICK_TONE: Record<PickResultTone, { score: string; chip: string; label: string }> = {
  exact: {
    score: 'text-emerald-600 dark:text-emerald-400',
    chip: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    label: '+3 pts',
  },
  outcome: {
    score: 'text-amber-600 dark:text-amber-400',
    chip: 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    label: '+1 pt',
  },
  miss: {
    score: 'text-red-500 dark:text-red-400',
    chip: 'border border-red-500/25 bg-red-500/10 text-red-500 dark:text-red-400',
    label: '0 pts',
  },
  pending: { score: 'text-foreground', chip: '', label: '' },
}

function team(raw: TeamData | TeamData[] | null): TeamData | null {
  if (!raw) return null
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

function matchLabel(match: MatchData): string {
  const home = team(match.home_team)
  const away = team(match.away_team)
  if (!home && !away) return match.label ?? `Partido ${match.match_number}`
  const dateStr = formatMatchDate(match.starts_at)
  return `${home?.name ?? 'Por definir'} vs ${away?.name ?? 'Por definir'} | ${dateStr}`
}

function SideCard({
  match,
  prediction,
  direction,
  onClick,
}: {
  match: MatchData
  prediction: UserPrediction | null
  direction: 'prev' | 'next'
  onClick: () => void
}) {
  const home = team(match.home_team)
  const away = team(match.away_team)
  const dateStr = formatMatchDate(match.starts_at)
  const timeStr = formatMatchTime(match.starts_at)

  const homeFlagUrl = home?.code ? flagUrl(home.code) : null
  const awayFlagUrl = away?.code ? flagUrl(away.code) : null

  return (
    <button
      className="brand-card flex h-full w-full cursor-pointer flex-col justify-between gap-4 rounded-3xl p-4 text-left opacity-90 transition-all hover:border-brand-line-strong hover:opacity-100 hover:shadow-lg active:scale-[0.98]"
      onClick={onClick}
      type="button"
    >
      <span className="brand-kicker text-kicker-2xs tracking-brand-tight">
        {direction === 'prev' ? '<- Anterior' : 'Siguiente ->'}
      </span>

      <div className="flex items-center gap-2 overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <span className="min-w-0 truncate text-right text-xs font-semibold text-foreground">
            {home?.name ?? 'Por definir'}
          </span>
          {homeFlagUrl ? (
            <img alt={home?.name ?? ''} className="h-4 w-6 shrink-0 rounded-sm object-cover" src={homeFlagUrl} />
          ) : (
            <span className="shrink-0 text-sm">-</span>
          )}
        </div>

        <div className="shrink-0 text-center">
          {prediction?.confirmed ? (
            <span className="brand-chip-admin rounded-lg px-2 py-0.5 text-sm font-black">
              {prediction.home_score}-{prediction.away_score}
            </span>
          ) : (
            <span className="brand-chip-neutral rounded-lg px-2 py-0.5 text-2xs">-</span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {awayFlagUrl ? (
            <img alt={away?.name ?? ''} className="h-4 w-6 shrink-0 rounded-sm object-cover" src={awayFlagUrl} />
          ) : (
            <span className="shrink-0 text-sm">-</span>
          )}
          <span className="min-w-0 truncate text-xs font-semibold text-foreground">
            {away?.name ?? 'Por definir'}
          </span>
        </div>
      </div>

      <p className="text-2xs text-muted">{dateStr} | {timeStr}</p>
    </button>
  )
}

export default function MatchCarousel({
  allowPredictionEdits,
  matches,
  initialMatchId,
  leagueId,
  memberPredictionViewMode,
  memberPredictionVisibility,
  pickDistributionByMatch,
  predictionLockMode,
  predictionLockMinutes,
  predictionsByMatch,
  requireMatchPredictionForPickVisibility,
  totalPredictionsByMatch,
  picksByMatch,
  participantsByMatch,
  tournamentStartsAt,
  phaseStartsByMatchId,
  liveStateByMatch,
}: Props) {
  const initialIndex = Math.max(0, matches.findIndex((m) => m.id === initialMatchId))
  const [activeIndex, setActiveIndex] = useState(initialIndex)

  const prevMatch = activeIndex > 0 ? matches[activeIndex - 1] : null
  const currentMatch = matches[activeIndex]
  const nextMatch = activeIndex < matches.length - 1 ? matches[activeIndex + 1] : null

  function goTo(index: number) {
    setActiveIndex(index)
  }

  const currentPicks = picksByMatch[currentMatch?.id ?? ''] ?? []
  const currentParticipants = participantsByMatch[currentMatch?.id ?? ''] ?? []
  const currentPickDistribution = pickDistributionByMatch[currentMatch?.id ?? ''] ?? []
  const viewerHasConfirmedPrediction = Boolean(
    currentMatch && predictionsByMatch[currentMatch.id]?.confirmed
  )
  const canViewCurrentMatchPicks = currentMatch
    ? canViewerSeeMatchPicks({
        memberPredictionVisibility,
        requireMatchPredictionForPickVisibility,
        viewerHasConfirmedPrediction,
        startsAt: currentMatch.starts_at,
        status: currentMatch.status,
        lockMinutes: predictionLockMinutes,
        lockMode: predictionLockMode,
        tournamentStartsAt,
        phaseStartsAt: phaseStartsByMatchId[currentMatch.id] ?? null,
        hasBothTeams: Boolean(team(currentMatch.home_team) && team(currentMatch.away_team)),
      })
    : false
  const showAggregateOnly = shouldShowAggregatePickView({
    memberPredictionViewMode,
  })
  const showParticipantOnly = shouldShowParticipantOnlyPickView({
    memberPredictionViewMode,
  })

  return (
    <div className="space-y-4">
      <select
        className="brand-input w-full rounded-2xl px-4 py-3 text-sm font-semibold text-foreground"
        onChange={(e) => goTo(parseInt(e.target.value))}
        value={activeIndex}
      >
        {matches.map((match, index) => (
          <option key={match.id} value={index}>
            {matchLabel(match)}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-1 items-stretch gap-2 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        <div className="hidden lg:block">
          {prevMatch ? (
            <SideCard
              direction="prev"
              match={prevMatch}
              onClick={() => goTo(activeIndex - 1)}
              prediction={predictionsByMatch[prevMatch.id] ?? null}
            />
          ) : null}
        </div>

        <PredictionCard
          allowPredictionEdits={allowPredictionEdits}
          key={currentMatch.id}
          leagueId={leagueId}
          liveState={liveStateByMatch?.[currentMatch.id] ?? null}
          match={currentMatch}
          predictionLockMode={predictionLockMode}
          prediction={predictionsByMatch[currentMatch.id] ?? null}
          predictionLockMinutes={predictionLockMinutes}
          totalPredictions={totalPredictionsByMatch[currentMatch.id] ?? 0}
          tournamentStartsAt={tournamentStartsAt}
          phaseStartsAt={phaseStartsByMatchId[currentMatch.id] ?? null}
        />

        <div className="hidden lg:block">
          {nextMatch ? (
            <SideCard
              direction="next"
              match={nextMatch}
              onClick={() => goTo(activeIndex + 1)}
              prediction={predictionsByMatch[nextMatch.id] ?? null}
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between lg:hidden">
        <button
          className="brand-button-secondary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-30"
          disabled={!prevMatch}
          onClick={() => prevMatch && goTo(activeIndex - 1)}
          type="button"
        >
          Atras
        </button>
        <span className="text-xs text-muted">
          {activeIndex + 1} / {matches.length}
        </span>
        <button
          className="brand-button-secondary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-30"
          disabled={!nextMatch}
          onClick={() => nextMatch && goTo(activeIndex + 1)}
          type="button"
        >
          Siguiente
        </button>
      </div>

      {!canViewCurrentMatchPicks && (
        <div className="brand-panel-soft rounded-2xl px-4 py-3 text-sm text-muted">
          {requireMatchPredictionForPickVisibility && !viewerHasConfirmedPrediction
            ? 'Debes enviar tu pronostico de este partido antes de ver los picks de la liga.'
            : memberPredictionVisibility === 'after_lock'
            ? 'Los marcadores de los picks se mostraran cuando cierre la ventana de pronosticos de este partido.'
            : 'Esta liga no permite ver los picks de otros jugadores.'}
        </div>
      )}

      {canViewCurrentMatchPicks && showAggregateOnly && currentPickDistribution.length > 0 && (
        <div>
          <p className="brand-kicker mb-2 text-kicker-sm tracking-brand">Distribucion de picks</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {currentPickDistribution.map((entry) => (
              <div
                key={`${entry.homeScore}-${entry.awayScore}`}
                className="brand-card rounded-card p-3 text-center"
              >
                <p className="text-xs font-semibold text-muted">
                  {entry.count} {entry.count === 1 ? 'persona' : 'personas'}
                </p>
                <p className="brand-display mt-1 text-xl font-black text-foreground">
                  {entry.homeScore}-{entry.awayScore}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(canViewCurrentMatchPicks ? showParticipantOnly : true) && currentParticipants.length > 0 && (
        <div>
          <p className="brand-kicker mb-2 text-kicker-sm tracking-brand">Jugadores que ya pronosticaron</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {currentParticipants.map((participant) => (
              <div
                key={participant.userId}
                className="brand-card rounded-card p-3 text-center"
              >
                <p className="truncate text-xs font-semibold text-muted">{participant.name}</p>
                <p className="mt-1 text-2xs font-semibold uppercase tracking-brand-tight text-brand-blue">
                  Pick enviado
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {canViewCurrentMatchPicks && !showAggregateOnly && !showParticipantOnly && currentPicks.length > 0 && (
        <div>
          <p className="brand-kicker mb-2 text-kicker-sm tracking-brand">Picks de la liga</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {currentPicks.map((pick) => {
              const tone = getPickResultTone(
                { home_score: pick.homeScore, away_score: pick.awayScore },
                currentMatch,
                liveStateByMatch?.[currentMatch.id] ?? null
              )
              const toneStyle = PICK_TONE[tone]
              return (
                <div
                  key={pick.userId}
                  className={`brand-card rounded-card p-3 text-center ${
                    pick.isMine ? 'ring-1 ring-brand-green' : ''
                  }`}
                >
                  <p className="truncate text-xs font-semibold text-muted">
                    {pick.name}
                    {pick.isMine && <span className="font-bold text-brand-green-strong"> (Tú)</span>}
                  </p>
                  <p className={`brand-display mt-1 text-xl font-black ${toneStyle.score}`}>
                    {pick.homeScore}-{pick.awayScore}
                  </p>
                  {toneStyle.label && (
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-2xs font-bold ${toneStyle.chip}`}>
                      {toneStyle.label}
                    </span>
                  )}
                  <p className="mt-1 text-2xs text-muted/78">
                    {formatMatchDate(pick.createdAt)} | {formatMatchTime(pick.createdAt)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
