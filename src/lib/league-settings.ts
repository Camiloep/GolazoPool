import type { PostgrestError } from '@supabase/supabase-js'
import type {
  LeaderboardTieBreakerCriterion,
  LeagueSettings,
  MemberPredictionViewMode,
  MemberPredictionVisibility,
  PredictionLockMode,
} from '@/lib/types'

export const DEFAULT_PREDICTION_LOCK_MINUTES = 0
export const DEFAULT_PREDICTION_LOCK_MODE: PredictionLockMode = 'per_match'
export const DEFAULT_ALLOW_PREDICTION_EDITS = false
export const DEFAULT_MEMBER_PREDICTION_VISIBILITY: MemberPredictionVisibility = 'after_lock'
export const DEFAULT_MEMBER_PREDICTION_VIEW_MODE: MemberPredictionViewMode = 'detail'
export const DEFAULT_REQUIRE_MATCH_PREDICTION_FOR_PICK_VISIBILITY = false
export const CORE_TIE_BREAKER_ORDER: LeaderboardTieBreakerCriterion[] = [
  'exact_hits',
  'winner_hits',
  'draw_hits',
  'first_prediction_at',
]
export const OPTIONAL_TIE_BREAKER_CRITERIA: LeaderboardTieBreakerCriterion[] = [
  'goal_difference_hits',
  'first_exact_hit_at',
  'first_scoring_pick_at',
  'total_goals_hits',
  'total_goal_error',
]
export const DEFAULT_TIE_BREAKER_ORDER: LeaderboardTieBreakerCriterion[] = [...CORE_TIE_BREAKER_ORDER]
export const MAX_PREDICTION_LOCK_MINUTES = 1_440
export const TIE_BREAKER_OPTIONS: Array<{
  description: string
  label: string
  value: LeaderboardTieBreakerCriterion
}> = [
  {
    description: 'Premia a quien acerto mas veces el marcador final completo.',
    label: 'Marcadores exactos',
    value: 'exact_hits',
  },
  {
    description: 'Cuenta los partidos sin empate en los que acertaste el ganador pero no el marcador exacto.',
    label: 'Aciertos al ganador',
    value: 'winner_hits',
  },
  {
    description: 'Cuenta los partidos que terminaron empatados en los que pronosticaste empate pero no el marcador exacto.',
    label: 'Aciertos a empates',
    value: 'draw_hits',
  },
  {
    description: 'Premia a quien confirmo antes sus pronosticos a lo largo del torneo.',
    label: 'Primero en realizar la prediccion',
    value: 'first_prediction_at',
  },
  {
    description: 'Cuenta los partidos en los que acertaste la diferencia de gol real.',
    label: 'Diferencia de gol acertada',
    value: 'goal_difference_hits',
  },
  {
    description: 'Desempata a favor de quien logro antes uno de sus marcadores exactos.',
    label: 'Exacto conseguido antes',
    value: 'first_exact_hit_at',
  },
  {
    description: 'Desempata a favor de quien sumo puntos por primera vez mas temprano.',
    label: 'Primer pronostico con puntos',
    value: 'first_scoring_pick_at',
  },
  {
    description: 'Cuenta los partidos en los que acertaste cuantos goles hubo en total.',
    label: 'Total de goles acertado',
    value: 'total_goals_hits',
  },
  {
    description: 'Gana quien termino mas cerca de los marcadores reales en el acumulado.',
    label: 'Menor margen total de error',
    value: 'total_goal_error',
  },
]

const LEGACY_TIE_BREAKER_VALUE_MAP: Record<string, LeaderboardTieBreakerCriterion> = {
  first_exact_hit_at: 'first_exact_hit_at',
  first_prediction_at: 'first_prediction_at',
  first_scoring_pick_at: 'first_scoring_pick_at',
}

const VALID_TIE_BREAKER_CRITERIA = new Set<LeaderboardTieBreakerCriterion>([
  ...CORE_TIE_BREAKER_ORDER,
  ...OPTIONAL_TIE_BREAKER_CRITERIA,
])

export function getDefaultLeagueSettings(leagueId: string): LeagueSettings {
  return {
    league_id: leagueId,
    rules: null,
    prizes: null,
    allow_prediction_edits: DEFAULT_ALLOW_PREDICTION_EDITS,
    member_prediction_visibility: DEFAULT_MEMBER_PREDICTION_VISIBILITY,
    member_prediction_view_mode: DEFAULT_MEMBER_PREDICTION_VIEW_MODE,
    require_match_prediction_for_pick_visibility:
      DEFAULT_REQUIRE_MATCH_PREDICTION_FOR_PICK_VISIBILITY,
    tie_breaker_order: [...DEFAULT_TIE_BREAKER_ORDER],
    prediction_lock_minutes: DEFAULT_PREDICTION_LOCK_MINUTES,
    prediction_lock_mode: DEFAULT_PREDICTION_LOCK_MODE,
    updated_at: null,
    updated_by: null,
  }
}

export function normalizeLeagueSettings(
  leagueId: string,
  settings: Partial<LeagueSettings> | null | undefined
): LeagueSettings {
  return {
    ...getDefaultLeagueSettings(leagueId),
    ...settings,
    league_id: leagueId,
    allow_prediction_edits:
      typeof settings?.allow_prediction_edits === 'boolean'
        ? settings.allow_prediction_edits
        : DEFAULT_ALLOW_PREDICTION_EDITS,
    member_prediction_visibility:
      settings?.member_prediction_visibility === 'always'
        ? 'always'
        : settings?.member_prediction_visibility === 'after_lock'
          ? 'after_lock'
          : settings?.member_prediction_visibility === 'never'
            ? 'never'
            : DEFAULT_MEMBER_PREDICTION_VISIBILITY,
    member_prediction_view_mode:
      settings?.member_prediction_view_mode === 'aggregate'
        ? 'aggregate'
        : settings?.member_prediction_view_mode === 'participants'
          ? 'participants'
        : DEFAULT_MEMBER_PREDICTION_VIEW_MODE,
    require_match_prediction_for_pick_visibility:
      typeof settings?.require_match_prediction_for_pick_visibility === 'boolean'
        ? settings.require_match_prediction_for_pick_visibility
        : DEFAULT_REQUIRE_MATCH_PREDICTION_FOR_PICK_VISIBILITY,
    tie_breaker_order: normalizeTieBreakerOrder(settings?.tie_breaker_order),
    prediction_lock_minutes:
      typeof settings?.prediction_lock_minutes === 'number' && settings.prediction_lock_minutes >= 0
        ? settings.prediction_lock_minutes
        : DEFAULT_PREDICTION_LOCK_MINUTES,
    prediction_lock_mode:
      settings?.prediction_lock_mode === 'tournament_start'
        ? 'tournament_start'
        : settings?.prediction_lock_mode === 'phase_start'
          ? 'phase_start'
          : DEFAULT_PREDICTION_LOCK_MODE,
  }
}

export function isMissingLeagueSettingsTable(error: PostgrestError | null | undefined) {
  return error?.code === 'PGRST205'
}

export function formatPredictionLockWindow(
  lockMinutes: number,
  lockMode: PredictionLockMode = DEFAULT_PREDICTION_LOCK_MODE
) {
  const target =
    lockMode === 'tournament_start'
      ? 'del primer partido del mundial'
      : lockMode === 'phase_start'
        ? 'del primer partido de cada fase'
        : 'del inicio de cada partido'

  if (lockMinutes <= 0) {
    return lockMode === 'tournament_start'
      ? 'al inicio del primer partido del mundial'
      : lockMode === 'phase_start'
        ? 'al inicio de cada fase'
        : 'al inicio de cada partido'
  }
  if (lockMinutes === 1) return `1 minuto antes ${target}`
  if (lockMinutes < 60) return `${lockMinutes} minutos antes ${target}`

  const hours = Math.floor(lockMinutes / 60)
  const minutes = lockMinutes % 60

  if (minutes === 0) {
    return hours === 1 ? `1 hora antes ${target}` : `${hours} horas antes ${target}`
  }

  return `${hours}h ${minutes}m antes ${target}`
}

export function getPredictionEditRuleText(allowPredictionEdits: boolean) {
  return allowPredictionEdits
    ? 'Los jugadores pueden editar un pronostico ya confirmado mientras siga abierta la ventana.'
    : 'Los pronosticos confirmados ya no se pueden editar.'
}

export function normalizeTieBreakerOrder(
  value: unknown
): LeaderboardTieBreakerCriterion[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TIE_BREAKER_ORDER
  }

  const uniqueCriteria = value.filter(
    (item): item is string => typeof item === 'string'
  ).map((item) => LEGACY_TIE_BREAKER_VALUE_MAP[item] ?? item).filter(
    (item): item is LeaderboardTieBreakerCriterion => VALID_TIE_BREAKER_CRITERIA.has(item as LeaderboardTieBreakerCriterion)
  )

  const deduped = uniqueCriteria.filter((criterion, index) => uniqueCriteria.indexOf(criterion) === index)
  const requiredCriteria = deduped.filter((criterion) => CORE_TIE_BREAKER_ORDER.includes(criterion))
  const missingRequired = CORE_TIE_BREAKER_ORDER.filter((criterion) => !requiredCriteria.includes(criterion))
  const optionalCriteria = deduped.filter((criterion) => OPTIONAL_TIE_BREAKER_CRITERIA.includes(criterion))
  const normalized = [...requiredCriteria, ...missingRequired, ...optionalCriteria]

  if (normalized.length < CORE_TIE_BREAKER_ORDER.length) {
    return DEFAULT_TIE_BREAKER_ORDER
  }

  if (normalized.length > VALID_TIE_BREAKER_CRITERIA.size) {
    return DEFAULT_TIE_BREAKER_ORDER
  }

  return normalized
}

export function getTieBreakerRuleText(
  tieBreakerOrder: LeaderboardTieBreakerCriterion[]
) {
  const labels = tieBreakerOrder.map((criterion) => {
    return TIE_BREAKER_OPTIONS.find((option) => option.value === criterion)?.label ?? criterion
  })

  return `En empate por puntos se usa: ${labels.join(' > ')}.`
}

export function getMemberPredictionVisibilityRuleText({
  memberPredictionViewMode,
  memberPredictionVisibility,
  predictionLockMinutes,
  predictionLockMode,
  requireMatchPredictionForPickVisibility,
}: {
  memberPredictionViewMode: MemberPredictionViewMode
  memberPredictionVisibility: MemberPredictionVisibility
  predictionLockMinutes?: number
  predictionLockMode?: PredictionLockMode
  requireMatchPredictionForPickVisibility: boolean
}) {
  if (memberPredictionVisibility === 'never') {
    return 'Ningun participante puede ver los picks de otros jugadores.'
  }

  const visibilityText =
    memberPredictionVisibility === 'always'
      ? 'siempre'
      : 'solo cuando ya cerro la ventana de pronosticos'
  const viewModeText =
    memberPredictionViewMode === 'aggregate'
      ? 'como distribucion agregada sin nombres'
      : memberPredictionViewMode === 'participants'
        ? 'mostrando solo quienes ya enviaron su pronostico, sin revelar el marcador'
      : 'con detalle completo'
  const lockWindowText =
    memberPredictionVisibility === 'after_lock' && typeof predictionLockMinutes === 'number'
      ? ` (${formatPredictionLockWindow(predictionLockMinutes, predictionLockMode)})`
      : ''
  const ownPredictionText = requireMatchPredictionForPickVisibility
    ? ' y solo si ya enviaron su pronostico de ese partido'
    : ''
  const preLockText =
    memberPredictionVisibility === 'after_lock'
      ? ' Mientras un partido siga abierto solo se muestra quienes ya enviaron su pick, sin revelar el marcador.'
      : ''

  return `Los participantes pueden ver los picks de la liga ${visibilityText}${lockWindowText}, ${viewModeText}${ownPredictionText}.${preLockText}`
}
