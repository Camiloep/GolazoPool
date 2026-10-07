// Logica pura de posiciones de grupo para resolver los cupos del bracket.
//
// Los desempates del Mundial aplican puntos -> diferencia de gol -> goles a favor
// ANTES del head-to-head, asi que ordenar por esa tupla es correcto siempre que
// sea estricta. Cuando dos equipos empatan en la tupla completa no se puede
// decidir sin head-to-head, asi que esa posicion se deja sin resolver (el caller
// la omite) en vez de adivinarla: preferimos mostrar de menos que mostrar mal.

type GroupMatchLike = {
  group_letter: string | null
  home_team_id: string | null
  away_team_id: string | null
  home_score: number | null
  away_score: number | null
  status: string
}

type GroupTeamLike = {
  id: string
  group_letter: string | null
}

export interface GroupSlots {
  // Letra de grupo -> id del 1er/2do lugar, SOLO cuando el grupo esta completo
  // y la posicion queda estrictamente decidida por (puntos, DG, goles a favor).
  winners: Record<string, string>
  runnersUp: Record<string, string>
}

type StandingRow = { id: string; pts: number; gd: number; gf: number }

function sameTuple(a: StandingRow, b: StandingRow) {
  return a.pts === b.pts && a.gd === b.gd && a.gf === b.gf
}

export function buildGroupSlots(
  groupMatches: GroupMatchLike[],
  groupTeams: GroupTeamLike[]
): GroupSlots {
  const winners: Record<string, string> = {}
  const runnersUp: Record<string, string> = {}

  // Sembramos cada equipo para detectar grupos completos y para que un equipo
  // sin partidos jugados igual aparezca en la tabla.
  const byGroup = new Map<string, Map<string, StandingRow>>()
  for (const team of groupTeams) {
    if (!team.group_letter) continue
    if (!byGroup.has(team.group_letter)) byGroup.set(team.group_letter, new Map())
    byGroup.get(team.group_letter)!.set(team.id, { id: team.id, pts: 0, gd: 0, gf: 0 })
  }

  const totalByGroup = new Map<string, number>()
  const finishedByGroup = new Map<string, number>()

  for (const match of groupMatches) {
    const group = match.group_letter
    if (!group) continue

    totalByGroup.set(group, (totalByGroup.get(group) ?? 0) + 1)

    const isFinished =
      match.status === 'finished' && match.home_score !== null && match.away_score !== null
    if (!isFinished) continue

    finishedByGroup.set(group, (finishedByGroup.get(group) ?? 0) + 1)

    const table = byGroup.get(group)
    const home = match.home_team_id ? table?.get(match.home_team_id) : null
    const away = match.away_team_id ? table?.get(match.away_team_id) : null
    if (!home || !away) continue

    const homeScore = match.home_score as number
    const awayScore = match.away_score as number

    home.gf += homeScore
    home.gd += homeScore - awayScore
    away.gf += awayScore
    away.gd += awayScore - homeScore

    if (homeScore > awayScore) home.pts += 3
    else if (homeScore < awayScore) away.pts += 3
    else {
      home.pts += 1
      away.pts += 1
    }
  }

  for (const [group, table] of byGroup) {
    const total = totalByGroup.get(group) ?? 0
    const finished = finishedByGroup.get(group) ?? 0
    // Solo grupos completos: una posicion puede cambiar mientras falten partidos.
    if (total === 0 || finished < total) continue

    const ranked = [...table.values()].sort(
      (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
    )

    // 1er lugar decidido si esta estrictamente por delante del 2do.
    if (ranked.length >= 2 && !sameTuple(ranked[0], ranked[1])) {
      winners[group] = ranked[0].id
    }
    // 2do lugar decidido si esta estrictamente entre el 1ro y el 3ro.
    if (
      ranked.length >= 3 &&
      !sameTuple(ranked[1], ranked[0]) &&
      !sameTuple(ranked[1], ranked[2])
    ) {
      runnersUp[group] = ranked[1].id
    }
  }

  return { winners, runnersUp }
}

const SLOT_TOKEN = /^([12])([A-L])$/

// Resuelve un token de cupo ("1A", "2B") a un id de equipo, o null si no es un
// token determinista de posicion de grupo o la posicion aun no esta decidida.
// Los terceros ("3C/E/F/H/I") y los tokens de ganador de partido devuelven null.
export function resolveGroupSlotToken(token: string, slots: GroupSlots): string | null {
  const match = SLOT_TOKEN.exec(token.trim())
  if (!match) return null

  const [, position, group] = match
  return position === '1' ? (slots.winners[group] ?? null) : (slots.runnersUp[group] ?? null)
}

// Parte una etiqueta placeholder como "1A vs 3C/E/F/H/I" en sus dos tokens de
// lado. Devuelve lados null para etiquetas que no son un simple "X vs Y".
export function parseBracketSides(label: string | null): {
  home: string | null
  away: string | null
} {
  if (!label) return { home: null, away: null }

  const parts = label.split(/\s+vs\s+/i)
  if (parts.length !== 2) return { home: null, away: null }

  return { home: parts[0].trim(), away: parts[1].trim() }
}

// ─── Tabla de posiciones completa (estilo Flashscore) ────────────────────────

type StandingsTeam = {
  id: string
  name: string
  code: string
  group_letter: string | null
}

type StandingsMatch = {
  group_letter: string | null
  home_team_id: string | null
  away_team_id: string | null
  home_score: number | null
  away_score: number | null
  status: string
  starts_at: string
}

export type FormResult = 'G' | 'E' | 'P' | '?'

export interface TeamStanding {
  teamId: string
  name: string
  code: string
  group: string
  pj: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  gd: number
  pts: number
  // Resultados de sus partidos de grupo en orden cronologico (jugados y por jugar).
  form: FormResult[]
  // Marcador del partido en curso (orientado a este equipo), o null si no juega ahora.
  // La posicion ya cuenta este partido de forma provisional.
  live: { for: number; against: number } | null
}

export interface GroupStandings {
  group: string
  rows: TeamStanding[]
}

export interface ThirdPlaceRow extends TeamStanding {
  // Va dentro de los cupos de mejores terceros (provisional si hay grupos incompletos).
  classified: boolean
}

// Cuantos mejores terceros avanzan a la ronda de 32 en el formato de 48.
export const ADVANCING_THIRD_PLACES = 8

function rankStandings(rows: TeamStanding[]): TeamStanding[] {
  return [...rows].sort(
    (a, b) =>
      b.pts - a.pts ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.name.localeCompare(b.name, 'es')
  )
}

export function buildGroupStandings(
  matches: StandingsMatch[],
  teams: StandingsTeam[]
): GroupStandings[] {
  const rowByTeam = new Map<string, TeamStanding>()
  const groups = new Set<string>()

  for (const team of teams) {
    if (!team.group_letter) continue
    groups.add(team.group_letter)
    rowByTeam.set(team.id, {
      teamId: team.id,
      name: team.name,
      code: team.code,
      group: team.group_letter,
      pj: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
      form: [],
      live: null,
    })
  }

  // Por equipo: lista de (fecha, resultado) de TODOS sus partidos de grupo, para
  // armar la columna FORMA en orden cronologico (incluye los aun no jugados).
  const formByTeam = new Map<string, { at: string; result: FormResult }[]>()
  const pushForm = (teamId: string, at: string, result: FormResult) => {
    const list = formByTeam.get(teamId) ?? []
    list.push({ at, result })
    formByTeam.set(teamId, list)
  }

  for (const match of matches) {
    if (!match.group_letter || !match.home_team_id || !match.away_team_id) continue
    const home = rowByTeam.get(match.home_team_id)
    const away = rowByTeam.get(match.away_team_id)
    if (!home || !away) continue

    const hasScore = match.home_score !== null && match.away_score !== null
    const finished = match.status === 'finished' && hasScore
    // Un partido en curso con marcador cuenta de forma PROVISIONAL en la tabla
    // (como Flashscore en vivo) y se muestra como pill, no como chip de forma.
    const live = match.status === 'in_progress' && hasScore

    if (!finished && !live) {
      pushForm(home.teamId, match.starts_at, '?')
      pushForm(away.teamId, match.starts_at, '?')
      continue
    }

    const hs = match.home_score as number
    const as = match.away_score as number

    home.pj += 1
    away.pj += 1
    home.gf += hs
    home.ga += as
    away.gf += as
    away.ga += hs

    if (hs > as) {
      home.w += 1
      away.l += 1
      home.pts += 3
    } else if (hs < as) {
      away.w += 1
      home.l += 1
      away.pts += 3
    } else {
      home.d += 1
      away.d += 1
      home.pts += 1
      away.pts += 1
    }

    if (live) {
      home.live = { for: hs, against: as }
      away.live = { for: as, against: hs }
    } else {
      const homeResult: FormResult = hs > as ? 'G' : hs < as ? 'P' : 'E'
      const awayResult: FormResult = hs > as ? 'P' : hs < as ? 'G' : 'E'
      pushForm(home.teamId, match.starts_at, homeResult)
      pushForm(away.teamId, match.starts_at, awayResult)
    }
  }

  for (const row of rowByTeam.values()) {
    row.gd = row.gf - row.ga
    const form = (formByTeam.get(row.teamId) ?? [])
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .map(entry => entry.result)
    row.form = form
  }

  const byGroup = new Map<string, TeamStanding[]>()
  for (const row of rowByTeam.values()) {
    if (!byGroup.has(row.group)) byGroup.set(row.group, [])
    byGroup.get(row.group)!.push(row)
  }

  return [...groups]
    .sort()
    .map(group => ({ group, rows: rankStandings(byGroup.get(group) ?? []) }))
}

// Ranking de los terceros de cada grupo (provisional si hay grupos incompletos).
// Marca como clasificados los primeros `advancing` segun (puntos, DG, GF).
export function buildThirdsRanking(
  standings: GroupStandings[],
  advancing: number = ADVANCING_THIRD_PLACES
): ThirdPlaceRow[] {
  const thirds = standings
    .map(group => group.rows[2])
    .filter((row): row is TeamStanding => Boolean(row))

  const ranked = rankStandings(thirds)
  return ranked.map((row, index) => ({ ...row, classified: index < advancing }))
}
