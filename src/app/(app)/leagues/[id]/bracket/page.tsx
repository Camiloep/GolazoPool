import TournamentBracket, { type BracketCard } from '@/components/leagues/TournamentBracket'
import { buildBracketRounds, getThirdPlaceMatch } from '@/lib/bracket'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

type TeamSnippet = { name: string; code: string }

function firstTeam(raw: TeamSnippet | TeamSnippet[] | null): TeamSnippet | null {
  if (!raw) return null
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

export default async function LeagueBracketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: leagueId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: league }, { data: membership }, { data: matches }] = await Promise.all([
    supabase.from('leagues').select('id, name').eq('id', leagueId).single(),
    supabase
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('matches')
      .select(
        'id, match_number, phase, starts_at, venue, label, status, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name, code), away_team:teams!matches_away_team_id_fkey(name, code)'
      )
      .neq('phase', 'group')
      .order('match_number'),
  ])

  if (!league || !membership) notFound()

  const cards: BracketCard[] = (matches ?? []).map(match => ({
    id: match.id,
    matchNumber: match.match_number,
    phase: match.phase,
    startsAt: match.starts_at,
    venue: match.venue,
    label: match.label,
    status: match.status,
    homeTeam: firstTeam(match.home_team as TeamSnippet | TeamSnippet[] | null),
    awayTeam: firstTeam(match.away_team as TeamSnippet | TeamSnippet[] | null),
    homeScore: match.home_score,
    awayScore: match.away_score,
  }))

  const rounds = buildBracketRounds(cards)
  const thirdPlace = getThirdPlaceMatch(cards)

  return (
    // Alto acotado al viewport menos los encabezados (header sticky h-21=84px +
    // su border 1px + py-8 del layout 64px = 149px; usamos 156 con margen para
    // que el redondeo no deje un overflow de 1px que dispara el scroll de pagina).
    // Asi la llave llena la pantalla con UN solo scroll interno.
    <div className="flex h-[calc(100dvh-156px)] min-h-105 flex-col gap-3">
      <div className="shrink-0">
        <Link className="brand-link text-sm" href={`/leagues/${leagueId}`}>
          Volver a {league.name}
        </Link>
        <h1 className="brand-display mt-1 text-3xl font-black text-foreground">Llave de eliminatorias</h1>
        <p className="mt-1 text-sm text-muted">
          El camino a la final. Toca un partido para pronosticar; arrastra para moverte por la llave.
        </p>
      </div>

      {rounds.length === 0 ? (
        <div className="brand-panel rounded-panel py-12 text-center">
          <p className="brand-display text-xl font-black text-foreground">La fase eliminatoria aun no esta disponible</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <TournamentBracket leagueId={leagueId} rounds={rounds} thirdPlace={thirdPlace} />
        </div>
      )}
    </div>
  )
}
