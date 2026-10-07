import 'server-only'

// Raw match shape returned by the SportDB/Flashscore API. Only the fields we
// actually consume are typed; the payload has many more (TV, odds, geoip...).
export interface FlashscoreMatch {
  eventId?: string
  eventStage?: string
  homeName?: string
  awayName?: string
  homeParticipantNameUrl?: string
  awayParticipantNameUrl?: string
  home3CharName?: string
  away3CharName?: string
  homeScore?: string
  awayScore?: string
  homeFullTimeScore?: string
  awayFullTimeScore?: string
  startDateTimeUtc?: string
  round?: string
  tournamentName?: string
  tournamentStage?: {
    groupName?: string
  } | null
}

const DEFAULT_BASE_URL =
  'https://api.sportdb.dev/api/flashscore/football/world:8/world-cup:lvUBR5F8/2026'

const FETCH_TIMEOUT_MS = 15_000
// The final tournament is 104 matches; with ~50-70 per page, a handful of pages
// covers it. Cap pages so a misbehaving API can never loop forever.
const MAX_PAGES = 12

function getConfig() {
  const apiKey = process.env.SPORTDB_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Missing SPORTDB_API_KEY for the Flashscore results sync.')
  }

  const baseUrl = (process.env.SPORTDB_WORLDCUP_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(
    /\/+$/,
    ''
  )

  return { apiKey, baseUrl }
}

async function fetchPage(url: string, apiKey: string): Promise<FlashscoreMatch[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'X-API-Key': apiKey },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Flashscore results sync failed with HTTP ${response.status}.`)
    }

    const data = (await response.json()) as unknown
    return Array.isArray(data) ? (data as FlashscoreMatch[]) : []
  } finally {
    clearTimeout(timeoutId)
  }
}

// Pulls every page of finished results for the configured season, stopping at
// the first empty page or the safety cap.
export async function fetchFlashscoreResults(): Promise<FlashscoreMatch[]> {
  const { apiKey, baseUrl } = getConfig()
  const all: FlashscoreMatch[] = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const pageMatches = await fetchPage(`${baseUrl}/results?page=${page}`, apiKey)
    if (pageMatches.length === 0) break
    all.push(...pageMatches)
  }

  return all
}
