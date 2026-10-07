import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { buildGroupSlots, parseBracketSides, resolveGroupSlotToken } from '@/lib/standings'

export interface GroupBracketSummary {
  // Filas de eliminatorias con al menos un equipo sin asignar.
  knockoutMatchesMissingTeams: number
  // Posiciones de grupo (1ro/2do) ya decididas y disponibles para llenar cupos.
  decidedSlots: number
  // Lados (home/away) que se pudieron resolver desde posiciones de grupo.
  filledSides: number
  // Filas efectivamente actualizadas (una fila puede recibir 1 o 2 lados).
  updatedMatches: number
  warnings: string[]
}

type KnockoutRow = {
  id: string
  match_number: number
  starts_at: string
  label: string | null
  home_team_id: string | null
  away_team_id: string | null
}

// Llena el/los lado(s) determinista(s) de un placeholder de eliminatorias
// ("1A", "2B") desde NUESTROS resultados de grupo, apenas un grupo termina y la
// posicion queda decidida — asi un equipo clasificado se muestra esperando rival.
// Los cupos de mejores terceros ("3C/E/...") y las posiciones aun no decididas se
// dejan en null para que los complete el resolver de Flashscore o una corrida
// posterior. Idempotente y sin pisar: solo rellena un lado que siga en null.
export async function resolveKnockoutTeamsFromGroups({
  dryRun = false,
}: { dryRun?: boolean } = {}): Promise<GroupBracketSummary> {
  const admin = createAdminClient()
  const warnings: string[] = []

  const [groupMatchesRes, knockoutRes, teamsRes] = await Promise.all([
    admin
      .from('matches')
      .select('group_letter, home_team_id, away_team_id, home_score, away_score, status')
      .eq('phase', 'group'),
    admin
      .from('matches')
      .select('id, match_number, starts_at, label, home_team_id, away_team_id')
      .neq('phase', 'group')
      .order('match_number'),
    admin.from('teams').select('id, group_letter'),
  ])

  if (groupMatchesRes.error) throw new Error('Could not load group matches for the bracket resolve.')
  if (knockoutRes.error) throw new Error('Could not load knockout matches for the bracket resolve.')
  if (teamsRes.error) throw new Error('Could not load teams for the bracket resolve.')

  const slots = buildGroupSlots(groupMatchesRes.data ?? [], teamsRes.data ?? [])
  const decidedSlots = Object.keys(slots.winners).length + Object.keys(slots.runnersUp).length

  const knockout = (knockoutRes.data ?? []) as KnockoutRow[]
  const missing = knockout.filter(match => !match.home_team_id || !match.away_team_id)

  let filledSides = 0
  let updatedMatches = 0

  for (const row of missing) {
    const sides = parseBracketSides(row.label)
    const update: { home_team_id?: string; away_team_id?: string; label?: null } = {}

    let nextHome = row.home_team_id
    let nextAway = row.away_team_id

    if (!row.home_team_id && sides.home) {
      const teamId = resolveGroupSlotToken(sides.home, slots)
      if (teamId) {
        update.home_team_id = teamId
        nextHome = teamId
        filledSides += 1
      }
    }
    if (!row.away_team_id && sides.away) {
      const teamId = resolveGroupSlotToken(sides.away, slots)
      if (teamId) {
        update.away_team_id = teamId
        nextAway = teamId
        filledSides += 1
      }
    }

    if (!update.home_team_id && !update.away_team_id) continue

    // Limpiar el placeholder solo cuando ambos lados quedan conocidos.
    if (nextHome && nextAway) update.label = null

    if (!dryRun) {
      let query = admin.from('matches').update(update).eq('id', row.id)
      // Guarda por lado: nunca pisa una asignacion existente.
      if (update.home_team_id) query = query.is('home_team_id', null)
      if (update.away_team_id) query = query.is('away_team_id', null)

      const { error } = await query
      if (error) {
        warnings.push(`Error asignando equipos (grupos) al partido ${row.match_number}.`)
        continue
      }
    }

    updatedMatches += 1
  }

  return {
    knockoutMatchesMissingTeams: missing.length,
    decidedSlots,
    filledSides,
    updatedMatches,
    warnings: warnings.slice(0, 12),
  }
}

export interface KnockoutWinnerSummary {
  // Filas de eliminatorias con al menos un equipo sin asignar.
  knockoutMatchesMissingTeams: number
  // Lados (home/away) resueltos desde el ganador/perdedor de un partido jugado.
  filledSides: number
  // Filas efectivamente actualizadas (una fila puede recibir 1 o 2 lados).
  updatedMatches: number
  // Alimentadores ya jugados pero empatados sin ganador deducible (definidos por
  // penales): se dejan en null para que el resolver de Flashscore cierre el cruce.
  pendingShootouts: number
  warnings: string[]
}

type KnockoutResultRow = {
  id: string
  match_number: number
  status: string
  label: string | null
  home_team_id: string | null
  away_team_id: string | null
  home_score: number | null
  away_score: number | null
}

type LiveScoreRow = {
  match_id: string
  home_score: number | null
  away_score: number | null
}

// Token de un lado de cruce que espera el resultado de OTRO partido por numero:
// "Ganador M74" (avanza el ganador) o "Perdedor M101" (3er puesto: avanza el
// perdedor de la semi). El numero de grupo ("1A") no calza aqui y lo resuelve el
// resolver de grupos.
const RESULT_TOKEN = /^(Ganador|Perdedor)\s+M(\d{2,3})$/i

function parseResultToken(
  token: string | null
): { kind: 'winner' | 'loser'; matchNumber: number } | null {
  if (!token) return null
  const m = RESULT_TOKEN.exec(token.trim())
  if (!m) return null
  return {
    kind: /^Ganador$/i.test(m[1]) ? 'winner' : 'loser',
    matchNumber: Number.parseInt(m[2], 10),
  }
}

// Deduce ganador y perdedor de un alimentador YA finalizado, o 'shootout' si
// quedo empatado sin poder decidirse desde nuestros datos (penales).
//
// matches.home_score/away_score guarda el marcador de los 90' (asi la prorroga y
// los penales no cuentan en la puntuacion), por lo que un partido definido en la
// prorroga o en penales aparece empatado ahi. Para esos casos miramos el marcador
// mostrado del snapshot en vivo (incluye prorroga, no penales); si sigue empatado
// fue por penales y el ganador no esta en nuestros datos.
function feederOutcome(
  feeder: KnockoutResultRow | undefined,
  liveById: Map<string, LiveScoreRow>
): { winnerTeamId: string; loserTeamId: string } | 'shootout' | null {
  if (!feeder || feeder.status !== 'finished' || !feeder.home_team_id || !feeder.away_team_id) {
    return null
  }

  const homeId = feeder.home_team_id
  const awayId = feeder.away_team_id
  const decide = (home: number, away: number) =>
    home === away
      ? null
      : home > away
        ? { winnerTeamId: homeId, loserTeamId: awayId }
        : { winnerTeamId: awayId, loserTeamId: homeId }

  if (feeder.home_score !== null && feeder.away_score !== null) {
    const byRegulation = decide(feeder.home_score, feeder.away_score)
    if (byRegulation) return byRegulation
  }

  const live = liveById.get(feeder.id)
  if (live && live.home_score !== null && live.away_score !== null) {
    const byExtraTime = decide(live.home_score, live.away_score)
    if (byExtraTime) return byExtraTime
  }

  return 'shootout'
}

// Propaga el equipo clasificado de un cruce a la ronda siguiente apenas su partido
// alimentador termina — sin esperar al rival, igual que el resolver de grupos: un
// "Ganador M74" se reemplaza por el equipo ganador y el cruce se muestra esperando
// al otro lado. Tambien resuelve el 3er puesto ("Perdedor M101"). Los empates por
// penales se dejan en null para que los cierre el resolver de Flashscore (que trae
// el cruce real). Idempotente y sin pisar: solo rellena un lado que siga en null.
export async function resolveKnockoutTeamsFromWinners({
  dryRun = false,
}: { dryRun?: boolean } = {}): Promise<KnockoutWinnerSummary> {
  const admin = createAdminClient()
  const warnings: string[] = []

  const [knockoutRes, liveRes] = await Promise.all([
    admin
      .from('matches')
      .select('id, match_number, status, label, home_team_id, away_team_id, home_score, away_score')
      .neq('phase', 'group')
      .order('match_number'),
    admin.from('match_live_states').select('match_id, home_score, away_score'),
  ])

  if (knockoutRes.error) throw new Error('Could not load knockout matches for the winner resolve.')
  if (liveRes.error) throw new Error('Could not load live states for the winner resolve.')

  const knockout = (knockoutRes.data ?? []) as KnockoutResultRow[]
  const byNumber = new Map(knockout.map(match => [match.match_number, match]))
  const liveById = new Map(
    ((liveRes.data ?? []) as LiveScoreRow[]).map(state => [state.match_id, state])
  )

  const missing = knockout.filter(match => !match.home_team_id || !match.away_team_id)

  let filledSides = 0
  let updatedMatches = 0
  let pendingShootouts = 0

  // Resuelve el team_id que debe ocupar un lado a partir de su token ("Ganador M74"),
  // o null si el alimentador no termino / aun no se decide. Avisa de los penales.
  const resolveSide = (token: string | null): string | null => {
    const parsed = parseResultToken(token)
    if (!parsed) return null

    const outcome = feederOutcome(byNumber.get(parsed.matchNumber), liveById)
    if (outcome === 'shootout') {
      pendingShootouts += 1
      warnings.push(
        `El partido ${parsed.matchNumber} terminó empatado (penales): el ganador se asignará desde Flashscore.`
      )
      return null
    }
    if (!outcome) return null

    return parsed.kind === 'winner' ? outcome.winnerTeamId : outcome.loserTeamId
  }

  for (const row of missing) {
    const sides = parseBracketSides(row.label)
    const update: { home_team_id?: string; away_team_id?: string; label?: null } = {}

    let nextHome = row.home_team_id
    let nextAway = row.away_team_id

    if (!row.home_team_id) {
      const teamId = resolveSide(sides.home)
      if (teamId) {
        update.home_team_id = teamId
        nextHome = teamId
        filledSides += 1
      }
    }
    if (!row.away_team_id) {
      const teamId = resolveSide(sides.away)
      if (teamId) {
        update.away_team_id = teamId
        nextAway = teamId
        filledSides += 1
      }
    }

    if (!update.home_team_id && !update.away_team_id) continue

    // Limpiar el placeholder solo cuando ambos lados quedan conocidos.
    if (nextHome && nextAway) update.label = null

    if (!dryRun) {
      let query = admin.from('matches').update(update).eq('id', row.id)
      // Guarda por lado: nunca pisa una asignacion existente ni una corrida concurrente.
      if (update.home_team_id) query = query.is('home_team_id', null)
      if (update.away_team_id) query = query.is('away_team_id', null)

      const { error } = await query
      if (error) {
        warnings.push(`Error asignando ganadores al partido ${row.match_number}.`)
        continue
      }
    }

    updatedMatches += 1
  }

  return {
    knockoutMatchesMissingTeams: missing.length,
    filledSides,
    updatedMatches,
    pendingShootouts,
    warnings: warnings.slice(0, 12),
  }
}
