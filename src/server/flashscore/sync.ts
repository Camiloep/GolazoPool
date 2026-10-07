import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { MatchStatus } from '@/lib/types'
import { fetchFlashscoreResults } from './client'
import {
  computeDisplayMinute,
  describeStage,
  fetchLiveMatchState,
  FS_STAGE,
  FS_STATUS,
  isStoppedStage,
  scrapeWorldCupMatches,
} from './html-scraper'
import {
  buildTeamIndex,
  isFinalTournamentResult,
  parseScore,
  resolveFlashscoreTeam,
} from './mapper'

type DatabaseMatch = {
  id: string
  home_team_id: string | null
  away_team_id: string | null
  starts_at: string
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

export interface FlashscoreSyncSummary {
  totalSourceResults: number
  finalTournamentResults: number
  matchedMatches: number
  updatedMatches: number
  inProgressMatches: number
  warnings: string[]
}

export interface LiveSyncSummary {
  activeWindowMatches: number
  newlyLinked: number
  liveMatches: number
  finishedMatches: number
  updatedMatches: number
  warnings: string[]
}

export interface KnockoutResolveSummary {
  // Filas de eliminatorias en la DB todavia sin ambos equipos.
  knockoutMatchesMissingTeams: number
  // Partidos raspados de Flashscore con ambos equipos ya resueltos a un team_id.
  resolvableFixtures: number
  // Filas a las que se les pudo emparejar un fixture por hora de inicio.
  matchedMatches: number
  // Filas efectivamente actualizadas con equipos.
  updatedMatches: number
  warnings: string[]
}

interface FlashscoreSyncOptions {
  dryRun?: boolean
  now?: Date
}

// Unordered team pair key. NOT unique within a World Cup: two teams can meet
// twice (group stage + knockout rematch), so lookups keep ALL matches per pair
// and disambiguate by kickoff time via pickByKickoff.
function pairKey(teamA: string, teamB: string) {
  return [teamA, teamB].sort().join('|')
}

const KICKOFF_TOLERANCE_MS = 24 * 60 * 60 * 1000

// Picks the candidate whose starts_at is nearest the source's kickoff time.
// With a single candidate no timestamp is needed; with several (rematch) an
// unusable timestamp returns null so the caller skips instead of guessing.
function pickByKickoff(
  candidates: DatabaseMatch[],
  sourceKickoff: Date | null
): DatabaseMatch | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]
  if (!sourceKickoff || Number.isNaN(sourceKickoff.getTime())) return null

  let best: DatabaseMatch | null = null
  let bestDiff = Infinity
  for (const candidate of candidates) {
    const diff = Math.abs(new Date(candidate.starts_at).getTime() - sourceKickoff.getTime())
    if (diff < bestDiff) {
      bestDiff = diff
      best = candidate
    }
  }
  return bestDiff <= KICKOFF_TOLERANCE_MS ? best : null
}

export async function syncWorldCupResultsFromFlashscore(
  options: FlashscoreSyncOptions = {}
): Promise<FlashscoreSyncSummary> {
  const { dryRun = false, now = new Date() } = options
  const admin = createAdminClient()

  const [results, matchesResponse, teamsResponse] = await Promise.all([
    fetchFlashscoreResults(),
    admin
      .from('matches')
      .select('id, home_team_id, away_team_id, starts_at, home_score, away_score, status')
      .order('match_number'),
    admin.from('teams').select('id, name, code, group_letter').order('name'),
  ])

  if (matchesResponse.error) {
    throw new Error('Could not load matches from Supabase for the Flashscore sync.')
  }
  if (teamsResponse.error) {
    throw new Error('Could not load teams from Supabase for the Flashscore sync.')
  }

  const matches = (matchesResponse.data ?? []) as DatabaseMatch[]
  const teams = (teamsResponse.data ?? []) as DatabaseTeam[]
  const teamIndex = buildTeamIndex(teams)

  // Index our matches by team pair (only those with both teams resolved).
  // A pair can hold several matches (group + knockout rematch).
  const matchByPair = new Map<string, DatabaseMatch[]>()
  for (const match of matches) {
    if (match.home_team_id && match.away_team_id) {
      const key = pairKey(match.home_team_id, match.away_team_id)
      if (!matchByPair.has(key)) matchByPair.set(key, [])
      matchByPair.get(key)!.push(match)
    }
  }

  const finalResults = results.filter(isFinalTournamentResult)
  const warnings: string[] = []
  let matchedMatches = 0
  let updatedMatches = 0
  let inProgressMatches = 0

  for (const result of finalResults) {
    const homeTeam = resolveFlashscoreTeam(result.homeName, teamIndex)
    const awayTeam = resolveFlashscoreTeam(result.awayName, teamIndex)

    if (!homeTeam || !awayTeam) {
      warnings.push(
        `No se pudo mapear los equipos: ${result.homeName ?? '?'} vs ${result.awayName ?? '?'}.`
      )
      continue
    }

    const candidates = matchByPair.get(pairKey(homeTeam.id, awayTeam.id)) ?? []
    const dbMatch = pickByKickoff(
      candidates,
      result.startDateTimeUtc ? new Date(result.startDateTimeUtc) : null
    )
    if (!dbMatch) {
      warnings.push(
        candidates.length > 1
          ? `Par ambiguo sin hora de inicio usable: ${result.homeName} vs ${result.awayName}.`
          : `No existe el partido local: ${result.homeName} vs ${result.awayName}.`
      )
      continue
    }

    matchedMatches += 1

    // A finished match with both scores is settled: never overwrite it, so
    // manual admin corrections stick and the API can't rewrite closed results.
    if (
      dbMatch.status === 'finished' &&
      dbMatch.home_score !== null &&
      dbMatch.away_score !== null
    ) {
      continue
    }

    // Guard: only touch matches that have already kicked off in OUR schedule.
    if (now.getTime() < new Date(dbMatch.starts_at).getTime()) {
      warnings.push(
        `Partido aun no iniciado, se omite: ${result.homeName} vs ${result.awayName}.`
      )
      continue
    }

    // Preferimos el marcador de tiempo reglamentario (90', "full time") para que
    // la puntuacion no cuente prorroga/penales; si no viene, usamos el marcador.
    // (En la practica el sync en vivo por HTML cierra los partidos primero con el
    // marcador de los 90'; este es respaldo y no pisa un partido ya finalizado.)
    const apiHomeScore = parseScore(result.homeFullTimeScore ?? result.homeScore)
    const apiAwayScore = parseScore(result.awayFullTimeScore ?? result.awayScore)

    if (apiHomeScore === null || apiAwayScore === null) {
      warnings.push(`Marcador invalido para ${result.homeName} vs ${result.awayName}.`)
      continue
    }

    // Orient the score to our match's home/away. The API's "home" team may be
    // stored as our away team.
    const sameOrientation = dbMatch.home_team_id === homeTeam.id
    const homeScore = sameOrientation ? apiHomeScore : apiAwayScore
    const awayScore = sameOrientation ? apiAwayScore : apiHomeScore

    const values: Partial<DatabaseMatch> = {}
    if (dbMatch.home_score !== homeScore) values.home_score = homeScore
    if (dbMatch.away_score !== awayScore) values.away_score = awayScore
    if (dbMatch.status !== 'finished') values.status = 'finished'

    if (Object.keys(values).length === 0) continue

    if (!dryRun) {
      const { error } = await admin.from('matches').update(values).eq('id', dbMatch.id)
      if (error) {
        warnings.push(
          `Error actualizando ${result.homeName} vs ${result.awayName}; se continúa con el resto.`
        )
        continue
      }
    }

    // Keep the in-memory snapshot consistent so the in_progress loop below
    // never reverts a match this loop just finished.
    Object.assign(dbMatch, values)
    updatedMatches += 1
  }

  // Mark any scheduled match that has passed its kick-off time as in_progress.
  // The Flashscore /results API only returns FINISHED events, so live match
  // status must be derived from the clock rather than the API response.
  for (const match of matches) {
    if (match.status === 'scheduled' && now.getTime() >= new Date(match.starts_at).getTime()) {
      if (!dryRun) {
        const { error } = await admin
          .from('matches')
          .update({ status: 'in_progress' })
          .eq('id', match.id)
          // SQL guard: never downgrade a status written by another sync run
          .eq('status', 'scheduled')
        if (error) {
          warnings.push(`Error marcando in_progress: ${match.id}`)
          continue
        }
      }
      inProgressMatches += 1
    }
  }

  return {
    totalSourceResults: results.length,
    finalTournamentResults: finalResults.length,
    matchedMatches,
    updatedMatches,
    inProgressMatches,
    warnings: warnings.slice(0, 12),
  }
}

// Tolerancia entre nuestra hora de inicio y la de Flashscore para considerar
// que es el mismo partido de eliminatorias. Los partidos de una misma ronda se
// separan >3h, asi que una ventana estrecha evita emparejar el partido vecino.
const KNOCKOUT_KICKOFF_TOLERANCE_MS = 3 * 60 * 60 * 1000

type KnockoutRow = {
  id: string
  match_number: number
  starts_at: string
  home_team_id: string | null
  away_team_id: string | null
  label: string | null
}

// Asigna los equipos de las eliminatorias (r32..final) desde Flashscore, que
// publica el cruce solo cuando AMBOS equipos quedan definidos. A diferencia del
// sync de marcadores (empareja por par de equipos, imposible aqui porque los
// equipos aun no estan en la fila), empareja nuestras filas placeholder con los
// fixtures raspados por cercania de hora de inicio.
//
// Completa por lado: si una fila ya trae un equipo (p.ej. el resolver por grupos
// fijo el "1A"), ancla la orientacion en ese lado y solo llena el que falta; si
// trae ambos en null, llena los dos con la orientacion de Flashscore. Nunca pisa
// un lado ya asignado, asi respeta correcciones manuales y el lado de grupos.
//
// Reemplaza el rol del sync de OpenFootball para resolver el bracket: el scraper
// gratuito de Flashscore trae los cruces con equipos reales sin depender de que
// el JSON comunitario de OpenFootball se actualice.
export async function resolveKnockoutTeamsFromFlashscore(
  options: FlashscoreSyncOptions = {}
): Promise<KnockoutResolveSummary> {
  const { dryRun = false } = options
  const admin = createAdminClient()
  const warnings: string[] = []

  const [matchesResponse, teamsResponse] = await Promise.all([
    admin
      .from('matches')
      .select('id, match_number, phase, starts_at, home_team_id, away_team_id, label')
      .neq('phase', 'group')
      .order('match_number'),
    admin.from('teams').select('id, name, code, group_letter').order('name'),
  ])

  if (matchesResponse.error) {
    throw new Error('Could not load knockout matches for the Flashscore bracket resolve.')
  }
  if (teamsResponse.error) {
    throw new Error('Could not load teams for the Flashscore bracket resolve.')
  }

  const knockout = (matchesResponse.data ?? []) as KnockoutRow[]
  // Cualquier fila con al menos un lado sin asignar (incluye filas a medio llenar
  // por el resolver de grupos, cuyo lado faltante se completa aqui).
  const missing = knockout.filter(match => !match.home_team_id || !match.away_team_id)

  const empty: KnockoutResolveSummary = {
    knockoutMatchesMissingTeams: missing.length,
    resolvableFixtures: 0,
    matchedMatches: 0,
    updatedMatches: 0,
    warnings,
  }

  if (missing.length === 0) return empty

  const teamIndex = buildTeamIndex((teamsResponse.data ?? []) as DatabaseTeam[])

  let scraped: Awaited<ReturnType<typeof scrapeWorldCupMatches>> = []
  try {
    scraped = await scrapeWorldCupMatches()
  } catch {
    warnings.push('No se pudo raspar la página de partidos de Flashscore para resolver el bracket.')
    return empty
  }

  // Fixtures raspados con AMBOS equipos resueltos a un team_id nuestro, con su
  // hora de inicio. Ignoramos a proposito la etiqueta de ronda: emparejar por
  // hora ya desambigua (los cruces de eliminatorias tienen horas unicas y lejos
  // de las fechas de grupos o de los playoffs de marzo que ensucian "Final").
  const resolvable = scraped
    .map(sourceMatch => {
      const home = resolveFlashscoreTeam(sourceMatch.homeTeam, teamIndex)
      const away = resolveFlashscoreTeam(sourceMatch.awayTeam, teamIndex)
      if (!home || !away || !sourceMatch.timestamp) return null
      return { homeId: home.id, awayId: away.id, kickoffMs: sourceMatch.timestamp * 1000, used: false }
    })
    .filter((fixture): fixture is NonNullable<typeof fixture> => fixture !== null)

  // Filas mas tempranas primero: si dos comparten el fixture mas cercano, la de
  // hora menor lo consume y la otra cae al siguiente (no deberia ocurrir porque
  // las horas calzan, pero deja el emparejamiento determinista).
  const ordered = [...missing].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  )

  let matchedMatches = 0
  let updatedMatches = 0

  for (const row of ordered) {
    const rowMs = new Date(row.starts_at).getTime()
    let best: (typeof resolvable)[number] | null = null
    let bestDiff = Infinity
    for (const fixture of resolvable) {
      if (fixture.used) continue
      const diff = Math.abs(fixture.kickoffMs - rowMs)
      if (diff < bestDiff) {
        bestDiff = diff
        best = fixture
      }
    }

    if (!best || bestDiff > KNOCKOUT_KICKOFF_TOLERANCE_MS) continue

    // El fixture es el de esta fila (la hora lo identifica de forma unica), asi
    // que se consume aqui aunque luego no se pueda llenar por un conflicto.
    best.used = true
    matchedMatches += 1

    const update: { home_team_id?: string; away_team_id?: string; label: null } = { label: null }

    if (!row.home_team_id && !row.away_team_id) {
      // Sin lados previos: se usa la orientacion de Flashscore tal cual.
      update.home_team_id = best.homeId
      update.away_team_id = best.awayId
    } else if (row.home_team_id && !row.away_team_id) {
      // Home ya fijado (p.ej. "1A" por grupos): el rival es el equipo del par que
      // NO es el home; se mantiene la orientacion de la fila, no la de Flashscore.
      if (row.home_team_id === best.homeId) update.away_team_id = best.awayId
      else if (row.home_team_id === best.awayId) update.away_team_id = best.homeId
      else {
        warnings.push(`Conflicto de bracket en el partido ${row.match_number}: el local fijado no esta en el cruce de Flashscore.`)
        continue
      }
    } else if (!row.home_team_id && row.away_team_id) {
      if (row.away_team_id === best.awayId) update.home_team_id = best.homeId
      else if (row.away_team_id === best.homeId) update.home_team_id = best.awayId
      else {
        warnings.push(`Conflicto de bracket en el partido ${row.match_number}: la visita fijada no esta en el cruce de Flashscore.`)
        continue
      }
    } else {
      continue // ambos lados ya asignados
    }

    if (!dryRun) {
      let query = admin.from('matches').update(update).eq('id', row.id)
      // Guarda por lado: solo escribe el lado que estaba en null (idempotente, no
      // pisa el lado de grupos ni una correccion manual ni una corrida concurrente).
      if (update.home_team_id) query = query.is('home_team_id', null)
      if (update.away_team_id) query = query.is('away_team_id', null)

      const { error } = await query
      if (error) {
        warnings.push(`Error asignando equipos al partido ${row.match_number}.`)
        continue
      }
    }

    updatedMatches += 1
  }

  return {
    knockoutMatchesMissingTeams: missing.length,
    resolvableFixtures: resolvable.length,
    matchedMatches,
    updatedMatches,
    warnings: warnings.slice(0, 12),
  }
}

type LiveStateLink = {
  match_id: string
  flashscore_id: string
  home_is_flashscore_home: boolean
  // Marcador de los 90' ya guardado (nuestra orientacion), si existe. Se reusa
  // como respaldo cuando un poll omite DG/DH: mantiene reg_* estable durante la
  // prórroga y permite cerrar una eliminatoria con el marcador correcto de 90'
  // aunque el poll de cierre no lo traiga.
  reg_home_score?: number | null
  reg_away_score?: number | null
}

// How long after kickoff we keep polling a match that never reached 'finished'
// (covers extra time + penalties + delays).
const ACTIVE_WINDOW_MS = 4 * 60 * 60 * 1000
// Start polling slightly before kickoff so the transition to live is prompt.
const PRE_KICKOFF_MS = 5 * 60 * 1000

// Live sync, called every minute by the cron:
//   1. Finds our matches inside the active window (about to start → ~4h after).
//   2. Links them to Flashscore match ids (scraping the schedule page once,
//      only when an unlinked match is found).
//   3. Fetches each linked match's live feed snapshot (~1 KB per match).
//   4. Updates matches.status/scores and upserts match_live_states with the
//      phase ("1er Tiempo", "Descanso"...), display minute and live score.
// Finished matches are closed here immediately (no waiting for the hourly job).
export async function syncLiveWorldCupScores(
  options: FlashscoreSyncOptions = {}
): Promise<LiveSyncSummary> {
  const { dryRun = false, now = new Date() } = options
  const admin = createAdminClient()
  const warnings: string[] = []

  const windowStart = new Date(now.getTime() - ACTIVE_WINDOW_MS).toISOString()
  const windowEnd = new Date(now.getTime() + PRE_KICKOFF_MS).toISOString()

  const matchesResponse = await admin
    .from('matches')
    .select('id, home_team_id, away_team_id, starts_at, home_score, away_score, status')
    .in('status', ['scheduled', 'in_progress'])
    .gte('starts_at', windowStart)
    .lte('starts_at', windowEnd)

  if (matchesResponse.error) throw new Error('Could not load matches for the live sync.')
  const activeMatches = (matchesResponse.data ?? []) as DatabaseMatch[]

  if (activeMatches.length === 0) {
    return {
      activeWindowMatches: 0,
      newlyLinked: 0,
      liveMatches: 0,
      finishedMatches: 0,
      updatedMatches: 0,
      warnings,
    }
  }

  const matchIds = activeMatches.map(m => m.id)
  const linksResponse = await admin
    .from('match_live_states')
    .select('match_id, flashscore_id, home_is_flashscore_home, reg_home_score, reg_away_score')
    .in('match_id', matchIds)

  if (linksResponse.error) throw new Error('Could not load Flashscore links for the live sync.')

  const linkByMatchId = new Map<string, LiveStateLink>(
    ((linksResponse.data ?? []) as LiveStateLink[]).map(l => [l.match_id, l])
  )

  // ── Link matches to Flashscore ids ──
  // IMPORTANT: a match that is currently LIVE is absent from the fixtures page
  // feeds (it is neither upcoming nor finished), so links must exist BEFORE
  // kickoff. When any active match is unlinked we scrape once and link EVERY
  // resolvable match (all future rounds), so subsequent kickoffs are covered.
  const unlinked = activeMatches.filter(
    m => !linkByMatchId.has(m.id) && m.home_team_id && m.away_team_id
  )
  let newlyLinked = 0

  if (unlinked.length > 0) {
    const [teamsResponse, allMatchesResponse] = await Promise.all([
      admin.from('teams').select('id, name, code, group_letter').order('name'),
      admin
        .from('matches')
        .select('id, home_team_id, away_team_id, starts_at, home_score, away_score, status')
        .neq('status', 'finished')
        .not('home_team_id', 'is', null)
        .not('away_team_id', 'is', null),
    ])
    if (teamsResponse.error) throw new Error('Could not load teams for the live sync.')
    if (allMatchesResponse.error) throw new Error('Could not load matches to link.')

    const teamIndex = buildTeamIndex((teamsResponse.data ?? []) as DatabaseTeam[])
    const linkableMatches = (allMatchesResponse.data ?? []) as DatabaseMatch[]

    let scraped: Awaited<ReturnType<typeof scrapeWorldCupMatches>> = []
    try {
      scraped = await scrapeWorldCupMatches()
    } catch {
      warnings.push('No se pudo raspar la página de partidos de Flashscore para vincular.')
    }

    // Index scraped matches by our resolved team pair. A pair can repeat
    // (group + knockout rematch), so keep all and pick by kickoff proximity.
    const scrapedByPair = new Map<
      string,
      { id: string; homeTeamId: string; kickoffMs: number }[]
    >()
    for (const sm of scraped) {
      const home = resolveFlashscoreTeam(sm.homeTeam, teamIndex)
      const away = resolveFlashscoreTeam(sm.awayTeam, teamIndex)
      if (!home || !away) continue
      const key = pairKey(home.id, away.id)
      if (!scrapedByPair.has(key)) scrapedByPair.set(key, [])
      scrapedByPair.get(key)!.push({
        id: sm.id,
        homeTeamId: home.id,
        kickoffMs: sm.timestamp * 1000,
      })
    }

    const newLinks: LiveStateLink[] = []
    for (const match of linkableMatches) {
      const found = scrapedByPair.get(pairKey(match.home_team_id!, match.away_team_id!)) ?? []
      if (found.length === 0) continue

      const matchKickoffMs = new Date(match.starts_at).getTime()
      let best: (typeof found)[number] | null = null
      let bestDiff = Infinity
      for (const candidate of found) {
        const diff = Math.abs(candidate.kickoffMs - matchKickoffMs)
        if (diff < bestDiff) {
          bestDiff = diff
          best = candidate
        }
      }
      if (!best || bestDiff > KICKOFF_TOLERANCE_MS) {
        warnings.push(`Vínculo ambiguo o sin hora compatible para el partido ${match.id}.`)
        continue
      }

      newLinks.push({
        match_id: match.id,
        flashscore_id: best.id,
        home_is_flashscore_home: match.home_team_id === best.homeTeamId,
      })
    }

    if (newLinks.length > 0 && !dryRun) {
      // ignoreDuplicates: existing rows keep their live state untouched
      const { error } = await admin
        .from('match_live_states')
        .upsert(
          newLinks.map(link => ({ ...link, phase: 'Programado', status_code: FS_STATUS.SCHEDULED })),
          { onConflict: 'match_id', ignoreDuplicates: true }
        )
      if (error) warnings.push('Error guardando vínculos de Flashscore.')
    }

    for (const link of newLinks) {
      if (!linkByMatchId.has(link.match_id)) {
        linkByMatchId.set(link.match_id, link)
        newlyLinked += 1
      }
    }

    for (const match of unlinked) {
      if (!linkByMatchId.has(match.id)) {
        warnings.push(`Sin id de Flashscore para el partido ${match.id}.`)
      }
    }
  }

  // ── Poll the live feed for every linked active match ──
  // Feeds are fetched in parallel (each ~1 KB with an 8s timeout) so one slow
  // response never delays the other live matches within the 1-minute cadence.
  let liveMatches = 0
  let finishedMatches = 0
  let updatedMatches = 0

  const polled = await Promise.all(
    activeMatches.map(async match => {
      const link = linkByMatchId.get(match.id)
      if (!link) return null
      try {
        const state = await fetchLiveMatchState(link.flashscore_id)
        return state ? { match, link, state } : null
      } catch {
        warnings.push(`Feed en vivo falló para ${link.flashscore_id}.`)
        return null
      }
    })
  )

  for (const item of polled) {
    if (!item) continue
    const { match, link, state } = item

    // Marcador actual/mostrado (DE/DF). En vivo es lo que se ve; al finalizar es
    // el final (con prórroga/penales si las hubo).
    const oriented = link.home_is_flashscore_home
      ? { home: state.homeScore, away: state.awayScore }
      : { home: state.awayScore, away: state.homeScore }

    // Marcador de los 90' / tiempo reglamentario (DG/DH), sin prórroga ni penales.
    const regOriented = link.home_is_flashscore_home
      ? { home: state.regHomeScore, away: state.regAwayScore }
      : { home: state.regAwayScore, away: state.regHomeScore }

    // Marcador de la tanda de penales (RPA/RPB), orientado a nuestro home/away.
    const penOriented = link.home_is_flashscore_home
      ? { home: state.penHomeScore, away: state.penAwayScore }
      : { home: state.penAwayScore, away: state.penHomeScore }

    // Respaldo del marcador de 90' ya guardado (nuestra orientacion). El de los
    // 90' es inmutable una vez alcanzado, asi que reusamos el ultimo conocido
    // cuando este poll no trae DG/DH. Esto mantiene reg_* "pegajoso": nunca se
    // pisa un valor conocido con null, evitando que la puntuacion en vivo de la
    // prórroga/penales parpadee a "pendiente" en un poll con feed incompleto.
    const existingReg = { home: link.reg_home_score ?? null, away: link.reg_away_score ?? null }
    const stickyReg = {
      home: regOriented.home ?? existingReg.home,
      away: regOriented.away ?? existingReg.away,
    }

    const isStopped = isStoppedStage(state.stageCode)
    const isLive = state.statusCode === FS_STATUS.LIVE
    // A stopped stage (interrupted, postponed, cancelled, abandoned) may arrive
    // with statusCode=FINISHED from Flashscore's data model. Guard against that
    // so we never write 'finished' to a match that didn't actually end normally.
    const isFinished = state.statusCode === FS_STATUS.FINISHED && !isStopped
    if (isLive) liveMatches += 1
    if (isFinished) finishedMatches += 1

    // Update the canonical matches row
    const values: Partial<DatabaseMatch> = {}
    if (isFinished && match.status !== 'finished') values.status = 'finished'
    else if (isLive && match.status === 'scheduled') values.status = 'in_progress'
    // Stopped match: keep status as in_progress; is_stopped in match_live_states
    // tracks the UI state independently.

    // Marcador que se guarda para PUNTUAR: al finalizar usamos el de los 90' para
    // que la prórroga y los penales no cuenten; en vivo, el actual (DE/DF).
    //  - reglamentario de este poll (DG/DH) cuando llega;
    //  - en cierres por prórroga/penales (stage 10/11), si el poll de cierre no
    //    trae DG/DH, caemos al ultimo de 90' conocido (stickyReg) antes que al
    //    mostrado, que ahi ya incluye goles de tiempo extra (y el +1 del ganador
    //    en penales) y puntuaria mal para siempre;
    //  - en cierres en tiempo reglamentario (o si no hay nada mejor), el mostrado.
    const isOtFinish =
      state.stageCode === FS_STAGE.FINISHED_AET || state.stageCode === FS_STAGE.FINISHED_PENS
    const scoreForDb = !isFinished
      ? oriented
      : regOriented.home !== null && regOriented.away !== null
        ? regOriented
        : isOtFinish && stickyReg.home !== null && stickyReg.away !== null
          ? stickyReg
          : oriented

    if ((isLive || isFinished) && scoreForDb.home !== null && scoreForDb.away !== null) {
      if (match.home_score !== scoreForDb.home) values.home_score = scoreForDb.home
      if (match.away_score !== scoreForDb.away) values.away_score = scoreForDb.away
    }

    if (!dryRun) {
      if (Object.keys(values).length > 0) {
        const { error } = await admin.from('matches').update(values).eq('id', match.id)
        // On error, warn but still refresh the live state below
        if (error) warnings.push(`Error actualizando partido ${match.id}.`)
      }

      const { error: stateError } = await admin.from('match_live_states').upsert({
        match_id: match.id,
        flashscore_id: link.flashscore_id,
        home_is_flashscore_home: link.home_is_flashscore_home,
        status_code: state.statusCode,
        stage_code: state.stageCode,
        phase: describeStage(state.statusCode, state.stageCode),
        minute: computeDisplayMinute(state.stageCode, state.stageStartedAt, now),
        home_score: oriented.home,
        away_score: oriented.away,
        pen_home_score: penOriented.home,
        pen_away_score: penOriented.away,
        // Marcador de los 90' (DG/DH), "pegajoso": se conserva el ultimo conocido
        // si este poll no lo trae. Durante la prórroga/penales la puntuacion
        // provisional lo lee (congelado) en vez del marcador en vivo con goles de
        // tiempo extra.
        reg_home_score: stickyReg.home,
        reg_away_score: stickyReg.away,
        stage_started_at: state.stageStartedAt?.toISOString() ?? null,
        is_stopped: isStoppedStage(state.stageCode),
        updated_at: now.toISOString(),
      })
      if (stateError) warnings.push(`Error guardando estado en vivo: ${match.id}.`)
    }

    if (Object.keys(values).length > 0) updatedMatches += 1
  }

  return {
    activeWindowMatches: activeMatches.length,
    newlyLinked,
    liveMatches,
    finishedMatches,
    updatedMatches,
    warnings: warnings.slice(0, 12),
  }
}
