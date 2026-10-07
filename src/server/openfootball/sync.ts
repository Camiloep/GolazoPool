import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { MatchPhase, MatchStatus } from '@/lib/types'
import { fetchOpenFootballWorldCup } from './client'
import {
  buildMatchLabel,
  buildTeamIndex,
  getFinalScore,
  isSameInstant,
  parseOpenFootballKickoff,
  resolveGroupLetter,
  resolveMatchNumber,
  resolvePhase,
  resolveTeam,
} from './mapper'

type DatabaseMatch = {
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
}

type DatabaseTeam = {
  id: string
  name: string
  code: string
  group_letter: string | null
}

type MatchUpdate = {
  id: string
  matchNumber: number
  values: Partial<DatabaseMatch>
}

export interface OpenFootballSyncSummary {
  sourceName: string
  totalSourceMatches: number
  totalLocalMatches: number
  updatedMatches: number
  scheduledMatches: number
  inProgressMatches: number
  finishedMatches: number
  warnings: string[]
}

interface OpenFootballSyncOptions {
  dryRun?: boolean
  now?: Date
}

function resolveNextStatus({
  startsAt,
  hasFinalScore,
  existingMatch,
  now,
}: {
  startsAt: string
  hasFinalScore: boolean
  existingMatch: DatabaseMatch
  now: Date
}): MatchStatus {
  if (hasFinalScore) return 'finished'

  if (
    existingMatch.status === 'finished' &&
    existingMatch.home_score !== null &&
    existingMatch.away_score !== null
  ) {
    return 'finished'
  }

  return now.getTime() >= new Date(startsAt).getTime() ? 'in_progress' : 'scheduled'
}

function buildUpdate({
  existingMatch,
  phase,
  groupLetter,
  startsAt,
  venue,
  homeTeamId,
  awayTeamId,
  label,
  status,
  finalScore,
}: {
  existingMatch: DatabaseMatch
  phase: MatchPhase
  groupLetter: string | null
  startsAt: string
  venue: string | null
  homeTeamId: string | null
  awayTeamId: string | null
  label: string | null
  status: MatchStatus
  finalScore: { homeScore: number; awayScore: number } | null
}) {
  const values: Partial<DatabaseMatch> = {}

  if (existingMatch.phase !== phase) values.phase = phase
  if (existingMatch.group_letter !== groupLetter) values.group_letter = groupLetter
  if (!isSameInstant(existingMatch.starts_at, startsAt)) values.starts_at = startsAt
  if ((existingMatch.venue ?? null) !== venue) values.venue = venue
  if (homeTeamId && existingMatch.home_team_id !== homeTeamId) values.home_team_id = homeTeamId
  if (awayTeamId && existingMatch.away_team_id !== awayTeamId) values.away_team_id = awayTeamId
  if ((existingMatch.label ?? null) !== label) values.label = label
  if (existingMatch.status !== status) values.status = status

  if (finalScore) {
    if (existingMatch.home_score !== finalScore.homeScore) {
      values.home_score = finalScore.homeScore
    }
    if (existingMatch.away_score !== finalScore.awayScore) {
      values.away_score = finalScore.awayScore
    }
  }

  return values
}

export async function syncWorldCupFromOpenFootball(
  options: OpenFootballSyncOptions = {}
): Promise<OpenFootballSyncSummary> {
  const { dryRun = false, now = new Date() } = options
  const admin = createAdminClient()
  const [source, matchesResponse, teamsResponse] = await Promise.all([
    fetchOpenFootballWorldCup(),
    admin
      .from('matches')
      .select(
        'id, match_number, phase, group_letter, home_team_id, away_team_id, starts_at, venue, label, home_score, away_score, status'
      )
      .order('match_number'),
    admin.from('teams').select('id, name, code, group_letter').order('name'),
  ])

  if (matchesResponse.error) {
    throw new Error('Could not load matches from Supabase for OpenFootball sync.')
  }

  if (teamsResponse.error) {
    throw new Error('Could not load teams from Supabase for OpenFootball sync.')
  }

  const matches = (matchesResponse.data ?? []) as DatabaseMatch[]
  const teams = (teamsResponse.data ?? []) as DatabaseTeam[]
  const matchesByNumber = new Map(matches.map(match => [match.match_number, match]))
  const teamIndex = buildTeamIndex(teams)
  const pendingUpdates: MatchUpdate[] = []
  const warnings: string[] = []
  let scheduledMatches = 0
  let inProgressMatches = 0
  let finishedMatches = 0

  for (const [index, sourceMatch] of source.matches.entries()) {
    const matchNumber = resolveMatchNumber(sourceMatch, index)
    const existingMatch = matchesByNumber.get(matchNumber)

    if (!existingMatch) {
      warnings.push(`No existe el partido local ${matchNumber}.`)
      continue
    }

    const phase = resolvePhase(sourceMatch)
    const groupLetter = resolveGroupLetter(sourceMatch.group)
    const startsAt = parseOpenFootballKickoff(sourceMatch.date, sourceMatch.time)
    const finalScore = getFinalScore(sourceMatch)
    const homeTeam = resolveTeam(sourceMatch.team1, teamIndex)
    const awayTeam = resolveTeam(sourceMatch.team2, teamIndex)

    if (!homeTeam && phase === 'group') {
      warnings.push(`No se pudo mapear el local del partido ${matchNumber}: ${sourceMatch.team1}.`)
    }
    if (!awayTeam && phase === 'group') {
      warnings.push(`No se pudo mapear la visita del partido ${matchNumber}: ${sourceMatch.team2}.`)
    }

    const status = resolveNextStatus({
      startsAt,
      hasFinalScore: Boolean(finalScore),
      existingMatch,
      now,
    })

    if (status === 'finished') finishedMatches += 1
    if (status === 'in_progress') inProgressMatches += 1
    if (status === 'scheduled') scheduledMatches += 1

    const label = buildMatchLabel(
      sourceMatch,
      existingMatch.label,
      homeTeam?.id ?? existingMatch.home_team_id,
      awayTeam?.id ?? existingMatch.away_team_id
    )

    const values = buildUpdate({
      existingMatch,
      phase,
      groupLetter,
      startsAt,
      venue: sourceMatch.ground?.trim() || null,
      homeTeamId: homeTeam?.id ?? existingMatch.home_team_id,
      awayTeamId: awayTeam?.id ?? existingMatch.away_team_id,
      label,
      status,
      finalScore,
    })

    if (Object.keys(values).length > 0) {
      pendingUpdates.push({
        id: existingMatch.id,
        matchNumber,
        values,
      })
    }
  }

  if (!dryRun) {
    for (const update of pendingUpdates) {
      const { error } = await admin.from('matches').update(update.values).eq('id', update.id)

      if (error) {
        throw new Error(`Could not update match ${update.matchNumber} from OpenFootball.`)
      }
    }
  }

  if (matches.length !== source.matches.length) {
    warnings.push(
      `La base local tiene ${matches.length} partidos y OpenFootball ${source.matches.length}.`
    )
  }

  return {
    sourceName: source.name,
    totalSourceMatches: source.matches.length,
    totalLocalMatches: matches.length,
    updatedMatches: pendingUpdates.length,
    scheduledMatches,
    inProgressMatches,
    finishedMatches,
    warnings: warnings.slice(0, 8),
  }
}
