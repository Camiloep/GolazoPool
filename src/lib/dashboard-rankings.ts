import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_TIE_BREAKER_ORDER, normalizeTieBreakerOrder } from '@/lib/league-settings'
import {
  buildLeaderboard,
  sortLeaderboardEntries,
  type LeaderboardEntry,
} from '@/lib/predictions'
import type { LeaderboardTieBreakerCriterion, LeagueMemberRole } from '@/lib/types'

export interface LeagueRanking {
  id: string
  name: string
  top3: LeaderboardEntry[]
  hasPoints: boolean
}

export interface LeagueRef {
  id: string
  name: string
}

interface LeaderboardRpcRow {
  league_id: string
  league_name: string
  tie_breaker_order: LeaderboardTieBreakerCriterion[] | null
  user_id: string
  name: string | null
  role: LeagueMemberRole
  points: number
  exact_hits: number
  winner_hits: number
  draw_hits: number
  goal_difference_hits: number
  total_goals_hits: number
  total_goal_error: number
  first_prediction_at: string | null
  first_exact_hit_at: string | null
  first_scoring_pick_at: string | null
}

/**
 * Per-league top-3 user rankings for the leagues the user belongs to.
 *
 * Fast path: the `get_user_league_leaderboards` Postgres RPC aggregates points
 * in the database and returns one row per (league, member). If that function is
 * not deployed yet, it transparently falls back to aggregating in JS so the
 * dashboard keeps working. Once the SQL in database/league_leaderboards.sql is
 * applied, the fallback (`rankingsFromTables`) can be removed.
 */
export async function getLeagueRankings(
  supabase: SupabaseClient,
  leagues: LeagueRef[]
): Promise<LeagueRanking[]> {
  if (leagues.length === 0) return []

  const { data, error } = await supabase.rpc('get_user_league_leaderboards')
  if (!error && Array.isArray(data)) {
    return rankingsFromRpcRows(data as LeaderboardRpcRow[], leagues)
  }

  return rankingsFromTables(supabase, leagues)
}

function rankingsFromRpcRows(rows: LeaderboardRpcRow[], leagues: LeagueRef[]): LeagueRanking[] {
  const byLeague = new Map<
    string,
    { entries: LeaderboardEntry[]; tieBreaker: LeaderboardTieBreakerCriterion[] }
  >()

  for (const row of rows) {
    const group =
      byLeague.get(row.league_id) ??
      { entries: [], tieBreaker: normalizeTieBreakerOrder(row.tie_breaker_order) }
    group.entries.push({
      userId: row.user_id,
      name: row.name,
      role: row.role,
      points: row.points,
      drawHits: row.draw_hits,
      exactHits: row.exact_hits,
      firstExactHitAt: row.first_exact_hit_at,
      firstPredictionAt: row.first_prediction_at,
      firstScoringPickAt: row.first_scoring_pick_at,
      goalDifferenceHits: row.goal_difference_hits,
      totalGoalError: row.total_goal_error,
      totalGoalsHits: row.total_goals_hits,
      winnerHits: row.winner_hits,
    })
    byLeague.set(row.league_id, group)
  }

  return leagues.map(league => {
    const group = byLeague.get(league.id)
    const sorted = group ? sortLeaderboardEntries(group.entries, group.tieBreaker) : []
    return {
      id: league.id,
      name: league.name,
      top3: sorted.slice(0, 3),
      hasPoints: sorted.some(entry => entry.points > 0),
    }
  })
}

async function rankingsFromTables(
  supabase: SupabaseClient,
  leagues: LeagueRef[]
): Promise<LeagueRanking[]> {
  const leagueIds = leagues.map(league => league.id)

  const [leagueMembersRes, leaguePredictionsRes, leagueSettingsRes] = await Promise.all([
    supabase
      .from('league_members')
      .select('league_id, role, profile:profiles(id, name)')
      .in('league_id', leagueIds),
    supabase
      .from('predictions')
      .select('league_id, user_id, home_score, away_score, confirmed_at, created_at, match:matches(home_score, away_score, status)')
      .eq('confirmed', true)
      .in('league_id', leagueIds),
    supabase
      .from('league_settings')
      .select('league_id, tie_breaker_order')
      .in('league_id', leagueIds),
  ])

  const membersByLeague = new Map<
    string,
    { id: string | null; name: string | null; role: LeagueMemberRole }[]
  >()
  for (const member of leagueMembersRes.data ?? []) {
    const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile
    const list = membersByLeague.get(member.league_id) ?? []
    list.push({ id: profile?.id ?? null, name: profile?.name ?? null, role: member.role })
    membersByLeague.set(member.league_id, list)
  }

  const predictionsByLeague = new Map<string, NonNullable<typeof leaguePredictionsRes.data>>()
  for (const prediction of leaguePredictionsRes.data ?? []) {
    const list = predictionsByLeague.get(prediction.league_id) ?? []
    list.push(prediction)
    predictionsByLeague.set(prediction.league_id, list)
  }

  const tieBreakerByLeague = new Map<string, LeaderboardTieBreakerCriterion[]>()
  for (const setting of leagueSettingsRes.data ?? []) {
    tieBreakerByLeague.set(setting.league_id, normalizeTieBreakerOrder(setting.tie_breaker_order))
  }

  return leagues.map(league => {
    const leaderboard = buildLeaderboard(
      membersByLeague.get(league.id) ?? [],
      predictionsByLeague.get(league.id) ?? [],
      tieBreakerByLeague.get(league.id) ?? DEFAULT_TIE_BREAKER_ORDER
    )
    return {
      id: league.id,
      name: league.name,
      top3: leaderboard.slice(0, 3),
      hasPoints: leaderboard.some(entry => entry.points > 0),
    }
  })
}
