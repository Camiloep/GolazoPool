import 'server-only'

// Flashscore data access without a headless browser, via two mechanisms:
//
// 1. SCHEDULE: the /partidos/ page embeds upcoming + finished matches in its
//    HTML source (cjs.initialFeeds). Used to discover Flashscore match ids and
//    link them to our DB matches.
//
// 2. LIVE STATE: live matches are NOT in the HTML — they stream client-side.
//    But Flashscore's internal feed API (the same one its frontend consumes)
//    serves a tiny per-match snapshot at /x/feed/dc_1_{matchId}. It only needs
//    the public x-fsign header.

const FIXTURES_URL = 'https://www.flashscore.co/futbol/mundial/campeonato-del-mundo/partidos/'
// Project 202 = flashscore.co (Colombia). Host appears in the page's preconnect hints.
const FEED_BASE = 'https://202.flashscore.ninja/202/x/feed'
// Public feed signature used by the Flashscore frontend; stable for years.
// If feeds start returning 401/403, re-extract it from their core JS bundle.
const FSIGN = 'SW9D1eZo'

// Flashscore proprietary format separators
const RECORD_SEP = '~'
const FIELD_SEP = '¬'  // U+00AC
const KV_SEP = '÷'     // U+00F7

// DA (live feed) / AB (schedule feed) — overall match status
export const FS_STATUS = {
  SCHEDULED: 1,
  LIVE: 2,
  FINISHED: 3,
} as const

// DB (live feed) / AC (schedule feed) — granular stage codes.
// Verified live: 12 (1st half), 38 (half time), 13 (2nd half), 6 (extra time),
// 3 (finished). 10/11 observed on finished playoff matches (AET / after penalties).
// El resto (7 penales, 46 descanso entre periodos) viene del enum publico de
// Flashscore, consistente con todos los codigos verificados arriba.
export const FS_STAGE = {
  SCHEDULED: 1,
  FIRST_HALF: 12,
  HALF_TIME: 38,
  SECOND_HALF: 13,
  FINISHED: 3,
  FINISHED_AET: 10,
  FINISHED_PENS: 11,
  EXTRA_TIME: 6,
  PENALTIES: 7,
  // Pausa entre periodos (p.ej. fin del 2do tiempo antes de la prórroga, o antes
  // de los penales). Flashscore usa un único código de "break" para todas.
  BREAK_TIME: 46,
  INTERRUPTED: 36,
  POSTPONED: 37,
  CANCELLED: 5,
  ABANDONED: 8,
  WALKOVER: 9,
} as const

const STOPPED_STAGES = new Set<number>([
  FS_STAGE.INTERRUPTED,
  FS_STAGE.POSTPONED,
  FS_STAGE.CANCELLED,
  FS_STAGE.ABANDONED,
])

export interface ScrapedMatch {
  id: string
  timestamp: number
  round: string
  homeTeam: string
  awayTeam: string
  homeCode: string       // WM — e.g. "MEX"
  awayCode: string       // WN — e.g. "SUD"
  status: number         // AB
  stage: number | null   // AC
  homeScore: number | null // AG
  awayScore: number | null // AH
}

export interface RoundFixtures {
  round: string
  matches: ScrapedMatch[]
}

export interface LiveMatchState {
  statusCode: number          // DA: 1 scheduled, 2 live, 3 finished
  stageCode: number | null    // DB: see FS_STAGE
  homeScore: number | null    // DE (Flashscore home orientation) — marcador actual/final
  awayScore: number | null    // DF
  // DG/DH: marcador al final del tiempo reglamentario (90'), SIN prórroga ni
  // penales. En partidos normales coincide con DE/DF; en prórroga/penales es el
  // de los 90'. Verificado contra los playoffs (REA/REB = prórroga, DE/DF = final).
  regHomeScore: number | null // DG
  regAwayScore: number | null // DH
  // RPA/RPB: marcador de la tanda de penales (Flashscore home orientation). Solo
  // aparece durante/después de la tanda; null en el resto del partido.
  penHomeScore: number | null // RPA
  penAwayScore: number | null // RPB
  stageStartedAt: Date | null // DD: current period kickoff — basis for the minute
}

export function isStoppedStage(stageCode: number | null): boolean {
  return stageCode !== null && STOPPED_STAGES.has(stageCode)
}

export function describeStage(statusCode: number, stageCode: number | null): string {
  switch (stageCode) {
    case FS_STAGE.FIRST_HALF: return '1er Tiempo'
    case FS_STAGE.HALF_TIME: return 'Descanso'
    case FS_STAGE.SECOND_HALF: return '2do Tiempo'
    case FS_STAGE.FINISHED: return 'Finalizado'
    case FS_STAGE.FINISHED_AET: return 'Finalizado (prórroga)'
    case FS_STAGE.FINISHED_PENS: return 'Finalizado (penales)'
    case FS_STAGE.EXTRA_TIME: return 'Prórroga'
    case FS_STAGE.PENALTIES: return 'Penales'
    case FS_STAGE.BREAK_TIME: return 'Descanso'
    case FS_STAGE.INTERRUPTED: return 'Interrumpido'
    case FS_STAGE.POSTPONED: return 'Aplazado'
    case FS_STAGE.CANCELLED: return 'Cancelado'
    case FS_STAGE.ABANDONED: return 'Abandonado'
    case FS_STAGE.WALKOVER: return 'Walkover'
  }
  if (statusCode === FS_STATUS.LIVE) return 'En juego'
  if (statusCode === FS_STATUS.FINISHED) return 'Finalizado'
  return 'Programado'
}

// Display minute computed from the current period's kickoff timestamp — the
// same approach Flashscore's own frontend uses. Stoppage time is capped at the
// period boundary (45/90/120); the UI renders the cap as "45+"/"90+"/"120+".
// Prórroga (stage 6): DD se queda en el inicio de la prórroga (minuto 90') y NO
// se resetea entre sus dos tiempos, asi que el reloj es continuo 91'→120'.
// Verificado contra Flashscore en vivo (DD = inicio prórroga; DD-DC = 90' jugados).
export function computeDisplayMinute(
  stageCode: number | null,
  stageStartedAt: Date | null,
  now: Date = new Date()
): number | null {
  if (!stageStartedAt) return null
  const elapsed = Math.floor((now.getTime() - stageStartedAt.getTime()) / 60_000) + 1
  if (elapsed < 1) return null

  switch (stageCode) {
    case FS_STAGE.FIRST_HALF: return Math.min(elapsed, 45)
    case FS_STAGE.SECOND_HALF: return Math.min(45 + elapsed, 90)
    case FS_STAGE.EXTRA_TIME: return Math.min(90 + elapsed, 120)
    default: return null
  }
}

function parseRecord(record: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const part of record.split(FIELD_SEP)) {
    const idx = part.indexOf(KV_SEP)
    if (idx < 0) continue
    const key = part.slice(0, idx)
    if (key) fields[key] = part.slice(idx + 1)
  }
  return fields
}

function parseIntOrNull(value: string | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) ? parsed : null
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept-Language': 'es-CO,es;q=0.9',
}

// ─── 1. Schedule scraping (HTML) ─────────────────────────────────────────────

function extractFeedData(html: string, feedKey: string): string | null {
  const marker = `cjs.initialFeeds['${feedKey}']`
  const markerIdx = html.indexOf(marker)
  if (markerIdx < 0) return null

  // Data is stored as a backtick template literal: data: `...`
  const start = html.indexOf('`', markerIdx)
  if (start < 0) return null
  const end = html.indexOf('`', start + 1)
  if (end < 0) return null

  return html.slice(start + 1, end)
}

function parseScheduleFeed(data: string): ScrapedMatch[] {
  const matches: ScrapedMatch[] = []

  for (const record of data.split(RECORD_SEP)) {
    if (!record.trim()) continue

    const f = parseRecord(record)
    // Match records have AA (match id), AE (home team), AF (away team)
    if (!f['AA'] || !f['AE'] || !f['AF']) continue

    const status = parseIntOrNull(f['AB']) ?? FS_STATUS.SCHEDULED
    const hasScore = status !== FS_STATUS.SCHEDULED

    matches.push({
      id: f['AA'],
      timestamp: parseIntOrNull(f['AD']) ?? 0,
      round: f['ER'] ?? '',
      homeTeam: f['AE'],
      awayTeam: f['AF'],
      homeCode: f['WM'] ?? '',
      awayCode: f['WN'] ?? '',
      status,
      stage: parseIntOrNull(f['AC']),
      homeScore: hasScore ? parseIntOrNull(f['AG']) : null,
      awayScore: hasScore ? parseIntOrNull(f['AH']) : null,
    })
  }

  return matches
}

// All World Cup matches embedded in the fixtures page (upcoming + finished).
// Live matches are absent — use fetchLiveMatchState for those.
export async function scrapeWorldCupMatches(): Promise<ScrapedMatch[]> {
  const response = await fetch(FIXTURES_URL, {
    headers: { ...BROWSER_HEADERS, Accept: 'text/html,application/xhtml+xml' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`Flashscore fixtures fetch failed: ${response.status}`)
  }

  const html = await response.text()
  const all: ScrapedMatch[] = []
  for (const key of ['fixtures', 'results']) {
    const data = extractFeedData(html, key)
    if (data) all.push(...parseScheduleFeed(data))
  }

  const seen = new Set<string>()
  return all.filter(m => !seen.has(m.id) && seen.add(m.id))
}

export async function scrapeWorldCupSchedule(): Promise<RoundFixtures[]> {
  const unique = await scrapeWorldCupMatches()

  const roundMap = new Map<string, ScrapedMatch[]>()
  for (const match of unique) {
    const r = match.round || 'Sin ronda'
    if (!roundMap.has(r)) roundMap.set(r, [])
    roundMap.get(r)!.push(match)
  }

  return Array.from(roundMap.entries())
    .map(([round, ms]) => ({
      round,
      matches: ms.sort((a, b) => a.timestamp - b.timestamp),
    }))
    .sort((a, b) => (a.matches[0]?.timestamp ?? 0) - (b.matches[0]?.timestamp ?? 0))
}

// ─── 2. Live state (internal feed API) ───────────────────────────────────────

// Per-match snapshot: ~1 KB response, safe to call every minute.
export async function fetchLiveMatchState(flashscoreId: string): Promise<LiveMatchState | null> {
  const response = await fetch(`${FEED_BASE}/dc_1_${flashscoreId}`, {
    headers: { ...BROWSER_HEADERS, 'x-fsign': FSIGN },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) {
    throw new Error(`Flashscore live feed failed: ${response.status} (${flashscoreId})`)
  }

  const body = await response.text()
  const f = parseRecord(body.split(RECORD_SEP)[0] ?? '')
  if (!f['DA']) return null

  const stageStartedAtSec = parseIntOrNull(f['DD'])

  return {
    statusCode: parseIntOrNull(f['DA']) ?? FS_STATUS.SCHEDULED,
    stageCode: parseIntOrNull(f['DB']),
    homeScore: parseIntOrNull(f['DE']),
    awayScore: parseIntOrNull(f['DF']),
    regHomeScore: parseIntOrNull(f['DG']),
    regAwayScore: parseIntOrNull(f['DH']),
    penHomeScore: parseIntOrNull(f['RPA']),
    penAwayScore: parseIntOrNull(f['RPB']),
    stageStartedAt: stageStartedAtSec ? new Date(stageStartedAtSec * 1000) : null,
  }
}
