export type MatchPhase = 'group' | 'r32' | 'r16' | 'quarterfinal' | 'semifinal' | 'third_place' | 'final'
export type MatchStatus = 'scheduled' | 'in_progress' | 'finished'

// Row from match_live_states: live snapshot synced from Flashscore every minute
export interface MatchLiveState {
  match_id: string
  phase: string
  stage_code: number | null
  minute: number | null
  stage_started_at: string | null
  is_stopped: boolean
  // Marcador mostrado por Flashscore (DE/DF): en vivo el actual; al finalizar es
  // el final CON prórroga/penales. Sirve para mostrar el resultado tras prórroga
  // junto al de los 90' (que es matches.home_score/away_score).
  home_score: number | null
  away_score: number | null
  // Marcador de la tanda de penales (null salvo durante/después de la tanda).
  pen_home_score: number | null
  pen_away_score: number | null
  // Marcador del tiempo reglamentario / 90' (DG/DH), SIN prórroga ni penales. En
  // eliminatorias es el que PUNTÚA: una vez el partido pasa a prórroga/penales,
  // home_score/away_score (y matches.home/away_score) ya traen goles de tiempo
  // extra, asi que la puntuacion provisional se calcula sobre este. Null si el
  // feed no lo provee todavia.
  reg_home_score: number | null
  reg_away_score: number | null
}

export type LeagueMemberRole = 'admin' | 'member'
export type PredictionLockMode = 'per_match' | 'tournament_start' | 'phase_start'
export type MemberPredictionVisibility = 'never' | 'after_lock' | 'always'
export type MemberPredictionViewMode = 'detail' | 'aggregate' | 'participants'
export type LeaderboardTieBreakerCriterion =
  | 'exact_hits'
  | 'winner_hits'
  | 'draw_hits'
  | 'first_prediction_at'
  | 'goal_difference_hits'
  | 'first_exact_hit_at'
  | 'first_scoring_pick_at'
  | 'total_goals_hits'
  | 'total_goal_error'

export interface Profile {
  id: string
  name: string
  updated_at: string
}

export interface League {
  id: string
  name: string
  description: string | null
  invite_code: string
  created_by: string | null
  created_at: string
}

export interface LeagueMember {
  id: string
  league_id: string
  user_id: string
  role: LeagueMemberRole
  joined_at: string
  profile?: Profile
}

export interface LeagueSettings {
  league_id: string
  rules: string | null
  prizes: string | null
  allow_prediction_edits: boolean
  member_prediction_visibility: MemberPredictionVisibility
  member_prediction_view_mode: MemberPredictionViewMode
  require_match_prediction_for_pick_visibility: boolean
  tie_breaker_order: LeaderboardTieBreakerCriterion[]
  prediction_lock_minutes: number
  prediction_lock_mode: PredictionLockMode
  updated_at: string | null
  updated_by: string | null
}

export interface AppSettings {
  singleton: true
  allow_result_edits: boolean
  updated_at: string | null
  updated_by: string | null
}

export interface Team {
  id: string
  name: string
  code: string
  group_letter: string
  flag_emoji: string
  eliminated: boolean
}

export interface TournamentPhase {
  phase: MatchPhase
  is_enabled: boolean
  enabled_at: string | null
}

export interface Match {
  id: string
  match_number: number
  phase: MatchPhase
  group_letter: string | null
  home_team_id: string | null
  away_team_id: string | null
  starts_at: string
  venue: string | null
  label: string | null
  home_score: number | null
  away_score: number | null
  status: MatchStatus
  home_team?: Team
  away_team?: Team
}

export interface Prediction {
  id: string
  user_id: string
  league_id: string
  match_id: string
  home_score: number
  away_score: number
  confirmed: boolean
  confirmed_at: string | null
  created_at: string
}

export const PHASE_LABELS: Record<MatchPhase, string> = {
  group: 'Fase de Grupos',
  r32: 'Ronda de 32',
  r16: 'Octavos de Final',
  quarterfinal: 'Cuartos de Final',
  semifinal: 'Semifinales',
  third_place: '3er Puesto',
  final: 'Final',
}
