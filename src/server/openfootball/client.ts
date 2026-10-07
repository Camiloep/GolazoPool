import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

export interface OpenFootballScore {
  ft?: [number, number] | number[] | null
  ht?: [number, number] | number[] | null
}

export interface OpenFootballMatch {
  round: string
  date: string
  time?: string
  team1: string
  team2: string
  group?: string
  ground?: string
  num?: number
  score?: OpenFootballScore | null
}

export interface OpenFootballTournament {
  name: string
  matches: OpenFootballMatch[]
}

const DEFAULT_OPENFOOTBALL_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

const FETCH_TIMEOUT_MS = 15_000

function isOpenFootballMatch(value: unknown): value is OpenFootballMatch {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.round === 'string' &&
    typeof candidate.date === 'string' &&
    typeof candidate.team1 === 'string' &&
    typeof candidate.team2 === 'string'
  )
}

export async function fetchOpenFootballWorldCup(): Promise<OpenFootballTournament> {
  const source = process.env.OPENFOOTBALL_WORLDCUP_JSON_URL?.trim() || DEFAULT_OPENFOOTBALL_URL
  const isHttpSource = /^https?:\/\//i.test(source)
  const payload = isHttpSource
    ? await fetchRemotePayload(source)
    : await readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), source), 'utf8')

  const data = JSON.parse(payload) as Partial<OpenFootballTournament>

  if (!Array.isArray(data.matches) || !data.matches.every(isOpenFootballMatch)) {
    throw new Error('OpenFootball returned an unexpected payload shape.')
  }

  return {
    name: typeof data.name === 'string' ? data.name : 'World Cup 2026',
    matches: data.matches,
  }
}

async function fetchRemotePayload(url: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`OpenFootball sync failed with HTTP ${response.status}.`)
    }

    return await response.text()
  } finally {
    clearTimeout(timeoutId)
  }
}
