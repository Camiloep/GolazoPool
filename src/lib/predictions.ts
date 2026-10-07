import type {
  LeaderboardTieBreakerCriterion,
  LeagueMemberRole,
  MemberPredictionViewMode,
  MatchStatus,
  MemberPredictionVisibility,
  PredictionLockMode,
} from '@/lib/types'

type ScoreLike = {
  home_score: number | null
  away_score: number | null
}

type PredictionScoreLike = {
  home_score: number
  away_score: number
}

type MemberLike = {
  id: string | null | undefined
  name: string | null | undefined
  role: LeagueMemberRole
}

type ConfirmedPredictionLike = {
  confirmed_at: string | null
  created_at: string | null
  user_id: string
  home_score: number
  away_score: number
  match: ({ status: string; home_score: number | null; away_score: number | null; starts_at?: string | null } | null)[] | {
    status: string
    home_score: number | null
    away_score: number | null
    starts_at?: string | null
  } | null
}

export interface LeaderboardEntry {
  userId: string
  name: string | null
  role: LeagueMemberRole
  points: number
  drawHits: number
  exactHits: number
  firstExactHitAt: string | null
  firstPredictionAt: string | null
  firstScoringPickAt: string | null
  goalDifferenceHits: number
  totalGoalError: number
  totalGoalsHits: number
  winnerHits: number
  // Pronosticos de partidos ya jugados (denominador para % de efectividad).
  playedPicks?: number
  // Racha de aciertos consecutivos en los partidos jugados mas recientes.
  streak?: number
}

export interface PickDistributionEntry {
  count: number
  homeScore: number
  awayScore: number
}

export const GENERAL_SCORING_RULE =
  '3 puntos por marcador exacto, 1 punto por acertar ganador o empate. En eliminatorias se puntua con el marcador de los 90 minutos (sin prorroga ni penales).'

export function isExactPrediction(
  prediction: PredictionScoreLike,
  match: ScoreLike
) {
  return prediction.home_score === match.home_score && prediction.away_score === match.away_score
}

export function isWinnerPrediction(
  prediction: PredictionScoreLike,
  match: ScoreLike
) {
  if (match.home_score === null || match.away_score === null) return false
  if (match.home_score === match.away_score) return false

  return (
    Math.sign(prediction.home_score - prediction.away_score) ===
    Math.sign(match.home_score - match.away_score)
  )
}

export function isDrawPrediction(
  prediction: PredictionScoreLike,
  match: ScoreLike
) {
  if (match.home_score === null || match.away_score === null) return false

  return (
    prediction.home_score === prediction.away_score &&
    match.home_score === match.away_score
  )
}

function isOutcomePrediction(
  prediction: PredictionScoreLike,
  match: ScoreLike
) {
  if (match.home_score === null || match.away_score === null) return false

  return (
    Math.sign(prediction.home_score - prediction.away_score) ===
    Math.sign(match.home_score - match.away_score)
  )
}

export function calcPredictionPoints(
  prediction: PredictionScoreLike,
  match: ScoreLike
) {
  if (match.home_score === null || match.away_score === null) return 0
  if (isExactPrediction(prediction, match)) return 3
  return isOutcomePrediction(prediction, match) ? 1 : 0
}

// Flashscore live-stage codes that suspend provisional scoring while a match is
// in progress (mirror of FS_STAGE). Shared by the prediction card and picks list.
export const ANULADO_LIVE_STAGES = [37, 5, 8, 9] // aplazado, cancelado, abandonado, walkover
// Solo se suspende la puntuacion cuando el marcador esta congelado a mitad de
// juego y aun puede cambiar al reanudar: 36 = interrumpido. La prórroga y los
// penales NO se suspenden: se siguen mostrando puntos y la fase (Descanso/
// Prórroga/Penales), pero calculados sobre el marcador de los 90' (ver
// getScoringScore), no sobre el marcador en vivo con goles de tiempo extra.
export const PENDING_LIVE_STAGES = [36] // interrumpido

// Stage codes posteriores a los 90' en eliminatorias: descanso entre periodos
// (46, previo a la prórroga o a los penales), prórroga (6) y penales (7). En
// ellos matches.home/away_score (y match_live_states.home/away_score) ya traen el
// marcador ACTUAL con goles de tiempo extra, pero para PUNTUAR solo cuenta el de
// los 90', que se lee de reg_home_score/reg_away_score.
export const POST_REGULATION_LIVE_STAGES = [46, 6, 7] // descanso, prórroga, penales

type LiveScoringStateLike = {
  stage_code: number | null
  reg_home_score: number | null
  reg_away_score: number | null
} | null | undefined

// Marcador con el que se PUNTÚA un pick, según el estado en vivo. En eliminatorias
// solo cuenta el marcador de los 90': mientras el partido sigue EN JUEGO y ya pasó
// a descanso/prórroga/penales, matches.home/away_score trae el marcador actual (con
// goles de tiempo extra), asi que en su lugar se usa el reglamentario (reg_*) del
// estado en vivo. En cualquier otro caso —tiempo regular, y sobre todo partidos ya
// finalizados, donde matches.home/away_score es la fuente autoritativa del de los
// 90' (la que usa la tabla)— se usa el marcador de matches. El guard por status es
// clave: un partido finalizado puede quedar con un match_live_state rezagado en
// prórroga (el sync horario de respaldo cierra el partido sin tocar el estado en
// vivo); sin el guard leeria un reg_* viejo o null y contradiria la tabla.
export function getScoringScore(
  match: { status: string; home_score: number | null; away_score: number | null },
  liveState?: LiveScoringStateLike
): ScoreLike {
  const stage = liveState?.stage_code ?? null
  if (match.status === 'in_progress' && POST_REGULATION_LIVE_STAGES.includes(stage ?? -1)) {
    return {
      home_score: liveState?.reg_home_score ?? null,
      away_score: liveState?.reg_away_score ?? null,
    }
  }
  return { home_score: match.home_score, away_score: match.away_score }
}

export type PickResultTone = 'exact' | 'outcome' | 'miss' | 'pending'

// Color tone for a pick based on the final result (finished) or the live score
// (in progress). Uses getScoringScore, so once a knockout match passes 90' the
// tone reflects the 90' score (congelado), not the live extra-time score. Returns
// 'pending' when there is no scoring score yet or the live stage suspends scoring
// (interrumpido) or is anulado (aplazado, cancelado, abandonado, walkover).
export function getPickResultTone(
  prediction: PredictionScoreLike,
  match: { status: string; home_score: number | null; away_score: number | null },
  liveState?: LiveScoringStateLike
): PickResultTone {
  const stageCode = liveState?.stage_code ?? null
  const isFinished = match.status === 'finished'
  const isLiveScored =
    match.status === 'in_progress' &&
    !ANULADO_LIVE_STAGES.includes(stageCode ?? -1) &&
    !PENDING_LIVE_STAGES.includes(stageCode ?? -1)

  if (!isFinished && !isLiveScored) return 'pending'

  const score = getScoringScore(match, liveState)
  if (score.home_score === null || score.away_score === null) return 'pending'

  const points = calcPredictionPoints(prediction, score)
  return points === 3 ? 'exact' : points === 1 ? 'outcome' : 'miss'
}

export function isGoalDifferencePrediction(
  prediction: PredictionScoreLike,
  match: ScoreLike
) {
  if (match.home_score === null || match.away_score === null) return false

  return (
    prediction.home_score - prediction.away_score ===
    match.home_score - match.away_score
  )
}

export function isTotalGoalsPrediction(
  prediction: PredictionScoreLike,
  match: ScoreLike
) {
  if (match.home_score === null || match.away_score === null) return false

  return (
    prediction.home_score + prediction.away_score ===
    match.home_score + match.away_score
  )
}

export function getPredictionGoalError(
  prediction: PredictionScoreLike,
  match: ScoreLike
) {
  if (match.home_score === null || match.away_score === null) return 0

  return (
    Math.abs(prediction.home_score - match.home_score) +
    Math.abs(prediction.away_score - match.away_score)
  )
}

export function getPredictionLockDate(startsAt: string, lockMinutes: number) {
  return new Date(new Date(startsAt).getTime() - lockMinutes * 60_000)
}

export function getPredictionLockState({
  startsAt,
  status,
  lockMinutes,
  lockMode = 'per_match',
  tournamentStartsAt,
  phaseStartsAt,
  hasBothTeams = true,
  now = new Date(),
}: {
  startsAt: string
  status: string
  lockMinutes: number
  lockMode?: PredictionLockMode
  tournamentStartsAt?: string | null
  phaseStartsAt?: string | null
  hasBothTeams?: boolean
  now?: Date
}) {
  const effectiveLockMode =
    (lockMode === 'tournament_start' || lockMode === 'phase_start') && !hasBothTeams
      ? 'per_match'
      : lockMode
  const referenceStartsAt =
    effectiveLockMode === 'tournament_start'
      ? (tournamentStartsAt ?? startsAt)
      : effectiveLockMode === 'phase_start'
        ? (phaseStartsAt ?? startsAt)
        : startsAt
  const lockAt = getPredictionLockDate(referenceStartsAt, lockMinutes)
  const lockedBySchedule = now >= lockAt

  if (status !== 'scheduled') {
    return { locked: true, reason: 'status' as const, lockAt }
  }

  if (lockedBySchedule) {
    return {
      locked: true,
      reason:
        effectiveLockMode === 'tournament_start'
          ? lockMinutes > 0
            ? ('tournament_window' as const)
            : ('tournament_started' as const)
          : effectiveLockMode === 'phase_start'
            ? lockMinutes > 0
              ? ('phase_window' as const)
              : ('phase_started' as const)
            : lockMinutes > 0
              ? ('window' as const)
              : ('started' as const),
      lockAt,
    }
  }

  return { locked: false, reason: 'open' as const, lockAt }
}

export function canViewerSeeMatchPicks({
  memberPredictionVisibility,
  requireMatchPredictionForPickVisibility,
  viewerHasConfirmedPrediction,
  startsAt,
  status,
  lockMinutes,
  lockMode = 'per_match',
  tournamentStartsAt,
  phaseStartsAt,
  hasBothTeams = true,
  now = new Date(),
}: {
  memberPredictionVisibility: MemberPredictionVisibility
  requireMatchPredictionForPickVisibility: boolean
  viewerHasConfirmedPrediction: boolean
  startsAt: string
  status: MatchStatus | string
  lockMinutes: number
  lockMode?: PredictionLockMode
  tournamentStartsAt?: string | null
  phaseStartsAt?: string | null
  hasBothTeams?: boolean
  now?: Date
}) {
  if (memberPredictionVisibility === 'never') return false
  if (requireMatchPredictionForPickVisibility && !viewerHasConfirmedPrediction) return false
  if (memberPredictionVisibility === 'always') return true

  return getPredictionLockState({
    startsAt,
    status,
    lockMinutes,
    lockMode,
    tournamentStartsAt,
    phaseStartsAt,
    hasBothTeams,
    now,
  }).locked
}

export function shouldShowAggregatePickView({
  memberPredictionViewMode,
}: {
  memberPredictionViewMode: MemberPredictionViewMode
}) {
  return memberPredictionViewMode === 'aggregate'
}

export function shouldShowParticipantOnlyPickView({
  memberPredictionViewMode,
}: {
  memberPredictionViewMode: MemberPredictionViewMode
}) {
  return memberPredictionViewMode === 'participants'
}

export function buildPickDistribution(
  picks: Array<{ awayScore: number; homeScore: number }>
): PickDistributionEntry[] {
  const byScore = new Map<string, PickDistributionEntry>()

  for (const pick of picks) {
    const key = `${pick.homeScore}-${pick.awayScore}`
    const existing = byScore.get(key)

    if (existing) {
      existing.count += 1
      continue
    }

    byScore.set(key, {
      count: 1,
      homeScore: pick.homeScore,
      awayScore: pick.awayScore,
    })
  }

  return [...byScore.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    if (a.homeScore !== b.homeScore) return a.homeScore - b.homeScore
    return a.awayScore - b.awayScore
  })
}

export function buildLeaderboard(
  members: MemberLike[],
  predictions: ConfirmedPredictionLike[],
  tieBreakerOrder: LeaderboardTieBreakerCriterion[] = [
    'exact_hits',
    'winner_hits',
    'draw_hits',
    'first_prediction_at',
  ]
): LeaderboardEntry[] {
  const byUser = new Map<string, LeaderboardEntry>()

  for (const member of members) {
    if (!member.id) continue

    byUser.set(member.id, {
      userId: member.id,
      name: member.name ?? null,
      role: member.role,
      points: 0,
      drawHits: 0,
      exactHits: 0,
      firstExactHitAt: null,
      firstPredictionAt: null,
      firstScoringPickAt: null,
      goalDifferenceHits: 0,
      totalGoalError: 0,
      totalGoalsHits: 0,
      winnerHits: 0,
      playedPicks: 0,
      streak: 0,
    })
  }

  // Por usuario: lista de (fecha de inicio, si sumo puntos) de partidos jugados,
  // para calcular la racha de aciertos consecutivos mas recientes.
  const finishedPicksByUser = new Map<string, { startsAt: string | null; scored: boolean }[]>()

  for (const prediction of predictions) {
    const entry = byUser.get(prediction.user_id)
    if (!entry) continue

    // "Primero en pronosticar" se mide por la fecha de creacion del pronostico
    // (created_at, inmutable) y sobre todos los pronosticos confirmados, no solo
    // los de partidos jugados. confirmed_at no sirve aqui: se reescribe al editar.
    entry.firstPredictionAt = getEarlierTimestamp(entry.firstPredictionAt, prediction.created_at)

    const match = Array.isArray(prediction.match) ? prediction.match[0] : prediction.match
    if (!match || match.status !== 'finished') continue
    if (match.home_score === null || match.away_score === null) continue

    const points = calcPredictionPoints(prediction, match)
    entry.points += points
    entry.playedPicks = (entry.playedPicks ?? 0) + 1

    const userFinished = finishedPicksByUser.get(prediction.user_id) ?? []
    userFinished.push({ startsAt: match.starts_at ?? null, scored: points > 0 })
    finishedPicksByUser.set(prediction.user_id, userFinished)

    const isExact = isExactPrediction(prediction, match)

    if (isExact) {
      entry.exactHits += 1
      entry.firstExactHitAt = getEarlierTimestamp(entry.firstExactHitAt, prediction.confirmed_at)
    }

    // "Ganador" y "empate" solo cuentan aciertos SIN marcador exacto, para no
    // contar dos veces un pronostico que ya suma como exacto.
    if (!isExact && isWinnerPrediction(prediction, match)) {
      entry.winnerHits += 1
    }

    if (!isExact && isDrawPrediction(prediction, match)) {
      entry.drawHits += 1
    }

    if (isGoalDifferencePrediction(prediction, match)) {
      entry.goalDifferenceHits += 1
    }

    if (isTotalGoalsPrediction(prediction, match)) {
      entry.totalGoalsHits += 1
    }

    entry.totalGoalError += getPredictionGoalError(prediction, match)

    if (points > 0) {
      entry.firstScoringPickAt = getEarlierTimestamp(entry.firstScoringPickAt, prediction.confirmed_at)
    }
  }

  // Racha: aciertos consecutivos contando desde el partido jugado mas reciente
  // hacia atras (requiere starts_at para ordenar; sin el, la racha queda en 0).
  for (const [userId, picks] of finishedPicksByUser) {
    const entry = byUser.get(userId)
    if (!entry) continue

    const ordered = picks
      .filter((pick): pick is { startsAt: string; scored: boolean } => pick.startsAt !== null)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

    let streak = 0
    for (let i = ordered.length - 1; i >= 0; i--) {
      if (!ordered[i].scored) break
      streak += 1
    }
    entry.streak = streak
  }

  return sortLeaderboardEntries([...byUser.values()], tieBreakerOrder)
}

export function sortLeaderboardEntries(
  entries: LeaderboardEntry[],
  tieBreakerOrder: LeaderboardTieBreakerCriterion[] = [
    'exact_hits',
    'winner_hits',
    'draw_hits',
    'first_prediction_at',
  ]
): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points

    for (const criterion of tieBreakerOrder) {
      const result = compareLeaderboardEntries(a, b, criterion)
      if (result !== 0) return result
    }

    const byName = (a.name ?? '').localeCompare(b.name ?? '', 'es')
    if (byName !== 0) return byName
    return a.userId.localeCompare(b.userId, 'es')
  })
}

function compareLeaderboardEntries(
  a: LeaderboardEntry,
  b: LeaderboardEntry,
  criterion: LeaderboardTieBreakerCriterion
) {
  if (criterion === 'exact_hits') {
    return b.exactHits - a.exactHits
  }

  if (criterion === 'winner_hits') {
    return b.winnerHits - a.winnerHits
  }

  if (criterion === 'draw_hits') {
    return b.drawHits - a.drawHits
  }

  if (criterion === 'first_prediction_at') {
    return compareAscendingTimestamp(a.firstPredictionAt, b.firstPredictionAt)
  }

  if (criterion === 'goal_difference_hits') {
    return b.goalDifferenceHits - a.goalDifferenceHits
  }

  if (criterion === 'first_exact_hit_at') {
    return compareAscendingTimestamp(a.firstExactHitAt, b.firstExactHitAt)
  }

  if (criterion === 'first_scoring_pick_at') {
    return compareAscendingTimestamp(a.firstScoringPickAt, b.firstScoringPickAt)
  }

  if (criterion === 'total_goals_hits') {
    return b.totalGoalsHits - a.totalGoalsHits
  }

  return a.totalGoalError - b.totalGoalError
}

function compareAscendingTimestamp(
  a: string | null,
  b: string | null
) {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1

  const aTime = new Date(a).getTime()
  const bTime = new Date(b).getTime()

  if (aTime === bTime) return 0
  return aTime < bTime ? -1 : 1
}

function getEarlierTimestamp(
  current: string | null,
  candidate: string | null
) {
  if (!candidate) return current
  if (!current) return candidate

  return new Date(candidate).getTime() < new Date(current).getTime() ? candidate : current
}
