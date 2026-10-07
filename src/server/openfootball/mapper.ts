import 'server-only'

import type { MatchPhase } from '@/lib/types'
import type { OpenFootballMatch } from './client'

type TeamRow = {
  id: string
  name: string
  code: string
  group_letter: string | null
}

type TeamIndex = {
  byCode: Map<string, TeamRow>
  byName: Map<string, TeamRow>
}

const OPENFOOTBALL_TEAM_CODE_MAP: Record<string, string> = {
  algeria: 'ALG',
  argentina: 'ARG',
  australia: 'AUS',
  austria: 'AUT',
  belgium: 'BEL',
  bosniaandherzegovina: 'BIH',
  brazil: 'BRA',
  canada: 'CAN',
  capeverde: 'CPV',
  colombia: 'COL',
  croatia: 'CRO',
  curacao: 'CUW',
  czechrepublic: 'CZE',
  drcongo: 'COD',
  ecuador: 'ECU',
  egypt: 'EGY',
  england: 'ENG',
  france: 'FRA',
  germany: 'GER',
  ghana: 'GHA',
  haiti: 'HAI',
  iran: 'IRN',
  iraq: 'IRQ',
  ivorycoast: 'CIV',
  japan: 'JPN',
  jordan: 'JOR',
  mexico: 'MEX',
  morocco: 'MAR',
  netherlands: 'NED',
  newzealand: 'NZL',
  norway: 'NOR',
  panama: 'PAN',
  paraguay: 'PAR',
  portugal: 'POR',
  qatar: 'QAT',
  saudiarabia: 'KSA',
  scotland: 'SCO',
  senegal: 'SEN',
  southafrica: 'RSA',
  southkorea: 'KOR',
  spain: 'ESP',
  sweden: 'SWE',
  switzerland: 'SUI',
  tunisia: 'TUN',
  turkey: 'TUR',
  unitedstates: 'USA',
  unitedstatesofamerica: 'USA',
  uruguay: 'URU',
  usa: 'USA',
  uzbekistan: 'UZB',
}

const REFERENCE_TEAM_PATTERN =
  /^(?:[12][A-L]|3[A-L](?:\/[A-L])+|[WL]\d{2,3})$/i

const PHASE_BY_ROUND: Record<string, MatchPhase> = {
  Final: 'final',
  'Match for third place': 'third_place',
  'Quarter-final': 'quarterfinal',
  'Round of 16': 'r16',
  'Round of 32': 'r32',
  'Semi-final': 'semifinal',
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
}

function formatUtcOffset(rawOffset: string) {
  const offsetHours = Number.parseInt(rawOffset, 10)

  if (!Number.isFinite(offsetHours)) {
    throw new Error(`Invalid UTC offset "${rawOffset}" from OpenFootball.`)
  }

  const sign = offsetHours >= 0 ? '+' : '-'
  const hours = String(Math.abs(offsetHours)).padStart(2, '0')

  return `${sign}${hours}:00`
}

export function buildTeamIndex(teams: TeamRow[]): TeamIndex {
  return teams.reduce<TeamIndex>(
    (index, team) => {
      index.byCode.set(team.code.toUpperCase(), team)
      index.byName.set(normalizeText(team.name), team)
      return index
    },
    {
      byCode: new Map<string, TeamRow>(),
      byName: new Map<string, TeamRow>(),
    }
  )
}

export function resolveMatchNumber(match: OpenFootballMatch, index: number) {
  return Number.isInteger(match.num) ? Number(match.num) : index + 1
}

export function parseOpenFootballKickoff(date: string, time?: string) {
  if (!time) {
    return new Date(`${date}T00:00:00Z`).toISOString()
  }

  const trimmed = time.trim()
  const match = /^(\d{2}):(\d{2})(?:\s+UTC([+-]\d{1,2}))?$/.exec(trimmed)

  if (!match) {
    throw new Error(`Invalid kickoff time "${time}" from OpenFootball.`)
  }

  const [, hour, minute, rawOffset] = match
  const offset = rawOffset ? formatUtcOffset(rawOffset) : 'Z'

  return new Date(`${date}T${hour}:${minute}:00${offset}`).toISOString()
}

export function resolvePhase(match: OpenFootballMatch): MatchPhase {
  if (match.group?.startsWith('Group ')) {
    return 'group'
  }

  const phase = PHASE_BY_ROUND[match.round]

  if (!phase) {
    throw new Error(`Unsupported round "${match.round}" from OpenFootball.`)
  }

  return phase
}

export function resolveGroupLetter(group?: string) {
  if (!group?.startsWith('Group ')) return null

  const letter = group.replace('Group ', '').trim().toUpperCase()

  return letter || null
}

export function resolveTeam(teamName: string, teamIndex: TeamIndex) {
  if (!teamName || REFERENCE_TEAM_PATTERN.test(teamName)) return null

  const normalizedTeamName = normalizeText(teamName)
  const byCode = OPENFOOTBALL_TEAM_CODE_MAP[normalizedTeamName]

  if (byCode) {
    const team = teamIndex.byCode.get(byCode)
    if (team) return team
  }

  return teamIndex.byName.get(normalizedTeamName) ?? null
}

function translateReferenceTeam(teamName: string) {
  const winnerMatch = /^W(\d{2,3})$/i.exec(teamName)
  if (winnerMatch) return `Ganador M${winnerMatch[1]}`

  const loserMatch = /^L(\d{2,3})$/i.exec(teamName)
  if (loserMatch) return `Perdedor M${loserMatch[1]}`

  return teamName
}

export function buildMatchLabel(
  match: OpenFootballMatch,
  _existingLabel: string | null,
  homeTeamId: string | null,
  awayTeamId: string | null
) {
  if (homeTeamId && awayTeamId) return null

  return `${translateReferenceTeam(match.team1)} vs ${translateReferenceTeam(match.team2)}`
}

export function getFinalScore(match: OpenFootballMatch) {
  const score = match.score?.ft

  if (!Array.isArray(score) || score.length < 2) return null

  const [homeScore, awayScore] = score

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    return null
  }

  return {
    homeScore,
    awayScore,
  }
}

export function isSameInstant(left: string, right: string) {
  return new Date(left).getTime() === new Date(right).getTime()
}
