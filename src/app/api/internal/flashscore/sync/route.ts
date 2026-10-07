import {
  resolveKnockoutTeamsFromFlashscore,
  syncLiveWorldCupScores,
  syncWorldCupResultsFromFlashscore,
} from '@/server/flashscore/sync'
import {
  resolveKnockoutTeamsFromGroups,
  resolveKnockoutTeamsFromWinners,
} from '@/server/tournament/bracket'

export const runtime = 'nodejs'

function readSecret(request: Request) {
  const bearerToken = request.headers.get('authorization')
  if (bearerToken?.startsWith('Bearer ')) {
    return bearerToken.slice('Bearer '.length).trim()
  }

  return request.headers.get('x-internal-cron-secret')?.trim() ?? null
}

export async function POST(request: Request) {
  const expectedSecret = process.env.INTERNAL_CRON_SECRET?.trim()
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  // ?mode=live     → scrapes HTML for live scores (every-minute cron)
  // ?mode=results  → fetches SportDB API for final scores (hourly cron)
  // ?mode=brackets → fills knockout teams from the scraped bracket (run after a round resolves)
  // default        → runs both (live + results)
  const mode = url.searchParams.get('mode') ?? 'both'

  if (!expectedSecret) {
    return Response.json(
      { error: 'Missing INTERNAL_CRON_SECRET on the server.' },
      { status: 500 }
    )
  }

  if (readSecret(request) !== expectedSecret) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    if (mode === 'live') {
      const summary = await syncLiveWorldCupScores({ dryRun })
      // Apenas el sync en vivo cierra un partido de eliminatorias, propaga su
      // ganador a la ronda siguiente para que el clasificado aparezca de inmediato
      // esperando rival (no espera al cron de brackets ni a que se defina el rival).
      const winners = await resolveKnockoutTeamsFromWinners({ dryRun })
      return Response.json({ mode: 'live', ...summary, winners, dryRun })
    }

    if (mode === 'results') {
      const summary = await syncWorldCupResultsFromFlashscore({ dryRun })
      return Response.json({ mode: 'results', ...summary, dryRun })
    }

    if (mode === 'brackets') {
      // Ganadores primero: propaga el clasificado de cada cruce ya jugado a la
      // ronda siguiente (y el perdedor de las semis al 3er puesto).
      const winners = await resolveKnockoutTeamsFromWinners({ dryRun })
      // Grupos: fija los lados deterministas ("1A"/"2B") apenas un grupo termina,
      // dejando ver al clasificado. Flashscore despues completa el lado de mejores
      // terceros, los empates por penales y los cruces ya publicados por completo.
      const groups = await resolveKnockoutTeamsFromGroups({ dryRun })
      const flashscore = await resolveKnockoutTeamsFromFlashscore({ dryRun })
      return Response.json({ mode: 'brackets', winners, groups, flashscore, dryRun })
    }

    // Both: live first, then final results
    const [live, results] = await Promise.all([
      syncLiveWorldCupScores({ dryRun }),
      syncWorldCupResultsFromFlashscore({ dryRun }),
    ])
    // Tras cerrar marcadores, propaga ganadores a la ronda siguiente.
    const winners = await resolveKnockoutTeamsFromWinners({ dryRun })
    return Response.json({ mode: 'both', live, results, winners, dryRun })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Flashscore sync failed unexpectedly.'

    return Response.json({ error: message }, { status: 500 })
  }
}
