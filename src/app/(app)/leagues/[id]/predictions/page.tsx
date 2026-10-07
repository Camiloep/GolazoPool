import { LiveMatchRefresher } from '@/components/matches/LiveMatchRefresher'
import MatchCarousel from '@/components/predictions/MatchCarousel'
import PredictionInfoSummary from '@/components/predictions/PredictionInfoSummary'
import {
  formatPredictionLockWindow,
  getMemberPredictionVisibilityRuleText,
  getPredictionEditRuleText,
  isMissingLeagueSettingsTable,
  normalizeLeagueSettings,
} from '@/lib/league-settings'
import {
  buildPickDistribution,
  canViewerSeeMatchPicks,
  GENERAL_SCORING_RULE,
  getPredictionLockState,
  shouldShowAggregatePickView,
  shouldShowParticipantOnlyPickView,
} from '@/lib/predictions'
import { createClient } from '@/lib/supabase/server'
import { buildSectionStartMap, getMatchSectionKey } from '@/lib/tournament'
import type { MatchLiveState } from '@/lib/types'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export default async function PredictionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ match?: string }>
}) {
  const { id: leagueId } = await params
  const { match: selectedMatchId } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    { data: membership },
    { data: league },
    { data: phases },
    settingsResponse,
    { data: firstMatch, error: firstMatchError },
  ] = await Promise.all([
    supabase
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single(),
    supabase.from('leagues').select('name').eq('id', leagueId).single(),
    supabase.from('tournament_phases').select('phase').eq('is_enabled', true),
    supabase
      .from('league_settings')
      .select('league_id, rules, prizes, allow_prediction_edits, member_prediction_visibility, member_prediction_view_mode, require_match_prediction_for_pick_visibility, prediction_lock_minutes, prediction_lock_mode, updated_at, updated_by')
      .eq('league_id', leagueId)
      .maybeSingle(),
    supabase
      .from('matches')
      .select('starts_at')
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  if (!membership) notFound()
  if (firstMatchError) notFound()

  const settings =
    settingsResponse.error && !isMissingLeagueSettingsTable(settingsResponse.error)
      ? normalizeLeagueSettings(leagueId, null)
      : normalizeLeagueSettings(leagueId, settingsResponse.data)
  const predictionLockText = `Esta liga cierra los pronosticos ${formatPredictionLockWindow(
    settings.prediction_lock_minutes,
    settings.prediction_lock_mode
  )}.`
  const predictionEditText = getPredictionEditRuleText(settings.allow_prediction_edits)
  const predictionVisibilityText = getMemberPredictionVisibilityRuleText({
    memberPredictionViewMode: settings.member_prediction_view_mode,
    memberPredictionVisibility: settings.member_prediction_visibility,
    predictionLockMinutes: settings.prediction_lock_minutes,
    predictionLockMode: settings.prediction_lock_mode,
    requireMatchPredictionForPickVisibility:
      settings.require_match_prediction_for_pick_visibility,
  })
  const predictionInfoLines = [
    settings.allow_prediction_edits
      ? 'Al guardar, el pronostico queda confirmado, pero podras editarlo mientras la ventana siga abierta.'
      : 'Al guardar, el pronostico queda confirmado y no puede cambiarse.',
    GENERAL_SCORING_RULE,
    predictionLockText,
    predictionEditText,
    predictionVisibilityText,
  ]

  const enabledPhases = (phases ?? []).map(phase => phase.phase)
  const showAggregateOnly = shouldShowAggregatePickView({
    memberPredictionViewMode: settings.member_prediction_view_mode,
  })
  const showParticipantOnly = shouldShowParticipantOnlyPickView({
    memberPredictionViewMode: settings.member_prediction_view_mode,
  })

  const [{ data: matches }, { data: myPredictions }, { data: allConfirmed }, { data: allOtherPicks }, { data: leagueMembers }] = await Promise.all([
    supabase
      .from('matches')
      .select(`
        id, match_number, phase, group_letter, starts_at, venue, label, status, home_score, away_score,
        home_team:teams!matches_home_team_id_fkey(id, name, code, flag_emoji),
        away_team:teams!matches_away_team_id_fkey(id, name, code, flag_emoji)
      `)
      .in('phase', enabledPhases)
      .order('starts_at'),
    supabase
      .from('predictions')
      .select('id, match_id, home_score, away_score, confirmed, created_at')
      .eq('league_id', leagueId)
      .eq('user_id', user.id),
    supabase
      .from('predictions')
      .select('match_id')
      .eq('league_id', leagueId)
      .eq('confirmed', true),
    supabase
      .from('predictions')
      .select('match_id, user_id, home_score, away_score, created_at')
      .eq('league_id', leagueId)
      .eq('confirmed', true)
      .neq('user_id', user.id),
    supabase
      .from('league_members')
      .select('user_id, profile:profiles(name)')
      .eq('league_id', leagueId),
  ])

  const predictionsByMatch = Object.fromEntries((myPredictions ?? []).map(prediction => [prediction.match_id, prediction]))

  // Live snapshots: partidos en juego (fase/minuto) y finalizados (para el
  // resultado tras prórroga y el marcador de penales junto al de los 90').
  const liveStateIds = (matches ?? [])
    .filter(match => match.status === 'in_progress' || match.status === 'finished')
    .map(match => match.id)
  const { data: liveStates } = liveStateIds.length
    ? await supabase
        .from('match_live_states')
        .select(
          'match_id, phase, stage_code, minute, stage_started_at, is_stopped, home_score, away_score, pen_home_score, pen_away_score, reg_home_score, reg_away_score'
        )
        .in('match_id', liveStateIds)
    : { data: [] }
  const liveStateByMatch = Object.fromEntries(
    (liveStates ?? []).map(state => [state.match_id, state])
  ) as Record<string, MatchLiveState>

  const countByMatch: Record<string, number> = {}
  for (const prediction of allConfirmed ?? []) {
    countByMatch[prediction.match_id] = (countByMatch[prediction.match_id] ?? 0) + 1
  }

  const nameByUser = Object.fromEntries(
    (leagueMembers ?? []).map(member => {
      const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile
      return [member.user_id, (profile as { name?: string } | null)?.name ?? '-']
    })
  )

  const matchById = new Map((matches ?? []).map(match => [match.id, match]))
  const sectionStartMap = buildSectionStartMap(matches ?? [])
  const phaseStartsByMatchId = Object.fromEntries(
    (matches ?? []).map(match => [
      match.id,
      sectionStartMap[getMatchSectionKey(match.phase, match.match_number)] ?? null,
    ])
  )
  const picksByMatch: Record<string, { userId: string; name: string; homeScore: number; awayScore: number; createdAt: string; isMine?: boolean }[]> = {}
  const participantsByMatch: Record<string, { userId: string; name: string }[]> = {}
  const rawPickDistributionByMatch: Record<string, { homeScore: number; awayScore: number }[]> = {}
  for (const pick of allOtherPicks ?? []) {
    const match = matchById.get(pick.match_id)
    if (!match) continue
    const viewerHasConfirmedPrediction = Boolean(
      predictionsByMatch[pick.match_id]?.confirmed
    )
    const matchHomeTeam = Array.isArray(match.home_team) ? match.home_team[0] : match.home_team
    const matchAwayTeam = Array.isArray(match.away_team) ? match.away_team[0] : match.away_team
    if (!canViewerSeeMatchPicks({
      memberPredictionVisibility: settings.member_prediction_visibility,
      requireMatchPredictionForPickVisibility:
        settings.require_match_prediction_for_pick_visibility,
      viewerHasConfirmedPrediction,
      startsAt: match.starts_at,
      status: match.status,
      lockMinutes: settings.prediction_lock_minutes,
      lockMode: settings.prediction_lock_mode,
      tournamentStartsAt: firstMatch?.starts_at ?? null,
      phaseStartsAt: phaseStartsByMatchId[match.id] ?? null,
      hasBothTeams: Boolean(matchHomeTeam && matchAwayTeam),
    })) {
      // While the prediction window is still open, reveal WHO already
      // submitted a pick (names only, never the score) — unless the league
      // hides picks entirely.
      if (settings.member_prediction_visibility !== 'never') {
        const { locked } = getPredictionLockState({
          startsAt: match.starts_at,
          status: match.status,
          lockMinutes: settings.prediction_lock_minutes,
          lockMode: settings.prediction_lock_mode,
          tournamentStartsAt: firstMatch?.starts_at ?? null,
          phaseStartsAt: phaseStartsByMatchId[match.id] ?? null,
          hasBothTeams: Boolean(matchHomeTeam && matchAwayTeam),
        })
        if (!locked) {
          if (!participantsByMatch[pick.match_id]) participantsByMatch[pick.match_id] = []
          participantsByMatch[pick.match_id].push({
            userId: pick.user_id,
            name: nameByUser[pick.user_id] ?? '-',
          })
        }
      }
      continue
    }

    if (showAggregateOnly) {
      if (!rawPickDistributionByMatch[pick.match_id]) rawPickDistributionByMatch[pick.match_id] = []
      rawPickDistributionByMatch[pick.match_id].push({
        homeScore: pick.home_score as number,
        awayScore: pick.away_score as number,
      })
    } else if (showParticipantOnly) {
      if (!participantsByMatch[pick.match_id]) participantsByMatch[pick.match_id] = []
      participantsByMatch[pick.match_id].push({
        userId: pick.user_id,
        name: nameByUser[pick.user_id] ?? '-',
      })
    } else {
      if (!picksByMatch[pick.match_id]) picksByMatch[pick.match_id] = []
      picksByMatch[pick.match_id].push({
        userId: pick.user_id,
        name: nameByUser[pick.user_id] ?? '-',
        homeScore: pick.home_score as number,
        awayScore: pick.away_score as number,
        createdAt: pick.created_at as string,
      })
    }
  }

  // Incluir tambien mi propio pick en la grilla "Picks de la liga", junto a los
  // demas, cuando ya esta visible (mismo criterio de visibilidad que los otros).
  if (!showAggregateOnly && !showParticipantOnly) {
    for (const myPred of myPredictions ?? []) {
      if (!myPred.confirmed) continue
      const match = matchById.get(myPred.match_id)
      if (!match) continue
      const matchHomeTeam = Array.isArray(match.home_team) ? match.home_team[0] : match.home_team
      const matchAwayTeam = Array.isArray(match.away_team) ? match.away_team[0] : match.away_team
      const canSeeOwnPick = canViewerSeeMatchPicks({
        memberPredictionVisibility: settings.member_prediction_visibility,
        requireMatchPredictionForPickVisibility:
          settings.require_match_prediction_for_pick_visibility,
        viewerHasConfirmedPrediction: true,
        startsAt: match.starts_at,
        status: match.status,
        lockMinutes: settings.prediction_lock_minutes,
        lockMode: settings.prediction_lock_mode,
        tournamentStartsAt: firstMatch?.starts_at ?? null,
        phaseStartsAt: phaseStartsByMatchId[match.id] ?? null,
        hasBothTeams: Boolean(matchHomeTeam && matchAwayTeam),
      })
      if (!canSeeOwnPick) continue
      if (!picksByMatch[myPred.match_id]) picksByMatch[myPred.match_id] = []
      picksByMatch[myPred.match_id].unshift({
        userId: user.id,
        name: nameByUser[user.id] ?? '-',
        homeScore: myPred.home_score,
        awayScore: myPred.away_score,
        createdAt: myPred.created_at as string,
        isMine: true,
      })
    }
  }

  const pickDistributionByMatch = Object.fromEntries(
    Object.entries(rawPickDistributionByMatch).map(([matchId, picks]) => [
      matchId,
      buildPickDistribution(picks),
    ])
  )

  const confirmedMatchIds = new Set(
    (myPredictions ?? []).filter(p => p.confirmed).map(p => p.match_id)
  )
  const initialMatch =
    (selectedMatchId
      ? (matches ?? []).find(match => match.id === selectedMatchId)
      : null)
    ?? (matches ?? []).find(m => m.status === 'scheduled' && !confirmedMatchIds.has(m.id))
    ?? (matches ?? [])[0]
    ?? null

  return (
    <div className="space-y-5">
      <LiveMatchRefresher />
      <div>
        <Link className="brand-link text-sm" href={`/leagues/${leagueId}`}>
          Volver a {league?.name ?? 'Liga'}
        </Link>
        <h1 className="brand-display mt-2 text-4xl font-black text-foreground">Pronosticos</h1>
        <PredictionInfoSummary lines={predictionInfoLines} />
      </div>

      {initialMatch && (matches ?? []).length > 0 && (
        <MatchCarousel
          allowPredictionEdits={settings.allow_prediction_edits}
          initialMatchId={initialMatch.id}
          leagueId={leagueId}
          liveStateByMatch={liveStateByMatch}
          matches={matches ?? []}
          memberPredictionVisibility={settings.member_prediction_visibility}
          memberPredictionViewMode={settings.member_prediction_view_mode}
          pickDistributionByMatch={pickDistributionByMatch}
          picksByMatch={picksByMatch}
          participantsByMatch={participantsByMatch}
          predictionLockMode={settings.prediction_lock_mode}
          predictionLockMinutes={settings.prediction_lock_minutes}
          predictionsByMatch={predictionsByMatch}
          requireMatchPredictionForPickVisibility={
            settings.require_match_prediction_for_pick_visibility
          }
          totalPredictionsByMatch={countByMatch}
          tournamentStartsAt={firstMatch?.starts_at ?? null}
          phaseStartsByMatchId={phaseStartsByMatchId}
        />
      )}
    </div>
  )
}
