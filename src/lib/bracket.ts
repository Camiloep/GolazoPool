// Estructura FIJA del bracket del Mundial 2026 por numero de partido. Es estable
// e independiente de si la etiqueta del cruce ya se limpio al resolverse: cada
// entrada lista los dos partidos cuyo GANADOR alimenta esa llave (73-88 son los
// dieciseisavos, las hojas del arbol; 104 es la final, la raiz).
const KNOCKOUT_FEEDERS: Record<number, [number, number]> = {
  89: [74, 77],
  90: [73, 75],
  91: [76, 78],
  92: [79, 80],
  93: [83, 84],
  94: [81, 82],
  95: [86, 88],
  96: [85, 87],
  97: [89, 90],
  98: [93, 94],
  99: [91, 92],
  100: [95, 96],
  101: [97, 98],
  102: [99, 100],
  104: [101, 102],
}

const FINAL_MATCH_NUMBER = 104
export const THIRD_PLACE_MATCH_NUMBER = 103

export const BRACKET_ROUND_TITLES: Record<string, string> = {
  r32: 'Dieciseisavos',
  r16: 'Octavos',
  quarterfinal: 'Cuartos',
  semifinal: 'Semifinal',
  final: 'Final',
}

const BRACKET_ROUND_ORDER = ['r32', 'r16', 'quarterfinal', 'semifinal', 'final']

export interface BracketRound<T> {
  phase: string
  title: string
  matches: T[]
}

// Ordena los partidos de cada ronda de arriba a abajo siguiendo un recorrido
// in-order desde la final, dejando los DOS alimentadores de cada cruce contiguos
// en la columna previa. Eso es lo que permite alinear visualmente la llave: con
// las columnas en `justify-around` y misma altura, cada cruce queda centrado
// entre sus dos alimentadores.
export function buildBracketRounds<T extends { matchNumber: number; phase: string }>(
  matches: T[]
): BracketRound<T>[] {
  const byNumber = new Map(matches.map(match => [match.matchNumber, match]))
  const orderByPhase: Record<string, T[]> = {}

  const visit = (num: number) => {
    const match = byNumber.get(num)
    if (!match) return
    const feeders = KNOCKOUT_FEEDERS[num]
    if (feeders) visit(feeders[0])
    ;(orderByPhase[match.phase] ??= []).push(match)
    if (feeders) visit(feeders[1])
  }
  visit(FINAL_MATCH_NUMBER)

  return BRACKET_ROUND_ORDER.filter(phase => orderByPhase[phase]?.length).map(phase => ({
    phase,
    title: BRACKET_ROUND_TITLES[phase] ?? phase,
    matches: orderByPhase[phase],
  }))
}

export function getThirdPlaceMatch<T extends { matchNumber: number }>(matches: T[]): T | null {
  return matches.find(match => match.matchNumber === THIRD_PLACE_MATCH_NUMBER) ?? null
}
