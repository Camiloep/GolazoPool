/* eslint-disable @next/next/no-img-element */
import CopyInviteButton from '@/components/leagues/CopyInviteButton'
import HorizontalMouseScroll from '@/components/leagues/HorizontalMouseScroll'
import LeaderboardBoard from '@/components/leagues/LeaderboardBoard'
import LeagueStatsSheet from '@/components/leagues/LeagueStatsSheet'
import { LiveMatchRefresher } from '@/components/matches/LiveMatchRefresher'
import { MatchStatusStrip } from '@/components/matches/MatchStatusStrip'
import { PredictionCountdown } from '@/components/predictions/PredictionCountdown'
import {
  formatMatchDate,
  formatMatchTime,
  getColombiaDateParts,
  getColombiaDayKey,
} from '@/lib/datetime'
import { flagUrl } from '@/lib/flags'
import {
  DEFAULT_PREDICTION_LOCK_MINUTES,
  formatPredictionLockWindow,
  getMemberPredictionVisibilityRuleText,
  getPredictionEditRuleText,
  getTieBreakerRuleText,
  isMissingLeagueSettingsTable,
  normalizeLeagueSettings,
} from '@/lib/league-settings'
import {
  buildLeaderboard,
  calcPredictionPoints,
  GENERAL_SCORING_RULE,
  getPredictionLockState,
} from '@/lib/predictions'
import { createClient } from '@/lib/supabase/server'
import { buildSectionStartMap, getMatchSectionKey } from '@/lib/tournament'
import { type MatchLiveState, type MatchPhase, type PredictionLockMode } from '@/lib/types'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

const SECTION_LABELS: Record<string, string> = {
  group_round_1: 'Ronda 1',
  group_round_2: 'Ronda 2',
  group_round_3: 'Ronda 3',
  r32: 'Dieciseisavos',
  r16: 'Octavos',
  quarterfinal: 'Cuartos',
  semifinal: 'Semifinal',
  third_place: '3er Puesto',
  final: 'Final',
}

const SECTION_ORDER = [
  'group_round_1',
  'group_round_2',
  'group_round_3',
  'r32',
  'r16',
  'quarterfinal',
  'semifinal',
  'third_place',
  'final',
]

function dateRange(dates: string[]) {
  if (!dates.length) return ''

  const ms = dates.map(date => new Date(date).getTime())
  const min = new Date(Math.min(...ms))
  const max = new Date(Math.max(...ms))
  const minParts = getColombiaDateParts(min)
  const maxParts = getColombiaDateParts(max)

  if (getColombiaDayKey(min) === getColombiaDayKey(max)) return formatMatchDate(min)
  if (minParts.month === maxParts.month) return `${minParts.day} - ${formatMatchDate(max)}`
  return `${formatMatchDate(min)} - ${formatMatchDate(max)}`
}

function dayKey(isoDate: string) {
  return formatMatchDate(isoDate, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function gridClass(count: number) {
  if (count === 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-2'
  if (count === 3) return 'grid-cols-2'
  if (count === 4) return 'grid-cols-2'
  return 'grid-cols-2'
}

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ round?: string; view?: string }>
}) {
  const { id: leagueId } = await params
  const { round: roundParam, view: viewParam } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    { data: league },
    { data: myMembership },
    { data: members },
    { data: phases },
    { data: matches },
    { data: allPredictions },
    { data: myPredictions },
    settingsResponse,
  ] = await Promise.all([
    supabase.from('leagues').select('*').eq('id', leagueId).single(),
    supabase
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('league_members')
      .select('role, profile:profiles(id, name)')
      .eq('league_id', leagueId)
      .order('joined_at'),
    supabase.from('tournament_phases').select('*').order('phase'),
    supabase
      .from('matches')
      .select('*, label, home_team:teams!matches_home_team_id_fkey(name, code, flag_emoji), away_team:teams!matches_away_team_id_fkey(name, code, flag_emoji)')
      .order('starts_at'),
    supabase
      .from('predictions')
      .select('user_id, home_score, away_score, confirmed_at, created_at, match:matches(home_score, away_score, status, starts_at)')
      .eq('league_id', leagueId)
      .eq('confirmed', true),
    supabase
      .from('predictions')
      .select('match_id, home_score, away_score, confirmed')
      .eq('league_id', leagueId)
      .eq('user_id', user.id),
    supabase
      .from('league_settings')
      .select('league_id, rules, prizes, allow_prediction_edits, member_prediction_visibility, member_prediction_view_mode, require_match_prediction_for_pick_visibility, tie_breaker_order, prediction_lock_minutes, prediction_lock_mode, updated_at, updated_by')
      .eq('league_id', leagueId)
      .maybeSingle(),
  ])

  if (!league || !myMembership) notFound()

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


  const settings = settingsResponse.error && !isMissingLeagueSettingsTable(settingsResponse.error)
    ? normalizeLeagueSettings(leagueId, null)
    : normalizeLeagueSettings(leagueId, settingsResponse.data)

  const predictionLockMinutes =
    settings.prediction_lock_minutes ?? DEFAULT_PREDICTION_LOCK_MINUTES
  const predictionLockText = `Los pronosticos se cierran ${formatPredictionLockWindow(
    predictionLockMinutes,
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
  const tieBreakerText = getTieBreakerRuleText(settings.tie_breaker_order)
  const tournamentStartsAt = (matches ?? [])[0]?.starts_at ?? null
  const sectionStartMap = buildSectionStartMap(matches ?? [])

  const predictionsByMatch = Object.fromEntries((myPredictions ?? []).map(prediction => [prediction.match_id, prediction]))

  const enabledPhases = new Set((phases ?? []).filter(phase => phase.is_enabled).map(phase => phase.phase))
  const enabledMatches = (matches ?? []).filter(match => enabledPhases.has(match.phase as MatchPhase))

  const matchesBySection = enabledMatches.reduce<Record<string, typeof enabledMatches>>((acc, match) => {
    const key = getMatchSectionKey(match.phase, match.match_number)
    if (!acc[key]) acc[key] = []
    acc[key].push(match)
    return acc
  }, {})

  const sections = SECTION_ORDER
    .filter(key => matchesBySection[key]?.length)
    .map(key => ({
      key,
      label: SECTION_LABELS[key],
      range: dateRange((matchesBySection[key] ?? []).map(match => match.starts_at)),
    }))

  // Ronda por defecto (cuando la URL no trae ?round=): la fase en la que va el
  // torneo. Prioriza un partido en juego, luego el proximo por jugarse, luego el
  // pendiente mas cercano (partidos postergados); si ya termino todo, la ultima.
  const byStart = (a: (typeof enabledMatches)[number], b: (typeof enabledMatches)[number]) =>
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  const pendingMatches = enabledMatches.filter(match => match.status !== 'finished').sort(byStart)
  const sortedMatches = [...enabledMatches].sort(byStart)
  const focusMatch =
    pendingMatches.find(match => match.status === 'in_progress') ??
    pendingMatches[0] ??
    sortedMatches[sortedMatches.length - 1]
  const currentSectionKey = focusMatch
    ? getMatchSectionKey(focusMatch.phase, focusMatch.match_number)
    : undefined
  const defaultSection =
    currentSectionKey && sections.some(section => section.key === currentSectionKey)
      ? currentSectionKey
      : sections[0]?.key

  const activeSection = sections.find(section => section.key === roundParam)?.key ?? defaultSection
  const isGroupRound = activeSection?.startsWith('group_round_')
  const view = isGroupRound ? (viewParam === 'date' ? 'date' : 'group') : 'date'
  const currentMatches = matchesBySection[activeSection] ?? []

  const byGroup = currentMatches.reduce<Record<string, typeof currentMatches>>((acc, match) => {
    const key = `Grupo ${match.group_letter}`
    if (!acc[key]) acc[key] = []
    acc[key].push(match)
    return acc
  }, {})

  const byDate = currentMatches.reduce<Record<string, typeof currentMatches>>((acc, match) => {
    const key = dayKey(match.starts_at)
    if (!acc[key]) acc[key] = []
    acc[key].push(match)
    return acc
  }, {})

  const leaderboardMembers = (members ?? []).map(member => {
    const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile
    return {
      id: profile?.id ?? null,
      name: profile?.name ?? null,
      role: member.role,
    }
  })

  const leaderboard = buildLeaderboard(
    leaderboardMembers,
    allPredictions ?? [],
    settings.tie_breaker_order
  )
  const hasFinishedMatches = enabledMatches.some(
    match => match.status === 'finished' && match.home_score !== null && match.away_score !== null
  )
  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/join/${league.invite_code}`

  return (
    <div className="space-y-6">
      <LiveMatchRefresher />
      <div className="sm:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link className="brand-link text-sm" href="/dashboard">
              Volver a mis ligas
            </Link>
            <h1 className="brand-display mt-1 text-4xl font-black text-foreground">{league.name}</h1>
          </div>
          {myMembership.role === 'admin' ? (
            <Link
              className="brand-chip-admin mt-6 shrink-0 rounded-full px-3 py-1 text-xs font-bold"
              href={`/leagues/${leagueId}/admin`}
            >
              Admin
            </Link>
          ) : (
            <span className="brand-chip-member mt-6 shrink-0 rounded-full px-3 py-1 text-xs font-bold">
              Miembro
            </span>
          )}
        </div>
        {league.description && (
          <p className="mt-2 text-sm text-muted">{league.description}</p>
        )}
        <div className="mt-3 flex gap-2">
          <div className="flex-1">
            <LeagueStatsSheet
              hasFinishedMatches={hasFinishedMatches}
              isAdmin={myMembership.role === 'admin'}
              currentUserId={user.id}
              leaderboard={leaderboard}
              leagueId={leagueId}
              predictionEditText={predictionEditText}
              predictionLockText={predictionLockText}
              predictionVisibilityText={predictionVisibilityText}
              tieBreakerText={tieBreakerText}
              prizes={settings.prizes ?? null}
              rules={settings.rules ?? null}
            />
          </div>
          <div className="flex-1">
            <CopyInviteButton code={league.invite_code} url={inviteUrl} compact />
          </div>
        </div>
      </div>

      <div className="hidden sm:flex sm:items-start sm:justify-between sm:gap-4">
        <div>
          <Link className="brand-link text-sm" href="/dashboard">
            Volver a mis ligas
          </Link>
          <h1 className="brand-display mt-2 text-4xl font-black text-foreground">{league.name}</h1>
          {league.description && <p className="mt-2 text-sm text-muted">{league.description}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              myMembership.role === 'admin' ? 'brand-chip-admin' : 'brand-chip-member'
            }`}
          >
            {myMembership.role === 'admin' ? 'Administrador' : 'Miembro'}
          </span>
          <div className="flex items-center gap-2">
            <div className="lg:hidden">
              <LeagueStatsSheet
                hasFinishedMatches={hasFinishedMatches}
                isAdmin={myMembership.role === 'admin'}
                currentUserId={user.id}
                leaderboard={leaderboard}
                leagueId={leagueId}
                predictionEditText={predictionEditText}
                predictionLockText={predictionLockText}
                predictionVisibilityText={predictionVisibilityText}
                tieBreakerText={tieBreakerText}
                prizes={settings.prizes ?? null}
                rules={settings.rules ?? null}
              />
            </div>
            <CopyInviteButton code={league.invite_code} url={inviteUrl} />
          </div>
        </div>
      </div>

      {sections.length > 0 && (
        <HorizontalMouseScroll
          activeKey={activeSection}
          className="flex cursor-grab gap-2 overflow-x-auto pb-1 select-none active:cursor-grabbing"
        >
          {sections.map(section => {
            const isActive = section.key === activeSection
            return (
              <Link
                key={section.key}
                data-scroll-key={section.key}
                href={`/leagues/${leagueId}?round=${section.key}`}
                className={`shrink-0 rounded-2xl px-4 py-2.5 text-center transition ${
                  isActive
                    ? 'brand-button-primary text-white'
                    : 'brand-button-secondary text-foreground'
                }`}
              >
                <span className="block text-sm font-bold leading-tight">{section.label}</span>
                <span className={`block text-xs leading-tight ${isActive ? 'text-white/70' : 'text-muted'}`}>
                  {section.range}
                </span>
              </Link>
            )
          })}
        </HorizontalMouseScroll>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {isGroupRound && (
            <div className="brand-panel flex w-max items-center gap-1 self-start rounded-2xl p-1">
              <Link
                href={`/leagues/${leagueId}?round=${activeSection}&view=group`}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  view === 'group' ? 'brand-button-primary text-white' : 'text-muted hover:text-foreground'
                }`}
              >
                Por grupo
              </Link>
              <Link
                href={`/leagues/${leagueId}?round=${activeSection}&view=date`}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  view === 'date' ? 'brand-button-primary text-white' : 'text-muted hover:text-foreground'
                }`}
              >
                Por fecha
              </Link>
            </div>
          )}

          {currentMatches.length === 0 ? (
            <div className="brand-panel rounded-panel py-12 text-center">
              <p className="brand-display text-xl font-black text-foreground">No hay partidos disponibles aun</p>
            </div>
          ) : (
            <>
              {view === 'group'
                ? Object.entries(byGroup).map(([groupName, groupMatches]) => (
                    <div key={groupName}>
                      <p className="brand-kicker mb-2 text-kicker-sm tracking-brand-wide">{groupName}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {groupMatches.map(match => (
                          <MatchCard
                            key={match.id}
                            leagueId={leagueId}
                            match={match}
                            liveState={liveStateByMatch[match.id]}
                            phaseStartsAt={sectionStartMap[getMatchSectionKey(match.phase, match.match_number)] ?? null}
                            predictionLockMode={settings.prediction_lock_mode}
                            prediction={predictionsByMatch[match.id]}
                            predictionLockMinutes={predictionLockMinutes}
                            tournamentStartsAt={tournamentStartsAt}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                : Object.entries(byDate).map(([day, dayMatches]) => (
                    <div key={day}>
                      <p className="brand-kicker mb-2 text-kicker-sm tracking-brand-wide">{day}</p>
                      <div className={`grid ${gridClass(dayMatches.length)} gap-2`}>
                        {dayMatches.map(match => (
                          <MatchCard
                            key={match.id}
                            leagueId={leagueId}
                            match={match}
                            liveState={liveStateByMatch[match.id]}
                            phaseStartsAt={sectionStartMap[getMatchSectionKey(match.phase, match.match_number)] ?? null}
                            predictionLockMode={settings.prediction_lock_mode}
                            prediction={predictionsByMatch[match.id]}
                            predictionLockMinutes={predictionLockMinutes}
                            tournamentStartsAt={tournamentStartsAt}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
            </>
          )}
        </div>

        <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:self-start">
          <LeaderboardBoard
            entries={leaderboard}
            currentUserId={user.id}
            hasFinishedMatches={hasFinishedMatches}
          />

          <div className="brand-panel rounded-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="brand-display text-xl font-black text-foreground">Premios y reglas</h2>
              {myMembership.role === 'admin' && (
                <Link className="brand-link text-xs font-bold" href={`/leagues/${leagueId}/admin`}>
                  Editar
                </Link>
              )}
            </div>
            <p className="mt-2 text-sm text-muted">{predictionLockText}</p>
            <p className="mt-1 text-sm text-muted">{predictionEditText}</p>
            <p className="mt-1 text-sm text-muted">{predictionVisibilityText}</p>
            <p className="mt-1 text-sm text-muted">{tieBreakerText}</p>

            <div className="mt-4 space-y-4">
              <div>
                <p className="brand-kicker text-kicker-sm tracking-brand">Premios</p>
                <p className="mt-2 whitespace-pre-line text-sm text-muted">
                  {settings.prizes?.trim() || 'Aun no hay premios definidos.'}
                </p>
              </div>
              <div>
                <p className="brand-kicker text-kicker-sm tracking-brand">Regla general</p>
                <p className="mt-2 whitespace-pre-line text-sm text-muted">
                  {GENERAL_SCORING_RULE}
                </p>
              </div>
              <div>
                <p className="brand-kicker text-kicker-sm tracking-brand">Reglas adicionales</p>
                <p className="mt-2 whitespace-pre-line text-sm text-muted">
                  {settings.rules?.trim() || 'Esta liga no tiene reglas adicionales.'}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

type TeamSnippet = { name: string; code: string; flag_emoji: string }
type MatchPrediction = { match_id: string; home_score: number; away_score: number; confirmed: boolean }

function MatchCard({
  match,
  leagueId,
  predictionLockMode,
  prediction,
  predictionLockMinutes,
  tournamentStartsAt,
  phaseStartsAt,
  liveState,
}: {
  match: {
    id: string
    starts_at: string
    status: string
    group_letter: string | null
    label: string | null
    venue: string | null
    home_score: number | null
    away_score: number | null
    home_team: TeamSnippet | TeamSnippet[] | null
    away_team: TeamSnippet | TeamSnippet[] | null
  }
  leagueId: string
  predictionLockMode: PredictionLockMode
  prediction: MatchPrediction | undefined
  predictionLockMinutes: number
  tournamentStartsAt: string | null
  phaseStartsAt: string | null
  liveState: MatchLiveState | undefined
}) {
  const homeTeam = Array.isArray(match.home_team) ? match.home_team[0] : match.home_team
  const awayTeam = Array.isArray(match.away_team) ? match.away_team[0] : match.away_team
  const lockState = getPredictionLockState({
    startsAt: match.starts_at,
    status: match.status,
    lockMinutes: predictionLockMinutes,
    lockMode: predictionLockMode,
    tournamentStartsAt,
    phaseStartsAt,
    hasBothTeams: Boolean(homeTeam && awayTeam),
  })
  const isLocked = lockState.locked
  const isFinished = match.status === 'finished'
  const isConfirmed = prediction?.confirmed ?? false
  const statusLabel = isLocked ? 'Cerrado' : 'Pronosticar ->'
  const statusClass = isLocked ? 'brand-chip-neutral' : 'brand-chip-admin'
  const dateStr = formatMatchDate(match.starts_at)
  const timeStr = formatMatchTime(match.starts_at)
  const isTbd = !homeTeam && !awayTeam
  const homeFlagUrl = homeTeam?.code ? flagUrl(homeTeam.code) : null
  const awayFlagUrl = awayTeam?.code ? flagUrl(awayTeam.code) : null

  let points: number | null = null
  if (isFinished && isConfirmed && prediction && match.home_score !== null && match.away_score !== null) {
    points = calcPredictionPoints(prediction, match)
  }

  return (
    <Link
      href={`/leagues/${leagueId}/predictions?match=${match.id}`}
      className={`brand-card flex flex-col rounded-3xl p-3 transition hover:border-brand-green ${
        isConfirmed ? 'border-brand-green/34' : ''
      }`}
    >
      {isTbd ? (
        <p className="py-2 text-center text-xs font-semibold text-muted">{match.label ?? 'Por definir'}</p>
      ) : (
        <div className="flex items-start justify-between gap-1">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            {homeFlagUrl ? (
              <img
                alt={homeTeam?.name ?? ''}
                className="h-5 w-8 rounded-sm object-cover"
                height={22}
                src={homeFlagUrl}
                width={32}
              />
            ) : (
              <span className="text-lg">-</span>
            )}
            <span className="w-full truncate text-center text-caption font-semibold leading-tight text-foreground">
              {homeTeam?.name ?? 'Por definir'}
            </span>
          </div>
          <span className="mt-2 shrink-0 text-2xs font-bold text-muted">vs</span>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            {awayFlagUrl ? (
              <img
                alt={awayTeam?.name ?? ''}
                className="h-5 w-8 rounded-sm object-cover"
                height={22}
                src={awayFlagUrl}
                width={32}
              />
            ) : (
              <span className="text-lg">-</span>
            )}
            <span className="w-full truncate text-center text-caption font-semibold leading-tight text-foreground">
              {awayTeam?.name ?? 'Por definir'}
            </span>
          </div>
        </div>
      )}

      <p className="mt-2 text-center text-2xs text-muted">
        {dateStr} | {timeStr}
      </p>
      {match.venue && (
        <p className="truncate text-center text-2xs text-muted/75">{match.venue}</p>
      )}

      <div className="mt-2 flex flex-col items-center gap-1">
        {match.status === 'in_progress' ? (
          <MatchStatusStrip
            status={match.status}
            phase={liveState?.phase ?? null}
            stageCode={liveState?.stage_code ?? null}
            stageStartedAtMs={
              liveState?.stage_started_at ? new Date(liveState.stage_started_at).getTime() : null
            }
            homeScore={match.home_score}
            awayScore={match.away_score}
            penHomeScore={liveState?.pen_home_score ?? null}
            penAwayScore={liveState?.pen_away_score ?? null}
          />
        ) : isFinished && match.home_score !== null ? (
          <div className="flex flex-col items-center gap-0.5">
            {/* El pill azul (marcador de los 90') se mantiene consistente con los
                partidos normales; abajo, chips con el detalle de prórroga/penales. */}
            <span className="brand-score-pill rounded-full px-2.5 py-0.5 text-sm font-black">
              {match.home_score}-{match.away_score}
            </span>
            {liveState?.stage_code === 10 &&
              liveState.home_score != null &&
              liveState.away_score != null &&
              (liveState.home_score !== match.home_score ||
                liveState.away_score !== match.away_score) && (
                <span className="brand-score-pill rounded-full px-2 py-0.5 text-3xs font-bold">
                  Prórroga {liveState.home_score}-{liveState.away_score}
                </span>
              )}
            {liveState?.pen_home_score != null && liveState?.pen_away_score != null && (
              <span className="brand-score-pill rounded-full px-2 py-0.5 text-3xs font-bold">
                Penales {liveState.pen_home_score}-{liveState.pen_away_score}
              </span>
            )}
          </div>
        ) : !isConfirmed ? (
          <span className={`rounded-full px-2 py-0.5 text-2xs font-bold ${statusClass}`}>
            {statusLabel}
          </span>
        ) : null}
        {isConfirmed && prediction && (
          <span className="text-xs text-muted">
            Tu pronostico: {prediction.home_score}-{prediction.away_score}
            {points !== null && (
              <span
                className={`ml-1 font-bold ${
                  points === 3 ? 'text-brand-green-strong' : points === 1 ? 'text-brand-gold-strong' : 'text-muted'
                }`}
              >
                {points === 3 ? '+3' : points === 1 ? '+1' : '0 pts'}
              </span>
            )}
          </span>
        )}
      </div>

      {!isLocked && <PredictionCountdown lockAtMs={lockState.lockAt.getTime()} />}
    </Link>
  )
}
